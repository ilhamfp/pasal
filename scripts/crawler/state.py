"""Crawl job state management via Supabase."""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

_sb = None


def _get_sb():
    global _sb
    if _sb is None:
        _sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _sb


def upsert_job(job: dict) -> int:
    """Insert or update a crawl job. Returns the job ID."""
    sb = _get_sb()
    result = sb.table("crawl_jobs").upsert(
        job, on_conflict="source_id,url"
    ).execute()
    return result.data[0]["id"]


def get_pending_jobs(source_id: str | None = None, limit: int = 50) -> list[dict]:
    """Get pending crawl jobs, optionally filtered by source."""
    sb = _get_sb()
    query = sb.table("crawl_jobs").select("*").eq("status", "pending")
    if source_id:
        query = query.eq("source_id", source_id)
    result = query.limit(limit).execute()
    return result.data or []


def update_status(job_id: int, status: str, error: str | None = None) -> None:
    """Update the status of a crawl job."""
    sb = _get_sb()
    update: dict = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        update["error_message"] = error
    if status == "crawling":
        update["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("crawl_jobs").update(update).eq("id", job_id).execute()


def is_url_visited(source_id: str, url: str) -> bool:
    """Check if a URL has already been crawled for a given source."""
    sb = _get_sb()
    result = (
        sb.table("crawl_jobs")
        .select("id")
        .eq("source_id", source_id)
        .eq("url", url)
        .neq("status", "failed")
        .limit(1)
        .execute()
    )
    return len(result.data or []) > 0
