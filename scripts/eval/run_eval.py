"""CLI entry point for the parser evaluation pipeline.

Usage:
    # Evaluate a single PDF
    python -m scripts.eval.run_eval single data/raw/pdfs/uu-no-13-tahun-2003.pdf

    # Evaluate all PDFs in a directory
    python -m scripts.eval.run_eval batch --dir data/raw/pdfs/ --limit 5

    # Show summary of previous evaluation results
    python -m scripts.eval.run_eval report
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load env vars from scripts/.env
load_dotenv(Path(__file__).parent.parent / ".env")

from .compare import compare_extractions
from .gemini_extract import extract_with_gemini
from .models import DiffReport
from .our_extract import extract_with_our_parser

DATA_DIR = Path(__file__).parent.parent.parent / "data"
DIFFS_DIR = DATA_DIR / "eval" / "diffs"


def run_single(pdf_path: Path, force_gemini: bool = False) -> DiffReport:
    """Evaluate a single PDF: run both parsers and compare."""
    slug = pdf_path.stem
    print(f"\n{'='*60}")
    print(f"Evaluating: {slug}")
    print(f"{'='*60}")

    # Run our parser
    print("\n[1/3] Running our regex parser...")
    ours = extract_with_our_parser(pdf_path)
    print(f"  Our parser: {ours.total_pasal_count} pasals, {len(ours.babs)} BABs")

    # Run Gemini
    print("\n[2/3] Running Gemini extraction...")
    gemini = extract_with_gemini(pdf_path, force=force_gemini)
    print(f"  Gemini: {gemini.total_pasal_count} pasals, {len(gemini.babs)} BABs")

    # Compare
    print("\n[3/3] Comparing extractions...")
    report = compare_extractions(ours, gemini, pdf_path.name)

    # Save diff report
    DIFFS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = DIFFS_DIR / f"{slug}.json"
    report_path.write_text(
        report.model_dump_json(indent=2),
        encoding="utf-8",
    )
    print(f"\nDiff report saved to: {report_path}")

    # Print summary
    print(f"\n{report.summary}")

    return report


def run_batch(pdf_dir: Path, limit: int | None = None, force_gemini: bool = False) -> list[DiffReport]:
    """Evaluate all PDFs in a directory."""
    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {pdf_dir}")
        return []

    if limit:
        pdf_files = pdf_files[:limit]

    print(f"Evaluating {len(pdf_files)} PDFs from {pdf_dir}")
    reports: list[DiffReport] = []

    for i, pdf_path in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}]", end="")
        try:
            report = run_single(pdf_path, force_gemini=force_gemini)
            reports.append(report)
        except Exception as e:
            print(f"\n  ERROR evaluating {pdf_path.name}: {e}")

    # Print aggregate summary
    if reports:
        print_aggregate_summary(reports)

    return reports


def print_aggregate_summary(reports: list[DiffReport]) -> None:
    """Print an aggregate summary across all evaluated PDFs."""
    print(f"\n{'='*60}")
    print(f"AGGREGATE SUMMARY ({len(reports)} PDFs)")
    print(f"{'='*60}")

    total_ours = sum(r.pasal_count_ours for r in reports)
    total_gemini = sum(r.pasal_count_gemini for r in reports)
    total_missing_ours = sum(len(r.missing_in_ours) for r in reports)
    total_missing_gemini = sum(len(r.missing_in_gemini) for r in reports)

    print(f"\nTotal pasals: ours={total_ours}, gemini={total_gemini}")
    print(f"Total missing in ours: {total_missing_ours}")
    print(f"Total missing in Gemini: {total_missing_gemini}")

    # All content diffs
    all_diffs = [d for r in reports for d in r.content_diffs]
    if all_diffs:
        avg_sim = sum(d.content_similarity for d in all_diffs) / len(all_diffs)
        print(f"\nContent diffs: {len(all_diffs)} pasals with differences")
        print(f"Average similarity (among differing): {avg_sim:.2%}")

        # Aggregate issues
        issue_counts: dict[str, int] = {}
        for d in all_diffs:
            for issue in d.issues:
                base = issue.split(" (")[0]
                issue_counts[base] = issue_counts.get(base, 0) + 1

        if issue_counts:
            print("\nTop issues:")
            for issue, count in sorted(issue_counts.items(), key=lambda x: -x[1])[:10]:
                print(f"  {count:3d}x  {issue}")

    # Per-PDF summary table
    print(f"\nPer-PDF breakdown:")
    print(f"  {'PDF':<40} {'Ours':>5} {'Gemini':>7} {'Miss(O)':>8} {'Miss(G)':>8} {'Diffs':>6}")
    print(f"  {'-'*40} {'-'*5} {'-'*7} {'-'*8} {'-'*8} {'-'*6}")
    for r in reports:
        name = r.pdf_file[:40]
        print(
            f"  {name:<40} {r.pasal_count_ours:>5} {r.pasal_count_gemini:>7} "
            f"{len(r.missing_in_ours):>8} {len(r.missing_in_gemini):>8} "
            f"{len(r.content_diffs):>6}"
        )


def show_report() -> None:
    """Show a summary of existing evaluation results."""
    if not DIFFS_DIR.exists():
        print("No evaluation results found. Run 'single' or 'batch' first.")
        return

    report_files = sorted(DIFFS_DIR.glob("*.json"))
    if not report_files:
        print("No evaluation results found. Run 'single' or 'batch' first.")
        return

    reports: list[DiffReport] = []
    for f in report_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            reports.append(DiffReport.model_validate(data))
        except Exception as e:
            print(f"  Warning: skipping invalid report {f.name}: {e}")

    if reports:
        print_aggregate_summary(reports)
    else:
        print("No valid evaluation results found.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate PDF parser against Gemini Pro 3 extraction",
        prog="python -m scripts.eval.run_eval",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # single
    p_single = sub.add_parser("single", help="Evaluate a single PDF")
    p_single.add_argument("pdf", type=Path, help="Path to the PDF file")
    p_single.add_argument("--force", action="store_true", help="Force re-call Gemini API (skip cache)")

    # batch
    p_batch = sub.add_parser("batch", help="Evaluate all PDFs in a directory")
    p_batch.add_argument("--dir", type=Path, default=DATA_DIR / "raw" / "pdfs", help="Directory with PDFs")
    p_batch.add_argument("--limit", type=int, default=None, help="Max number of PDFs to evaluate")
    p_batch.add_argument("--force", action="store_true", help="Force re-call Gemini API (skip cache)")

    # report
    sub.add_parser("report", help="Show summary of previous evaluation results")

    args = parser.parse_args()

    if args.command == "single":
        if not args.pdf.exists():
            print(f"Error: PDF not found: {args.pdf}")
            sys.exit(1)
        run_single(args.pdf, force_gemini=args.force)
    elif args.command == "batch":
        if not args.dir.exists():
            print(f"Error: directory not found: {args.dir}")
            sys.exit(1)
        run_batch(args.dir, limit=args.limit, force_gemini=args.force)
    elif args.command == "report":
        show_report()


if __name__ == "__main__":
    main()
