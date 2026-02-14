"""Pipeline orchestrator: extract -> classify -> OCR correct -> parse -> validate -> insert.

Full flow for processing a PDF into structured legal data in Supabase.

Usage:
    python pipeline.py --pdf data/raw/pdfs/uu-13-2003.pdf
    python pipeline.py --dir data/raw/pdfs/ --limit 50
    python pipeline.py --dir data/raw/pdfs/ --load  # Also insert into DB
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from extract_pymupdf import extract_text_pymupdf
from classify_pdf import classify_pdf_quality
from ocr_correct import correct_ocr_errors
from parse_structure import parse_structure, count_pasals
from validate import validate_structure


DATA_DIR = Path(__file__).parent.parent.parent / "data"
PARSED_DIR = DATA_DIR / "parsed"

_REG_TYPES = r'uu|pp|perpres|perppu|permen|perban|perda|keppres|inpres|tapmpr'

# Filename patterns for extracting type/number/year
# Format 1: uu-no-13-tahun-2003
FILENAME_LONG_RE = re.compile(
    rf'^({_REG_TYPES})-no-(\d+[a-z]?)-tahun-(\d{{4}})$',
    re.IGNORECASE,
)
# Format 2: uu-13-2003
FILENAME_SHORT_RE = re.compile(
    rf'^({_REG_TYPES})-(\d+[a-z]?)-(\d{{4}})$',
    re.IGNORECASE,
)

_TYPE_NAME_MAP = {
    "UU": "Undang-Undang", "PP": "Peraturan Pemerintah",
    "PERPRES": "Peraturan Presiden", "PERPPU": "Peraturan Pemerintah Pengganti Undang-Undang",
    "PERMEN": "Peraturan Menteri", "PERBAN": "Peraturan Badan",
    "PERDA": "Peraturan Daerah", "KEPPRES": "Keputusan Presiden",
    "INPRES": "Instruksi Presiden", "TAPMPR": "Ketetapan MPR",
}


def _metadata_from_filename(filename: str) -> dict | None:
    """Extract metadata from PDF filename. Handles both naming formats."""
    stem = Path(filename).stem
    m = FILENAME_LONG_RE.match(stem) or FILENAME_SHORT_RE.match(stem)
    if not m:
        return None
    raw_type = m.group(1).upper()
    number = m.group(2)
    year = int(m.group(3))
    type_name = _TYPE_NAME_MAP.get(raw_type, raw_type)
    return {
        "type": raw_type,
        "number": number,
        "year": year,
        "frbr_uri": f"/akn/id/act/{raw_type.lower()}/{year}/{number}",
        "title_id": f"{type_name} Nomor {number} Tahun {year}",
        "status": "berlaku",
    }


def _metadata_from_json(slug: str) -> dict | None:
    """Try to load metadata from scraped metadata JSON."""
    meta_path = DATA_DIR / "raw" / "metadata" / f"{slug}.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
            if meta.get("type_code") and meta.get("number") and meta.get("year"):
                type_code = meta["type_code"]
                type_name = _TYPE_NAME_MAP.get(type_code, type_code)
                return {
                    "type": type_code,
                    "number": meta["number"],
                    "year": meta["year"],
                    "frbr_uri": f"/akn/id/act/{type_code.lower()}/{meta['year']}/{meta['number']}",
                    "title_id": meta.get("title") or f"{type_name} Nomor {meta['number']} Tahun {meta['year']}",
                    "status": meta.get("status", "berlaku"),
                    "slug": slug,
                }
        except Exception:
            pass
    return None


def process_pdf(pdf_path: str | Path, metadata: dict | None = None) -> dict | None:
    """Process a single PDF through the full pipeline.

    Returns parsed result dict or None on failure.
    """
    pdf_path = Path(pdf_path)
    slug = pdf_path.stem

    # 1. Resolve metadata
    if not metadata:
        metadata = _metadata_from_json(slug) or _metadata_from_filename(slug)
    if not metadata:
        print(f"  No metadata for {slug}, skipping")
        return None

    # 2. Classify PDF quality
    quality, confidence = classify_pdf_quality(pdf_path)
    print(f"  Quality: {quality} (confidence: {confidence:.2f})")

    # 3. Extract text
    text, extract_stats = extract_text_pymupdf(pdf_path)
    if not text or len(text) < 100:
        print(f"  Too little text ({len(text)} chars), skipping")
        return None

    # Detect junk PDFs (website captures, not actual legal documents)
    first_300 = text[:300]
    if "Beranda" in first_300 and "Progsun" in first_300:
        print(f"  Junk PDF (website capture), skipping")
        return None
    if "Access Denied" in first_300:
        print(f"  Junk PDF (access denied page), skipping")
        return None

    # 4. OCR correction (for scanned PDFs)
    if quality in ("scanned_clean", "image_only"):
        text = correct_ocr_errors(text)

    # 5. Parse structure
    nodes = parse_structure(text)
    pasal_count = count_pasals(nodes)

    # 6. Validate
    validation = validate_structure(nodes, len(text))

    print(f"  Parsed: {pasal_count} pasals, {len(nodes)} top nodes, valid={validation['valid']}")
    if validation["warnings"]:
        for w in validation["warnings"][:3]:
            print(f"    WARN: {w}")

    return {
        "frbr_uri": metadata["frbr_uri"],
        "type": metadata["type"],
        "number": metadata["number"],
        "year": metadata["year"],
        "title_id": metadata["title_id"],
        "status": metadata.get("status", "berlaku"),
        "slug": metadata.get("slug", slug),
        "source_url": f"https://peraturan.go.id/id/{slug}",
        "source_pdf_url": f"https://peraturan.go.id/files/{slug}.pdf",
        "full_text": text,
        "nodes": nodes,
        "pdf_quality": quality,
        "parse_method": "pymupdf",
        "parse_confidence": confidence,
        "parse_errors": validation.get("errors", []),
        "validation": validation,
        "stats": {
            "text_length": len(text),
            "pasal_count": pasal_count,
            "node_count": len(nodes),
            **extract_stats,
        },
    }


def load_to_db(result: dict) -> int | None:
    """Load a parsed result into Supabase. Returns work_id or None."""
    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Reuse load_to_supabase.py's pattern
    sys.path.insert(0, str(Path(__file__).parent.parent / "loader"))
    from load_to_supabase import (
        load_work, cleanup_work_data, load_nodes_recursive, create_chunks, _load_reg_type_map,
    )

    work_id = load_work(sb, result)
    if not work_id:
        return None

    cleanup_work_data(sb, work_id)

    pasal_nodes = load_nodes_recursive(sb, work_id, result["nodes"])
    create_chunks(sb, work_id, result, pasal_nodes)

    # Update works with parse metadata
    sb.table("works").update({
        "slug": result.get("slug"),
        "pdf_quality": result.get("pdf_quality"),
        "parse_method": result.get("parse_method"),
        "parse_confidence": result.get("parse_confidence"),
        "parse_errors": result.get("parse_errors", []),
        "parsed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", work_id).execute()

    # Create initial_parse revision for each pasal
    for pn in pasal_nodes:
        try:
            sb.table("revisions").insert({
                "work_id": work_id,
                "node_id": pn["node_id"],
                "node_type": pn.get("node_type", "pasal"),
                "node_number": pn.get("number", ""),
                "old_content": None,
                "new_content": pn["content"],
                "revision_type": "initial_parse",
                "reason": f"Initial parse via {result.get('parse_method', 'pymupdf')}",
                "actor_type": "system",
            }).execute()
        except Exception:
            pass  # Skip revision errors (non-critical)

    return work_id


def _dedup_pdfs(pdf_files: list[Path]) -> list[Path]:
    """Deduplicate PDFs that represent the same regulation.

    Prefers short format (uu-13-2003) over long format (uu-no-13-tahun-2003)
    because they tend to have more reliable content. Skips files with extra
    suffixes like -dpr, -new.
    """
    seen_keys: dict[str, Path] = {}
    skipped: list[str] = []

    for pdf_path in pdf_files:
        stem = pdf_path.stem

        # Skip files with extra suffixes (known bad downloads)
        if re.search(r'-(dpr|new|old|backup|copy)\b', stem, re.IGNORECASE):
            skipped.append(stem)
            continue

        m = FILENAME_LONG_RE.match(stem) or FILENAME_SHORT_RE.match(stem)
        if not m:
            skipped.append(stem)
            continue

        key = f"{m.group(1).upper()}-{m.group(2)}-{m.group(3)}"
        is_short = bool(FILENAME_SHORT_RE.match(stem))

        if key not in seen_keys:
            seen_keys[key] = pdf_path
        elif is_short:
            # Prefer short format (tends to have better content)
            seen_keys[key] = pdf_path

    if skipped:
        print(f"Skipped {len(skipped)} files with unrecognized names: {skipped[:5]}")

    return sorted(seen_keys.values())


def main():
    parser = argparse.ArgumentParser(description="Parse legal PDFs into structured data")
    parser.add_argument("--pdf", type=str, help="Single PDF file path")
    parser.add_argument("--dir", type=str, help="Directory of PDFs to process")
    parser.add_argument("--limit", type=int, help="Max PDFs to process")
    parser.add_argument("--load", action="store_true", help="Also load into Supabase")
    parser.add_argument("--save-json", action="store_true", default=True, help="Save parsed JSON")
    parser.add_argument("--no-dedup", action="store_true", help="Disable deduplication")
    args = parser.parse_args()

    PARSED_DIR.mkdir(parents=True, exist_ok=True)

    if args.pdf:
        pdf_files = [Path(args.pdf)]
    elif args.dir:
        pdf_files = sorted(Path(args.dir).glob("*.pdf"))
    else:
        pdf_files = sorted((DATA_DIR / "raw" / "pdfs").glob("*.pdf"))

    if not args.pdf and not args.no_dedup:
        pdf_files = _dedup_pdfs(pdf_files)

    if args.limit:
        pdf_files = pdf_files[:args.limit]

    print(f"Processing {len(pdf_files)} PDFs...")

    results = []
    failed = []
    for i, pdf_path in enumerate(pdf_files):
        print(f"\n[{i+1}/{len(pdf_files)}] {pdf_path.name}")
        result = process_pdf(pdf_path)

        if not result:
            failed.append(pdf_path.name)
            continue

        results.append(result)

        if args.save_json:
            safe_name = result["frbr_uri"].replace("/", "_").lstrip("_")
            out_path = PARSED_DIR / f"{safe_name}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

        if args.load:
            work_id = load_to_db(result)
            if work_id:
                print(f"  Loaded: work_id={work_id}")
            else:
                print(f"  Failed to load into DB")
                failed.append(pdf_path.name)

    print(f"\n=== Summary: {len(results)}/{len(pdf_files)} parsed ===")
    total_pasals = sum(r["stats"]["pasal_count"] for r in results)
    print(f"Total pasals: {total_pasals}")
    valid = sum(1 for r in results if r["validation"]["valid"])
    print(f"Valid: {valid}/{len(results)}")
    if failed:
        print(f"Failed ({len(failed)}): {failed}")


if __name__ == "__main__":
    main()
