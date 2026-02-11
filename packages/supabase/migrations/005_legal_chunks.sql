-- Migration 005: Search chunks (for full-text search)

CREATE TABLE legal_chunks (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    node_id INTEGER REFERENCES document_nodes(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    content_en TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('indonesian', content)) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_work ON legal_chunks(work_id);
CREATE INDEX idx_chunks_fts ON legal_chunks USING GIN(fts);
CREATE INDEX idx_chunks_metadata ON legal_chunks USING GIN(metadata);
