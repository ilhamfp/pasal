-- Migration 011: Trigram index for fuzzy search fallback
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_chunks_trgm ON legal_chunks USING gin(content gin_trgm_ops);
