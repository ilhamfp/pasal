# TASKS.md — Pasal.id Sprint Plan

> **Project:** Pasal.id — The first open, AI-native Indonesian legal platform.
> **Repo:** github.com/ilhamfp/pasal
> **Deadline:** Monday Feb 16, 3:00 PM EST (Claude Code Hackathon)
>
> **What already exists:** Monorepo structure, Supabase DB with migrations 001-007, scraper + parser + loader pipeline, MCP server with 4 tools deployed on Railway, Next.js frontend with landing page + search page + law reader page deployed on Vercel, ~20 laws loaded with 1600+ articles.
>
> **These tasks improve what already exists. Do NOT re-create things that are already working.**

---

## How to Work

1. Find the first unchecked task below.
2. Read the full task description including "WHAT EXISTS NOW" and "WHAT TO CHANGE".
3. Implement the task completely.
4. Verify the "DONE WHEN" condition passes.
5. Run the required plugins (checkboxes at the bottom of each task).
6. Check off ALL boxes, then `git add -A && git commit -m "task X: description" && git push origin main`.
7. Move to the next task.

**Rules:**
- Do NOT skip tasks or jump ahead. Tasks are ordered by dependency.
- Do NOT get stuck longer than 20 minutes. Use workarounds and move forward.
- If a task references `BRAND_GUIDELINES.md`, read ONLY that file — it's in the project root.
- If a task references `ARCHITECTURE.md`, read ONLY the section the task points to.
- Commit + push after every completed task and also mid-task for meaningful increments.

---

## Task Index

| # | Task | Phase | Type |
|---|------|-------|------|
| 1 | [Schema: Add language + human_verified fields](#task-1) | Data Foundation | Backend |
| 2 | [Update CLAUDE.md to reference BRAND_GUIDELINES.md](#task-2) | Brand | Config |
| 3 | [Verify and fix data integrity for top 5 demo laws](#task-3) | Data Foundation | Backend |
| 4 | [Populate work_relationships for demo laws](#task-4) | Data Foundation | Backend |
| 5 | [Improve MCP server tool descriptions](#task-5) | MCP Server | Backend |
| 6 | [Add search snippets with highlighted terms](#task-6) | Search Quality | Full-stack |
| 7 | [Add trigram search fallback for fuzzy matching](#task-7) | Search Quality | Backend |
| 8 | [Add cross-reference extraction to get_pasal](#task-8) | MCP Server | Backend |
| 9 | [MCP response size optimization](#task-9) | MCP Server | Backend |
| 10 | [Build the crawling pipeline foundation](#task-10) | Crawling | Backend |
| 11 | [Create the source registry with all Indonesian legal sources](#task-11) | Crawling | Backend |
| 12 | [Build deduplication and visit-tracking system](#task-12) | Crawling | Backend |
| 13 | [Build the /connect page with MCP setup guide](#task-13) | Frontend | Frontend |
| 14 | [Expand landing page with stats, features, and audience sections](#task-14) | Frontend | Frontend |
| 15 | [Build "Kenali Hakmu" (Know Your Rights) topic guides](#task-15) | Frontend | Frontend |
| 16 | [Add bookmarks and reading history (localStorage)](#task-16) | Frontend | Frontend |
| 17 | [Add law amendment timeline visualization](#task-17) | Frontend | Frontend |
| 18 | [Build REST API endpoints for developers](#task-18) | API | Backend |
| 19 | [End-to-end MCP flow test script](#task-19) | Testing | Backend |
| 20 | [Final demo data verification and polish](#task-20) | Demo | Full-stack |

---

<a id="task-1"></a>
## Task 1 — Schema: Add `language` and `human_verified` fields

**WHY:** The platform currently only stores Indonesian text. To support future English translations (via models like Gemini Pro 3) and to let users know whether content has been human-verified, we need `language` and `human_verified` fields in the schema now. Adding them early is cheap; retrofitting later is painful.

**WHAT EXISTS NOW:**
- `legal_chunks` has `content` (Indonesian) and `content_en` (nullable, unused).
- `document_nodes` has `content_text` but no language indicator.
- `works` has `title_id` and `title_en` but no per-record language tracking.
- No verification status anywhere.

**WHAT TO CHANGE:**

1. Create `packages/supabase/migrations/008_language_and_verification.sql`:

```sql
-- Migration 008: Add language and human verification tracking

-- Add language field to document_nodes
-- 'id' = Bahasa Indonesia (original), 'en' = English (translated)
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'id';
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS verified_by TEXT; -- verifier name/id
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add language field to legal_chunks
ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'id';
ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS human_verified BOOLEAN NOT NULL DEFAULT false;

-- Add verification tracking to works (the regulation itself)
ALTER TABLE works ADD COLUMN IF NOT EXISTS content_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE works ADD COLUMN IF NOT EXISTS content_verified_at TIMESTAMPTZ;
ALTER TABLE works ADD COLUMN IF NOT EXISTS content_verified_by TEXT;

-- Index for filtering by language and verification status
CREATE INDEX IF NOT EXISTS idx_nodes_language ON document_nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_verified ON document_nodes(human_verified);
CREATE INDEX IF NOT EXISTS idx_chunks_language ON legal_chunks(language);
CREATE INDEX IF NOT EXISTS idx_chunks_verified ON legal_chunks(human_verified);
CREATE INDEX IF NOT EXISTS idx_works_verified ON works(content_verified);

-- Add a translation_source field to track how translations were produced
-- Values: 'original' (source language), 'gemini' (Gemini Pro 3), 'human', 'deepl', etc.
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS translation_source VARCHAR(50) DEFAULT 'original';
ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS translation_source VARCHAR(50) DEFAULT 'original';

COMMENT ON COLUMN document_nodes.language IS 'ISO 639-1 language code: id=Indonesian, en=English';
COMMENT ON COLUMN document_nodes.human_verified IS 'Whether this content has been reviewed by a human for accuracy';
COMMENT ON COLUMN document_nodes.translation_source IS 'How this content was produced: original, gemini, human, deepl, etc.';
COMMENT ON COLUMN legal_chunks.language IS 'ISO 639-1 language code: id=Indonesian, en=English';
COMMENT ON COLUMN works.content_verified IS 'Whether any human has verified the parsed content matches the source PDF';
```

2. Run this migration against Supabase (SQL Editor or CLI).

3. Update the MCP server `search_laws` to accept an optional `language` filter. In `apps/mcp-server/server.py`, add `language: str = "id"` parameter to `search_laws`, and pass it as metadata filter:

```python
@mcp.tool
async def search_laws(
    query: str,
    regulation_type: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    language: str = "id",
    limit: int = 10,
) -> list[dict]:
```

In the metadata filter construction, add: `if language != "id": metadata_filter["language"] = language` (existing data defaults to "id" via column default, no JSONB update needed).

4. Update the frontend law reader page to show a verification badge. In `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`, fetch `content_verified` from the work query and display a small badge:

```tsx
{work.content_verified ? (
  <Badge className="bg-green-100 text-green-800 border-green-200" variant="outline">
    ✓ Terverifikasi
  </Badge>
) : (
  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" variant="outline">
    ⚠ Belum Diverifikasi
  </Badge>
)}
```

**DONE WHEN:**
- [x] Migration 009 runs without error on Supabase.
- [x] `SELECT column_name FROM information_schema.columns WHERE table_name = 'document_nodes' AND column_name = 'language';` returns a row.
- [x] `SELECT column_name FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'content_verified';` returns a row.
- [x] Existing data still works — `SELECT COUNT(*) FROM legal_chunks WHERE language = 'id';` returns all existing rows (1654).
- [x] The law reader page shows a verification badge (amber "Belum Diverifikasi" since no data is verified yet).
- [x] `npm run build` succeeds.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑
- [x] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☑

---

<a id="task-2"></a>
## Task 2 — Update CLAUDE.md to reference BRAND_GUIDELINES.md

**WHY:** The agent needs to know that a brand guidelines file exists so all frontend work follows a consistent aesthetic. Without this, every frontend task risks producing generic/inconsistent UI.

**WHAT EXISTS NOW:** `CLAUDE.md` in project root has coding conventions, tech stack, and pitfall warnings. No mention of brand guidelines or visual design standards.

**WHAT TO CHANGE:**

1. Add a new section to `CLAUDE.md` after the "Coding Conventions" section:

```markdown
## Brand & Visual Design

**All frontend work MUST follow the brand guidelines defined in `BRAND_GUIDELINES.md` in the project root.**

Before creating or modifying any frontend component, page, or visual element:
1. Read `BRAND_GUIDELINES.md` for the color system, typography, spacing, and component patterns.
2. Use the defined color variables (CSS custom properties) — never hardcode hex colors.
3. Follow the "modern public library, not dim government office" design philosophy.
4. The primary color is Rosewood (#A8524C / "Tanah Api"). Accent is Steel Blue (#3F5E81).
5. Typography: Plus Jakarta Sans for headings, Inter/system for body.
6. All user-facing text should be in **Bahasa Indonesia** as primary, English as secondary.
7. Show verification badges on all legal content (see Task 1 schema).

When in doubt, reference `BRAND_GUIDELINES.md` — it is the single source of truth for visual decisions.
```

2. Also add to the "Common Pitfalls to Avoid" section:

```markdown
9. **Don't ignore BRAND_GUIDELINES.md.** Every frontend component must use the defined color system and typography. No arbitrary colors, no generic shadcn defaults without brand customization.
```

**DONE WHEN:**
- [x] `CLAUDE.md` contains a "Brand & Visual Design" section referencing `BRAND_GUIDELINES.md`.
- [x] The pitfalls section mentions brand guidelines.
- [x] `git diff` shows only additions to `CLAUDE.md`, no deletions of existing content.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-3"></a>
## Task 3 — Verify and fix data integrity for top 5 demo laws

**WHY:** The demo depends on 5 specific laws having complete data. A missing pasal or broken FTS index ruins the live demo. This is pure verification and fixing — the highest-priority task after schema.

**WHAT EXISTS NOW:** Data was loaded via `scripts/loader/load_to_supabase.py` and `scripts/fix_uu13_2003.py`. Quality unknown/varies.

**WHAT TO CHANGE:**

1. Create `scripts/verify_demo_data.py`:

```python
"""Verify data integrity for the 5 demo laws."""
import os, sys
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
    works = sb.table("works").select("*").match({"regulation_type_id": reg_type_id, "number": law["number"], "year": law["year"]}).execute()
    if not works.data:
        issues.append(f"CRITICAL: {law['type']} {law['number']}/{law['year']} not in works table — MUST ADD")
        print(f"  ❌ NOT FOUND")
        continue
    work = works.data[0]
    work_id = work["id"]
    print(f"  ✅ Found: work_id={work_id}, status={work['status']}")
    pasals = sb.table("document_nodes").select("id", count="exact").match({"work_id": work_id, "node_type": "pasal"}).execute()
    pasal_count = pasals.count or 0
    print(f"  Pasals: {pasal_count} (min: {law['min_pasals']})")
    if pasal_count < law["min_pasals"]:
        issues.append(f"LOW DATA: {law['type']} {law['number']}/{law['year']} has {pasal_count} pasals, need {law['min_pasals']}+")
    chunks = sb.table("legal_chunks").select("id", count="exact").eq("work_id", work_id).execute()
    chunk_count = chunks.count or 0
    print(f"  Chunks: {chunk_count}")
    if chunk_count == 0:
        issues.append(f"CRITICAL: {law['type']} {law['number']}/{law['year']} has 0 search chunks")

print("\n\n=== SEARCH TESTS ===")
tests = [
    ("usia minimum menikah", "Perkawinan"),
    ("upah minimum pekerja", "Ketenagakerjaan"),
    ("pemutusan hubungan kerja", "Ketenagakerjaan"),
    ("data pribadi", "PDP/ITE"),
    ("korupsi", "Anti-Korupsi"),
]
for query, expected in tests:
    result = sb.rpc("search_legal_chunks", {"query_text": query, "match_count": 3, "metadata_filter": {}}).execute()
    count = len(result.data) if result.data else 0
    status = "✅" if count > 0 else "❌"
    print(f"  {status} '{query}': {count} results ({expected})")
    if count == 0:
        issues.append(f"SEARCH FAIL: '{query}' returned 0 results")

print("\n=== SUMMARY ===")
if issues:
    print(f"⚠️  {len(issues)} issues:")
    for i in issues: print(f"  - {i}")
    sys.exit(1)
else:
    print("✅ All demo data OK!")
```

2. Run: `cd scripts && python verify_demo_data.py`
3. For CRITICAL issues: add missing laws by re-running the scraper/parser/loader or writing a targeted fix script.
4. For SEARCH FAIL issues: verify content is chunked and `fts` tsvector column is populated.

**DONE WHEN:**
- [x] Script runs and prints results for all 5 laws.
- [x] All 5 demo laws exist in `works` table.
- [x] At least 3 of 5 search test queries return results (4/5 pass).
- [x] No CRITICAL issues remain (LOW DATA warnings for UU 13/2003 and UU 6/2023 are acceptable).
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-4"></a>
## Task 4 — Populate work_relationships for demo laws

**WHY:** The `work_relationships` table is likely empty. Without it, `get_law_status` returns nothing and the law reader shows no amendment chains. The demo specifically needs: "UU 13/2003 was amended by UU 6/2023" and "UU 1/1974 was amended by UU 16/2019".

**WHAT EXISTS NOW:** `work_relationships` table exists with correct schema. `relationship_types` has codes: `mengubah`, `diubah_oleh`, `mencabut`, `dicabut_oleh`. Likely no data rows.

**WHAT TO CHANGE:**

1. Create `scripts/seed_relationships.py`:

```python
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
    if not all([src_id, tgt_id, rel_id]):
        print(f"SKIP: {src_uri} -> {rel_code} -> {tgt_uri} (missing)")
        continue
    try:
        sb.table("work_relationships").upsert(
            {"source_work_id": src_id, "target_work_id": tgt_id, "relationship_type_id": rel_id},
            on_conflict="source_work_id,target_work_id,relationship_type_id"
        ).execute()
        print(f"OK: {src_uri} -> {rel_code} -> {tgt_uri}")
        inserted += 1
    except Exception as e:
        print(f"ERROR: {e}")
print(f"\nInserted: {inserted}")
```

2. Run: `cd scripts && python seed_relationships.py`

**DONE WHEN:**
- [x] `SELECT COUNT(*) FROM work_relationships;` returns at least 4 (has 10).
- [x] MCP `get_law_status("UU", "13", 2003)` returns amendment info mentioning UU 6/2023.
- [x] Law reader context panel for UU 13/2003 shows "Diubah oleh" section.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-5"></a>
## Task 5 — Improve MCP server tool descriptions for better Claude behavior

**WHY:** Tool descriptions are the #1 lever for LLM tool use accuracy. Current descriptions don't tell Claude *when* to use each tool, *what to do next*, or how the Indonesian legal hierarchy works.

**WHAT EXISTS NOW:** `apps/mcp-server/server.py` has 4 tools + ping with basic docstrings. The `FastMCP` constructor has a minimal `instructions` string.

**WHAT TO CHANGE in `apps/mcp-server/server.py`:**

1. Upgrade the `FastMCP` constructor `instructions` to include:
   - Indonesian legal hierarchy (UUD → UU → PP → PERPRES → PERMEN → PERDA)
   - Recommended workflow order (search → get_pasal → get_law_status → list_laws)
   - Citation format rules: "Pasal X UU No. Y Tahun Z"
   - Search tips: search in Bahasa Indonesia for best results

2. Add "USE WHEN" / "DO NEXT" guidance to each tool docstring:
   - `search_laws`: "USE WHEN: User asks about a legal topic. DO NEXT: Use get_pasal for full text."
   - `get_pasal`: "USE WHEN: You know which article to cite. DO NEXT: Use get_law_status to verify."
   - `get_law_status`: "USE WHEN: Need to verify a law's validity before citing."
   - `list_laws`: "USE WHEN: User wants to browse. PREFER search_laws for specific questions."

3. Improve error returns to guide self-correction. In `get_pasal`, add `"suggestion"` field:
```python
return {"error": f"Law not found: {law_type} {law_number}/{year}", "suggestion": "Use list_laws to check available regulations, or verify type/number/year."}
```

**DONE WHEN:**
- [x] `python server.py` starts without errors.
- [x] The `instructions` field contains "LEGAL HIERARCHY" and "WORKFLOW".
- [x] Each tool docstring contains "USE WHEN" guidance.
- [x] Error returns include `"suggestion"` field.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-6"></a>
## Task 6 — Add search snippets with highlighted terms

**WHY:** `search_laws` returns raw `content` which is too long and noisy. PostgreSQL's `ts_headline` generates short snippets with matched terms highlighted — dramatically better for both MCP responses and frontend search results.

**WHAT EXISTS NOW:**
- `006_search_function.sql` defines `search_legal_chunks` returning full `content` with no snippets.
- MCP `search_laws` returns raw `r["content"]`.
- Frontend manually truncates: `chunk.content.split("\n").slice(2).join(" ").slice(0, 250)`.

**WHAT TO CHANGE:**

1. Create `packages/supabase/migrations/009_search_snippets.sql`:

```sql
-- Migration 009: Add ts_headline snippets to search function

CREATE OR REPLACE FUNCTION search_legal_chunks(
    query_text TEXT,
    match_count INT DEFAULT 10,
    metadata_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    work_id INTEGER,
    content TEXT,
    metadata JSONB,
    score FLOAT,
    snippet TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT lc.id, lc.work_id, lc.content, lc.metadata,
        ts_rank_cd(lc.fts, websearch_to_tsquery('indonesian', query_text))::float AS score,
        ts_headline('indonesian', lc.content, websearch_to_tsquery('indonesian', query_text),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2') AS snippet
    FROM legal_chunks lc
    WHERE lc.fts @@ websearch_to_tsquery('indonesian', query_text)
        AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
    ORDER BY score DESC LIMIT match_count;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT lc.id, lc.work_id, lc.content, lc.metadata,
            ts_rank_cd(lc.fts, plainto_tsquery('indonesian', query_text))::float AS score,
            ts_headline('indonesian', lc.content, plainto_tsquery('indonesian', query_text),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2') AS snippet
        FROM legal_chunks lc
        WHERE lc.fts @@ plainto_tsquery('indonesian', query_text)
            AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
        ORDER BY score DESC LIMIT match_count;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT lc.id, lc.work_id, lc.content, lc.metadata,
            0.01::float AS score, LEFT(lc.content, 200) AS snippet
        FROM legal_chunks lc
        WHERE (SELECT bool_and(lc.content ILIKE '%' || word || '%')
               FROM unnest(string_to_array(trim(query_text), ' ')) AS word WHERE length(word) > 2)
            AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
        ORDER BY lc.id LIMIT match_count;
    END IF;
END;
$$;
```

2. Run this migration against Supabase.

3. In `apps/mcp-server/server.py` `search_laws`, replace `"content": r["content"]` with:
```python
"snippet": r.get("snippet", r["content"][:300]),
```

4. In `apps/web/src/app/search/page.tsx`, use the `snippet` field and render `<mark>` tags:
```tsx
<p className="text-sm text-muted-foreground line-clamp-3"
   dangerouslySetInnerHTML={{ __html: (chunk as any).snippet || chunk.content.split("\n").slice(2).join(" ").slice(0, 250) }} />
```

**DONE WHEN:**
- [x] Migration runs on Supabase without error.
- [x] `SELECT snippet FROM search_legal_chunks('upah minimum', 3, '{}'::jsonb);` returns text with `<mark>` tags.
- [x] MCP `search_laws` returns `snippet` field (not raw `content`).
- [x] Frontend search results show highlighted terms.
- [x] `npm run build` succeeds.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑
- [x] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☑

---

<a id="task-7"></a>
## Task 7 — Add trigram search fallback for fuzzy matching

**WHY:** The Indonesian stemmer can't handle reduplication (undang-undang), loanwords, or typos. `pg_trgm` gives fuzzy matching that catches what FTS misses.

**WHAT EXISTS NOW:** Only `GIN(fts)` index. The ILIKE fallback in search function has no index support.

**WHAT TO CHANGE:**

1. Create `packages/supabase/migrations/010_trigram_index.sql`:

```sql
-- Migration 010: Trigram index for fuzzy search fallback
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_chunks_trgm ON legal_chunks USING gin(content gin_trgm_ops);
```

2. Run on Supabase. The trigram index automatically accelerates the ILIKE fallback in the search function.

**DONE WHEN:**
- [x] `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';` returns a row.
- [x] `idx_chunks_trgm` index exists.
- [x] Search still works: `SELECT * FROM search_legal_chunks('upah minimum', 3, '{}'::jsonb);` returns results.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-8"></a>
## Task 8 — Add cross-reference extraction to `get_pasal`

**WHY:** Indonesian laws constantly reference each other ("sebagaimana dimaksud dalam Pasal X"). Extracting these lets Claude follow citation chains without extra round trips.

**WHAT EXISTS NOW:** `get_pasal` returns `content_text` and `ayat` list but no cross-references.

**WHAT TO CHANGE in `apps/mcp-server/server.py`:**

1. Add a helper function after imports:

```python
import re

CROSS_REF_PATTERN = re.compile(
    r'(?:sebagaimana\s+dimaksud\s+(?:dalam|pada)\s+)?'
    r'Pasal\s+(\d+[A-Z]?)'
    r'(?:\s+ayat\s+\((\d+)\))?'
    r'(?:\s+(?:huruf\s+([a-z])\.?))?'
    r'(?:\s+(?:Undang-Undang|UU)\s+(?:Nomor\s+)?(\d+)\s+Tahun\s+(\d{4}))?',
    re.IGNORECASE
)

def extract_cross_references(text: str) -> list[dict]:
    refs, seen = [], set()
    for m in CROSS_REF_PATTERN.finditer(text):
        key = (m.group(1), m.group(2), m.group(4), m.group(5))
        if key in seen: continue
        seen.add(key)
        ref = {"pasal": m.group(1)}
        if m.group(2): ref["ayat"] = m.group(2)
        if m.group(3): ref["huruf"] = m.group(3)
        if m.group(4) and m.group(5):
            ref["law_number"] = m.group(4)
            ref["law_year"] = int(m.group(5))
        refs.append(ref)
    return refs
```

2. In `get_pasal` return dict, add: `"cross_references": extract_cross_references(node["content_text"] or "")`

**DONE WHEN:**
- [x] `python server.py` starts without errors.
- [x] `get_pasal` for an article with cross-references returns a non-empty `cross_references` list.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-9"></a>
## Task 9 — MCP response size optimization

**WHY:** MCP best practices: keep responses under 10K tokens. Large omnibus law articles can return 10K+ characters through `get_pasal`.

**WHAT EXISTS NOW:** `get_pasal` returns full `content_text` without limits. `search_laws` may still return raw `content`.

**WHAT TO CHANGE in `apps/mcp-server/server.py`:**

1. In `search_laws`, verify only `snippet` is returned (not raw `content`). Remove `content` from results if present.

2. In `get_pasal`, truncate oversized content:
```python
content = node["content_text"] or ""
if len(content) > 3000:
    content = content[:3000] + f"\n\n[...truncated. Full: {len(node['content_text'])} chars. This article has {len(ayat_result.data or [])} ayat.]"
```

**DONE WHEN:**
- [x] `search_laws` returns `snippet`, not raw `content`.
- [x] `get_pasal` for a very long article includes truncation notice.
- [x] Server starts without errors.
- [x] Run `code-simplifier` plugin. ☑
- [x] Run `code-review` plugin. ☑

---

<a id="task-10"></a>
## Task 10 — Build the crawling pipeline foundation

**WHY:** The current scraper handles only 20 hardcoded laws. We need a systematic pipeline that can grow to 1,000+ laws from multiple sources, with state tracking, dedup, and resumability.

**WHAT EXISTS NOW:**
- `scripts/scraper/scrape_laws.py` — 20 hardcoded URLs for peraturan.go.id.
- `scripts/parser/parse_law.py` — regex-based PDF parser.
- `scripts/loader/load_to_supabase.py` — inserts into Supabase.
- No job queue, no state tracking, no multi-source support.

**WHAT TO CHANGE:**

1. Create directory `scripts/crawler/` with `__init__.py`.

2. Create `scripts/crawler/config.py`:
```python
"""Crawler configuration."""
DELAY_BETWEEN_REQUESTS = 2.0  # seconds
DELAY_BETWEEN_PAGES = 5.0
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
}
PDF_STORAGE_DIR = "data/pdfs/"
PARSED_DIR = "data/parsed/"
```

3. Create `scripts/crawler/models.py` with Pydantic `CrawlJob` model:
   - Fields: `source_id`, `url`, `pdf_url`, `regulation_type`, `number`, `year`, `title`, `status` (pending/crawling/downloaded/parsed/loaded/failed), `error_message`, `last_crawled_at`, `frbr_uri`

4. Create migration `packages/supabase/migrations/011_crawl_state.sql`:
```sql
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_id VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    pdf_url TEXT,
    regulation_type VARCHAR(20),
    number VARCHAR(50),
    year INTEGER,
    title TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','crawling','downloaded','parsed','loaded','failed')),
    error_message TEXT,
    frbr_uri VARCHAR(255),
    work_id INTEGER REFERENCES works(id) ON DELETE SET NULL,
    last_crawled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, url)
);
CREATE INDEX idx_crawl_status ON crawl_jobs(status);
CREATE INDEX idx_crawl_source ON crawl_jobs(source_id);
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access crawl_jobs" ON crawl_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
```

5. Create `scripts/crawler/state.py` with functions:
   - `upsert_job(job)` → insert/update crawl job, return ID
   - `get_pending_jobs(source_id, limit)` → list pending jobs
   - `update_status(job_id, status, error?)` → update job status
   - `is_url_visited(source_id, url)` → check if already crawled

6. Create `scripts/crawler/pipeline.py` with:
   - `download_pdf(client, pdf_url, save_path)` → download PDF file
   - `run_pipeline(source_id, limit)` → process pending crawl jobs

**DONE WHEN:**
- [ ] `scripts/crawler/` exists with `__init__.py`, `config.py`, `models.py`, `state.py`, `pipeline.py`.
- [ ] Migration 011 runs on Supabase. `crawl_jobs` table exists.
- [ ] `python -c "from scripts.crawler.models import CrawlJob; print('OK')"` works.
- [ ] `python -c "from scripts.crawler.state import get_pending_jobs; print(get_pending_jobs())"` returns empty list.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐

---

<a id="task-11"></a>
## Task 11 — Create the source registry with all Indonesian legal sources

**WHY:** We need a single file mapping every crawlable Indonesian legal source. This is the "what to scrape" blueprint.

**WHAT EXISTS NOW:** Hardcoded 20 URLs in the old scraper. No registry.

**WHAT TO CHANGE:**

1. Create `scripts/crawler/source_registry.py` with a `SOURCES` list containing 11+ sources:

| Source ID | URL | Est. Documents | Needs Headless | Priority |
|-----------|-----|----------------|----------------|----------|
| `peraturan_go_id` | peraturan.go.id | 61,740 | No | 1 |
| `peraturan_bpk` | peraturan.bpk.go.id | 100,000+ | Yes (403) | 2 |
| `jdih_setneg` | jdih.setneg.go.id | 5,000 | No | 2 |
| `jdih_kemenkeu` | jdih.kemenkeu.go.id | 10,000 | No | 3 |
| `jdih_kemendagri` | jdih.kemendagri.go.id | 3,000 | No | 3 |
| `jdih_kemnaker` | jdih.kemnaker.go.id | 1,000 | No | 3 |
| `jdih_esdm` | jdih.esdm.go.id | 2,000 | Yes (bot protection) | 4 |
| `putusan_ma` | putusan3.mahkamahagung.go.id | 10.5M | No (rate limits) | 4 |
| `otf_corpus` | GitHub OTF | 5,817 | No (git clone) | 1 |
| `indo_law_dataset` | GitHub ir-nlp-csui | 22,630 | No | 2 |
| `perpusnas_api` | api-jdih.perpusnas.go.id | Unknown | No (Bearer auth) | 2 |

Each source dict includes: `id`, `name`, `base_url`, `content_type`, `est_documents`, `needs_headless`, `anti_scraping` notes, `priority`, `reg_types`, `notes`.

2. Add helper functions: `get_sources_by_priority()`, `get_source(id)`, `get_simple_http_sources()`.

**DONE WHEN:**
- [ ] File exists with 11+ sources.
- [ ] `python -c "from scripts.crawler.source_registry import get_sources_by_priority; print(len(get_sources_by_priority()))"` prints 11+.
- [ ] Each source has all required fields (no KeyError when accessing).
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐

---

<a id="task-12"></a>
## Task 12 — Build deduplication and visit-tracking system

**WHY:** The same regulation appears on multiple sources. We need cross-source dedup by FRBR URI and visit tracking to avoid re-processing.

**WHAT EXISTS NOW:** `crawl_jobs` has `UNIQUE(source_id, url)` (per-source dedup) but no cross-source dedup.

**WHAT TO CHANGE:**

1. Create `scripts/crawler/dedup.py`:
   - `build_frbr_uri(reg_type, number, year)` → canonical FRBR URI
   - `is_work_duplicate(frbr_uri)` → check if work already exists
   - `mark_job_duplicate(job_id, existing_work_id)` → mark as dupe
   - `get_crawl_stats()` → total jobs, by status, works count

2. Create `scripts/crawler/seed_jobs.py`:
   - `seed_from_otf_corpus()` → clone OTF GitHub repo, create crawl jobs from text files
   - CLI interface: `python -m scripts.crawler.seed_jobs --source otf_corpus`

**DONE WHEN:**
- [ ] `dedup.py` and `seed_jobs.py` exist.
- [ ] `build_frbr_uri('UU', '13', 2003)` returns `/akn/id/act/uu/2003/13`.
- [ ] `is_work_duplicate` correctly finds existing works.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐

---

<a id="task-13"></a>
## Task 13 — Build the /connect page with MCP setup guide

**WHY:** Judges need a polished install page with copy-paste commands and example prompts to try the MCP themselves.

**WHAT EXISTS NOW:** Landing page links to `/connect` but the page is minimal or missing.

**WHAT TO CHANGE:**

**📖 Read `BRAND_GUIDELINES.md` before writing any JSX.**

1. Create `apps/web/src/app/connect/page.tsx` with:
   - MCP install command (copyable code block): `claude mcp add pasal-id --transport http --url https://pasal-mcp-server-production.up.railway.app/mcp/`
   - Claude Desktop JSON config snippet
   - 5 example prompts in Bahasa Indonesia
   - "Cara Kerjanya" (How it works) section: MCP → search → get_pasal → cite
   - Grid of 4 MCP tools with Indonesian descriptions
   - Use the existing `Header` component. All text in Bahasa Indonesia.

**DONE WHEN:**
- [ ] `/connect` renders with install command, example prompts, and tool descriptions.
- [ ] `npm run build` succeeds.
- [ ] Landing page link to `/connect` works.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

<a id="task-14"></a>
## Task 14 — Expand landing page with stats, features, and audience sections

**WHY:** The landing page is just a search bar. For hackathon judges AND real users, it needs to communicate value instantly.

**WHAT EXISTS NOW:** `apps/web/src/app/page.tsx` with search hero, law type chips, and a connect card.

**WHAT TO CHANGE:**

**📖 Read `BRAND_GUIDELINES.md` before any changes.**

Add sections below the search hero:

1. **Live stats bar** (server component): `[X] UU • [Y] Peraturan • [Z] Pasal • 100% Gratis & Open Source`

2. **"Untuk Siapa?"** (Who Is This For?) — 3-column grid:
   - Warga Negara (Citizens): "Cari tahu hak Anda tanpa jargon hukum"
   - Profesional Hukum (Lawyers): "Riset cepat dengan kutipan pasal yang akurat"
   - Developer: "API & MCP server untuk integrasi AI"

3. **"Bagaimana Cara Kerjanya?"** — 3-step flow: Type question → AI searches → Get cited answer

4. **"Fitur Utama"** — 2x2 grid: Smart Search, Accurate Citations, Law Status, Open Source

5. **CTA section**: "Mulai Cari" button + "Hubungkan ke Claude" button → `/connect`

**DONE WHEN:**
- [ ] Landing page has stats, audience, how-it-works, features, and CTA sections.
- [ ] Stats bar fetches real counts from Supabase.
- [ ] All text in Bahasa Indonesia.
- [ ] Responsive on mobile.
- [ ] `npm run build` succeeds.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

<a id="task-15"></a>
## Task 15 — Build "Kenali Hakmu" (Know Your Rights) topic guides

**WHY:** Citizens don't search by pasal number — they search by life situation: "I got fired", "I want to get married". Topic guides bridge this gap.

**WHAT EXISTS NOW:** No topic guides. Search only.

**WHAT TO CHANGE:**

**📖 Read `BRAND_GUIDELINES.md` before writing JSX.**

1. Create `apps/web/src/data/topics.ts` — data file with 4 topics:
   - Ketenagakerjaan (Labor): upah, PHK, cuti, lembur
   - Pernikahan & Keluarga (Marriage): usia menikah, syarat, perceraian
   - Data Pribadi (Data Privacy): hak, kewajiban pengendali
   - Hukum Pidana (Criminal): KUHP baru

   Each topic has: slug, title, description, icon, related laws, and FAQ-style question/pasal pairs.

2. Create `apps/web/src/app/topik/page.tsx` — topic listing page with cards.
3. Create `apps/web/src/app/topik/[slug]/page.tsx` — individual topic page with questions linking to search and pasals linking to law reader.
4. Add "Topik" link to Header navigation.

**DONE WHEN:**
- [ ] `/topik` shows a grid of 4 topic cards.
- [ ] `/topik/ketenagakerjaan` renders with questions and pasal links.
- [ ] Questions link to `/search?q=...` pre-filled.
- [ ] `npm run build` succeeds.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

<a id="task-16"></a>
## Task 16 — Add bookmarks and reading history (localStorage)

**WHY:** Stickiness — users return when they have saved content. Legal professionals need to save frequently-referenced articles.

**WHAT EXISTS NOW:** No bookmarking or history.

**WHAT TO CHANGE:**

**📖 Read `BRAND_GUIDELINES.md` for icon and button styles.**

1. Create `apps/web/src/lib/bookmarks.ts` — localStorage utility:
   - `addBookmark(frbr_uri, title, pasal?)` / `removeBookmark(frbr_uri)`
   - `getBookmarks()` → array sorted by addedAt
   - `addToHistory(frbr_uri, title)` / `getHistory(limit=50)` → recent items

2. Add bookmark toggle icon button to each Pasal block in law reader.
3. Create `apps/web/src/app/bookmark/page.tsx` — saved bookmarks and recent history.
4. Add "Bookmark" and "Riwayat" (History) to Header.

**DONE WHEN:**
- [ ] Bookmark icon on a Pasal toggles save to localStorage.
- [ ] `/bookmark` shows saved items and history.
- [ ] Header has bookmark/history links.
- [ ] `npm run build` succeeds.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

<a id="task-17"></a>
## Task 17 — Add law amendment timeline visualization

**WHY:** Showing "UU 1/1974 → amended by UU 16/2019" as a visual timeline is one of the most impressive demo moments.

**WHAT EXISTS NOW:** `work_relationships` populated (Task 4). Law reader shows text-only relationships.

**WHAT TO CHANGE:**

**📖 Read `BRAND_GUIDELINES.md` for timeline colors.**

1. Create `apps/web/src/components/reader/AmendmentTimeline.tsx`:
```
 ● 1974 — UU 1/1974 Perkawinan (Original)
 │  "Usia minimum: 16 thn (perempuan), 19 thn (laki-laki)"
 ● 2019 — UU 16/2019 Perubahan
 │  "Usia minimum: 19 tahun (semua gender)"
 ◉ Status: Berlaku (dengan perubahan)
```

2. Fetch relationships, sort chronologically, link nodes to law reader pages.
3. Integrate into law reader right sidebar, replacing/augmenting text-only relationships.
4. Renders gracefully when no relationships exist (hidden, not broken).

**DONE WHEN:**
- [ ] Timeline renders on UU 1/1974 showing the 2019 amendment.
- [ ] Timeline nodes link to related law pages.
- [ ] Graceful fallback when no relationships exist.
- [ ] `npm run build` succeeds.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

<a id="task-18"></a>
## Task 18 — Build REST API endpoints for developers

**WHY:** Developers are one of three target audiences. A JSON API makes Pasal.id useful for bots, apps, research tools, and other integrations.

**WHAT EXISTS NOW:** No public API. Only internal Supabase RPC.

**WHAT TO CHANGE:**

1. Create `apps/web/src/app/api/v1/search/route.ts`:
   - `GET /api/v1/search?q=upah+minimum&type=UU&limit=10`
   - Returns `{ results: [...], total, query }`

2. Create `apps/web/src/app/api/v1/laws/route.ts`:
   - `GET /api/v1/laws?type=UU&year=2003&status=berlaku`
   - Returns `{ laws: [...], total }`

3. Create `apps/web/src/app/api/v1/laws/[...frbr]/route.ts`:
   - `GET /api/v1/laws/akn/id/act/uu/2003/13`
   - Returns `{ work, articles, relationships }`

4. Add CORS headers for cross-origin access.
5. Create `apps/web/src/app/api/page.tsx` — simple API docs page with examples.

**DONE WHEN:**
- [ ] `curl localhost:3000/api/v1/search?q=ketenagakerjaan` returns JSON.
- [ ] `curl localhost:3000/api/v1/laws?type=UU` returns a list.
- [ ] Response includes CORS headers (`Access-Control-Allow-Origin`).
- [ ] `/api` page shows documentation.
- [ ] `npm run build` succeeds.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

<a id="task-19"></a>
## Task 19 — End-to-end MCP flow test script

**WHY:** Before recording the demo, verify the complete MCP flow works for the exact demo scenarios.

**WHAT EXISTS NOW:** No automated test.

**WHAT TO CHANGE:**

Create `scripts/test_mcp_flow.py` that tests 3 scenarios by calling Supabase directly (replicating MCP tool logic):

1. **Marriage age scenario**: search "usia minimum menikah" → find UU 16/2019 → get Pasal 7 → check status of UU 1/1974.

2. **Worker rights scenario**: search "hak pekerja kontrak" → find UU 13/2003 → search "pemutusan hubungan kerja" → verify results.

3. **Cross-regulation scenario**: check UU 13/2003 status → verify UU 6/2023 appears as amending law.

4. Print total law count and health status.

**DONE WHEN:**
- [ ] Script runs without errors.
- [ ] All 3 scenarios produce meaningful results (not empty).
- [ ] Marriage query finds UU 1/1974 or UU 16/2019.
- [ ] Worker query finds UU 13/2003.
- [ ] Cross-regulation test finds UU 6/2023 amendment link.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐

---

<a id="task-20"></a>
## Task 20 — Final demo data verification and polish

**WHY:** 30% of hackathon score is the demo. This ensures everything works before recording.

**WHAT EXISTS NOW:** All previous tasks completed.

**WHAT TO CHANGE:**

1. Re-run `scripts/verify_demo_data.py` — all checks must pass.
2. Re-run `scripts/test_mcp_flow.py` — all scenarios must work.
3. Verify frontend end-to-end:
   - Landing page loads with real stats and all new sections.
   - Search "upah minimum" → highlighted results.
   - Law reader for UU 13/2003 → TOC, content, amendment timeline, verification badge.
   - `/connect` page → copyable MCP command.
   - `/topik` page → topic cards.
   - `/bookmark` page → works (even if empty).
4. Verify MCP via Claude:
   - Install: `claude mcp add pasal-id --transport http --url https://pasal-mcp-server-production.up.railway.app/mcp/`
   - Ask: "Berapa usia minimum menikah di Indonesia?"
   - Claude uses search_laws → get_pasal → get_law_status, cites correctly.
5. Verify REST API:
   - `curl https://pasal.id/api/v1/search?q=ketenagakerjaan` returns JSON.
6. `npm run build` succeeds.
7. Push all changes to `main`.

**DONE WHEN:**
- [ ] `verify_demo_data.py` passes.
- [ ] `test_mcp_flow.py` passes.
- [ ] Frontend builds and deploys to Vercel.
- [ ] MCP responds correctly to Claude.
- [ ] REST API returns valid JSON.
- [ ] All committed and pushed.
- [ ] Run `code-simplifier` plugin. ☐
- [ ] Run `code-review` plugin. ☐
- [ ] Run `frontend-design` skill, verify against `BRAND_GUIDELINES.md`. ☐

---

## Appendix A — Task Priority (If Short on Time)

Do in this order if you can't finish everything:

1. **Task 3** — verify demo data (nothing works if data is broken)
2. **Task 4** — seed relationships (required for get_law_status demo)
3. **Task 5** — MCP descriptions (highest ROI per line changed)
4. **Task 19** — test script (validates everything)
5. **Task 6** — search snippets (improves MCP and frontend)
6. **Task 1** — schema migration (future-proofing, low effort)
7. **Task 2** — CLAUDE.md update (2 minutes, high value)
8. **Task 13** — connect page (judges try this themselves)
9. **Task 14** — landing page expansion (first impression)
10. **Task 8** — cross-references (impressive in demo)
11. Everything else

---

## Appendix B — Indonesian Legal Source Landscape

> Reference data for crawling tasks (10-12). Do NOT implement all of this — it's context.

**Primary Sources (Tier 1):**

| Source | URL | Documents | Scraping |
|--------|-----|-----------|----------|
| peraturan.go.id | https://peraturan.go.id | 61,740+ | Easy (HTTP) |
| peraturan.bpk.go.id | https://peraturan.bpk.go.id | 100,000+ | Medium (headless) |
| putusan3.mahkamahagung.go.id | https://putusan3.mahkamahagung.go.id | 10.5M decisions | Hard (scale) |
| jdihn.go.id | https://jdihn.go.id | Meta-portal | Easy |

**Pre-processed Datasets (Fastest Path):**

| Dataset | Source | Documents | Format |
|---------|--------|-----------|--------|
| Open-Technology-Foundation/peraturan.go.id | GitHub | 5,817 regs | Text |
| ir-nlp-csui/indo-law | GitHub | 22,630 decisions | XML |
| Azzindani/Indonesian_Legal_QA | HuggingFace | 8,080 Q&A | JSON |

**JDIH Ministry Portals:**
- jdih.setneg.go.id (State Secretariat) — UU, PP, Perpres
- jdih.kemenkeu.go.id (Finance) — PMK, tax, customs
- jdih.kemendagri.go.id (Home Affairs) — regional governance
- jdih.kemnaker.go.id (Manpower) — labor regulations
- jdih.esdm.go.id (Energy) — needs headless browser
- api-jdih.perpusnas.go.id — only documented REST API (Bearer auth)

**Crawling Budget (~$8/month):**

| Component | Choice | Cost |
|-----------|--------|------|
| Server | Hetzner CX33 (4 vCPU, 8GB) | $6 |
| PDF Storage | Cloudflare R2 (100GB) | $1.50 |
| Job Queue | APScheduler (in-process) | $0 |
| Proxy | Not needed initially | $0 |

**Key findings:**
- peraturan.go.id has minimal anti-scraping. Standard HTTP requests work.
- peraturan.bpk.go.id returns 403 to non-browser requests → needs headless browser or full browser headers.
- All sites serve regulation text exclusively as PDF. HTML pages contain only metadata.
- The OTF corpus (5,817 pre-extracted regulations) is the fastest path to 1,000+ laws.
- The Perpusnas REST API (api-jdih.perpusnas.go.id) is the only documented public API.

---

## Appendix C — Website Feature Roadmap (Post-Hackathon)

Inspired by Westlaw, CanLII, Singapore Statutes Online, and Laws.Africa:

**Phase 2 (1-3 months post-hackathon):**
- AI plain-language summaries (CanLII model, using Claude/Gemini)
- Email alerts for law changes
- Point-in-time version history with visual timeline
- User accounts with server-synced bookmarks
- Advanced Boolean search operators
- English translations via Gemini Pro 3

**Phase 3 (3-6 months):**
- Side-by-side text diff between law versions
- Citation network visualization (graph of which laws cite which)
- Progressive Web App for offline access
- OpenAPI specification + Python SDK
- Community verification workflow (crowdsourced human_verified)
- Webhooks API for developer integrations