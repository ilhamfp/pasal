"""One-off local script to process UUD 1945 (3 PDFs) and load into Supabase.

Does NOT touch crawl_jobs — completely independent of the scraper-worker.

Usage:
    python scripts/load_uud.py
    python scripts/load_uud.py --dry-run   # Parse only, don't load
    python scripts/load_uud.py --upload     # Also upload PDFs to Supabase Storage
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

sys.path.insert(0, str(Path(__file__).parent / "parser"))
sys.path.insert(0, str(Path(__file__).parent / "loader"))

from parser.pipeline import process_pdf, load_to_db

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
    """Upload UUD PDFs to Supabase Storage."""
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
        except Exception as e:
            print(f"  Upload error for {slug}: {e}")
    return count


def main():
    parser = argparse.ArgumentParser(description="Process and load UUD 1945 into Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't load to DB")
    parser.add_argument("--upload", action="store_true", help="Upload PDFs to Supabase Storage")
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

        # Override source URLs with correct values
        result["slug"] = entry["slug"]
        result["source_url"] = "https://peraturan.go.id/id/uud-1945"
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
    work_ids = []
    for entry, result in results:
        print(f"\nLoading {entry['slug']}...")
        work_id = load_to_db(result)
        if work_id:
            work_ids.append(work_id)
            print(f"  OK: work_id={work_id}")
        else:
            print(f"  FAILED to load")

    # Insert relationships
    if len(work_ids) == 3:
        print("\n=== Inserting relationships ===")
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        rel_count = insert_relationships(sb)
        print(f"  Inserted {rel_count} relationships")

    # Upload PDFs to storage
    if args.upload and work_ids:
        print("\n=== Uploading PDFs to Supabase Storage ===")
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        upload_count = upload_pdfs(sb)
        print(f"  Uploaded {upload_count} PDFs")

    print(f"\n=== Done: {len(work_ids)} works loaded, UUD 1945 is live ===")


if __name__ == "__main__":
    main()
