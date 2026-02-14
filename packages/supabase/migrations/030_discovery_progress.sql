-- Track per-type discovery crawl progress for smart caching.
-- Allows skipping recently-crawled types to avoid wasting HTTP requests.

CREATE TABLE IF NOT EXISTS discovery_progress (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id       TEXT NOT NULL DEFAULT 'peraturan_go_id',
    regulation_type TEXT NOT NULL,
    total_regulations INT,          -- total count from page text (e.g. "1.926 Peraturan")
    pages_crawled   INT NOT NULL DEFAULT 0,
    total_pages     INT,
    last_discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (source_id, regulation_type)
);

CREATE INDEX idx_discovery_progress_lookup
    ON discovery_progress (source_id, regulation_type);

-- RLS: public read, service-role write (matches crawl_jobs pattern)
ALTER TABLE discovery_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read discovery_progress"
    ON discovery_progress FOR SELECT
    USING (true);

CREATE POLICY "Service role manages discovery_progress"
    ON discovery_progress FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
