"""Seed crawl jobs from various sources."""
import argparse

from .dedup import build_frbr_uri, is_work_duplicate
from .state import upsert_job


def seed_from_otf_corpus() -> int:
    """Create crawl jobs from OTF GitHub corpus metadata.

    NOTE: This is a stub — full implementation would clone the repo
    and parse the directory structure. For now, it demonstrates the
    interface for seeding jobs.
    """
    # Example seed data — in production, this would scan the cloned repo
    sample_laws = [
        {"type": "UU", "number": "11", "year": 2020, "title": "Cipta Kerja"},
        {"type": "UU", "number": "27", "year": 2022, "title": "Perlindungan Data Pribadi"},
        {"type": "PP", "number": "35", "year": 2021, "title": "PKWT, Alih Daya, Waktu Kerja"},
    ]

    created = 0
    for law in sample_laws:
        frbr = build_frbr_uri(law["type"], law["number"], law["year"])
        if is_work_duplicate(frbr):
            print(f"SKIP (exists): {frbr}")
            continue
        upsert_job({
            "source_id": "otf_corpus",
            "url": f"https://github.com/Open-Technology-Foundation/peraturan.go.id/tree/main/{law['type']}/{law['year']}/{law['number']}",
            "regulation_type": law["type"],
            "number": law["number"],
            "year": law["year"],
            "title": law["title"],
            "frbr_uri": frbr,
            "status": "pending",
        })
        print(f"CREATED: {frbr} — {law['title']}")
        created += 1

    return created


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed crawl jobs")
    parser.add_argument("--source", required=True, choices=["otf_corpus"])
    args = parser.parse_args()

    if args.source == "otf_corpus":
        count = seed_from_otf_corpus()
        print(f"\nSeeded {count} new jobs.")


if __name__ == "__main__":
    main()
