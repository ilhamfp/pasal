"""Map pasal numbers to PDF page numbers.

Scans each PDF page for 'Pasal X' headers and updates
document_nodes.pdf_page_start / pdf_page_end accordingly.

Usage:
    python map_pdf_pages.py              # Process all works
    python map_pdf_pages.py --work-id 1  # Process a single work
"""
import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

PDF_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "pdfs"

# Same regex as parse_structure.py line 24
PASAL_RE = re.compile(r'^Pasal\s+(\d+[A-Z]?)\s*$', re.MULTILINE)


def scan_pdf_for_pasals(pdf_path: Path) -> tuple[dict[str, int], int]:
    """Scan a PDF and return {pasal_number: first_page_seen (1-indexed)}."""
    import pymupdf

    pasal_pages: dict[str, int] = {}
    try:
        doc = pymupdf.open(str(pdf_path))
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text("text")
            for m in PASAL_RE.finditer(text):
                pasal_num = m.group(1)
                if pasal_num not in pasal_pages:
                    pasal_pages[pasal_num] = page_idx + 1  # 1-indexed
        total_pages = len(doc)
        doc.close()
        return pasal_pages, total_pages
    except Exception as e:
        print(f"  Error scanning {pdf_path}: {e}")
        return {}, 0


def compute_page_ranges(pasal_pages: dict[str, int], total_pages: int) -> dict[str, tuple[int, int]]:
    """Compute (pdf_page_start, pdf_page_end) for each pasal."""
    if not pasal_pages:
        return {}

    # Sort pasals by their first page appearance
    sorted_pasals = sorted(pasal_pages.items(), key=lambda x: x[1])
    ranges: dict[str, tuple[int, int]] = {}

    for i, (pasal_num, start_page) in enumerate(sorted_pasals):
        if i + 1 < len(sorted_pasals):
            next_start = sorted_pasals[i + 1][1]
            # End page is the page before the next pasal starts,
            # but at minimum the same as start_page
            end_page = max(start_page, next_start - 1) if next_start > start_page else start_page
        else:
            end_page = total_pages
        ranges[pasal_num] = (start_page, end_page)

    return ranges


def update_document_nodes(work_id: int, ranges: dict[str, tuple[int, int]]) -> int:
    """Update pdf_page_start/end for pasal nodes of a work. Returns count updated."""
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    sb = create_client(url, key)

    # Get pasal nodes for this work
    resp = sb.table("document_nodes").select("id, number").eq("work_id", work_id).eq("node_type", "pasal").execute()
    nodes = resp.data or []

    updated = 0
    for node in nodes:
        pasal_num = node["number"]
        if pasal_num in ranges:
            start, end = ranges[pasal_num]
            sb.table("document_nodes").update({
                "pdf_page_start": start,
                "pdf_page_end": end,
            }).eq("id", node["id"]).execute()
            updated += 1

    return updated


def get_works() -> list[dict]:
    """Get all works from database."""
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    sb = create_client(url, key)

    resp = sb.table("works").select("id, slug, number, year").order("id").execute()
    return resp.data or []


def main():
    parser = argparse.ArgumentParser(description="Map pasals to PDF pages")
    parser.add_argument("--work-id", type=int, help="Process a single work by ID")
    args = parser.parse_args()

    works = get_works()
    if args.work_id:
        works = [w for w in works if w["id"] == args.work_id]

    if not works:
        print("No works to process")
        return

    total_updated = 0
    total_mapped = 0

    for w in works:
        slug = w.get("slug") or f"uu-{w['number']}-{w['year']}"
        pdf_path = PDF_DIR / f"{slug}.pdf"

        if not pdf_path.exists():
            print(f"  [{w['id']}] {slug}: PDF not found, skipping")
            continue

        pasal_pages, total_pages = scan_pdf_for_pasals(pdf_path)
        if not pasal_pages:
            print(f"  [{w['id']}] {slug}: no pasals found in PDF ({total_pages} pages)")
            continue

        ranges = compute_page_ranges(pasal_pages, total_pages)
        updated = update_document_nodes(w["id"], ranges)
        total_mapped += len(ranges)
        total_updated += updated
        print(f"  [{w['id']}] {slug}: found {len(pasal_pages)} pasals in PDF, updated {updated} nodes")

    print(f"\nDone! Mapped {total_mapped} pasals, updated {total_updated} document_nodes")


if __name__ == "__main__":
    main()
