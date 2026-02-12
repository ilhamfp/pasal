-- Migration 006: Full-text search function with fallback
-- Uses websearch_to_tsquery first, falls back to plainto_tsquery, then ILIKE

CREATE OR REPLACE FUNCTION search_legal_chunks(
    query_text TEXT,
    match_count INT DEFAULT 10,
    metadata_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    work_id INTEGER,
    content TEXT,
    metadata JSONB,
    score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Try websearch_to_tsquery first (supports operators like quotes, OR, -)
    RETURN QUERY
    SELECT
        lc.id,
        lc.work_id,
        lc.content,
        lc.metadata,
        ts_rank_cd(lc.fts, websearch_to_tsquery('indonesian', query_text))::float AS score
    FROM legal_chunks lc
    WHERE lc.fts @@ websearch_to_tsquery('indonesian', query_text)
        AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
    ORDER BY score DESC
    LIMIT match_count;

    -- If no results, fall back to plainto_tsquery (more lenient matching)
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            lc.id,
            lc.work_id,
            lc.content,
            lc.metadata,
            ts_rank_cd(lc.fts, plainto_tsquery('indonesian', query_text))::float AS score
        FROM legal_chunks lc
        WHERE lc.fts @@ plainto_tsquery('indonesian', query_text)
            AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
        ORDER BY score DESC
        LIMIT match_count;
    END IF;

    -- If still no results, try individual word ILIKE as last resort
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            lc.id,
            lc.work_id,
            lc.content,
            lc.metadata,
            0.01::float AS score
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
