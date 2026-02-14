"""Discover regulations by crawling peraturan.go.id listing pages.

Crawls paginated listing pages like /uu?page=1, /pp?page=1, etc.
Extracts regulation metadata and upserts into crawl_jobs table.

Supports all 12 central government regulation types and smart caching
via discovery_progress table to skip recently-crawled types.
"""
import asyncio
import re
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))
from crawler.config import DEFAULT_HEADERS, DELAY_BETWEEN_PAGES, create_ssl_context
from crawler.state import is_discovery_fresh, upsert_discovery_progress, upsert_job

BASE_URL = "https://peraturan.go.id"

# All central government regulation types on peraturan.go.id
REG_TYPES = {
    "uu": {"code": "UU", "path": "/uu"},
    "pp": {"code": "PP", "path": "/pp"},
    "perpres": {"code": "PERPRES", "path": "/perpres"},
    "perppu": {"code": "PERPPU", "path": "/perppu"},
    "keppres": {"code": "KEPPRES", "path": "/keppres"},
    "inpres": {"code": "INPRES", "path": "/inpres"},
    "penpres": {"code": "PENPRES", "path": "/penpres"},
    "uudrt": {"code": "UUDRT", "path": "/uudrt"},
    "tapmpr": {"code": "TAP_MPR", "path": "/tapmpr"},
    "permen": {"code": "PERMEN", "path": "/permen"},
    "perban": {"code": "PERBAN", "path": "/perban"},
    "perda": {"code": "PERDA", "path": "/perda"},
}

# Generic slug pattern: captures [prefix]-no-[number]-tahun-[year]
# Works for ALL slug formats including:
#   uu-no-1-tahun-2026 (simple)
#   permenkum-no-2-tahun-2026 (ministry embedded)
#   permen-esdm-no-2-tahun-2026 (ministry dash-separated)
#   peraturan-bpom-no-1-tahun-2026 (agency prefixed)
#   perda-kabupaten-kendal-no-10-tahun-2025 (location embedded)
#   tap-mpr-no-iv-mpr-1999-tahun-2004 (roman numerals)
#   tapmpr-no-vi-mpr-2000-tahun-2000 (no-dash variant)
SLUG_RE = re.compile(
    r"^(.+?)-no-(.+)-tahun-(\d{4})$",
    re.IGNORECASE,
)

# Formal names for regulation type codes
TYPE_NAMES = {
    "UU": "Undang-Undang",
    "PP": "Peraturan Pemerintah",
    "PERPRES": "Peraturan Presiden",
    "PERPPU": "Peraturan Pemerintah Pengganti Undang-Undang",
    "KEPPRES": "Keputusan Presiden",
    "INPRES": "Instruksi Presiden",
    "PENPRES": "Penetapan Presiden",
    "UUDRT": "Undang-Undang Darurat",
    "TAP_MPR": "Ketetapan Majelis Permusyawaratan Rakyat",
    "PERMEN": "Peraturan Menteri",
    "PERBAN": "Peraturan Badan",
    "PERDA": "Peraturan Daerah",
}


# Map of slug prefixes to parent regulation type codes
_PREFIX_EXACT = {
    "uu": "UU", "pp": "PP", "perpres": "PERPRES", "perppu": "PERPPU",
    "keppres": "KEPPRES", "inpres": "INPRES", "penpres": "PENPRES",
    "uudrt": "UUDRT",
}


def _infer_type_from_prefix(prefix: str) -> str:
    """Map slug prefix to parent regulation type code (fallback when no page context)."""
    p = prefix.lower()
    if p in _PREFIX_EXACT:
        return _PREFIX_EXACT[p]
    if p.startswith("tap") and "mpr" in p:
        return "TAP_MPR"
    if p.startswith("permen") or p.startswith("kepmen"):
        return "PERMEN"
    if p.startswith(("perda", "perwako", "perwalkot", "perbup", "pergub",
                     "perwal", "qanun")):
        return "PERDA"
    if p.startswith(("peraturan-", "perpusnas", "perka", "perdirjen",
                     "perbpk", "perbi", "pojk")):
        return "PERBAN"
    # Safe default: most regulations on peraturan.go.id are ministerial
    return "PERMEN"


def _parse_slug(slug: str, page_type_code: str | None = None) -> dict | None:
    """Extract prefix, number, year from a URL slug.

    Args:
        slug: URL slug like 'permenkum-no-2-tahun-2026'
        page_type_code: Parent regulation type from page context (e.g. 'PERMEN')
    """
    m = SLUG_RE.match(slug)
    if not m:
        return None

    prefix = m.group(1)
    number = m.group(2).strip("-")
    year = int(m.group(3))

    type_code = page_type_code or _infer_type_from_prefix(prefix)

    return {
        "type": type_code,
        "prefix": prefix,
        "number": number,
        "year": year,
    }


def _parse_total_from_page(soup: BeautifulSoup) -> int | None:
    """Extract total regulation count from the page text like '1.926 Peraturan'."""
    text = soup.get_text()
    m = re.search(r"([\d.]+)\s+Peraturan", text)
    if m:
        return int(m.group(1).replace(".", ""))
    return None


def _extract_regulations_from_page(soup: BeautifulSoup, reg_type: str, type_code: str) -> list[dict]:
    """Extract regulation entries from a listing page.

    Args:
        soup: Parsed HTML
        reg_type: Type key like 'permen'
        type_code: Parent type code like 'PERMEN' (from REG_TYPES)
    """
    results = []
    skipped_slugs = []

    # Find all links to regulation detail pages
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if not href.startswith("/id/"):
            continue

        slug = href.replace("/id/", "").strip("/")
        parsed = _parse_slug(slug, page_type_code=type_code)
        if not parsed:
            skipped_slugs.append(slug)
            continue

        topic_text = link.get_text(strip=True)
        if not topic_text or len(topic_text) < 3:
            continue

        # Build full formal title: "Undang-Undang Nomor 1 Tahun 2026 tentang ..."
        type_name = TYPE_NAMES.get(parsed["type"], parsed["type"])
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

        # FRBR URI uses prefix for uniqueness
        # Simple types: prefix == type (e.g. "uu") → /akn/id/act/uu/2003/13
        # Complex types: prefix is specific (e.g. "permenkum") → /akn/id/act/permenkum/2026/2
        prefix = parsed["prefix"].lower()
        results.append({
            "source_id": "peraturan_go_id",
            "url": detail_url,
            "pdf_url": pdf_url,
            "regulation_type": parsed["type"],
            "number": parsed["number"],
            "year": parsed["year"],
            "title": formal_title,
            "status": "pending",
            "frbr_uri": f"/akn/id/act/{prefix}/{parsed['year']}/{parsed['number']}",
        })

    if skipped_slugs:
        unique_skipped = sorted(set(skipped_slugs))
        print(f"    ({len(skipped_slugs)} links skipped — no -no-...-tahun- pattern)")
        for s in unique_skipped:
            print(f"      SKIP: /id/{s}")

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
    freshness_hours: float = 24.0,
    ignore_freshness: bool = False,
) -> dict:
    """Crawl listing pages and seed crawl_jobs.

    Args:
        reg_types: List of type codes to crawl (e.g. ["uu", "pp"]). None = all.
        max_pages_per_type: Max pages to crawl per type. None = all.
        dry_run: If True, don't write to DB.
        freshness_hours: Skip types discovered within this many hours.
        ignore_freshness: If True, always crawl regardless of freshness.

    Returns:
        Stats dict with discovered/upserted counts.
    """
    types_to_crawl = reg_types or list(REG_TYPES.keys())
    stats = {
        "types_crawled": 0,
        "types_skipped_fresh": 0,
        "pages_crawled": 0,
        "discovered": 0,
        "upserted": 0,
    }

    ssl_ctx = create_ssl_context()
    transport = httpx.AsyncHTTPTransport(retries=3, verify=ssl_ctx)
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
            source_id = "peraturan_go_id"

            # Smart caching: skip recently-crawled types
            if not ignore_freshness and not dry_run:
                fresh, cached = is_discovery_fresh(source_id, reg_info["code"], freshness_hours)
                if fresh:
                    cached_total = cached.get("total_regulations", "?") if cached else "?"
                    print(f"\n--- {type_key.upper()} FRESH (last crawled <{freshness_hours}h ago, {cached_total} regs) — skipping ---")
                    stats["types_skipped_fresh"] += 1
                    continue

            print(f"\n--- Discovering {type_key.upper()} from {path} ---")

            # Fetch first page to get total count
            try:
                resp = await client.get(f"{BASE_URL}{path}?page=1")
            except Exception as e:
                print(f"  ERROR fetching {path}: {e}")
                continue

            if resp.status_code != 200:
                print(f"  ERROR: HTTP {resp.status_code} for {path}")
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            total = _parse_total_from_page(soup)
            total_pages = (total + 19) // 20 if total else 1
            if max_pages_per_type:
                total_pages = min(total_pages, max_pages_per_type)

            # Quick-skip: if total unchanged and all pages were crawled before, just refresh timestamp
            if not ignore_freshness and not dry_run and total is not None:
                _, cached = is_discovery_fresh(source_id, reg_info["code"], freshness_hours=999999)
                if (cached
                        and cached.get("total_regulations") == total
                        and cached.get("pages_crawled", 0) >= ((total + 19) // 20)
                        and max_pages_per_type is None):
                    print(f"  Total unchanged ({total}), all pages crawled previously — refreshing timestamp")
                    upsert_discovery_progress({
                        "source_id": source_id,
                        "regulation_type": reg_info["code"],
                        "total_regulations": total,
                        "pages_crawled": cached["pages_crawled"],
                        "total_pages": cached["total_pages"],
                    })
                    stats["types_skipped_fresh"] += 1
                    continue

            print(f"  Total: {total or '?'} regulations, crawling {total_pages} pages")

            # Process first page
            regs = _extract_regulations_from_page(soup, type_key, reg_info["code"])
            stats["discovered"] += len(regs)
            if not dry_run:
                for reg in regs:
                    upsert_job(reg)
                    stats["upserted"] += 1
            stats["pages_crawled"] += 1
            pages_done = 1

            # Process remaining pages
            for page in range(2, total_pages + 1):
                await asyncio.sleep(DELAY_BETWEEN_PAGES)
                try:
                    resp = await client.get(f"{BASE_URL}{path}?page={page}")
                    if resp.status_code != 200:
                        print(f"  Page {page}: HTTP {resp.status_code}")
                        continue

                    soup = BeautifulSoup(resp.text, "html.parser")
                    regs = _extract_regulations_from_page(soup, type_key, reg_info["code"])
                    stats["discovered"] += len(regs)
                    if not dry_run:
                        for reg in regs:
                            upsert_job(reg)
                            stats["upserted"] += 1
                    stats["pages_crawled"] += 1
                    pages_done += 1

                    if page % 10 == 0:
                        print(f"  Page {page}/{total_pages}: {stats['discovered']} found so far")

                except Exception as e:
                    print(f"  Page {page} ERROR: {e}")
                    continue

            stats["types_crawled"] += 1

            # Save discovery progress
            if not dry_run:
                upsert_discovery_progress({
                    "source_id": source_id,
                    "regulation_type": reg_info["code"],
                    "total_regulations": total,
                    "pages_crawled": pages_done,
                    "total_pages": total_pages,
                })

    return stats
