import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseCallRecordingProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}

export const useCallRecording = ({ localStream, remoteStreams }: UseCallRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const getMergedAudioStream = useCallback((): MediaStream | null => {
    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add local audio track
      if (localStream) {
        const localAudioTracks = localStream.getAudioTracks();
        if (localAudioTracks.length > 0) {
          const localSource = audioContext.createMediaStreamSource(
            new MediaStream([localAudioTracks[0]])
          );
          localSource.connect(destination);
        }
      }

      // Add all remote audio tracks
      remoteStreams.forEach((stream) => {
        const remoteAudioTracks = stream.getAudioTracks();
        if (remoteAudioTracks.length > 0) {
          const remoteSource = audioContext.createMediaStreamSource(
            new MediaStream([remoteAudioTracks[0]])
          );
          remoteSource.connect(destination);
        }
      });

      return destination.stream;
    } catch (error) {
      console.error('Error creating merged audio stream:', error);
      return null;
    }
  }, [localStream, remoteStreams]);

  const startRecording = useCallback(() => {
    const mergedStream = getMergedAudioStream();
    
    if (!mergedStream) {
      toast({
        title: 'Recording Error',
        description: 'No audio streams available to record',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check for supported MIME types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(mergedStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      recordingStartTimeRef.current = new Date();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        downloadRecording(blob, mimeType);
        chunksRef.current = [];
        recordingStartTimeRef.current = null;
        setRecordingDuration(0);
        
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast({
          title: 'Recording Error',
          description: 'An error occurred while recording',
          variant: 'destructive',
        });
        setIsRecording(false);
      };

      // Request data every second for more reliable recording
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Update duration counter
      durationIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - recordingStartTimeRef.current.getTime()) / 1000
          );
          setRecordingDuration(elapsed);
        }
      }, 1000);

      toast({
        title: 'Recording Started',
        description: 'Call recording has begun',
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording Error',
        description: 'Failed to start recording',
        variant: 'destructive',
      });
    }
  }, [getMergedAudioStream, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: 'Recording Stopped',
        description: 'Your recording is being saved...',
      });
    }
  }, [toast]);

  const downloadRecording = (blob: Blob, mimeType: string) => {
    const extension = mimeType.includes('webm') ? 'webm' : 'm4a';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `call-recording-${timestamp}.${extension}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Recording Saved',
      description: `Saved as ${filename}`,
    });
  };

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording,
  };
};
