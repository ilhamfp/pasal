-- Migration 001: Regulation types and relationship types

CREATE TABLE regulation_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_id VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    hierarchy_level INTEGER NOT NULL,
    description TEXT
);

INSERT INTO regulation_types (code, name_id, name_en, hierarchy_level) VALUES
    ('UUD', 'Undang-Undang Dasar 1945', 'Constitution', 1),
    ('TAP_MPR', 'Ketetapan MPR', 'MPR Resolution', 2),
    ('UU', 'Undang-Undang', 'Law', 3),
    ('PERPPU', 'Peraturan Pemerintah Pengganti Undang-Undang', 'Government Regulation in Lieu of Law', 3),
    ('PP', 'Peraturan Pemerintah', 'Government Regulation', 4),
    ('PERPRES', 'Peraturan Presiden', 'Presidential Regulation', 5),
    ('PERDA_PROV', 'Peraturan Daerah Provinsi', 'Provincial Regulation', 6),
    ('PERDA_KAB', 'Peraturan Daerah Kabupaten/Kota', 'District/City Regulation', 7),
    ('PERMEN', 'Peraturan Menteri', 'Ministerial Regulation', 8),
    ('PERMA', 'Peraturan Mahkamah Agung', 'Supreme Court Regulation', 8),
    ('PBI', 'Peraturan Bank Indonesia', 'Bank Indonesia Regulation', 8);

CREATE TABLE relationship_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_id VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

INSERT INTO relationship_types (code, name_id, name_en) VALUES
    ('mengubah', 'Mengubah', 'Amends'),
    ('diubah_oleh', 'Diubah oleh', 'Amended by'),
    ('mencabut', 'Mencabut', 'Revokes'),
    ('dicabut_oleh', 'Dicabut oleh', 'Revoked by'),
    ('melaksanakan', 'Melaksanakan', 'Implements'),
    ('dilaksanakan_oleh', 'Dilaksanakan oleh', 'Implemented by'),
    ('merujuk', 'Merujuk', 'References');
