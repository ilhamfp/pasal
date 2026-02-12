# CLAUDE.md

## Project

Pasal.id — The first open, AI-native Indonesian legal platform. An MCP server + web app that gives Claude grounded access to Indonesian legislation.

**This is a hackathon project. Deadline: Monday Feb 16, 3:00 PM EST. Ship fast, cut scope aggressively, never gold-plate.**

## How to Work

### Workflow loop

1. Open `TASKS.md` and find your current task (the first unchecked one).
2. Implement the task completely.
3. Verify the "Done when" condition passes.
4. `git add -A && git commit -m "task X.Y: description" && git push origin main`
5. Move to the next task.

**Also commit + push mid-task** whenever you have a meaningful working increment (e.g., a migration that runs, a component that renders). Don't wait until the whole task is done.

### Rules

- **Do NOT skip tasks or jump ahead.** Tasks are ordered by dependency.
- **Do NOT add features not in TASKS.md.** No bonus features, no "nice to haves," no refactoring detours.
- **Do NOT get stuck longer than 20 minutes on any sub-problem.** If scraping doesn't work, use hardcoded seed data. If parsing fails on edge cases, skip those documents. Forward progress > perfection.
- **Do NOT over-engineer.** This is a hackathon MVP. No abstractions "for later," no premature optimization, no complex error recovery.
- **Before writing any frontend code, consult `BRAND_GUIDELINES.md`** for colors, fonts, spacing, and component patterns. It is the single source of truth for visual identity.
- **When in doubt, check TASKS.md Appendix** — it tells you exactly what to cut if behind schedule.

## Tech Stack

| Layer | Technology | Key Details |
|-------|-----------|-------------|
| Frontend | Next.js 16+ (App Router) | TypeScript, Tailwind CSS, shadcn/ui, deployed on Vercel |
| Database | Supabase (PostgreSQL) | Full-text search with `indonesian` stemmer, RLS enabled |
| MCP Server | Python + FastMCP | Streamable HTTP transport, deployed on Railway/Fly.io |
| Scraper/Pipeline | Python | httpx, BeautifulSoup, pdfplumber |
| Search | PostgreSQL FTS | `tsvector` + `websearch_to_tsquery('indonesian', ...)`. Vector search is a post-MVP upgrade. |
| Auth | Supabase Auth (via `@supabase/ssr`) | Public read, no auth required for legal data |

## Project Structure

```
pasal-id/
├── CLAUDE.md              ← You are here
├── TASKS.md               ← Your task list (work through sequentially)
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
│   ├── scraper/           ← Data acquisition scripts
│   └── parser/            ← PDF → structured JSON
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

### Python (MCP Server + Scripts)

- Python 3.12+. Type hints on all function signatures.
- Use `async/await` with `httpx` for HTTP calls — not `requests`.
- Use `pydantic` for data validation in the MCP server.
- Use `supabase-py` client for database access.
- Scripts go in `scripts/`, server code in `apps/mcp-server/`.
- No classes unless genuinely needed. Prefer functions.

### SQL (Supabase Migrations)

- Save each migration as `packages/supabase/migrations/001_description.sql`, `002_description.sql`, etc.
- Always include indexes for columns used in WHERE/JOIN/ORDER BY.
- Always enable RLS on new tables. Legal data tables get public read policy.
- Use `GENERATED ALWAYS AS` for computed columns (like `fts` tsvector).

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

## Common Pitfalls to Avoid

1. **Don't try to scrape 278,000 regulations.** Start with the 20 priority laws. The OTF corpus (5,817 docs) is your fallback data source.

2. **Don't build a custom PDF parser from scratch.** Use `pdfplumber` for text extraction, fall back to the OTF pre-processed text segments if PDFs are problematic. Skip scanned/image PDFs entirely.

3. **Don't try to add vector/semantic search during MVP.** The MVP uses PostgreSQL full-text search with the `indonesian` stemmer — it's fast, free, and handles legal terminology well. Vector search (pgvector + embeddings) is a post-MVP upgrade.

4. **Don't build the chat interface (Task 4.5) unless all other tasks are done.** It's explicitly marked as BONUS. The demo should primarily use Claude Desktop / Claude Code + MCP.

5. **Don't let the frontend block the MCP server.** The MCP server is the core deliverable. If time is short, the MCP tools working in Claude are more impressive to judges than a polished website.

6. **Don't use `pages/` router.** This project uses Next.js App Router exclusively (`app/` directory).

7. **Don't add vector/embedding columns.** The MVP has no embedding columns anywhere. `legal_chunks` has a `fts TSVECTOR` column for keyword search — that's all you need. If you see references to `VECTOR(1536)` or pgvector, ignore them — those are for the post-MVP upgrade.

8. **Don't forget RLS policies.** Supabase queries will return empty results if RLS is enabled but no policy exists. Always add a public read policy for legal data tables.

## Environment Variables

**All keys are stored in the root `.env` file.** Your first task when setting up each sub-project is to create local env files by copying the relevant vars from the root `.env`.

### Root `.env` (already exists, DO NOT commit)
Contains: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`

### Create `apps/web/.env.local` (Next.js requires this in its own directory)
```bash
# Copy from root .env:
NEXT_PUBLIC_SUPABASE_URL=     # from root .env → NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # from root .env → NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY=             # from root .env → ANTHROPIC_API_KEY (optional, for chat)
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
```

**Important:** The MCP server and scripts use `SUPABASE_KEY` which maps to the root `.env`'s `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses RLS — never expose it to the browser.

## Testing Quick Checks

After completing a phase, verify:

- **After Phase 1 (DB):** `SELECT COUNT(*) FROM regulation_types;` returns 11. `search_legal_chunks` function exists: `SELECT proname FROM pg_proc WHERE proname = 'search_legal_chunks';`
- **After Phase 2 (Data):** `SELECT COUNT(*) FROM works;` returns ≥20. `SELECT COUNT(*) FROM legal_chunks;` returns ≥500.
- **After Phase 3 (MCP):** `python server.py` starts. `search_laws("ketenagakerjaan")` returns results. `get_pasal("UU", "13", 2003, "1")` returns article text.
- **After Phase 4 (Frontend):** `npm run build` succeeds. Homepage loads. Search returns results. Law detail page renders with TOC.