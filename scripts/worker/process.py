"""Process pending crawl jobs: download PDF, parse, load to Supabase.

Picks up pending jobs from crawl_jobs table, downloads the PDF,
parses it into structured nodes, and loads into Supabase.

PDF tracking: stores SHA-256 hash, size, and download timestamp.
If a PDF already exists locally with the same hash, skips re-download.
"""
import asyncio
import hashlib
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from crawler.config import DEFAULT_HEADERS, DELAY_BETWEEN_REQUESTS, create_ssl_context
from crawler.db import get_sb
from crawler.state import claim_pending_jobs, update_status
from loader.load_to_supabase import (
    cleanup_work_data,
    create_chunks,
    init_supabase,
    load_nodes_by_level,
    load_nodes_recursive,
    load_work,
)
from parser.classify_pdf import classify_pdf_quality
from parser.extract_pymupdf import extract_text_pymupdf
from parser.ocr_correct import correct_ocr_errors
from parser.parse_structure import parse_structure

PDF_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "pdfs"
STORAGE_BUCKET = "regulation-pdfs"

# ---- Metadata extraction from detail pages ----

_METADATA_LABEL_MAP = {
    "pemrakarsa": "pemrakarsa",
    "tempat penetapan": "tempat_penetapan",
    "ditetapkan tanggal": "tanggal_penetapan",
    "pejabat yang menetapkan": "pejabat_penetap",
    "status": "status",
    "nomor pengundangan": "nomor_pengundangan",
    "nomor tambahan": "nomor_tambahan",
    "tanggal pengundangan": "tanggal_pengundangan",
    "pejabat pengundangan": "pejabat_pengundangan",
    "tentang": "tentang",
}

_INDO_MONTHS = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "agustus": 8,
    "september": 9, "oktober": 10, "november": 11, "desember": 12,
}

_STATUS_MAP = {
    "berlaku": "berlaku", "dicabut": "dicabut",
    "diubah": "diubah", "tidak berlaku": "tidak_berlaku",
}


def _parse_indo_date(text: str) -> str | None:
    """Parse '13 Januari 2026' → '2026-01-13'."""
    parts = text.strip().split()
    if len(parts) < 3:
        return None
    try:
        day = int(parts[0])
        month = _INDO_MONTHS.get(parts[1].lower())
        year = int(parts[2])
        if month and 1 <= day <= 31 and 1900 <= year <= 2100:
            return f"{year:04d}-{month:02d}-{day:02d}"
    except (ValueError, IndexError):
        pass
    return None


def _extract_metadata_from_soup(soup: BeautifulSoup) -> dict:
    """Extract metadata from detail page HTML table."""
    metadata: dict[str, str | None] = {}
    for row in soup.find_all("tr"):
        th = row.find("th")
        td = row.find("td")
        if not th or not td:
            continue
        label = th.get_text(strip=True).lower()
        value = td.get_text(strip=True)
        if not value:
            continue
        for key_prefix, column in _METADATA_LABEL_MAP.items():
            if key_prefix in label:
                if column in ("tanggal_penetapan", "tanggal_pengundangan"):
                    metadata[column] = _parse_indo_date(value)
                elif column == "status":
                    metadata[column] = _STATUS_MAP.get(value.lower(), "berlaku")
                else:
                    metadata[column] = value
                break
    return metadata

# Bump this when the parser changes significantly to trigger re-extraction.
# v1: original parser (sort_order * 100 per level — overflows bigint)
# v2: DFS counter sort_order (1, 2, 3, …) — no overflow possible
# v3: text-first parser — captures all text, preambles, OCR corrections
# v4: OCR on all PDFs, Roman Pasal fix, FRESIDEN/header stripping, PENJELASAN fallback
# v5: noise stripping (djpp, peraturan.go.id, file:///, timestamps), line rejoining,
#     metadata extraction from detail pages, type code mapping safety
EXTRACTION_VERSION = 5


async def _extract_pdf_url_from_detail_page(
    client: httpx.AsyncClient, detail_url: str
) -> tuple[str | None, dict, str | None]:
    """Fetch a regulation detail page and extract the real PDF URL + metadata.

    peraturan.go.id uses unpredictable PDF filenames (e.g. ps4-2022.pdf
    for perpres-no-4-tahun-2022), so we must scrape the detail page
    to find the actual download link.

    Returns (pdf_url, metadata_dict, error_reason).
    """
    def _absolute(href: str) -> str:
        return href if href.startswith("http") else f"https://peraturan.go.id{href}"

    try:
        resp = await client.get(detail_url, headers={
            **DEFAULT_HEADERS,
            "Accept": "text/html,application/xhtml+xml,*/*",
        })
        if resp.status_code != 200:
            return None, {}, f"HTTP {resp.status_code}"

        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract metadata from the detail page table
        metadata = _extract_metadata_from_soup(soup)

        # Strategy 1: look for "Dokumen Peraturan" row in metadata table
        for row in soup.find_all("tr"):
            th = row.find("th")
            td = row.find("td")
            if not th or not td:
                continue
            if "dokumen" in th.get_text(strip=True).lower():
                pdf_link = td.find("a", href=re.compile(r"\.pdf", re.IGNORECASE))
                if pdf_link:
                    return _absolute(pdf_link["href"]), metadata, None

        # Strategy 2: any <a> tag with .pdf or /files/ in href
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if href.endswith(".pdf") or "/files/" in href:
                return _absolute(href), metadata, None

        return None, metadata, "page loaded but no PDF link in HTML"

    except Exception as e:
        return None, {}, f"network error: {e}"


def _upload_to_storage(db, slug: str, pdf_bytes: bytes) -> str | None:
    """Upload PDF to Supabase Storage. Returns public URL or None on failure."""
    storage_path = f"{slug}.pdf"
    try:
        db.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            pdf_bytes,
            {"content-type": "application/pdf", "upsert": "true"},
        )
        return db.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
    except Exception as e:
        print(f"    Storage upload failed: {e}")
        return None


def _sha256(path: Path) -> str:
    """Compute SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _create_run(source_id: str | None) -> int:
    """Create a scraper_runs record and return its ID."""
    from crawler.state import _retry

    def _do():
        sb = get_sb()
        result = sb.table("scraper_runs").insert({
            "source_id": source_id or "all",
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return result.data[0]["id"]
    return _retry(_do, "create_run")


def _update_run(run_id: int, stats: dict, status: str = "completed", error: str | None = None) -> None:
    """Update a scraper_runs record with final stats. Never raises."""
    try:
        sb = get_sb()
        update = {
            "status": status,
            "jobs_processed": stats.get("processed", 0),
            "jobs_succeeded": stats.get("succeeded", 0),
            "jobs_failed": stats.get("failed", 0),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        if error:
            update["error_message"] = error[:500]
        sb.table("scraper_runs").update(update).eq("id", run_id).execute()
    except Exception as e:
        print(f"  WARNING: _update_run failed (non-fatal): {e}")


def _build_law_dict(job: dict, text: str, nodes: list, detail_metadata: dict | None = None) -> dict:
    """Build the law dict expected by load_to_supabase from job metadata."""
    reg_type = job.get("regulation_type", "UU")
    number = job.get("number", "")
    year = job.get("year", 0)
    title = job.get("title", f"{reg_type} {number}/{year}")
    frbr_uri = job.get("frbr_uri", f"/akn/id/act/{reg_type.lower()}/{year}/{number}")

    # Use status from detail page metadata if available, else default
    status = "berlaku"
    if detail_metadata and detail_metadata.get("status"):
        status = detail_metadata["status"]

    return {
        "frbr_uri": frbr_uri,
        "type": reg_type,
        "number": number,
        "year": year,
        "title_id": title,
        "status": status,
        "source_url": job.get("url"),
        "source_pdf_url": job.get("pdf_url"),
        "full_text": text,
        "nodes": nodes,
    }


def _extract_and_load(
    sb, job: dict, pdf_path: Path, detail_metadata: dict | None = None,
) -> tuple[int, int, int]:
    """Extract text from PDF, parse, and load to Supabase.

    Uses the text-first parser pipeline: extract → classify → OCR correct → parse.
    Returns (work_id, pasal_count, chunk_count).
    Raises on failure.
    """
    text, _ = extract_text_pymupdf(pdf_path)
    if not text or len(text) < 100:
        raise ValueError(f"PDF text too short ({len(text)} chars)")

    quality, _ = classify_pdf_quality(pdf_path)
    # OCR correction for all PDFs — even born_digital has font-encoding artifacts
    text = correct_ocr_errors(text)

    nodes = parse_structure(text)
    law = _build_law_dict(job, text, nodes, detail_metadata=detail_metadata)

    work_id = load_work(sb, law)
    if not work_id:
        raise ValueError("Failed to upsert work")

    cleanup_work_data(sb, work_id)
    pasal_nodes = load_nodes_by_level(sb, work_id, nodes)
    chunk_count = create_chunks(sb, work_id, law, pasal_nodes)

    return work_id, len(pasal_nodes), chunk_count


async def _download_pdf(
    client: httpx.AsyncClient,
    detail_url: str,
    stored_pdf_url: str | None,
    dest: Path,
) -> tuple[str, dict]:
    """Download a PDF by resolving its URL from the detail page.

    Tries the detail page first to find the real PDF URL, then falls
    back to the stored URL. Writes the PDF to dest.

    Returns (confirmed_pdf_url, detail_metadata).
    Raises ValueError if no valid PDF can be downloaded.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)

    attempt_errors: list[str] = []

    # Resolve the real PDF URL from the detail page.
    # peraturan.go.id uses unpredictable filenames, so guessing from slugs fails.
    print(f"    Fetching detail page: {detail_url}")
    real_pdf_url, detail_metadata, extract_err = await _extract_pdf_url_from_detail_page(client, detail_url)
    if real_pdf_url:
        print(f"    PDF URL from detail page: {real_pdf_url}")
    else:
        msg = f"detail_page({detail_url}): {extract_err}"
        print(f"    {msg}")
        attempt_errors.append(msg)

    # Build candidate list: detail page URL first, then stored URL as fallback
    candidates = [url for url in [real_pdf_url, stored_pdf_url] if url]
    # Deduplicate while preserving order
    candidates = list(dict.fromkeys(candidates))

    if not candidates:
        raise ValueError(
            f"No PDF URL found | detail_page: {detail_url} | stored: {stored_pdf_url}"
        )

    await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

    for attempt_url in candidates:
        try:
            resp = await client.get(attempt_url, headers=DEFAULT_HEADERS)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            msg = f"{attempt_url}: HTTP {e.response.status_code}"
            print(f"    {msg}")
            attempt_errors.append(msg)
            continue

        content_type = resp.headers.get("content-type", "")
        if "pdf" not in content_type and "octet-stream" not in content_type:
            msg = f"{attempt_url}: not a PDF (content-type: {content_type})"
            print(f"    {msg}")
            attempt_errors.append(msg)
            continue

        if len(resp.content) < 1000:
            msg = f"{attempt_url}: too small ({len(resp.content)} bytes)"
            print(f"    {msg}")
            attempt_errors.append(msg)
            continue

        dest.write_bytes(resp.content)
        print(f"    Downloaded {len(resp.content):,} bytes from {attempt_url}")
        return attempt_url, detail_metadata

    raise ValueError(
        f"PDF download failed | tried: {candidates} | errors: {attempt_errors}"
    )


async def process_jobs(
    source_id: str | None = None,
    batch_size: int = 20,
    max_runtime: int = 1500,
    run_id: int | None = None,
) -> dict:
    """Process pending crawl_jobs through the full pipeline.

    Uses atomic claim_pending_jobs() so multiple workers never get the same jobs.
    Downloads PDF (or uses cached copy), parses, loads to Supabase.
    Tracks PDF hash, size, and download timestamp for reproducibility.
    """
    stats = {"processed": 0, "succeeded": 0, "failed": 0, "skipped": 0}
    start_time = time.time()

    jobs = claim_pending_jobs(limit=batch_size)
    if not jobs:
        print("  No pending jobs found")
        return stats

    print(f"  Found {len(jobs)} pending jobs")

    sb = init_supabase()
    db = get_sb()

    ssl_ctx = create_ssl_context()
    transport = httpx.AsyncHTTPTransport(retries=3, verify=ssl_ctx)

    async with httpx.AsyncClient(timeout=60, transport=transport, follow_redirects=True) as client:
        for job in jobs:
            if time.time() - start_time > max_runtime:
                print(f"  Runtime limit reached ({max_runtime}s), stopping")
                break

            job_id = job["id"]
            slug = job.get("url", "").split("/")[-1] or f"job_{job_id}"
            detail_url = job.get("url", f"https://peraturan.go.id/id/{slug}")
            pdf_path = PDF_DIR / f"{slug}.pdf"

            print(f"\n  [{stats['processed']+1}/{len(jobs)}] Processing {slug}...")

            try:
                if run_id:
                    db.table("crawl_jobs").update({"run_id": run_id}).eq("id", job_id).execute()

                now = datetime.now(timezone.utc).isoformat()

                # 1. Download PDF (or use cached copy)
                detail_metadata: dict = {}
                if pdf_path.exists() and pdf_path.stat().st_size >= 1000:
                    existing_hash = job.get("pdf_hash")
                    local_hash = _sha256(pdf_path)
                    if existing_hash == local_hash:
                        print(f"    Using cached PDF (hash match: {local_hash[:12]}...)")
                    else:
                        print(f"    PDF exists locally, computing hash...")
                    # Still fetch metadata from detail page for cached PDFs
                    _, detail_metadata, _ = await _extract_pdf_url_from_detail_page(
                        client, detail_url,
                    )
                else:
                    confirmed_url, detail_metadata = await _download_pdf(
                        client, detail_url, job.get("pdf_url"), pdf_path,
                    )
                    local_hash = _sha256(pdf_path)

                    db.table("crawl_jobs").update({
                        "pdf_url": confirmed_url,
                        "updated_at": now,
                    }).eq("id", job_id).execute()

                # Store PDF metadata
                local_hash = _sha256(pdf_path)
                db.table("crawl_jobs").update({
                    "status": "downloaded",
                    "pdf_hash": local_hash,
                    "pdf_size": pdf_path.stat().st_size,
                    "pdf_downloaded_at": now,
                    "pdf_local_path": str(pdf_path),
                    "updated_at": now,
                }).eq("id", job_id).execute()

                # 1b. Upload PDF to Supabase Storage
                storage_url = _upload_to_storage(db, slug, pdf_path.read_bytes())
                if storage_url:
                    print(f"    Uploaded to storage: {slug}.pdf")

                # 2. Extract, parse, load
                work_id, pasal_count, chunk_count = _extract_and_load(
                    sb, job, pdf_path, detail_metadata=detail_metadata,
                )

                # 2b. Update works with detail page metadata
                if detail_metadata and work_id:
                    update_fields = {k: v for k, v in detail_metadata.items() if v is not None}
                    if slug:
                        update_fields["slug"] = slug
                    if update_fields:
                        try:
                            db.table("works").update(update_fields).eq("id", work_id).execute()
                            print(f"    Metadata: {', '.join(update_fields.keys())}")
                        except Exception as e:
                            print(f"    Warning: metadata update failed: {e}")

                # 3. Mark as loaded with extraction version + storage URL
                loaded_update: dict = {
                    "status": "loaded",
                    "work_id": work_id,
                    "extraction_version": EXTRACTION_VERSION,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if storage_url:
                    loaded_update["pdf_storage_url"] = storage_url
                db.table("crawl_jobs").update(loaded_update).eq("id", job_id).execute()

                stats["succeeded"] += 1
                print(f"    OK: {pasal_count} pasals, {chunk_count} chunks, hash={local_hash[:12]}...")

            except httpx.HTTPStatusError as e:
                error_msg = f"HTTP {e.response.status_code}"
                update_status(job_id, "failed", error_msg)
                stats["failed"] += 1
                print(f"    FAIL: {error_msg}")

            except Exception as e:
                update_status(job_id, "failed", str(e)[:1000])
                stats["failed"] += 1
                print(f"    FAIL: {e}")

            stats["processed"] += 1
            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

    return stats


def _download_from_storage(db, slug: str, dest: Path) -> bool:
    """Download PDF from Supabase Storage to local path. Returns True on success."""
    try:
        data = db.storage.from_(STORAGE_BUCKET).download(f"{slug}.pdf")
        if data and len(data) > 1000:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return True
    except Exception as e:
        print(f"    Storage download failed: {e}")
    return False


def reprocess_jobs(
    batch_size: int = 50,
    force: bool = False,
) -> dict:
    """Re-extract and reload from PDFs (local cache or Supabase Storage).

    Finds jobs that are 'loaded' or 'parsed' and have an outdated
    extraction_version, then re-runs the extraction pipeline.
    Downloads PDFs from Supabase Storage when local files are missing
    (e.g. after Railway container restart).

    Args:
        batch_size: Max jobs to reprocess.
        force: If True, reprocess all loaded jobs. If False, only reprocess
               jobs with extraction_version < EXTRACTION_VERSION.
    """
    stats = {"processed": 0, "succeeded": 0, "failed": 0, "skipped": 0}
    db = get_sb()
    sb = init_supabase()

    # Find loaded jobs needing re-extraction
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

        # Try to find the PDF: local cache first, then Supabase Storage
        if pdf_local:
            pdf_path = Path(pdf_local)
        else:
            pdf_path = PDF_DIR / f"{slug}.pdf"

        if not pdf_path.exists():
            print(f"  [{stats['processed']+1}/{len(jobs)}] {slug}: downloading from storage...")
            if not _download_from_storage(db, slug, pdf_path):
                print(f"    PDF not in storage either, skipping")
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
