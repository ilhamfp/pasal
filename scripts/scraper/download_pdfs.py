"""Download PDFs for priority laws from peraturan.go.id."""
import asyncio
import json
import os
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).parent.parent.parent / "data"
RAW_DIR = DATA_DIR / "raw" / "peraturan-go-id"
PDF_DIR = DATA_DIR / "raw" / "pdfs"


async def main():
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    # Read scraped metadata
    summaries = []
    for f in sorted(RAW_DIR.glob("uu-*.json")):
        with open(f) as fh:
            summaries.append(json.load(fh))

    print(f"Found {len(summaries)} laws with metadata")

    async with httpx.AsyncClient(
        timeout=60,
        follow_redirects=True,
        headers={"User-Agent": "Pasal.id Research Bot (pasal.id)"}
    ) as client:
        for i, law in enumerate(summaries):
            pdf_url = law.get("pdf_url")
            if not pdf_url:
                print(f"[{i+1}] {law['slug']}: No PDF URL, skipping")
                continue

            outfile = PDF_DIR / f"{law['slug']}.pdf"
            if outfile.exists():
                print(f"[{i+1}] {law['slug']}: Already downloaded")
                continue

            print(f"[{i+1}] Downloading {law['slug']}...")
            try:
                resp = await client.get(pdf_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(outfile, 'wb') as f:
                        f.write(resp.content)
                    print(f"  OK: {len(resp.content)} bytes")
                else:
                    print(f"  FAIL: status={resp.status_code}, size={len(resp.content)}")
            except Exception as e:
                print(f"  ERROR: {e}")

            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
