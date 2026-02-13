-- Migration 014: PDF tracking for reproducible extraction
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS pdf_hash VARCHAR(64);
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS pdf_size BIGINT;
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS pdf_downloaded_at TIMESTAMPTZ;
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS pdf_local_path TEXT;
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS extraction_version INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_pdf_hash ON crawl_jobs(pdf_hash);

COMMENT ON COLUMN crawl_jobs.pdf_hash IS 'SHA-256 hash of the PDF content for change detection';
COMMENT ON COLUMN crawl_jobs.pdf_size IS 'PDF file size in bytes';
COMMENT ON COLUMN crawl_jobs.pdf_downloaded_at IS 'When the PDF was last downloaded';
COMMENT ON COLUMN crawl_jobs.pdf_local_path IS 'Local filesystem path where PDF is stored';
COMMENT ON COLUMN crawl_jobs.extraction_version IS 'Parser version used — bump to trigger re-extraction';
