-- Fix integer overflow for deeply nested document nodes.
-- sort_order uses hierarchical multiplier (parent * 100) which overflows
-- integer (max 2.1B) at 5+ levels deep (BAB → Bagian → Paragraf → Pasal → Ayat).
ALTER TABLE document_nodes ALTER COLUMN sort_order TYPE BIGINT;
