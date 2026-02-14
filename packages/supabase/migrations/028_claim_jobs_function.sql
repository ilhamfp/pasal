-- Migration 028: Atomic job claiming for concurrent workers
-- Uses FOR UPDATE SKIP LOCKED so multiple workers never claim the same job.

-- Composite index for the claim query (status + created_at for ordering)
CREATE INDEX IF NOT EXISTS idx_crawl_status_created
    ON crawl_jobs(status, created_at)
    WHERE status = 'pending';

-- Atomic claim function: selects pending jobs and marks them as 'crawling' in one query.
-- SKIP LOCKED ensures concurrent workers never pick the same rows.
CREATE OR REPLACE FUNCTION claim_jobs(
    p_limit INT DEFAULT 10
) RETURNS SETOF crawl_jobs
LANGUAGE sql
AS $$
    UPDATE crawl_jobs
    SET status = 'crawling',
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM crawl_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
$$;
