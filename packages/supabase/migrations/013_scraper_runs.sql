-- Migration 013: Scraper runs tracking + RLS for admin dashboard

-- Track each execution of the scraper worker
CREATE TABLE IF NOT EXISTS scraper_runs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    jobs_discovered INTEGER DEFAULT 0,
    jobs_processed INTEGER DEFAULT 0,
    jobs_succeeded INTEGER DEFAULT 0,
    jobs_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_source ON scraper_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_started ON scraper_runs(started_at DESC);

ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read scraper_runs" ON scraper_runs FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access scraper_runs" ON scraper_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Link crawl_jobs to scraper_runs
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS run_id BIGINT REFERENCES scraper_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_run_id ON crawl_jobs(run_id);

-- Allow the admin dashboard to read crawl_jobs (currently only service_role has access)
CREATE POLICY "Public read crawl_jobs" ON crawl_jobs FOR SELECT TO anon USING (true);
