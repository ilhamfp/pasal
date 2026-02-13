-- Migration 016: Append-only revisions table for content change tracking
-- Every mutation to document_nodes.content_text MUST create a revision row FIRST.
-- Never UPDATE or DELETE rows in this table.

CREATE TABLE revisions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES document_nodes(id) ON DELETE CASCADE,
    node_type VARCHAR(20) NOT NULL,
    node_number VARCHAR(50),
    node_path LTREE,
    old_content TEXT,
    new_content TEXT NOT NULL,
    revision_type VARCHAR(30) NOT NULL
        CHECK (revision_type IN ('initial_parse', 'suggestion_approved', 'admin_edit')),
    reason TEXT NOT NULL,
    suggestion_id BIGINT, -- FK added in migration 017 after suggestions table exists
    verified_by TEXT,
    verification_details JSONB,
    created_by UUID,
    actor_type VARCHAR(20) NOT NULL DEFAULT 'system'
        CHECK (actor_type IN ('system', 'admin', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revisions_work ON revisions(work_id);
CREATE INDEX idx_revisions_node ON revisions(node_id);
CREATE INDEX idx_revisions_type ON revisions(revision_type);
CREATE INDEX idx_revisions_created ON revisions(created_at DESC);

-- RLS: public read, service_role full access
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read revisions" ON revisions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full access revisions" ON revisions FOR ALL TO service_role USING (true) WITH CHECK (true);
