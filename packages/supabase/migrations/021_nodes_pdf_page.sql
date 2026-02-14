-- Migration 021: Add PDF page tracking to document_nodes
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS pdf_page_start INTEGER;
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS pdf_page_end INTEGER;
CREATE INDEX idx_nodes_pdf_page ON document_nodes(pdf_page_start) WHERE pdf_page_start IS NOT NULL;
