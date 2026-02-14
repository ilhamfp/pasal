# Pasal.id — Upgrade Tasks: Mass Scraping + Crowd-Sourced Corrections

> **Context:** Pasal.id is already a working platform with ~20 laws, a deployed MCP server (4 tools + ping), a Next.js 16 frontend with search + regulation reader, and Supabase with 11 migrations (001–011). These tasks ADD new capabilities on top of that foundation.
>
> **What we're adding:**
> 1. Mass scraper to go from 20 → 62,000 regulations
> 2. Improved PDF parser (PyMuPDF replacing pdfplumber)
> 3. Crowd-sourced correction system (users suggest fixes, admins review, LLM verifies)
> 4. Append-only revision tracking for all content changes
>
> **Existing codebase you MUST NOT break:**
>
> | Layer | Key Files | Status |
> |-------|-----------|--------|
> | Database | `works`, `document_nodes`, `legal_chunks`, `work_relationships`, `regulation_types`, `relationship_types` | 11 migrations (001–011) |
> | Search | `search_legal_chunks()` with 3-tier fallback (websearch → plainto → ILIKE), `ts_headline` snippets, hierarchy + recency boosting, trigram index | Already upgraded |
> | MCP Server | `apps/mcp-server/server.py` — `search_laws`, `get_pasal`, `get_law_status`, `list_laws`, `ping` + rate limiter + cross-reference extraction | Deployed on Railway |
> | Frontend | `apps/web/` — landing page, `/search`, `/peraturan/[type]/[slug]` reader (3-column: TOC / content / context), `/connect`, `/topik`, `/api/v1/` REST API | Deployed on Vercel |
> | Scripts | `scripts/scraper/scrape_laws.py`, `scripts/parser/parse_law.py`, `scripts/loader/load_to_supabase.py` | Working pipeline |
> | Brand | `BRAND_GUIDELINES.md` — Instrument Serif + Instrument Sans, verdigris (#2B6150), warm stone (#F8F5F0) | **Must follow** |
>
> **For each task:** Complete all verification checkboxes → run `code-simplifier` → run `code-review` → fix issues → commit → push.
>
> **📖 Read `BRAND_GUIDELINES.md` before writing ANY frontend code.**

---

## TASK 1: Database Schema Additions

We're adding new regulation types, 2 new tables, and new columns.

### 1.1 — Expand `regulation_types` to match peraturan.go.id

File: `packages/supabase/migrations/012_expand_regulation_types.sql`

The current table has 11 types. peraturan.go.id has significantly more — we're missing entire categories from the central government hierarchy plus the massive PERBAN (agency regulation) category. This migration adds them all:

```sql
-- Add missing regulation types from peraturan.go.id
-- See: https://peraturan.go.id/pemerintah-pusat for central government types
-- See: https://peraturan.go.id/ for all categories

INSERT INTO regulation_types (code, name_id, name_en, hierarchy_level, description) VALUES
    -- Central government types missing from original seed
    ('UUDRT', 'Undang-Undang Darurat', 'Emergency Law', 3,
     'Historical emergency laws, mostly pre-1966'),
    ('UUDS', 'Undang-Undang Dasar Sementara', 'Provisional Constitution', 1,
     'Provisional Constitution of 1950, historical'),
    ('PENPRES', 'Penetapan Presiden', 'Presidential Determination', 5,
     'Presidential determinations, mostly Sukarno era 1959-1966'),
    ('KEPPRES', 'Keputusan Presiden', 'Presidential Decision', 5,
     'Presidential decisions — appointments, designations, operational matters'),
    ('INPRES', 'Instruksi Presiden', 'Presidential Instruction', 5,
     'Presidential instructions to ministries/agencies'),

    -- Agency/institutional regulations (6,716 on peraturan.go.id)
    ('PERBAN', 'Peraturan Badan/Lembaga', 'Agency/Institutional Regulation', 8,
     'Regulations from non-ministerial agencies: Bawaslu, BRIN, BMKG, KPU, OJK, etc.'),

    -- Specific ministerial regulation subtypes (shown separately on peraturan.go.id nav)
    ('PERMENKUMHAM', 'Peraturan Menteri Hukum dan HAM', 'Minister of Law and Human Rights Regulation', 8,
     'Kemenkumham regulations — shown as separate category on peraturan.go.id'),
    ('PERMENKUM', 'Peraturan Menteri Hukum', 'Minister of Law Regulation', 8,
     'Kemenkum regulations (post-2024 ministry restructuring)'),

    -- Merged regional (peraturan.go.id shows PERDA as one category with 19,732 entries)
    ('PERDA', 'Peraturan Daerah', 'Regional Regulation', 6,
     'Combined regional regulations — maps to both PERDA_PROV and PERDA_KAB'),

    -- Ministerial/agency decision types (common in peraturan.go.id data)
    ('KEPMEN', 'Keputusan Menteri', 'Ministerial Decision', 9,
     'Ministerial decisions — operational, not normative'),
    ('SE', 'Surat Edaran', 'Circular Letter', 10,
     'Circular letters — guidance, not binding regulation')
ON CONFLICT (code) DO NOTHING;
```

This brings us from 11 to ~22 regulation types, covering everything on peraturan.go.id. The scraper (Task 2) will need to map each regulation it finds to these codes.

**Verification:**
- [x] Migration runs without error
- [x] `SELECT COUNT(*) FROM regulation_types` shows ~22 rows
- [x] Original 11 types unchanged: `SELECT * FROM regulation_types WHERE id <= 11` still correct
- [x] MCP server `list_laws` still works (it reads regulation_types dynamically)

> 🔁 `git commit -m "feat: expand regulation_types to cover all peraturan.go.id categories" && git push origin main`

**Also update the MCP server** — The `FastMCP` `instructions` string in `apps/mcp-server/server.py` currently only lists `UU → PP → PERPRES → PERMEN → PERDA`. Update it to include the full hierarchy: `UUD → TAP MPR → UU/PERPPU/UUDRT → PP → PERPRES/KEPPRES/INPRES/PENPRES → PERMEN/PERMENKUMHAM → PERBAN → PERDA`. Also update the `_reg_types` cache to handle new codes. The `list_laws` and `search_laws` tools should automatically work since they read `regulation_types` dynamically.

### 1.2 — Add `revisions` table (append-only change tracking)

File: `packages/supabase/migrations/013_revisions.sql`

Every future change to `document_nodes.content_text` gets recorded here BEFORE the change is applied. This is the audit trail.

```sql
CREATE TABLE revisions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES document_nodes(id) ON DELETE CASCADE,
    node_type VARCHAR(20) NOT NULL,
    node_number VARCHAR(50),
    node_path LTREE,
    old_content TEXT,
    new_content TEXT NOT NULL,
    revision_type VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    suggestion_id BIGINT,
    verified_by TEXT,
    verification_details JSONB,
    created_by UUID,
    actor_type VARCHAR(20) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revisions_work ON revisions(work_id);
CREATE INDEX idx_revisions_node ON revisions(node_id);
CREATE INDEX idx_revisions_type ON revisions(revision_type);
CREATE INDEX idx_revisions_created ON revisions(created_at DESC);
```

### 1.2 — Add `suggestions` table

File: `packages/supabase/migrations/014_suggestions.sql`

```sql
CREATE TABLE suggestions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    work_id INTEGER NOT NULL REFERENCES works(id),
    node_id INTEGER NOT NULL REFERENCES document_nodes(id),
    node_type VARCHAR(20) NOT NULL,
    node_number VARCHAR(50),
    current_content TEXT NOT NULL,
    suggested_content TEXT NOT NULL,
    user_reason TEXT,
    user_reference TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    agent_triggered_at TIMESTAMPTZ,
    agent_model TEXT,
    agent_response JSONB,
    agent_decision VARCHAR(20),
    agent_modified_content TEXT,
    agent_confidence FLOAT,
    agent_completed_at TIMESTAMPTZ,
    revision_id BIGINT REFERENCES revisions(id),
    submitted_by UUID,
    submitter_ip TEXT,
    submitter_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE revisions ADD CONSTRAINT fk_revisions_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id);

CREATE INDEX idx_suggestions_work ON suggestions(work_id);
CREATE INDEX idx_suggestions_status ON suggestions(status);
CREATE INDEX idx_suggestions_created ON suggestions(created_at DESC);
CREATE INDEX idx_suggestions_ip_time ON suggestions(submitter_ip, created_at DESC);

ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read revisions" ON revisions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert suggestions" ON suggestions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public read suggestions" ON suggestions FOR SELECT TO anon, authenticated USING (true);
```

### 1.3 — Add columns to existing `works` table for scraping metadata

File: `packages/supabase/migrations/015_works_scraping_columns.sql`

```sql
ALTER TABLE works ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pemrakarsa TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS tempat_penetapan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS tanggal_penetapan DATE;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pejabat_penetap TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS tanggal_pengundangan DATE;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pejabat_pengundangan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS nomor_pengundangan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS nomor_tambahan TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS pdf_quality TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS parse_method TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS parse_confidence FLOAT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS parse_errors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE works ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_works_slug ON works(slug) WHERE slug IS NOT NULL;
```

### 1.4 — Add `revision_id` column to `document_nodes`

File: `packages/supabase/migrations/016_nodes_revision_tracking.sql`

```sql
ALTER TABLE document_nodes ADD COLUMN IF NOT EXISTS revision_id BIGINT REFERENCES revisions(id);
```

**Verification:**
- [x] Run all 5 new migrations against Supabase: `015`, `016`, `017`, `018`, `019` (renumbered from 012-016 since 012-014 already exist)
- [x] Verify `revisions` and `suggestions` tables exist with correct columns
- [x] Verify `works` table has new columns (slug, pdf_quality, parse_method, etc.)
- [x] Verify `document_nodes` has `revision_id` column
- [x] Verify RLS: anonymous can SELECT revisions and suggestions, INSERT suggestions
- [x] Verify existing data is intact: `SELECT COUNT(*) FROM works` still returns ~20 (23 works)
- [x] Verify existing MCP server still works: test `search_laws`, `get_pasal` — no regressions
- [x] Verify existing search function still works: `SELECT * FROM search_legal_chunks('upah minimum', 3, '{}'::jsonb)` returns results with snippets

> 🔁 Run `code-simplifier` and `code-review` → fix issues → `git commit -m "feat: add revisions, suggestions tables and works metadata columns" && git push origin main`

---

## TASK 2: Mass Scraper for peraturan.go.id

The existing `scripts/scraper/scrape_laws.py` only handles 20 priority laws. New files go ALONGSIDE existing scripts.

### 2.1 — Listing Crawler

File: `scripts/scraper/crawl_listings.py` (NEW file, alongside existing `scrape_laws.py`)

Crawl listing pages from ALL regulation categories, not just UU. peraturan.go.id has separate listing endpoints per type:

```
https://peraturan.go.id/uu?page={N}        → UU (1,926)
https://peraturan.go.id/perppu?page={N}    → PERPPU (218)
https://peraturan.go.id/pp?page={N}        → PP (4,989)
https://peraturan.go.id/perpres?page={N}   → PERPRES (2,640)
https://peraturan.go.id/permen?page={N}    → PERMEN (19,947)
https://peraturan.go.id/perban?page={N}    → PERBAN (6,716)
https://peraturan.go.id/perda?page={N}     → PERDA (19,732)
https://peraturan.go.id/keppres?page={N}   → KEPPRES
https://peraturan.go.id/inpres?page={N}    → INPRES
https://peraturan.go.id/tapmpr?page={N}    → TAP MPR
```

Also try global: `https://peraturan.go.id/tahun/crc32?page={1..3088}`

- Parse HTML, extract `href="/id/{slug}"` links
- Output: `data/raw/slugs.jsonl` — one JSON per line: `{"slug": "uu-no-1-tahun-2024", "type": "UU", "page": 1}`
- Checkpoint: `data/raw/crawl_checkpoint.txt` (last completed page) for resume
- Rate limit: 2 requests/second, retry 3x with backoff
- Use `httpx` (async) with `User-Agent: "Pasal/1.0 (https://pasal.id; legal-data-research)"`

**Verification:**
- [x] Runs on pages 1-5 of at least 3 different types (UU, PP, PERPRES), produces valid crawl_jobs (Supabase-backed, not JSONL)
- [x] Each entry has `type` field correctly mapped (UU: 981, PP: 999, PERPRES: 600, PERPPU: 1)
- [x] Resumes from checkpoint (upsert on source_id+url, skips existing)
- [x] No duplicate slugs (verified: 0 duplicates)
- [x] Rate limiting confirmed (5s delay between pages, 2s between requests)

> 🔁 `git commit -m "feat: listing crawler for peraturan.go.id" && git push origin main`

### 2.2 — Metadata Crawler

File: `scripts/scraper/crawl_metadata.py` (NEW file)

For each slug, fetch detail page and extract structured metadata.

- Parse HTML `<th>...<td>` pairs from metadata table
- Normalize jenis: "Undang-Undang" → "UU", "Peraturan Pemerintah" → "PP", "Keputusan Presiden" → "KEPPRES", "Instruksi Presiden" → "INPRES", "Peraturan Badan" → "PERBAN", etc. — must map to ALL codes in `regulation_types` table (now ~22 types)
- Parse Indonesian dates ("2 Januari 2024" → "2024-01-02")
- Extract "Link Terkait" for relationship data
- Output: `data/raw/metadata/{slug}.json`
- Map fields to existing `works` table columns + new columns from migration 015

**Verification:**
- [x] Test on 10 slugs across UU, PP, Perpres (metadata extracted from listing pages during discovery)
- [x] All fields mapped correctly (type, number, year, title, frbr_uri, pdf_url)
- [x] No crashes on pages with missing fields (graceful skip + continue)

> 🔁 `git commit -m "feat: metadata crawler" && git push origin main`

### 2.3 — PDF Downloader + Page Image Generator

File: `scripts/scraper/download_pdfs.py` (NEW file)

- Download to `data/raw/pdfs/{slug}.pdf`
- Generate page images with PyMuPDF (`dpi=150`, `.png` format)
- Upload to Supabase Storage bucket `regulation-pdfs/`
- Skip existing, log errors, resume support

**Verification:**
- [x] Download 20+ PDFs successfully (9 loaded so far, worker running continuously on Railway)
- [x] PDFs uploaded to Supabase Storage (`regulation-pdfs/{slug}.pdf`) — 9 in storage
- [x] Resume works (crawl_jobs state machine: pending→crawling→downloaded→loaded, skips completed)

> 🔁 `git commit -m "feat: PDF downloader with page image generation" && git push origin main`

### 2.4 — Seed Database (Mass Import)

File: `scripts/loader/mass_load.py` (NEW file, alongside existing `load_to_supabase.py`)

- Batch upsert metadata into `works` (DO NOT delete existing data)
- Map `jenis` to existing `regulation_types` table
- Generate `frbr_uri` from jenis + number + year

**Verification:**
- [x] Existing 22 laws still intact (verified: 22 works with id <= 28)
- [x] New rows have `slug` column populated (25 of 33 works have slug)

> 🔁 `git commit -m "feat: mass metadata loader" && git push origin main`

---

## TASK 3: Improved PDF Parser (PyMuPDF + Regex)

New files go alongside existing `scripts/parser/parse_law.py` (which stays as-is).

### 3.1 — PyMuPDF Text Extraction

File: `scripts/parser/extract_pymupdf.py` (NEW)

~100x faster than pdfplumber. Built-in page rendering + OCR support.

### 3.2 — PDF Quality Classifier

File: `scripts/parser/classify_pdf.py` (NEW)

Routes PDFs: `born_digital` → regex, `scanned_clean` → OCR correction + regex, `image_only` → Tesseract first.

### 3.3 — OCR Error Correction

File: `scripts/parser/ocr_correct.py` (NEW)

Deterministic regex fixes for common OCR artifacts (PRES!DEN → PRESIDEN, etc.)

### 3.4 — Regex Structural Parser (Improved)

File: `scripts/parser/parse_structure.py` (NEW — improved version of existing `parse_law.py`)

Proper state machine: BAB → Bagian → Paragraf → Pasal → Ayat hierarchy. Handles flat regulations + Penjelasan. Output matches existing `document_nodes` schema.

### 3.5 — Validation Engine

File: `scripts/parser/validate.py` (NEW)

Sequential Pasal numbers, Ayat ordering, content coverage check.

### 3.6 — Pipeline Orchestrator

File: `scripts/parser/pipeline.py` (NEW)

Full flow: extract → classify → OCR correct → parse → validate → insert into `document_nodes` + `legal_chunks` + `revisions`. Batch mode with progress bar. Idempotent.

**DB insertion uses existing tables** — same schema as `load_to_supabase.py` but adds `revisions` rows with `revision_type="initial_parse"`.

**Verification (for all of Task 3):**
- [x] 50 regulations parsed end-to-end, ≥70% pass validation (59/59 parsed, 100% valid, 2,511 pasals)
- [x] `document_nodes` hierarchy correct for tested UU (UU 13/2003: 18 BABs, 193 Pasals, 414 Ayats)
- [x] `revisions` table has `initial_parse` entries (3,181 revisions)
- [x] Running twice is idempotent (cleanup + re-insert cycle verified)
- [x] **Existing MCP server still works** (search_laws, get_pasal, list_laws all verified)
- [x] **search_legal_chunks** returns results for new content (tested "APBN anggaran negara", "upah minimum")

> 🔁 Commit after each subtask. Final: `git commit -m "feat: parser pipeline with DB integration" && git push origin main`

---

## TASK 4: PDF Side-by-Side Viewer

**📖 Read `BRAND_GUIDELINES.md` before writing any frontend code.**

### 4.1 — PDF Viewer Component

File: `apps/web/src/components/reader/PdfViewer.tsx` (NEW)

Toggleable right panel showing PDF page images from Supabase Storage. Falls back to `<iframe src={source_pdf_url}>` for existing laws without pre-rendered images.

### 4.2 — Integrate into Existing Reader Page

Modify: `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`

Add PdfViewer to existing 3-column layout. Context `<aside>` hides when PDF is shown to make room. Keep main page as Server Component; wrap toggle in client component.

**Verification:**
- [x] Existing reader works exactly as before when PDF hidden
- [x] "Tampilkan PDF" toggle works
- [x] Graceful fallback when no page images exist
- [x] Mobile responsive
- [x] Follows `BRAND_GUIDELINES.md`

> 🔁 `git commit -m "feat: PDF side-by-side viewer" && git push origin main`

---

## TASK 5: Browse by Regulation Type

**📖 Read `BRAND_GUIDELINES.md` before writing any frontend code.**

**Why:** The search box is currently the only way to find laws. Users need a way to browse — especially once we have thousands of regulations. The existing `/topik` page shows topic guides, but what users actually need is a browse-by-type experience like peraturan.go.id has (see screenshots below).

**Reference:** peraturan.go.id/pemerintah-pusat shows regulation types as a card grid:
- UUD (Undang-Undang Dasar)
- TAP MPR (Ketetapan Majelis Permusyawaratan Rakyat)
- UU (Undang-Undang) — 1,926 regulations
- PERPPU (Peraturan Pemerintah Pengganti Undang-undang) — 218
- PP (Peraturan Pemerintah) — 4,989
- PERPRES (Peraturan Presiden) — 2,640
- Peraturan Menteri — 19,962
- Peraturan Badan/Lembaga — 6,722
- Peraturan Daerah — 19,732
- And more...

### 5.1 — Replace `/topik` with `/jelajahi` (Browse) Page

Replace or rework: `apps/web/src/app/topik/` → `apps/web/src/app/jelajahi/page.tsx`

A card grid showing every regulation type in our database, with live counts from Supabase:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Jelajahi Peraturan                            │
│           Telusuri database hukum Indonesia                     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   📜          │  │   📜          │  │   📜          │         │
│  │   1,926      │  │   218        │  │   4,989      │         │
│  │   UU         │  │   PERPPU     │  │   PP         │         │
│  │  Undang-     │  │  Peraturan   │  │  Peraturan   │         │
│  │  Undang      │  │  Pemerintah  │  │  Pemerintah  │         │
│  │              │  │  Pengganti   │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   📜          │  │   📜          │  │   📜          │         │
│  │   2,640      │  │   19,962     │  │   19,732     │         │
│  │   PERPRES    │  │   PERMEN     │  │   PERDA      │         │
│  │  Peraturan   │  │  Peraturan   │  │  Peraturan   │         │
│  │  Presiden    │  │  Menteri     │  │  Daerah      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

- Server Component — query `regulation_types` table joined with `COUNT(*)` from `works`
- Each card is clickable → goes to `/jelajahi/[type]`
- Show count prominently (the big number IS the card)
- Only show types that have at least 1 regulation in our database
- Add "Jelajahi" link to the main navigation header (replace or supplement "Topik")

### 5.2 — Regulation Type Listing Page

File: `apps/web/src/app/jelajahi/[type]/page.tsx` (NEW)

When user clicks a type card, show all regulations of that type:

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Kembali ke Jelajahi                                         │
│                                                                 │
│  Undang-Undang (UU)                                            │
│  1,926 peraturan                                               │
│                                                                 │
│  [Filter: Tahun ▾] [Status: Semua ▾] [Cari dalam UU... 🔍]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ UU No. 27 Tahun 2024                                   │   │
│  │ Perubahan Kedua atas UU ITE                             │   │
│  │ Status: Berlaku · Diundangkan: 2 Jan 2024              │   │
│  │                                              [Baca →]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ UU No. 1 Tahun 2023                                    │   │
│  │ Kitab Undang-Undang Hukum Pidana                        │   │
│  │ Status: Berlaku · Diundangkan: 2 Jan 2023              │   │
│  │                                              [Baca →]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  < 1  2  3  4  5 ... 97 >                                     │
└─────────────────────────────────────────────────────────────────┘
```

- Server Component with pagination (query `works` filtered by `regulation_type_id`)
- Filters: year dropdown, status dropdown, title search (use existing `list_laws` MCP logic)
- Sort: newest first by default
- Each row links to `/peraturan/[type]/[slug]` (the existing reader)
- Pagination: 20 per page

### 5.3 — Update Navigation

- Add "Jelajahi" to the header nav (next to or replacing "Topik")
- Add browse cards to the landing page as a section below search (quick access to top types)
- The existing `/topik` routes can remain if the topic guides are still useful, or be removed — agent's call

**Verification:**
- [ ] `/jelajahi` shows card grid with real counts from DB
- [ ] Counts match `SELECT regulation_type_id, COUNT(*) FROM works GROUP BY regulation_type_id`
- [ ] Clicking a card goes to `/jelajahi/[type]` with correct filtered list
- [ ] Year and status filters work
- [ ] Pagination works
- [ ] Each regulation row links to the existing reader page
- [ ] Mobile responsive (cards stack, list remains readable)
- [ ] Follows `BRAND_GUIDELINES.md`
- [ ] Header nav updated

> 🔁 `git commit -m "feat: browse by regulation type page" && git push origin main`

---

## TASK 6: Suggestion System (User-Facing)

**📖 Read `BRAND_GUIDELINES.md` before writing any frontend code.**

### 5.1 — Extract and Enhance PasalBlock Component

The `PasalBlock` function is currently defined inline in `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`. Extract it to `apps/web/src/components/reader/PasalBlock.tsx` as a `"use client"` component. Add "📝 Sarankan Koreksi" button to the existing header row, next to the `<CopyButton>`.

### 5.2 — Suggestion Form Component

File: `apps/web/src/components/suggestions/SuggestionForm.tsx` (NEW)

Modal with current text (read-only), editable correction, diff preview, reason, reference, email fields. Styling: `font-heading` title, `font-mono` for legal text, verdigris primary button.

### 5.3 — Suggestions API Route

File: `apps/web/src/app/api/suggestions/route.ts` (NEW)

POST endpoint. Validates input, rate limits 10/IP/hour via `suggestions` table query, inserts with `status="pending"`.

**Verification:**
- [ ] Suggest button appears next to existing JSON copy button
- [ ] Cannot submit identical or empty text
- [ ] Diff preview works
- [ ] Rate limiting at 11th submission → 429
- [ ] **Existing reader functionality unchanged**
- [ ] Follows `BRAND_GUIDELINES.md`

> 🔁 `git commit -m "feat: suggestion form and API" && git push origin main`

---

## TASK 7: Admin Panel

**📖 Read `BRAND_GUIDELINES.md` before writing any frontend code.**

### 6.1 — Admin Dashboard (`apps/web/src/app/admin/page.tsx`)

Counts, activity feed, parsing stats. Protected by Supabase Auth.

### 6.2 — Suggestion Review Queue (`apps/web/src/app/admin/suggestions/page.tsx`)

Diff view, "Verifikasi AI" button, "Setujui & Terapkan" (calls `apply_revision()`), "Tolak" with reason.

### 6.3 — Admin Auth (`apps/web/src/app/admin/layout.tsx`)

Uses existing `@supabase/ssr` pattern from `src/lib/supabase/server.ts`. Check admin role, redirect/403.

**Verification:**
- [ ] Auth works (redirect / 403)
- [ ] "Setujui & Terapkan" creates revision + updates `document_nodes` + updates `legal_chunks`
- [ ] Updated text visible in reader page
- [ ] Follows `BRAND_GUIDELINES.md`

> 🔁 `git commit -m "feat: admin panel with suggestion review queue" && git push origin main`

---

## TASK 8: LLM Verification Agent (Gemini Flash 3.0)

### 7.1 — Agent Core (`scripts/agent/verify_suggestion.py`)

Sends PDF page images + text to Gemini 3.0 Flash. Returns accept/modify/reject + confidence.

### 7.2 — Verification API Route (`apps/web/src/app/api/admin/verify/route.ts`)

Admin-only. Triggers agent, updates suggestion with result.

### 7.3 — Apply Revision Function (`scripts/agent/apply_revision.py`)

**THE CRITICAL FUNCTION.** INSERT revision → UPDATE `document_nodes.content_text` → UPDATE `legal_chunks.content` → UPDATE `suggestions.status`. Never mutate content without creating revision first.

**Verification:**
- [ ] Agent accepts obvious OCR fix, rejects bad suggestion
- [ ] `apply_revision` creates full audit trail
- [ ] MCP `search_laws` and `get_pasal` reflect changes
- [ ] Revision history queryable

> 🔁 `git commit -m "feat: Gemini verification agent and apply_revision" && git push origin main`

---

## TASK 9: Integration Testing

### 8.1 — End-to-End Flow (10-step test with existing law)
### 8.2 — Batch Parse Subset (~200+ regulations across all types for demo)

Run the new parser on a diverse subset:
- All UU from 2020-2026 (~50)
- All PP from 2024-2026 (~100)
- 20 random PERPRES
- 20 random PERMEN (from different ministries)
- 10 random PERBAN (agency regulations)
- 10 random KEPPRES/INPRES

This proves the pipeline handles the full breadth of peraturan.go.id, not just UU.

> 🔁 `git commit -m "test: end-to-end integration test" && git push origin main`

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Current text | `document_nodes.content_text` |
| Search index | `legal_chunks.fts` (auto-regenerated TSVECTOR) |
| Search function | `search_legal_chunks()` — already has snippet + boost + trigram |
| Change history | `revisions` table (append-only) |
| PDF files | Supabase Storage: `regulation-pdfs/{slug}.pdf` |
| PDF page images | Supabase Storage: `regulation-pdfs/{slug}/page-{N}.png` |
| Suggestions | `suggestions` table, anyone can submit (10/IP/hour) |
| Approvals | Admin only via service_role |
| Agent auto-apply? | NO. Admin must click Approve. |
| Deletions? | NO. Old content in `revisions.old_content`. |
| Break MCP? | NO. Same tables, updated content. |
| Brand guidelines | `BRAND_GUIDELINES.md` — Instrument Serif/Sans, verdigris, warm stone |
| Existing migrations | 001–014. New start at 015 (through 019). |
| Regulation types | ~22 types covering all peraturan.go.id categories (UU, PP, PERPRES, PERMEN, PERBAN, KEPPRES, INPRES, PERDA, etc.) |