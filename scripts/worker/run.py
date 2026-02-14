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

# Graceful dotenv loading — Railway sets env vars directly, no .env needed
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).parent.parent))

from worker.discover import REG_TYPES, discover_regulations
from worker.process import EXTRACTION_VERSION, _create_run, _update_run, process_jobs, reprocess_jobs
from crawler.db import get_sb

EMPTY_STATS = {"processed": 0, "succeeded": 0, "failed": 0}


def cmd_discover(args: argparse.Namespace) -> None:
    """Discover regulations from listing pages."""
    types = args.types.split(",") if args.types else None
    max_pages = args.max_pages
    freshness = getattr(args, "freshness_hours", 24.0)
    ignore_fresh = getattr(args, "ignore_freshness", False)

    print("=== DISCOVER ===")
    print(f"Types: {types or 'all'}")
    print(f"Max pages per type: {max_pages or 'all'}")
    print(f"Freshness: {freshness}h (ignore={ignore_fresh})")
    print(f"Dry run: {args.dry_run}")

    stats = asyncio.run(discover_regulations(
        reg_types=types,
        max_pages_per_type=max_pages,
        dry_run=args.dry_run,
        freshness_hours=freshness,
        ignore_freshness=ignore_fresh,
    ))

    print("\n=== DISCOVER RESULTS ===")
    print(f"Types crawled: {stats['types_crawled']}")
    print(f"Types skipped (fresh): {stats['types_skipped_fresh']}")
    print(f"Pages crawled: {stats['pages_crawled']}")
    print(f"Regulations discovered: {stats['discovered']}")
    print(f"Jobs upserted: {stats['upserted']}")


def cmd_process(args: argparse.Namespace) -> None:
    """Process pending crawl jobs."""
    print("=== PROCESS ===")
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
        _update_run(run_id, EMPTY_STATS, "failed", str(e))
        raise

    print("\n=== PROCESS RESULTS ===")
    print(f"Run ID: {run_id}")
    print(f"Processed: {stats['processed']}")
    print(f"Succeeded: {stats['succeeded']}")
    print(f"Failed: {stats['failed']}")


def cmd_full(args: argparse.Namespace) -> None:
    """Full run: discover then process."""
    print("=== FULL RUN ===\n")

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
        _update_run(run_id, EMPTY_STATS, "failed", str(e))
        raise

    print("\n=== FULL RUN RESULTS ===")
    print(f"Run ID: {run_id}")
    print(f"Discovered: {discover_stats['discovered']}")
    print(f"Processed: {process_stats['processed']}")
    print(f"Succeeded: {process_stats['succeeded']}")
    print(f"Failed: {process_stats['failed']}")


def cmd_reprocess(args: argparse.Namespace) -> None:
    """Re-extract from existing local PDFs without re-downloading."""
    print("=== REPROCESS ===")
    print(f"Extraction version: {EXTRACTION_VERSION}")
    print(f"Force: {args.force}")
    print(f"Batch size: {args.batch_size}")

    stats = reprocess_jobs(
        batch_size=args.batch_size,
        force=args.force,
    )

    print("\n=== REPROCESS RESULTS ===")
    print(f"Processed: {stats['processed']}")
    print(f"Succeeded: {stats['succeeded']}")
    print(f"Failed: {stats['failed']}")
    print(f"Skipped (no PDF): {stats['skipped']}")


def cmd_continuous(args: argparse.Namespace) -> None:
    """Run continuously: loop discover → process → sleep → repeat forever.

    Designed for Railway as a long-running service (not a cron job).
    Multiple workers can run concurrently — job claiming is atomic via
    the claim_jobs() SQL function (FOR UPDATE SKIP LOCKED).

    With --discovery-first, the first iteration runs discovery for ALL types
    (ignoring freshness) and skips processing. Subsequent iterations run normally.
    """
    import time

    all_types = list(REG_TYPES.keys())
    types = args.types.split(",") if args.types else all_types
    batch_size = args.batch_size
    sleep_between = args.sleep  # seconds between batches
    do_discover = args.discover
    discovery_first = getattr(args, "discovery_first", False)
    freshness_hours = getattr(args, "freshness_hours", 24.0)

    print("=== CONTINUOUS MODE ===")
    print(f"Discovery types: {types}")
    print(f"Discovery enabled: {do_discover}")
    print(f"Discovery-first mode: {discovery_first}")
    print(f"Freshness threshold: {freshness_hours}h")
    print(f"Batch size: {batch_size}")
    print(f"Sleep between batches: {sleep_between}s")
    if do_discover:
        print(f"Discover every N batches: {args.discover_interval}")
    print()

    batch_count = 0
    total_processed = 0
    total_succeeded = 0

    while True:
        batch_count += 1

        # --discovery-first: first iteration is discovery-only (ignore freshness), skip processing
        if discovery_first and batch_count == 1 and do_discover:
            print(f"\n--- Batch {batch_count}: DISCOVERY-FIRST (all {len(types)} types, ignoring freshness) ---")
            try:
                discover_stats = asyncio.run(discover_regulations(
                    reg_types=types,
                    max_pages_per_type=args.max_pages,
                    ignore_freshness=True,
                ))
                print(f"  Discovered {discover_stats['discovered']} regulations "
                      f"({discover_stats['types_crawled']} types crawled, "
                      f"{discover_stats['types_skipped_fresh']} skipped)")
            except Exception as e:
                print(f"  Discovery failed: {e}")
            print(f"  Discovery-first complete. Sleeping {sleep_between}s before starting processing...")
            time.sleep(sleep_between)
            continue

        # Periodically discover new regulations (only if this worker has discovery enabled)
        if do_discover and (batch_count == 1 or batch_count % args.discover_interval == 0):
            print(f"\n--- Batch {batch_count}: DISCOVERING ---")
            try:
                discover_stats = asyncio.run(discover_regulations(
                    reg_types=types,
                    max_pages_per_type=args.max_pages,
                    freshness_hours=freshness_hours,
                ))
                print(f"  Discovered {discover_stats['discovered']} regulations "
                      f"({discover_stats['types_skipped_fresh']} types skipped as fresh)")
            except Exception as e:
                print(f"  Discovery failed: {e}")

        # Process a batch — claim_jobs() ensures no two workers get the same jobs
        print(f"\n--- Batch {batch_count}: PROCESSING (batch_size={batch_size}) ---")
        run_id = _create_run("continuous")

        try:
            stats = asyncio.run(process_jobs(
                batch_size=batch_size,
                max_runtime=args.max_runtime,
                run_id=run_id,
            ))
            _update_run(run_id, stats, "completed")

            total_processed += stats["processed"]
            total_succeeded += stats["succeeded"]

            print(f"  Batch: {stats['processed']} processed, {stats['succeeded']} ok, {stats['failed']} fail")
            print(f"  Total: {total_processed} processed, {total_succeeded} succeeded")

            # If no pending jobs, try reprocessing old extractions
            if stats["processed"] == 0:
                print(f"\n--- Batch {batch_count}: REPROCESSING outdated extractions ---")
                rp_stats = reprocess_jobs(batch_size=batch_size)
                if rp_stats["processed"] > 0:
                    print(f"  Reprocessed: {rp_stats['processed']}, ok: {rp_stats['succeeded']}, "
                          f"fail: {rp_stats['failed']}, skip: {rp_stats['skipped']}")
                    time.sleep(sleep_between)
                else:
                    print(f"  Nothing to reprocess. Sleeping {sleep_between * 5}s...")
                    time.sleep(sleep_between * 5)
            else:
                time.sleep(sleep_between)

        except Exception as e:
            _update_run(run_id, EMPTY_STATS, "failed", str(e))
            print(f"  ERROR: {e}")
            time.sleep(sleep_between * 2)


def cmd_retry_failed(args: argparse.Namespace) -> None:
    """Reset failed jobs back to pending so they can be retried."""
    sb = get_sb()

    query = sb.table("crawl_jobs").select("id", count="exact").eq("status", "failed")
    if args.error_like:
        query = query.like("error_message", f"%{args.error_like}%")
    result = query.execute()
    count = result.count or 0

    if count == 0:
        print("No failed jobs to retry.")
        return

    if args.dry_run:
        print(f"Would reset {count} failed jobs to pending (dry run).")
        return

    limit = args.limit or count
    # Reset in batches
    reset = 0
    while reset < limit:
        batch_q = sb.table("crawl_jobs").select("id").eq("status", "failed")
        if args.error_like:
            batch_q = batch_q.like("error_message", f"%{args.error_like}%")
        batch = batch_q.limit(min(200, limit - reset)).execute()
        if not batch.data:
            break
        ids = [r["id"] for r in batch.data]
        sb.table("crawl_jobs").update({
            "status": "pending",
            "error_message": None,
        }).in_("id", ids).execute()
        reset += len(ids)

    print(f"Reset {reset} failed jobs to pending (of {count} total failed).")


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
            print("\n=== RECENT RUNS ===")
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
    p_discover.add_argument("--types", help="Comma-separated types (default: all 12 types)")
    p_discover.add_argument("--max-pages", type=int, help="Max pages per type")
    p_discover.add_argument("--freshness-hours", type=float, default=24.0,
                            help="Skip types discovered within this many hours (default: 24)")
    p_discover.add_argument("--ignore-freshness", action="store_true",
                            help="Always crawl regardless of freshness cache")
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

    # continuous
    p_cont = sub.add_parser("continuous", help="Run continuously (long-running service)")
    p_cont.add_argument("--types", help="Comma-separated types for discovery (default: all 12 types)")
    p_cont.add_argument("--max-pages", type=int, help="Max pages per type for discovery (default: all pages)")
    p_cont.add_argument("--batch-size", type=int, default=100, help="Jobs per batch (default: 100)")
    p_cont.add_argument("--max-runtime", type=int, default=3600, help="Max runtime per batch in seconds")
    p_cont.add_argument("--sleep", type=int, default=10, help="Seconds between batches (default: 10)")
    p_cont.add_argument("--discover-interval", type=int, default=5, help="Discover every N batches (default: 5)")
    p_cont.add_argument("--discover", action=argparse.BooleanOptionalAction, default=True,
                         help="Enable/disable discovery (default: enabled). Use --no-discover for process-only workers.")
    p_cont.add_argument("--discovery-first", action="store_true",
                         help="First iteration: discover ALL types (ignore freshness), skip processing. "
                              "Subsequent iterations run normally.")
    p_cont.add_argument("--freshness-hours", type=float, default=24.0,
                         help="Skip types discovered within this many hours (default: 24)")

    # retry-failed
    p_retry = sub.add_parser("retry-failed", help="Reset failed jobs to pending for retry")
    p_retry.add_argument("--error-like", help="Only retry jobs whose error_message contains this string")
    p_retry.add_argument("--limit", type=int, help="Max jobs to reset")
    p_retry.add_argument("--dry-run", action="store_true", help="Show count without resetting")

    # stats
    sub.add_parser("stats", help="Show scraper stats")

    args = parser.parse_args()

    commands = {
        "discover": cmd_discover,
        "process": cmd_process,
        "full": cmd_full,
        "continuous": cmd_continuous,
        "reprocess": cmd_reprocess,
        "retry-failed": cmd_retry_failed,
        "stats": cmd_stats,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
