"""Load parsed legal documents into Supabase.

Reads JSON files from data/parsed/ and inserts into:
- works (law metadata)
- document_nodes (hierarchical structure)
- legal_chunks (search-optimized text chunks)

Usage:
    python load_to_supabase.py [options]
    --force-reload  Delete ALL existing data before loading (old behavior)
    --dry-run       Count what would be inserted without writing
"""
import argparse
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except Exception:
    pass

from supabase import create_client

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "parsed"
PROGRESS_FILE = DATA_DIR / ".load_progress.json"

# Regulation type code -> id mapping (from seed data) — fallback only
REG_TYPE_MAP = {
    "UUD": 1, "TAP_MPR": 2, "UU": 3, "PERPPU": 4, "PP": 5,
    "PERPRES": 6, "PERDA_PROV": 7, "PERDA_KAB": 8, "PERMEN": 9,
    "PERMA": 10, "PBI": 11,
}

# Runtime cache — populated from DB when available
_runtime_reg_type_map: dict[str, int] | None = None


def _load_reg_type_map(sb) -> dict[str, int]:
    """Load regulation type mapping from database at runtime, cache it."""
    global _runtime_reg_type_map
    if _runtime_reg_type_map is not None:
        return _runtime_reg_type_map
    try:
        result = sb.table("regulation_types").select("id, code").execute()
        _runtime_reg_type_map = {r["code"]: r["id"] for r in result.data}
        return _runtime_reg_type_map
    except Exception:
        # Fall back to hardcoded map
        _runtime_reg_type_map = REG_TYPE_MAP
        return _runtime_reg_type_map


def init_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    return create_client(url, key)


def load_work(sb, law: dict) -> int | None:
    """Insert a work (law) into the works table. Returns the work ID."""
    reg_map = _load_reg_type_map(sb)
    reg_type_id = reg_map.get(law["type"])
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
    _counter: list[int] | None = None,
) -> list[dict]:
    """Recursively insert document nodes. Returns list of inserted pasal nodes for chunking."""
    pasal_nodes = []

    # Use a shared DFS counter to avoid exponential sort_order growth.
    # The old scheme (sort_offset * 100 per level) overflows bigint at 5+ levels.
    if _counter is None:
        _counter = [sort_offset]

    for i, node in enumerate(nodes):
        _counter[0] += 1
        sort_order = _counter[0]
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

                if node_type in ("pasal", "preamble", "content", "penjelasan_umum", "penjelasan_pasal"):
                    pasal_nodes.append({
                        "node_id": inserted_id,
                        "number": number,
                        "content": content,
                        "heading": heading,
                        "parent_heading": path_prefix,
                        "node_type": node_type,
                    })

                # Recurse into children
                children = node.get("children", [])
                if children:
                    child_pasals = load_nodes_recursive(
                        sb, work_id, children,
                        parent_id=inserted_id,
                        path_prefix=path,
                        depth=depth + 1,
                        _counter=_counter,
                    )
                    pasal_nodes.extend(child_pasals)
        except Exception as e:
            print(f"  ERROR inserting node {node_type} {number}: {e}")

    return pasal_nodes


def cleanup_work_data(sb, work_id: int) -> None:
    """Delete existing document_nodes and legal_chunks for a specific work.

    Order matters: suggestions/revisions reference nodes via FK.
    """
    tables = ["suggestions", "revisions", "legal_chunks", "document_nodes"]
    for table in tables:
        try:
            sb.table(table).delete().eq("work_id", work_id).execute()
        except Exception as e:
            print(f"  Warning: Failed to clean {table} for work {work_id}: {e}")


def create_chunks(
    sb,
    work_id: int,
    law: dict,
    pasal_nodes: list[dict],
):
    """Create search chunks from pasal nodes and penjelasan nodes."""
    chunks = []
    law_title = law["title_id"]
    law_type = law["type"]
    law_number = law["number"]
    law_year = law["year"]

    for pasal in pasal_nodes:
        content = pasal["content"]
        if not content or len(content.strip()) < 10:
            continue

        node_type = pasal.get("node_type", "pasal")

        # Handle penjelasan nodes
        if node_type in ("penjelasan_umum", "penjelasan_pasal"):
            # Skip "Cukup jelas" penjelasan
            if content.strip().lower().startswith("cukup jelas"):
                continue
            if pasal.get("number"):
                chunk_text = f"{law_title}\nPenjelasan Pasal {pasal['number']}\n\n{content}"
            else:
                chunk_text = f"{law_title}\nPenjelasan Umum\n\n{content}"
            metadata = {
                "type": law_type,
                "number": law_number,
                "year": law_year,
                "penjelasan": pasal.get("number", "umum"),
            }
        elif node_type in ("preamble", "content"):
            chunk_text = f"{law_title}\n\n{content}"
            metadata = {
                "type": law_type,
                "number": law_number,
                "year": law_year,
                "section": node_type,
            }
        else:
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
        for i in range(0, len(chunks), 50):
            batch = chunks[i:i+50]
            try:
                sb.table("legal_chunks").insert(batch).execute()
            except Exception as e:
                print(f"  ERROR inserting batch {i}-{i+len(batch)}: {e}")
                for j, chunk in enumerate(batch):
                    try:
                        sb.table("legal_chunks").insert(chunk).execute()
                    except Exception as e2:
                        print(f"  ERROR inserting chunk {i+j}: {e2}")

    return len(chunks)


def _load_progress() -> set[str]:
    """Load set of already-loaded FRBR URIs from progress file."""
    if PROGRESS_FILE.exists():
        try:
            return set(json.loads(PROGRESS_FILE.read_text()))
        except Exception:
            pass
    return set()


def _save_progress(loaded: set[str]) -> None:
    """Save progress file."""
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_FILE.write_text(json.dumps(sorted(loaded), indent=2))


def main():
    parser = argparse.ArgumentParser(description="Load parsed legal docs to Supabase")
    parser.add_argument("--force-reload", action="store_true",
                        help="Delete ALL existing data before loading")
    parser.add_argument("--dry-run", action="store_true",
                        help="Count what would be inserted without writing")
    args = parser.parse_args()

    sb = init_supabase()

    if args.force_reload:
        print("Force reload: clearing ALL existing data...")
        try:
            sb.table("legal_chunks").delete().neq("id", 0).execute()
            sb.table("document_nodes").delete().neq("id", 0).execute()
            sb.table("work_relationships").delete().neq("id", 0).execute()
            sb.table("works").delete().neq("id", 0).execute()
        except Exception as e:
            print(f"  Warning clearing data: {e}")
        loaded_uris: set[str] = set()
    else:
        loaded_uris = _load_progress()
        if loaded_uris:
            print(f"Resuming: {len(loaded_uris)} works already loaded")

    json_files = sorted(DATA_DIR.glob("*.json"))
    print(f"\nFound {len(json_files)} parsed law files")

    total_works = 0
    total_pasals = 0
    total_chunks = 0
    skipped = 0
    failed = []

    for jf in json_files:
        try:
            with open(jf) as f:
                law = json.load(f)

            frbr_uri = law.get("frbr_uri", "")

            # Skip already loaded (unless force-reload)
            if frbr_uri in loaded_uris and not args.force_reload:
                skipped += 1
                continue

            print(f"\nLoading {jf.name}...")

            if args.dry_run:
                nodes = law.get("nodes", [])
                from scripts.parser.parse_structure import count_pasals
                pc = count_pasals(nodes) if nodes else 0
                print(f"  [DRY RUN] Would insert: 1 work, ~{pc} pasal nodes")
                total_works += 1
                continue

            # 1. Upsert work
            work_id = load_work(sb, law)
            if not work_id:
                print("  SKIP: Failed to insert work")
                failed.append(jf.name)
                continue

            # 2. Per-work cleanup (idempotent reload)
            cleanup_work_data(sb, work_id)

            total_works += 1
            print(f"  Work ID: {work_id}")

            # 3. Insert document nodes
            nodes = law.get("nodes", [])
            pasal_nodes = load_nodes_recursive(sb, work_id, nodes)
            total_pasals += len(pasal_nodes)
            print(f"  Inserted {len(pasal_nodes)} pasal nodes")

            # 4. Create and insert search chunks
            chunk_count = create_chunks(sb, work_id, law, pasal_nodes)
            total_chunks += chunk_count
            print(f"  Created {chunk_count} search chunks")

            # Track progress
            loaded_uris.add(frbr_uri)
            _save_progress(loaded_uris)

        except Exception as e:
            print(f"\n  ERROR loading {jf.name}: {e}")
            failed.append(jf.name)
            continue

    # 5. Insert work relationships for demo laws
    if not args.dry_run:
        print("\nInserting work relationships...")
        insert_relationships(sb)

    print(f"\n=== SUMMARY ===")
    print(f"Loaded: {total_works}")
    print(f"Skipped (already loaded): {skipped}")
    print(f"Failed: {len(failed)}")
    if failed:
        for fn in failed:
            print(f"  - {fn}")
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
