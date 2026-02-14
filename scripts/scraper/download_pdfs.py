"""Download PDFs from peraturan.go.id and generate page images.

Downloads regulation PDFs, generates page images with PyMuPDF,
and optionally uploads to Supabase Storage.

Usage:
    python download_pdfs.py --input data/raw/slugs.jsonl --limit 20
    python download_pdfs.py --slugs uu-no-13-tahun-2003
    python download_pdfs.py --input data/raw/slugs.jsonl --upload
    python download_pdfs.py  # Legacy mode: reads from data/raw/peraturan-go-id/
"""
import argparse
import asyncio
import json
import os
import ssl
from pathlib import Path

import httpx

BASE_URL = "https://peraturan.go.id"
DATA_DIR = Path(__file__).parent.parent.parent / "data"
RAW_DIR = DATA_DIR / "raw" / "peraturan-go-id"
PDF_DIR = DATA_DIR / "raw" / "pdfs"
IMAGES_DIR = DATA_DIR / "raw" / "page_images"

HEADERS = {
    "User-Agent": "Pasal/1.0 (https://pasal.id; legal-data-research)",
    "Accept": "application/pdf,*/*",
}


def _pdf_url_for_slug(slug: str) -> list[str]:
    """Generate candidate PDF URLs for a slug."""
    clean = slug.replace("-", "")
    return [
        f"{BASE_URL}/files/{slug}.pdf",
        f"{BASE_URL}/files/{clean}.pdf",
    ]


def generate_page_images(pdf_path: Path, output_dir: Path, dpi: int = 150) -> int:
    """Generate .png page images from a PDF using PyMuPDF. Returns page count."""
    try:
        import pymupdf
    except ImportError:
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        doc = pymupdf.open(str(pdf_path))
        count = 0
        for page_num in range(len(doc)):
            out_path = output_dir / f"page-{page_num + 1}.png"
            if out_path.exists():
                count += 1
                continue
            page = doc[page_num]
            zoom = dpi / 72
            mat = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            pix.save(str(out_path))
            count += 1
        doc.close()
        return count
    except Exception as e:
        print(f"  Error generating images: {e}")
        return 0


async def upload_to_storage(pdf_path: Path, images_dir: Path, slug: str) -> bool:
    """Upload PDF and page images to Supabase Storage."""
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).parent.parent / ".env")
        from supabase import create_client

        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        sb = create_client(url, key)
        bucket = sb.storage.from_("regulation-pdfs")

        with open(pdf_path, "rb") as f:
            bucket.upload(f"{slug}.pdf", f.read(), {"content-type": "application/pdf", "upsert": "true"})

        if images_dir.exists():
            for img_path in sorted(images_dir.glob("*.png")):
                with open(img_path, "rb") as f:
                    bucket.upload(f"{slug}/{img_path.name}", f.read(), {"content-type": "image/png", "upsert": "true"})
        return True
    except Exception as e:
        print(f"  Upload error: {e}")
        return False


async def download_pdfs(
    slugs: list[dict],
    rate_limit: float = 1.0,
    skip_existing: bool = True,
    gen_images: bool = True,
    upload: bool = False,
) -> dict:
    """Download PDFs and optionally generate page images."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    stats = {"downloaded": 0, "skipped": 0, "errors": 0, "images_generated": 0}

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    transport = httpx.AsyncHTTPTransport(retries=3, verify=ctx)
    async with httpx.AsyncClient(
        timeout=60, follow_redirects=True, headers=HEADERS, transport=transport,
    ) as client:
        for i, entry in enumerate(slugs):
            slug = entry["slug"] if isinstance(entry, dict) else entry
            pdf_path = PDF_DIR / f"{slug}.pdf"

            if skip_existing and pdf_path.exists() and pdf_path.stat().st_size > 1000:
                stats["skipped"] += 1
                if gen_images:
                    img_dir = IMAGES_DIR / slug
                    if not img_dir.exists() or not list(img_dir.glob("*.png")):
                        count = generate_page_images(pdf_path, img_dir)
                        stats["images_generated"] += count
                continue

            if i > 0:
                await asyncio.sleep(rate_limit)

            urls = _pdf_url_for_slug(slug)
            if isinstance(entry, dict) and "pdf_url" in entry:
                urls.insert(0, entry["pdf_url"])

            downloaded = False
            for url in urls:
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200 and len(resp.content) > 1000:
                        pdf_path.write_bytes(resp.content)
                        stats["downloaded"] += 1
                        downloaded = True
                        break
                except Exception:
                    continue

            if not downloaded:
                stats["errors"] += 1
                continue

            if gen_images:
                img_dir = IMAGES_DIR / slug
                count = generate_page_images(pdf_path, img_dir)
                stats["images_generated"] += count

            if upload:
                img_dir = IMAGES_DIR / slug
                await upload_to_storage(pdf_path, img_dir, slug)

            if (i + 1) % 10 == 0:
                print(f"  [{i+1}/{len(slugs)}] {stats['downloaded']} downloaded, {stats['errors']} errors")

    print(f"\n=== PDFs: {stats['downloaded']} new, {stats['skipped']} skipped, {stats['errors']} errors ===")
    print(f"    Page images: {stats['images_generated']}")
    return stats


def _load_legacy_slugs() -> list[dict]:
    """Load slugs from legacy peraturan-go-id metadata files."""
    slugs = []
    if RAW_DIR.exists():
        for f in sorted(RAW_DIR.glob("*.json")):
            with open(f) as fh:
                data = json.load(fh)
                slugs.append({
                    "slug": data.get("slug", f.stem),
                    "pdf_url": data.get("pdf_url"),
                })
    return slugs


def main():
    parser = argparse.ArgumentParser(description="Download PDFs from peraturan.go.id")
    parser.add_argument("--input", type=str, help="Input JSONL file")
    parser.add_argument("--slugs", type=str, help="Comma-separated slugs")
    parser.add_argument("--limit", type=int, help="Max PDFs to download")
    parser.add_argument("--rate-limit", type=float, default=1.0, help="Seconds between downloads")
    parser.add_argument("--no-images", action="store_true", help="Skip page image generation")
    parser.add_argument("--upload", action="store_true", help="Upload to Supabase Storage")
    parser.add_argument("--force", action="store_true", help="Re-download existing PDFs")
    args = parser.parse_args()

    if args.slugs:
        slugs = [{"slug": s.strip()} for s in args.slugs.split(",")]
    elif args.input:
        slugs = []
        input_path = Path(args.input)
        if input_path.exists():
            with open(input_path) as f:
                for line in f:
                    try:
                        slugs.append(json.loads(line))
                    except Exception:
                        pass
        else:
            print(f"Input file not found: {input_path}")
            return
    else:
        # Legacy mode: read from peraturan-go-id directory
        slugs = _load_legacy_slugs()

    if args.limit:
        slugs = slugs[:args.limit]

    if not slugs:
        print("No slugs to process")
        return

    print(f"Processing {len(slugs)} PDFs...")
    asyncio.run(download_pdfs(
        slugs,
        rate_limit=args.rate_limit,
        skip_existing=not args.force,
        gen_images=not args.no_images,
        upload=args.upload,
    ))


if __name__ == "__main__":
    main()
