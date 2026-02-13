"""Seed work_relationships for demo laws."""
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

works_data = sb.table("works").select("id, frbr_uri").execute()
works = {w["frbr_uri"]: w["id"] for w in works_data.data}
rel_data = sb.table("relationship_types").select("id, code").execute()
rels = {r["code"]: r["id"] for r in rel_data.data}

RELATIONSHIPS = [
    ("/akn/id/act/uu/2023/6", "mengubah", "/akn/id/act/uu/2003/13"),
    ("/akn/id/act/uu/2003/13", "diubah_oleh", "/akn/id/act/uu/2023/6"),
    ("/akn/id/act/uu/2019/16", "mengubah", "/akn/id/act/uu/1974/1"),
    ("/akn/id/act/uu/1974/1", "diubah_oleh", "/akn/id/act/uu/2019/16"),
]

inserted = 0
for src_uri, rel_code, tgt_uri in RELATIONSHIPS:
    src_id, tgt_id, rel_id = works.get(src_uri), works.get(tgt_uri), rels.get(rel_code)
    if not all((src_id, tgt_id, rel_id)):
        print(f"SKIP: {src_uri} -> {rel_code} -> {tgt_uri} (missing)")
        continue
    try:
        sb.table("work_relationships").upsert(
            {"source_work_id": src_id, "target_work_id": tgt_id, "relationship_type_id": rel_id},
            on_conflict="source_work_id,target_work_id,relationship_type_id",
        ).execute()
        print(f"OK: {src_uri} -> {rel_code} -> {tgt_uri}")
        inserted += 1
    except Exception as e:
        print(f"ERROR: {e}")
print(f"\nProcessed: {inserted}")
