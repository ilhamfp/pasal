-- Migration 007: Row Level Security

ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_relationships ENABLE ROW LEVEL SECURITY;

-- Public read access for all legal data
CREATE POLICY "Public read works" ON works FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read nodes" ON document_nodes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read chunks" ON legal_chunks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read rels" ON work_relationships FOR SELECT TO anon, authenticated USING (true);
