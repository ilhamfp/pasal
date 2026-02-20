-- Landing page stats RPC with elevated timeout.
-- The anon role has a 3s statement_timeout, but COUNT(*) on
-- document_nodes (~3M rows) needs ~15s due to heap fetches.
-- This function sets its own 30s timeout so the query succeeds.

CREATE OR REPLACE FUNCTION get_landing_stats()
RETURNS TABLE(total_works bigint, pasal_count bigint, min_year int, max_year int)
LANGUAGE sql STABLE
SET statement_timeout = '30s'
SET search_path = 'public', 'extensions'
AS $$
  SELECT
    (SELECT COUNT(*) FROM works)::bigint,
    (SELECT COUNT(*) FROM document_nodes WHERE node_type = 'pasal')::bigint,
    (SELECT MIN(year) FROM works),
    (SELECT MAX(year) FROM works);
$$;
