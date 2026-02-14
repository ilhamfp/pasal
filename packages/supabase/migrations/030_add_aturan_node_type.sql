-- Add 'aturan' node type for UUD 1945's ATURAN PERALIHAN and ATURAN TAMBAHAN sections.
-- These are top-level sections (like BAB) unique to the Constitution.

ALTER TABLE document_nodes
    DROP CONSTRAINT IF EXISTS document_nodes_node_type_check;

ALTER TABLE document_nodes
    ADD CONSTRAINT document_nodes_node_type_check
    CHECK (node_type IN (
        'bab', 'bagian', 'paragraf', 'pasal', 'ayat',
        'penjelasan_umum', 'penjelasan_pasal',
        'preamble', 'content', 'aturan'
    ));
