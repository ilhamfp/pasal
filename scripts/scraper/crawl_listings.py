"""Crawl listing pages from peraturan.go.id to discover regulation slugs.

Outputs: data/raw/slugs.jsonl (one JSON per line)
Checkpoint: data/raw/crawl_checkpoint.txt for resume

Usage:
    python crawl_listings.py --types uu,pp,perpres --max-pages 5
    python crawl_listings.py --all --max-pages 3
"""
import argparse
import asyncio
import json
import re
import ssl
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://peraturan.go.id"
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw"

# All regulation type paths on peraturan.go.id
REG_TYPES = {
    "uu": {"code": "UU", "path": "/uu"},
    "perppu": {"code": "PERPPU", "path": "/perppu"},
    "pp": {"code": "PP", "path": "/pp"},
    "perpres": {"code": "PERPRES", "path": "/perpres"},
    "permen": {"code": "PERMEN", "path": "/permen"},
    "perban": {"code": "PERBAN", "path": "/perban"},
    "perda": {"code": "PERDA", "path": "/perda"},
    "keppres": {"code": "KEPPRES", "path": "/keppres"},
    "inpres": {"code": "INPRES", "path": "/inpres"},
    "tapmpr": {"code": "TAP_MPR", "path": "/tapmpr"},
}

HEADERS = {
    "User-Agent": "Pasal/1.0 (https://pasal.id; legal-data-research)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
}

# Parse slug from href like /id/uu-no-13-tahun-2003
SLUG_RE = re.compile(
    r"(?:uu|pp|perpres|perppu|permen|perban|perda|keppres|inpres|tapmpr|uudrt|penpres)"
    r"[-\s]no[-\s](\d+[a-z]?)[-\s]tahun[-\s](\d{4})",
    re.IGNORECASE,
)


def _parse_total(soup: BeautifulSoup) -> int | None:
    """Extract total regulation count from page text like '1.926 Peraturan'."""
    text = soup.get_text()
    m = re.search(r"([\d.]+)\s+Peraturan", text)
    if m:
        return int(m.group(1).replace(".", ""))
    return None


def _extract_slugs(soup: BeautifulSoup, reg_type: str, page: int) -> list[dict]:
    """Extract regulation slugs from listing page HTML."""
    results = []
    seen = set()

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if not href.startswith("/id/"):
            continue

        slug = href.replace("/id/", "").strip("/")
        if slug in seen or not slug or slug == "#":
            continue

        # Must look like a real regulation slug (contains "no" and "tahun")
        if "tahun" not in slug and "thn" not in slug:
            continue

        # Extract title text
        title = link.get_text(strip=True)
        if not title or len(title) < 5:
            continue

        seen.add(slug)
        results.append({
            "slug": slug,
            "type": reg_type.upper(),
            "title": title,
            "detail_url": f"{BASE_URL}{href}",
            "page": page,
        })

    return results


def _load_checkpoint(checkpoint_path: Path) -> dict[str, int]:
    """Load checkpoint: {type_key: last_completed_page}."""
    if checkpoint_path.exists():
        try:
            return json.loads(checkpoint_path.read_text())
        except Exception:
            pass
    return {}


def _save_checkpoint(checkpoint_path: Path, data: dict[str, int]) -> None:
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_path.write_text(json.dumps(data))


async def crawl_listings(
    types: list[str] | None = None,
    max_pages: int | None = None,
    rate_limit: float = 0.5,
) -> dict:
    """Crawl listing pages and output slugs.jsonl.

    Args:
        types: List of type keys (e.g. ["uu", "pp"]). None = all.
        max_pages: Max pages per type. None = all.
        rate_limit: Seconds between requests (0.5 = 2 req/sec).
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    output_path = DATA_DIR / "slugs.jsonl"
    checkpoint_path = DATA_DIR / "crawl_checkpoint.txt"

    types_to_crawl = types or list(REG_TYPES.keys())
    checkpoint = _load_checkpoint(checkpoint_path)

    # Load existing slugs to avoid duplicates
    existing_slugs: set[str] = set()
    if output_path.exists():
        with open(output_path) as f:
            for line in f:
                try:
                    existing_slugs.add(json.loads(line)["slug"])
                except Exception:
                    pass

    stats = {"types": 0, "pages": 0, "new_slugs": 0, "skipped": 0}

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    transport = httpx.AsyncHTTPTransport(retries=3, verify=ctx)
    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers=HEADERS,
        transport=transport,
    ) as client:
        with open(output_path, "a") as out:
            for type_key in types_to_crawl:
                if type_key not in REG_TYPES:
                    print(f"  Unknown type: {type_key}, skipping")
                    continue

                reg_info = REG_TYPES[type_key]
                path = reg_info["path"]
                start_page = checkpoint.get(type_key, 0) + 1

                print(f"\n--- {type_key.upper()} from {path} (starting page {start_page}) ---")

                # Fetch first page to get total count
                try:
                    resp = await client.get(f"{BASE_URL}{path}?page=1")
                    if resp.status_code != 200:
                        print(f"  HTTP {resp.status_code}, skipping")
                        continue
                except Exception as e:
                    print(f"  Connection error: {e}, skipping")
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                total = _parse_total(soup)
                total_pages = (total + 19) // 20 if total else 1
                if max_pages:
                    total_pages = min(total_pages, max_pages)

                print(f"  Total: {total or '?'} regulations, {total_pages} pages")

                for page in range(start_page, total_pages + 1):
                    if page > 1:
                        await asyncio.sleep(rate_limit)
                        try:
                            resp = await client.get(f"{BASE_URL}{path}?page={page}")
                            if resp.status_code != 200:
                                print(f"  Page {page}: HTTP {resp.status_code}")
                                continue
                            soup = BeautifulSoup(resp.text, "html.parser")
                        except Exception as e:
                            print(f"  Page {page} error: {e}")
                            continue

                    slugs = _extract_slugs(soup, reg_info["code"], page)
                    new_count = 0
                    for entry in slugs:
                        if entry["slug"] not in existing_slugs:
                            out.write(json.dumps(entry, ensure_ascii=False) + "\n")
                            existing_slugs.add(entry["slug"])
                            new_count += 1
                        else:
                            stats["skipped"] += 1

                    stats["new_slugs"] += new_count
                    stats["pages"] += 1

                    # Save checkpoint after each page
                    checkpoint[type_key] = page
                    _save_checkpoint(checkpoint_path, checkpoint)

                    if page % 5 == 0 or page == total_pages:
                        print(f"  Page {page}/{total_pages}: +{new_count} new ({stats['new_slugs']} total)")

                stats["types"] += 1

    print(f"\n=== Done: {stats['new_slugs']} new slugs, {stats['pages']} pages, {stats['types']} types ===")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Crawl peraturan.go.id listing pages")
    parser.add_argument("--types", type=str, help="Comma-separated type codes: uu,pp,perpres")
    parser.add_argument("--max-pages", type=int, help="Max pages per type")
    parser.add_argument("--all", action="store_true", help="Crawl all types")
    parser.add_argument("--rate-limit", type=float, default=0.5, help="Seconds between requests")
    args = parser.parse_args()

    types = None
    if args.types:
        types = [t.strip().lower() for t in args.types.split(",")]
    elif not args.all:
        types = ["uu", "pp", "perpres"]  # Default subset

    asyncio.run(crawl_listings(types=types, max_pages=args.max_pages, rate_limit=args.rate_limit))


if __name__ == "__main__":
    main()
