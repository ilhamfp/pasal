"""Fetch detail pages from peraturan.go.id and extract structured metadata.

For each slug in slugs.jsonl, fetches the detail page and extracts metadata
from the <th>...<td> pairs in the metadata table.

Usage:
    python crawl_metadata.py --input data/raw/slugs.jsonl --limit 100
    python crawl_metadata.py --slugs uu-no-13-tahun-2003,pp-no-35-tahun-2021
"""
import argparse
import asyncio
import json
import re
import ssl
from datetime import date
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://peraturan.go.id"
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw"
META_DIR = DATA_DIR / "metadata"

HEADERS = {
    "User-Agent": "Pasal/1.0 (https://pasal.id; legal-data-research)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
}

# Map jenis peraturan names to our regulation_types codes
JENIS_MAP: dict[str, str] = {
    "undang-undang": "UU",
    "peraturan pemerintah pengganti undang-undang": "PERPPU",
    "peraturan pemerintah": "PP",
    "peraturan presiden": "PERPRES",
    "keputusan presiden": "KEPPRES",
    "instruksi presiden": "INPRES",
    "penetapan presiden": "PENPRES",
    "peraturan menteri": "PERMEN",
    "peraturan menteri hukum dan ham": "PERMENKUMHAM",
    "peraturan menteri hukum dan hak asasi manusia": "PERMENKUMHAM",
    "peraturan menteri hukum": "PERMENKUM",
    "peraturan badan": "PERBAN",
    "peraturan daerah": "PERDA",
    "peraturan daerah provinsi": "PERDA",
    "peraturan daerah kabupaten": "PERDA",
    "peraturan daerah kabupaten/kota": "PERDA",
    "keputusan menteri": "KEPMEN",
    "surat edaran": "SE",
    "ketetapan majelis permusyawaratan rakyat": "TAP_MPR",
    "undang-undang dasar": "UUD",
    "undang-undang dasar sementara": "UUDS",
    "undang-undang darurat": "UUDRT",
    "peraturan mahkamah agung": "PERMA",
    "peraturan bank indonesia": "PBI",
}

# Indonesian month names
BULAN = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4,
    "mei": 5, "juni": 6, "juli": 7, "agustus": 8,
    "september": 9, "oktober": 10, "november": 11, "desember": 12,
}


def _parse_indonesian_date(text: str) -> str | None:
    """Parse '2 Januari 2024' → '2024-01-02'."""
    text = text.strip()
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", text)
    if not m:
        return None
    day = int(m.group(1))
    month_name = m.group(2).lower()
    year = int(m.group(3))
    month = BULAN.get(month_name)
    if not month:
        return None
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _normalize_jenis(jenis_text: str) -> str | None:
    """Normalize jenis peraturan text to regulation_types code."""
    normalized = jenis_text.strip().lower()
    # Try exact match first
    if normalized in JENIS_MAP:
        return JENIS_MAP[normalized]
    # Try partial matching
    for key, code in JENIS_MAP.items():
        if key in normalized or normalized in key:
            return code
    return None


def _extract_metadata(soup: BeautifulSoup, slug: str) -> dict:
    """Extract metadata from a detail page's <th>...<td> table."""
    meta: dict = {"slug": slug}

    # Find all table rows with <th> and <td>
    for row in soup.find_all("tr"):
        th = row.find("th")
        td = row.find("td")
        if not th or not td:
            continue

        key = th.get_text(strip=True).lower().rstrip(":")
        value = td.get_text(strip=True)
        if not value:
            continue

        if "jenis" in key and "peraturan" in key:
            meta["jenis_raw"] = value
            code = _normalize_jenis(value)
            if code:
                meta["type_code"] = code
        elif "nomor" == key or key == "nomor peraturan":
            meta["number"] = value
        elif "tahun" == key or key == "tahun peraturan":
            meta["year"] = int(re.sub(r"\D", "", value)) if re.search(r"\d+", value) else None
        elif "judul" in key or "tentang" in key:
            meta["title"] = value
        elif "tempat penetapan" in key:
            meta["tempat_penetapan"] = value
        elif "tanggal penetapan" in key:
            meta["tanggal_penetapan"] = _parse_indonesian_date(value) or value
        elif "pejabat" in key and "penetap" in key:
            meta["pejabat_penetap"] = value
        elif "tanggal pengundangan" in key:
            meta["tanggal_pengundangan"] = _parse_indonesian_date(value) or value
        elif "pejabat" in key and "pengundang" in key:
            meta["pejabat_pengundangan"] = value
        elif "lembaran negara" in key or "nomor pengundangan" in key:
            meta["nomor_pengundangan"] = value
        elif "tambahan" in key:
            meta["nomor_tambahan"] = value
        elif "pemrakarsa" in key:
            meta["pemrakarsa"] = value
        elif "status" in key:
            status_lower = value.lower()
            if "berlaku" in status_lower:
                meta["status"] = "berlaku"
            elif "dicabut" in status_lower or "tidak berlaku" in status_lower:
                meta["status"] = "dicabut"
            elif "diubah" in status_lower:
                meta["status"] = "diubah"
            else:
                meta["status"] = "berlaku"

    # Extract PDF link
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.endswith(".pdf") or "/files/" in href:
            meta["pdf_url"] = href if href.startswith("http") else BASE_URL + href
            break

    # Extract related links
    related = []
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.startswith("/id/") and href != f"/id/{slug}":
            related_slug = href.replace("/id/", "").strip("/")
            related.append(related_slug)
    if related:
        meta["related_slugs"] = list(set(related))

    return meta


async def crawl_metadata(
    slugs: list[dict],
    rate_limit: float = 0.5,
    skip_existing: bool = True,
) -> dict:
    """Fetch detail pages and extract metadata for each slug."""
    META_DIR.mkdir(parents=True, exist_ok=True)
    stats = {"fetched": 0, "skipped": 0, "errors": 0}

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
        for i, entry in enumerate(slugs):
            slug = entry["slug"]
            out_path = META_DIR / f"{slug}.json"

            if skip_existing and out_path.exists():
                stats["skipped"] += 1
                continue

            if i > 0:
                await asyncio.sleep(rate_limit)

            try:
                url = entry.get("detail_url", f"{BASE_URL}/id/{slug}")
                resp = await client.get(url)
                if resp.status_code != 200:
                    print(f"  [{i+1}/{len(slugs)}] {slug}: HTTP {resp.status_code}")
                    stats["errors"] += 1
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                meta = _extract_metadata(soup, slug)

                # Merge type from listing if not found in detail page
                if "type_code" not in meta and "type" in entry:
                    meta["type_code"] = entry["type"]

                out_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2))
                stats["fetched"] += 1

                if (i + 1) % 10 == 0:
                    print(f"  [{i+1}/{len(slugs)}] {stats['fetched']} fetched, {stats['skipped']} skipped")

            except Exception as e:
                print(f"  [{i+1}/{len(slugs)}] {slug}: {e}")
                stats["errors"] += 1

    print(f"\n=== Metadata: {stats['fetched']} fetched, {stats['skipped']} skipped, {stats['errors']} errors ===")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Crawl metadata from peraturan.go.id detail pages")
    parser.add_argument("--input", type=str, default=str(DATA_DIR / "slugs.jsonl"), help="Input JSONL file")
    parser.add_argument("--slugs", type=str, help="Comma-separated slugs to fetch")
    parser.add_argument("--limit", type=int, help="Max slugs to process")
    parser.add_argument("--rate-limit", type=float, default=0.5, help="Seconds between requests")
    parser.add_argument("--force", action="store_true", help="Re-fetch existing metadata")
    args = parser.parse_args()

    if args.slugs:
        slugs = [{"slug": s.strip()} for s in args.slugs.split(",")]
    else:
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

    if args.limit:
        slugs = slugs[:args.limit]

    print(f"Processing {len(slugs)} slugs...")
    asyncio.run(crawl_metadata(slugs, rate_limit=args.rate_limit, skip_existing=not args.force))


if __name__ == "__main__":
    main()
