"""CLI entrypoint for the Pasal.id Correction Agent.

Usage:
    # Process one batch then exit
    python -m scripts.agent.run_correction_agent --once

    # Run continuously (default — polls every POLL_INTERVAL_SECONDS)
    python -m scripts.agent.run_correction_agent

    # Analyze parser feedback and create GitHub issues
    python -m scripts.agent.run_correction_agent --analyze-parser
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add scripts/ to sys.path so `from agent.X` resolves
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.correction_worker import run_once, run_worker


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pasal.id Correction Agent — Opus 4.6 verification worker",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process one batch of pending suggestions, then exit",
    )
    parser.add_argument(
        "--analyze-parser",
        action="store_true",
        help="Aggregate parser feedback and create GitHub improvement issues",
    )

    args = parser.parse_args()

    if args.analyze_parser:
        from agent.parser_improver import run_parser_analysis
        asyncio.run(run_parser_analysis(force=True))
        sys.exit(0)

    if args.once:
        asyncio.run(run_once())
    else:
        try:
            asyncio.run(run_worker())
        except KeyboardInterrupt:
            print("\nShutting down correction agent.", flush=True)


if __name__ == "__main__":
    main()
