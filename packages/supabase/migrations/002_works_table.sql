-- Migration 002: Works (regulations) table

CREATE TABLE works (
    id SERIAL PRIMARY KEY,
    frbr_uri VARCHAR(255) UNIQUE NOT NULL,
    regulation_type_id INTEGER NOT NULL REFERENCES regulation_types(id),
    number VARCHAR(50),
    year INTEGER NOT NULL,
    title_id TEXT NOT NULL,
    title_en TEXT,
    date_enacted DATE,
    date_promulgated DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'berlaku'
        CHECK (status IN ('berlaku', 'dicabut', 'diubah', 'tidak_berlaku')),
    publication_name VARCHAR(200),
    publication_number VARCHAR(50),
    supplement_number VARCHAR(50),
    subject_tags TEXT[] DEFAULT '{}',
    source_url TEXT,
    source_pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_works_type ON works(regulation_type_id);
CREATE INDEX idx_works_year ON works(year);
CREATE INDEX idx_works_status ON works(status);
CREATE INDEX idx_works_frbr ON works(frbr_uri);
CREATE INDEX idx_works_tags ON works USING GIN(subject_tags);
