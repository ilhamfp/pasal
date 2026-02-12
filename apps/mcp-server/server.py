"""Pasal.id MCP Server — Indonesian Legal Database (v0.3).

Provides Claude with grounded access to Indonesian legislation through 4 tools:
- search_laws: Full-text search across Indonesian legal provisions
- get_pasal: Get exact text of a specific article
- get_law_status: Check if a law is still in force
- list_laws: Browse available regulations
"""
import logging
import os
import time
from typing import Optional

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

mcp = FastMCP(
    "Pasal.id — Indonesian Legal Database",
    instructions=(
        "Search, read, and analyze Indonesian laws and regulations. "
        "Provides grounded legal information with exact article citations "
        "to prevent hallucination. Covers 19+ major Indonesian laws "
        "including labor, marriage, criminal code, anti-corruption, "
        "corporate, consumer protection, and data privacy laws."
    ),
)

sb = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

# Cache regulation types
_reg_types: dict[str, int] = {}
_reg_types_by_id: dict[int, str] = {}


def _get_reg_types() -> dict[str, int]:
    global _reg_types, _reg_types_by_id
    if not _reg_types:
        result = sb.table("regulation_types").select("id, code").execute()
        _reg_types = {r["code"]: r["id"] for r in result.data}
        _reg_types_by_id = {r["id"]: r["code"] for r in result.data}
    return _reg_types


_law_count: int | None = None
_law_count_ts: float = 0.0


def _get_law_count() -> int:
    """Return cached count of laws in the database (5-min TTL)."""
    global _law_count, _law_count_ts
    if _law_count is not None and (time.time() - _law_count_ts) < 300:
        return _law_count
    try:
        result = sb.table("works").select("id", count="exact").execute()
        _law_count = result.count or 0
    except Exception:
        _law_count = _law_count if _law_count is not None else 0
    _law_count_ts = time.time()
    return _law_count


def _with_disclaimer(result: dict | list) -> dict | list:
    """Append legal disclaimer to every tool response."""
    if isinstance(result, dict):
        result["disclaimer"] = DISCLAIMER
    elif isinstance(result, list):
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


@mcp.tool
def search_laws(
    query: str,
    regulation_type: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    limit: int = 10,
) -> list[dict]:
    """Search Indonesian laws and regulations by keyword.

    Uses PostgreSQL full-text search with Indonesian stemming.
    Returns relevant legal provisions with exact citations.
    IMPORTANT: Search in Indonesian for best results (e.g., "upah minimum" not "minimum wage").

    Args:
        query: Search query in Indonesian (e.g., "upah minimum pekerja", "korupsi", "perkawinan")
        regulation_type: Filter by type — UU (Law), PP (Govt Regulation), PERPRES (Presidential Reg), etc.
        year_from: Only return laws enacted after this year
        year_to: Only return laws enacted before this year
        limit: Maximum number of results (default 10)
    """
    t0 = time.time()
    logger.info("search_laws called: query=%r type=%s year_from=%s year_to=%s limit=%s",
                query, regulation_type, year_from, year_to, limit)

    if not query or not query.strip():
        return _with_disclaimer(
            [{"error": "Query cannot be empty", "suggestion": "Provide a search term in Indonesian"}]
        )

    limit = min(limit, 50)

    # Build metadata filter
    metadata_filter: dict = {}
    if regulation_type:
        metadata_filter["type"] = regulation_type.upper()

    try:
        # Call the search function
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

    # Enrich with work metadata
    try:
        work_ids = list(set(r["work_id"] for r in result.data))
        works_result = sb.table("works").select(
            "id, frbr_uri, title_id, number, year, status, regulation_type_id"
        ).in_("id", work_ids).execute()
        works_map = {w["id"]: w for w in works_result.data}
    except Exception as e:
        logger.error("search_laws metadata fetch failed: %s", e)
        return _with_disclaimer([{"error": f"Failed to fetch law metadata: {str(e)}"}])

    _get_reg_types()

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
            "content": r["content"],
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

    Use this when you need the precise legal text for citation.

    Args:
        law_type: Regulation type code, e.g., "UU", "PP", "PERPRES"
        law_number: The number of the law, e.g., "13"
        year: Year the law was enacted, e.g., 2003
        pasal_number: Article number, e.g., "81" or "81A"
    """
    t0 = time.time()
    logger.info("get_pasal called: %s %s/%d pasal %s", law_type, law_number, year, pasal_number)

    try:
        _get_reg_types()
        reg_type_id = _reg_types.get(law_type.upper())
        if not reg_type_id:
            return _with_disclaimer({"error": f"Unknown regulation type: {law_type}"})

        # Find the work
        work_result = sb.table("works").select("*").match({
            "regulation_type_id": reg_type_id,
            "number": law_number,
            "year": year,
        }).execute()

        if not work_result.data:
            return _with_disclaimer({
                "error": _no_results_message(f"'{law_type} {law_number}/{year}'"),
            })

        work = work_result.data[0]

        # Find the pasal node
        node_result = sb.table("document_nodes").select("*").match({
            "work_id": work["id"],
            "node_type": "pasal",
            "number": pasal_number,
        }).execute()

        if not node_result.data:
            return _with_disclaimer({
                "error": f"Pasal {pasal_number} not found in {law_type} {law_number}/{year}",
                "available_pasals": _get_available_pasals(work["id"]),
            })

        node = node_result.data[0]

        # Get ayat children
        ayat_result = sb.table("document_nodes").select("number, content_text").match({
            "work_id": work["id"],
            "parent_id": node["id"],
            "node_type": "ayat",
        }).order("sort_order").execute()

        # Get parent (bab) info
        chapter_info = ""
        if node.get("parent_id"):
            parent = sb.table("document_nodes").select(
                "node_type, number, heading"
            ).eq("id", node["parent_id"]).execute()
            if parent.data:
                p = parent.data[0]
                chapter_info = f"{p['node_type'].upper()} {p['number']}"
                if p.get("heading"):
                    chapter_info += f" - {p['heading']}"

        logger.info("get_pasal: found pasal %s (%.0fms)", pasal_number, (time.time() - t0) * 1000)
        return _with_disclaimer({
            "law_title": work["title_id"],
            "frbr_uri": work["frbr_uri"],
            "pasal_number": pasal_number,
            "chapter": chapter_info,
            "content_id": node["content_text"],
            "ayat": [{"number": a["number"], "text": a["content_text"]} for a in (ayat_result.data or [])],
            "status": work["status"],
            "source_url": work.get("source_url", ""),
        })
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

    Returns the full amendment/revocation chain.

    Args:
        law_type: Regulation type code, e.g., "UU"
        law_number: The number of the law, e.g., "1"
        year: Year the law was enacted, e.g., 1974
    """
    t0 = time.time()
    logger.info("get_law_status called: %s %s/%d", law_type, law_number, year)

    try:
        _get_reg_types()
        reg_type_id = _reg_types.get(law_type.upper())
        if not reg_type_id:
            return _with_disclaimer({"error": f"Unknown regulation type: {law_type}"})

        work_result = sb.table("works").select("*").match({
            "regulation_type_id": reg_type_id,
            "number": law_number,
            "year": year,
        }).execute()

        if not work_result.data:
            return _with_disclaimer({
                "error": _no_results_message(f"'{law_type} {law_number}/{year}'"),
            })

        work = work_result.data[0]

        # Get relationships
        rels = sb.table("work_relationships").select(
            "*, relationship_types(code, name_id, name_en)"
        ).or_(
            f"source_work_id.eq.{work['id']},target_work_id.eq.{work['id']}"
        ).execute()

        # Get related work info
        related_work_ids = set()
        for r in (rels.data or []):
            related_work_ids.add(r["source_work_id"])
            related_work_ids.add(r["target_work_id"])
        related_work_ids.discard(work["id"])

        related_works = {}
        if related_work_ids:
            rw = sb.table("works").select(
                "id, frbr_uri, title_id, number, year, status, regulation_type_id"
            ).in_("id", list(related_work_ids)).execute()
            related_works = {w["id"]: w for w in rw.data}

        # Build amendment chain
        amendments = []
        related = []
        for r in (rels.data or []):
            rel_type = r.get("relationship_types", {})
            other_id = r["target_work_id"] if r["source_work_id"] == work["id"] else r["source_work_id"]
            other_work = related_works.get(other_id)
            if not other_work:
                continue

            other_code = _reg_types_by_id.get(other_work["regulation_type_id"], "")
            other_title = f"{other_code} {other_work['number']}/{other_work['year']}"

            entry = {
                "relationship": rel_type.get("name_en", ""),
                "relationship_id": rel_type.get("name_id", ""),
                "law": other_title,
                "full_title": other_work["title_id"],
                "frbr_uri": other_work["frbr_uri"],
            }

            if rel_type.get("code") in ("mengubah", "diubah_oleh", "mencabut", "dicabut_oleh"):
                amendments.append(entry)
            else:
                related.append(entry)

        status_explanations = {
            "berlaku": "This law is currently in force.",
            "diubah": "This law has been partially amended. Most provisions remain in force unless specifically changed.",
            "dicabut": "This law has been revoked and is no longer in force.",
            "tidak_berlaku": "This law is no longer effective.",
        }

        logger.info("get_law_status: %s %s/%d status=%s (%.0fms)",
                     law_type, law_number, year, work["status"], (time.time() - t0) * 1000)
        return _with_disclaimer({
            "law_title": work["title_id"],
            "frbr_uri": work["frbr_uri"],
            "status": work["status"],
            "status_explanation": status_explanations.get(work["status"], ""),
            "date_enacted": str(work["date_enacted"]) if work.get("date_enacted") else None,
            "amendments": amendments,
            "related_laws": related,
        })
    except Exception as e:
        logger.error("get_law_status failed: %s", e)
        return _with_disclaimer({"error": f"Failed to retrieve law status: {str(e)}"})


@mcp.tool
def list_laws(
    regulation_type: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Browse available Indonesian regulations with optional filters.

    Args:
        regulation_type: Filter by type — UU, PP, PERPRES, PERMEN, etc.
        year: Filter by year enacted
        status: Filter by status — "berlaku" (in force), "dicabut" (revoked), "diubah" (amended)
        search: Keyword filter on law title
        page: Page number (default 1)
        per_page: Results per page (default 20)
    """
    t0 = time.time()
    logger.info("list_laws called: type=%s year=%s status=%s search=%s page=%d",
                regulation_type, year, status, search, page)

    try:
        _get_reg_types()

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
        laws = []
        for w in (result.data or []):
            reg = w.get("regulation_types", {})
            laws.append({
                "frbr_uri": w["frbr_uri"],
                "title": w["title_id"],
                "regulation_type": reg.get("code", ""),
                "number": w["number"],
                "year": w["year"],
                "status": w["status"],
            })

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


def _get_available_pasals(work_id: int) -> list[str]:
    """Get list of available pasal numbers for a work."""
    result = sb.table("document_nodes").select("number").match({
        "work_id": work_id,
        "node_type": "pasal",
    }).order("sort_order").limit(200).execute()
    return [r["number"] for r in (result.data or [])]


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
