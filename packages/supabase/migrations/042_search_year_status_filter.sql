-- Migration 042: Add year and status filters to search_legal_chunks()
--
-- Extends metadata_filter JSONB to also extract 'year' (INT) and 'status' (TEXT).
-- Adds WHERE clauses to all 3 search layers. Same function signature and return
-- shape — zero breaking changes. Callers that don't pass year/status get NULLs
-- and the filters don't apply.

DROP FUNCTION IF EXISTS search_legal_chunks(TEXT, INT, JSONB);

CREATE FUNCTION search_legal_chunks(
    query_text TEXT,
    match_count INT DEFAULT 10,
    metadata_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    work_id INTEGER,
    content TEXT,
    metadata JSONB,
    score FLOAT,
    snippet TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_safe TEXT;
    v_type_filter TEXT;
    v_year_filter INT := CASE WHEN metadata_filter ? 'year'
        THEN (metadata_filter ->> 'year')::int ELSE NULL END;
    v_status_filter TEXT := metadata_filter ->> 'status';
    v_type_id INTEGER;
    v_first_word TEXT;
    v_second_word TEXT;
    v_nums TEXT[];
    v_count INTEGER := 0;
    v_tsquery TSQUERY;
    v_node_types TEXT[] := ARRAY[
        'pasal','ayat','preamble','content',
        'aturan','penjelasan_umum','penjelasan_pasal'
    ];
BEGIN
    v_type_filter := metadata_filter ->> 'type';

    -- Sanitize: strip all non-alphanumeric/non-space chars, collapse whitespace.
    v_safe := regexp_replace(query_text, '[^a-zA-Z0-9 ]', ' ', 'g');
    v_safe := trim(regexp_replace(v_safe, '\s+', ' ', 'g'));

    IF v_safe = '' THEN RETURN; END IF;

    -- ================================================================
    -- Layer 1: Identity fast path — deterministic regulation lookup
    -- ================================================================

    v_first_word := UPPER(split_part(v_safe, ' ', 1));
    v_second_word := UPPER(COALESCE(NULLIF(split_part(v_safe, ' ', 2), ''), ''));

    -- 1a. Try code match
    SELECT rt.id INTO v_type_id
    FROM regulation_types rt
    WHERE rt.code IN (
        v_first_word,
        v_first_word || '_' || v_second_word,
        CASE WHEN v_first_word = 'PERPU' THEN 'PERPPU' ELSE NULL END
    )
    ORDER BY CASE rt.code
        WHEN v_first_word THEN 1
        WHEN v_first_word || '_' || v_second_word THEN 2
        ELSE 3
    END
    LIMIT 1;

    -- 1b. If no code match, try name_id prefix
    IF v_type_id IS NULL THEN
        SELECT sub.type_id INTO v_type_id
        FROM (
            SELECT rt.id AS type_id,
                   trim(regexp_replace(
                       regexp_replace(LOWER(rt.name_id), '[^a-z0-9 ]', ' ', 'g'),
                       '\s+', ' ', 'g'
                   )) AS norm
            FROM regulation_types rt
        ) sub
        WHERE LOWER(v_safe) LIKE sub.norm || ' %'
           OR LOWER(v_safe) = sub.norm
        ORDER BY length(sub.norm) DESC
        LIMIT 1;
    END IF;

    -- 1c. If we found a regulation type, extract numbers and do direct lookup
    IF v_type_id IS NOT NULL THEN
        SELECT array_agg(m[1]::text) INTO v_nums
        FROM regexp_matches(v_safe, '(\d+)', 'g') m;

        IF v_nums IS NOT NULL AND array_length(v_nums, 1) > 0 THEN
            RETURN QUERY
            SELECT
                dn_rep.id::bigint,
                w.id,
                dn_rep.content_text,
                jsonb_build_object(
                    'type', rt.code,
                    'number', w.number,
                    'year', w.year::text,
                    'pasal', dn_rep.node_number
                ),
                1000.0::float,
                LEFT(dn_rep.content_text, 200)
            FROM works w
            JOIN regulation_types rt ON rt.id = w.regulation_type_id
            JOIN LATERAL (
                SELECT d.id, d.content_text, d.number AS node_number
                FROM document_nodes d
                WHERE d.work_id = w.id
                  AND d.content_text IS NOT NULL
                  AND d.node_type = ANY(v_node_types)
                ORDER BY d.sort_order ASC NULLS LAST
                LIMIT 1
            ) dn_rep ON true
            WHERE w.regulation_type_id = v_type_id
              AND (
                  (array_length(v_nums, 1) >= 2 AND (
                      (w.number = v_nums[1]
                       AND length(v_nums[2]) <= 4
                       AND w.year = v_nums[2]::int)
                      OR
                      (w.number = v_nums[2]
                       AND length(v_nums[1]) <= 4
                       AND w.year = v_nums[1]::int)
                  ))
                  OR
                  (array_length(v_nums, 1) = 1 AND (
                      w.number = v_nums[1]
                      OR (length(v_nums[1]) <= 4 AND w.year = v_nums[1]::int)
                  ))
              )
              AND (v_type_filter IS NULL OR rt.code = v_type_filter)
              AND (v_year_filter IS NULL OR w.year = v_year_filter)
              AND (v_status_filter IS NULL OR w.status = v_status_filter)
            LIMIT 3;
        END IF;
    END IF;

    -- ================================================================
    -- Layer 2: Works FTS — title / subject / metadata search
    -- ================================================================

    RETURN QUERY
    SELECT
        dn_rep.id::bigint,
        w.id,
        dn_rep.content_text,
        jsonb_build_object(
            'type', rt.code,
            'number', w.number,
            'year', w.year::text,
            'pasal', dn_rep.node_number
        ),
        (
            ts_rank_cd(w.search_fts, plainto_tsquery('indonesian', v_safe))
            * 10.0
            * (1.0 + (10 - COALESCE(rt.hierarchy_level, 5)) * 0.05)
        )::float,
        LEFT(dn_rep.content_text, 200)
    FROM works w
    JOIN regulation_types rt ON rt.id = w.regulation_type_id
    JOIN LATERAL (
        SELECT d.id, d.content_text, d.number AS node_number
        FROM document_nodes d
        WHERE d.work_id = w.id
          AND d.content_text IS NOT NULL
          AND d.node_type = ANY(v_node_types)
        ORDER BY d.sort_order ASC NULLS LAST
        LIMIT 1
    ) dn_rep ON true
    WHERE w.search_fts @@ plainto_tsquery('indonesian', v_safe)
      AND (v_type_filter IS NULL OR rt.code = v_type_filter)
      AND (v_year_filter IS NULL OR w.year = v_year_filter)
      AND (v_status_filter IS NULL OR w.status = v_status_filter)
    ORDER BY 5 DESC
    LIMIT 5;

    -- ================================================================
    -- Layer 3: Content FTS — search within document_nodes
    -- ================================================================

    -- Tier 1: websearch_to_tsquery
    v_tsquery := NULL;
    BEGIN
        v_tsquery := websearch_to_tsquery('indonesian', v_safe);
    EXCEPTION WHEN OTHERS THEN
        v_tsquery := NULL;
    END;

    IF v_tsquery IS NOT NULL THEN
        RETURN QUERY
        SELECT
            dn.id::bigint,
            dn.work_id,
            dn.content_text,
            jsonb_build_object(
                'type', rt.code,
                'number', w.number,
                'year', w.year::text,
                'pasal', dn.number
            ),
            (
                ts_rank_cd(dn.fts, v_tsquery)
                * (1.0 + (10 - COALESCE(rt.hierarchy_level, 5)) * 0.05)
                * (1.0 + GREATEST(0, COALESCE(w.year, 2000) - 1990) * 0.005)
            )::float,
            ts_headline('indonesian', dn.content_text, v_tsquery,
                'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2')
        FROM document_nodes dn
        JOIN works w ON w.id = dn.work_id
        JOIN regulation_types rt ON rt.id = w.regulation_type_id
        WHERE dn.fts @@ v_tsquery
            AND dn.node_type = ANY(v_node_types)
            AND dn.content_text IS NOT NULL
            AND (v_type_filter IS NULL OR rt.code = v_type_filter)
            AND (v_year_filter IS NULL OR w.year = v_year_filter)
            AND (v_status_filter IS NULL OR w.status = v_status_filter)
        ORDER BY 5 DESC
        LIMIT match_count;

        GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;

    IF v_count = 0 THEN
        -- Tier 2: plainto_tsquery
        v_tsquery := plainto_tsquery('indonesian', v_safe);

        RETURN QUERY
        SELECT
            dn.id::bigint,
            dn.work_id,
            dn.content_text,
            jsonb_build_object(
                'type', rt.code,
                'number', w.number,
                'year', w.year::text,
                'pasal', dn.number
            ),
            (
                ts_rank_cd(dn.fts, v_tsquery)
                * (1.0 + (10 - COALESCE(rt.hierarchy_level, 5)) * 0.05)
                * (1.0 + GREATEST(0, COALESCE(w.year, 2000) - 1990) * 0.005)
            )::float,
            ts_headline('indonesian', dn.content_text, v_tsquery,
                'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2')
        FROM document_nodes dn
        JOIN works w ON w.id = dn.work_id
        JOIN regulation_types rt ON rt.id = w.regulation_type_id
        WHERE dn.fts @@ v_tsquery
            AND dn.node_type = ANY(v_node_types)
            AND dn.content_text IS NOT NULL
            AND (v_type_filter IS NULL OR rt.code = v_type_filter)
            AND (v_year_filter IS NULL OR w.year = v_year_filter)
            AND (v_status_filter IS NULL OR w.status = v_status_filter)
        ORDER BY 5 DESC
        LIMIT match_count;

        GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;

    IF v_count = 0 THEN
        -- Tier 3: ILIKE fallback
        RETURN QUERY
        SELECT
            dn.id::bigint,
            dn.work_id,
            dn.content_text,
            jsonb_build_object(
                'type', rt.code,
                'number', w.number,
                'year', w.year::text,
                'pasal', dn.number
            ),
            0.01::float,
            LEFT(dn.content_text, 200)
        FROM document_nodes dn
        JOIN works w ON w.id = dn.work_id
        JOIN regulation_types rt ON rt.id = w.regulation_type_id
        WHERE (
            SELECT bool_and(dn.content_text ILIKE '%' || word || '%')
            FROM unnest(string_to_array(v_safe, ' ')) AS word
            WHERE length(word) > 2
        )
            AND dn.node_type = ANY(v_node_types)
            AND dn.content_text IS NOT NULL
            AND (v_type_filter IS NULL OR rt.code = v_type_filter)
            AND (v_year_filter IS NULL OR w.year = v_year_filter)
            AND (v_status_filter IS NULL OR w.status = v_status_filter)
        ORDER BY dn.id
        LIMIT match_count;
    END IF;
END;
$$;
