-- Add pdf_storage_url column to crawl_jobs for Supabase Storage references
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS pdf_storage_url TEXT;

-- Create storage bucket for regulation PDFs (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('regulation-pdfs', 'regulation-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for regulation PDFs
CREATE POLICY IF NOT EXISTS "Public read regulation PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'regulation-pdfs');
