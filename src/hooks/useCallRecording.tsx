import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { createObjectUrlDownload } from '@/utils/downloadBlob';
import { supabase } from '@/integrations/supabase/client';

interface UseCallRecordingProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  callId?: string;
  participantNames?: Map<string, string>;
}

export const useCallRecording = ({ 
  localStream, 
  remoteStreams, 
  callId,
  participantNames 
}: UseCallRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const revokeUrlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalDurationRef = useRef<number>(0);
  const { toast } = useToast();

  const getMergedAudioStream = useCallback((): MediaStream | null => {
    try {
      console.log('Creating merged audio stream...');
      console.log('Local stream:', localStream ? 'available' : 'null');
      console.log('Remote streams count:', remoteStreams.size);

      // Close existing audio context if any
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      let hasAudioTracks = false;

      // Add local audio track
      if (localStream) {
        const localAudioTracks = localStream.getAudioTracks();
        console.log('Local audio tracks:', localAudioTracks.length);
        if (localAudioTracks.length > 0) {
          const localSource = audioContext.createMediaStreamSource(
            new MediaStream([localAudioTracks[0]])
          );
          localSource.connect(destination);
          hasAudioTracks = true;
          console.log('Added local audio track to recording');
        }
      }

      // Add all remote audio tracks
      remoteStreams.forEach((stream, id) => {
        const remoteAudioTracks = stream.getAudioTracks();
        console.log(`Remote stream ${id} audio tracks:`, remoteAudioTracks.length);
        if (remoteAudioTracks.length > 0) {
          const remoteSource = audioContext.createMediaStreamSource(
            new MediaStream([remoteAudioTracks[0]])
          );
          remoteSource.connect(destination);
          hasAudioTracks = true;
          console.log(`Added remote audio track from ${id} to recording`);
        }
      });

      if (!hasAudioTracks) {
        console.warn('No audio tracks found for recording');
        return null;
      }

      console.log('Merged audio stream created successfully');
      return destination.stream;
    } catch (error) {
      console.error('Error creating merged audio stream:', error);
      return null;
    }
  }, [localStream, remoteStreams]);

  const saveRecordingToStorage = useCallback(async (blob: Blob, mimeType: string, duration: number) => {
    try {
      setIsSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return false;
      }

      const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'm4a';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `call-recording-${timestamp}.${extension}`;
      const filePath = `${user.id}/${filename}`;

      console.log('Uploading recording to storage:', filePath);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading recording:', uploadError);
        throw uploadError;
      }

      // Get participant names for metadata
      const participants: string[] = [];
      if (participantNames) {
        participantNames.forEach((name) => {
          participants.push(name);
        });
      }

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('call_recordings')
        .insert({
          user_id: user.id,
          call_id: callId || null,
          file_name: filename,
          file_path: filePath,
          duration: duration,
          file_size: blob.size,
          participants: participants,
        });

      if (dbError) {
        console.error('Error saving recording metadata:', dbError);
        // Try to clean up the uploaded file
        await supabase.storage.from('call-recordings').remove([filePath]);
        throw dbError;
      }

      console.log('Recording saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save recording:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [callId, participantNames]);

  const downloadRecording = useCallback((blob: Blob, mimeType: string) => {
    console.log('Attempting to download recording...');
    console.log('Blob size:', blob.size, 'bytes');
    console.log('MIME type:', mimeType);

    if (blob.size === 0) {
      console.error('Recording blob is empty');
      toast({
        title: 'Recording Failed',
        description: 'No audio data was captured. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'm4a';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `call-recording-${timestamp}.${extension}`;

      console.log('Creating download for:', filename);

      // Clean up any previous URL (avoid leaking memory)
      if (revokeUrlTimeoutRef.current) {
        clearTimeout(revokeUrlTimeoutRef.current);
        revokeUrlTimeoutRef.current = null;
      }
      if (activeObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(activeObjectUrlRef.current);
        } catch {
          // ignore
        }
        activeObjectUrlRef.current = null;
      }

      const { url, triggerDownload } = createObjectUrlDownload(blob, filename);
      activeObjectUrlRef.current = url;

      // IMPORTANT: Do NOT revoke immediately — some browsers need time to start the download.
      // Keep it alive long enough for the download to begin, and provide a manual fallback.
      triggerDownload();

      revokeUrlTimeoutRef.current = setTimeout(() => {
        if (activeObjectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          activeObjectUrlRef.current = null;
        }
        revokeUrlTimeoutRef.current = null;
      }, 60_000);

      toast({
        title: 'Recording Ready',
        description: 'If the download did not start, tap Open to save it from a new tab.',
        action: (
          <ToastAction altText="Open recording" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            Open
          </ToastAction>
        ),
      });
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to save the recording. Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const startRecording = useCallback(() => {
    console.log('Starting recording...');
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
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      console.log('Using MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(mergedStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      recordingStartTimeRef.current = new Date();
      finalDurationRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, chunks collected:', chunksRef.current.length);
        const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
        console.log('Total recorded size:', totalSize, 'bytes');
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = finalDurationRef.current;
        
        // Save to cloud storage
        const saved = await saveRecordingToStorage(blob, mimeType, duration);
        
        if (saved) {
          toast({
            title: 'Recording Saved',
            description: 'Your recording has been saved to your library.',
          });
        } else {
          // Fallback to download if cloud save fails
          downloadRecording(blob, mimeType);
        }
        
        chunksRef.current = [];
        recordingStartTimeRef.current = null;
        setRecordingDuration(0);
        
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        // Clean up audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      mediaRecorder.onerror = (event: Event) => {
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
      console.log('MediaRecorder started');

      // Update duration counter
      durationIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - recordingStartTimeRef.current.getTime()) / 1000
          );
          setRecordingDuration(elapsed);
          finalDurationRef.current = elapsed;
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
  }, [getMergedAudioStream, downloadRecording, saveRecordingToStorage, toast]);

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('MediaRecorder state:', mediaRecorderRef.current.state);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: 'Recording Stopped',
        description: 'Your recording is being saved...',
      });
    } else {
      console.warn('MediaRecorder not active, cannot stop');
    }
  }, [toast]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSaving,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording,
  };
};
