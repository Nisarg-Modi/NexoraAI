import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder, encodeAudioForAPI } from "@/utils/audioRecorder";
import { supabase } from "@/integrations/supabase/client";

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  translated?: string;
}

interface LiveTranscriptionProps {
  userId: string;
  userName: string;
  targetLanguage?: string;
  enabled?: boolean;
  onTranscript?: (text: string, translated?: string) => void;
}

const LiveTranscription = ({
  userId,
  userName,
  targetLanguage = "en",
  enabled = true,
  onTranscript,
}: LiveTranscriptionProps) => {
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enabled && isRecording) {
      startTranscription();
    }

    return () => {
      stopTranscription();
    };
  }, [enabled, isRecording]);

  useEffect(() => {
    // Auto-scroll to bottom when new transcripts arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const startTranscription = async () => {
    try {
      setIsConnecting(true);
      
      // Get current session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to use transcription",
          variant: "destructive",
        });
        setIsConnecting(false);
        setIsRecording(false);
        return;
      }
      
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "jtlnhmpxytlgljnuspan";
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-transcription?token=${session.access_token}`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = async () => {
        console.log("WebSocket connected");
        setIsConnecting(false);

        // Start audio recording
        recorderRef.current = new AudioRecorder((audioData) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const encodedAudio = encodeAudioForAPI(audioData);
            wsRef.current.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: encodedAudio,
              })
            );
          }
        });

        await recorderRef.current.start();
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("Received message:", data.type);

        // Handle input audio transcription (user speaking)
        if (data.type === "conversation.item.input_audio_transcription.completed") {
          const transcript = data.transcript;
          if (transcript && transcript.trim()) {
            await handleNewTranscript(transcript);
          }
        }

        // Handle errors
        if (data.type === "error") {
          console.error("Transcription error:", data.error);
          toast({
            title: "Transcription Error",
            description: data.error?.message || "An error occurred",
            variant: "destructive",
          });
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to transcription service",
          variant: "destructive",
        });
        setIsConnecting(false);
        setIsRecording(false);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket closed");
        setIsConnecting(false);
        setIsRecording(false);
      };
    } catch (error) {
      console.error("Error starting transcription:", error);
      toast({
        title: "Error",
        description: "Failed to start transcription",
        variant: "destructive",
      });
      setIsConnecting(false);
      setIsRecording(false);
    }
  };

  const stopTranscription = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;
  };

  const playVoiceTranslation = async (text: string, voiceId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text,
          voiceId: voiceId || '9BWtsMINqrJLrRacOk9x', // Default to Aria
          modelId: 'eleven_turbo_v2_5'
        }
      });

      if (error) throw error;

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audio.play();
    } catch (error) {
      console.error('Error playing voice translation:', error);
    }
  };

  const handleNewTranscript = async (text: string) => {
    const newTranscript: Transcript = {
      id: crypto.randomUUID(),
      speaker: userName,
      text,
      timestamp: new Date(),
    };

    // Add to local state immediately
    setTranscripts((prev) => [...prev, newTranscript]);

    // Translate if needed
    let translatedText: string | undefined;
    if (targetLanguage !== "en") {
      try {
        const { data, error } = await supabase.functions.invoke("translate-message", {
          body: {
            text,
            targetLanguage,
          },
        });

        if (!error && data?.translatedText) {
          translatedText = data.translatedText;
          newTranscript.translated = translatedText;
          setTranscripts((prev) =>
            prev.map((t) => (t.id === newTranscript.id ? newTranscript : t))
          );

          // Play translated audio with voice synthesis
          await playVoiceTranslation(translatedText);
        }
      } catch (error) {
        console.error("Translation error:", error);
      }
    }

    // Notify parent component
    onTranscript?.(text, translatedText);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopTranscription();
      setIsRecording(false);
    } else {
      setIsRecording(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Live Transcription
          </CardTitle>
          <div className="flex items-center gap-2">
            {targetLanguage !== "en" && (
              <Badge variant="secondary">{targetLanguage.toUpperCase()}</Badge>
            )}
            <Button
              variant={isRecording ? "destructive" : "default"}
              size="sm"
              onClick={toggleRecording}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>Connecting...</>
              ) : isRecording ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64" ref={scrollRef}>
          {transcripts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No transcriptions yet</p>
              <p className="text-sm">Click Start to begin transcribing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className="p-3 bg-muted rounded-lg space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{transcript.speaker}</span>
                    <span className="text-xs text-muted-foreground">
                      {transcript.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{transcript.text}</p>
                  {transcript.translated && (
                    <p className="text-sm text-primary italic">
                      {transcript.translated}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LiveTranscription;
