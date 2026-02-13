-- Migration 018: Add scraping metadata and parsing pipeline columns to works
-- All nullable, safe for existing data.

ALTER TABLE works ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pemrakarsa TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS tempat_penetapan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS tanggal_penetapan DATE;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pejabat_penetap TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS tanggal_pengundangan DATE;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pejabat_pengundangan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS nomor_pengundangan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS nomor_tambahan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pdf_quality TEXT
    CHECK (pdf_quality IN ('born_digital', 'scanned_clean', 'image_only'));
ALTER TABLE works ADD COLUMN IF NOT EXISTS parse_method TEXT
    CHECK (parse_method IN ('pymupdf', 'pdfplumber', 'tesseract', 'manual'));
ALTER TABLE works ADD COLUMN IF NOT EXISTS parse_confidence FLOAT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS parse_errors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE works ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ;

-- Unique partial index on slug (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_works_slug ON works(slug) WHERE slug IS NOT NULL;
