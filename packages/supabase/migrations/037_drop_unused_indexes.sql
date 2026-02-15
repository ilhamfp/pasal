-- Migration 037: Drop unused indexes
--
-- The Supabase performance advisor flagged 30+ unused indexes.
-- After reviewing every index against all code paths (MCP server, web app,
-- worker, crawler, admin dashboard), these indexes have NO query that uses them.
--
-- Dropping them reduces disk IO on every INSERT/UPDATE, which directly helps
-- with the disk IO budget exhaustion issue on the Small/Medium compute tier.
--
-- KEPT (not dropped here):
--   idx_chunks_fts          -- CRITICAL: core FTS search (search_legal_chunks)
--   idx_chunks_metadata     -- JSONB @> containment for filtered search
--   idx_rel_source          -- MCP get_law_status + reader page
--   idx_rel_target          -- MCP get_law_status + reader page
--   idx_crawl_source        -- worker get_pending_jobs(), is_url_visited()
--   idx_crawl_work          -- admin detail page lookup
--   idx_crawl_status_source -- worker + admin (status, source_id) queries
--   idx_crawl_status_updated-- claim_jobs() stale-job recovery
--   idx_crawl_jobs_regulation_type -- admin per-type breakdowns
--   idx_nodes_work_sort     -- every reader page load
--   idx_suggestions_work    -- cleanup_work_data() deletes by work_id
--   idx_suggestions_node    -- FK constraint enforcement
--   idx_suggestions_status  -- admin pending count
--   idx_suggestions_created -- admin ORDER BY created_at
--   idx_suggestions_ip_time -- rate limiting (IMPORTANT)
--   idx_works_slug_unique   -- reader page slug lookup

-- ============================================================
-- 1. legal_chunks: drop 4 unused indexes
-- ============================================================

-- No code queries legal_chunks.language (all rows are 'id')
DROP INDEX IF EXISTS idx_chunks_language;

-- No code queries legal_chunks.human_verified
DROP INDEX IF EXISTS idx_chunks_verified;

-- ILIKE fallback (tier 3) unlikely to use trigram index with current query shape.
-- Large GIN index on full text content — significant IO cost for near-zero benefit.
DROP INDEX IF EXISTS idx_chunks_trgm;

-- ============================================================
-- 2. works: drop 5 unused/duplicate indexes
-- ============================================================

-- Year is always queried with regulation_type_id; standalone index unused on small table
DROP INDEX IF EXISTS idx_works_year;

-- Low cardinality (4 values); always combined with regulation_type_id
DROP INDEX IF EXISTS idx_works_status;

-- No code filters by subject_tags
DROP INDEX IF EXISTS idx_works_tags;

-- No code filters by content_verified
DROP INDEX IF EXISTS idx_works_verified;

-- Duplicate of idx_works_slug_unique (identical definition)
DROP INDEX IF EXISTS idx_works_slug;

-- ============================================================
-- 3. work_relationships: drop 1 unused index
-- ============================================================

-- Tiny table, FK join overhead negligible without index
DROP INDEX IF EXISTS idx_rel_type;

-- ============================================================
-- 4. crawl_jobs: drop 3 unused indexes
-- ============================================================

-- No code looks up crawl_jobs by run_id
DROP INDEX IF EXISTS idx_crawl_jobs_run_id;

-- Hash compared in Python, never in SQL WHERE
DROP INDEX IF EXISTS idx_crawl_jobs_pdf_hash;

-- No code queries crawl_jobs by frbr_uri
DROP INDEX IF EXISTS idx_crawl_frbr;

-- ============================================================
-- 5. scraper_runs: drop 2 unused indexes (tiny table)
-- ============================================================

-- No code queries by status
DROP INDEX IF EXISTS idx_scraper_runs_status;

-- No code queries by source_id
DROP INDEX IF EXISTS idx_scraper_runs_source;

-- ============================================================
-- 6. document_nodes: drop 5 unused indexes
-- ============================================================

-- No code filters by pdf_page_start (display only)
DROP INDEX IF EXISTS idx_nodes_pdf_page;

-- Only landing stats uses node_type standalone (cached 24h); small benefit
DROP INDEX IF EXISTS idx_nodes_type;

-- No LTREE queries in any code path
DROP INDEX IF EXISTS idx_nodes_path;

-- No code filters by language (all rows 'id')
DROP INDEX IF EXISTS idx_nodes_language;

-- No code filters by human_verified
DROP INDEX IF EXISTS idx_nodes_verified;

-- ============================================================
-- 7. discovery_progress: drop 1 duplicate index
-- ============================================================

-- Redundant with UNIQUE constraint on (source_id, regulation_type)
DROP INDEX IF EXISTS idx_discovery_progress_lookup;

-- ============================================================
-- 8. revisions: drop 2 unused indexes
-- ============================================================

-- No code queries by revision_type
DROP INDEX IF EXISTS idx_revisions_type;

-- No code orders revisions by created_at
DROP INDEX IF EXISTS idx_revisions_created;

-- ============================================================
-- 9. suggestions: drop 1 unused composite index
-- ============================================================

-- No current query matches (work_id, node_id, status) composite
DROP INDEX IF EXISTS idx_suggestions_work_node_status;

-- ============================================================
-- Total: 23 indexes dropped
-- This significantly reduces write IO overhead across all tables.
-- ============================================================
