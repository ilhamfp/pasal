-- Migration 032: Self-healing claim_jobs + autovacuum tuning
--
-- Root cause: crashed workers leave jobs in 'crawling' forever.
-- Repeated crashes cause table bloat, connection exhaustion, and total DB outage.
--
-- Fix: claim_jobs() now reclaims stale crawling jobs (>15 min),
-- marks poison-pill jobs as failed after 3 reclaims,
-- with SET LOCAL statement_timeout to survive transient DB pressure.

-- 0. Track how many times a job has been reclaimed from stale 'crawling' state
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS reclaim_count INT NOT NULL DEFAULT 0;

-- 1. Self-healing claim_jobs with retry limit
CREATE OR REPLACE FUNCTION claim_jobs(p_limit INT DEFAULT 10)
RETURNS SETOF crawl_jobs
LANGUAGE plpgsql
AS $$
BEGIN
    -- Override Supabase PostgREST default (~8s) so this function can survive
    -- moderate DB pressure without timing out and orphaning jobs.
    SET LOCAL statement_timeout = '30s';

    -- Mark poison-pill jobs as permanently failed (reclaimed 3+ times)
    UPDATE crawl_jobs
    SET status = 'failed',
        error_message = 'reclaimed ' || reclaim_count || ' times without completing',
        updated_at = NOW()
    WHERE status = 'crawling'
      AND updated_at < NOW() - INTERVAL '15 minutes'
      AND reclaim_count >= 3;

    -- Reclaim stale jobs that still have retries left
    UPDATE crawl_jobs
    SET status = 'pending',
        reclaim_count = reclaim_count + 1,
        updated_at = NOW()
    WHERE status = 'crawling'
      AND updated_at < NOW() - INTERVAL '15 minutes'
      AND reclaim_count < 3;

    -- Claim pending jobs atomically
    RETURN QUERY
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
END;
$$;

-- 2. Tune autovacuum on crawl_jobs to run more aggressively.
-- Default threshold (50 + 20% of rows) is ~3000 for 15k rows — too high
-- for a table with frequent status updates.
ALTER TABLE crawl_jobs SET (
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.02
);

-- 3. Partial index for stale-job recovery query
CREATE INDEX IF NOT EXISTS idx_crawl_status_updated
    ON crawl_jobs(status, updated_at)
    WHERE status = 'crawling';
