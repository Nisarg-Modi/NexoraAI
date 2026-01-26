import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Trash2, Copy, Volume2, Loader2, ArrowLeft, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ScanTranslation {
  id: string;
  original_text: string;
  translated_text: string;
  source_language: string;
  source_language_name: string | null;
  target_language: string;
  target_language_name: string | null;
  created_at: string;
}

interface ScanTranslationHistoryProps {
  onBack: () => void;
}

export function ScanTranslationHistory({ onBack }: ScanTranslationHistoryProps) {
  const [translations, setTranslations] = useState<ScanTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTranslations();
  }, []);

  const fetchTranslations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('scan_translations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTranslations(data || []);
    } catch (error) {
      console.error('Error fetching translations:', error);
      toast.error('Failed to load translation history');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTranslation = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('scan_translations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTranslations(prev => prev.filter(t => t.id !== id));
      toast.success('Translation deleted');
    } catch (error) {
      console.error('Error deleting translation:', error);
      toast.error('Failed to delete translation');
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const speakText = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in your browser');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Translation History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {translations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Languages className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved translations yet</p>
              <p className="text-sm mt-1">Scan and translate text to save it here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {translations.map((translation) => (
                  <Card key={translation.id} className="bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{format(new Date(translation.created_at), 'PPp')}</span>
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {translation.source_language_name || translation.source_language}
                          </span>
                          <span>→</span>
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {translation.target_language_name || translation.target_language}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">Original</label>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => speakText(translation.original_text, translation.source_language)}
                              >
                                <Volume2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(translation.original_text)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm bg-background/50 p-2 rounded border">
                            {translation.original_text.length > 200 
                              ? translation.original_text.substring(0, 200) + '...' 
                              : translation.original_text}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">Translation</label>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => speakText(translation.translated_text, translation.target_language)}
                              >
                                <Volume2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(translation.translated_text)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm bg-background/50 p-2 rounded border">
                            {translation.translated_text.length > 200 
                              ? translation.translated_text.substring(0, 200) + '...' 
                              : translation.translated_text}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTranslation(translation.id)}
                          disabled={deletingId === translation.id}
                        >
                          {deletingId === translation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
