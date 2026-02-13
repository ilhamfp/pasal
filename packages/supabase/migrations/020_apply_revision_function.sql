-- apply_revision: The ONLY way to mutate document_nodes.content_text
-- Creates a revision row FIRST, then updates content.
-- If any step fails, the entire operation rolls back.

CREATE OR REPLACE FUNCTION apply_revision(
    p_node_id INTEGER,
    p_work_id INTEGER,
    p_new_content TEXT,
    p_revision_type VARCHAR(30),
    p_reason TEXT,
    p_suggestion_id BIGINT DEFAULT NULL,
    p_actor_type VARCHAR(20) DEFAULT 'system',
    p_created_by UUID DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_content TEXT;
    v_node_type VARCHAR(20);
    v_node_number VARCHAR(50);
    v_node_path LTREE;
    v_revision_id BIGINT;
BEGIN
    -- 1. Fetch current content from document_nodes
    SELECT content_text, node_type, number, path
    INTO v_old_content, v_node_type, v_node_number, v_node_path
    FROM document_nodes
    WHERE id = p_node_id AND work_id = p_work_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Node % not found in work %', p_node_id, p_work_id;
    END IF;

    -- 2. INSERT into revisions (old + new content)
    INSERT INTO revisions (
        work_id, node_id, node_type, node_number, node_path,
        old_content, new_content, revision_type, reason,
        suggestion_id, actor_type, created_by
    ) VALUES (
        p_work_id, p_node_id, v_node_type, v_node_number, v_node_path,
        v_old_content, p_new_content, p_revision_type, p_reason,
        p_suggestion_id, p_actor_type, p_created_by
    ) RETURNING id INTO v_revision_id;

    -- 3. UPDATE document_nodes.content_text + revision_id
    UPDATE document_nodes
    SET content_text = p_new_content,
        revision_id = v_revision_id
    WHERE id = p_node_id;

    -- 4. UPDATE legal_chunks.content (regenerate search index)
    UPDATE legal_chunks
    SET content = p_new_content
    WHERE node_id = p_node_id;

    -- 5. If suggestion_id: UPDATE suggestions.status='approved'
    IF p_suggestion_id IS NOT NULL THEN
        UPDATE suggestions
        SET status = 'approved',
            revision_id = v_revision_id,
            reviewed_by = p_created_by,
            reviewed_at = NOW()
        WHERE id = p_suggestion_id;
    END IF;

    RETURN v_revision_id;
END;
$$;
