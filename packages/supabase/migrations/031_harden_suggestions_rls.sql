-- Migration 031: Harden suggestions table security
--
-- 1. Drop the public INSERT policy — all inserts now go through
--    the API route using service_role (createServiceClient).
-- 2. Add a CHECK constraint on node_type to match the canonical
--    list from document_nodes (migration 030).
--
-- Public SELECT stays (harmless, needed for future features).
-- Service role full access stays (used by API route + admin).

-- Remove the overly permissive public INSERT policy
DROP POLICY IF EXISTS "Public insert suggestions" ON suggestions;

-- Constrain node_type to the same values accepted by document_nodes
ALTER TABLE suggestions
    DROP CONSTRAINT IF EXISTS suggestions_node_type_check;

ALTER TABLE suggestions
    ADD CONSTRAINT suggestions_node_type_check
    CHECK (node_type IN (
        'bab', 'bagian', 'paragraf', 'pasal', 'ayat',
        'penjelasan_umum', 'penjelasan_pasal',
        'preamble', 'content', 'aturan'
    ));
