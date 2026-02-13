"""Pasal.id MCP Server — Indonesian Legal Database (v0.3).

Provides Claude with grounded access to Indonesian legislation through 4 tools:
- search_laws: Full-text search across Indonesian legal provisions
- get_pasal: Get exact text of a specific article
- get_law_status: Check if a law is still in force
- list_laws: Browse available regulations
"""
import logging
import os
import re
import time
from typing import Any

from dotenv import load_dotenv
from fastmcp import FastMCP
from supabase import create_client

load_dotenv()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("pasal.mcp")

DISCLAIMER = (
    "Informasi ini bukan nasihat hukum. Selalu verifikasi dengan sumber resmi "
    "di peraturan.go.id. Database Pasal.id saat ini mencakup sebagian kecil "
    "peraturan Indonesia."
)

STATUS_EXPLANATIONS: dict[str, str] = {
    "berlaku": "This law is currently in force.",
    "diubah": "This law has been partially amended. Most provisions remain in force unless specifically changed.",
    "dicabut": "This law has been revoked and is no longer in force.",
    "tidak_berlaku": "This law is no longer effective.",
}

AMENDMENT_REL_CODES = frozenset({"mengubah", "diubah_oleh", "mencabut", "dicabut_oleh"})

mcp = FastMCP(
    "Pasal.id — Indonesian Legal Database",
    instructions=(
        "Search, read, and analyze Indonesian laws and regulations. "
        "Provides grounded legal information with exact article citations "
        "to prevent hallucination. Covers 19+ major Indonesian laws "
        "including labor, marriage, criminal code, anti-corruption, "
        "corporate, consumer protection, and data privacy laws.\n\n"
        "LEGAL HIERARCHY (highest to lowest authority):\n"
        "UUD (Constitution) → UU (Law) → PP (Govt Regulation) → "
        "PERPRES (Presidential Reg) → PERMEN (Ministerial Reg) → PERDA (Regional Reg)\n\n"
        "WORKFLOW — Follow this order for best results:\n"
        "1. search_laws → Find relevant provisions by topic keyword\n"
        "2. get_pasal → Get exact article text for citation\n"
        "3. get_law_status → Verify the law is still in force before citing\n"
        "4. list_laws → Browse available regulations if search is too narrow\n\n"
        "CITATION FORMAT: Always cite as 'Pasal X UU No. Y Tahun Z'\n"
        "Example: 'Pasal 81 UU No. 13 Tahun 2003 tentang Ketenagakerjaan'\n\n"
        "SEARCH TIPS:\n"
        "- Search in Bahasa Indonesia for best results (e.g., 'upah minimum' not 'minimum wage')\n"
        "- Use specific legal terms: 'pemutusan hubungan kerja' not 'fired from job'\n"
        "- The database covers a limited set of regulations — if no results, "
        "it does NOT mean the law doesn't exist"
    ),
)

# Prefer anon key (read-only via RLS) over service role key
_supabase_key = os.environ.get("SUPABASE_ANON_KEY") or os.environ["SUPABASE_KEY"]
sb = create_client(
    os.environ["SUPABASE_URL"],
    _supabase_key,
)

_reg_types: dict[str, int] = {}
_reg_types_by_id: dict[int, str] = {}


def _ensure_reg_types() -> None:
    """Populate the regulation type caches on first call."""
    global _reg_types, _reg_types_by_id
    if _reg_types:
        return
    result = sb.table("regulation_types").select("id, code").execute()
    _reg_types = {r["code"]: r["id"] for r in result.data}
    _reg_types_by_id = {r["id"]: r["code"] for r in result.data}


def _get_law_count() -> int:
    """Return cached count of laws in the database (5-min TTL)."""
    cached = _law_count_cache.get("count")
    if cached is not None:
        return cached
    try:
        result = sb.table("works").select("id", count="exact").execute()
        count = result.count or 0
    except Exception:
        count = 0
    _law_count_cache.set("count", count)
    return count


def _with_disclaimer(result: dict | list) -> dict | list:
    """Append legal disclaimer to every tool response."""
    if isinstance(result, dict):
        result["disclaimer"] = DISCLAIMER
        return result
    for item in result:
        if isinstance(item, dict):
            item["disclaimer"] = DISCLAIMER
    return result


def _no_results_message(context: str) -> str:
    """Build a 'not in DB' caveat message."""
    n = _get_law_count()
    return (
        f"No results found for {context} in our database of {n} laws. "
        "This does NOT mean no such law exists — our database covers "
        "a limited set of Indonesian regulations."
    )


# ---------------------------------------------------------------------------
# Cross-reference extraction
# ---------------------------------------------------------------------------

CROSS_REF_PATTERN = re.compile(
    r'(?:sebagaimana\s+dimaksud\s+(?:dalam|pada)\s+)?'
    r'Pasal\s+(\d+[A-Z]?)'
    r'(?:\s+ayat\s+\((\d+)\))?'
    r'(?:\s+(?:huruf\s+([a-z])\.?))?'
    r'(?:\s+(?:Undang-Undang|UU)\s+(?:Nomor\s+)?(\d+)\s+Tahun\s+(\d{4}))?',
    re.IGNORECASE,
)


def extract_cross_references(text: str) -> list[dict]:
    """Extract cross-references to other articles from legal text."""
    refs, seen = [], set()
    for m in CROSS_REF_PATTERN.finditer(text):
        key = (m.group(1), m.group(2), m.group(4), m.group(5))
        if key in seen:
            continue
        seen.add(key)
        ref: dict[str, str | int] = {"pasal": m.group(1)}
        if m.group(2):
            ref["ayat"] = m.group(2)
        if m.group(3):
            ref["huruf"] = m.group(3)
        if m.group(4) and m.group(5):
            ref["law_number"] = m.group(4)
            ref["law_year"] = int(m.group(5))
        refs.append(ref)
    return refs


# ---------------------------------------------------------------------------
# TTL Cache
# ---------------------------------------------------------------------------

class TTLCache:
    """Simple in-memory cache with per-key TTL expiration."""

    def __init__(self, ttl_seconds: int = 3600):
        self._ttl = ttl_seconds
        self._data: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        ts, value = entry
        if time.time() - ts > self._ttl:
            del self._data[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._data[key] = (time.time(), value)

    def clear(self) -> None:
        self._data.clear()


_pasal_cache = TTLCache(ttl_seconds=3600)
_status_cache = TTLCache(ttl_seconds=3600)
_law_count_cache = TTLCache(ttl_seconds=300)


# ---------------------------------------------------------------------------
# Rate Limiter
# ---------------------------------------------------------------------------

class RateLimiter:
    """Simple sliding window rate limiter per tool."""

    def __init__(self, max_calls: int, window_seconds: int = 60):
        self._max = max_calls
        self._window = window_seconds
        self._calls: list[float] = []

    def check(self) -> int | None:
        """Return None if allowed, or seconds to wait if rate-limited."""
        now = time.time()
        cutoff = now - self._window
        self._calls = [t for t in self._calls if t > cutoff]
        if len(self._calls) >= self._max:
            oldest = self._calls[0]
            return int(oldest + self._window - now) + 1
        self._calls.append(now)
        return None

    def reset(self) -> None:
        self._calls.clear()


_rate_limiters = {
    "search_laws": RateLimiter(30),
    "get_pasal": RateLimiter(60),
    "get_law_status": RateLimiter(60),
    "list_laws": RateLimiter(30),
}


def _check_rate_limit(tool_name: str) -> dict | None:
    """Return rate limit error dict if exceeded, else None."""
    limiter = _rate_limiters.get(tool_name)
    if not limiter:
        return None
    wait = limiter.check()
    if wait is not None:
        return _with_disclaimer({
            "error": "Rate limit exceeded",
            "retry_after_seconds": wait,
        })
    return None


# ---------------------------------------------------------------------------
# Shared database helpers
# ---------------------------------------------------------------------------

def _find_work(law_type: str, law_number: str, year: int) -> dict | None:
    """Look up a work by regulation type code, number, and year.

    Returns the work row dict, or None if not found.
    Populates the regulation type caches as a side effect.
    """
    _ensure_reg_types()
    reg_type_id = _reg_types.get(law_type.upper())
    if not reg_type_id:
        return None
    result = sb.table("works").select("*").match({
        "regulation_type_id": reg_type_id,
        "number": law_number,
        "year": year,
    }).execute()
    if not result.data:
        return None
    return result.data[0]


def _get_chapter_info(node: dict) -> str:
    """Retrieve the parent chapter (BAB) heading for a document node."""
    if not node.get("parent_id"):
        return ""
    parent = sb.table("document_nodes").select(
        "node_type, number, heading"
    ).eq("id", node["parent_id"]).execute()
    if not parent.data:
        return ""
    p = parent.data[0]
    info = f"{p['node_type'].upper()} {p['number']}"
    if p.get("heading"):
        info += f" - {p['heading']}"
    return info


def _get_available_pasals(work_id: int) -> list[str]:
    """Get list of available pasal numbers for a work."""
    result = sb.table("document_nodes").select("number").match({
        "work_id": work_id,
        "node_type": "pasal",
    }).order("sort_order").limit(200).execute()
    return [r["number"] for r in (result.data or [])]


# ---------------------------------------------------------------------------
# MCP Tool Endpoints
# ---------------------------------------------------------------------------

@mcp.tool
def search_laws(
    query: str,
    regulation_type: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    language: str = "id",
    limit: int = 10,
) -> list[dict]:
    """Search Indonesian laws and regulations by keyword.

    USE WHEN: User asks about a legal topic, right, obligation, or regulation.
    This should be your FIRST tool call for any legal question.
    DO NEXT: Use get_pasal to retrieve the full text of relevant articles for citation.

    Uses PostgreSQL full-text search with Indonesian stemming.
    Returns relevant legal provisions with exact citations.
    IMPORTANT: Search in Indonesian for best results (e.g., "upah minimum" not "minimum wage").

    Args:
        query: Search query in Indonesian (e.g., "upah minimum pekerja", "korupsi", "perkawinan")
        regulation_type: Filter by type — UU (Law), PP (Govt Regulation), PERPRES (Presidential Reg), etc.
        year_from: Only return laws enacted after this year
        year_to: Only return laws enacted before this year
        language: Language filter — "id" (Indonesian, default) or "en" (English translations)
        limit: Maximum number of results (default 10)
    """
    rate_err = _check_rate_limit("search_laws")
    if rate_err:
        return [rate_err]

    t0 = time.time()
    logger.info("search_laws called: query=%r type=%s year_from=%s year_to=%s limit=%s",
                query, regulation_type, year_from, year_to, limit)

    if not query or not query.strip():
        return _with_disclaimer(
            [{"error": "Query cannot be empty", "suggestion": "Provide a search term in Indonesian"}]
        )

    limit = min(limit, 50)

    metadata_filter: dict = {}
    if regulation_type:
        metadata_filter["type"] = regulation_type.upper()
    if language != "id":
        metadata_filter["language"] = language

    try:
        result = sb.rpc("search_legal_chunks", {
            "query_text": query.strip(),
            "match_count": limit * 3,  # fetch extra to filter
            "metadata_filter": metadata_filter,
        }).execute()
    except Exception as e:
        logger.error("search_laws RPC failed: %s", e)
        return _with_disclaimer([{"error": f"Search failed: {str(e)}"}])

    if not result.data:
        logger.info("search_laws: no results for %r (%.0fms)", query, (time.time() - t0) * 1000)
        return _with_disclaimer([{
            "message": _no_results_message(f"'{query}'"),
            "suggestion": "Try simpler keywords or remove filters",
        }])

    try:
        work_ids = list(set(r["work_id"] for r in result.data))
        works_result = sb.table("works").select(
            "id, frbr_uri, title_id, number, year, status, regulation_type_id"
        ).in_("id", work_ids).execute()
        works_map = {w["id"]: w for w in works_result.data}
    except Exception as e:
        logger.error("search_laws metadata fetch failed: %s", e)
        return _with_disclaimer([{"error": f"Failed to fetch law metadata: {str(e)}"}])

    _ensure_reg_types()

    enriched = []
    for r in result.data:
        work = works_map.get(r["work_id"])
        if not work:
            continue

        # Apply year filter
        if year_from and work["year"] < year_from:
            continue
        if year_to and work["year"] > year_to:
            continue

        reg_code = _reg_types_by_id.get(work["regulation_type_id"], "")
        meta = r.get("metadata", {})

        enriched.append({
            "law_title": work["title_id"],
            "frbr_uri": work["frbr_uri"],
            "regulation_type": reg_code,
            "year": work["year"],
            "pasal": f"Pasal {meta.get('pasal', '?')}",
            "snippet": r.get("snippet", r["content"][:300]),
            "status": work["status"],
            "relevance_score": round(r["score"], 4),
        })

        if len(enriched) >= limit:
            break

    logger.info("search_laws: %d results for %r (%.0fms)",
                len(enriched), query, (time.time() - t0) * 1000)
    return _with_disclaimer(enriched)


@mcp.tool
def get_pasal(
    law_type: str,
    law_number: str,
    year: int,
    pasal_number: str,
) -> dict:
    """Get the exact text of a specific article (Pasal) from an Indonesian regulation.

    USE WHEN: You know which specific article to cite (from search_laws results).
    DO NEXT: Use get_law_status to verify the law is still in force before presenting to user.

    Args:
        law_type: Regulation type code, e.g., "UU", "PP", "PERPRES"
        law_number: The number of the law, e.g., "13"
        year: Year the law was enacted, e.g., 2003
        pasal_number: Article number, e.g., "81" or "81A"
    """
    rate_err = _check_rate_limit("get_pasal")
    if rate_err:
        return rate_err

    cache_key = f"{law_type.upper()}:{law_number}:{year}:{pasal_number}"
    cached = _pasal_cache.get(cache_key)
    if cached is not None:
        logger.info("get_pasal cache hit: %s", cache_key)
        return cached

    t0 = time.time()
    logger.info("get_pasal called: %s %s/%d pasal %s", law_type, law_number, year, pasal_number)

    try:
        work = _find_work(law_type, law_number, year)
        if not work:
            # Distinguish "unknown type" from "work not found"
            _ensure_reg_types()
            if not _reg_types.get(law_type.upper()):
                return _with_disclaimer({"error": f"Unknown regulation type: {law_type}"})
            return _with_disclaimer({
                "error": _no_results_message(f"'{law_type} {law_number}/{year}'"),
                "suggestion": "Use list_laws to check available regulations, or verify type/number/year.",
            })

        node_result = sb.table("document_nodes").select("*").match({
            "work_id": work["id"],
            "node_type": "pasal",
            "number": pasal_number,
        }).execute()

        if not node_result.data:
            return _with_disclaimer({
                "error": f"Pasal {pasal_number} not found in {law_type} {law_number}/{year}",
                "suggestion": "Check available_pasals below, or use search_laws to find the right article.",
                "available_pasals": _get_available_pasals(work["id"]),
            })

        node = node_result.data[0]

        ayat_result = sb.table("document_nodes").select("number, content_text").match({
            "work_id": work["id"],
            "parent_id": node["id"],
            "node_type": "ayat",
        }).order("sort_order").execute()

        chapter_info = _get_chapter_info(node)

        content = node["content_text"] or ""
        cross_refs = extract_cross_references(content)
        ayat_data = ayat_result.data or []
        if len(content) > 3000:
            content = (
                content[:3000]
                + f"\n\n[...truncated. Full: {len(node['content_text'])} chars. "
                f"This article has {len(ayat_data)} ayat.]"
            )

        logger.info("get_pasal: found pasal %s (%.0fms)", pasal_number, (time.time() - t0) * 1000)
        result = _with_disclaimer({
            "law_title": work["title_id"],
            "frbr_uri": work["frbr_uri"],
            "pasal_number": pasal_number,
            "chapter": chapter_info,
            "content_id": content,
            "ayat": [{"number": a["number"], "text": a["content_text"]} for a in ayat_data],
            "cross_references": cross_refs,
            "status": work["status"],
            "source_url": work.get("source_url", ""),
        })
        _pasal_cache.set(cache_key, result)
        return result
    except Exception as e:
        logger.error("get_pasal failed: %s", e)
        return _with_disclaimer({"error": f"Failed to retrieve pasal: {str(e)}"})


@mcp.tool
def get_law_status(
    law_type: str,
    law_number: str,
    year: int,
) -> dict:
    """Check whether an Indonesian regulation is still in force, has been amended, or was revoked.

    USE WHEN: You need to verify a law's validity before citing it to the user.
    ALWAYS check status before presenting legal information — a revoked law is misleading.
    Returns the full amendment/revocation chain.

    Args:
        law_type: Regulation type code, e.g., "UU"
        law_number: The number of the law, e.g., "1"
        year: Year the law was enacted, e.g., 1974
    """
    rate_err = _check_rate_limit("get_law_status")
    if rate_err:
        return rate_err

    cache_key = f"{law_type.upper()}:{law_number}:{year}"
    cached = _status_cache.get(cache_key)
    if cached is not None:
        logger.info("get_law_status cache hit: %s", cache_key)
        return cached

    t0 = time.time()
    logger.info("get_law_status called: %s %s/%d", law_type, law_number, year)

    try:
        work = _find_work(law_type, law_number, year)
        if not work:
            _ensure_reg_types()
            if not _reg_types.get(law_type.upper()):
                return _with_disclaimer({"error": f"Unknown regulation type: {law_type}"})
            return _with_disclaimer({
                "error": _no_results_message(f"'{law_type} {law_number}/{year}'"),
            })

        rels = sb.table("work_relationships").select(
            "*, relationship_types(code, name_id, name_en)"
        ).or_(
            f"source_work_id.eq.{work['id']},target_work_id.eq.{work['id']}"
        ).execute()

        rel_rows = rels.data or []
        related_work_ids = {
            wid
            for r in rel_rows
            for wid in (r["source_work_id"], r["target_work_id"])
        } - {work["id"]}

        related_works: dict[int, dict] = {}
        if related_work_ids:
            rw = sb.table("works").select(
                "id, frbr_uri, title_id, number, year, status, regulation_type_id"
            ).in_("id", list(related_work_ids)).execute()
            related_works = {w["id"]: w for w in rw.data}

        amendments = []
        related = []
        for r in rel_rows:
            rel_type = r.get("relationship_types", {})
            other_id = r["target_work_id"] if r["source_work_id"] == work["id"] else r["source_work_id"]
            other_work = related_works.get(other_id)
            if not other_work:
                continue

            other_code = _reg_types_by_id.get(other_work["regulation_type_id"], "")
            entry = {
                "relationship": rel_type.get("name_en", ""),
                "relationship_id": rel_type.get("name_id", ""),
                "law": f"{other_code} {other_work['number']}/{other_work['year']}",
                "full_title": other_work["title_id"],
                "frbr_uri": other_work["frbr_uri"],
            }

            if rel_type.get("code") in AMENDMENT_REL_CODES:
                amendments.append(entry)
            else:
                related.append(entry)

        logger.info("get_law_status: %s %s/%d status=%s (%.0fms)",
                     law_type, law_number, year, work["status"], (time.time() - t0) * 1000)
        result = _with_disclaimer({
            "law_title": work["title_id"],
            "frbr_uri": work["frbr_uri"],
            "status": work["status"],
            "status_explanation": STATUS_EXPLANATIONS.get(work["status"], ""),
            "date_enacted": str(work["date_enacted"]) if work.get("date_enacted") else None,
            "amendments": amendments,
            "related_laws": related,
        })
        _status_cache.set(cache_key, result)
        return result
    except Exception as e:
        logger.error("get_law_status failed: %s", e)
        return _with_disclaimer({"error": f"Failed to retrieve law status: {str(e)}"})


@mcp.tool
def list_laws(
    regulation_type: str | None = None,
    year: int | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Browse available Indonesian regulations with optional filters.

    USE WHEN: User wants to browse or list regulations, or when search_laws returned no results.
    PREFER search_laws for specific legal questions — this tool is for discovery/browsing.

    Args:
        regulation_type: Filter by type — UU, PP, PERPRES, PERMEN, etc.
        year: Filter by year enacted
        status: Filter by status — "berlaku" (in force), "dicabut" (revoked), "diubah" (amended)
        search: Keyword filter on law title
        page: Page number (default 1)
        per_page: Results per page (default 20)
    """
    rate_err = _check_rate_limit("list_laws")
    if rate_err:
        return rate_err

    t0 = time.time()
    logger.info("list_laws called: type=%s year=%s status=%s search=%s page=%d",
                regulation_type, year, status, search, page)

    try:
        _ensure_reg_types()

        query = sb.table("works").select("*, regulation_types(code, name_id)", count="exact")

        if regulation_type:
            reg_type_id = _reg_types.get(regulation_type.upper())
            if reg_type_id:
                query = query.eq("regulation_type_id", reg_type_id)

        if year:
            query = query.eq("year", year)

        if status:
            query = query.eq("status", status)

        if search:
            query = query.ilike("title_id", f"%{search}%")

        offset = (page - 1) * per_page
        result = query.order("year", desc=True).range(offset, offset + per_page - 1).execute()

        total = result.count or 0
        laws = [
            {
                "frbr_uri": w["frbr_uri"],
                "title": w["title_id"],
                "regulation_type": w.get("regulation_types", {}).get("code", ""),
                "number": w["number"],
                "year": w["year"],
                "status": w["status"],
            }
            for w in (result.data or [])
        ]

        logger.info("list_laws: %d/%d results (%.0fms)", len(laws), total, (time.time() - t0) * 1000)
        return _with_disclaimer({
            "total": total,
            "page": page,
            "per_page": per_page,
            "laws": laws,
        })
    except Exception as e:
        logger.error("list_laws failed: %s", e)
        return _with_disclaimer({"error": f"Failed to list laws: {str(e)}"})


@mcp.tool
def ping() -> str:
    """Health check — verify the MCP server is running and connected to the database."""
    try:
        result = sb.table("works").select("id", count="exact").execute()
        count = result.count or 0
        return f"Pasal.id MCP server is running. Database has {count} laws loaded."
    except Exception as e:
        return f"Server running but database error: {e}"


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    mcp.run(transport="streamable-http", host="0.0.0.0", port=port)
