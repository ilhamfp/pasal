-- Expand document_nodes node_type check constraint to include preamble and content types.
-- These are produced by the text-first parser to capture all text from PDFs,
-- including text before the first structural marker (preamble) and text in
-- documents with no structural markers (content).

ALTER TABLE document_nodes
    DROP CONSTRAINT IF EXISTS document_nodes_node_type_check;

ALTER TABLE document_nodes
    ADD CONSTRAINT document_nodes_node_type_check
    CHECK (node_type IN (
        'bab', 'bagian', 'paragraf', 'pasal', 'ayat',
        'penjelasan_umum', 'penjelasan_pasal',
        'preamble', 'content'
    ));
