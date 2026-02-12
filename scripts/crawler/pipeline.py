"""Crawl pipeline: download, parse, load."""
import asyncio
import os
from pathlib import Path

import httpx

from .config import DEFAULT_HEADERS, DELAY_BETWEEN_REQUESTS, PDF_STORAGE_DIR
from .state import get_pending_jobs, update_status


async def download_pdf(client: httpx.AsyncClient, pdf_url: str, save_path: str) -> str:
    """Download a PDF file. Returns the local file path."""
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    resp = await client.get(pdf_url, headers=DEFAULT_HEADERS, follow_redirects=True)
    resp.raise_for_status()
    with open(save_path, "wb") as f:
        f.write(resp.content)
    return save_path


async def run_pipeline(source_id: str | None = None, limit: int = 10) -> dict:
    """Process pending crawl jobs: download PDFs."""
    jobs = get_pending_jobs(source_id=source_id, limit=limit)
    stats = {"total": len(jobs), "downloaded": 0, "failed": 0}

    async with httpx.AsyncClient(timeout=30) as client:
        for job in jobs:
            job_id = job["id"]
            pdf_url = job.get("pdf_url")
            if not pdf_url:
                update_status(job_id, "failed", "No PDF URL")
                stats["failed"] += 1
                continue

            try:
                update_status(job_id, "crawling")
                filename = f"{job['source_id']}_{job_id}.pdf"
                save_path = os.path.join(PDF_STORAGE_DIR, filename)
                await download_pdf(client, pdf_url, save_path)
                update_status(job_id, "downloaded")
                stats["downloaded"] += 1
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
            except Exception as e:
                update_status(job_id, "failed", str(e))
                stats["failed"] += 1

    return stats
