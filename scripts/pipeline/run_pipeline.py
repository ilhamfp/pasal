"""End-to-end pipeline: scrape → download → parse → load.

Usage:
    python scripts/pipeline/run_pipeline.py --laws uu-no-1-tahun-2024,uu-no-2-tahun-2024
    python scripts/pipeline/run_pipeline.py --all-uu --year-from 2020 --year-to 2024
    python scripts/pipeline/run_pipeline.py --parse-only
    python scripts/pipeline/run_pipeline.py --load-only
"""
import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Setup paths
SCRIPTS_DIR = Path(__file__).parent.parent
ROOT_DIR = SCRIPTS_DIR.parent
DATA_DIR = ROOT_DIR / "data"
PDF_DIR = DATA_DIR / "raw" / "pdfs"
RAW_DIR = DATA_DIR / "raw" / "peraturan-go-id"
PARSED_DIR = DATA_DIR / "parsed"

sys.path.insert(0, str(SCRIPTS_DIR / "scraper"))
sys.path.insert(0, str(SCRIPTS_DIR / "parser"))
sys.path.insert(0, str(SCRIPTS_DIR / "loader"))

from dotenv import load_dotenv
load_dotenv(SCRIPTS_DIR / ".env")


def generate_uu_slugs(year_from: int, year_to: int, max_number: int = 50) -> list[str]:
    """Generate UU slug list for a year range."""
    slugs = []
    for year in range(year_from, year_to + 1):
        for num in range(1, max_number + 1):
            slugs.append(f"uu-no-{num}-tahun-{year}")
    return slugs


async def step_scrape(slugs: list[str]) -> list[dict]:
    """Scrape law pages from peraturan.go.id."""
    import httpx
    from bs4 import BeautifulSoup

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    BASE_URL = "https://peraturan.go.id"
    results = []

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers={"User-Agent": "Pasal.id Research Bot (pasal.id)"},
    ) as client:
        for i, slug in enumerate(slugs):
            outfile = RAW_DIR / f"{slug}.json"
            if outfile.exists():
                print(f"  [{i+1}/{len(slugs)}] {slug}: already scraped")
                with open(outfile) as f:
                    results.append(json.load(f))
                continue

            url = f"{BASE_URL}/id/{slug}"
            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    print(f"  [{i+1}/{len(slugs)}] {slug}: HTTP {resp.status_code}, skipping")
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                title_el = soup.select_one("h1, .judul, .title, h2")
                title = title_el.get_text(strip=True) if title_el else slug

                # Find PDF link
                pdf_link = soup.select_one('a[href*=".pdf"], a[href*="download"]')
                pdf_url = pdf_link["href"] if pdf_link else None
                if pdf_url and not pdf_url.startswith("http"):
                    pdf_url = BASE_URL + pdf_url

                result = {
                    "slug": slug,
                    "title_id": title,
                    "source_url": url,
                    "pdf_url": pdf_url,
                }
                with open(outfile, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                results.append(result)
                print(f"  [{i+1}/{len(slugs)}] {slug}: OK")

            except Exception as e:
                print(f"  [{i+1}/{len(slugs)}] {slug}: ERROR {e}")

            await asyncio.sleep(1.5)

    return results


async def step_download(scraped: list[dict]) -> list[Path]:
    """Download PDFs for scraped laws."""
    import httpx

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    downloaded = []

    async with httpx.AsyncClient(
        timeout=60,
        follow_redirects=True,
        headers={"User-Agent": "Pasal.id Research Bot (pasal.id)"},
    ) as client:
        for i, law in enumerate(scraped):
            pdf_url = law.get("pdf_url")
            slug = law.get("slug", "unknown")
            outfile = PDF_DIR / f"{slug}.pdf"

            if outfile.exists() and outfile.stat().st_size > 1000:
                print(f"  [{i+1}/{len(scraped)}] {slug}: already downloaded")
                downloaded.append(outfile)
                continue

            if not pdf_url:
                print(f"  [{i+1}/{len(scraped)}] {slug}: no PDF URL")
                continue

            try:
                resp = await client.get(pdf_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(outfile, "wb") as f:
                        f.write(resp.content)
                    downloaded.append(outfile)
                    print(f"  [{i+1}/{len(scraped)}] {slug}: {len(resp.content)} bytes")
                else:
                    print(f"  [{i+1}/{len(scraped)}] {slug}: FAIL status={resp.status_code}")
            except Exception as e:
                print(f"  [{i+1}/{len(scraped)}] {slug}: ERROR {e}")

            await asyncio.sleep(1.5)

    return downloaded


def step_parse(pdf_files: list[Path] | None = None) -> list[Path]:
    """Parse PDFs into structured JSON."""
    from parse_law import parse_single_law

    PARSED_DIR.mkdir(parents=True, exist_ok=True)

    if pdf_files is None:
        pdf_files = sorted(PDF_DIR.glob("*.pdf"))

    parsed_files = []
    for i, pdf_path in enumerate(pdf_files):
        print(f"  [{i+1}/{len(pdf_files)}] Parsing {pdf_path.name}...")
        try:
            result = parse_single_law(pdf_path)
            if result:
                safe_uri = result["frbr_uri"].replace("/", "_").lstrip("_")
                outfile = PARSED_DIR / f"{safe_uri}.json"
                with open(outfile, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                parsed_files.append(outfile)
                print(f"    {result['stats']['pasal_count']} pasals")
            else:
                print(f"    No result (metadata or text extraction failed)")
        except Exception as e:
            print(f"    ERROR: {e}")

    return parsed_files


def step_load(json_files: list[Path] | None = None, force: bool = False) -> int:
    """Load parsed JSON into Supabase."""
    from load_to_supabase import (
        init_supabase, load_work, load_nodes_recursive,
        create_chunks, cleanup_work_data, insert_relationships,
        _load_progress, _save_progress,
    )

    sb = init_supabase()

    if json_files is None:
        json_files = sorted(PARSED_DIR.glob("*.json"))

    loaded_uris = set() if force else _load_progress()
    loaded_count = 0

    for i, jf in enumerate(json_files):
        try:
            with open(jf) as f:
                law = json.load(f)

            frbr_uri = law.get("frbr_uri", "")
            if frbr_uri in loaded_uris and not force:
                continue

            print(f"  [{i+1}/{len(json_files)}] Loading {jf.name}...")
            work_id = load_work(sb, law)
            if not work_id:
                print(f"    SKIP: failed to insert work")
                continue

            cleanup_work_data(sb, work_id)
            nodes = law.get("nodes", [])
            pasal_nodes = load_nodes_recursive(sb, work_id, nodes)
            chunk_count = create_chunks(sb, work_id, law, pasal_nodes)
            print(f"    {len(pasal_nodes)} pasals, {chunk_count} chunks")

            loaded_uris.add(frbr_uri)
            _save_progress(loaded_uris)
            loaded_count += 1

        except Exception as e:
            print(f"    ERROR: {e}")

    # Update relationships
    try:
        insert_relationships(sb)
    except Exception as e:
        print(f"  Relationships error: {e}")

    return loaded_count


def main():
    parser = argparse.ArgumentParser(description="Pasal.id data pipeline")
    parser.add_argument("--laws", type=str, help="Comma-separated law slugs")
    parser.add_argument("--all-uu", action="store_true", help="Scrape all UU in year range")
    parser.add_argument("--year-from", type=int, default=2020)
    parser.add_argument("--year-to", type=int, default=2024)
    parser.add_argument("--max-number", type=int, default=50, help="Max law number per year")
    parser.add_argument("--parse-only", action="store_true", help="Only parse existing PDFs")
    parser.add_argument("--load-only", action="store_true", help="Only load existing parsed JSON")
    parser.add_argument("--force", action="store_true", help="Force reload all")
    args = parser.parse_args()

    t0 = time.time()

    if args.load_only:
        print("=== Step: Load ===")
        count = step_load(force=args.force)
        print(f"Loaded {count} laws ({time.time() - t0:.1f}s)")
        return

    if args.parse_only:
        print("=== Step: Parse ===")
        parsed = step_parse()
        print(f"Parsed {len(parsed)} laws ({time.time() - t0:.1f}s)")
        return

    # Determine slugs
    if args.laws:
        slugs = [s.strip() for s in args.laws.split(",")]
    elif args.all_uu:
        slugs = generate_uu_slugs(args.year_from, args.year_to, args.max_number)
    else:
        parser.print_help()
        return

    print(f"=== Pipeline: {len(slugs)} law slugs ===\n")

    # Step 1: Scrape
    print("=== Step 1: Scrape ===")
    scraped = asyncio.run(step_scrape(slugs))
    print(f"Scraped: {len(scraped)}/{len(slugs)}\n")

    # Step 2: Download PDFs
    print("=== Step 2: Download PDFs ===")
    downloaded = asyncio.run(step_download(scraped))
    print(f"Downloaded: {len(downloaded)}\n")

    # Step 3: Parse
    print("=== Step 3: Parse ===")
    parsed = step_parse(downloaded)
    print(f"Parsed: {len(parsed)}\n")

    # Step 4: Load
    print("=== Step 4: Load ===")
    count = step_load(parsed, force=args.force)
    print(f"Loaded: {count}\n")

    elapsed = time.time() - t0
    print(f"=== Pipeline complete: {count} laws loaded ({elapsed:.1f}s) ===")


if __name__ == "__main__":
    main()
