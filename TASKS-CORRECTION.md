# Pasal.id — Opus 4.6 Correction Agent: Build Tasks

> **What this is:** A background Python worker deployed on Railway that uses Claude Opus 4.6 to automatically verify crowd-sourced corrections, apply them to the database, and — when it detects systematic parsing errors — read the parser source code via GitHub API and file improvement issues.
>
> **Why this matters for the hackathon:** The judging criteria gives 25% weight to "Opus 4.6 Use" — specifically "How creatively did this team use Opus 4.6? Did they go beyond a basic integration? Did they surface capabilities that surprised even us?" This agent demonstrates Opus 4.6 doing multi-modal reasoning (PDF vision + legal text analysis + code comprehension) in an autonomous feedback loop.
>
> **Where it lives:** `scripts/agent/` (new files alongside existing `verify_suggestion.py` and `apply_revision.py`)
>
> **Deployment:** Railway service (separate from the MCP server), polling on a schedule.
>
> **Task order:** 1 (Opus core) → 2 (Worker) → 3 (Logger) → 4 (Parser improver) → 5 (Railway deploy) → 6 (DB migration) → 7 (Demo prep)

---

## Prerequisites and API Keys

The agent needs these environment variables. Create `scripts/agent/.env`:

```dotenv
# Anthropic — Opus 4.6 for verification + code analysis
ANTHROPIC_CORRECTION_AGENT_KEY=sk-ant-...

# Supabase — SERVICE ROLE key (bypasses RLS for full read/write)
SUPABASE_URL=https://jnnqvmfhkqwfdlzevfao.supabase.co
SUPABASE_KEY=eyJ...your-service-role-key

# GitHub — Personal Access Token (classic)
#   Scopes needed: public_repo, issues (write)
#   Generate: GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
GITHUB_TOKEN=ghp_...

# Config
GITHUB_REPO=ilhamfp/pasal
POLL_INTERVAL_SECONDS=30
CONFIDENCE_AUTO_APPLY_THRESHOLD=0.85
MAX_SUGGESTIONS_PER_RUN=5
```

### Why each key:

| Key | Why |
|-----|-----|
| `ANTHROPIC_CORRECTION_AGENT_KEY` | Calls Opus 4.6 API for verification decisions and parser code analysis |
| `SUPABASE_URL` + `SUPABASE_KEY` (service role) | Read pending suggestions, fetch document_nodes + works metadata, download PDF page images from Storage, call `apply_revision()` RPC, update suggestion status |
| `GITHUB_TOKEN` | Read parser source files via Contents API. Create issues with parser improvement proposals via Issues API |

---

## Existing Infrastructure You Are Building On

**DO NOT modify these files.** The agent consumes them:

| What | Where | How agent uses it |
|------|-------|-------------------|
| `suggestions` table | Migration 017 | Poll for `status = 'pending'` rows |
| `document_nodes` table | Core schema | Fetch current content + surrounding context |
| `works` table | Core schema | Get `source_pdf_url`, `slug`, metadata |
| `apply_revision()` SQL fn | Migration 020 (updated 038) | Atomic content mutation via Supabase RPC |
| `apply_revision.py` | `scripts/agent/apply_revision.py` | Python wrapper — **reuse directly** |
| `verify_suggestion.py` | `scripts/agent/verify_suggestion.py` | Reference for prompt structure — **do NOT call, build new Opus version** |
| PDF page images | Supabase Storage: `regulation-pdfs/{slug}/page-{N}.png` | Download specific page for Opus vision input |
| PDF files | Supabase Storage: `regulation-pdfs/{slug}.pdf` | Fallback: render page via PyMuPDF if page images missing |

### `suggestions` table columns the agent writes to:

```
agent_triggered_at     TIMESTAMPTZ   — set when agent picks up the job
agent_model            TEXT          — "claude-opus-4-6"
agent_response         JSONB         — full Opus response
agent_decision         VARCHAR(20)   — "accept" | "accept_with_corrections" | "reject"
agent_modified_content TEXT          — final corrected text (if accept_with_corrections)
agent_confidence       FLOAT         — 0.0-1.0
agent_completed_at     TIMESTAMPTZ   — set when agent finishes
```

---

## Task 1 — Opus 4.6 Verification Core

**File:** `scripts/agent/opus_verify.py` (NEW)

**WHY:** Replace the Gemini-based `verify_suggestion.py` with an Opus 4.6 version that uses **vision** (PDF page image) for ground-truth comparison. Opus reads the actual PDF to make its decision.

### 1.1 — Build the verification function

```python
def verify_with_opus(
    current_content: str,
    suggested_content: str,
    pdf_page_image: bytes | None,     # PNG bytes of the relevant PDF page
    node_type: str,
    node_number: str,
    user_reason: str,
    surrounding_context: str,
    work_title: str,
) -> dict:
```

**Implementation details:**

1. **Anthropic client setup:**
   - Use `anthropic` Python SDK
   - Model: `"claude-opus-4-6"`
   - Use `ANTHROPIC_CORRECTION_AGENT_KEY` env var
   - `max_tokens=4096`, `temperature=0.1` (we want deterministic legal judgments)

2. **Prompt construction (multimodal — this is the key differentiator):**
   - System prompt: Indonesian legal verification expert. Include injection protection using `<user_data>` tags (same pattern as existing `verify_suggestion.py`). The system prompt from the existing file is excellent — adapt it for Opus but keep the same structure.
   - User message content array:
     - First: PDF page image (if available) as `type: "image"` with `source.type: "base64"`, `media_type: "image/png"`
     - Then: text block with current content, suggested content, surrounding context, user reason
   - Key instructions for Opus:
     - "You are looking at the original PDF page. The current_content was extracted by an automated parser and may contain OCR errors, missing text, broken formatting, or incorrect numbering. The user is suggesting a correction. Determine what the CORRECT text should be by reading the PDF directly."
     - "If the PDF image is unclear, rely on linguistic analysis and legal formatting patterns instead."
     - "ALWAYS fill parser_feedback with notes about what the parser got wrong — this is used to improve the parser automatically."
   - Request JSON output:
     ```json
     {
       "decision": "accept | accept_with_corrections | reject",
       "confidence": 0.0-1.0,
       "reasoning": "detailed explanation",
       "corrected_content": "the final correct text (REQUIRED if accept or accept_with_corrections)",
       "additional_issues": [
         {"type": "typo|ocr_artifact|missing_text|formatting|numbering", "description": "...", "location": "..."}
       ],
       "parser_feedback": "notes for improving the parser"
     }
     ```

3. **Response parsing:**
   - Parse JSON (handle triple-backtick json fences — strip them before parsing)
   - Validate `decision` in `{"accept", "accept_with_corrections", "reject"}`
   - Clamp `confidence` to 0.0-1.0
   - On ANY error (API error, JSON parse failure, etc.), return `{"decision": "error", ...}` — **never crash the worker**

4. **Return format:**
   ```python
   return {
       "decision": decision,
       "confidence": confidence,
       "reasoning": result.get("reasoning", ""),
       "corrected_content": result.get("corrected_content"),
       "additional_issues": result.get("additional_issues", []),
       "parser_feedback": result.get("parser_feedback", ""),
       "model": "claude-opus-4-6",
       "raw_response": raw_text,
   }
   ```

### 1.2 — PDF page image fetcher

**File:** `scripts/agent/pdf_utils.py` (NEW)

```python
def fetch_pdf_page_image(slug: str, page_number: int) -> bytes | None:
    """Fetch a single PDF page as PNG bytes from Supabase Storage."""
```

**Logic:**
1. Try Supabase Storage first: download `regulation-pdfs/{slug}/page-{page_number}.png`
   - Use `sb.storage.from_("regulation-pdfs").download(f"{slug}/page-{page_number}.png")`
2. Fallback: download full PDF `regulation-pdfs/{slug}.pdf`, open with PyMuPDF, render page at 150 DPI
   - `pymupdf.open(stream=pdf_bytes, filetype="pdf")`
   - `doc[page_number - 1].get_pixmap(dpi=150).tobytes("png")`
3. If both fail, return `None` (agent works without image, just less confident)
4. Wrap everything in try/except — never crash

### 1.3 — Find which PDF page contains a node

```python
def find_page_for_node(slug: str, node_number: str, node_content: str) -> int | None:
    """Find which PDF page contains a given Pasal. Returns 1-indexed page number."""
```

The suggestion does NOT store a page number. Determine it by:
1. Download PDF from Supabase Storage: `regulation-pdfs/{slug}.pdf`
2. Open with PyMuPDF
3. For each page, search page text for `f"Pasal {node_number}"` (case insensitive)
4. If multiple matches, pick the one where surrounding text best matches `node_content[:100]`
5. Return 1-indexed page number, or `None` if not found

**Optimization:** Cache the downloaded PDF bytes in a module-level dict keyed by slug. This avoids re-downloading the same PDF when processing multiple suggestions for the same law in one batch.

```python
_pdf_cache: dict[str, bytes] = {}

def _get_pdf_bytes(slug: str) -> bytes | None:
    if slug not in _pdf_cache:
        _pdf_cache[slug] = sb.storage.from_("regulation-pdfs").download(f"{slug}.pdf")
    return _pdf_cache.get(slug)
```

### 1.4 — Supabase client helper

```python
def get_supabase():
    """Create Supabase client using service role key."""
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
```

Or reuse the existing `scripts/crawler/db.py` singleton if convenient (it does the same thing).

**DONE WHEN:**
- [ ] `opus_verify.py` exists with `verify_with_opus()` function
- [ ] `pdf_utils.py` exists with `fetch_pdf_page_image()` and `find_page_for_node()`
- [ ] Calling `verify_with_opus()` with a sample correction returns valid JSON with all fields
- [ ] Vision works: pass a PDF page image, verify Opus references what it sees in the PDF in its `reasoning` field
- [ ] Text-only fallback works: pass `pdf_page_image=None`, Opus still returns valid decision based on text analysis alone
- [ ] Error handling: function never raises, always returns dict with `decision` field
- [ ] Test with known slug: `find_page_for_node("uu-13-2003", "1", ...)` returns a valid page number

---

## Task 2 — Suggestion Poller Worker

**File:** `scripts/agent/correction_worker.py` (NEW)

**WHY:** Main loop that runs on Railway. Polls Supabase for pending suggestions, processes them with Opus, and auto-applies confident decisions.

### 2.1 — Config loading

At the top of the file, load config from env:

```python
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")  # fallback to scripts/.env

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_AUTO_APPLY_THRESHOLD", "0.85"))
MAX_PER_RUN = int(os.environ.get("MAX_SUGGESTIONS_PER_RUN", "5"))
```

### 2.2 — Core polling loop

```python
import asyncio
import time
from datetime import datetime, timezone

async def run_worker():
    """Main worker loop. Poll, verify, auto-apply. Runs forever."""
    log_banner({...})  # from logger.py (Task 3)
    while True:
        try:
            suggestions = fetch_pending_suggestions(limit=MAX_PER_RUN)
            if suggestions:
                for suggestion in suggestions:
                    await process_suggestion(suggestion)
            else:
                log_poll_idle()  # from logger.py (Task 3)
        except Exception as e:
            print(f"[ERROR] Worker cycle failed: {e}")
        await asyncio.sleep(POLL_INTERVAL)

async def run_once():
    """Process all pending suggestions once, then exit."""
    log_banner({...})
    suggestions = fetch_pending_suggestions(limit=MAX_PER_RUN)
    if not suggestions:
        print("No pending suggestions found. Exiting.")
        return
    for suggestion in suggestions:
        await process_suggestion(suggestion)
    print(f"\nProcessed {len(suggestions)} suggestion(s). Exiting.")
```

### 2.3 — Fetch pending suggestions

```python
def fetch_pending_suggestions(limit: int = 5) -> list[dict]:
    """Get pending suggestions that haven't been claimed by any agent yet."""
    sb = get_supabase()
    result = sb.table("suggestions") \
        .select("*") \
        .eq("status", "pending") \
        .is_("agent_triggered_at", "null") \
        .order("created_at") \
        .limit(limit) \
        .execute()
    return result.data or []
```

### 2.4 — Process a single suggestion

```python
async def process_suggestion(suggestion: dict) -> dict | None:
    """Full pipeline for one suggestion: claim → context → Opus → apply."""
    sb = get_supabase()
    t_start = time.time()

    # --- Step A: Claim the job (optimistic lock) ---
    claim = sb.table("suggestions").update({
        "agent_triggered_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", suggestion["id"]).is_("agent_triggered_at", "null").execute()

    if not claim.data:
        print(f"  [SKIP] Suggestion {suggestion['id']} already claimed by another worker")
        return None

    # --- Step B: Fetch node and work context ---
    node_result = sb.table("document_nodes") \
        .select("id, node_type, number, heading, content_text, sort_order, work_id") \
        .eq("id", suggestion["node_id"]) \
        .single() \
        .execute()
    node = node_result.data

    work_result = sb.table("works") \
        .select("id, title, slug, source_pdf_url, law_type, law_number, year") \
        .eq("id", suggestion["work_id"]) \
        .single() \
        .execute()
    work = work_result.data

    # Log the suggestion header (Task 3 logger)
    log_suggestion_header(suggestion, work, node)

    # Fetch surrounding sibling nodes for context (±3 sort_order, same work, pasal type)
    with StepTimer(1, 4, "Gathering context...") as st:
        siblings_result = sb.table("document_nodes") \
            .select("node_type, number, heading, content_text, sort_order") \
            .eq("work_id", node["work_id"]) \
            .eq("node_type", "pasal") \
            .gte("sort_order", (node["sort_order"] or 0) - 3) \
            .lte("sort_order", (node["sort_order"] or 0) + 3) \
            .order("sort_order") \
            .limit(7) \
            .execute()
        siblings = siblings_result.data or []
        st.detail(f"Fetched node + {len(siblings)} surrounding articles")

        # Build context string from siblings
        context_parts = []
        for s in siblings:
            marker = " ← [TARGET]" if s["number"] == node["number"] else ""
            text = (s["content_text"] or "")[:500]
            context_parts.append(f"Pasal {s['number']}{marker}:\n{text}")
        surrounding_context = "\n\n".join(context_parts)

    # --- Step C: Find and fetch PDF page image ---
    with StepTimer(2, 4, "Fetching PDF source...") as st:
        slug = work.get("slug", "")
        page_num = find_page_for_node(slug, node["number"], node.get("content_text", ""))
        if page_num:
            st.detail(f"Found Pasal {node['number']} on page {page_num} of {slug}.pdf")
        else:
            st.detail(f"Could not locate Pasal {node['number']} in PDF, using text-only analysis")

        page_image = None
        if page_num:
            page_image = fetch_pdf_page_image(slug, page_num)
            if page_image:
                st.detail(f"Downloaded page image ({len(page_image) // 1024} KB)")
            else:
                st.detail("Page image download failed, falling back to text-only")

    # --- Step D: Call Opus 4.6 ---
    with StepTimer(3, 4, "Opus 4.6 analyzing...") as st:
        mode = "vision + text" if page_image else "text-only"
        st.detail(f"Sending to claude-opus-4-6 ({mode})")
        st.detail("Comparing PDF image against parsed text and suggestion")
        result = verify_with_opus(
            current_content=suggestion["current_content"],
            suggested_content=suggestion["suggested_content"],
            pdf_page_image=page_image,
            node_type=node["node_type"],
            node_number=node["number"] or "",
            user_reason=suggestion.get("user_reason", ""),
            surrounding_context=surrounding_context,
            work_title=work.get("title", ""),
        )

    # --- Step E: Store result ---
    sb.table("suggestions").update({
        "agent_model": result["model"],
        "agent_response": result,
        "agent_decision": result["decision"],
        "agent_modified_content": result.get("corrected_content"),
        "agent_confidence": result["confidence"],
        "agent_completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", suggestion["id"]).execute()

    # --- Step F: Log decision ---
    log_decision(result["decision"], result["confidence"], result["reasoning"])

    # --- Step G: Auto-apply if confident ---
    if result["decision"] in ("accept", "accept_with_corrections") \
        and result["confidence"] >= CONFIDENCE_THRESHOLD:

        with StepTimer(4, 4, f"Auto-applying (confidence >= {CONFIDENCE_THRESHOLD})...") as st:
            content_to_apply = result.get("corrected_content") or suggestion["suggested_content"]

            from agent.apply_revision import apply_revision
            revision_id = apply_revision(
                node_id=suggestion["node_id"],
                work_id=suggestion["work_id"],
                new_content=content_to_apply,
                revision_type="agent_auto_approved",
                reason=f"Opus 4.6 auto-approved (confidence: {result['confidence']:.2f}): "
                       f"{result['reasoning'][:200]}",
                suggestion_id=suggestion["id"],
                actor_type="agent",
            )

            if revision_id:
                sb.table("suggestions").update({
                    "status": "agent_approved"
                }).eq("id", suggestion["id"]).execute()
                st.detail(f"Called apply_revision() → revision #{revision_id}")
                st.detail("Updated suggestion status → agent_approved")
                st.detail("Content is now LIVE on pasal.id")
            else:
                st.detail("apply_revision() failed — left for admin review")
    else:
        if result["decision"] == "error":
            log_skipped("Agent encountered an error. Left for admin review.")
        elif result["decision"] == "reject":
            log_skipped("No changes applied. Left for admin review.")
        else:
            log_skipped(f"Below auto-apply threshold ({CONFIDENCE_THRESHOLD}). Left for admin review.")

    log_total_time(time.time() - t_start)
    return result
```

### 2.5 — Entrypoint

**File:** `scripts/agent/run_correction_agent.py` (NEW)

```python
"""Entrypoint for the Opus 4.6 correction agent.

Usage:
    python -m scripts.agent.run_correction_agent                # continuous polling
    python -m scripts.agent.run_correction_agent --once          # single run then exit
    python -m scripts.agent.run_correction_agent --analyze-parser # force parser analysis
"""
import asyncio
import argparse

def main():
    parser = argparse.ArgumentParser(description="Pasal.id Opus 4.6 Correction Agent")
    parser.add_argument("--once", action="store_true",
                        help="Process pending suggestions once and exit")
    parser.add_argument("--analyze-parser", action="store_true",
                        help="Force parser analysis regardless of threshold (for demo)")
    args = parser.parse_args()

    if args.analyze_parser:
        from agent.parser_improver import run_parser_analysis
        asyncio.run(run_parser_analysis(force=True))
    elif args.once:
        from agent.correction_worker import run_once
        asyncio.run(run_once())
    else:
        from agent.correction_worker import run_worker
        asyncio.run(run_worker())

if __name__ == "__main__":
    main()
```

**DONE WHEN:**
- [ ] Worker starts, polls, finds 0 pending, sleeps, loops (no crash)
- [ ] Test suggestion inserted → worker picks it up within POLL_INTERVAL_SECONDS
- [ ] Opus result stored in suggestion row (check `agent_decision`, `agent_model`, `agent_response` in Supabase)
- [ ] Auto-apply works: high-confidence accept creates revision in `revisions` table
- [ ] Low-confidence or reject: agent data filled but `status` stays `pending` (for admin review)
- [ ] Optimistic lock: two workers cannot process the same suggestion (test by inserting suggestion, running `--once` twice rapidly)
- [ ] `--once` mode processes all pending and exits cleanly

---

## Task 3 — Demo-Quality Worker Logging

**File:** `scripts/agent/logger.py` (NEW)

**WHY:** The Railway worker logs ARE the demo. The video sequence is: admin panel (pending) → Railway logs (agent processing in real-time) → admin panel (resolved). Judges watching a 3-minute video need to instantly understand what happened. Ugly print statements will not cut it.

### 3.1 — Design rules

- **No ANSI color codes.** Railway's log viewer renders them inconsistently and they look bad in screenshots/video. Use Unicode box-drawing characters and emoji only — these render perfectly everywhere.
- **Wrap reasoning text.** Truncate Opus reasoning to ~120 chars in the decision box, wrap at word boundaries. Full reasoning lives in the DB.
- **Flush stdout.** Set `PYTHONUNBUFFERED=1` in Railway env vars. Without it, logs appear in delayed chunks instead of real-time — this kills the demo.
- **Timestamps in UTC ISO 8601.** Railway adds its own timestamps too, but ours ensure the demo looks consistent.

### 3.2 — Startup banner

When the agent first starts, print:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ⚖️  Pasal.id Correction Agent                             │
│   Powered by Claude Opus 4.6                                 │
│                                                              │
│   Model:      claude-opus-4-6                                │
│   Threshold:  0.85 confidence for auto-apply                 │
│   Polling:    every 30s                                      │
│   Repo:       ilhamfp/pasal                                  │
│   Started:    2026-02-17T14:30:00Z                           │
│                                                              │
│   Watching for pending suggestions...                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 — Idle polling (minimal, one-line)

```
[2026-02-17T14:35:00Z] Polling... no pending suggestions. Next check in 30s.
```

### 3.4 — Processing a suggestion (THE MAIN SHOW)

This is what judges see in the demo video. **Match this format precisely:**

```
╔══════════════════════════════════════════════════════════════╗
║  CORRECTION AGENT — New Suggestion Detected                 ║
╚══════════════════════════════════════════════════════════════╝

  📋 Suggestion #42
  ├─ Law:        UU No. 13 Tahun 2003 (Ketenagakerjaan)
  ├─ Article:    Pasal 79
  ├─ Submitted:  2026-02-17 14:32:01 UTC
  └─ Reason:     "Ayat 2 huruf b salah ketik, seharusnya 12 hari"

  ⏳ Step 1/4 — Gathering context...
     ├─ Fetched node + 6 surrounding articles
     └─ Done (0.3s)

  📄 Step 2/4 — Fetching PDF source...
     ├─ Found Pasal 79 on page 34 of uu-13-2003.pdf
     ├─ Downloaded page image (142 KB)
     └─ Done (1.2s)

  🧠 Step 3/4 — Opus 4.6 analyzing...
     ├─ Sending to claude-opus-4-6 (vision + text)
     ├─ Comparing PDF image against parsed text and suggestion
     └─ Done (4.7s)

  ┌─────────────────────────────────────────────────┐
  │  ✅  DECISION: accept                           │
  │  📊  Confidence: 0.96                           │
  │  💬  "The PDF clearly shows '12 hari kerja'     │
  │       but parser extracted '2 hari kerja'.      │
  │       User correction is accurate."             │
  └─────────────────────────────────────────────────┘

  🚀 Step 4/4 — Auto-applying (confidence >= 0.85)...
     ├─ Called apply_revision() → revision #15246
     ├─ Updated suggestion status → agent_approved
     ├─ Content is now LIVE on pasal.id
     └─ Done (0.5s)

  ⏱️  Total: 6.7s
  ═══════════════════════════════════════════════════
```

### 3.5 — Decision block variants

**REJECTED:**
```
  ┌─────────────────────────────────────────────────┐
  │  ❌  DECISION: reject                           │
  │  📊  Confidence: 0.91                           │
  │  💬  "The PDF confirms the current text is      │
  │       correct. The user's suggestion introduces  │
  │       an error in the numbering of ayat."        │
  └─────────────────────────────────────────────────┘

  📝 No changes applied. Left for admin review.
```

**LOW CONFIDENCE (below auto-apply threshold):**
```
  ┌─────────────────────────────────────────────────┐
  │  🟡  DECISION: accept_with_corrections          │
  │  📊  Confidence: 0.72                           │
  │  💬  "Suggestion is mostly correct but the      │
  │       formatting needs adjustment. Leaving       │
  │       for admin review."                         │
  └─────────────────────────────────────────────────┘

  📝 Below auto-apply threshold (0.85). Left for admin review.
```

**ERROR:**
```
  ┌─────────────────────────────────────────────────┐
  │  ⚠️  DECISION: error                            │
  │  📊  Confidence: 0.00                           │
  │  💬  "API timeout after 30s"                    │
  └─────────────────────────────────────────────────┘

  📝 Agent encountered an error. Left for admin review.
```

### 3.6 — Parser analysis output

```
╔══════════════════════════════════════════════════════════════╗
║  PARSER ANALYSIS — Checking for systematic issues           ║
╚══════════════════════════════════════════════════════════════╝

  📊 Collected 5 parser feedback items from last 24h
  📂 Fetched 3 parser source files from GitHub

  🧠 Opus 4.6 analyzing parser code...
     ├─ Examining parse_structure.py (847 lines)
     ├─ Examining ocr_correct.py (213 lines)
     ├─ Examining extract_pymupdf.py (156 lines)
     └─ Done (8.3s)

  🔧 Found 2 systematic issues:

     1. parse_structure.py — "Regex misses Pasal with letter suffix"
        Severity: medium | Est. errors fixed: 3
        → Created GitHub issue #47

     2. ocr_correct.py — "Missing correction for 'PRES!DEN'"
        Severity: low | Est. errors fixed: 2
        → Created GitHub issue #48

  ═══════════════════════════════════════════════════
```

### 3.7 — Implementation: logger.py functions

```python
import time
from datetime import datetime, timezone


def log_banner(config: dict) -> None:
    """Print startup banner with config. Keys: model, threshold, poll_interval, repo, started."""

def log_poll_idle() -> None:
    """One-line idle poll message with timestamp."""

def log_suggestion_header(suggestion: dict, work: dict, node: dict) -> None:
    """Print the double-line boxed header + suggestion metadata tree.
    Extract law type/number/year from work, article number from node,
    reason from suggestion. Truncate reason to 60 chars."""

def log_decision(decision: str, confidence: float, reasoning: str) -> None:
    """Print the framed decision block. Pick emoji by decision type:
    accept = ✅, accept_with_corrections = ✅, reject = ❌, error = ⚠️
    For low confidence accept (< threshold), use 🟡.
    Wrap reasoning text at ~50 chars per line, max 3 lines."""

def log_skipped(reason: str) -> None:
    """Print 📝 line when not auto-applying."""

def log_total_time(seconds: float) -> None:
    """Print ⏱️ total time + separator line."""

def log_parser_analysis_header() -> None:
    """Print the parser analysis boxed header."""

def log_parser_analysis_result(feedback_count: int, files: dict[str, str], issues: list[dict]) -> None:
    """Print the parser analysis results including GitHub issue numbers."""


class StepTimer:
    """Context manager for timing steps with pretty tree output.

    Usage:
        with StepTimer(1, 4, "Gathering context...") as st:
            st.detail("Fetched node + 6 surrounding articles")
            # ... do work ...
        # Automatically prints "└─ Done (0.3s)" on exit

    Implementation notes:
    - __enter__ prints the step header: "  ⏳ Step 1/4 — Gathering context..."
      (pick emoji by step: 1=⏳, 2=📄, 3=🧠, 4=🚀)
    - detail() prints: "     ├─ {msg}"
    - __exit__ prints: "     └─ Done ({elapsed}s)"
    - Track number of details printed so the last one before Done uses ├─ not └─
    """

    STEP_EMOJIS = {1: "⏳", 2: "📄", 3: "🧠", 4: "🚀"}

    def __init__(self, step_num: int, total: int, label: str):
        self.step_num = step_num
        self.total = total
        self.label = label
        self.start_time = None
        self.details = []

    def detail(self, msg: str) -> None:
        """Print a sub-step detail line."""
        print(f"     ├─ {msg}", flush=True)
        self.details.append(msg)

    def __enter__(self):
        self.start_time = time.time()
        emoji = self.STEP_EMOJIS.get(self.step_num, "⏳")
        print(f"\n  {emoji} Step {self.step_num}/{self.total} — {self.label}", flush=True)
        return self

    def __exit__(self, *args):
        elapsed = time.time() - self.start_time
        print(f"     └─ Done ({elapsed:.1f}s)", flush=True)
```

### 3.8 — Critical detail: the `flush=True`

EVERY print statement in logger.py MUST have `flush=True`. Alternatively, ensure `PYTHONUNBUFFERED=1` is set in Railway env vars (do both to be safe). Without this, the logs appear in batches and the real-time demo effect is lost.

**DONE WHEN:**
- [ ] `logger.py` exists with all listed functions and `StepTimer` class
- [ ] `StepTimer` context manager prints step header on enter, "Done (Xs)" on exit
- [ ] Startup banner prints correctly on `python -m scripts.agent.run_correction_agent`
- [ ] Processing a suggestion produces the exact log format shown in section 3.4
- [ ] Idle polling shows one-line messages (section 3.3)
- [ ] Rejected suggestions show ❌ decision block
- [ ] Low-confidence suggestions show 🟡 decision block
- [ ] Error suggestions show ⚠️ decision block
- [ ] No ANSI color codes anywhere — only Unicode box drawing + emoji
- [ ] All print statements use `flush=True`
- [ ] Run `python -m scripts.agent.run_correction_agent --once` and screenshot the output — it should look clean enough for a demo video

---

## Task 4 — Parser Improvement Agent (GitHub Integration)

**File:** `scripts/agent/parser_improver.py` (NEW)

**WHY:** The "wow" feature that closes the feedback loop. After processing corrections, the agent analyzes error patterns, reads the parser source code from GitHub, and creates issues with specific code fixes. User correction → content fix → parser improvement → fewer errors in future.

### 4.1 — Feedback collector

```python
def collect_parser_feedback(since_hours: int = 24) -> list[dict]:
    """Collect parser feedback from recently agent-processed suggestions."""
```

**Logic:**
1. Query `suggestions` table where:
   - `agent_completed_at` is within the last `since_hours` hours
   - `agent_decision` in `('accept', 'accept_with_corrections')`
   - `agent_response` is not null
2. For each suggestion, extract from `agent_response` JSONB:
   - `parser_feedback` (string)
   - `additional_issues` (array of `{type, description, location}`)
3. Also include:
   - `suggestion.current_content` (what the parser produced)
   - `suggestion.suggested_content` (what it should have been)
   - `work.title` and `node.number` for context
4. Return list of feedback dicts

### 4.2 — GitHub API helpers

```python
import base64
import httpx

GITHUB_API = "https://api.github.com"

def fetch_parser_files() -> dict[str, str]:
    """Fetch current parser source code from GitHub via Contents API."""
```

**Implementation:**
- Fetch these 3 files:
  - `scripts/parser/parse_structure.py`
  - `scripts/parser/ocr_correct.py`
  - `scripts/parser/extract_pymupdf.py`
- For each: `GET /repos/{GITHUB_REPO}/contents/{path}`
- Headers: `Authorization: Bearer {GITHUB_TOKEN}`, `Accept: application/vnd.github.v3+json`
- Response `.content` field is base64 encoded → decode with `base64.b64decode()`
- Return `{"parse_structure.py": "...source...", "ocr_correct.py": "...source...", ...}`

```python
def create_github_issue(title: str, body: str, labels: list[str] = None) -> dict:
    """Create a GitHub issue. Returns {"url": "...", "number": N}."""
```

**Implementation:**
- `POST /repos/{GITHUB_REPO}/issues`
- Body: `{"title": title, "body": body, "labels": labels or ["parser-improvement", "opus-agent"]}`
- If labels don't exist yet (422 error), retry without labels or create them first via `POST /repos/{GITHUB_REPO}/labels`
- Return `{"url": response["html_url"], "number": response["number"]}`

```python
def search_existing_issues(title_query: str) -> list[dict]:
    """Search open issues with parser-improvement label to avoid duplicates."""
```

- `GET /repos/{GITHUB_REPO}/issues?labels=parser-improvement&state=open`
- Return list of `{"title": ..., "number": ..., "url": ...}`

### 4.3 — Opus code analysis

```python
def analyze_parser_improvements(
    feedback_items: list[dict],
    parser_files: dict[str, str],
) -> dict:
    """Send feedback + source code to Opus 4.6 for systematic issue identification."""
```

**Prompt construction:**

System prompt:
```
You are a senior Python developer analyzing a PDF-to-structured-text parser for
Indonesian legal documents. You receive:
1. Error reports from a verification agent that compared parsed text against original PDFs
2. The complete parser source code

Identify SYSTEMATIC issues — patterns that affect multiple documents, not one-off errors.

For each issue, provide:
- A clear title (will become a GitHub issue title)
- Which file and function/regex is responsible
- What the current code does wrong
- A specific code fix (show exact before/after)
- How many of the reported errors this would fix

Return ONLY valid JSON:
{
  "issues": [
    {
      "title": "...",
      "file": "parse_structure.py",
      "function": "...",
      "current_behavior": "...",
      "fix_description": "...",
      "code_before": "...",
      "code_after": "...",
      "errors_fixed": 3,
      "severity": "high|medium|low"
    }
  ],
  "summary": "Found N issues affecting M of K reported errors."
}

If no systematic issues are found, return {"issues": [], "summary": "No systematic issues identified."}.
```

User message: include ALL feedback items as a numbered list, then ALL parser source files in full. Do NOT truncate — Opus 4.6 handles large context.

**Response parsing:** Same pattern as `opus_verify.py` — strip JSON fences, parse, validate, handle errors.

### 4.4 — Issue creation with dedup

```python
def create_improvement_issues(analysis: dict, feedback_count: int) -> list[dict]:
    """Create GitHub issues from Opus analysis. Returns list of {url, number}."""
```

For each issue in `analysis["issues"]`:
1. **Check for duplicates:** Search existing open issues. If title similarity > 80% (simple substring check is fine), add a comment to the existing issue instead of creating a new one.
2. **Format issue body:**
   ```markdown
   ## Parser Improvement: {title}

   **Identified by:** Opus 4.6 Correction Agent
   **Severity:** {severity}
   **Estimated errors fixed:** {errors_fixed}

   ### Current Behavior
   {current_behavior}

   ### Proposed Fix
   **File:** `scripts/parser/{file}`
   **Function:** `{function}`

   ```python
   # Before
   {code_before}

   # After
   {code_after}
   ```

   ### Fix Description
   {fix_description}

   ---
   *This issue was automatically generated by the Opus 4.6 correction agent
   after analyzing {feedback_count} user-submitted corrections.*
   ```
3. Create via GitHub API
4. Return list of `{url, number}` dicts

### 4.5 — Main entry point for parser analysis

```python
async def run_parser_analysis(force: bool = False) -> None:
    """Run parser analysis. If force=False, only runs when 3+ feedback items exist."""
    log_parser_analysis_header()

    feedback = collect_parser_feedback(since_hours=24)

    if not force and len(feedback) < 3:
        print(f"  Only {len(feedback)} feedback items (need 3+). Skipping analysis.")
        return

    print(f"  📊 Collected {len(feedback)} parser feedback items from last 24h")

    parser_files = fetch_parser_files()
    print(f"  📂 Fetched {len(parser_files)} parser source files from GitHub")

    analysis = analyze_parser_improvements(feedback, parser_files)

    if analysis.get("issues"):
        issues = create_improvement_issues(analysis, len(feedback))
        log_parser_analysis_result(len(feedback), parser_files, issues)
    else:
        print(f"  ✅ No systematic issues found.")
```

### 4.6 — Wire into worker

In `correction_worker.py`, after processing all suggestions in a batch:

```python
# At the end of run_worker's loop iteration, after processing suggestions:
processed_with_feedback = [r for r in batch_results if r and r.get("parser_feedback")]
if processed_with_feedback:
    feedback = collect_parser_feedback(since_hours=24)
    if len(feedback) >= 3:
        await run_parser_analysis(force=False)
```

**DONE WHEN:**
- [ ] `collect_parser_feedback()` returns feedback items from recent suggestions
- [ ] `fetch_parser_files()` returns actual source code of all 3 parser files from GitHub
- [ ] `analyze_parser_improvements()` calls Opus and returns structured analysis with specific code fixes
- [ ] `create_github_issue()` creates a well-formatted issue on `ilhamfp/pasal` with labels
- [ ] End-to-end: 3+ corrections → analysis → GitHub issue created
- [ ] Dedup: running twice with same feedback does not create duplicate issues
- [ ] `--analyze-parser` flag works for forcing analysis during demo
- [ ] Parser analysis uses the pretty log format from Task 3

---

## Task 5 — Railway Deployment

**WHY:** The agent needs to run continuously, separate from the MCP server and web app.

### 5.1 — Dockerfile

**File:** `scripts/agent/Dockerfile` (NEW)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps for PyMuPDF PDF rendering
RUN apt-get update && \
    apt-get install -y --no-install-recommends libmupdf-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire scripts/ directory (agent needs crawler/db.py, agent/apply_revision.py, etc.)
COPY . .

CMD ["python", "-m", "agent.run_correction_agent"]
```

**IMPORTANT:** Set the root directory in Railway to `scripts/` so the COPY context includes all of `scripts/`. The agent imports from `agent.apply_revision`, `agent.opus_verify`, `agent.logger`, `crawler.db`, etc.

### 5.2 — Requirements

**File:** `scripts/agent/requirements.txt` (NEW)

```
anthropic>=0.40.0
supabase>=2.0.0
httpx>=0.27.0
pymupdf>=1.24.0
python-dotenv>=1.0.0
```

**Note:** Check if `scripts/requirements.txt` already has some of these. The agent's Dockerfile only installs from `agent/requirements.txt`, so list everything the agent needs here even if duplicated.

### 5.3 — Railway service configuration

1. Go to Railway dashboard → same project as MCP server
2. Click "New Service" → "GitHub Repo" → select `ilhamfp/pasal`
3. Settings:
   - **Root directory:** `scripts`
   - **Dockerfile path:** `agent/Dockerfile`
   - **Service name:** `pasal-correction-agent`
4. Environment variables (add all of these):
   ```
   ANTHROPIC_CORRECTION_AGENT_KEY=sk-ant-...
   SUPABASE_URL=https://jnnqvmfhkqwfdlzevfao.supabase.co
   SUPABASE_KEY=eyJ...(service role key)
   GITHUB_TOKEN=ghp_...
   GITHUB_REPO=ilhamfp/pasal
   POLL_INTERVAL_SECONDS=30
   CONFIDENCE_AUTO_APPLY_THRESHOLD=0.85
   MAX_SUGGESTIONS_PER_RUN=5
   PYTHONUNBUFFERED=1
   ```
5. Deploy

**CRITICAL:** `PYTHONUNBUFFERED=1` must be set. Without it, Python buffers stdout and the beautiful logs from Task 3 appear in delayed chunks instead of streaming in real-time. This completely ruins the demo.

### 5.4 — Verify deployment

After deploying:
1. Check Railway logs — you should see the startup banner immediately
2. Check for idle polling messages every 30 seconds
3. Submit a test suggestion via the web UI
4. Watch Railway logs — should see the full processing output within 30 seconds
5. Check Supabase — suggestion should have `agent_decision` filled

**DONE WHEN:**
- [ ] `docker build` succeeds from `scripts/` directory
- [ ] Container starts and shows the startup banner
- [ ] Idle polling messages appear every 30 seconds
- [ ] Logs stream in real-time (not batched)
- [ ] Railway deployment is live
- [ ] Agent processes a test suggestion end-to-end on Railway

---

## Task 6 — Database Migration

**File:** `packages/supabase/migrations/040_agent_improvements.sql` (NEW)

Apply this BEFORE deploying the agent.

```sql
-- 1. Add agent_approved to allowed suggestion status values
ALTER TABLE suggestions DROP CONSTRAINT IF EXISTS suggestions_status_check;
ALTER TABLE suggestions ADD CONSTRAINT suggestions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'agent_approved'));

-- 2. Parser improvement tracking (optional — nice for admin panel display)
CREATE TABLE IF NOT EXISTS parser_improvements (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    github_issue_url TEXT,
    github_issue_number INTEGER,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    errors_fixed_estimate INTEGER DEFAULT 0,
    analysis JSONB,
    suggestion_ids BIGINT[],
    status VARCHAR(20) DEFAULT 'open'
        CHECK (status IN ('open', 'implemented', 'wont_fix', 'duplicate')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parser_improvements_status ON parser_improvements(status);

-- RLS for parser_improvements
ALTER TABLE parser_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read parser_improvements" ON parser_improvements
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full access parser_improvements" ON parser_improvements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**How to apply:** Open Supabase dashboard → SQL Editor → paste → Run.

**DONE WHEN:**
- [ ] Migration applied via Supabase SQL editor
- [ ] `SELECT DISTINCT status FROM suggestions;` — no errors (constraint updated)
- [ ] `INSERT INTO suggestions (..., status) VALUES (..., 'agent_approved');` works
- [ ] `parser_improvements` table exists
- [ ] Existing suggestion data is intact (run `SELECT count(*) FROM suggestions;` before and after)

---

## Task 7 — Demo Preparation

**WHY:** The demo video is 30% of the judging score. This feature is the centerpiece of the Opus 4.6 story.

### 7.1 — The 3-panel demo sequence (REHEARSE THIS)

The demo tells a story in three "camera cuts":

**Cut 1 — Admin Panel (pasal.id/admin/suggestions):**
Show the suggestion list. One item is highlighted with "Pending" status (orange badge). Click into it briefly to show the diff: current text vs. suggested text. Say: "A user spotted an OCR error and submitted a correction. Now watch what happens."

**Cut 2 — Railway Log Viewer:**
Switch to Railway dashboard → correction-agent service → Logs tab. The agent picks up the suggestion. The beautiful log output scrolls through in real-time:
- Header: suggestion detected with law name and article
- Step 1: gathering context (fast, ~0.3s)
- Step 2: fetching PDF page (shows it found the right page)
- Step 3: Opus 4.6 analyzing (the tension moment — takes ~5s)
- Decision box: ✅ accept, confidence 0.96, reasoning that references the PDF
- Step 4: auto-applying, revision created, "Content is now LIVE on pasal.id"

Say: "Opus 4.6 downloaded the original PDF page, read the Indonesian legal text with its vision capabilities, compared it against the parsed version and the user's suggestion, and decided the user was right — with 96% confidence."

**Cut 3 — Admin Panel (refresh):**
Switch back to admin. Hit refresh. The suggestion now shows "Agent Approved" (green badge). Click into it to show Opus's full reasoning. Say: "The correction is live on the site. But Opus did one more thing..."

**Optional Cut 4 — GitHub:**
Show the GitHub issues page. A new issue with the `opus-agent` label: "Parser misses [specific error pattern]" with a proposed code fix. Say: "It analyzed the parser code and filed a GitHub issue to prevent this class of error in the future. The system improves itself."

### 7.2 — Seed test suggestions

Before recording, prepare the suggestions:

**Suggestion A — Good correction (should auto-accept):**
1. Find a law with a visible OCR error (e.g., check works with `parse_quality_score < 0.8`)
2. Go to the reader page, find the malformed Pasal
3. Click "Koreksi", fix the text, submit with reason like "Teks salah karena OCR, seharusnya [correct text]"
4. Verify it appears in admin panel as "Pending"

**Suggestion B — Bad correction (should reject):**
1. Find a correctly-parsed Pasal
2. Submit a change that introduces an error (e.g., change a date or number)
3. Reason: "Saya rasa angka ini salah"
4. The agent should reject this with reasoning that cites the PDF

**Important:** Submit Suggestion A first, record the demo with it, THEN submit B to show a rejection. Don't submit both at once unless you want to show batch processing.

### 7.3 — Pre-recording checklist

- [ ] Railway correction-agent service is running (check for idle poll messages in logs)
- [ ] At least one pending suggestion exists in DB (verify in admin panel)
- [ ] Admin panel is open in a browser tab, showing the pending suggestion
- [ ] Railway dashboard is open in another tab, on the logs page for correction-agent
- [ ] GitHub repo page is open in a third tab (for the parser improvement reveal)
- [ ] Screen recording software is running and capturing all tabs
- [ ] Audio recording ready for voiceover
- [ ] Test the FULL flow once before recording (submit → process → verify → record a second time)

### 7.4 — Talking points for judges

Prepare these for voiceover or live Q&A:

1. **"Opus 4.6 does three things here that are genuinely hard:"**
   - Reading Indonesian legal text in a PDF image (vision)
   - Making judgment calls about whether a correction is accurate (legal reasoning in Bahasa Indonesia)
   - Reading Python source code and proposing specific regex fixes (code comprehension)

2. **"This is a self-improving system:"**
   - Users catch parsing errors → submit corrections
   - Opus 4.6 verifies against the original PDF → auto-applies if confident
   - Opus analyzes error patterns → reads the parser code → files GitHub issues
   - Developer fixes the parser → fewer errors when new laws are processed
   - Flywheel: more laws → more users → more corrections → better parser → better quality

3. **"The confidence threshold is the safety net:"**
   - Above 0.85: auto-applied instantly
   - Below 0.85: queued for human admin review
   - We never blindly trust the AI — but we let it handle the obvious cases

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Agent location | `scripts/agent/` — new files alongside existing ones |
| Model string | `claude-opus-4-6` via Anthropic Python SDK |
| PDF images | Supabase Storage: `regulation-pdfs/{slug}/page-{N}.png` |
| Apply corrections | `apply_revision()` SQL RPC via `scripts/agent/apply_revision.py` |
| Auto-apply threshold | `confidence >= 0.85` (configurable via `CONFIDENCE_AUTO_APPLY_THRESHOLD`) |
| Parser analysis trigger | 3+ accepted corrections with parser_feedback in last 24h |
| Force parser analysis | `python -m scripts.agent.run_correction_agent --analyze-parser` |
| Parser improvements go to | GitHub Issues on `ilhamfp/pasal` with `parser-improvement` + `opus-agent` labels |
| Test locally | `python -m scripts.agent.run_correction_agent --once` |
| Deploy | Railway — separate service from MCP server |
| Cost estimate | ~$0.10-0.30 per suggestion (Opus 4.6 with image input). 10/day ≈ $3/day max |
| Log buffering fix | `PYTHONUNBUFFERED=1` in Railway env vars (CRITICAL for demo) |

---

## New Files to Create

```
scripts/agent/
├── opus_verify.py              # Task 1 — Opus 4.6 verification with vision
├── pdf_utils.py                # Task 1 — PDF page image fetch + page finder
├── correction_worker.py        # Task 2 — Polling worker + auto-apply logic
├── run_correction_agent.py     # Task 2 — CLI entrypoint (--once, --analyze-parser)
├── logger.py                   # Task 3 — Demo-quality structured logging
├── parser_improver.py          # Task 4 — GitHub integration + Opus code analysis
├── Dockerfile                  # Task 5 — Railway deployment
└── requirements.txt            # Task 5 — Python dependencies
```

**Existing files to REUSE (import directly, do NOT modify):**
```
scripts/agent/apply_revision.py     # Import: from agent.apply_revision import apply_revision
scripts/agent/verify_suggestion.py  # Read for prompt patterns only. Do NOT import or call.
scripts/crawler/db.py               # Optional: Supabase client singleton
```