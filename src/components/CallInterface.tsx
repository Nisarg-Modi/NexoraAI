import { useEffect, useRef, useState, useMemo } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Languages, Circle, Monitor, MonitorOff, PictureInPicture2, PictureInPictureIcon } from 'lucide-react';
import { useCallRecording } from '@/hooks/useCallRecording';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebRTC } from '@/hooks/useWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import LiveTranscription from './LiveTranscription';
import { useVoiceActivity } from '@/hooks/useVoiceActivity';
import { SpeakingBorder, VoiceWaveform } from './VoiceActivityIndicator';
import { CallDurationTimer } from './CallDurationTimer';
import { useVideoEffects, VideoEffect } from '@/hooks/useVideoEffects';
import { BackgroundEffectSelector } from './BackgroundEffectSelector';
interface CallInterfaceProps {
  callId: string;
  userId: string;
  participantIds: string[];
  participantNames: Map<string, string>;
  isVideo: boolean;
  onEndCall: () => void;
}

export const CallInterface = ({
  callId,
  userId,
  participantIds,
  participantNames,
  isVideo,
  onEndCall,
}: CallInterfaceProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [callStartTime] = useState<Date>(new Date());
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [backgroundEffect, setBackgroundEffect] = useState<VideoEffect>('none');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  console.log('CallInterface render - participantIds:', participantIds.length, 'isVideo:', isVideo);

  const {
    localStream,
    remoteStreams,
    isConnecting,
    isScreenSharing,
    initializeCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
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

  // Video effects (background blur)
  const { processedStream, isLoading: isEffectLoading, error: effectError } = useVideoEffects({
    inputStream: localStream,
    effect: backgroundEffect,
    enabled: isVideo && backgroundEffect !== 'none',
  });

  // Voice activity detection
  const { isSpeaking } = useVoiceActivity({
    callId,
    userId,
    localStream,
    remoteStreams,
  });

  // Call recording
  const { isRecording, isSaving, recordingDuration, toggleRecording } = useCallRecording({
    localStream,
    remoteStreams,
    callId,
    participantNames,
  });

  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  useEffect(() => {
    console.log('Initializing call with participants:', participantIds);
    initializeCall(participantIds);
  }, []);

  useEffect(() => {
    // Use processed stream (with effects) if available, otherwise use raw local stream
    const streamToUse = processedStream || localStream;
    
    if (streamToUse && localVideoRef.current) {
      console.log('🎥 Setting local stream to video element');
      console.log('📊 Local stream state:', {
        active: streamToUse.active,
        tracks: streamToUse.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        })),
        hasEffect: backgroundEffect !== 'none'
      });
      
      localVideoRef.current.srcObject = streamToUse;
      localVideoRef.current.muted = true; // Always mute own video
      // Let autoplay handle playback
      console.log('✅ Local stream attached, autoplay enabled');
    }
  }, [processedStream, localStream, backgroundEffect]);

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

  const handleToggleScreenShare = async () => {
    const result = await toggleScreenShare();
    if (result) {
      toast({
        description: 'Screen sharing started',
      });
    } else if (!isScreenSharing) {
      // Only show error if we tried to start (not stop)
      toast({
        description: 'Screen sharing stopped',
      });
    }
  };

  const handleEffectChange = (effect: VideoEffect) => {
    setBackgroundEffect(effect);
    if (effectError) {
      toast({
        description: effectError,
        variant: 'destructive',
      });
    } else {
      const effectLabels: Record<VideoEffect, string> = {
        'none': 'Background effect disabled',
        'blur': 'Background blur enabled',
        'blur-strong': 'Strong background blur enabled',
      };
      toast({
        description: effectLabels[effect],
      });
    }
  };

  const handleTogglePiP = async () => {
    const videoEl = mainVideoRef.current;
    
    if (!videoEl || !isVideo) {
      toast({
        description: 'Picture-in-Picture is only available for video calls',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
        toast({ description: 'Picture-in-Picture closed' });
      } else if (document.pictureInPictureEnabled) {
        await videoEl.requestPictureInPicture();
        setIsPiPActive(true);
        toast({ description: 'Picture-in-Picture enabled' });
      } else {
        toast({
          description: 'Picture-in-Picture is not supported in this browser',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('PiP error:', error);
      toast({
        description: 'Failed to toggle Picture-in-Picture',
        variant: 'destructive',
      });
    }
  };

  // Listen for PiP exit events
  useEffect(() => {
    const handlePiPExit = () => setIsPiPActive(false);
    document.addEventListener('leavepictureinpicture', handlePiPExit);
    return () => document.removeEventListener('leavepictureinpicture', handlePiPExit);
  }, []);

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
              <SpeakingBorder 
                isSpeaking={isSpeaking(mainParticipant[0])} 
                className="relative w-full h-full rounded-lg overflow-hidden bg-muted"
              >
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
                      <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center relative">
                        <Users className="w-16 h-16 text-primary" />
                        {isSpeaking(mainParticipant[0]) && (
                          <div className="absolute -bottom-2">
                            <VoiceWaveform isSpeaking={true} bars={5} />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="absolute bottom-4 left-4 bg-background/80 px-3 py-2 rounded text-base flex items-center gap-2">
                  {participantNames.get(mainParticipant[0]) || 'Participant'}
                  {isSpeaking(mainParticipant[0]) && (
                    <VoiceWaveform isSpeaking={true} bars={3} className="h-3" />
                  )}
                </div>
              </SpeakingBorder>
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
          <SpeakingBorder 
            isSpeaking={isSpeaking(userId)} 
            className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted border-2 border-primary"
          >
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
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center relative">
                  <Users className="w-6 h-6 text-primary" />
                  {isSpeaking(userId) && (
                    <div className="absolute -bottom-1">
                      <VoiceWaveform isSpeaking={true} bars={3} className="h-2" />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs flex items-center gap-1">
              You
              {isSpeaking(userId) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </div>
          </SpeakingBorder>

          {/* Other Remote Video Thumbnails */}
          {Array.from(remoteStreams.entries()).slice(1).map(([participantId, stream]) => (
            <SpeakingBorder 
              key={participantId} 
              isSpeaking={isSpeaking(participantId)}
              className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted"
            >
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
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center relative">
                    <Users className="w-6 h-6 text-primary" />
                    {isSpeaking(participantId) && (
                      <div className="absolute -bottom-1">
                        <VoiceWaveform isSpeaking={true} bars={3} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                {participantNames.get(participantId) || 'Unknown'}
                {isSpeaking(participantId) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            </SpeakingBorder>
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
                <>
                  <Button
                    size="lg"
                    variant={isVideoOff ? 'destructive' : 'secondary'}
                    onClick={handleToggleVideo}
                    className="rounded-full w-14 h-14"
                  >
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </Button>

                  <Button
                    size="lg"
                    variant={isScreenSharing ? 'default' : 'secondary'}
                    onClick={handleToggleScreenShare}
                    className="rounded-full w-14 h-14"
                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                  >
                    {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                  </Button>

                  <Button
                    size="lg"
                    variant={isPiPActive ? 'default' : 'secondary'}
                    onClick={handleTogglePiP}
                    className="rounded-full w-14 h-14"
                    title={isPiPActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
                  >
                    {isPiPActive ? <PictureInPictureIcon className="w-6 h-6" /> : <PictureInPicture2 className="w-6 h-6" />}
                  </Button>

                  <BackgroundEffectSelector
                    currentEffect={backgroundEffect}
                    onEffectChange={handleEffectChange}
                    isLoading={isEffectLoading}
                    disabled={isScreenSharing}
                  />
                </>
              )}

              <Button
                size="lg"
                variant={showTranscription ? 'default' : 'secondary'}
                onClick={() => setShowTranscription(!showTranscription)}
                className="rounded-full w-14 h-14"
                title="Toggle Live Transcription"
              >
                <Languages className="w-6 h-6" />
              </Button>

              <Button
                size="lg"
                variant={isRecording ? 'destructive' : 'secondary'}
                onClick={toggleRecording}
                className="rounded-full w-14 h-14 relative"
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                <Circle className={`w-6 h-6 ${isRecording ? 'fill-current animate-pulse' : ''}`} />
                {isRecording && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {formatRecordingDuration(recordingDuration)}
                  </span>
                )}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                onClick={handleEndCall}
                className="rounded-full w-14 h-14"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>

            <div className="flex items-center justify-center gap-3 mt-4">
              <CallDurationTimer startTime={callStartTime} />
              <span className="text-muted-foreground">•</span>
              <p className="text-sm text-muted-foreground">
                {participantIds.length} participant{participantIds.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Live Transcription Sidebar */}
        {showTranscription && user && (
          <div className="w-96 border-l p-4 overflow-y-auto space-y-4">
            <LiveTranscription
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
