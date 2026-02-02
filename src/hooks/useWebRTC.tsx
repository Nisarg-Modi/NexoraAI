import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WebRTCConfig {
  callId: string;
  userId: string;
  isVideo: boolean;
  onRemoteStream?: (stream: MediaStream) => void;
}

export const useWebRTC = ({ callId, userId, isVideo, onRemoteStream }: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const channelRef = useRef<any>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  const startLocalStream = async () => {
    try {
      console.log('Requesting getUserMedia with video:', isVideo, 'audio:', true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      });
      
      console.log('Got local stream with tracks:', stream.getTracks().map(t => `${t.kind} (${t.label})`));
      
      // Ensure audio tracks are enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('🔊 Audio track enabled:', track.label);
      });
      
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };

  const createPeerConnection = (participantId: string, stream: MediaStream) => {
    console.log('🔌 Creating peer connection for:', participantId);
    const pc = new RTCPeerConnection(configuration);

    // Add local tracks to peer connection
    stream.getTracks().forEach(track => {
      console.log(`➕ Adding ${track.kind} track:`, {
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState
      });
      pc.addTrack(track, stream);
    });

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`🎥 Received remote ${event.track.kind} track from:`, participantId);
      console.log('📊 Track details:', {
        id: event.track.id,
        readyState: event.track.readyState,
        enabled: event.track.enabled,
        muted: event.track.muted
      });
      
      // Listen for unmute event (when audio data starts flowing)
      event.track.onunmute = () => {
        console.log(`🔊 Track unmuted and audio data flowing:`, event.track.kind);
      };
      
      event.track.onended = () => {
        console.log(`🛑 Track ended:`, event.track.kind);
      };
      
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        console.log('📺 Remote stream details:', {
          id: remoteStream.id,
          active: remoteStream.active,
          tracks: remoteStream.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          }))
        });
        
        // Ensure all tracks are enabled
        remoteStream.getTracks().forEach(track => {
          if (!track.enabled) {
            console.warn('⚠️ Track was disabled, enabling:', track.kind);
            track.enabled = true;
          }
          if (track.muted) {
            console.log('⏳ Track is muted (waiting for data):', track.kind);
          }
        });
        
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.set(participantId, remoteStream);
          console.log('✅ Updated remote streams. Total participants:', updated.size);
          return updated;
        });
        
        onRemoteStream?.(remoteStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', participantId);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            },
            from: userId,
            to: participantId,
          },
        });
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state [${participantId}]:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed, attempting restart');
        pc.restartIce();
      } else if (pc.iceConnectionState === 'connected') {
        console.log('✅ ICE connection established');
        // Log track states after ICE connects
        pc.getReceivers().forEach(receiver => {
          if (receiver.track) {
            console.log(`📊 After ICE connect - ${receiver.track.kind} track:`, {
              enabled: receiver.track.enabled,
              muted: receiver.track.muted,
              readyState: receiver.track.readyState
            });
          }
        });
      }
    };

    // Monitor overall connection state
    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state [${participantId}]:`, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log('✅ Peer connection fully established');
      } else if (pc.connectionState === 'failed') {
        console.error('❌ Peer connection failed');
      }
    };

    // Monitor signaling state
    pc.onsignalingstatechange = () => {
      console.log(`📡 Signaling state [${participantId}]:`, pc.signalingState);
    };

    peerConnections.current.set(participantId, pc);
    return pc;
  };

  const makeOffer = async (participantId: string, stream: MediaStream) => {
    try {
      console.log('Creating offer for:', participantId);
      const pc = createPeerConnection(participantId, stream);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      
      await pc.setLocalDescription(offer);
      console.log('Sending offer to:', participantId);

      await channelRef.current?.send({
        type: 'broadcast',
        event: 'offer',
        payload: {
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
          from: userId,
          to: participantId,
        },
      });
    } catch (error) {
      console.error('Error making offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string, stream: MediaStream) => {
    try {
      console.log('Handling offer from:', from);
      const pc = createPeerConnection(from, stream);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote description set for:', from);
      
      // Process any pending ICE candidates
      const pending = pendingIceCandidates.current.get(from);
      if (pending && pending.length > 0) {
        console.log(`Processing ${pending.length} pending ICE candidates for:`, from);
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceCandidates.current.delete(from);
      }
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Sending answer to:', from);

      await channelRef.current?.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
          from: userId,
          to: from,
        },
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit, from: string) => {
    try {
      const pc = peerConnections.current.get(from);
      if (pc) {
        // Check if we can set remote description (prevent duplicates)
        if (pc.signalingState !== 'have-local-offer') {
          console.log('⚠️ Ignoring duplicate answer from:', from, 'state:', pc.signalingState);
          return;
        }
        
        console.log('Setting remote answer from:', from);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process any pending ICE candidates
        const pending = pendingIceCandidates.current.get(from);
        if (pending && pending.length > 0) {
          console.log(`Processing ${pending.length} pending ICE candidates for:`, from);
          for (const candidate of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingIceCandidates.current.delete(from);
        }
      } else {
        console.error('No peer connection found for:', from);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit, from: string) => {
    try {
      const pc = peerConnections.current.get(from);
      if (pc && pc.remoteDescription) {
        console.log('Adding ICE candidate from:', from);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else if (pc) {
        // Queue ICE candidate until remote description is set
        console.log('Queueing ICE candidate from:', from);
        const pending = pendingIceCandidates.current.get(from) || [];
        pending.push(candidate);
        pendingIceCandidates.current.set(from, pending);
      } else {
        console.warn('No peer connection found for ICE candidate from:', from);
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const initializeCall = async (participantIds: string[]) => {
    setIsConnecting(true);
    try {
      console.log('🚀 Initializing call with participants:', participantIds);
      console.log('📞 Media constraints - audio: true, video:', isVideo);
      
      // Get local media stream first
      const stream = await startLocalStream();
      console.log('✅ Local stream acquired:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active
      });
      
      // Set up signaling channel
      const channel = supabase.channel(`call:${callId}`, {
        config: {
          broadcast: { self: false },
        },
      });
      channelRef.current = channel;

      // Subscribe to signaling events
      channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.to === userId) {
            console.log('📨 Received offer from:', payload.from);
            await handleOffer(payload.offer, payload.from, stream);
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.to === userId) {
            console.log('📨 Received answer from:', payload.from);
            await handleAnswer(payload.answer, payload.from);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.to === userId) {
            console.log('📨 Received ICE candidate from:', payload.from);
            await handleIceCandidate(payload.candidate, payload.from);
          }
        })
        .subscribe(async (status) => {
          console.log('📡 Channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            // Wait a moment for full connection
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Now initiate connections to other participants
            console.log('👥 Creating peer connections...');
            for (const participantId of participantIds) {
              if (participantId !== userId) {
                console.log('🤝 Initiating connection to:', participantId);
                await makeOffer(participantId, stream);
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
          }
        });

    } catch (error) {
      console.error('❌ Error initializing call:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  };

  const startScreenShare = async () => {
    if (!isVideo) {
      console.warn('Screen sharing is only available in video calls');
      return false;
    }

    try {
      console.log('🖥️ Starting screen share with audio...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        console.error('No video track in screen share stream');
        return false;
      }

      screenStreamRef.current = screenStream;

      // Save the original video track so we can restore it later
      if (localStream) {
        const originalVideoTrack = localStream.getVideoTracks()[0];
        if (originalVideoTrack) {
          originalVideoTrackRef.current = originalVideoTrack;
        }
      }

      // Replace the video track in all peer connections
      peerConnections.current.forEach((pc, participantId) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          console.log('🔄 Replacing video track for:', participantId);
          sender.replaceTrack(screenTrack);
        }
      });

      // Handle system audio from screen share (if user selected "Share audio")
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (screenAudioTrack) {
        console.log('🔊 Screen share includes system audio');
        // Add the screen audio track to all peer connections and track the senders
        screenAudioSendersRef.current.clear();
        peerConnections.current.forEach((pc, participantId) => {
          console.log('➕ Adding screen audio track for:', participantId);
          const sender = pc.addTrack(screenAudioTrack, screenStream);
          screenAudioSendersRef.current.set(participantId, sender);
        });
      } else {
        console.log('ℹ️ No system audio selected for screen share');
      }

      // Update local stream to show screen share in preview
      if (localStream) {
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
        }
        localStream.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStream.getTracks()));
      }

      // Handle when user stops sharing via browser UI
      screenTrack.onended = () => {
        console.log('🖥️ Screen share ended by user');
        stopScreenShare();
      };

      setIsScreenSharing(true);
      console.log('✅ Screen sharing started');
      return true;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return false;
    }
  };

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) {
      console.warn('No active screen share to stop');
      return;
    }

    try {
      console.log('🖥️ Stopping screen share...');

      // Remove screen audio senders from peer connections
      screenAudioSendersRef.current.forEach((sender, participantId) => {
        const pc = peerConnections.current.get(participantId);
        if (pc) {
          console.log('🔇 Removing screen audio track for:', participantId);
          try {
            pc.removeTrack(sender);
          } catch (e) {
            console.warn('Could not remove screen audio sender:', e);
          }
        }
      });
      screenAudioSendersRef.current.clear();

      // Stop the screen share stream
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;

      // Restore the original video track
      const originalTrack = originalVideoTrackRef.current;
      if (originalTrack && localStream) {
        // Replace screen track with original camera track in peer connections
        peerConnections.current.forEach((pc, participantId) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            console.log('🔄 Restoring video track for:', participantId);
            sender.replaceTrack(originalTrack);
          }
        });

        // Update local stream
        const screenTrack = localStream.getVideoTracks()[0];
        if (screenTrack) {
          localStream.removeTrack(screenTrack);
        }
        localStream.addTrack(originalTrack);
        setLocalStream(new MediaStream(localStream.getTracks()));
      }

      originalVideoTrackRef.current = null;
      setIsScreenSharing(false);
      console.log('✅ Screen sharing stopped, camera restored');
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return false;
    } else {
      return await startScreenShare();
    }
  };

  const endCall = () => {
    // Stop screen share if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Stop local stream
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsScreenSharing(false);
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    localStream,
    remoteStreams,
    isConnecting,
    isScreenSharing,
    initializeCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    endCall,
  };
};
