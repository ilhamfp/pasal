-- Migration 048: Enable RLS on reference tables missed in 007

ALTER TABLE regulation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read regulation_types" ON regulation_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read relationship_types" ON relationship_types FOR SELECT TO anon, authenticated USING (true);
