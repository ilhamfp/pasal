"""Scrape priority laws from peraturan.go.id for the MVP."""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

# Add parent dir to path for shared config
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = "https://peraturan.go.id"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "peraturan-go-id"
DELAY = 2  # seconds between requests

# Priority laws for MVP (from ARCHITECTURE.md)
PRIORITY_LAWS = [
    {"slug": "uu-no-13-tahun-2003", "type": "UU", "number": "13", "year": 2003, "topic": "Ketenagakerjaan"},
    {"slug": "uu-no-6-tahun-2023", "type": "UU", "number": "6", "year": 2023, "topic": "Cipta Kerja"},
    {"slug": "uu-no-1-tahun-1974", "type": "UU", "number": "1", "year": 1974, "topic": "Perkawinan"},
    {"slug": "uu-no-16-tahun-2019", "type": "UU", "number": "16", "year": 2019, "topic": "Perubahan UU Perkawinan"},
    {"slug": "uu-no-1-tahun-2023", "type": "UU", "number": "1", "year": 2023, "topic": "KUHP"},
    {"slug": "uu-no-31-tahun-1999", "type": "UU", "number": "31", "year": 1999, "topic": "Pemberantasan Korupsi"},
    {"slug": "uu-no-20-tahun-2001", "type": "UU", "number": "20", "year": 2001, "topic": "Perubahan UU Anti-Korupsi"},
    {"slug": "uu-no-17-tahun-2003", "type": "UU", "number": "17", "year": 2003, "topic": "Keuangan Negara"},
    {"slug": "uu-no-8-tahun-1995", "type": "UU", "number": "8", "year": 1995, "topic": "Pasar Modal"},
    {"slug": "uu-no-8-tahun-1999", "type": "UU", "number": "8", "year": 1999, "topic": "Perlindungan Konsumen"},
    {"slug": "uu-no-11-tahun-2016", "type": "UU", "number": "11", "year": 2016, "topic": "Pengampunan Pajak"},
    {"slug": "uu-no-40-tahun-2007", "type": "UU", "number": "40", "year": 2007, "topic": "Perseroan Terbatas"},
    {"slug": "uu-no-24-tahun-2011", "type": "UU", "number": "24", "year": 2011, "topic": "BPJS"},
    {"slug": "uu-no-24-tahun-2003", "type": "UU", "number": "24", "year": 2003, "topic": "Mahkamah Konstitusi"},
    {"slug": "uu-no-12-tahun-2011", "type": "UU", "number": "12", "year": 2011, "topic": "Pembentukan Peraturan"},
    {"slug": "uu-no-13-tahun-2022", "type": "UU", "number": "13", "year": 2022, "topic": "Perubahan UU 12/2011"},
    {"slug": "uu-no-14-tahun-2008", "type": "UU", "number": "14", "year": 2008, "topic": "Keterbukaan Informasi Publik"},
    {"slug": "uu-no-19-tahun-2016", "type": "UU", "number": "19", "year": 2016, "topic": "ITE"},
    {"slug": "uu-no-27-tahun-2024", "type": "UU", "number": "27", "year": 2024, "topic": "Perubahan UU ITE"},
    {"slug": "uu-no-27-tahun-2022", "type": "UU", "number": "27", "year": 2022, "topic": "Perlindungan Data Pribadi"},
]


async def scrape_law_page(client: httpx.AsyncClient, law: dict) -> dict | None:
    """Scrape a law's detail page from peraturan.go.id."""
    url = f"{BASE_URL}/id/{law['slug']}"
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            print(f"  SKIP {law['slug']}: HTTP {resp.status_code}")
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Extract title
        title_el = soup.select_one('h1, .judul, .title, h2')
        title = title_el.get_text(strip=True) if title_el else f"UU {law['number']}/{law['year']}"

        # Extract the full text content
        # peraturan.go.id typically has the text in a main content area
        content_el = soup.select_one('.content-body, .isi-peraturan, article, .main-content, #content')
        if not content_el:
            # Fallback: get all text from body
            content_el = soup.select_one('main') or soup.select_one('body')

        text = content_el.get_text('\n', strip=False) if content_el else ""

        # Extract metadata from info table
        metadata = {}
        for row in soup.select('tr, .info-row, .detail-item'):
            cells = row.select('td, th, .label, .value')
            if len(cells) >= 2:
                key = cells[0].get_text(strip=True)
                val = cells[1].get_text(strip=True)
                metadata[key] = val

        # Find PDF link
        pdf_link = soup.select_one('a[href*=".pdf"], a[href*="download"]')
        pdf_url = pdf_link['href'] if pdf_link else None
        if pdf_url and not pdf_url.startswith('http'):
            pdf_url = BASE_URL + pdf_url

        result = {
            **law,
            "title_id": title,
            "full_text": text,
            "page_metadata": metadata,
            "source_url": url,
            "pdf_url": pdf_url,
            "html_length": len(resp.text),
            "text_length": len(text),
        }

        return result

    except Exception as e:
        print(f"  ERROR {law['slug']}: {e}")
        return None


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers={"User-Agent": "Pasal.id Research Bot (pasal.id)"}
    ) as client:
        results = []
        for i, law in enumerate(PRIORITY_LAWS):
            print(f"[{i+1}/{len(PRIORITY_LAWS)}] Scraping {law['slug']}...")
            result = await scrape_law_page(client, law)
            if result:
                # Save individual file
                outfile = OUTPUT_DIR / f"{law['slug']}.json"
                with open(outfile, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                print(f"  OK: {result['text_length']} chars, title: {result['title_id'][:80]}")
                results.append(result)
            else:
                print(f"  FAILED")

            if i < len(PRIORITY_LAWS) - 1:
                await asyncio.sleep(DELAY)

        print(f"\nDone: {len(results)}/{len(PRIORITY_LAWS)} laws scraped")

        # Save summary
        summary = [{k: v for k, v in r.items() if k != 'full_text'} for r in results]
        with open(OUTPUT_DIR / "_summary.json", 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
