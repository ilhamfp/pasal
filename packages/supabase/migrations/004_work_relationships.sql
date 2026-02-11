-- Migration 004: Relationships between laws

CREATE TABLE work_relationships (
    id SERIAL PRIMARY KEY,
    source_work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    target_work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    relationship_type_id INTEGER NOT NULL REFERENCES relationship_types(id),
    notes TEXT,
    UNIQUE(source_work_id, target_work_id, relationship_type_id)
);

CREATE INDEX idx_rel_source ON work_relationships(source_work_id);
CREATE INDEX idx_rel_target ON work_relationships(target_work_id);
