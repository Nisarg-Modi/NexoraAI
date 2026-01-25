import { useEffect, useRef, useState, useMemo } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebRTC } from '@/hooks/useWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import LiveTranscription from './LiveTranscription';


interface CallInterfaceProps {
  callId: string;
  userId: string;
  participantIds: string[];
  participantNames: Map<string, string>;
  isVideo: boolean;
  onEndCall: () => void;
  meetingId?: string;
}

export const CallInterface = ({
  callId,
  userId,
  participantIds,
  participantNames,
  isVideo,
  onEndCall,
  meetingId,
}: CallInterfaceProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showTranscription, setShowTranscription] = useState(!!meetingId);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  console.log('CallInterface render - participantIds:', participantIds.length, 'isVideo:', isVideo);

  const {
    localStream,
    remoteStreams,
    isConnecting,
    initializeCall,
    toggleAudio,
    toggleVideo,
    endCall,
  } = useWebRTC({
    callId,
    userId,
    isVideo,
    onRemoteStream: (stream) => {
      console.log('New remote stream received, tracks:', stream.getTracks().map(t => t.kind));
    },
  });

  console.log('CallInterface - localStream:', !!localStream, 'remoteStreams:', remoteStreams.size);

  useEffect(() => {
    console.log('Initializing call with participants:', participantIds);
    initializeCall(participantIds);
  }, []);

  useEffect(() => {
    if (!meetingId) return;

    // Fetch transcripts initially
    const fetchTranscripts = async () => {
      const { data } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (data) {
        setTranscripts(data);
      }
    };

    fetchTranscripts();

    // Poll for new transcripts every 10 seconds
    const interval = setInterval(fetchTranscripts, 10000);

    return () => clearInterval(interval);
  }, [meetingId]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('🎥 Setting local stream to video element');
      console.log('📊 Local stream state:', {
        active: localStream.active,
        tracks: localStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }))
      });
      
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Always mute own video
      // Let autoplay handle playback
      console.log('✅ Local stream attached, autoplay enabled');
    }
  }, [localStream]);

  const handleToggleMute = () => {
    const newState = toggleAudio();
    setIsMuted(!newState);
    toast({
      description: newState ? 'Microphone on' : 'Microphone off',
    });
  };

  const handleToggleVideo = () => {
    const newState = toggleVideo();
    setIsVideoOff(!newState);
    toast({
      description: newState ? 'Camera on' : 'Camera off',
    });
  };

  // Get the first remote participant for main view - memoized to prevent unnecessary re-renders
  const mainParticipant = useMemo(() => {
    const entries = Array.from(remoteStreams.entries());
    return entries.length > 0 ? entries[0] : null;
  }, [remoteStreams]);
  
  const mainVideoRef = useRef<HTMLVideoElement>(null);

  // Log remote streams changes
  useEffect(() => {
    console.log('Remote streams updated. Count:', remoteStreams.size);
    remoteStreams.forEach((stream, id) => {
      console.log(`  - Participant ${id}: ${stream.getTracks().map(t => `${t.kind} (${t.enabled})`).join(', ')}`);
    });
  }, [remoteStreams]);

  // Set up main video/audio when participant or stream changes
  useEffect(() => {
    if (!mainParticipant?.[1]) return;

    const [participantId, stream] = mainParticipant;
    
    console.log('🎬 Setting main media for participant:', participantId);
    console.log('📊 Main stream state:', {
      id: stream.id,
      active: stream.active,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted
      }))
    });
    
    // Ensure all tracks are enabled
    stream.getTracks().forEach(track => {
      if (!track.enabled) {
        track.enabled = true;
        console.log(`🔊 Enabled ${track.kind} track`);
      }
      
      // Listen for unmute event on tracks
      track.onunmute = () => {
        console.log(`🎵 Track unmuted - audio should start flowing:`, track.kind);
        // Retry playing audio when track unmutes
        if (!isVideo && mainVideoRef.current) {
          const audioEl = mainVideoRef.current as HTMLAudioElement;
          audioEl.play()
            .then(() => console.log('✅ Audio playing after unmute'))
            .catch(e => console.error('❌ Error playing audio after unmute:', e));
        }
      };
    });
    
    if (isVideo) {
      // For video calls, use video element
      const videoEl = mainVideoRef.current;
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
        videoEl.muted = false;
        videoEl.volume = 1.0;
        console.log('✅ Main video stream attached, autoplay will handle playback');
      }
    } else {
      // For audio-only calls, create/update audio element
      const audioEl = mainVideoRef.current as HTMLAudioElement;
      if (audioEl && audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1.0;
        
        console.log('🔊 Attempting to play audio...');
        audioEl.play()
          .then(() => console.log('✅ Audio element playing'))
          .catch(e => console.error('❌ Error playing audio:', e));
      }
    }
  }, [mainParticipant, isVideo]);

  const handleEndCall = async () => {
    endCall();
    
    // Update call status
    await supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId);

    // Update participant status
    await supabase
      .from('call_participants')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('call_id', callId)
      .eq('user_id', userId);

    onEndCall();
  };

  if (isConnecting) {
    return (
      <Card className="fixed inset-4 z-50 flex items-center justify-center bg-background/95 backdrop-blur">
        <div className="text-center space-y-4">
          <Phone className="w-16 h-16 animate-pulse mx-auto text-primary" />
          <p className="text-lg">Connecting...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="fixed inset-4 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex gap-4 h-full">
        {/* Main Video/Call Area */}
        <div className="flex-1 flex flex-col">
          {/* Main Video Area */}
          <div className="flex-1 p-4 flex items-center justify-center">
            {mainParticipant ? (
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-muted">
                {isVideo ? (
                  <video
                    ref={mainVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    <audio
                      ref={mainVideoRef as any}
                      autoPlay
                      playsInline
                      className="hidden"
                    />
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="w-16 h-16 text-primary" />
                      </div>
                    </div>
                  </>
                )}
                <div className="absolute bottom-4 left-4 bg-background/80 px-3 py-2 rounded text-base">
                  {participantNames.get(mainParticipant[0]) || 'Participant'}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Phone className="w-16 h-16 animate-pulse mx-auto text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">Waiting for others to join...</p>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          <div className="px-4 pb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">{/* ... keep existing code */}
          {/* Local Video Thumbnail */}
          <div className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted border-2 border-primary">
            {isVideo ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs">
              You
            </div>
          </div>

          {/* Other Remote Video Thumbnails */}
          {Array.from(remoteStreams.entries()).slice(1).map(([participantId, stream]) => (
            <div key={participantId} className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted">
              {isVideo ? (
                <video
                  ref={(el) => {
                    if (el && el.srcObject !== stream) {
                      console.log('🎬 Setting thumbnail video for:', participantId);
                      
                      // Ensure all tracks are enabled
                      stream.getTracks().forEach(track => {
                        if (!track.enabled) {
                          track.enabled = true;
                          console.log(`🔊 Enabled ${track.kind} track for thumbnail`);
                        }
                      });
                      
                      el.srcObject = stream;
                      el.muted = false;
                      el.volume = 1.0;
                      
                      // Let autoplay handle playback
                      console.log('✅ Thumbnail stream attached, autoplay enabled');
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs">
                {participantNames.get(participantId) || 'Unknown'}
              </div>
            </div>
          ))}

          {/* Empty slots for participants not yet connected */}
          {participantIds.length - remoteStreams.size - 1 > 0 &&
            Array.from({ length: participantIds.length - remoteStreams.size - 1 }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-shrink-0 w-32 h-24 rounded-lg bg-muted flex items-center justify-center">
                <Phone className="w-6 h-6 animate-pulse text-muted-foreground" />
              </div>
            ))}
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 bg-background border-t">
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                variant={isMuted ? 'destructive' : 'secondary'}
                onClick={handleToggleMute}
                className="rounded-full w-14 h-14"
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>

              {isVideo && (
                <Button
                  size="lg"
                  variant={isVideoOff ? 'destructive' : 'secondary'}
                  onClick={handleToggleVideo}
                  className="rounded-full w-14 h-14"
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </Button>
              )}

              <Button
                size="lg"
                variant="destructive"
                onClick={handleEndCall}
                className="rounded-full w-14 h-14"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>

            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">
                {participantIds.length} participant{participantIds.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Live Transcription Sidebar */}
        {showTranscription && meetingId && user && (
          <div className="w-96 border-l p-4 overflow-y-auto space-y-4">
            <LiveTranscription
              meetingId={meetingId}
              userId={userId}
              userName={user.email || 'You'}
              targetLanguage="en"
              enabled={true}
            />
          </div>
        )}
      </div>
    </Card>
  );
};
