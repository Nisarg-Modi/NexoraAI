import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Clock, 
  Users, 
  FileAudio,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface CallRecording {
  id: string;
  user_id: string;
  call_id: string | null;
  file_name: string;
  file_path: string;
  duration: number;
  file_size: number;
  participants: string[];
  created_at: string;
}

export const RecordingsLibrary = ({ onBack }: { onBack?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Fetch recordings
  const { data: recordings, isLoading } = useQuery({
    queryKey: ['call-recordings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CallRecording[];
    },
    enabled: !!user,
  });

  // Delete recording mutation
  const deleteRecording = useMutation({
    mutationFn: async (recording: CallRecording) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('call-recordings')
        .remove([recording.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('call_recordings')
        .delete()
        .eq('id', recording.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-recordings'] });
      toast({
        title: 'Recording Deleted',
        description: 'The recording has been permanently removed.',
      });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete the recording. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePlay = async (recording: CallRecording) => {
    try {
      // Stop currently playing audio
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }

      if (playingId === recording.id) {
        setPlayingId(null);
        setAudioElement(null);
        return;
      }

      // Get signed URL
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(recording.file_path, 3600);

      if (error) throw error;

      const audio = new Audio(data.signedUrl);
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      audio.onerror = () => {
        toast({
          title: 'Playback Error',
          description: 'Failed to play the recording.',
          variant: 'destructive',
        });
        setPlayingId(null);
        setAudioElement(null);
      };

      await audio.play();
      setPlayingId(recording.id);
      setAudioElement(audio);
    } catch (error) {
      console.error('Playback error:', error);
      toast({
        title: 'Playback Error',
        description: 'Failed to load the recording.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (recording: CallRecording) => {
    try {
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(recording.file_path, 3600);

      if (error) throw error;

      // Create download link
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = recording.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download Started',
        description: 'Your recording is being downloaded.',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download the recording.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please sign in to view your recordings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h2 className="text-2xl font-bold">Call Recordings</h2>
          <p className="text-muted-foreground">
            {recordings?.length || 0} recording{recordings?.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : recordings?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileAudio className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No recordings yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Start a call and tap the record button to save your conversations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recordings?.map((recording) => (
            <Card key={recording.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Play button */}
                  <Button
                    size="icon"
                    variant={playingId === recording.id ? 'default' : 'secondary'}
                    className="rounded-full w-12 h-12 flex-shrink-0"
                    onClick={() => handlePlay(recording)}
                  >
                    {playingId === recording.id ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </Button>

                  {/* Recording info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {format(new Date(recording.created_at), 'PPp')}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(recording.duration)}
                      </span>
                      {recording.participants?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {recording.participants.length}
                        </span>
                      )}
                      <span>{formatFileSize(recording.file_size)}</span>
                    </div>
                    {recording.participants?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {recording.participants.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownload(recording)}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Delete">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this recording. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRecording.mutate(recording)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
