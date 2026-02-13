"""Populate PDF data for all works in the database.

Queries works from Supabase, downloads PDFs, generates page images,
and uploads everything to Supabase Storage.

Usage:
    python populate_pdf_data.py          # Process all works
    python populate_pdf_data.py --limit 5  # Process first 5 works
    python populate_pdf_data.py --force   # Re-download existing PDFs
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load env from scripts/.env or root .env
env_path = Path(__file__).parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

# Add parent dirs to path so we can import download_pdfs
sys.path.insert(0, str(Path(__file__).parent))
from download_pdfs import download_pdfs, generate_page_images, upload_to_storage, PDF_DIR, IMAGES_DIR


def get_works_from_db() -> list[dict]:
    """Fetch all works with source_pdf_url from Supabase."""
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    sb = create_client(url, key)

    resp = sb.table("works").select("id, slug, number, year, source_pdf_url").order("id").execute()
    works = resp.data or []
    print(f"Found {len(works)} works in database")
    return works


def works_to_slugs(works: list[dict]) -> list[dict]:
    """Convert works to the slug format expected by download_pdfs."""
    slugs = []
    for w in works:
        slug = w.get("slug")
        if not slug:
            slug = f"uu-{w['number']}-{w['year']}"

        entry = {"slug": slug}
        if w.get("source_pdf_url"):
            entry["pdf_url"] = w["source_pdf_url"]

        slugs.append(entry)
    return slugs


async def main():
    parser = argparse.ArgumentParser(description="Populate PDF data for all DB works")
    parser.add_argument("--limit", type=int, help="Max works to process")
    parser.add_argument("--force", action="store_true", help="Re-download existing PDFs")
    parser.add_argument("--no-upload", action="store_true", help="Skip uploading to storage")
    parser.add_argument("--rate-limit", type=float, default=1.0, help="Seconds between downloads")
    args = parser.parse_args()

    works = get_works_from_db()
    slugs = works_to_slugs(works)

    if args.limit:
        slugs = slugs[: args.limit]

    if not slugs:
        print("No works to process")
        return

    print(f"Processing {len(slugs)} works...")
    for s in slugs[:5]:
        print(f"  {s['slug']} -> {s.get('pdf_url', 'no url')}")
    if len(slugs) > 5:
        print(f"  ... and {len(slugs) - 5} more")

    stats = await download_pdfs(
        slugs,
        rate_limit=args.rate_limit,
        skip_existing=not args.force,
        gen_images=True,
        upload=not args.no_upload,
    )

    print(f"\nDone! Stats: {stats}")

    # Also upload any that were skipped (already downloaded but not uploaded)
    if not args.no_upload:
        print("\nUploading any previously-downloaded PDFs that weren't uploaded...")
        uploaded = 0
        for entry in slugs:
            slug = entry["slug"]
            pdf_path = PDF_DIR / f"{slug}.pdf"
            img_dir = IMAGES_DIR / slug
            if pdf_path.exists():
                # Generate images if missing
                if not img_dir.exists() or not list(img_dir.glob("*.png")):
                    count = generate_page_images(pdf_path, img_dir)
                    print(f"  Generated {count} images for {slug}")
                success = await upload_to_storage(pdf_path, img_dir, slug)
                if success:
                    uploaded += 1
                    print(f"  Uploaded {slug} ({len(list(img_dir.glob('*.png')))} pages)")
        print(f"Uploaded {uploaded} total PDFs+images to storage")


if __name__ == "__main__":
    asyncio.run(main())
