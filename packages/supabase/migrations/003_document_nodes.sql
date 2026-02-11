-- Migration 003: Document structure (articles/chapters)

CREATE TABLE document_nodes (
    id SERIAL PRIMARY KEY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    node_type VARCHAR(20) NOT NULL
        CHECK (node_type IN ('bab','bagian','paragraf','pasal','ayat','penjelasan_umum','penjelasan_pasal')),
    number VARCHAR(50),
    heading TEXT,
    content_text TEXT,
    parent_id INTEGER REFERENCES document_nodes(id),
    path LTREE,
    depth INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nodes_work ON document_nodes(work_id);
CREATE INDEX idx_nodes_type ON document_nodes(node_type);
CREATE INDEX idx_nodes_parent ON document_nodes(parent_id);
CREATE INDEX idx_nodes_path ON document_nodes USING GIST(path);
