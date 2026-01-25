-- Add soft delete column to user_documents
ALTER TABLE public.user_documents 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying of deleted documents
CREATE INDEX idx_user_documents_deleted_at ON public.user_documents(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create function to auto-purge documents deleted more than 30 days ago
CREATE OR REPLACE FUNCTION public.purge_old_deleted_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc RECORD;
BEGIN
  FOR doc IN 
    SELECT id, file_path 
    FROM public.user_documents 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Delete from storage (this will be handled by the application)
    -- For now, just delete the database record
    DELETE FROM public.user_documents WHERE id = doc.id;
  END LOOP;
END;
$$;