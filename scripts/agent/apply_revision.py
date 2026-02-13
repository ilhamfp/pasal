"""Python wrapper for the apply_revision SQL function.

THE CRITICAL FUNCTION — the only way to mutate document_nodes.content_text.

Steps:
1. INSERT into revisions (old + new content)
2. UPDATE document_nodes.content_text + revision_id
3. UPDATE legal_chunks.content (regenerate search index)
4. If suggestion_id: UPDATE suggestions.status='approved'

If any step fails, the entire operation must roll back.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client


def apply_revision(
    node_id: int,
    work_id: int,
    new_content: str,
    revision_type: str,
    reason: str,
    suggestion_id: int | None = None,
    actor_type: str = "system",
    created_by: str | None = None,
) -> int | None:
    """Apply a revision using the SQL RPC function.

    Returns the revision ID or None on failure.
    """
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    try:
        result = sb.rpc("apply_revision", {
            "p_node_id": node_id,
            "p_work_id": work_id,
            "p_new_content": new_content,
            "p_revision_type": revision_type,
            "p_reason": reason,
            "p_suggestion_id": suggestion_id,
            "p_actor_type": actor_type,
            "p_created_by": created_by,
        }).execute()

        if result.data is not None:
            return int(result.data)
        return None

    except Exception as e:
        print(f"apply_revision failed: {e}")
        # Fallback: manual steps
        return _apply_revision_manual(
            sb, node_id, work_id, new_content,
            revision_type, reason, suggestion_id,
            actor_type, created_by,
        )


def _apply_revision_manual(
    sb, node_id: int, work_id: int, new_content: str,
    revision_type: str, reason: str, suggestion_id: int | None,
    actor_type: str, created_by: str | None,
) -> int | None:
    """Manual fallback if the RPC function is not available."""
    try:
        # 1. Get current content
        node = sb.table("document_nodes").select("content_text, node_type, number").eq("id", node_id).single().execute()
        if not node.data:
            return None

        # 2. Create revision
        rev_data = {
            "work_id": work_id,
            "node_id": node_id,
            "node_type": node.data["node_type"],
            "node_number": node.data.get("number"),
            "old_content": node.data.get("content_text"),
            "new_content": new_content,
            "revision_type": revision_type,
            "reason": reason,
            "suggestion_id": suggestion_id,
            "actor_type": actor_type,
            "created_by": created_by,
        }
        rev = sb.table("revisions").insert(rev_data).select("id").single().execute()
        if not rev.data:
            return None
        revision_id = rev.data["id"]

        # 3. Update document_nodes
        sb.table("document_nodes").update({
            "content_text": new_content,
            "revision_id": revision_id,
        }).eq("id", node_id).execute()

        # 4. Update legal_chunks
        sb.table("legal_chunks").update({
            "content": new_content,
        }).eq("node_id", node_id).execute()

        # 5. Update suggestion if applicable
        if suggestion_id:
            sb.table("suggestions").update({
                "status": "approved",
                "revision_id": revision_id,
                "reviewed_at": "now()",
            }).eq("id", suggestion_id).execute()

        return revision_id

    except Exception as e:
        print(f"Manual apply_revision failed: {e}")
        return None
