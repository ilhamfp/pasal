-- Migration 015: Expand regulation_types to cover all peraturan.go.id categories
-- Adds 11 new types (from 11 to ~22), using ON CONFLICT to be idempotent.

INSERT INTO regulation_types (code, name_id, name_en, hierarchy_level, description) VALUES
    -- Central government types missing from original seed
    ('UUDRT', 'Undang-Undang Darurat', 'Emergency Law', 3,
     'Historical emergency laws, mostly pre-1966'),
    ('UUDS', 'Undang-Undang Dasar Sementara', 'Provisional Constitution', 1,
     'Provisional Constitution of 1950, historical'),
    ('PENPRES', 'Penetapan Presiden', 'Presidential Determination', 5,
     'Presidential determinations, mostly Sukarno era 1959-1966'),
    ('KEPPRES', 'Keputusan Presiden', 'Presidential Decision', 5,
     'Presidential decisions — appointments, designations, operational matters'),
    ('INPRES', 'Instruksi Presiden', 'Presidential Instruction', 5,
     'Presidential instructions to ministries/agencies'),

    -- Agency/institutional regulations (6,716 on peraturan.go.id)
    ('PERBAN', 'Peraturan Badan/Lembaga', 'Agency/Institutional Regulation', 8,
     'Regulations from non-ministerial agencies: Bawaslu, BRIN, BMKG, KPU, OJK, etc.'),

    -- Specific ministerial regulation subtypes
    ('PERMENKUMHAM', 'Peraturan Menteri Hukum dan HAM', 'Minister of Law and Human Rights Regulation', 8,
     'Kemenkumham regulations — shown as separate category on peraturan.go.id'),
    ('PERMENKUM', 'Peraturan Menteri Hukum', 'Minister of Law Regulation', 8,
     'Kemenkum regulations (post-2024 ministry restructuring)'),

    -- Merged regional (peraturan.go.id shows PERDA as one category with 19,732 entries)
    ('PERDA', 'Peraturan Daerah', 'Regional Regulation', 6,
     'Combined regional regulations — maps to both PERDA_PROV and PERDA_KAB'),

    -- Ministerial/agency decision types
    ('KEPMEN', 'Keputusan Menteri', 'Ministerial Decision', 9,
     'Ministerial decisions — operational, not normative'),
    ('SE', 'Surat Edaran', 'Circular Letter', 10,
     'Circular letters — guidance, not binding regulation')
ON CONFLICT (code) DO NOTHING;
