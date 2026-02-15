# CLAUDE.md

Pasal.id — Open, AI-native Indonesian legal platform. MCP server + web app giving Claude grounded access to Indonesian legislation.

**Repo:** `ilhamfp/pasal` | **Live:** https://pasal.id | **MCP:** Deployed on Railway

## Architecture

Monorepo with three main pieces:

| Component | Path | Tech |
|-----------|------|------|
| Web app | `apps/web/` | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui |
| MCP server | `apps/mcp-server/` | Python 3.12+, FastMCP, supabase-py |
| Data pipeline | `scripts/` | Python — crawler, parser (PyMuPDF), loader, Gemini verification agent |
| Database | `packages/supabase/migrations/` | Supabase (PostgreSQL), 39 migrations (001–039, two 030s) |

### Key directories

```
apps/web/src/app/[locale]/     — Public pages under locale segment (/, /search, /jelajahi, /peraturan/[type]/[slug])
apps/web/src/app/admin/        — Admin pages (NOT under [locale], Indonesian only)
apps/web/src/components/       — React components (PascalCase.tsx)
apps/web/src/lib/              — Utilities, Supabase clients (server.ts, client.ts, service.ts)
apps/web/src/i18n/             — i18n config (routing.ts, request.ts)
apps/web/messages/             — Translation files (id.json, en.json)
apps/mcp-server/server.py      — MCP tools: search_laws, get_pasal, get_law_status, list_laws
server.json                    — MCP server registry manifest (name, tools, URL)
scripts/crawler/               — Mass scraper for peraturan.go.id
scripts/parser/                — PDF parsing pipeline (PyMuPDF-based)
scripts/agent/                 — Gemini verification agent + apply_revision()
scripts/loader/                — DB import scripts
packages/supabase/migrations/  — All SQL migrations (001–039)
```

## Commands

```bash
# Web (from apps/web/)
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest

# MCP server (from apps/mcp-server/)
python server.py     # Start MCP server (needs SUPABASE_URL + SUPABASE_KEY)

# Scraper worker (from project root)
python -m scripts.worker.run  # Background job processor
```

Migrations are applied directly to Supabase via the SQL editor or `supabase db push` — they are not run locally.

## Database Schema

Core tables — all have RLS enabled with public read policies for legal data:

| Table | Purpose |
|-------|---------|
| `works` | Individual regulations (UU, PP, Perpres, etc.). Has `slug`, metadata, parse quality fields. `search_text` maintained by trigger `trg_works_search_text`, `search_fts` TSVECTOR GENERATED ALWAYS from it |
| `document_nodes` | Hierarchical document structure: BAB > Bagian > Pasal > Ayat. Content in `content_text`, `fts` TSVECTOR column auto-generated for search |
| `revisions` | **Append-only** audit log for content changes. Never UPDATE or DELETE rows |
| `suggestions` | Crowd-sourced corrections. Anyone submits, admin approves |
| `work_relationships` | Cross-references between regulations |
| `regulation_types` | ~22 regulation types (UU, PP, PERPRES, UUD, PERPPU, PERMEN, PERDA, etc.) |
| `crawl_jobs` | Scraper job queue and state tracking |
| `scraper_runs` | Scraper session tracking (jobs discovered/processed/failed) |
| `discovery_progress` | Crawl freshness cache per regulation type |

### Critical invariant: content mutations

**Never UPDATE `document_nodes.content_text` directly.** All mutations go through `apply_revision()` (SQL function in migration 020, updated in 038; Python wrapper in `scripts/agent/apply_revision.py`):

1. INSERT into `revisions` (old + new content, reason, actor)
2. UPDATE `document_nodes.content_text` (the `fts` TSVECTOR column auto-updates via `GENERATED ALWAYS`)
3. UPDATE `suggestions.status` if triggered by a suggestion

All steps run in a single transaction. If any fails, everything rolls back.

### Search: `search_legal_chunks()`

3-layer search (migration 039, perf-optimized in 043). Layer 1: **Identity fast path** — detects regulation identifiers (e.g. "uu 10 2011", "uud 1945") via code/name_id match + number extraction, returns deterministic score 1000. **Early exit** — if identity match found, skips Layers 2-3. Handles codes, two-word codes (TAP_MPR), aliases (PERPU→PERPPU), and full name_id prefixes ("Undang-Undang Nomor 10"). Input sanitized (`[^a-zA-Z0-9 ]` → space) to prevent tsquery crashes. Layer 2: **Works FTS** — searches `works.search_fts` for title/topic queries ("ketenagakerjaan"), score ~1-15. Early exit if enough results. Layer 3: **Content FTS** — 3-tier fallback on `document_nodes.fts` (`websearch_to_tsquery` > `plainto_tsquery` > `ILIKE`), score ~0.01-0.5. Uses **CTE pattern**: candidates (capped at 500) → rank → ts_headline only on top N results (avoids O(N) snippet generation). Tier 3 ILIKE capped at 200 candidates. Results accumulate via `RETURN QUERY`; client `groupChunksByWork()` deduplicates by work_id keeping highest score. The function name is intentionally preserved — 5 consumers call it via `.rpc("search_legal_chunks")`.

## Coding Conventions

### TypeScript / Next.js

- **Server Components by default.** Only `"use client"` for interactivity.
- **Supabase access:** `@supabase/ssr` (not deprecated auth-helpers). Use `getUser()` on server, never trust `getSession()`.
- **File naming:** `kebab-case.tsx` for routes, `PascalCase.tsx` for components.
- **Styling:** Tailwind utility classes only. No CSS modules or styled-components.
- **UI language:** Indonesian primary, English secondary. Legal content always Indonesian.
- **Admin auth:** `requireAdmin()` from `src/lib/admin-auth.ts` — checks Supabase auth + `ADMIN_EMAILS` env var.

### i18n

Uses `next-intl` with `localePrefix: 'as-needed'`. Indonesian (default) has no URL prefix. English uses `/en` prefix.

- **Config:** `src/i18n/routing.ts`, `src/i18n/request.ts`
- **Messages:** `messages/id.json` (source of truth), `messages/en.json`
- **Middleware:** `src/middleware.ts` (excludes `/api`, `/admin`, static files)
- **Type safety:** `global.d.ts` augments `next-intl` with message types from `id.json`
- **Navigation:** Use `Link`, `useRouter`, `usePathname` from `@/i18n/routing` (not `next/link`)
- **Server Components:** Use `getTranslations` from `next-intl/server` with `await` for async components, `useTranslations` for sync
- **Client Components:** Use `useTranslations` from `next-intl`
- **setRequestLocale:** Required at the top of every Server Component page: `setRequestLocale(locale as Locale)`
- **Legal content:** Stays in Indonesian regardless of UI locale — only UI chrome is translated
- **TYPE_LABELS:** Remain in Indonesian (official legal nomenclature, not UI strings)
- **Admin pages:** NOT internationalized — excluded from middleware matcher
- **CRITICAL:** Async Server Components (`async function`) MUST use `getTranslations` with `await`, never `useTranslations` (causes "Expected a suspended thenable" error)
- **STATUS_LABELS deprecated:** Use `statusT(work.status as "berlaku" | "diubah" | "dicabut" | "tidak_berlaku")` instead

### Python

- Python 3.12+. Type hints on all function signatures.
- `httpx` with async/await for HTTP (not `requests`).
- Prefer functions over classes.
- PDF extraction: `pymupdf` (PyMuPDF). Legacy `parse_law.py` uses pdfplumber — kept for reference.
- Gemini agent: `from google import genai`, model `gemini-3-flash-preview`. Advisory only — admin must approve.

### SQL migrations

- Numbered sequentially: `packages/supabase/migrations/NNN_description.sql` (next: 044)
- Always glob `packages/supabase/migrations/*.sql` to verify the next number before creating a new migration.
- Always add indexes for WHERE/JOIN/ORDER BY columns.
- Always enable RLS on new tables. Add public read policy for legal data.
- Computed columns use `GENERATED ALWAYS AS`.
- Heavy migrations (ALTER TABLE on large tables) timeout via `apply_migration` MCP tool. Use `execute_sql` with `SET statement_timeout = '600s'` and run steps individually.

## Brand & Design

**Read `BRAND_GUIDELINES.md` before any frontend work.** Key rules:

- **One accent color:** Verdigris `#2B6150` (`bg-primary`) — buttons, links, focus rings
- **Background:** Warm stone `#F8F5F0` (`bg-background`), not pure white. Cards use `bg-card` (white) for lift
- **Typography:** Instrument Serif (`font-heading`, weight 400 only — hierarchy through size) + Instrument Sans (`font-sans`) + JetBrains Mono (`font-mono`)
- **Neutrals:** Warm graphite ("Batu Candi"). Never cool gray/slate/zinc
- **Borders over shadows.** Only `shadow-sm` on popovers. `rounded-lg` default radius
- Color variables are defined as CSS custom properties in `globals.css` — never hardcode hex values

## Environment Variables

Root `.env` holds all keys (never committed). Each sub-project has its own env file:

| File | Key vars |
|------|----------|
| `.env` (root) | `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL` |
| `apps/mcp-server/.env` | `SUPABASE_URL`, `SUPABASE_KEY` (= service role key) |
| `scripts/.env` | `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY` |

**`SUPABASE_KEY` in MCP server and scripts = `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Never expose to browser.**

## Domain Glossary

| Term | Meaning |
|------|---------|
| UU (Undang-Undang) | Law — primary legislation from parliament |
| PP (Peraturan Pemerintah) | Government Regulation — implements a UU |
| Perpres (Peraturan Presiden) | Presidential Regulation |
| Pasal | Article — the primary searchable unit |
| Ayat | Sub-article, numbered (1), (2), (3) within a Pasal |
| BAB | Chapter — top-level grouping (Roman numerals) |
| Bagian | Section — sub-grouping within a BAB |
| Penjelasan | Elucidation — official explanation alongside the law |
| Berlaku / Dicabut / Diubah | In force / Revoked / Amended |
| FRBR URI | Unique ID, e.g. `/akn/id/act/uu/2003/13` |

## Gotchas

- **When deleting a Python function, grep all `.py` files for importers.** `scripts/worker/process.py` and `scripts/load_uud.py` both import from `loader/load_to_supabase.py` separately from the main loader flow.
- **RLS blocks empty results.** If a new table returns no data, check that an RLS policy exists — Supabase silently returns `[]` without one.
- **`SUPABASE_KEY` naming.** MCP server and scripts use `SUPABASE_KEY` but the root `.env` calls it `SUPABASE_SERVICE_ROLE_KEY`. They're the same value.
- **No vector/embedding search.** `document_nodes.fts` is keyword-only (TSVECTOR). No pgvector, no embeddings.
- **Instrument Serif has no bold.** Only weight 400. Use font size for heading hierarchy, not weight.
- **`data/` is gitignored.** Raw PDFs and parsed JSON live in `data/raw/` and `data/parsed/` locally only.
- **i18n async/sync distinction.** Using `useTranslations` in async Server Components causes build error. Use `getTranslations` with `await` for any `async function` component.
- **i18n navigation imports.** Public pages must import from `@/i18n/routing`, not `next/link` or `next/navigation`, or locale prefixes won't work.
- **Landing page metadata.** Lives in `[locale]/layout.tsx`, not `page.tsx` — applies to all pages under that locale.
- **Dual worktree.** `main` is checked out at `~/Desktop/personal-project/pasal`. From the `project-improve-scraper` worktree, use `git push origin <branch>:main` instead of `git checkout main && merge`.
- **Test slugs:** Use `uu-13-2003` format (not `uu-nomor-13-tahun-2003`) when verifying law detail pages locally.
- **MCP URL referenced in 5 places.** `connect/page.tsx`, `[locale]/page.tsx` (landing MCP card), `server.json`, `public/llms.txt`, `README.md`. Update all when the URL changes. No trailing slash — Starlette 307 redirects break Claude Code's HTTP transport on Railway.

## Deployment

- **Web:** Vercel (auto-deploys from `main`)
- **MCP Server:** Railway (Dockerfile at `apps/mcp-server/Dockerfile`, config at `railway.json`)
- **Git:** Push to `main` directly. Repo is public.
