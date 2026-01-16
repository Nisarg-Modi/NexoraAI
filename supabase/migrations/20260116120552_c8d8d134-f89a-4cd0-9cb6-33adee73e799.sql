-- Create table for document share links
CREATE TABLE public.document_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.user_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accessed_count INTEGER DEFAULT 0,
  max_access_count INTEGER DEFAULT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.document_share_links ENABLE ROW LEVEL SECURITY;

-- Users can view their own share links
CREATE POLICY "Users can view their own share links"
ON public.document_share_links
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create share links for their own documents
CREATE POLICY "Users can create share links for their own documents"
ON public.document_share_links
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_documents 
    WHERE id = document_id AND user_id = auth.uid()
  )
);

-- Users can update their own share links
CREATE POLICY "Users can update their own share links"
ON public.document_share_links
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own share links
CREATE POLICY "Users can delete their own share links"
ON public.document_share_links
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for fast token lookup
CREATE INDEX idx_document_share_links_token ON public.document_share_links(share_token);
CREATE INDEX idx_document_share_links_document ON public.document_share_links(document_id);