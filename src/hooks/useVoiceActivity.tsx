import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceActivityState {
  [participantId: string]: boolean;
}

interface UseVoiceActivityProps {
  callId: string;
  userId: string;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}

export const useVoiceActivity = ({
  callId,
  userId,
  localStream,
  remoteStreams,
}: UseVoiceActivityProps) => {
  const [speakingState, setSpeakingState] = useState<VoiceActivityState>({});
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; context: AudioContext }>>(new Map());

  // Threshold for voice activity detection (0-255, higher = less sensitive)
  const VOICE_THRESHOLD = 30;
  // Smoothing factor to prevent rapid on/off switching
  const SMOOTHING_FRAMES = 5;
  const speakingCountRef = useRef(0);

  // Analyze local audio for voice activity
  useEffect(() => {
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(localStream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const checkVoiceActivity = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        if (average > VOICE_THRESHOLD) {
          speakingCountRef.current = Math.min(speakingCountRef.current + 1, SMOOTHING_FRAMES);
        } else {
          speakingCountRef.current = Math.max(speakingCountRef.current - 1, 0);
        }

        const isSpeaking = speakingCountRef.current >= SMOOTHING_FRAMES / 2;
        
        setLocalSpeaking(prev => {
          if (prev !== isSpeaking) {
            // Broadcast state change via realtime
            broadcastSpeakingState(isSpeaking);
          }
          return isSpeaking;
        });

        animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
      };

      checkVoiceActivity();
    } catch (error) {
      console.error('Error setting up voice activity detection:', error);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [localStream]);

  // Analyze remote streams for voice activity
  useEffect(() => {
    const setupRemoteAnalyser = (participantId: string, stream: MediaStream) => {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      try {
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        remoteAnalysersRef.current.set(participantId, { analyser, context });
      } catch (error) {
        console.error(`Error setting up analyser for ${participantId}:`, error);
      }
    };

    // Setup analysers for new remote streams
    remoteStreams.forEach((stream, participantId) => {
      if (!remoteAnalysersRef.current.has(participantId)) {
        setupRemoteAnalyser(participantId, stream);
      }
    });

    // Clean up analysers for removed streams
    remoteAnalysersRef.current.forEach((_, participantId) => {
      if (!remoteStreams.has(participantId)) {
        const analyserData = remoteAnalysersRef.current.get(participantId);
        if (analyserData?.context.state !== 'closed') {
          analyserData?.context.close();
        }
        remoteAnalysersRef.current.delete(participantId);
      }
    });

    // Check remote voice activity
    const checkRemoteActivity = () => {
      const newState: VoiceActivityState = {};
      
      remoteAnalysersRef.current.forEach((analyserData, participantId) => {
        const dataArray = new Uint8Array(analyserData.analyser.frequencyBinCount);
        analyserData.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        newState[participantId] = average > VOICE_THRESHOLD;
      });

      setSpeakingState(prev => {
        const hasChanges = Object.keys(newState).some(
          key => prev[key] !== newState[key]
        );
        return hasChanges ? { ...prev, ...newState } : prev;
      });

      requestAnimationFrame(checkRemoteActivity);
    };

    if (remoteStreams.size > 0) {
      checkRemoteActivity();
    }

    return () => {
      remoteAnalysersRef.current.forEach((analyserData) => {
        if (analyserData.context.state !== 'closed') {
          analyserData.context.close();
        }
      });
      remoteAnalysersRef.current.clear();
    };
  }, [remoteStreams]);

  // Setup realtime channel for broadcasting speaking state
  useEffect(() => {
    if (!callId || !userId) return;

    const channel = supabase.channel(`voice-activity:${callId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newSpeakingState: VoiceActivityState = {};
        
        Object.entries(state).forEach(([oderId, presences]) => {
          if (oderId !== oderId && Array.isArray(presences)) {
            const isSpeaking = presences.some((p: any) => p.speaking === true);
            newSpeakingState[oderId] = isSpeaking;
          }
        });
        
        setSpeakingState(prev => ({ ...prev, ...newSpeakingState }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ speaking: false });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [callId, userId]);

  const broadcastSpeakingState = useCallback(async (isSpeaking: boolean) => {
    if (!channelRef.current) return;
    try {
      await channelRef.current.track({ speaking: isSpeaking });
    } catch (error) {
      console.error('Error broadcasting speaking state:', error);
    }
  }, []);

  // Combined state including local user
  const combinedState: VoiceActivityState = {
    ...speakingState,
    [userId]: localSpeaking,
  };

  return {
    speakingState: combinedState,
    isLocalSpeaking: localSpeaking,
    isSpeaking: (participantId: string) => combinedState[participantId] || false,
  };
};
