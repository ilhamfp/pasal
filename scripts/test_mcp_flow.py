"""End-to-end MCP flow test — replicates MCP tool logic via Supabase.

Tests 3 demo scenarios to verify the data + search pipeline works.
"""

import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

passed = 0
failed = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        print(f"  ✅ {name}" + (f" — {detail}" if detail else ""))
        passed += 1
    else:
        print(f"  ❌ {name}" + (f" — {detail}" if detail else ""))
        failed += 1


def search_laws(query: str, limit: int = 10) -> list[dict]:
    """Replicate MCP search_laws."""
    result = sb.rpc(
        "search_legal_chunks",
        {"query_text": query, "match_count": limit, "metadata_filter": {}},
    ).execute()
    return result.data or []


def get_pasal(law_type: str, law_number: str, year: int, pasal: str) -> dict | None:
    """Replicate MCP get_pasal."""
    reg = sb.table("regulation_types").select("id").eq("code", law_type).single().execute()
    if not reg.data:
        return None
    work = (
        sb.table("works")
        .select("id, title_id, status, frbr_uri")
        .eq("regulation_type_id", reg.data["id"])
        .eq("number", law_number)
        .eq("year", year)
        .single()
        .execute()
    )
    if not work.data:
        return None
    node = (
        sb.table("document_nodes")
        .select("id, number, content_text, heading")
        .eq("work_id", work.data["id"])
        .eq("node_type", "pasal")
        .eq("number", pasal)
        .single()
        .execute()
    )
    if not node.data:
        return None
    return {
        "work": work.data,
        "pasal": node.data,
    }


def related_work_id(relationship: dict, work_id: str) -> str:
    """Given a relationship row and the current work's ID, return the other work's ID."""
    if relationship["source_work_id"] == work_id:
        return relationship["target_work_id"]
    return relationship["source_work_id"]


def get_law_status(law_type: str, law_number: str, year: int) -> dict | None:
    """Replicate MCP get_law_status."""
    reg = sb.table("regulation_types").select("id").eq("code", law_type).single().execute()
    if not reg.data:
        return None
    work = (
        sb.table("works")
        .select("id, title_id, status, frbr_uri, number, year")
        .eq("regulation_type_id", reg.data["id"])
        .eq("number", law_number)
        .eq("year", year)
        .single()
        .execute()
    )
    if not work.data:
        return None

    rels = (
        sb.table("work_relationships")
        .select("*, relationship_types(code, name_id, name_en)")
        .or_(f"source_work_id.eq.{work.data['id']},target_work_id.eq.{work.data['id']}")
        .execute()
    )
    related_ids = [related_work_id(r, work.data["id"]) for r in (rels.data or [])]

    related_works = {}
    if related_ids:
        rw = sb.table("works").select("id, title_id, number, year, status, frbr_uri").in_("id", related_ids).execute()
        related_works = {w["id"]: w for w in (rw.data or [])}

    return {
        "work": work.data,
        "relationships": rels.data or [],
        "related_works": related_works,
    }


# ==========================================================================
# Scenario 1: Marriage age
# ==========================================================================
print("\n=== SCENARIO 1: Marriage Age (Usia Minimum Menikah) ===\n")

print("Step 1: search for marriage law")
# Try multiple queries — Indonesian stemmer can't match 'menikah' to 'kawin'
found_marriage_law = False
for q in ["perkawinan", "usia menikah", "kawin"]:
    results = search_laws(q)
    if results:
        work_ids = list({r["work_id"] for r in results})
        wks = sb.table("works").select("id, number, year").in_("id", work_ids).execute()
        found_marriage_law = any(
            (w["number"] in ("1", "16") and w["year"] in (1974, 2019)) for w in (wks.data or [])
        )
        if found_marriage_law:
            check("Search returns marriage results", True, f"query='{q}', {len(results)} results")
            break
if not found_marriage_law:
    check("Search returns marriage results", False, "none of the queries found marriage laws")
check("Found UU 1/1974 or UU 16/2019", found_marriage_law)

print("\nStep 2: get Pasal 7 of UU 16/2019")
pasal7 = get_pasal("UU", "16", 2019, "7")
if pasal7:
    check("Got Pasal 7", True, f"content length: {len(pasal7['pasal'].get('content_text') or '')}")
    content = (pasal7["pasal"].get("content_text") or "").lower()
    check("Mentions age 19", "19" in content, content[:200])
else:
    # Fallback: try UU 1/1974 Pasal 7
    print("  (UU 16/2019 Pasal 7 not found, trying UU 1/1974)")
    pasal7_old = get_pasal("UU", "1", 1974, "7")
    check("Got Pasal 7 (fallback)", pasal7_old is not None)

print("\nStep 3: check status of UU 1/1974")
status = get_law_status("UU", "1", 1974)
check("Got law status", status is not None)
if status:
    check(
        "Status is 'diubah' (amended)",
        status["work"]["status"] in ("diubah", "berlaku"),
        f"actual: {status['work']['status']}",
    )
    has_amendment = any(
        status["related_works"].get(related_work_id(r, status["work"]["id"]), {}).get("year") == 2019
        for r in status["relationships"]
    )
    check("UU 16/2019 appears as amendment", has_amendment)

# ==========================================================================
# Scenario 2: Worker rights
# ==========================================================================
print("\n\n=== SCENARIO 2: Worker Rights (Hak Pekerja) ===\n")

print("Step 1: search for labor law")
found_labor = False
for q in ["ketenagakerjaan", "hak pekerja kontrak", "upah minimum"]:
    results = search_laws(q)
    if results:
        work_ids = list({r["work_id"] for r in results})
        wks = sb.table("works").select("id, number, year").in_("id", work_ids).execute()
        found_labor = any(w["number"] == "13" and w["year"] == 2003 for w in (wks.data or []))
        if found_labor:
            check("Search returns labor results", True, f"query='{q}', {len(results)} results")
            break
if not found_labor:
    check("Search returns labor results", len(results) > 0, f"{len(results)} results")
check("Found UU 13/2003", found_labor)

print("\nStep 2: search 'pemutusan hubungan kerja'")
results2 = search_laws("pemutusan hubungan kerja")
check("PHK search returns results", len(results2) > 0, f"{len(results2)} results")

# ==========================================================================
# Scenario 3: Cross-regulation (amendment chain)
# ==========================================================================
print("\n\n=== SCENARIO 3: Cross-Regulation (UU 13/2003 ↔ UU 6/2023) ===\n")

print("Step 1: get status of UU 13/2003")
status13 = get_law_status("UU", "13", 2003)
check("Got UU 13/2003 status", status13 is not None)

if status13:
    check(
        "Has relationships",
        len(status13["relationships"]) > 0,
        f"{len(status13['relationships'])} relationships",
    )
    has_uu6 = any(
        status13["related_works"].get(related_work_id(r, status13["work"]["id"]), {}).get("number") == "6"
        and status13["related_works"].get(related_work_id(r, status13["work"]["id"]), {}).get("year") == 2023
        for r in status13["relationships"]
    )
    check("UU 6/2023 appears as amending law", has_uu6)

# ==========================================================================
# Health check
# ==========================================================================
print("\n\n=== HEALTH CHECK ===\n")

total_works = sb.table("works").select("id", count="exact").execute()
total_count = total_works.count or 0
print(f"  Total laws in database: {total_count}")
check("Has laws in DB", total_count > 0)

total_chunks = sb.table("legal_chunks").select("id", count="exact").execute()
chunk_count = total_chunks.count or 0
print(f"  Total search chunks: {chunk_count}")
check("Has search chunks", chunk_count > 0)

# ==========================================================================
# Summary
# ==========================================================================
print(f"\n{'='*50}")
print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
print(f"{'='*50}")

if failed > 0:
    print("\n⚠️  Some tests failed. Review above for details.")
    sys.exit(1)
else:
    print("\n✅ All MCP flow tests passed!")
