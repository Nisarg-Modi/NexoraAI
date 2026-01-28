import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, MicOff, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder, encodeAudioForAPI } from "@/utils/audioRecorder";
import { supabase } from "@/integrations/supabase/client";

const availableLanguages = [
  { code: "auto", name: "🔍 Auto-detect" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "id", name: "Indonesian" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
];

const getLanguageName = (code: string): string => {
  const lang = availableLanguages.find(l => l.code === code);
  return lang?.name || code.toUpperCase();
};

// Speaker colors for visual differentiation
const SPEAKER_COLORS = [
  { bg: "bg-blue-500/20", text: "text-blue-600", border: "border-blue-500/30" },
  { bg: "bg-green-500/20", text: "text-green-600", border: "border-green-500/30" },
  { bg: "bg-purple-500/20", text: "text-purple-600", border: "border-purple-500/30" },
  { bg: "bg-orange-500/20", text: "text-orange-600", border: "border-orange-500/30" },
  { bg: "bg-pink-500/20", text: "text-pink-600", border: "border-pink-500/30" },
  { bg: "bg-cyan-500/20", text: "text-cyan-600", border: "border-cyan-500/30" },
];

interface Participant {
  id: string;
  name: string;
}

interface Transcript {
  id: string;
  speakerId: string;
  speaker: string;
  text: string;
  timestamp: Date;
  translated?: string;
  detectedLanguage?: string;
}

interface LiveTranscriptionProps {
  userId: string;
  userName: string;
  participants?: Participant[];
  targetLanguage?: string;
  enabled?: boolean;
  onTranscript?: (text: string, translated?: string, speakerId?: string) => void;
}

const LiveTranscription = ({
  userId,
  userName,
  participants = [],
  targetLanguage: initialTargetLanguage = "en",
  enabled = true,
  onTranscript,
}: LiveTranscriptionProps) => {
  // Create a map of speaker IDs to colors for consistent coloring
  const getSpeakerColor = (speakerId: string) => {
    const allParticipants = [{ id: userId, name: userName }, ...participants];
    const index = allParticipants.findIndex(p => p.id === speakerId);
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
  };
  const [selectedLanguage, setSelectedLanguage] = useState(initialTargetLanguage);
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load user's preferred language from profile on mount
  useEffect(() => {
    const loadPreferredLanguage = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data?.preferred_language) {
          setSelectedLanguage(data.preferred_language);
        }
      } catch (error) {
        console.error('Error loading preferred language:', error);
      } finally {
        setIsLoadingPreference(false);
      }
    };

    loadPreferredLanguage();
  }, [userId]);

  // Save language preference when it changes
  const handleLanguageChange = async (newLanguage: string) => {
    setSelectedLanguage(newLanguage);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: newLanguage })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving language preference:', error);
      toast({
        title: "Couldn't save preference",
        description: "Your language selection will be used for this session only.",
        variant: "destructive",
      });
    }
  };

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

  const handleNewTranscript = async (text: string, speakerId: string = userId, speakerName: string = userName) => {
    const newTranscript: Transcript = {
      id: crypto.randomUUID(),
      speakerId,
      speaker: speakerName,
      text,
      timestamp: new Date(),
    };

    // Add to local state immediately
    setTranscripts((prev) => [...prev, newTranscript]);

    // Handle translation based on selected language mode
    let translatedText: string | undefined;
    let detectedLanguage: string | undefined;

    try {
      if (selectedLanguage === "auto") {
        // Auto-detect mode: detect source language and translate to user's preferred language
        const { data: detectData, error: detectError } = await supabase.functions.invoke("detect-language", {
          body: { text },
        });

        if (!detectError && detectData?.languageCode) {
          detectedLanguage = detectData.languageCode;
          
          // Get user's preferred language from profile (default to English)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preferred_language')
            .eq('user_id', userId)
            .maybeSingle();
          
          const userPreferredLang = profileData?.preferred_language || 'en';
          
          // Only translate if detected language differs from user's preferred language
          if (detectedLanguage !== userPreferredLang) {
            const { data: translateData, error: translateError } = await supabase.functions.invoke("translate-message", {
              body: { text, targetLanguage: userPreferredLang },
            });

            if (!translateError && translateData?.translatedText) {
              translatedText = translateData.translatedText;
            }
          }
        }
      } else if (selectedLanguage !== "en") {
        // Manual language selection: translate to selected language
        const { data, error } = await supabase.functions.invoke("translate-message", {
          body: { text, targetLanguage: selectedLanguage },
        });

        if (!error && data?.translatedText) {
          translatedText = data.translatedText;
        }
      }

      // Update transcript with translation and detected language if available
      if (translatedText || detectedLanguage) {
        if (translatedText) {
          newTranscript.translated = translatedText;
        }
        if (detectedLanguage) {
          newTranscript.detectedLanguage = getLanguageName(detectedLanguage);
        }
        setTranscripts((prev) =>
          prev.map((t) => (t.id === newTranscript.id ? newTranscript : t))
        );

        // Play translated audio with voice synthesis
        if (translatedText) {
          await playVoiceTranslation(translatedText);
        }
      }
    } catch (error) {
      console.error("Translation error:", error);
    }

    // Notify parent component
    onTranscript?.(text, translatedText, speakerId);
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Live Transcription
          </CardTitle>
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
        <div className="mt-3">
          <label className="text-sm text-muted-foreground mb-1.5 block">
            {selectedLanguage === "auto" ? "Auto-detect & translate to your language" : "Translate to"}
          </label>
          <Select 
            value={selectedLanguage} 
            onValueChange={handleLanguageChange}
            disabled={isLoadingPreference}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingPreference ? "Loading..." : "Select language"} />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {transcripts.map((transcript) => {
                const speakerColor = getSpeakerColor(transcript.speakerId);
                return (
                  <div
                    key={transcript.id}
                    className={`p-3 rounded-lg space-y-1 border-l-4 ${speakerColor.border} bg-muted`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${speakerColor.bg} ${speakerColor.text}`}>
                          {transcript.speaker}
                        </span>
                        {transcript.detectedLanguage && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {transcript.detectedLanguage}
                          </span>
                        )}
                      </div>
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
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LiveTranscription;
