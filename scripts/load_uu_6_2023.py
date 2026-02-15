"""One-off local script to re-parse and reload UU 6/2023 (Cipta Kerja ratification).

Re-parses from full_text using the updated parser (with LAMPIRAN support), then
loads the new node tree into Supabase. Also creates bidirectional relationships
with UU 13/2003 (Labor Law).

Usage:
    python scripts/load_uu_6_2023.py              # Re-parse from full_text + reload
    python scripts/load_uu_6_2023.py --json-only   # Re-parse and save JSON only (no DB)
"""
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))

from loader.load_to_supabase import (
    init_supabase, load_work, cleanup_work_data, load_nodes_by_level
)
from parser.parse_structure import parse_structure, count_pasals

PARSED_JSON = Path(__file__).parent.parent / "data" / "parsed" / "akn_id_act_uu_2023_6.json"


def reparse_from_full_text(law: dict) -> list[dict]:
    """Re-parse nodes from full_text using the current parser."""
    full_text = law.get("full_text", "")
    if not full_text:
        print("  ERROR: No full_text in parsed JSON — cannot re-parse")
        return law.get("nodes", [])

    print(f"  Re-parsing from full_text ({len(full_text):,} chars)...")
    nodes = parse_structure(full_text)
    pasal_count = count_pasals(nodes)
    print(f"  New parse: {len(nodes)} top-level nodes, {pasal_count} pasals")
    return nodes


def insert_uu6_relationships(sb):
    """Insert bidirectional relationships between UU 6/2023 and UU 13/2003."""
    # Fetch relationship type IDs
    rel_result = sb.table("relationship_types").select("id, code").execute()
    rel_map = {r["code"]: r["id"] for r in rel_result.data}

    if "mengubah" not in rel_map or "diubah_oleh" not in rel_map:
        print("  Warning: relationship types 'mengubah' or 'diubah_oleh' not found")
        return 0

    # Fetch work IDs by frbr_uri
    try:
        uu6 = sb.table("works").select("id").eq("frbr_uri", "/akn/id/act/uu/2023/6").single().execute()
        uu13 = sb.table("works").select("id").eq("frbr_uri", "/akn/id/act/uu/2003/13").single().execute()
    except Exception as e:
        print(f"  Warning: failed to fetch work IDs: {e}")
        return 0

    if not uu6.data or not uu13.data:
        print("  Warning: UU 6/2023 or UU 13/2003 not found in database")
        return 0

    # Upsert bidirectional relationship
    relationships = [
        (uu6.data["id"], uu13.data["id"], rel_map["mengubah"], "UU 6/2023 mengubah UU 13/2003"),
        (uu13.data["id"], uu6.data["id"], rel_map["diubah_oleh"], "UU 13/2003 diubah oleh UU 6/2023"),
    ]

    count = 0
    for src_id, tgt_id, rel_type_id, desc in relationships:
        try:
            sb.table("work_relationships").upsert(
                {
                    "source_work_id": src_id,
                    "target_work_id": tgt_id,
                    "relationship_type_id": rel_type_id,
                    "notes": desc,
                },
                on_conflict="source_work_id,target_work_id,relationship_type_id",
            ).execute()
            count += 1
            print(f"  ✓ {desc}")
        except Exception as e:
            print(f"  Error inserting relationship: {e}")

    return count


def main():
    json_only = "--json-only" in sys.argv

    print("=== Re-parsing and loading UU 6/2023 ===\n")

    if not PARSED_JSON.exists():
        print(f"ERROR: Parsed JSON not found at {PARSED_JSON}")
        return 1

    print(f"Reading: {PARSED_JSON}")
    with open(PARSED_JSON) as f:
        law = json.load(f)

    print(f"  FRBR URI: {law.get('frbr_uri')}")
    print(f"  Title: {law.get('title_id')}")

    old_pasal_count = count_pasals(law.get("nodes", []))
    print(f"  Old nodes: {len(law.get('nodes', []))} top-level, {old_pasal_count} pasals")

    # Re-parse from full_text
    nodes = reparse_from_full_text(law)
    new_pasal_count = count_pasals(nodes)

    # Update the law dict with new nodes
    law["nodes"] = nodes

    # Save updated JSON
    print(f"\n--- Saving updated JSON ---")
    with open(PARSED_JSON, "w") as f:
        json.dump(law, f, ensure_ascii=False, indent=2)
    print(f"  Saved to {PARSED_JSON}")

    if json_only:
        print(f"\n=== JSON-only mode: {new_pasal_count} pasals parsed (was {old_pasal_count}) ===")
        return 0

    # Initialize Supabase client
    sb = init_supabase()

    # 1. Upsert work metadata (idempotent on frbr_uri)
    print("\n--- Upserting work metadata ---")
    work_id = load_work(sb, law)
    if not work_id:
        print("ERROR: Failed to upsert work")
        return 1
    print(f"  Work ID: {work_id}")

    # 2. Clean existing data (delete suggestions → revisions → document_nodes)
    print("\n--- Cleaning existing data ---")
    cleanup_work_data(sb, work_id)
    print("  Cleaned suggestions, revisions, document_nodes")

    # 3. Insert all nodes in breadth-first batches
    print("\n--- Inserting document nodes ---")
    pasal_nodes = load_nodes_by_level(sb, work_id, nodes)
    print(f"  Inserted {len(pasal_nodes)} content nodes")

    # 4. Insert bidirectional relationships with UU 13/2003
    print("\n--- Inserting relationships ---")
    rel_count = insert_uu6_relationships(sb)
    print(f"  Inserted {rel_count} relationships")

    # 5. Verify data integrity
    print("\n--- Verifying data ---")
    node_count = sb.table("document_nodes").select("id", count="exact").eq("work_id", work_id).execute()
    pasal_count = sb.table("document_nodes").select("id", count="exact").eq("work_id", work_id).eq("node_type", "pasal").execute()

    print(f"  Total nodes: {node_count.count}")
    print(f"  Pasal nodes: {pasal_count.count} (was {old_pasal_count})")

    print(f"\n=== Done: UU 6/2023 loaded with {pasal_count.count} pasals ===")
    print(f"View at: https://pasal.id/peraturan/uu/uu-6-2023")
    return 0


if __name__ == "__main__":
    sys.exit(main())
