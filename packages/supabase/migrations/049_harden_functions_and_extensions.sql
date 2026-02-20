-- Migration 049: Pin search_path on all functions + move extensions to extensions schema
-- Resolves: function_search_path_mutable (x5), extension_in_public (x2)

-- Step 1: Move extensions out of public schema
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION ltree SET SCHEMA extensions;

-- Step 2: Pin search_path on all public functions
-- Include 'extensions' so functions can resolve ltree types and pg_trgm operators
ALTER FUNCTION claim_jobs(int) SET search_path = 'public', 'extensions';
ALTER FUNCTION apply_revision(integer, integer, text, varchar, text, bigint, varchar, uuid) SET search_path = 'public', 'extensions';
ALTER FUNCTION generate_work_slug() SET search_path = 'public', 'extensions';
ALTER FUNCTION update_works_search_text() SET search_path = 'public', 'extensions';
ALTER FUNCTION search_legal_chunks(text, int, jsonb) SET search_path = 'public', 'extensions';
