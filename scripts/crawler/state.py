"""Crawl job state management via Supabase."""
import time
from datetime import datetime, timedelta, timezone

from .db import get_sb

MAX_RETRIES = 3
RETRY_BACKOFF = [1, 3, 7]  # seconds between retries


def _retry(fn, description: str = "db call"):
    """Retry a Supabase call with exponential backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            return fn()
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = RETRY_BACKOFF[attempt]
            print(f"  RETRY {attempt + 1}/{MAX_RETRIES} ({description}): {e} — waiting {wait}s")
            time.sleep(wait)


def upsert_job(job: dict) -> int:
    """Insert or update a crawl job. Returns the job ID."""
    def _do():
        sb = get_sb()
        result = sb.table("crawl_jobs").upsert(
            job, on_conflict="source_id,url"
        ).execute()
        return result.data[0]["id"]
    return _retry(_do, f"upsert_job {job.get('url', '?')}")


def claim_pending_jobs(limit: int = 50) -> list[dict]:
    """Atomically claim pending jobs via FOR UPDATE SKIP LOCKED.

    Calls the claim_jobs() SQL function which atomically selects
    pending jobs and sets their status to 'crawling' in one query.
    Multiple workers calling this concurrently will never get the same jobs.
    The DB function also auto-recovers jobs stuck in 'crawling' for >15 min.
    """
    def _do():
        sb = get_sb()
        result = sb.rpc("claim_jobs", {"p_limit": limit}).execute()
        return result.data or []
    return _retry(_do, "claim_pending_jobs")


def get_pending_jobs(
    source_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Get pending crawl jobs (non-atomic, use claim_pending_jobs for workers)."""
    sb = get_sb()
    query = sb.table("crawl_jobs").select("*").eq("status", "pending")
    if source_id:
        query = query.eq("source_id", source_id)
    result = query.limit(limit).execute()
    return result.data or []


def update_status(job_id: int, status: str, error: str | None = None) -> None:
    """Update the status of a crawl job."""
    def _do():
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
    _retry(_do, f"update_status job={job_id} status={status}")


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


# --- Discovery progress helpers ---


def get_discovery_progress(source_id: str, regulation_type: str) -> dict | None:
    """Fetch cached discovery progress for a source + type pair."""
    sb = get_sb()
    result = (
        sb.table("discovery_progress")
        .select("*")
        .eq("source_id", source_id)
        .eq("regulation_type", regulation_type)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_discovery_progress(progress: dict) -> None:
    """Insert or update discovery progress for a source + type pair."""
    def _do():
        sb = get_sb()
        progress["updated_at"] = datetime.now(timezone.utc).isoformat()
        progress["last_discovered_at"] = datetime.now(timezone.utc).isoformat()
        sb.table("discovery_progress").upsert(
            progress, on_conflict="source_id,regulation_type"
        ).execute()
    _retry(_do, f"upsert_discovery_progress {progress.get('regulation_type', '?')}")


def is_discovery_fresh(
    source_id: str,
    regulation_type: str,
    freshness_hours: float = 24.0,
) -> tuple[bool, dict | None]:
    """Check if discovery for this type was done recently enough to skip.

    Returns (is_fresh, cached_row). is_fresh is True if last_discovered_at
    is within freshness_hours of now.
    """
    row = get_discovery_progress(source_id, regulation_type)
    if not row:
        return False, None

    last = datetime.fromisoformat(row["last_discovered_at"].replace("Z", "+00:00"))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=freshness_hours)
    return last > cutoff, row
