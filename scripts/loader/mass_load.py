"""Batch upsert regulation metadata into the works table.

Reads metadata JSON files from data/raw/metadata/ and upserts into works.
Does NOT delete existing data — only adds or updates.

Usage:
    python mass_load.py
    python mass_load.py --limit 100 --dry-run
"""
import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "metadata"

# Runtime cache for regulation_types
_reg_type_cache: dict[str, int] | None = None


def _get_reg_type_map(sb) -> dict[str, int]:
    """Load regulation type code -> id mapping from DB."""
    global _reg_type_cache
    if _reg_type_cache is not None:
        return _reg_type_cache
    result = sb.table("regulation_types").select("id, code").execute()
    _reg_type_cache = {r["code"]: r["id"] for r in result.data}
    return _reg_type_cache


def _build_frbr_uri(type_code: str, number: str, year: int) -> str:
    """Generate FRBR URI from type, number, year."""
    act_code = type_code.lower()
    return f"/akn/id/act/{act_code}/{year}/{number}"


def _type_name(code: str) -> str:
    """Get Indonesian name for regulation type code."""
    names = {
        "UU": "Undang-Undang", "PP": "Peraturan Pemerintah",
        "PERPRES": "Peraturan Presiden", "PERPPU": "Peraturan Pemerintah Pengganti Undang-Undang",
        "PERMEN": "Peraturan Menteri", "PERBAN": "Peraturan Badan",
        "PERDA": "Peraturan Daerah", "KEPPRES": "Keputusan Presiden",
        "INPRES": "Instruksi Presiden", "TAP_MPR": "Ketetapan MPR",
        "PERMENKUMHAM": "Peraturan Menteri Hukum dan HAM",
        "PERMENKUM": "Peraturan Menteri Hukum",
        "KEPMEN": "Keputusan Menteri", "SE": "Surat Edaran",
        "PERMA": "Peraturan Mahkamah Agung", "PBI": "Peraturan Bank Indonesia",
    }
    return names.get(code, code)


def upsert_work(sb, meta: dict, reg_type_map: dict[str, int]) -> int | None:
    """Upsert a single work from metadata dict. Returns work ID or None."""
    type_code = meta.get("type_code")
    if not type_code:
        return None

    reg_type_id = reg_type_map.get(type_code)
    if not reg_type_id:
        return None

    number = meta.get("number", "")
    year = meta.get("year")
    if not number or not year:
        return None

    slug = meta.get("slug", "")
    frbr_uri = _build_frbr_uri(type_code, number, year)

    title = meta.get("title", "")
    if not title:
        type_name = _type_name(type_code)
        title = f"{type_name} Nomor {number} Tahun {year}"

    work_data: dict = {
        "frbr_uri": frbr_uri,
        "regulation_type_id": reg_type_id,
        "number": number,
        "year": year,
        "title_id": title,
        "status": meta.get("status", "berlaku"),
        "slug": slug or None,
        "source_url": f"https://peraturan.go.id/id/{slug}" if slug else None,
        "source_pdf_url": meta.get("pdf_url"),
    }

    # Add optional metadata columns
    for col in ("pemrakarsa", "tempat_penetapan", "tanggal_penetapan",
                 "pejabat_penetap", "tanggal_pengundangan", "pejabat_pengundangan",
                 "nomor_pengundangan", "nomor_tambahan"):
        if col in meta and meta[col]:
            work_data[col] = meta[col]

    try:
        result = sb.table("works").upsert(
            work_data, on_conflict="frbr_uri"
        ).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        print(f"  Error upserting {slug}: {e}")
    return None


def main():
    parser = argparse.ArgumentParser(description="Batch upsert regulation metadata into works")
    parser.add_argument("--limit", type=int, help="Max files to process")
    parser.add_argument("--dry-run", action="store_true", help="Count without writing")
    parser.add_argument("--input-dir", type=str, default=str(DATA_DIR), help="Metadata directory")
    args = parser.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    reg_type_map = _get_reg_type_map(sb)
    print(f"Loaded {len(reg_type_map)} regulation types")

    input_dir = Path(args.input_dir)
    meta_files = sorted(input_dir.glob("*.json"))
    if args.limit:
        meta_files = meta_files[:args.limit]

    print(f"Processing {len(meta_files)} metadata files...")

    stats = {"upserted": 0, "skipped": 0, "errors": 0}
    for i, mf in enumerate(meta_files):
        try:
            meta = json.loads(mf.read_text())
        except Exception as e:
            print(f"  Error reading {mf.name}: {e}")
            stats["errors"] += 1
            continue

        if args.dry_run:
            type_code = meta.get("type_code", "?")
            number = meta.get("number", "?")
            year = meta.get("year", "?")
            print(f"  [DRY RUN] {type_code} {number}/{year} from {mf.name}")
            stats["upserted"] += 1
            continue

        work_id = upsert_work(sb, meta, reg_type_map)
        if work_id:
            stats["upserted"] += 1
        else:
            stats["skipped"] += 1

        if (i + 1) % 50 == 0:
            print(f"  [{i+1}/{len(meta_files)}] {stats['upserted']} upserted, {stats['skipped']} skipped")

    print(f"\n=== Mass load: {stats['upserted']} upserted, {stats['skipped']} skipped, {stats['errors']} errors ===")


if __name__ == "__main__":
    main()
