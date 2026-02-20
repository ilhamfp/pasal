"""Parser improvement agent — closes the feedback loop.

Aggregates parser_feedback from recent Opus 4.6 verifications,
fetches parser source from GitHub, sends both to Opus for analysis,
and creates GitHub issues with specific code fixes.
"""

import base64
import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")       # agent-specific
load_dotenv(Path(__file__).parent.parent / ".env")  # scripts/ fallback

from agent.pdf_utils import get_supabase
from agent.logger import log_parser_analysis_header, log_parser_analysis_result, StepTimer

GITHUB_API = "https://api.github.com"
GITHUB_REPO = os.environ.get("GITHUB_REPO", "ilhamfp/pasal")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
PARSER_FILES = [
    "scripts/parser/parse_structure.py",
    "scripts/parser/ocr_correct.py",
    "scripts/parser/extract_pymupdf.py",
]
ISSUE_LABELS = ["parser-improvement", "opus-agent"]


def _github_headers() -> dict[str, str]:
    """Build GitHub API request headers."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def collect_parser_feedback(since_hours: int = 24) -> list[dict]:
    """Collect parser feedback from recent accepted suggestions.

    Queries suggestions where the agent accepted (or accepted with corrections)
    and extracts the parser_feedback field from the agent response.

    Returns list of dicts with feedback details.
    """
    sb = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()

    result = (
        sb.table("suggestions")
        .select("id, agent_response, current_content, suggested_content, work_id")
        .in_("agent_decision", ["accept", "accept_with_corrections"])
        .gte("agent_completed_at", cutoff)
        .limit(50)
        .execute()
    )

    items = []
    for row in result.data or []:
        agent_response = row.get("agent_response")
        if not agent_response:
            continue

        # Handle both str and dict (JSONB may auto-parse)
        if isinstance(agent_response, str):
            try:
                agent_response = json.loads(agent_response)
            except (json.JSONDecodeError, TypeError):
                continue

        parsed = agent_response.get("parsed", {})
        feedback = parsed.get("parser_feedback", "")
        if isinstance(feedback, dict):
            feedback = json.dumps(feedback, ensure_ascii=False)

        # Skip empty or trivial feedback
        if not feedback or len(feedback.strip()) < 10:
            continue

        # Fetch work title and node number
        work_title = agent_response.get("work_title", "")
        node_number = ""

        # Try to get node info from the suggestion's context
        additional_issues = parsed.get("additional_issues", [])

        items.append({
            "suggestion_id": row["id"],
            "parser_feedback": feedback,
            "additional_issues": additional_issues,
            "current_content": row.get("current_content", ""),
            "suggested_content": row.get("suggested_content", ""),
            "work_title": work_title,
            "node_number": node_number,
        })

    return items


def fetch_parser_files() -> dict[str, str]:
    """Fetch parser source files from GitHub.

    Returns dict mapping filename to source code string.
    """
    headers = _github_headers()
    files = {}

    for path in PARSER_FILES:
        url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{path}"
        try:
            resp = httpx.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            content_b64 = data.get("content", "")
            source = base64.b64decode(content_b64).decode("utf-8")
            filename = path.split("/")[-1]
            files[filename] = source
        except Exception as e:
            print(f"  Warning: Could not fetch {path}: {e}", flush=True)

    return files


def search_existing_issues() -> list[dict]:
    """Search for existing parser-improvement issues on GitHub.

    Returns list of {title, number, url}.
    """
    headers = _github_headers()
    url = (
        f"{GITHUB_API}/repos/{GITHUB_REPO}/issues"
        f"?labels=parser-improvement&state=open&per_page=50"
    )

    try:
        resp = httpx.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return [
            {
                "title": issue["title"],
                "number": issue["number"],
                "url": issue["html_url"],
            }
            for issue in resp.json()
        ]
    except Exception as e:
        print(f"  Warning: Could not fetch existing issues: {e}", flush=True)
        return []


def _is_duplicate(title: str, existing: list[dict]) -> dict | None:
    """Check if an issue title is a duplicate of an existing issue.

    Returns the existing issue dict if duplicate, else None.
    """
    title_lower = title.lower()
    title_words = set(title_lower.split())

    for issue in existing:
        existing_lower = issue["title"].lower()
        existing_words = set(existing_lower.split())

        # Substring match
        if title_lower in existing_lower or existing_lower in title_lower:
            return issue

        # Word overlap > 60%
        if title_words and existing_words:
            overlap = len(title_words & existing_words)
            max_len = max(len(title_words), len(existing_words))
            if max_len > 0 and overlap / max_len > 0.6:
                return issue

    return None


def _repair_truncated_json(text: str) -> str:
    """Attempt to repair JSON truncated by max_tokens.

    Closes unterminated strings, arrays, and objects so json.loads() can parse
    a partial but structurally valid result.
    """
    # Close unterminated string (odd number of unescaped quotes)
    in_string = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == '\\' and in_string:
            i += 2  # skip escaped char
            continue
        if ch == '"':
            in_string = not in_string
        i += 1
    if in_string:
        text += '"'

    # Close open brackets/braces by scanning for unmatched openers
    stack: list[str] = []
    in_str = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == '\\' and in_str:
            i += 2
            continue
        if ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch in ('{', '['):
                stack.append(ch)
            elif ch == '}' and stack and stack[-1] == '{':
                stack.pop()
            elif ch == ']' and stack and stack[-1] == '[':
                stack.pop()
        i += 1

    # Remove trailing comma before closing
    text = text.rstrip()
    if text.endswith(','):
        text = text[:-1]

    for opener in reversed(stack):
        text += ']' if opener == '[' else '}'

    return text


def analyze_parser_improvements(
    feedback_items: list[dict],
    parser_files: dict[str, str],
) -> dict:
    """Send feedback + parser source to Opus 4.6 for code analysis.

    Returns dict with {issues: [...], summary: str}.
    """
    try:
        import anthropic

        client = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_CORRECTION_AGENT_KEY"],
        )

        system_prompt = """You are a senior Python developer analyzing a PDF parser for Indonesian legal documents.

You will receive:
1. Parser feedback collected from verification of crowd-sourced corrections
2. The full source code of the parser files

Analyze the feedback patterns and identify systematic issues in the parser code.
For each issue, provide a specific code fix.

Return JSON:
{
  "issues": [
    {
      "title": "Short descriptive title (max 80 chars)",
      "file": "filename.py",
      "function": "function_name",
      "current_behavior": "What the parser does wrong",
      "fix_description": "What should change and why",
      "code_before": "Relevant current code snippet",
      "code_after": "Fixed code snippet",
      "errors_fixed": 1,
      "severity": "high" | "medium" | "low"
    }
  ],
  "summary": "Brief overall assessment of parser quality and top priorities"
}

Focus on:
- OCR artifact patterns not handled by ocr_correct.py
- Regex patterns in parse_structure.py that miss edge cases
- Text extraction issues in extract_pymupdf.py
- Systematic issues (not one-off typos)

Keep code_before and code_after concise — only the directly relevant lines (max ~30 lines each), not entire functions.

Only propose issues you are confident about. Quality over quantity."""

        # Build numbered feedback list
        feedback_text = ""
        for i, item in enumerate(feedback_items, 1):
            current = item.get("current_content", "")[:300]
            suggested = item.get("suggested_content", "")[:300]
            feedback_text += (
                f"\n### Feedback #{i}\n"
                f"**Law:** {item.get('work_title', '(unknown)')}\n"
                f"**Feedback:** {item['parser_feedback']}\n"
                f"**Current text:** {current}\n"
                f"**Corrected text:** {suggested}\n"
            )

        # Build parser source section
        source_text = ""
        for filename, source in parser_files.items():
            source_text += f"\n\n### {filename}\n```python\n{source}\n```"

        user_message = (
            f"## Parser Feedback ({len(feedback_items)} entries)\n"
            f"{feedback_text}\n\n"
            f"## Parser Source Code\n{source_text}"
        )

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=16384,
            temperature=0.1,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        truncated = response.stop_reason == "max_tokens"
        if truncated:
            print("  Warning: Opus response truncated (hit max_tokens)", flush=True)

        raw_text = response.content[0].text
        text = raw_text.strip()

        # Extract JSON object using regex (handles nested backticks correctly)
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            text = json_match.group(0)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            if truncated:
                # Attempt repair: close unterminated strings, arrays, objects
                repaired = _repair_truncated_json(text)
                try:
                    return json.loads(repaired)
                except json.JSONDecodeError:
                    pass
            print(f"  Raw response (first 500 chars): {raw_text[:500]}", flush=True)
            raise

    except json.JSONDecodeError as e:
        print(f"  Error in Opus analysis (JSON parse): {e}", flush=True)
        return {"issues": [], "summary": f"Analysis failed: JSON parse error", "error": str(e)}
    except Exception as e:
        print(f"  Error in Opus analysis: {e}", flush=True)
        return {"issues": [], "summary": f"Analysis failed: {e}", "error": str(e)}


def create_github_issue(
    title: str,
    body: str,
    labels: list[str] | None = None,
) -> dict | None:
    """Create a GitHub issue.

    Returns {url, number} or None on failure.
    """
    if not GITHUB_TOKEN:
        print(f"  Skipping issue creation (no GITHUB_TOKEN): {title}", flush=True)
        return None

    headers = _github_headers()
    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/issues"
    payload: dict = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=15)

        # Retry without labels on 422 (labels may not exist)
        if resp.status_code == 422 and labels:
            payload.pop("labels", None)
            resp = httpx.post(url, headers=headers, json=payload, timeout=15)

        resp.raise_for_status()
        data = resp.json()
        return {"url": data["html_url"], "number": data["number"]}
    except Exception as e:
        print(f"  Error creating issue '{title}': {e}", flush=True)
        return None


def _format_issue_body(issue: dict, feedback_count: int) -> str:
    """Format a GitHub issue body from an analysis issue."""
    severity = issue.get("severity", "medium").upper()
    errors_fixed = issue.get("errors_fixed", "?")

    body = f"""## Parser Improvement: {issue.get('title', 'Untitled')}

**Severity:** {severity}
**File:** `{issue.get('file', '?')}`
**Function:** `{issue.get('function', '?')}`
**Estimated errors fixed:** {errors_fixed}

### Current Behavior

{issue.get('current_behavior', 'N/A')}

### Proposed Fix

{issue.get('fix_description', 'N/A')}

### Code Before

```python
{issue.get('code_before', '# N/A')}
```

### Code After

```python
{issue.get('code_after', '# N/A')}
```

---

_Generated by the Pasal.id Correction Agent (Opus 4.6) after analyzing {feedback_count} parser feedback entries._
"""
    return body


def create_improvement_issues(
    analysis: dict,
    feedback_count: int,
) -> list[dict]:
    """Create GitHub issues for each identified parser improvement.

    Deduplicates against existing open issues.
    Returns list of {url, number, title} for created issues.
    """
    issues = analysis.get("issues", [])
    if not issues:
        return []

    existing = search_existing_issues()
    created = []

    for issue in issues:
        title = f"[Parser] {issue.get('title', 'Untitled')}"

        dup = _is_duplicate(title, existing)
        if dup:
            print(
                f"  Skipping duplicate: '{title}' "
                f"(matches #{dup['number']})",
                flush=True,
            )
            continue

        body = _format_issue_body(issue, feedback_count)
        result = create_github_issue(title, body, labels=ISSUE_LABELS)

        if result:
            result["title"] = title
            created.append(result)
            # Add to existing list to prevent intra-batch duplicates
            existing.append({
                "title": title,
                "number": result["number"],
                "url": result["url"],
            })

    return created


async def run_parser_analysis(force: bool = False) -> None:
    """Orchestrate the parser feedback analysis pipeline.

    Steps:
    1. Collect parser feedback from recent verifications
    2. Fetch parser source code from GitHub
    3. Send to Opus 4.6 for analysis, create GitHub issues

    Args:
        force: If True, run even with fewer than 3 feedback items.
    """
    log_parser_analysis_header()

    # Step 1: Collect feedback
    with StepTimer(1, 3, "Collecting parser feedback...") as step1:
        feedback_items = collect_parser_feedback(since_hours=24)
        step1.detail(f"Found {len(feedback_items)} feedback entries")

        if len(feedback_items) < 3 and not force:
            step1.detail("Not enough feedback (need 3+). Use --force to override.")
            print(flush=True)
            return

        if not feedback_items:
            step1.detail("No feedback entries found.")
            print(flush=True)
            return

    # Step 2: Fetch parser source
    with StepTimer(2, 3, "Fetching parser source from GitHub...") as step2:
        parser_files = fetch_parser_files()
        step2.detail(f"Fetched {len(parser_files)} files")
        for name, source in parser_files.items():
            step2.detail(f"{name}: {len(source):,} chars")

        if not parser_files:
            step2.detail("Could not fetch any parser files. Aborting.")
            print(flush=True)
            return

    # Step 3: Opus analysis + issue creation
    with StepTimer(3, 3, "Opus 4.6 analyzing parser code...") as step3:
        analysis = analyze_parser_improvements(feedback_items, parser_files)

        issue_count = len(analysis.get("issues", []))
        step3.detail(f"Identified {issue_count} potential improvements")

        if analysis.get("summary"):
            step3.detail(f"Summary: {analysis['summary'][:80]}")

        created = create_improvement_issues(analysis, len(feedback_items))
        step3.detail(f"Created {len(created)} GitHub issues")

    # Log results
    files_analyzed = list(parser_files.keys())
    issue_titles = [c["title"] for c in created]
    log_parser_analysis_result(len(feedback_items), files_analyzed, issue_titles)

    # Print per-issue details
    if created:
        print("  Created issues:", flush=True)
        for i, issue in enumerate(created):
            prefix = "  └─" if i == len(created) - 1 else "  ├─"
            print(f"{prefix} #{issue['number']}: {issue['title']}", flush=True)
            print(f"     {issue['url']}", flush=True)
    print(flush=True)
