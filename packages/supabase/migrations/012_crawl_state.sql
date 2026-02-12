-- Migration 012: Crawl job state tracking
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_id VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    pdf_url TEXT,
    regulation_type VARCHAR(20),
    number VARCHAR(50),
    year INTEGER,
    title TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','crawling','downloaded','parsed','loaded','failed')),
    error_message TEXT,
    frbr_uri VARCHAR(255),
    work_id INTEGER REFERENCES works(id) ON DELETE SET NULL,
    last_crawled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, url)
);
CREATE INDEX IF NOT EXISTS idx_crawl_status ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_source ON crawl_jobs(source_id);
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access crawl_jobs" ON crawl_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
