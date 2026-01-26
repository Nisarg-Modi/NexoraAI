-- Create a table for storing scan translation history
CREATE TABLE public.scan_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  source_language_name TEXT,
  target_language TEXT NOT NULL,
  target_language_name TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scan_translations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own translations" 
ON public.scan_translations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own translations" 
ON public.scan_translations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own translations" 
ON public.scan_translations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_scan_translations_user_id ON public.scan_translations(user_id);
CREATE INDEX idx_scan_translations_created_at ON public.scan_translations(created_at DESC);