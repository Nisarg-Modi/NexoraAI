-- Create call_recordings table to store recording metadata
CREATE TABLE public.call_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  file_size INTEGER NOT NULL DEFAULT 0,
  participants TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;

-- Users can only view their own recordings
CREATE POLICY "Users can view their own recordings"
ON public.call_recordings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own recordings
CREATE POLICY "Users can insert their own recordings"
ON public.call_recordings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own recordings
CREATE POLICY "Users can delete their own recordings"
ON public.call_recordings
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recordings bucket
CREATE POLICY "Users can upload their own recordings"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own recordings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own recordings"
ON storage.objects
FOR DELETE
USING (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);