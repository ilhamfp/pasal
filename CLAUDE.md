# CLAUDE.md

## Project

Pasal.id — The first open, AI-native Indonesian legal platform. An MCP server + web app that gives Claude grounded access to Indonesian legislation.

**This is a hackathon project. Deadline: Monday Feb 16, 3:00 PM EST. Ship fast, cut scope aggressively, never gold-plate.**

### Current Status (What's Deployed)

| Layer | Key Files | Status |
|-------|-----------|--------|
| Database | `works`, `document_nodes`, `legal_chunks`, `work_relationships`, `regulation_types`, `relationship_types` | 11 migrations (001–011) |
| Search | `search_legal_chunks()` — 3-tier fallback (websearch → plainto → ILIKE), `ts_headline` snippets, hierarchy + recency boosting, trigram index | Working |
| MCP Server | `apps/mcp-server/server.py` — `search_laws`, `get_pasal`, `get_law_status`, `list_laws`, `ping` + rate limiter + cross-reference extraction | Deployed on Railway |
| Frontend | `apps/web/` — landing page, `/search`, `/peraturan/[type]/[slug]` reader (3-column: TOC / content / context), `/connect`, `/topik`, `/api/v1/` REST API | Deployed on Vercel |
| Scripts | `scripts/scraper/scrape_laws.py`, `scripts/parser/parse_law.py`, `scripts/loader/load_to_supabase.py` | Working pipeline (~20 laws) |
| Brand | `BRAND_GUIDELINES.md` — Instrument Serif + Instrument Sans, verdigris (#2B6150), warm stone (#F8F5F0) | **Must follow** |

### What We're Adding (Upgrade Tasks)

1. **Mass scraper** — go from 20 → 62,000 regulations via peraturan.go.id
2. **Improved PDF parser** — PyMuPDF replacing pdfplumber, with quality classification and OCR correction
3. **Crowd-sourced corrections** — users suggest fixes, admins review, Gemini Flash verifies
4. **Append-only revision tracking** — every content mutation audited via `revisions` table
5. **PDF side-by-side viewer** — pre-rendered page images from Supabase Storage
6. **Admin panel** — `/admin` with dashboard, suggestion review queue, AI verification

**Existing codebase MUST NOT break.** All new code goes alongside existing files. Same tables, updated content.

## How to Work

### Workflow loop

1. Open `TASKS-UPGRADE.md` and find your current task (the first unchecked one).
2. Implement the task completely.
3. Verify the "Done when" condition passes.
4. `git add -A && git commit -m "task X.Y: description" && git push origin main`
5. Move to the next task.

**Also commit + push mid-task** whenever you have a meaningful working increment (e.g., a migration that runs, a component that renders). Don't wait until the whole task is done.

### Rules

- **Do NOT skip tasks or jump ahead.** Tasks are ordered by dependency.
- **Do NOT get stuck longer than 20 minutes on any sub-problem.** If scraping doesn't work, use hardcoded seed data. If parsing fails on edge cases, skip those documents. Forward progress > perfection.
- **Do NOT over-engineer.** This is a hackathon MVP. No abstractions "for later," no premature optimization, no complex error recovery.
- **Before writing any frontend code, consult `BRAND_GUIDELINES.md`** for colors, fonts, spacing, and component patterns. It is the single source of truth for visual identity.
- **When in doubt, check TASKS-.md Appendix** — it tells you exactly what to cut if behind schedule.

## Tech Stack

| Layer | Technology | Key Details |
|-------|-----------|-------------|
| Frontend | Next.js 16+ (App Router) | TypeScript, Tailwind CSS, shadcn/ui, deployed on Vercel |
| Database | Supabase (PostgreSQL) | Full-text search with `indonesian` stemmer, RLS enabled |
| MCP Server | Python + FastMCP | Streamable HTTP transport, deployed on Railway/Fly.io |
| Scraper/Pipeline | Python | httpx, BeautifulSoup, pdfplumber (legacy), PyMuPDF (new parsing) |
| Verification Agent | Python + Gemini Flash 2.0 | `google-generativeai`, advisory only — admin must approve |
| Search | PostgreSQL FTS | `tsvector` + `websearch_to_tsquery('indonesian', ...)`. Vector search is a post-MVP upgrade. |
| Auth | Supabase Auth (via `@supabase/ssr`) | Public read, no auth required for legal data |

## Visual Identity

**`BRAND_GUIDELINES.md` is the single source of truth for all visual decisions.** Read it before writing any frontend code.

**Quick reference:**
- **Primary color:** #2B6150 verdigris (aged copper patina) — the ONE accent color
- **Surface:** #F8F5F0 warm stone — page background, NOT pure white
- **Cards:** #FFFFFF pure white — lifts off warm stone background
- **Heading font:** Instrument Serif (`font-heading`) — weight 400 only, hierarchy through size
- **Body/UI font:** Instrument Sans (`font-sans`) — weights 400–700
- **Code font:** JetBrains Mono (`font-mono`)
- **Default radius:** `rounded-lg` (8px)
- **Neutrals:** Warm graphite ("Batu Candi") — never cool gray/slate

**ALL frontend work must follow BRAND_GUIDELINES.md — no exceptions.**

## Project Structure

```
pasal-id/
├── CLAUDE.md              ← You are here
├── TASKS-UPGRADE.md               ← Your task list (work through sequentially)
├── BRAND_GUIDELINES.md    ← Visual identity reference (colors, fonts, components)
├── apps/
│   ├── web/               ← Next.js frontend
│   │   ├── src/
│   │   │   ├── app/       ← App Router pages
│   │   │   ├── components/
│   │   │   └── lib/
│   │   │       └── supabase/  ← server.ts + client.ts
│   │   └── .env.local
│   └── mcp-server/        ← Python FastMCP server
│       ├── server.py
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── supabase/
│       └── migrations/    ← SQL migration files
├── scripts/
│   ├── scraper/           ← Data acquisition
│   │   ├── scrape_laws.py          ← EXISTING — 20 priority laws
│   │   ├── crawl_listings.py       ← NEW — mass listing crawler (peraturan.go.id)
│   │   ├── crawl_metadata.py       ← NEW — metadata extractor per slug
│   │   └── download_pdfs.py        ← NEW — PDF download + page image generation
│   ├── parser/            ← PDF → structured JSON
│   │   ├── parse_law.py            ← EXISTING — pdfplumber-based (keep for reference)
│   │   ├── extract_pymupdf.py      ← NEW — PyMuPDF text extraction (~100x faster)
│   │   ├── classify_pdf.py         ← NEW — quality classifier (born_digital/scanned/image)
│   │   ├── ocr_correct.py          ← NEW — deterministic OCR error fixes
│   │   ├── parse_structure.py      ← NEW — regex state machine (BAB→Pasal→Ayat)
│   │   ├── validate.py             ← NEW — sequential numbering + coverage checks
│   │   └── pipeline.py             ← NEW — orchestrator: extract→classify→parse→validate→insert
│   ├── loader/            ← DB import
│   │   ├── load_to_supabase.py     ← EXISTING — loads ~20 parsed laws
│   │   └── mass_load.py            ← NEW — batch upsert metadata into works
│   └── agent/             ← Gemini verification agent
│       ├── verify_suggestion.py    ← NEW — sends PDF images + text to Gemini Flash 2.0
│       └── apply_revision.py       ← NEW — THE critical function (see SQL conventions)
└── data/                  ← gitignored, local only
    ├── raw/
    └── parsed/
```

## Coding Conventions

### TypeScript (Next.js)

- Use Server Components by default. Only add `"use client"` when you need interactivity (onClick, useState, useEffect).
- Use `@supabase/ssr` — NOT `@supabase/auth-helpers` (deprecated).
- Use `supabase.auth.getUser()` on server, never trust `getSession()` in Server Components.
- File naming: `kebab-case.tsx` for pages/routes, `PascalCase.tsx` for components.
- Prefer `async function` Server Components over client-side `useEffect` data fetching.
- Use Tailwind utility classes. No CSS modules, no styled-components.
- All UI text that users see should be in **Indonesian** with English as secondary. Legal content is always in Indonesian.
- Use `font-heading` (Instrument Serif) for all headings (H1–H4, display text, card titles). Weight 400 only — hierarchy through size, not boldness.
- Use `font-sans` (Instrument Sans) for body text, UI elements, buttons, navigation, labels.
- Use `font-mono` (JetBrains Mono) for code blocks, MCP commands, article numbers.
- Use Instrument Serif italic for editorial emphasis — hero secondary text, legal Latin terms, pull quotes.
- Page background is `bg-background` (#F8F5F0 warm stone), NOT pure white. Cards use `bg-card` (pure white) to create lift.
- Use `bg-primary` (#2B6150 verdigris) for ALL interactive elements — buttons, links, focus rings. There is only ONE accent color.
- Use `bg-destructive` (#C53030 cool red) for error/destructive states. Never use the brand green for errors.
- Default border radius is `rounded-lg` (8px). Use borders for depth, avoid shadows except on popovers.
- Never use cool gray/slate. Always warm graphite neutrals.
- Never add a second accent color. The restraint is the brand.

### Python (MCP Server + Scripts)

- Python 3.12+. Type hints on all function signatures.
- Use `async/await` with `httpx` for HTTP calls — not `requests`.
- Use `pydantic` for data validation in the MCP server.
- Use `supabase-py` client for database access.
- Scripts go in `scripts/`, server code in `apps/mcp-server/`.
- No classes unless genuinely needed. Prefer functions.
- Use `pymupdf` (PyMuPDF) for new PDF text extraction and page image rendering — ~100x faster than pdfplumber. The existing pdfplumber-based parser (`scripts/parser/parse_law.py`) remains for reference but new parsing uses PyMuPDF in new files alongside it.
- Use `from google import genai` (Gemini Flash 3.0. Model key: `emini-3-flash-preview`) for the verification agent in `scripts/agent/`. The agent is advisory only — admin must click Approve.

### SQL (Supabase Migrations)

- Save each migration as `packages/supabase/migrations/001_description.sql`, `002_description.sql`, etc.
- Existing migrations are **001–011**. New migrations start at **012**.
- Always include indexes for columns used in WHERE/JOIN/ORDER BY.
- Always enable RLS on new tables. Legal data tables get public read policy.
- Use `GENERATED ALWAYS AS` for computed columns (like `fts` tsvector).
- **Append-only revision rule:** Every mutation to `document_nodes.content_text` MUST go through `apply_revision()` which creates a `revisions` row FIRST. Never UPDATE `content_text` directly. The `revisions` table is append-only — never UPDATE or DELETE rows in it.

#### `apply_revision()` — The Critical Function

This is the ONLY way to mutate `document_nodes.content_text`. Located in `scripts/agent/apply_revision.py`. Steps in order:

1. **INSERT** into `revisions` — `old_content` (current text), `new_content`, `revision_type`, `reason`, `suggestion_id` (if from suggestion)
2. **UPDATE** `document_nodes.content_text` — set to `new_content`, set `revision_id` to the new revision's ID
3. **UPDATE** `legal_chunks.content` — regenerate the search-indexed chunk for this node
4. **UPDATE** `suggestions.status` — if triggered by a suggestion, set to `'approved'` and link `revision_id`

If any step fails, the entire operation must roll back. Never skip step 1.

#### `search_legal_chunks()` — Existing Search Function

3-tier fallback search already in the database (DO NOT modify):
1. `websearch_to_tsquery('indonesian', query)` — handles quoted phrases and operators
2. Falls back to `plainto_tsquery('indonesian', query)` — if websearch fails
3. Falls back to `ILIKE '%' || query || '%'` — last resort for very short or unusual queries

Returns: matching chunks with `ts_headline` snippets, boosted by hierarchy level and recency. Trigram index supports fuzzy matching.

### Git — Commit Early, Commit Often, Push Always

**Commit frequency:** Commit after EVERY meaningful change, not just after completing a full task. This includes:
- After scaffolding each directory or file
- After each migration runs successfully
- After each script works for the first time
- After each component renders correctly
- After each bug fix

**Commit message format:** `task [X.Y]: [lowercase brief description]`
Examples:
- `task 0.1: initialize monorepo structure`
- `task 1.2: add works and document_nodes tables`
- `task 1.2: add legal_chunks table and search function`
- `task 2.2: parser handles bab and pasal extraction`
- `task 4.1: landing page with search bar`

**Push after every commit:**
```bash
git add -A && git commit -m "task X.Y: description" && git push origin main
```
Always push immediately. Do not batch commits locally. We need to track progress remotely.

**Rules:**
- Never commit `.env*` files, `data/raw/`, `data/parsed/`, `node_modules/`, `.next/`, `__pycache__/`.
- Push to `main` branch directly (hackathon, no PRs needed).
- If `git push` fails due to remote changes, do `git pull --rebase origin main` first.
- If you set up the GitHub repo, make sure it's **public** (hackathon requires open source).
- **GitHub repo:** `ilhamfp/pasal` → Remote: `git@github.com:ilhamfp/pasal.git`

## Key Domain Concepts

These Indonesian legal terms appear throughout the codebase:

| Term | English | What It Is |
|------|---------|------------|
| Undang-Undang (UU) | Law | Primary legislation passed by parliament |
| Peraturan Pemerintah (PP) | Government Regulation | Implementing regulation for a UU |
| Peraturan Presiden (Perpres) | Presidential Regulation | Executive regulation |
| Pasal | Article | Individual article within a law (the primary search unit) |
| Ayat | Sub-article/Verse | Numbered paragraph within a Pasal: (1), (2), (3) |
| BAB | Chapter | Top-level grouping: BAB I, BAB II (Roman numerals) |
| Bagian | Section | Sub-grouping within a BAB |
| Penjelasan | Elucidation | Official explanation published alongside the law |
| Berlaku | In force | Law is currently active |
| Dicabut | Revoked | Law has been revoked entirely |
| Diubah | Amended | Law has been partially changed |
| Lembaran Negara (LN) | State Gazette | Official publication for laws |
| FRBR URI | — | Unique identifier: `/akn/id/act/uu/2003/13` |

## Database Tables

### Existing tables (migrations 001–011, UNCHANGED)
- `regulation_types` — 11 types (UU, PP, Perpres, etc.)
- `relationship_types` — relationship categories between regulations
- `works` — individual regulations (laws, PP, Perpres, etc.)
- `document_nodes` — hierarchical document structure (BAB → Bagian → Pasal → Ayat)
- `legal_chunks` — search-indexed text chunks with `fts TSVECTOR` column
- `work_relationships` — cross-references between works

### New columns on existing tables (migrations 014–015)
- `works` gains: `slug`, `pemrakarsa`, `tempat_penetapan`, `tanggal_penetapan`, `pejabat_penetap`, `tanggal_pengundangan`, `pejabat_pengundangan`, `nomor_pengundangan`, `nomor_tambahan`, `pdf_quality`, `parse_method`, `parse_confidence`, `parse_errors`, `parsed_at`
- `document_nodes` gains: `revision_id` (FK to `revisions`)

### New tables (migrations 012–013)
- `revisions` — **append-only** change log for `document_nodes.content_text`. Every content mutation creates a revision row FIRST via `apply_revision()`. Never UPDATE or DELETE rows in this table. Key columns: `work_id`, `node_id`, `old_content`, `new_content`, `revision_type` (`initial_parse` | `suggestion_approved` | `admin_edit`), `reason`, `suggestion_id` (FK to suggestions), `actor_type` (`system` | `admin` | `agent`).
- `suggestions` — crowd-sourced corrections. Anyone can submit (rate limited 10/IP/hour via `suggestions` table query on `submitter_ip`). Only admins can approve. The Gemini verification agent is advisory only — admin must click Approve. Key columns: `work_id`, `node_id`, `current_content`, `suggested_content`, `status` (`pending` | `approved` | `rejected`), `agent_*` fields for Gemini results, `revision_id` (FK to revisions, set on approval).

### PDF Storage & Quality Pipeline
- Original PDFs stored in Supabase Storage as `regulation-pdfs/{slug}.pdf`.
- PDF page images pre-rendered with PyMuPDF (dpi=150, .webp format) and stored as `regulation-pdfs/{slug}/page-{N}.webp`.
- **Quality classification** routes each PDF through the right parser:
  - `born_digital` → direct text extraction + regex structural parser
  - `scanned_clean` → OCR correction + regex structural parser
  - `image_only` → Tesseract OCR first, then regex parser
- Quality is recorded in `works.pdf_quality`. Parse method in `works.parse_method`.

### Admin Panel
- `/admin` routes are protected by Supabase Auth with admin role check, using the existing `@supabase/ssr` pattern from `src/lib/supabase/server.ts`.
- Admin dashboard: counts, activity feed, parsing stats.
- Suggestion review queue: diff view, "Verifikasi AI" (triggers Gemini agent), "Setujui & Terapkan" (calls `apply_revision()`), "Tolak" with reason.

## Brand & Visual Design

**All frontend work MUST follow the brand guidelines defined in `BRAND_GUIDELINES.md` in the project root.**

Before creating or modifying any frontend component, page, or visual element:
1. Read `BRAND_GUIDELINES.md` for the color system, typography, spacing, and component patterns.
2. Use the defined color variables (CSS custom properties) — never hardcode hex colors.
3. Follow the "Batu Candi" design philosophy — stone-walled museum gallery with excellent lighting. Restraint is the brand.
4. The primary color is Verdigris (#2B6150). Neutrals are warm graphite ("Batu Candi").
5. Typography: Instrument Serif for headings, Instrument Sans for body/UI.
6. All user-facing text should be in **Bahasa Indonesia** as primary, English as secondary.
7. Show verification badges on all legal content (see Task 1 schema).

When in doubt, reference `BRAND_GUIDELINES.md` — it is the single source of truth for visual decisions.

## Common Pitfalls to Avoid

1. **Don't try to scrape 278,000 regulations.** Start with the 20 priority laws. The OTF corpus (5,817 docs) is your fallback data source.

2. **Don't build a custom PDF parser from scratch.** Use `pdfplumber` for text extraction, fall back to the OTF pre-processed text segments if PDFs are problematic. Skip scanned/image PDFs entirely.

3. **Don't try to add vector/semantic search during MVP.** The MVP uses PostgreSQL full-text search with the `indonesian` stemmer — it's fast, free, and handles legal terminology well. Vector search (pgvector + embeddings) is a post-MVP upgrade.

4. **Don't build the chat interface (Task 4.5) unless all other tasks are done.** It's explicitly marked as BONUS. The demo should primarily use Claude Desktop / Claude Code + MCP.

5. **Don't let the frontend block the MCP server.** The MCP server is the core deliverable. If time is short, the MCP tools working in Claude are more impressive to judges than a polished website.

6. **Don't use `pages/` router.** This project uses Next.js App Router exclusively (`app/` directory).

7. **Don't add vector/embedding columns.** The MVP has no embedding columns anywhere. `legal_chunks` has a `fts TSVECTOR` column for keyword search — that's all you need. If you see references to `VECTOR(1536)` or pgvector, ignore them — those are for the post-MVP upgrade.

8. **Don't forget RLS policies.** Supabase queries will return empty results if RLS is enabled but no policy exists. Always add a public read policy for legal data tables.

9. **Don't ignore BRAND_GUIDELINES.md.** Every frontend component must use the defined color system and typography. No arbitrary colors, no generic shadcn defaults without brand customization.

10. **Always update TASKS-UPGRADE.md checkboxes** when completing a task. Check off the "DONE WHEN" items and the plugin checkboxes as you go.

11. **Don't use violet/purple/indigo/blue as accent colors.** We use verdigris (#2B6150) only. One accent color, no exceptions.

12. **Don't use Plus Jakarta Sans or Inter.** We use Instrument Serif (headings) and Instrument Sans (body/UI). They are from the same type family by Rodrigo Fuenzalida.

13. **Don't use cool grays (slate, zinc, gray).** Use warm graphite neutrals from BRAND_GUIDELINES.md. The neutrals have a subtle yellow-brown warmth (hue 38–60°).

14. **Don't use heavy box-shadows.** This is a stone-and-light aesthetic. Use borders for depth. Only `shadow-sm` on popovers/dropdowns.

15. **Don't use bold weight on Instrument Serif.** It only has weight 400. Heading hierarchy is through size, not boldness.

16. **Don't make the interface colorful.** If reaching for a second color, reconsider. The near-monochrome warm graphite palette with one verdigris accent IS the brand.

17. **Don't UPDATE `document_nodes.content_text` directly.** Always go through `apply_revision()` to maintain the audit trail in the `revisions` table. The revision row must be created FIRST, then the content is updated. The `revisions` table is append-only — never UPDATE or DELETE rows in it.

18. **Don't confuse existing and new parser files.** The existing `scripts/parser/parse_law.py` (pdfplumber-based) stays as-is for reference. New parsing uses PyMuPDF in separate files (`extract_pymupdf.py`, `parse_structure.py`, `pipeline.py`, etc.) in the same `scripts/parser/` directory.

## Environment Variables

**All keys are stored in the root `.env` file.** Your first task when setting up each sub-project is to create local env files by copying the relevant vars from the root `.env`.

### Root `.env` (already exists, DO NOT commit)
Contains: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

### Create `apps/web/.env.local` (Next.js requires this in its own directory)
```bash
# Copy from root .env:
NEXT_PUBLIC_SUPABASE_URL=     # from root .env → NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # from root .env → NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY=             # from root .env → ANTHROPIC_API_KEY (optional, for chat)
GEMINI_API_KEY=                # from root .env → GEMINI_API_KEY (optional, for admin verification)
NEXT_PUBLIC_SITE_URL=https://pasal.id
```

### Create `apps/mcp-server/.env`
```bash
SUPABASE_URL=                  # from root .env → SUPABASE_URL
SUPABASE_KEY=                  # from root .env → SUPABASE_SERVICE_ROLE_KEY
PORT=8000
HOST=0.0.0.0
```

### Create `scripts/.env`
```bash
SUPABASE_URL=                  # from root .env → SUPABASE_URL
SUPABASE_KEY=                  # from root .env → SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY=                # from root .env → GEMINI_API_KEY (for verification agent)
```

**Important:** The MCP server and scripts use `SUPABASE_KEY` which maps to the root `.env`'s `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses RLS — never expose it to the browser.

## Testing Quick Checks

After completing a phase, verify:

- **After Phase 1 (DB):** `SELECT COUNT(*) FROM regulation_types;` returns 11. `search_legal_chunks` function exists: `SELECT proname FROM pg_proc WHERE proname = 'search_legal_chunks';`
- **After Phase 2 (Data):** `SELECT COUNT(*) FROM works;` returns ≥20. `SELECT COUNT(*) FROM legal_chunks;` returns ≥500.
- **After Phase 3 (MCP):** `python server.py` starts. `search_laws("ketenagakerjaan")` returns results. `get_pasal("UU", "13", 2003, "1")` returns article text.
- **After Phase 4 (Frontend):** `npm run build` succeeds. Homepage loads. Search returns results. Law detail page renders with TOC.
- **After Upgrade Task 1 (New Tables):** `revisions` and `suggestions` tables exist. `works` has `slug` column. Existing data intact (`SELECT COUNT(*) FROM works` still ≥20). Existing MCP and search still work.
- **After Upgrade Task 3 (Parser):** 50+ regulations parsed. `document_nodes` has new entries. `revisions` has `initial_parse` entries. `search_legal_chunks` returns results for new content.
- **After Upgrade Task 5 (Suggestions):** Suggest button appears on Pasal blocks. Submission rate limited at 10/IP/hour. Existing reader functionality unchanged.
- **After Upgrade Task 6 (Admin):** `/admin` requires auth. "Setujui & Terapkan" creates revision + updates content. Updated text visible in reader.

## Quick Reference

| Question | Answer |
|----------|--------|
| Where is the current text? | `document_nodes.content_text` |
| Where is the search index? | `legal_chunks.fts` (auto-regenerated TSVECTOR) |
| What search function to use? | `search_legal_chunks()` — 3-tier fallback, already has snippets + boost + trigram |
| Where is the change history? | `revisions` table (append-only, never UPDATE/DELETE) |
| How to change content? | `apply_revision()` ONLY — never UPDATE `content_text` directly |
| Where are PDF files? | Supabase Storage: `regulation-pdfs/{slug}.pdf` |
| Where are PDF page images? | Supabase Storage: `regulation-pdfs/{slug}/page-{N}.webp` |
| How do suggestions work? | `suggestions` table, anyone can submit (10/IP/hour rate limit) |
| Who approves suggestions? | Admin only, via service_role key. Gemini agent is advisory only. |
| Does the agent auto-apply? | **NO.** Admin must click "Setujui & Terapkan" (Approve & Apply). |
| Can content be deleted? | **NO.** Old content preserved in `revisions.old_content`. |
| Will upgrades break MCP? | **NO.** Same tables, same search function, updated content. |
| What's the brand reference? | `BRAND_GUIDELINES.md` — Instrument Serif/Sans, verdigris, warm stone |
| Existing migrations? | 001–011. New ones start at 012. |