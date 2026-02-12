# Pasal.id - Human Notes

> **Last updated:** Feb 12, 2026
> **Author:** Claude Opus 4.6 (code review & analysis), for Ilham
> **Purpose:** Honest, first-principles assessment of where the project stands and what it takes to become a real product.

---

## TL;DR

Pasal.id is a hackathon MVP that works. You have a functional MCP server on Railway, a Next.js frontend on Vercel, 20 laws with ~1,630 articles in Supabase, and full-text search in Indonesian. The core demo loop (Claude + MCP = grounded legal answers) is real and impressive. But between "working hackathon demo" and "sustainable product" is a canyon. This document maps the canyon.

---

## 1. What the Project Does Today

### The 30-Second Pitch
Pasal.id gives Claude (and humans) structured access to Indonesian legislation. Instead of hallucinating legal articles, Claude calls your MCP server, which queries a PostgreSQL database of real parsed laws, and returns exact citations.

### What Actually Works
1. **MCP Server** (Railway) - 4 tools: `search_laws`, `get_pasal`, `get_law_status`, `list_laws`
2. **Web Search** (Vercel) - Type a query, get matching articles with law metadata
3. **Law Reader** - Browse a law's full structure (BAB > Pasal > Ayat) with 3-column layout
4. **Connect Page** - One-liner to add MCP to Claude Code
5. **Data Pipeline** - Scrape PDFs from peraturan.go.id, parse with pdfplumber, load to Supabase

### Numbers
| Metric | Current |
|--------|---------|
| Laws loaded | 20 (out of ~278,000 on peraturan.go.id) |
| Articles (Pasal) | ~1,630 |
| Search chunks | ~1,630 |
| Lines of code (core) | ~1,587 across 7 key files |
| Tests | 0 |
| CI/CD | None (push to main, auto-deploy on Vercel/Railway) |
| Users | 0 (hackathon project) |

---

## 2. Architecture at a Glance

```
                    +-----------+
                    |  Claude   |
                    | (Desktop/ |
                    |   Code)   |
                    +-----+-----+
                          |
                     MCP Protocol
                     (HTTP POST)
                          |
                    +-----v-----+
                    | MCP Server|  Python + FastMCP
                    | (Railway) |  server.py (405 LOC)
                    +-----+-----+
                          |
                     Supabase SDK
                          |
               +----------v----------+
               |    Supabase (PG)    |
               |  - works (20 rows)  |
               |  - document_nodes   |
               |  - legal_chunks     |  FTS: tsvector + indonesian stemmer
               |  - work_relations   |
               +----------+----------+
                          |
                     Supabase SDK
                          |
                    +-----v-----+
                    |  Next.js   |  App Router, Server Components
                    |  (Vercel)  |  Tailwind + shadcn/ui
                    +-----------+
                          |
                       Browser
```

### Data Flow (one-time pipeline, run manually)
```
peraturan.go.id --[scrape_laws.py]--> JSON metadata
                --[download_pdfs.py]--> PDFs
PDFs --[parse_law.py]--> Structured JSON (data/parsed/)
JSON --[load_to_supabase.py]--> Supabase tables
```

---

## 3. The Good (What You Got Right)

### 3.1 MCP-First Architecture
This was the right call. The MCP server is the product, the website is a nice-to-have. Judges at the hackathon care about Claude + real data >> a pretty website with no AI integration. You nailed the priority.

### 3.2 PostgreSQL FTS with Indonesian Stemmer
Using `websearch_to_tsquery('indonesian', ...)` instead of trying to bolt on vector search was smart. It's fast, free, requires no embeddings API costs, and the Indonesian stemmer handles legal terminology well. The 3-tier fallback (websearch > plainto > ILIKE) in the search function is a good defensive pattern.

### 3.3 Server Components + Supabase SSR
The frontend is properly architected. Server Components for data fetching (search, law reader), client components only where needed (SearchBar). Using `@supabase/ssr` instead of deprecated auth helpers. ISR on law pages (24h revalidation). This is textbook Next.js.

### 3.4 Hierarchical Document Model
The ltree-based `document_nodes` table with BAB > Bagian > Paragraf > Pasal > Ayat hierarchy is the right data model. It preserves the actual structure of Indonesian law, which matters for legal accuracy.

### 3.5 RLS from Day One
Enabling Row Level Security with public read policies protects the data layer even though there's no auth yet. When you add admin/write capabilities later, you won't have to retrofit security.

---

## 4. The Bad (Technical Debt & Pitfalls)

### 4.1 ZERO TESTS
This is the single biggest risk. There are zero test files. No unit tests for the parser. No integration tests for the MCP tools. No E2E tests for the frontend. The parser uses complex regex that will break on edge cases -- you won't know until a user reports it.

**Impact:** You cannot safely refactor anything. Every change to the parser or MCP server is a gamble.

### 4.2 Hardcoded Law Metadata
`parse_law.py` has a `LAW_METADATA` dictionary with 20 hardcoded entries. Every new law requires manually adding an entry. This doesn't scale to 100 laws, let alone 278,000.

```python
LAW_METADATA = {
    "uu-no-13-tahun-2003": {"type": "UU", "number": "13", "year": 2003, ...},
    # ... 19 more
}
```

### 4.3 Hardcoded Regulation Type IDs
`load_to_supabase.py` has `REG_TYPE_MAP = {"UUD": 1, "TAP_MPR": 2, ...}` with hardcoded database IDs. If the seed data order ever changes, this breaks silently. Should query the DB at runtime (like the MCP server already does).

### 4.4 Destructive Data Loading
The loader's `main()` function starts by deleting ALL existing data:
```python
sb.table("legal_chunks").delete().neq("id", 0).execute()
sb.table("document_nodes").delete().neq("id", 0).execute()
sb.table("works").delete().neq("id", 0).execute()
```
This means you can't incrementally add laws. Every reload wipes everything. Fine for a hackathon, catastrophic for production.

### 4.5 No Error Recovery in Pipeline
If the parser fails on law #12 of 20, you get a partial load. There's no checkpoint/resume, no transaction wrapping, no idempotency. The upsert on `works` is good but `document_nodes` uses plain `insert` which will fail on re-runs without the full wipe.

### 4.6 MCP Server Uses Service Role Key
The MCP server connects to Supabase with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. This is fine when it only reads, but if anyone adds a write tool, they have full database access. There's no rate limiting, no auth, no API key on the MCP endpoint itself. Anyone who finds the Railway URL can hammer it.

### 4.7 No Monitoring or Logging
No structured logging, no error tracking (Sentry/etc), no uptime monitoring. If the Railway server goes down or Supabase hits connection limits, you won't know until someone complains.

### 4.8 PDF Parsing Is Fragile
`pdfplumber` text extraction works well on digitally-generated PDFs but fails on scanned documents. The regex-based parser assumes specific formatting that varies across law types. Many Indonesian laws have non-standard formatting, tables, footnotes, and multi-column layouts that the current parser silently mangles or skips.

### 4.9 No Client-Side Supabase Utility
`apps/web/src/lib/supabase/client.ts` is referenced in CLAUDE.md but might not exist or be unused. All current data fetching uses server-side Supabase client, which is correct, but if you add any client-side interactivity (real-time, auth) you'll need this.

### 4.10 Search Relevance Is Untuned
The `ts_rank_cd` scoring is used raw. No boosting by law recency, no boosting by regulation hierarchy level (UU should rank above PERMEN for the same query), no consideration of which laws are most commonly cited. The relevance score shown as percentage (`(chunk.score * 100).toFixed(1)%`) is misleading -- `ts_rank_cd` doesn't return percentages.

---

## 5. The Ugly (What Would Kill You in Production)

### 5.1 Coverage: 20 / 278,000 Laws = 0.007%
You cover 20 laws. Indonesia has ~278,000 regulations. Users will search for laws you don't have and get "no results." This is the single biggest product risk -- a legal tool that can't find most laws is worse than useless because it gives false confidence that a topic isn't covered.

### 5.2 No Versioning or Update Pipeline
Laws change. UU 6/2023 Cipta Kerja was itself modified by a Constitutional Court ruling. You have no pipeline to detect changes, fetch updated versions, or mark outdated content. A user relying on your data could cite a revoked article.

### 5.3 No "I Don't Know" Signal
When `search_laws` returns 0 results, the MCP tool returns `{"message": "No results found"}`. Claude might interpret this as "there is no law on this topic" rather than "we don't have this law in our database." This is a liability in a legal context. The tool should clearly state: "This topic may be covered by laws not yet in our database."

### 5.4 No Legal Disclaimer
The website and MCP server have no disclaimer that this is not legal advice. In Indonesia, the Advocates Act (UU 18/2003) restricts who can give legal advice. You need prominent disclaimers on every page and in every MCP response.

### 5.5 Single Point of Failure: Supabase Free Tier
If this is on Supabase free tier, you get: 500MB database, 2GB bandwidth/month, paused after 1 week inactivity. One viral tweet and the database goes down or gets paused. No backup strategy either.

### 5.6 No Penjelasan (Elucidation) Data
The parser detects `PENJELASAN` sections but strips them out (everything after it is cut). Penjelasan has binding legal force in Indonesian law and is crucial for interpretation. Lawyers and judges routinely cite it. Missing this makes the tool significantly less useful for real legal work.

---

## 6. Roadmap to Sustainable Product

### Sprint 1: Foundation (Weeks 1-2)
**Goal:** Make what exists reliable.

- [ ] **Add tests.** Unit tests for parser regex patterns (20+ test cases per pattern). Integration tests for each MCP tool. At least smoke tests for each frontend route.
- [ ] **Add legal disclaimer** to every page footer, every MCP tool response, and the README.
- [ ] **Fix "no results" messaging** -- every tool response should distinguish "not found in our database" from "no such law exists."
- [ ] **Add structured logging** (Python: `structlog` or `loguru`; instrument every tool call with timing and query).
- [ ] **Add error tracking** (Sentry free tier for both Python server and Next.js).
- [ ] **Remove destructive data loading.** Make the loader idempotent (upsert everywhere, don't delete-then-insert).

### Sprint 2: Scale the Data (Weeks 3-6)
**Goal:** Go from 20 to 500+ laws.

- [ ] **Auto-extract metadata from PDFs.** Stop hardcoding `LAW_METADATA`. Parse title, number, year, type from the PDF header or filename pattern.
- [ ] **Batch processing pipeline.** Point the scraper at peraturan.go.id category pages, download all UU + PP + PERPRES, parse in batch. Handle failures gracefully (log and skip).
- [ ] **Parse Penjelasan.** Add it as separate `document_nodes` linked to the same work.
- [ ] **Add PP (Government Regulations) and PERPRES (Presidential Regulations).** These are the most common regulation types after UU and are frequently referenced.
- [ ] **Coverage tracker.** Dashboard showing which laws are in the database, which are missing, parsing quality score per law.

### Sprint 3: Search Quality (Weeks 7-10)
**Goal:** Make search actually good.

- [ ] **Boost by regulation hierarchy.** UU results should rank above PERMEN for ambiguous queries.
- [ ] **Boost by recency.** Recent laws should rank higher (unless user specifies year filter).
- [ ] **Add vector search (pgvector).** Embed chunks with a multilingual model (e.g., `intfloat/multilingual-e5-large`). Hybrid FTS + vector search. This enables semantic queries like "what are worker rights" instead of exact keyword matching.
- [ ] **Query expansion.** Map common abbreviations and synonyms (e.g., "PHK" = "Pemutusan Hubungan Kerja", "TKA" = "Tenaga Kerja Asing").
- [ ] **Search analytics.** Log what people search for. Identify common queries that return zero results --> prioritize adding those laws.

### Sprint 4: Product Polish (Weeks 11-14)
**Goal:** Make it feel like a real product.

- [ ] **Mobile responsive.** Current layout is desktop-first. The law reader 3-column layout doesn't work on mobile.
- [ ] **Breadcrumbs and deep linking.** `/peraturan/uu/uu-13-2003#pasal-81` should scroll to that article and highlight it.
- [ ] **Citation export.** Copy a Pasal as a properly formatted legal citation (Indonesian citation format).
- [ ] **Cross-reference links.** When Pasal 81 says "sebagaimana dimaksud dalam Pasal 79", make "Pasal 79" a clickable link.
- [ ] **Comparison view.** Show old vs. new text when a law is amended (UU 13/2003 original vs. UU 6/2023 changes).
- [ ] **Bilingual support.** English translations for key laws (huge for foreign investors, international firms).
- [ ] **User accounts.** Save searches, bookmark articles, annotation/notes.

### Sprint 5: Sustainability (Weeks 15-20)
**Goal:** Make it last.

- [ ] **Monitoring & alerts.** Uptime checks, database size tracking, search latency dashboards.
- [ ] **CI/CD pipeline.** GitHub Actions: lint, test, type-check, build, deploy. No more push-to-main.
- [ ] **Database backups.** Automated daily backups (Supabase pro or manual pg_dump cron).
- [ ] **Rate limiting on MCP server.** Protect against abuse (especially since the service role key bypasses RLS).
- [ ] **Content freshness pipeline.** Weekly check for new/amended laws on peraturan.go.id. Auto-download, parse, load.
- [ ] **Revenue model.** Free for basic search. Premium API for law firms (higher rate limits, bulk export, English translations, amendment tracking). API key auth on MCP for paid users.

---

## 7. Brutal Honesty: Hard Questions You Need to Answer

### Q1: Who is this actually for?
The hackathon pitch says "280 million Indonesians." But the tool is in Indonesian with legal terminology. Your actual users are:
- **Law students** (affordable, they can't pay for Hukumonline)
- **Legal tech developers** (API/MCP access to legal data)
- **AI developers** (grounding LLMs with real legal data)
- **Journalists** (researching legal topics)

Regular Indonesians don't read laws. They ask lawyers. Your product helps the people who help regular Indonesians. That's a narrower but more honest market.

### Q2: Why would someone use this over Hukumonline?
Hukumonline has 278,000+ regulations, English translations, legal analysis, editorial commentary, and a 20-year track record. You have 20 laws. Your advantages are:
1. **Free** (they charge ~$200/year for premium)
2. **AI-native** (MCP integration is novel)
3. **Open source** (can be embedded, forked, extended)

The MCP angle is your only real moat. Double down on it.

### Q3: How do you stay current?
Laws change constantly. Indonesia's DPR (parliament) passes 20-30 new laws per year. Constitutional Court rulings can modify or nullify provisions. Ministry regulations number in the thousands. If you can't keep the data fresh, users will learn not to trust it. An automated pipeline is non-negotiable.

### Q4: What about accuracy?
Your parser uses regex on pdfplumber output. I estimate 80-90% accuracy on well-formatted laws. But the remaining 10-20% could include critical articles. A legal tool with 90% accuracy is dangerous -- it's high enough that people trust it, but low enough that they'll occasionally get wrong text. You need:
- A validation pipeline (compare parsed output against known-correct versions)
- "Confidence" indicators per article
- Easy reporting ("this article looks wrong" button)

### Q5: Can you do this alone?
The codebase is ~1,600 LOC across 7 files. One person can maintain this. But scaling to 500+ laws, adding vector search, building bilingual support, and keeping data fresh is a full-time job. You need either:
- A co-founder who does legal domain expertise (which laws matter, validation, partnerships with law faculties)
- Or community contributors (the open-source path -- but legal tools are niche and contributors are rare)

---

## 8. Technical Decisions I'd Reconsider

### 8.1 Python MCP Server vs. TypeScript
You now have two runtimes (Python for MCP, TypeScript for frontend). FastMCP works, but maintaining two ecosystems doubles the tooling burden. Consider: would a TypeScript MCP server (using the `@modelcontextprotocol/sdk`) let you share types, validation logic, and Supabase clients with the frontend? Trade-off: Python has better PDF processing libraries (pdfplumber, pytesseract). My recommendation: keep Python for the pipeline, but consider moving the MCP server to TypeScript long-term.

### 8.2 Supabase as the Only Database
Supabase is excellent for MVP. But you're using it for three different things:
1. OLTP (works, document_nodes) -- good fit
2. Full-text search -- okay fit (PG FTS is solid)
3. Vector search (future) -- Supabase supports pgvector, but dedicated vector DBs (Pinecone, Weaviate) perform better at scale

For now this is fine. At 10,000+ laws, benchmark before adding pgvector.

### 8.3 One Chunk Per Pasal
Your chunking strategy (one chunk per Pasal) is simple and works for keyword search. But some Pasals are very long (Pasal 1 of most laws lists 20+ definitions), while others are one sentence. For vector search, you'll want more uniform chunk sizes (~300-500 tokens). The code has a comment about splitting long Pasals by Ayat but doesn't implement it.

### 8.4 No Caching Layer
Every MCP tool call hits Supabase directly. If Claude sends 10 `get_pasal` calls in one conversation (which it does for comparative analysis), that's 10+ DB round-trips. Add an in-memory cache (even just `functools.lru_cache` with TTL) for `get_pasal` and `get_law_status` -- these are highly cacheable since laws don't change often.

---

## 9. Files You Should Know

| File | What It Does | Criticality |
|------|-------------|-------------|
| `apps/mcp-server/server.py` | THE product. 4 MCP tools + Supabase queries. | Critical |
| `scripts/parser/parse_law.py` | PDF > structured JSON. Regex-based. Fragile. | High |
| `scripts/loader/load_to_supabase.py` | JSON > DB. Destructive reload. | High |
| `packages/supabase/migrations/006_search_function.sql` | The FTS search function with 3-tier fallback. | Critical |
| `apps/web/src/app/peraturan/[type]/[slug]/page.tsx` | Law reader page. Most complex frontend component. | Medium |
| `apps/web/src/app/search/page.tsx` | Search results. Server Component. | Medium |
| `apps/web/src/lib/supabase/server.ts` | Supabase SSR client factory. | Medium |

---

## 10. Quick Wins (High Impact, Low Effort)

These are things you could do in a weekend that would meaningfully improve the product:

1. **Add disclaimer to every MCP response.** Append `"disclaimer": "This is not legal advice. Verify with official sources at peraturan.go.id."` to every tool return value. 2 lines of code, huge liability reduction.

2. **Fix the "no results" problem.** Change the empty-result response to explicitly say "not found in our database of 20 laws" instead of "no results found." Users (and Claude) need to know the database is incomplete.

3. **Add caching to MCP server.** `get_pasal` and `get_law_status` should cache results. `from functools import lru_cache` + a dict cache. Laws don't change hourly.

4. **Log every MCP tool call.** Print `tool_name`, `args`, `result_count`, `latency_ms` to stdout. Railway captures stdout logs. Instant observability.

5. **Mobile responsive law reader.** The 3-column layout uses `lg:grid-cols-[250px_1fr_280px]` which collapses to single column on mobile, but the TOC and sidebar just disappear (`hidden lg:block`). Add a mobile-friendly TOC toggle.

6. **Upgrade Supabase plan** before any public launch. Free tier pauses after inactivity. A paused database = a dead product.

---

## 11. What I'd Build Next If I Were You

If I had 2 weeks after the hackathon:

**Week 1:** Tests + 100 more laws + fix the pipeline
- Write parser tests, MCP tool tests
- Auto-extract metadata from PDFs (eliminate LAW_METADATA dict)
- Run the pipeline on all UU (primary laws) from 2010-2024 (~150 laws)
- Make the loader idempotent

**Week 2:** Vector search + API polish
- Add pgvector extension to Supabase
- Embed all chunks with a multilingual model
- Hybrid search: FTS for keyword queries, vector for semantic queries
- Add rate limiting and API key auth to MCP server
- Add Sentry error tracking

That gets you from "hackathon demo" to "useful alpha" that you could share with law students and legal tech enthusiasts.

---

## 12. Final Thought

The core insight behind Pasal.id is correct: Indonesian law is trapped in PDFs, and AI can't ground its answers without structured access to the source material. The MCP approach is the right technical solution at the right time. But the gap between "20 laws in a demo" and "a tool lawyers trust" is enormous. The path forward is relentless focus on data coverage and accuracy, not feature proliferation. Get 500 laws parsed correctly before you build the chat interface. Get 1,000 laws before you add vector search. The value is in the data, not the features.

Ship the data pipeline first. Everything else follows.
