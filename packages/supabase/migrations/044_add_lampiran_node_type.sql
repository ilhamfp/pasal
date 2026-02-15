-- Add 'lampiran' (attachment) node type for ratification laws.
-- Laws like UU 6/2023 embed the full attached regulation (PERPPU 2/2022)
-- as a LAMPIRAN section. This is a structural container (like BAB) that
-- holds the parsed BAB/Pasal/Ayat hierarchy of the attached law.

ALTER TABLE document_nodes
    DROP CONSTRAINT IF EXISTS document_nodes_node_type_check;

ALTER TABLE document_nodes
    ADD CONSTRAINT document_nodes_node_type_check
    CHECK (node_type IN (
        'bab', 'bagian', 'paragraf', 'pasal', 'ayat',
        'penjelasan_umum', 'penjelasan_pasal',
        'preamble', 'content', 'aturan', 'lampiran'
    ));
