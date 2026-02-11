-- Migration 006: Full-text search function

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
LANGUAGE sql
STABLE
AS $$
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
$$;
