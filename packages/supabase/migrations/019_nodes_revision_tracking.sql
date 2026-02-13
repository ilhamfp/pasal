-- Migration 019: Add revision_id to document_nodes for tracking last applied revision

ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS revision_id BIGINT REFERENCES revisions(id);

-- Partial index for nodes that have been revised
CREATE INDEX IF NOT EXISTS idx_nodes_revision ON document_nodes(revision_id) WHERE revision_id IS NOT NULL;
