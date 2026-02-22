-- Migration 052: Fix UUD/UUDS slug generation
--
-- UUD types use their year as the regulation number (no sequential "Nomor"),
-- so the slug should omit the redundant trailing year:
--   uud-1945 (not uud-1945-1945)
--   uud-1945-p1 (not uud-1945-p1-1945)

-- 1. Fix existing UUD slugs
UPDATE works SET slug = 'uud-1945'
WHERE frbr_uri = '/akn/id/act/uud/1945/original';

UPDATE works SET slug = 'uud-1945-p1'
WHERE frbr_uri = '/akn/id/act/uud/1945/perubahan-1';

UPDATE works SET slug = 'uud-1945-p2'
WHERE frbr_uri = '/akn/id/act/uud/1945/perubahan-2';

-- 2. Update trigger function to omit year suffix for UUD/UUDS types
CREATE OR REPLACE FUNCTION generate_work_slug()
RETURNS TRIGGER AS $$
DECLARE
    type_prefix TEXT;
    reg_code TEXT;
BEGIN
    IF NEW.slug IS NULL THEN
        -- Look up the regulation type code
        SELECT UPPER(rt.code)
        INTO reg_code
        FROM regulation_types rt
        WHERE rt.id = NEW.regulation_type_id;

        -- Extract issuer-aware prefix from frbr_uri if available
        -- e.g. /akn/id/act/perda-kabupaten-pati/2023/1 → "perda-kabupaten-pati"
        IF NEW.frbr_uri IS NOT NULL AND NEW.frbr_uri LIKE '/akn/%' THEN
            type_prefix := split_part(NEW.frbr_uri, '/', 5);
        END IF;

        -- Fallback to regulation_type code if frbr_uri doesn't yield a prefix
        IF type_prefix IS NULL OR type_prefix = '' THEN
            type_prefix := LOWER(reg_code);
        END IF;

        -- UUD/UUDS: omit year suffix (year is the number itself, would be redundant)
        IF reg_code IN ('UUD', 'UUDS') THEN
            NEW.slug := LOWER(type_prefix) || '-' || LOWER(REPLACE(NEW.number, '/', '-'));
        ELSE
            NEW.slug := LOWER(type_prefix)
                || '-' || LOWER(REPLACE(NEW.number, '/', '-'))
                || '-' || NEW.year::text;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
