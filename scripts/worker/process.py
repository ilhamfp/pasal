"""Process pending crawl jobs: download PDF, parse, load to Supabase.

Picks up pending jobs from crawl_jobs table, downloads the PDF,
parses it into structured nodes, and loads into Supabase.

PDF tracking: stores SHA-256 hash, size, and download timestamp.
If a PDF already exists locally with the same hash, skips re-download.
"""
import asyncio
import hashlib
import ssl
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
from crawler.config import DEFAULT_HEADERS, DELAY_BETWEEN_REQUESTS
from crawler.db import get_sb
from crawler.state import get_pending_jobs, update_status
from loader.load_to_supabase import (
    cleanup_work_data,
    create_chunks,
    init_supabase,
    load_nodes_recursive,
    load_work,
)
from parser.parse_law import extract_text_from_pdf, parse_into_nodes

PDF_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "pdfs"

# Bump this when the parser changes significantly to trigger re-extraction
EXTRACTION_VERSION = 1


def _sha256(path: Path) -> str:
    """Compute SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _create_run(source_id: str | None) -> int:
    """Create a scraper_runs record and return its ID."""
    sb = get_sb()
    result = sb.table("scraper_runs").insert({
        "source_id": source_id or "all",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return result.data[0]["id"]


def _update_run(run_id: int, stats: dict, status: str = "completed", error: str | None = None) -> None:
    """Update a scraper_runs record with final stats."""
    sb = get_sb()
    update = {
        "status": status,
        "jobs_processed": stats.get("processed", 0),
        "jobs_succeeded": stats.get("succeeded", 0),
        "jobs_failed": stats.get("failed", 0),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        update["error_message"] = error
    sb.table("scraper_runs").update(update).eq("id", run_id).execute()


def _build_law_dict(job: dict, text: str, nodes: list) -> dict:
    """Build the law dict expected by load_to_supabase from job metadata."""
    reg_type = job.get("regulation_type", "UU")
    number = job.get("number", "")
    year = job.get("year", 0)
    title = job.get("title", f"{reg_type} {number}/{year}")
    frbr_uri = job.get("frbr_uri", f"/akn/id/act/{reg_type.lower()}/{year}/{number}")

    return {
        "frbr_uri": frbr_uri,
        "type": reg_type,
        "number": number,
        "year": year,
        "title_id": title,
        "status": "berlaku",
        "source_url": job.get("url"),
        "source_pdf_url": job.get("pdf_url"),
        "full_text": text,
        "nodes": nodes,
    }


def _extract_and_load(sb, job: dict, pdf_path: Path) -> tuple[int, int, int]:
    """Extract text from PDF, parse, and load to Supabase.

    Returns (work_id, pasal_count, chunk_count).
    Raises on failure.
    """
    text = extract_text_from_pdf(pdf_path)
    if not text or len(text) < 100:
        raise ValueError(f"PDF text too short ({len(text)} chars)")

    nodes = parse_into_nodes(text)
    law = _build_law_dict(job, text, nodes)

    work_id = load_work(sb, law)
    if not work_id:
        raise ValueError("Failed to upsert work")

    cleanup_work_data(sb, work_id)
    pasal_nodes = load_nodes_recursive(sb, work_id, nodes)
    chunk_count = create_chunks(sb, work_id, law, pasal_nodes)

    return work_id, len(pasal_nodes), chunk_count


async def process_jobs(
    source_id: str | None = None,
    batch_size: int = 20,
    max_runtime: int = 1500,
    run_id: int | None = None,
) -> dict:
    """Process pending crawl_jobs through the full pipeline.

    Downloads PDF (or uses cached copy), parses, loads to Supabase.
    Tracks PDF hash, size, and download timestamp for reproducibility.
    """
    stats = {"processed": 0, "succeeded": 0, "failed": 0, "skipped": 0}
    start_time = time.time()

    jobs = get_pending_jobs(source_id=source_id, limit=batch_size)
    if not jobs:
        print("  No pending jobs found")
        return stats

    print(f"  Found {len(jobs)} pending jobs")

    sb = init_supabase()
    db = get_sb()

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    transport = httpx.AsyncHTTPTransport(retries=3, verify=ctx)

    async with httpx.AsyncClient(timeout=60, transport=transport, follow_redirects=True) as client:
        for job in jobs:
            elapsed = time.time() - start_time
            if elapsed > max_runtime:
                print(f"  Runtime limit reached ({max_runtime}s), stopping")
                break

            job_id = job["id"]
            pdf_url = job.get("pdf_url")
            slug = job.get("url", "").split("/")[-1] or f"job_{job_id}"

            print(f"\n  [{stats['processed']+1}/{len(jobs)}] Processing {slug}...")

            if not pdf_url:
                update_status(job_id, "failed", "No PDF URL")
                stats["failed"] += 1
                stats["processed"] += 1
                continue

            try:
                # Link to run
                if run_id:
                    db.table("crawl_jobs").update({"run_id": run_id}).eq("id", job_id).execute()

                pdf_path = PDF_DIR / f"{slug}.pdf"
                now = datetime.now(timezone.utc).isoformat()

                # 1. Download PDF (or use cached copy)
                if pdf_path.exists():
                    local_hash = _sha256(pdf_path)
                    existing_hash = job.get("pdf_hash")
                    if existing_hash and existing_hash == local_hash:
                        print(f"    Using cached PDF (hash match: {local_hash[:12]}...)")
                    else:
                        print(f"    PDF exists locally, computing hash...")
                else:
                    update_status(job_id, "crawling")
                    pdf_path.parent.mkdir(parents=True, exist_ok=True)
                    resp = await client.get(pdf_url, headers=DEFAULT_HEADERS)
                    resp.raise_for_status()
                    pdf_path.write_bytes(resp.content)
                    local_hash = _sha256(pdf_path)
                    print(f"    Downloaded {pdf_path.stat().st_size:,} bytes")

                # Store PDF metadata
                local_hash = _sha256(pdf_path)
                pdf_size = pdf_path.stat().st_size
                db.table("crawl_jobs").update({
                    "status": "downloaded",
                    "pdf_hash": local_hash,
                    "pdf_size": pdf_size,
                    "pdf_downloaded_at": now,
                    "pdf_local_path": str(pdf_path),
                    "updated_at": now,
                }).eq("id", job_id).execute()

                # 2. Extract, parse, load
                work_id, pasal_count, chunk_count = _extract_and_load(sb, job, pdf_path)

                # 3. Mark as loaded with extraction version
                db.table("crawl_jobs").update({
                    "status": "loaded",
                    "work_id": work_id,
                    "extraction_version": EXTRACTION_VERSION,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()

                stats["succeeded"] += 1
                print(f"    OK: {pasal_count} pasals, {chunk_count} chunks, hash={local_hash[:12]}...")

            except httpx.HTTPStatusError as e:
                error_msg = f"HTTP {e.response.status_code}"
                update_status(job_id, "failed", error_msg)
                stats["failed"] += 1
                print(f"    FAIL: {error_msg}")

            except Exception as e:
                update_status(job_id, "failed", str(e)[:500])
                stats["failed"] += 1
                print(f"    FAIL: {e}")

            stats["processed"] += 1
            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

    return stats


def reprocess_jobs(
    batch_size: int = 50,
    force: bool = False,
) -> dict:
    """Re-extract and reload from existing local PDFs (no re-download).

    Finds jobs that are 'loaded' or 'parsed' and have a local PDF,
    then re-runs the extraction pipeline. Useful for iterating on
    parser quality.

    Args:
        batch_size: Max jobs to reprocess.
        force: If True, reprocess all loaded jobs. If False, only reprocess
               jobs with extraction_version < EXTRACTION_VERSION.
    """
    stats = {"processed": 0, "succeeded": 0, "failed": 0, "skipped": 0}
    db = get_sb()
    sb = init_supabase()

    # Find loaded jobs with local PDFs
    query = db.table("crawl_jobs").select("*").in_("status", ["loaded", "parsed", "downloaded"])
    if not force:
        # Only reprocess if extraction version is outdated
        query = query.lt("extraction_version", EXTRACTION_VERSION)
    result = query.limit(batch_size).execute()
    jobs = result.data or []

    if not jobs:
        print("  No jobs to reprocess")
        return stats

    print(f"  Found {len(jobs)} jobs to reprocess (extraction v{EXTRACTION_VERSION})")

    for job in jobs:
        job_id = job["id"]
        slug = job.get("url", "").split("/")[-1] or f"job_{job_id}"
        pdf_local = job.get("pdf_local_path")

        # Try to find the PDF
        if pdf_local:
            pdf_path = Path(pdf_local)
        else:
            pdf_path = PDF_DIR / f"{slug}.pdf"

        if not pdf_path.exists():
            print(f"  [{stats['processed']+1}] {slug}: PDF not found at {pdf_path}, skipping")
            stats["skipped"] += 1
            stats["processed"] += 1
            continue

        print(f"  [{stats['processed']+1}/{len(jobs)}] Reprocessing {slug}...")

        try:
            # Verify hash if available
            stored_hash = job.get("pdf_hash")
            current_hash = _sha256(pdf_path)
            if stored_hash and stored_hash != current_hash:
                print(f"    WARNING: PDF hash changed! stored={stored_hash[:12]} current={current_hash[:12]}")

            work_id, pasal_count, chunk_count = _extract_and_load(sb, job, pdf_path)

            # Update job
            db.table("crawl_jobs").update({
                "status": "loaded",
                "work_id": work_id,
                "extraction_version": EXTRACTION_VERSION,
                "pdf_hash": current_hash,
                "pdf_size": pdf_path.stat().st_size,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).execute()

            stats["succeeded"] += 1
            print(f"    OK: {pasal_count} pasals, {chunk_count} chunks")

        except Exception as e:
            update_status(job_id, "failed", f"reprocess: {str(e)[:400]}")
            stats["failed"] += 1
            print(f"    FAIL: {e}")

        stats["processed"] += 1

    return stats
