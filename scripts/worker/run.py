"""Scraper worker entry point.

Usage:
    # Discover new regulations from listing pages
    python -m scripts.worker.run discover --types uu,pp --max-pages 5

    # Process pending jobs (download, parse, load)
    python -m scripts.worker.run process --batch-size 20

    # Full run: discover then process (what the cron job calls)
    python -m scripts.worker.run full --types uu,pp --batch-size 20

    # Re-extract from existing PDFs (no re-download)
    python -m scripts.worker.run reprocess --force

    # Check stats
    python -m scripts.worker.run stats
"""
import argparse
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent.parent))

from worker.discover import discover_regulations
from worker.process import EXTRACTION_VERSION, _create_run, _update_run, process_jobs, reprocess_jobs
from crawler.db import get_sb


def cmd_discover(args: argparse.Namespace) -> None:
    """Discover regulations from listing pages."""
    types = args.types.split(",") if args.types else None
    max_pages = args.max_pages

    print(f"=== DISCOVER ===")
    print(f"Types: {types or 'all'}")
    print(f"Max pages per type: {max_pages or 'all'}")
    print(f"Dry run: {args.dry_run}")

    stats = asyncio.run(discover_regulations(
        reg_types=types,
        max_pages_per_type=max_pages,
        dry_run=args.dry_run,
    ))

    print(f"\n=== DISCOVER RESULTS ===")
    print(f"Types crawled: {stats['types_crawled']}")
    print(f"Pages crawled: {stats['pages_crawled']}")
    print(f"Regulations discovered: {stats['discovered']}")
    print(f"Jobs upserted: {stats['upserted']}")


def cmd_process(args: argparse.Namespace) -> None:
    """Process pending crawl jobs."""
    print(f"=== PROCESS ===")
    print(f"Batch size: {args.batch_size}")
    print(f"Max runtime: {args.max_runtime}s")

    run_id = _create_run(args.source)

    try:
        stats = asyncio.run(process_jobs(
            source_id=args.source,
            batch_size=args.batch_size,
            max_runtime=args.max_runtime,
            run_id=run_id,
        ))
        _update_run(run_id, stats, "completed")
    except Exception as e:
        _update_run(run_id, {"processed": 0, "succeeded": 0, "failed": 0}, "failed", str(e))
        raise

    print(f"\n=== PROCESS RESULTS ===")
    print(f"Run ID: {run_id}")
    print(f"Processed: {stats['processed']}")
    print(f"Succeeded: {stats['succeeded']}")
    print(f"Failed: {stats['failed']}")


def cmd_full(args: argparse.Namespace) -> None:
    """Full run: discover then process."""
    print(f"=== FULL RUN ===\n")

    # Phase 1: Discover
    types = args.types.split(",") if args.types else ["uu", "pp"]
    max_pages = args.max_pages or 5  # Default: 5 pages per type in full mode

    print(f"Phase 1: Discovering {types}, max {max_pages} pages each...")
    discover_stats = asyncio.run(discover_regulations(
        reg_types=types,
        max_pages_per_type=max_pages,
    ))
    print(f"  Discovered {discover_stats['discovered']} regulations")

    # Phase 2: Process
    print(f"\nPhase 2: Processing up to {args.batch_size} pending jobs...")
    run_id = _create_run(",".join(types))

    try:
        # Update run with discovery count
        get_sb().table("scraper_runs").update({
            "jobs_discovered": discover_stats["discovered"],
        }).eq("id", run_id).execute()

        process_stats = asyncio.run(process_jobs(
            batch_size=args.batch_size,
            max_runtime=args.max_runtime,
            run_id=run_id,
        ))
        _update_run(run_id, process_stats, "completed")
    except Exception as e:
        _update_run(run_id, {"processed": 0, "succeeded": 0, "failed": 0}, "failed", str(e))
        raise

    print(f"\n=== FULL RUN RESULTS ===")
    print(f"Run ID: {run_id}")
    print(f"Discovered: {discover_stats['discovered']}")
    print(f"Processed: {process_stats['processed']}")
    print(f"Succeeded: {process_stats['succeeded']}")
    print(f"Failed: {process_stats['failed']}")


def cmd_reprocess(args: argparse.Namespace) -> None:
    """Re-extract from existing local PDFs without re-downloading."""
    print(f"=== REPROCESS ===")
    print(f"Extraction version: {EXTRACTION_VERSION}")
    print(f"Force: {args.force}")
    print(f"Batch size: {args.batch_size}")

    stats = reprocess_jobs(
        batch_size=args.batch_size,
        force=args.force,
    )

    print(f"\n=== REPROCESS RESULTS ===")
    print(f"Processed: {stats['processed']}")
    print(f"Succeeded: {stats['succeeded']}")
    print(f"Failed: {stats['failed']}")
    print(f"Skipped (no PDF): {stats['skipped']}")


def cmd_stats(args: argparse.Namespace) -> None:
    """Show current scraper stats."""
    sb = get_sb()

    # Job counts by status
    print("=== CRAWL JOB STATS ===")
    for status in ["pending", "crawling", "downloaded", "parsed", "loaded", "failed"]:
        result = sb.table("crawl_jobs").select("id", count="exact").eq("status", status).execute()
        print(f"  {status:>12}: {result.count or 0}")

    # Total works and chunks
    works = sb.table("works").select("id", count="exact").execute()
    chunks = sb.table("legal_chunks").select("id", count="exact").execute()
    print(f"\n  Total works: {works.count or 0}")
    print(f"  Total chunks: {chunks.count or 0}")

    # Recent runs
    try:
        runs = sb.table("scraper_runs").select("*").order("started_at", desc=True).limit(5).execute()
        if runs.data:
            print(f"\n=== RECENT RUNS ===")
            for r in runs.data:
                print(f"  #{r['id']} [{r['status']}] {r['source_id']} — "
                      f"processed:{r['jobs_processed']} ok:{r['jobs_succeeded']} fail:{r['jobs_failed']} "
                      f"@ {r['started_at']}")
    except Exception:
        print("\n  (scraper_runs table not found — apply migration 013)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pasal.id scraper worker")
    sub = parser.add_subparsers(dest="command", required=True)

    # discover
    p_discover = sub.add_parser("discover", help="Discover regulations from listing pages")
    p_discover.add_argument("--types", help="Comma-separated types: uu,pp,perpres,permen,perban,perda")
    p_discover.add_argument("--max-pages", type=int, help="Max pages per type")
    p_discover.add_argument("--dry-run", action="store_true")

    # process
    p_process = sub.add_parser("process", help="Process pending crawl jobs")
    p_process.add_argument("--source", help="Filter by source_id")
    p_process.add_argument("--batch-size", type=int, default=20)
    p_process.add_argument("--max-runtime", type=int, default=1500)

    # full
    p_full = sub.add_parser("full", help="Full run: discover then process")
    p_full.add_argument("--types", help="Comma-separated types (default: uu,pp)")
    p_full.add_argument("--max-pages", type=int, help="Max pages per type (default: 5)")
    p_full.add_argument("--batch-size", type=int, default=20)
    p_full.add_argument("--max-runtime", type=int, default=1500)

    # reprocess
    p_reprocess = sub.add_parser("reprocess", help="Re-extract from existing PDFs (no re-download)")
    p_reprocess.add_argument("--force", action="store_true", help="Reprocess all, not just outdated versions")
    p_reprocess.add_argument("--batch-size", type=int, default=50)

    # stats
    sub.add_parser("stats", help="Show scraper stats")

    args = parser.parse_args()

    commands = {
        "discover": cmd_discover,
        "process": cmd_process,
        "full": cmd_full,
        "reprocess": cmd_reprocess,
        "stats": cmd_stats,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
