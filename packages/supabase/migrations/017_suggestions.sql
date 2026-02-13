-- Migration 017: Suggestions table for crowd-sourced corrections + wire bidirectional FKs

CREATE TABLE suggestions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    work_id INTEGER NOT NULL REFERENCES works(id),
    node_id INTEGER NOT NULL REFERENCES document_nodes(id),
    node_type VARCHAR(20) NOT NULL,
    node_number VARCHAR(50),
    current_content TEXT NOT NULL,
    suggested_content TEXT NOT NULL,
    user_reason TEXT,
    user_reference TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    agent_triggered_at TIMESTAMPTZ,
    agent_model TEXT,
    agent_response JSONB,
    agent_decision VARCHAR(20),
    agent_modified_content TEXT,
    agent_confidence FLOAT,
    agent_completed_at TIMESTAMPTZ,
    revision_id BIGINT REFERENCES revisions(id),
    submitted_by UUID,
    submitter_ip TEXT,
    submitter_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wire bidirectional FK: revisions.suggestion_id -> suggestions.id
ALTER TABLE revisions ADD CONSTRAINT fk_revisions_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id);

-- Indexes
CREATE INDEX idx_suggestions_work ON suggestions(work_id);
CREATE INDEX idx_suggestions_node ON suggestions(node_id);
CREATE INDEX idx_suggestions_status ON suggestions(status);
CREATE INDEX idx_suggestions_created ON suggestions(created_at DESC);
CREATE INDEX idx_suggestions_ip_time ON suggestions(submitter_ip, created_at DESC);

-- RLS: public read + insert, service_role full access
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read suggestions" ON suggestions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert suggestions" ON suggestions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Service role full access suggestions" ON suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
