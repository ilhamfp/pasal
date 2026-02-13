"""Crawl job state management via Supabase."""
from datetime import datetime, timezone

from .db import get_sb


def upsert_job(job: dict) -> int:
    """Insert or update a crawl job. Returns the job ID."""
    sb = get_sb()
    result = sb.table("crawl_jobs").upsert(
        job, on_conflict="source_id,url"
    ).execute()
    return result.data[0]["id"]


def get_pending_jobs(source_id: str | None = None, limit: int = 50) -> list[dict]:
    """Get pending crawl jobs, optionally filtered by source."""
    sb = get_sb()
    query = sb.table("crawl_jobs").select("*").eq("status", "pending")
    if source_id:
        query = query.eq("source_id", source_id)
    result = query.limit(limit).execute()
    return result.data or []


def update_status(job_id: int, status: str, error: str | None = None) -> None:
    """Update the status of a crawl job."""
    sb = get_sb()
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
    sb = get_sb()
    result = (
        sb.table("crawl_jobs")
        .select("id")
        .eq("source_id", source_id)
        .eq("url", url)
        .neq("status", "failed")
        .limit(1)
        .execute()
    )
    return bool(result.data)
