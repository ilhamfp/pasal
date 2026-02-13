"""Verify data integrity for the 5 demo laws."""
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

DEMO_LAWS = [
    {"type": "UU", "number": "13", "year": 2003, "topic": "Ketenagakerjaan", "min_pasals": 100},
    {"type": "UU", "number": "6", "year": 2023, "topic": "Cipta Kerja", "min_pasals": 50},
    {"type": "UU", "number": "1", "year": 1974, "topic": "Perkawinan", "min_pasals": 40},
    {"type": "UU", "number": "16", "year": 2019, "topic": "Perubahan Perkawinan", "min_pasals": 2},
    {"type": "UU", "number": "1", "year": 2023, "topic": "KUHP", "min_pasals": 100},
]

issues = []
for law in DEMO_LAWS:
    print(f"\n--- {law['type']} {law['number']}/{law['year']} ({law['topic']}) ---")
    reg_types = sb.table("regulation_types").select("id").eq("code", law["type"]).execute()
    if not reg_types.data:
        issues.append(f"CRITICAL: Regulation type {law['type']} not found")
        continue
    reg_type_id = reg_types.data[0]["id"]
    works = (
        sb.table("works")
        .select("*")
        .match({"regulation_type_id": reg_type_id, "number": law["number"], "year": law["year"]})
        .execute()
    )
    if not works.data:
        issues.append(f"CRITICAL: {law['type']} {law['number']}/{law['year']} not in works table")
        print("  NOT FOUND")
        continue
    work = works.data[0]
    work_id = work["id"]
    print(f"  Found: work_id={work_id}, status={work['status']}")
    pasals = (
        sb.table("document_nodes")
        .select("id", count="exact")
        .match({"work_id": work_id, "node_type": "pasal"})
        .execute()
    )
    pasal_count = pasals.count or 0
    print(f"  Pasals: {pasal_count} (min: {law['min_pasals']})")
    if pasal_count < law["min_pasals"]:
        issues.append(
            f"LOW DATA: {law['type']} {law['number']}/{law['year']} has {pasal_count} pasals, need {law['min_pasals']}+"
        )
    chunks = sb.table("legal_chunks").select("id", count="exact").eq("work_id", work_id).execute()
    chunk_count = chunks.count or 0
    print(f"  Chunks: {chunk_count}")
    if chunk_count == 0:
        issues.append(f"CRITICAL: {law['type']} {law['number']}/{law['year']} has 0 search chunks")

print("\n\n=== SEARCH TESTS ===")
tests = [
    ("perkawinan", "Perkawinan"),
    ("upah minimum pekerja", "Ketenagakerjaan"),
    ("pemutusan hubungan kerja", "Ketenagakerjaan"),
    ("data pribadi", "PDP/ITE"),
    ("korupsi", "Anti-Korupsi"),
]
search_pass = 0
for query, expected in tests:
    result = sb.rpc("search_legal_chunks", {"query_text": query, "match_count": 3, "metadata_filter": {}}).execute()
    count = len(result.data) if result.data else 0
    passed = count > 0
    status = "PASS" if passed else "FAIL"
    print(f"  {status} '{query}': {count} results ({expected})")
    if passed:
        search_pass += 1
    else:
        issues.append(f"SEARCH FAIL: '{query}' returned 0 results")

print(f"\n=== SUMMARY ===")
print(f"Search: {search_pass}/5 passed")
if issues:
    print(f"{len(issues)} issues:")
    for i in issues:
        print(f"  - {i}")
    # Exit 0 if no CRITICAL issues (LOW DATA is acceptable per TASKS.md)
    critical = [i for i in issues if i.startswith("CRITICAL")]
    sys.exit(1 if critical else 0)
else:
    print("All demo data OK!")
