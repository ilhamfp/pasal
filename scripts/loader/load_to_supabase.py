"""Load parsed legal documents into Supabase.

Reads JSON files from data/parsed/ and inserts into:
- works (law metadata)
- document_nodes (hierarchical structure)
- legal_chunks (search-optimized text chunks)
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "parsed"

# Regulation type code -> id mapping (from seed data)
REG_TYPE_MAP = {
    "UUD": 1, "TAP_MPR": 2, "UU": 3, "PERPPU": 4, "PP": 5,
    "PERPRES": 6, "PERDA_PROV": 7, "PERDA_KAB": 8, "PERMEN": 9,
    "PERMA": 10, "PBI": 11,
}


def init_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    return create_client(url, key)


def load_work(sb, law: dict) -> int | None:
    """Insert a work (law) into the works table. Returns the work ID."""
    reg_type_id = REG_TYPE_MAP.get(law["type"])
    if not reg_type_id:
        print(f"  Unknown regulation type: {law['type']}")
        return None

    work_data = {
        "frbr_uri": law["frbr_uri"],
        "regulation_type_id": reg_type_id,
        "number": law["number"],
        "year": law["year"],
        "title_id": law["title_id"],
        "status": law.get("status", "berlaku"),
        "source_url": law.get("source_url"),
        "source_pdf_url": law.get("source_pdf_url"),
    }

    try:
        result = sb.table("works").upsert(
            work_data, on_conflict="frbr_uri"
        ).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        print(f"  ERROR inserting work: {e}")
    return None


def load_nodes_recursive(
    sb,
    work_id: int,
    nodes: list[dict],
    parent_id: int | None = None,
    path_prefix: str = "",
    depth: int = 0,
    sort_offset: int = 0,
) -> list[dict]:
    """Recursively insert document nodes. Returns list of inserted pasal nodes for chunking."""
    pasal_nodes = []

    for i, node in enumerate(nodes):
        sort_order = sort_offset + i
        node_type = node["type"]
        number = node.get("number", "")
        heading = node.get("heading", "")
        content = node.get("content", "")

        # Build ltree path
        path_segment = f"{node_type}_{number}".replace(".", "_").replace(" ", "_")
        path = f"{path_prefix}.{path_segment}" if path_prefix else path_segment

        node_data = {
            "work_id": work_id,
            "node_type": node_type,
            "number": number,
            "heading": heading,
            "content_text": content,
            "parent_id": parent_id,
            "path": path,
            "depth": depth,
            "sort_order": sort_order,
        }

        try:
            result = sb.table("document_nodes").insert(node_data).execute()
            if result.data:
                inserted_id = result.data[0]["id"]

                if node_type == "pasal":
                    pasal_nodes.append({
                        "node_id": inserted_id,
                        "number": number,
                        "content": content,
                        "heading": heading,
                        "parent_heading": path_prefix,
                    })

                # Recurse into children
                children = node.get("children", [])
                if children:
                    child_pasals = load_nodes_recursive(
                        sb, work_id, children,
                        parent_id=inserted_id,
                        path_prefix=path,
                        depth=depth + 1,
                        sort_offset=sort_order * 100,
                    )
                    pasal_nodes.extend(child_pasals)
        except Exception as e:
            print(f"  ERROR inserting node {node_type} {number}: {e}")

    return pasal_nodes


def create_chunks(
    sb,
    work_id: int,
    law: dict,
    pasal_nodes: list[dict],
):
    """Create search chunks from pasal nodes."""
    chunks = []
    law_title = law["title_id"]
    law_type = law["type"]
    law_number = law["number"]
    law_year = law["year"]

    for pasal in pasal_nodes:
        content = pasal["content"]
        if not content or len(content.strip()) < 10:
            continue

        # Prepend context for better keyword search
        chunk_text = f"{law_title}\nPasal {pasal['number']}\n\n{content}"

        metadata = {
            "type": law_type,
            "number": law_number,
            "year": law_year,
            "pasal": pasal["number"],
        }

        chunks.append({
            "work_id": work_id,
            "node_id": pasal["node_id"],
            "content": chunk_text,
            "metadata": metadata,
        })

    # Also create a chunk from the full text if we have no pasal-level chunks
    # (for laws where parsing didn't extract any pasals)
    if not chunks and law.get("full_text"):
        text = law["full_text"]
        # Split into ~500 char chunks
        words = text.split()
        chunk_size = 300  # words
        for i in range(0, len(words), chunk_size):
            chunk_words = words[i:i + chunk_size]
            chunk_text = f"{law_title}\n\n{' '.join(chunk_words)}"
            chunks.append({
                "work_id": work_id,
                "content": chunk_text,
                "metadata": {
                    "type": law_type,
                    "number": law_number,
                    "year": law_year,
                    "chunk_index": i // chunk_size,
                },
            })

    # Batch insert chunks
    if chunks:
        # Insert in batches of 50
        for i in range(0, len(chunks), 50):
            batch = chunks[i:i+50]
            try:
                sb.table("legal_chunks").insert(batch).execute()
            except Exception as e:
                print(f"  ERROR inserting chunks batch: {e}")
                # Try one by one
                for chunk in batch:
                    try:
                        sb.table("legal_chunks").insert(chunk).execute()
                    except Exception as e2:
                        print(f"  ERROR inserting single chunk: {e2}")

    return len(chunks)


def main():
    sb = init_supabase()

    # Clear existing data (for re-runs)
    print("Clearing existing data...")
    try:
        sb.table("legal_chunks").delete().neq("id", 0).execute()
        sb.table("document_nodes").delete().neq("id", 0).execute()
        sb.table("work_relationships").delete().neq("id", 0).execute()
        sb.table("works").delete().neq("id", 0).execute()
    except Exception as e:
        print(f"  Warning clearing data: {e}")

    json_files = sorted(DATA_DIR.glob("*.json"))
    print(f"\nFound {len(json_files)} parsed law files")

    total_works = 0
    total_pasals = 0
    total_chunks = 0

    for jf in json_files:
        print(f"\nLoading {jf.name}...")
        with open(jf) as f:
            law = json.load(f)

        # 1. Insert work
        work_id = load_work(sb, law)
        if not work_id:
            print("  SKIP: Failed to insert work")
            continue
        total_works += 1
        print(f"  Work ID: {work_id}")

        # 2. Insert document nodes
        nodes = law.get("nodes", [])
        pasal_nodes = load_nodes_recursive(sb, work_id, nodes)
        total_pasals += len(pasal_nodes)
        print(f"  Inserted {len(pasal_nodes)} pasal nodes")

        # 3. Create and insert search chunks
        chunk_count = create_chunks(sb, work_id, law, pasal_nodes)
        total_chunks += chunk_count
        print(f"  Created {chunk_count} search chunks")

    # 4. Insert work relationships for demo laws
    print("\nInserting work relationships...")
    insert_relationships(sb)

    print(f"\n=== DONE ===")
    print(f"Works: {total_works}")
    print(f"Pasal nodes: {total_pasals}")
    print(f"Search chunks: {total_chunks}")


def insert_relationships(sb):
    """Insert known relationships between laws."""
    # Get work IDs by frbr_uri
    works = sb.table("works").select("id, frbr_uri").execute().data
    uri_to_id = {w["frbr_uri"]: w["id"] for w in works}

    # Get relationship type IDs
    rel_types = sb.table("relationship_types").select("id, code").execute().data
    code_to_id = {r["code"]: r["id"] for r in rel_types}

    relationships = [
        # UU 6/2023 amends UU 13/2003 (Cipta Kerja amends Labor Law)
        ("/akn/id/act/uu/2023/6", "/akn/id/act/uu/2003/13", "mengubah"),
        ("/akn/id/act/uu/2003/13", "/akn/id/act/uu/2023/6", "diubah_oleh"),
        # UU 16/2019 amends UU 1/1974 (Marriage age amendment)
        ("/akn/id/act/uu/2019/16", "/akn/id/act/uu/1974/1", "mengubah"),
        ("/akn/id/act/uu/1974/1", "/akn/id/act/uu/2019/16", "diubah_oleh"),
        # UU 20/2001 amends UU 31/1999 (Anti-corruption amendment)
        ("/akn/id/act/uu/2001/20", "/akn/id/act/uu/1999/31", "mengubah"),
        ("/akn/id/act/uu/1999/31", "/akn/id/act/uu/2001/20", "diubah_oleh"),
        # UU 13/2022 amends UU 12/2011 (Legislative drafting amendment)
        ("/akn/id/act/uu/2022/13", "/akn/id/act/uu/2011/12", "mengubah"),
        ("/akn/id/act/uu/2011/12", "/akn/id/act/uu/2022/13", "diubah_oleh"),
        # UU 19/2016 amends UU 11/2008 (ITE amendment - original not in our dataset)
        # UU 27/2024 amends UU 19/2016 (Second ITE amendment)
        ("/akn/id/act/uu/2024/27", "/akn/id/act/uu/2016/19", "mengubah"),
        ("/akn/id/act/uu/2016/19", "/akn/id/act/uu/2024/27", "diubah_oleh"),
    ]

    inserted = 0
    for source_uri, target_uri, rel_code in relationships:
        source_id = uri_to_id.get(source_uri)
        target_id = uri_to_id.get(target_uri)
        rel_type_id = code_to_id.get(rel_code)

        if not source_id or not target_id or not rel_type_id:
            continue

        try:
            sb.table("work_relationships").insert({
                "source_work_id": source_id,
                "target_work_id": target_id,
                "relationship_type_id": rel_type_id,
            }).execute()
            inserted += 1
        except Exception as e:
            if "duplicate" not in str(e).lower():
                print(f"  ERROR: {e}")

    print(f"  Inserted {inserted} relationships")


if __name__ == "__main__":
    main()
