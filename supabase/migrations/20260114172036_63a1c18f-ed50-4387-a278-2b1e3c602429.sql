-- Add structured OCR fields to user_documents table
ALTER TABLE public.user_documents 
ADD COLUMN IF NOT EXISTS ocr_data JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extracted_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extracted_dob DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extracted_id_number TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extracted_address TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extracted_expiry_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ocr_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for searching extracted fields
CREATE INDEX IF NOT EXISTS idx_user_documents_extracted_name ON public.user_documents (extracted_name);
CREATE INDEX IF NOT EXISTS idx_user_documents_extracted_id_number ON public.user_documents (extracted_id_number);

-- Add GIN index for JSONB search on ocr_data
CREATE INDEX IF NOT EXISTS idx_user_documents_ocr_data ON public.user_documents USING GIN (ocr_data);