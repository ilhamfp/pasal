"""Correction worker — polls pending suggestions, verifies with Opus 4.6.

Fetches unclaimed suggestions from the DB, gathers context (sibling nodes,
PDF page image), sends to Opus 4.6 for verification, stores the result,
and auto-applies high-confidence corrections via apply_revision().
"""

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load agent-specific env first (overrides), then scripts/.env (fallback)
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

from agent.pdf_utils import get_supabase, find_page_for_node, fetch_pdf_page_image
from agent.opus_verify import verify_with_opus
from agent.apply_revision import apply_revision
from agent.logger import (
    log_banner,
    log_poll_idle,
    log_suggestion_header,
    log_decision,
    log_skipped,
    log_total_time,
    StepTimer,
)

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_AUTO_APPLY_THRESHOLD", "0.85"))
MAX_PER_RUN = int(os.environ.get("MAX_SUGGESTIONS_PER_RUN", "5"))


def fetch_pending_suggestions(limit: int = 5) -> list[dict]:
    """Fetch unclaimed pending suggestions, oldest first."""
    sb = get_supabase()
    result = (
        sb.table("suggestions")
        .select("*")
        .eq("status", "pending")
        .is_("agent_triggered_at", "null")
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return result.data or []


async def process_suggestion(suggestion: dict) -> dict | None:
    """Process a single suggestion through the Opus 4.6 verification pipeline.

    Returns the verification result dict, or None if skipped.
    """
    t0 = time.monotonic()
    sb = get_supabase()
    suggestion_id = suggestion["id"]

    # ── Step A: Claim the job (optimistic lock) ──────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    claim = (
        sb.table("suggestions")
        .update({"agent_triggered_at": now_iso})
        .eq("id", suggestion_id)
        .is_("agent_triggered_at", "null")
        .execute()
    )
    if not claim.data:
        print(f"  SKIP: suggestion {suggestion_id} already claimed", flush=True)
        return None

    # ── Step B: Fetch node + work ────────────────────────────────────
    node_resp = (
        sb.table("document_nodes")
        .select("id, node_type, number, heading, content_text, sort_order, work_id")
        .eq("id", suggestion["node_id"])
        .single()
        .execute()
    )
    node = node_resp.data
    if not node:
        print(f"  SKIP: node {suggestion['node_id']} not found", flush=True)
        return None

    work_resp = (
        sb.table("works")
        .select("id, title_id, slug, source_pdf_url, number, year")
        .eq("id", suggestion["work_id"])
        .single()
        .execute()
    )
    work = work_resp.data
    if not work:
        print(f"  SKIP: work {suggestion['work_id']} not found", flush=True)
        return None

    log_suggestion_header(suggestion, work, node)

    # ── Step 1: Gather sibling context ───────────────────────────────
    with StepTimer(1, 4, "Gathering context...") as step1:
        sort_order = node.get("sort_order") or 0
        siblings_resp = (
            sb.table("document_nodes")
            .select("node_type, number, heading, content_text, sort_order")
            .eq("work_id", node["work_id"])
            .eq("node_type", "pasal")
            .gte("sort_order", sort_order - 3)
            .lte("sort_order", sort_order + 3)
            .order("sort_order")
            .limit(7)
            .execute()
        )
        siblings = siblings_resp.data or []
        step1.detail(f"Found {len(siblings)} sibling nodes")

        surrounding_context = ""
        if siblings:
            parts = []
            for s in siblings:
                marker = (
                    " ← [PASAL YANG DIKOREKSI]"
                    if s.get("number") == node.get("number")
                    else ""
                )
                text = s.get("content_text") or "(kosong)"
                truncated = text[:500] + "..." if len(text) > 500 else text
                parts.append(f"### Pasal {s.get('number', '?')}{marker}\n{truncated}")
            surrounding_context = "\n\n".join(parts)

    # ── Step 2: Fetch PDF page image ─────────────────────────────────
    pdf_image: bytes | None = None
    with StepTimer(2, 4, "Fetching PDF source...") as step2:
        slug = work.get("slug", "")
        node_number = node.get("number", "")
        node_content = node.get("content_text", "")

        if slug:
            page = find_page_for_node(slug, node_number, node_content)
            if page:
                step2.detail(f"Found Pasal {node_number} on page {page}")
                pdf_image = fetch_pdf_page_image(slug, page)
                if pdf_image:
                    step2.detail(f"PDF image: {len(pdf_image):,} bytes")
                else:
                    step2.detail("PDF image fetch failed — proceeding without")
            else:
                step2.detail(f"Could not locate Pasal {node_number} in PDF")
        else:
            step2.detail("No slug available — skipping PDF")

    # ── Step 3: Opus 4.6 verification ────────────────────────────────
    with StepTimer(3, 4, "Opus 4.6 analyzing...") as step3:
        result = verify_with_opus(
            current_content=suggestion.get("current_content", ""),
            suggested_content=suggestion.get("suggested_content", ""),
            pdf_page_image=pdf_image,
            node_type=node.get("node_type", "pasal"),
            node_number=node_number,
            user_reason=suggestion.get("user_reason", ""),
            surrounding_context=surrounding_context,
            work_title=work.get("title_id", ""),
        )
        step3.detail(f"Decision: {result['decision']} ({result['confidence']:.2f})")

    # ── Step E: Store result ─────────────────────────────────────────
    sb.table("suggestions").update({
        "agent_model": result.get("model", "claude-opus-4-6"),
        "agent_response": json.dumps({
            "raw": result.get("raw_response", ""),
            "parsed": {
                "decision": result["decision"],
                "confidence": result["confidence"],
                "reasoning": result.get("reasoning", ""),
                "corrected_content": result.get("corrected_content"),
                "additional_issues": result.get("additional_issues", []),
                "parser_feedback": result.get("parser_feedback", ""),
            },
            "context_nodes_count": len(siblings),
            "work_title": work.get("title_id"),
            "had_pdf_image": pdf_image is not None,
        }),
        "agent_decision": result["decision"],
        "agent_confidence": result["confidence"],
        "agent_modified_content": result.get("corrected_content"),
        "agent_completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", suggestion_id).execute()

    log_decision(
        result["decision"],
        result["confidence"],
        result.get("reasoning", ""),
        threshold=CONFIDENCE_THRESHOLD,
    )

    # ── Step G: Auto-apply if high confidence ────────────────────────
    is_accept = result["decision"] in ("accept", "accept_with_corrections")
    meets_threshold = result["confidence"] >= CONFIDENCE_THRESHOLD

    if is_accept and meets_threshold:
        with StepTimer(4, 4, "Auto-applying revision...") as step4:
            content_to_apply = (
                result.get("corrected_content") or suggestion["suggested_content"]
            )
            revision_id = apply_revision(
                node_id=node["id"],
                work_id=work["id"],
                new_content=content_to_apply,
                revision_type="correction",
                reason=f"Agent auto-approved: {result.get('reasoning', '')[:200]}",
                suggestion_id=suggestion_id,
                actor_type="agent",
                created_by="correction-agent-opus",
            )

            if revision_id:
                step4.detail(f"Revision #{revision_id} applied")
                # Update suggestion status to agent_approved
                try:
                    sb.table("suggestions").update({
                        "status": "agent_approved",
                    }).eq("id", suggestion_id).execute()
                    step4.detail("Status → agent_approved")
                except Exception as e:
                    # Task 6 migration may not be applied yet
                    step4.detail(
                        f"Could not set status to agent_approved: {e} "
                        "(apply Task 6 migration to enable this)"
                    )
            else:
                step4.detail("apply_revision returned None — check logs")
                log_skipped("Revision failed — manual review needed")
    elif is_accept and not meets_threshold:
        log_skipped(
            f"Accepted but confidence {result['confidence']:.2f} < "
            f"threshold {CONFIDENCE_THRESHOLD} — needs manual review"
        )
    else:
        log_skipped(f"Rejected — no changes applied")

    elapsed = time.monotonic() - t0
    log_total_time(elapsed)
    return result


async def run_worker() -> None:
    """Run the correction worker in continuous polling mode."""
    log_banner({
        "model": "claude-opus-4-6",
        "threshold": CONFIDENCE_THRESHOLD,
        "poll_interval": POLL_INTERVAL,
        "repo": "ilhamfp/pasal",
        "started": datetime.now(timezone.utc).isoformat(),
    })

    while True:
        suggestions = fetch_pending_suggestions(MAX_PER_RUN)
        if suggestions:
            batch_results = []
            for s in suggestions:
                result = await process_suggestion(s)
                if result:
                    batch_results.append(result)
            # Trigger parser analysis if batch produced feedback
            has_feedback = any(r.get("parser_feedback") for r in batch_results)
            if has_feedback:
                try:
                    from agent.parser_improver import run_parser_analysis
                    await run_parser_analysis(force=False)
                except Exception as e:
                    print(f"  Parser analysis skipped: {e}", flush=True)
        else:
            log_poll_idle(POLL_INTERVAL)
        await asyncio.sleep(POLL_INTERVAL)


async def run_once() -> None:
    """Process one batch of pending suggestions, then exit."""
    log_banner({
        "model": "claude-opus-4-6",
        "threshold": CONFIDENCE_THRESHOLD,
        "poll_interval": POLL_INTERVAL,
        "repo": "ilhamfp/pasal",
        "started": datetime.now(timezone.utc).isoformat(),
    })

    suggestions = fetch_pending_suggestions(MAX_PER_RUN)
    if suggestions:
        batch_results = []
        for s in suggestions:
            result = await process_suggestion(s)
            if result:
                batch_results.append(result)
        # Trigger parser analysis if batch produced feedback
        has_feedback = any(r.get("parser_feedback") for r in batch_results)
        if has_feedback:
            try:
                from agent.parser_improver import run_parser_analysis
                await run_parser_analysis(force=False)
            except Exception as e:
                print(f"  Parser analysis skipped: {e}", flush=True)
    else:
        print("No pending suggestions found.", flush=True)
