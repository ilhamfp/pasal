-- Migration 025: Normalize sort_order to sequential values.
--
-- Root cause: load_nodes_recursive used `sort_order * 100` per depth level,
-- producing values that overflow BIGINT at 10+ levels deep.
-- The code fix (DFS counter) is already in place; this migration normalizes
-- existing data so ordering stays correct with small sequential values.

-- Normalize sort_order to row-number within each work, preserving existing order.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY work_id ORDER BY sort_order, id) AS new_order
    FROM document_nodes
)
UPDATE document_nodes dn
SET sort_order = r.new_order
FROM ranked r
WHERE dn.id = r.id;
