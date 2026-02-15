"""One-off local script to process UUD 1945 (3 PDFs) and load into Supabase.

Does NOT touch crawl_jobs — completely independent of the scraper-worker.

Usage:
    python scripts/load_uud.py
    python scripts/load_uud.py --dry-run   # Parse only, don't load
    python scripts/load_uud.py --upload     # Also upload PDFs + page images to Supabase Storage
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))

from parser.extract_pymupdf import extract_text_pymupdf
from parser.ocr_correct import correct_ocr_errors
from parser.parse_structure import parse_structure, count_pasals
from loader.load_to_supabase import (
    init_supabase, load_work, cleanup_work_data,
    load_nodes_by_level,
)

PDF_DIR = Path(__file__).parent.parent / "data" / "raw" / "pdfs"

# Explicit metadata for each UUD work — bypasses filename-based detection
UUD_ENTRIES = [
    {
        "slug": "uud-1945",
        "pdf": "uud-1945.pdf",
        "metadata": {
            "type": "UUD",
            "number": "1945",
            "year": 1945,
            "frbr_uri": "/akn/id/act/uud/1945/original",
            "title_id": "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
            "status": "berlaku",
            "slug": "uud-1945",
        },
    },
    {
        "slug": "uud-1945-perubahan-pertama",
        "pdf": "uud-1945-perubahan-pertama.pdf",
        "metadata": {
            "type": "UUD",
            "number": "1945/P1",
            "year": 1945,
            "frbr_uri": "/akn/id/act/uud/1945/perubahan-1",
            "title_id": "Perubahan Pertama Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
            "status": "berlaku",
            "slug": "uud-1945-perubahan-pertama",
        },
    },
    {
        "slug": "uud-1945-perubahan-kedua",
        "pdf": "uud-1945-perubahan-kedua.pdf",
        "metadata": {
            "type": "UUD",
            "number": "1945/P2",
            "year": 1945,
            "frbr_uri": "/akn/id/act/uud/1945/perubahan-2",
            "title_id": "Perubahan Kedua Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
            "status": "berlaku",
            "slug": "uud-1945-perubahan-kedua",
        },
    },
]

# Amendment relationships between the 3 works
UUD_RELATIONSHIPS = [
    ("/akn/id/act/uud/1945/perubahan-1", "/akn/id/act/uud/1945/original", "mengubah"),
    ("/akn/id/act/uud/1945/original", "/akn/id/act/uud/1945/perubahan-1", "diubah_oleh"),
    ("/akn/id/act/uud/1945/perubahan-2", "/akn/id/act/uud/1945/original", "mengubah"),
    ("/akn/id/act/uud/1945/original", "/akn/id/act/uud/1945/perubahan-2", "diubah_oleh"),
]


def process_pdf(pdf_path: Path, metadata: dict) -> dict | None:
    """Extract text from PDF, correct OCR errors, parse structure.

    Returns a law dict compatible with load_work, or None on failure.
    """
    text, stats = extract_text_pymupdf(pdf_path)
    if not text or stats.get("error"):
        print(f"  Extract failed: {stats.get('error', 'empty text')}")
        return None

    print(f"  Extracted: {stats['page_count']} pages, {stats['char_count']} chars")

    text = correct_ocr_errors(text)
    nodes = parse_structure(text)
    pasal_count = count_pasals(nodes)
    print(f"  Parsed: {len(nodes)} top-level nodes, {pasal_count} pasals")

    return {
        **metadata,
        "nodes": nodes,
        "full_text": text,
        "source_url": "https://peraturan.go.id/id/uud-1945",
    }


def render_page_images(sb, pdf_path: Path, slug: str) -> int:
    """Render each PDF page as PNG and upload to Supabase Storage."""
    import pymupdf

    bucket = sb.storage.from_("regulation-pdfs")
    doc = pymupdf.open(str(pdf_path))
    count = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=150)
        png_bytes = pix.tobytes("png")

        storage_path = f"{slug}/page-{page_num + 1}.png"
        try:
            bucket.upload(
                storage_path, png_bytes,
                {"content-type": "image/png", "upsert": "true"},
            )
            count += 1
        except Exception as e:
            print(f"  Page image upload error ({storage_path}): {e}")

    doc.close()
    print(f"  Uploaded {count} page images for {slug}")
    return count


def insert_relationships(sb) -> int:
    """Insert work_relationships for the 3 UUD works."""
    rel_result = sb.table("relationship_types").select("id, code").execute()
    rel_map = {r["code"]: r["id"] for r in rel_result.data}

    count = 0
    for source_uri, target_uri, rel_code in UUD_RELATIONSHIPS:
        rel_type_id = rel_map.get(rel_code)
        if not rel_type_id:
            print(f"  Warning: relationship type '{rel_code}' not found")
            continue

        src = sb.table("works").select("id").eq("frbr_uri", source_uri).execute()
        tgt = sb.table("works").select("id").eq("frbr_uri", target_uri).execute()
        if not src.data or not tgt.data:
            print(f"  Warning: works not found for {source_uri} -> {target_uri}")
            continue

        try:
            sb.table("work_relationships").upsert(
                {
                    "source_work_id": src.data[0]["id"],
                    "target_work_id": tgt.data[0]["id"],
                    "relationship_type_id": rel_type_id,
                    "notes": "UUD 1945 amendment relationship",
                },
                on_conflict="source_work_id,target_work_id,relationship_type_id",
            ).execute()
            count += 1
        except Exception as e:
            print(f"  Error inserting {rel_code}: {e}")

    return count


def upload_pdfs(sb) -> int:
    """Upload UUD PDFs to Supabase Storage and update source_pdf_url."""
    bucket = sb.storage.from_("regulation-pdfs")
    count = 0
    for entry in UUD_ENTRIES:
        pdf_path = PDF_DIR / entry["pdf"]
        if not pdf_path.exists():
            print(f"  Missing: {pdf_path}")
            continue
        slug = entry["slug"]
        try:
            with open(pdf_path, "rb") as f:
                bucket.upload(
                    f"{slug}.pdf", f.read(),
                    {"content-type": "application/pdf", "upsert": "true"},
                )
            print(f"  Uploaded: {slug}.pdf ({pdf_path.stat().st_size:,} bytes)")
            count += 1

            # Set source_pdf_url so the web UI shows the PDF viewer
            public_url = bucket.get_public_url(f"{slug}.pdf")
            sb.table("works").update(
                {"source_pdf_url": public_url}
            ).eq("frbr_uri", entry["metadata"]["frbr_uri"]).execute()
            print(f"  Set source_pdf_url for {slug}")
        except Exception as e:
            print(f"  Upload error for {slug}: {e}")
    return count


def main():
    parser = argparse.ArgumentParser(description="Process and load UUD 1945 into Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't load to DB")
    parser.add_argument("--upload", action="store_true", help="Upload PDFs + page images to Supabase Storage")
    args = parser.parse_args()

    print("=== Processing UUD 1945 (3 documents) ===\n")

    results = []
    for entry in UUD_ENTRIES:
        pdf_path = PDF_DIR / entry["pdf"]
        print(f"--- {entry['slug']} ---")

        if not pdf_path.exists():
            print(f"  PDF not found: {pdf_path}")
            continue

        result = process_pdf(pdf_path, metadata=entry["metadata"])
        if not result:
            print(f"  FAILED to parse")
            continue

        result["slug"] = entry["slug"]
        results.append((entry, result))

    print(f"\n=== Parsed {len(results)}/3 documents ===")

    if args.dry_run:
        print("(dry-run mode — skipping DB load)")
        return

    if not results:
        print("Nothing to load")
        return

    # Load into DB
    print("\n=== Loading into Supabase ===")
    sb = init_supabase()
    work_ids = []

    for entry, result in results:
        print(f"\nLoading {entry['slug']}...")

        work_id = load_work(sb, result)
        if not work_id:
            print(f"  FAILED to insert work")
            continue

        # Clean old data and reload
        cleanup_work_data(sb, work_id)

        nodes = result.get("nodes", [])
        pasal_nodes = load_nodes_by_level(sb, work_id, nodes)
        print(f"  Inserted {len(pasal_nodes)} content nodes")

        work_ids.append(work_id)
        print(f"  OK: work_id={work_id}")

    # Insert relationships
    if len(work_ids) == 3:
        print("\n=== Inserting relationships ===")
        rel_count = insert_relationships(sb)
        print(f"  Inserted {rel_count} relationships")

    # Upload PDFs and page images to storage
    if args.upload and work_ids:
        print("\n=== Uploading PDFs to Supabase Storage ===")
        upload_count = upload_pdfs(sb)
        print(f"  Uploaded {upload_count} PDFs")

        print("\n=== Rendering page images ===")
        for entry in UUD_ENTRIES:
            pdf_path = PDF_DIR / entry["pdf"]
            if pdf_path.exists():
                render_page_images(sb, pdf_path, entry["slug"])

    print(f"\n=== Done: {len(work_ids)} works loaded, UUD 1945 is live ===")


if __name__ == "__main__":
    main()
