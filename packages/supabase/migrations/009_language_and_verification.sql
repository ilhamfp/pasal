-- Migration 009: Add language and human verification tracking

-- Add language field to document_nodes
-- 'id' = Bahasa Indonesia (original), 'en' = English (translated)
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'id';
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add language field to legal_chunks
ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'id';
ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT false;

-- Add verification tracking to works (the regulation itself)
ALTER TABLE works ADD COLUMN IF NOT EXISTS content_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE works ADD COLUMN IF NOT EXISTS content_verified_at TIMESTAMPTZ;
ALTER TABLE works ADD COLUMN IF NOT EXISTS content_verified_by TEXT;

-- Index for filtering by language and verification status
CREATE INDEX IF NOT EXISTS idx_nodes_language ON document_nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_verified ON document_nodes(human_verified);
CREATE INDEX IF NOT EXISTS idx_chunks_language ON legal_chunks(language);
CREATE INDEX IF NOT EXISTS idx_chunks_verified ON legal_chunks(human_verified);
CREATE INDEX IF NOT EXISTS idx_works_verified ON works(content_verified);

-- Add a translation_source field to track how translations were produced
-- Values: 'original' (source language), 'gemini' (Gemini Pro 3), 'human', 'deepl', etc.
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS translation_source VARCHAR(50) DEFAULT 'original';
ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS translation_source VARCHAR(50) DEFAULT 'original';

COMMENT ON COLUMN document_nodes.language IS 'ISO 639-1 language code: id=Indonesian, en=English';
COMMENT ON COLUMN document_nodes.human_verified IS 'Whether this content has been reviewed by a human for accuracy';
COMMENT ON COLUMN document_nodes.translation_source IS 'How this content was produced: original, gemini, human, deepl, etc.';
COMMENT ON COLUMN legal_chunks.language IS 'ISO 639-1 language code: id=Indonesian, en=English';
COMMENT ON COLUMN works.content_verified IS 'Whether any human has verified the parsed content matches the source PDF';
