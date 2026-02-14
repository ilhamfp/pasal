-- Migration 026: Add missing indexes identified during database audit
-- These indexes cover common query patterns that were previously unindexed.

-- 1. document_nodes(work_id, sort_order)
-- Used on every regulation reader page: .eq("work_id", id).order("sort_order")
-- Enables index-only scan instead of sort after filter.
CREATE INDEX IF NOT EXISTS idx_nodes_work_sort
    ON document_nodes (work_id, sort_order);

-- 2. document_nodes(work_id, node_type)
-- Used when fetching specific node types for a work (e.g. all pasal nodes).
CREATE INDEX IF NOT EXISTS idx_nodes_work_type
    ON document_nodes (work_id, node_type);

-- 3. legal_chunks(node_id)
-- Used by apply_revision() to update chunks: WHERE node_id = p_node_id
-- Also used by verify-suggestion API to fetch surrounding context.
CREATE INDEX IF NOT EXISTS idx_chunks_node
    ON legal_chunks (node_id);

-- 4. work_relationships(relationship_type_id)
-- FK column used in JOINs to relationship_types but never indexed.
CREATE INDEX IF NOT EXISTS idx_rel_type
    ON work_relationships (relationship_type_id);

-- 5. crawl_jobs(frbr_uri)
-- Used for duplicate detection during loading pipeline.
CREATE INDEX IF NOT EXISTS idx_crawl_frbr
    ON crawl_jobs (frbr_uri) WHERE frbr_uri IS NOT NULL;

-- 6. crawl_jobs(work_id)
-- FK column, used for lookups when linking crawl jobs to works.
CREATE INDEX IF NOT EXISTS idx_crawl_work
    ON crawl_jobs (work_id) WHERE work_id IS NOT NULL;

-- 7. crawl_jobs(status, source_id)
-- Scraper pipeline queries pending jobs filtered by source.
CREATE INDEX IF NOT EXISTS idx_crawl_status_source
    ON crawl_jobs (status, source_id);

-- 8. revisions(work_id, node_id)
-- Admin panel and apply_revision() query revision history by work + node.
CREATE INDEX IF NOT EXISTS idx_revisions_work_node
    ON revisions (work_id, node_id);

-- 9. suggestions(work_id, node_id, status)
-- Admin queue filters pending suggestions per work/node.
CREATE INDEX IF NOT EXISTS idx_suggestions_work_node_status
    ON suggestions (work_id, node_id, status);
