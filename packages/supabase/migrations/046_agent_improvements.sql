-- Migration 046: Support correction agent — new status + parser_improvements table

-- 1. Allow agent_approved status on suggestions
ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_status_check;
ALTER TABLE suggestions ADD CONSTRAINT suggestions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'agent_approved'));

-- 2. Parser improvement tracking
CREATE TABLE IF NOT EXISTS parser_improvements (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    github_issue_url TEXT,
    github_issue_number INTEGER,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    errors_fixed_estimate INTEGER DEFAULT 0,
    analysis JSONB,
    suggestion_ids BIGINT[],
    status VARCHAR(20) DEFAULT 'open'
        CHECK (status IN ('open', 'implemented', 'wont_fix', 'duplicate')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parser_improvements_status ON parser_improvements(status);

-- RLS
ALTER TABLE parser_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read parser_improvements" ON parser_improvements
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full access parser_improvements" ON parser_improvements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
