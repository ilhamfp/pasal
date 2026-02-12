-- Migration 010: Add ts_headline snippets to search function
-- Drops and recreates search_legal_chunks with snippet column

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
BEGIN
    RETURN QUERY
    SELECT
        lc.id,
        lc.work_id,
        lc.content,
        lc.metadata,
        (
            ts_rank_cd(lc.fts, websearch_to_tsquery('indonesian', query_text))
            * (1.0 + (10 - COALESCE(rt.hierarchy_level, 5)) * 0.05)
            * (1.0 + GREATEST(0, COALESCE(w.year, 2000) - 1990) * 0.005)
        )::float AS score,
        ts_headline('indonesian', lc.content, websearch_to_tsquery('indonesian', query_text),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2') AS snippet
    FROM legal_chunks lc
    LEFT JOIN works w ON w.id = lc.work_id
    LEFT JOIN regulation_types rt ON rt.id = w.regulation_type_id
    WHERE lc.fts @@ websearch_to_tsquery('indonesian', query_text)
        AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
    ORDER BY score DESC
    LIMIT match_count;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            lc.id,
            lc.work_id,
            lc.content,
            lc.metadata,
            (
                ts_rank_cd(lc.fts, plainto_tsquery('indonesian', query_text))
                * (1.0 + (10 - COALESCE(rt.hierarchy_level, 5)) * 0.05)
                * (1.0 + GREATEST(0, COALESCE(w.year, 2000) - 1990) * 0.005)
            )::float AS score,
            ts_headline('indonesian', lc.content, plainto_tsquery('indonesian', query_text),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2') AS snippet
        FROM legal_chunks lc
        LEFT JOIN works w ON w.id = lc.work_id
        LEFT JOIN regulation_types rt ON rt.id = w.regulation_type_id
        WHERE lc.fts @@ plainto_tsquery('indonesian', query_text)
            AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
        ORDER BY score DESC
        LIMIT match_count;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            lc.id,
            lc.work_id,
            lc.content,
            lc.metadata,
            0.01::float AS score,
            LEFT(lc.content, 200) AS snippet
        FROM legal_chunks lc
        WHERE (
            SELECT bool_and(lc.content ILIKE '%' || word || '%')
            FROM unnest(string_to_array(trim(query_text), ' ')) AS word
            WHERE length(word) > 2
        )
            AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
        ORDER BY lc.id
        LIMIT match_count;
    END IF;
END;
$$;
