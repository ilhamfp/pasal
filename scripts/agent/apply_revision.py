"""Apply a revision to document_nodes.content_text via the atomic DB function.

Delegates to the apply_revision() SQL function which performs all steps
(revision insert, node update, chunk update, suggestion update) in a
single transaction.
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
    """Apply a revision to a document node. Returns the revision ID or None on failure."""
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

        return result.data if result.data else None

    except Exception as e:
        print(f"apply_revision failed: {e}")
        return None
