"""Discover regulations by crawling peraturan.go.id listing pages.

Crawls paginated listing pages like /uu?page=1, /pp?page=1, etc.
Extracts regulation metadata and upserts into crawl_jobs table.
"""
import asyncio
import re
import ssl
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from crawler.config import DEFAULT_HEADERS, DELAY_BETWEEN_PAGES
from crawler.db import get_sb
from crawler.state import upsert_job

BASE_URL = "https://peraturan.go.id"

# Regulation types to crawl, with their URL path and type code
REG_TYPES = {
    "uu": {"code": "UU", "path": "/uu"},
    "pp": {"code": "PP", "path": "/pp"},
    "perpres": {"code": "PERPRES", "path": "/perpres"},
    "permen": {"code": "PERMEN", "path": "/permen"},
    "perban": {"code": "PERBAN", "path": "/perban"},
    "perda": {"code": "PERDA", "path": "/perda"},
}

# Parse slug pattern: uu-no-13-tahun-2003
SLUG_RE = re.compile(
    r"(uu|pp|perpres|perppu|permen|perban|perda)-no-(\d+[a-z]?)-tahun-(\d{4})",
    re.IGNORECASE,
)


def _parse_slug(slug: str) -> dict | None:
    """Extract type, number, year from a URL slug."""
    m = SLUG_RE.search(slug)
    if not m:
        return None
    return {
        "type": m.group(1).upper(),
        "number": m.group(2),
        "year": int(m.group(3)),
    }


def _parse_total_from_page(soup: BeautifulSoup) -> int | None:
    """Extract total regulation count from the page text like '1.926 Peraturan'."""
    text = soup.get_text()
    m = re.search(r"([\d.]+)\s+Peraturan", text)
    if m:
        return int(m.group(1).replace(".", ""))
    return None


def _extract_regulations_from_page(soup: BeautifulSoup, reg_type: str) -> list[dict]:
    """Extract regulation entries from a listing page."""
    results = []

    # Find all links to regulation detail pages
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if not href.startswith("/id/"):
            continue

        slug = href.replace("/id/", "").strip("/")
        parsed = _parse_slug(slug)
        if not parsed:
            continue

        topic_text = link.get_text(strip=True)
        if not topic_text or len(topic_text) < 3:
            continue

        # Build full formal title: "Undang-Undang Nomor 1 Tahun 2026 tentang ..."
        type_names = {
            "UU": "Undang-Undang",
            "PP": "Peraturan Pemerintah",
            "PERPRES": "Peraturan Presiden",
            "PERPPU": "Peraturan Pemerintah Pengganti Undang-Undang",
            "PERMEN": "Peraturan Menteri",
            "PERBAN": "Peraturan Badan",
            "PERDA": "Peraturan Daerah",
        }
        type_name = type_names.get(parsed["type"], parsed["type"])
        formal_title = f"{type_name} Nomor {parsed['number']} Tahun {parsed['year']} tentang {topic_text}"

        # Look for PDF link nearby (rare on listing pages)
        pdf_url = None
        parent = link.parent
        if parent:
            pdf_link = parent.find("a", href=re.compile(r"\.pdf$", re.IGNORECASE))
            if pdf_link:
                pdf_href = pdf_link["href"]
                pdf_url = pdf_href if pdf_href.startswith("http") else BASE_URL + pdf_href

        # Don't guess PDF URLs — peraturan.go.id uses unpredictable filenames.
        # The real URL will be extracted from the detail page during processing.

        detail_url = f"{BASE_URL}{href}"

        results.append({
            "source_id": "peraturan_go_id",
            "url": detail_url,
            "pdf_url": pdf_url,
            "regulation_type": parsed["type"],
            "number": parsed["number"],
            "year": parsed["year"],
            "title": formal_title,
            "status": "pending",
            "frbr_uri": f"/akn/id/act/{parsed['type'].lower()}/{parsed['year']}/{parsed['number']}",
        })

    # Deduplicate by URL within the same page
    seen = set()
    unique = []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)

    return unique


async def discover_regulations(
    reg_types: list[str] | None = None,
    max_pages_per_type: int | None = None,
    dry_run: bool = False,
) -> dict:
    """Crawl listing pages and seed crawl_jobs.

    Args:
        reg_types: List of type codes to crawl (e.g. ["uu", "pp"]). None = all.
        max_pages_per_type: Max pages to crawl per type. None = all.
        dry_run: If True, don't write to DB.

    Returns:
        Stats dict with discovered/upserted counts.
    """
    types_to_crawl = reg_types or list(REG_TYPES.keys())
    stats = {"types_crawled": 0, "pages_crawled": 0, "discovered": 0, "upserted": 0}

    # peraturan.go.id has intermittent TLS handshake issues — use permissive SSL
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    transport = httpx.AsyncHTTPTransport(retries=3, verify=ctx)
    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers=DEFAULT_HEADERS,
        transport=transport,
    ) as client:
        for type_key in types_to_crawl:
            if type_key not in REG_TYPES:
                print(f"  Unknown type: {type_key}, skipping")
                continue

            reg_info = REG_TYPES[type_key]
            path = reg_info["path"]
            print(f"\n--- Discovering {type_key.upper()} from {path} ---")

            # Fetch first page to get total count
            resp = await client.get(f"{BASE_URL}{path}?page=1")
            if resp.status_code != 200:
                print(f"  ERROR: HTTP {resp.status_code} for {path}")
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            total = _parse_total_from_page(soup)
            total_pages = (total + 19) // 20 if total else 1
            if max_pages_per_type:
                total_pages = min(total_pages, max_pages_per_type)

            print(f"  Total: {total or '?'} regulations, crawling {total_pages} pages")

            # Process first page
            regs = _extract_regulations_from_page(soup, type_key)
            stats["discovered"] += len(regs)
            if not dry_run:
                for reg in regs:
                    upsert_job(reg)
                    stats["upserted"] += 1
            stats["pages_crawled"] += 1

            # Process remaining pages
            for page in range(2, total_pages + 1):
                await asyncio.sleep(DELAY_BETWEEN_PAGES)
                try:
                    resp = await client.get(f"{BASE_URL}{path}?page={page}")
                    if resp.status_code != 200:
                        print(f"  Page {page}: HTTP {resp.status_code}")
                        continue

                    soup = BeautifulSoup(resp.text, "html.parser")
                    regs = _extract_regulations_from_page(soup, type_key)
                    stats["discovered"] += len(regs)
                    if not dry_run:
                        for reg in regs:
                            upsert_job(reg)
                            stats["upserted"] += 1
                    stats["pages_crawled"] += 1

                    if page % 10 == 0:
                        print(f"  Page {page}/{total_pages}: {stats['discovered']} found so far")

                except Exception as e:
                    print(f"  Page {page} ERROR: {e}")
                    continue

            stats["types_crawled"] += 1

    return stats
