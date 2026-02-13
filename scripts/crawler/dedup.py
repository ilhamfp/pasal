"""Deduplication and visit-tracking for cross-source crawling."""
from .db import get_sb


def build_frbr_uri(reg_type: str, number: str, year: int) -> str:
    """Build a canonical FRBR URI for a regulation."""
    return f"/akn/id/act/{reg_type.lower()}/{year}/{number}"


def is_work_duplicate(frbr_uri: str) -> int | None:
    """Check if a work with this FRBR URI already exists. Returns work_id or None."""
    sb = get_sb()
    result = sb.table("works").select("id").eq("frbr_uri", frbr_uri).limit(1).execute()
    if result.data:
        return result.data[0]["id"]
    return None


def mark_job_duplicate(job_id: int, existing_work_id: int) -> None:
    """Mark a crawl job as duplicate, linking to existing work."""
    sb = get_sb()
    sb.table("crawl_jobs").update({
        "status": "loaded",
        "work_id": existing_work_id,
        "error_message": f"Duplicate — work {existing_work_id} already exists",
    }).eq("id", job_id).execute()


def get_crawl_stats() -> dict:
    """Get crawling statistics."""
    sb = get_sb()
    total = sb.table("crawl_jobs").select("id", count="exact").execute()
    by_status = {}
    for status in ("pending", "crawling", "downloaded", "parsed", "loaded", "failed"):
        r = sb.table("crawl_jobs").select("id", count="exact").eq("status", status).execute()
        by_status[status] = r.count or 0
    works_count = sb.table("works").select("id", count="exact").execute()
    return {
        "total_jobs": total.count or 0,
        "by_status": by_status,
        "total_works": works_count.count or 0,
    }
