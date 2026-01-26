import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, Languages, Copy, Loader2, X, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ru', name: 'Russian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
];

export function ScannerTranslator() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
        extractTextFromImage(imageData);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
        extractTextFromImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractTextFromImage = async (imageBase64: string) => {
    setIsExtracting(true);
    setExtractedText('');
    setTranslatedText('');
    
    try {
      const { data, error } = await supabase.functions.invoke('scan-translate', {
        body: { imageBase64, action: 'extract' }
      });

      if (error) throw error;
      
      if (data?.extractedText) {
        setExtractedText(data.extractedText);
        toast.success('Text extracted successfully!');
      } else {
        toast.error('No text found in image');
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      toast.error('Failed to extract text from image');
    } finally {
      setIsExtracting(false);
    }
  };

  const translateText = async () => {
    if (!extractedText.trim()) {
      toast.error('No text to translate');
      return;
    }

    setIsTranslating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: { 
          text: extractedText, 
          targetLanguage 
        }
      });

      if (error) throw error;
      
      if (data?.translatedText) {
        setTranslatedText(data.translatedText);
        toast.success('Translation complete!');
      }
    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Failed to translate text');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const reset = () => {
    setCapturedImage(null);
    setExtractedText('');
    setTranslatedText('');
    stopCamera();
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            Scan & Translate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera / Image capture area */}
          {!capturedImage && !isCameraActive && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={startCamera} 
                className="flex-1"
                variant="outline"
              >
                <Camera className="mr-2 h-4 w-4" />
                Open Camera
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="flex-1"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Live camera view */}
          {isCameraActive && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-muted"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <Button onClick={capturePhoto} size="lg">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture
                </Button>
                <Button onClick={stopCamera} variant="outline" size="lg">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Captured image preview */}
          {capturedImage && (
            <div className="relative">
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full rounded-lg max-h-64 object-contain bg-muted"
              />
              <Button
                onClick={reset}
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Extracting indicator */}
          {isExtracting && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Extracting text from image...
            </div>
          )}

          {/* Extracted text */}
          {extractedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Extracted Text</label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(extractedText)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Textarea 
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          )}

          {/* Translation controls */}
          {extractedText && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Target language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={translateText} 
                disabled={isTranslating}
                className="flex-1"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Languages className="mr-2 h-4 w-4" />
                    Translate
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Translated text */}
          {translatedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Translation ({LANGUAGES.find(l => l.code === targetLanguage)?.name})
                </label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(translatedText)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Textarea 
                value={translatedText}
                readOnly
                rows={4}
                className="resize-none bg-muted/50"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
