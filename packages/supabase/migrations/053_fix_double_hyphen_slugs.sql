-- Migration 053: Fix double-hyphen slugs
--
-- 220 works (mostly PERMEN) have slugs like "permenkeu-no-46--tahun-2024"
-- caused by empty separators in the slug generation pipeline.
-- Fix: collapse all double hyphens to single hyphens.

-- 1. Fix existing double-hyphen slugs
UPDATE works
SET slug = REPLACE(slug, '--', '-')
WHERE slug LIKE '%--%';

-- 2. Harden the trigger to prevent future double-hyphen slugs
--    Preserves UUD/UUDS year-omission logic from migration 052.
CREATE OR REPLACE FUNCTION generate_work_slug()
RETURNS TRIGGER AS $$
DECLARE
    type_prefix TEXT;
    reg_code TEXT;
    raw_slug TEXT;
BEGIN
    IF NEW.slug IS NULL THEN
        -- Look up the regulation type code
        SELECT UPPER(rt.code)
        INTO reg_code
        FROM regulation_types rt
        WHERE rt.id = NEW.regulation_type_id;

        -- Extract issuer-aware prefix from frbr_uri if available
        IF NEW.frbr_uri IS NOT NULL AND NEW.frbr_uri LIKE '/akn/%' THEN
            type_prefix := split_part(NEW.frbr_uri, '/', 5);
        END IF;

        -- Fallback to regulation_type code
        IF type_prefix IS NULL OR type_prefix = '' THEN
            type_prefix := LOWER(reg_code);
        END IF;

        -- UUD/UUDS: omit year suffix (year is the number itself, would be redundant)
        IF reg_code IN ('UUD', 'UUDS') THEN
            raw_slug := LOWER(type_prefix) || '-' || LOWER(REPLACE(NEW.number, '/', '-'));
        ELSE
            raw_slug := LOWER(type_prefix)
                || '-' || LOWER(REPLACE(NEW.number, '/', '-'))
                || '-' || NEW.year::text;
        END IF;

        -- Collapse any double hyphens and trim trailing hyphens
        WHILE raw_slug LIKE '%--%' LOOP
            raw_slug := REPLACE(raw_slug, '--', '-');
        END LOOP;
        raw_slug := RTRIM(raw_slug, '-');

        NEW.slug := raw_slug;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-apply search_path hardening (CREATE OR REPLACE drops SET search_path)
ALTER FUNCTION generate_work_slug() SET search_path = 'public', 'extensions';
