# Plan: Productionize the Scraper

## Problem

The scraper is just local Python scripts. No deployment, no scheduling, no monitoring. The OTF corpus (5,817 laws) turned out to be a dead end — the repo only has infrastructure code, not the actual data files (they're generated from a MySQL database we don't have access to).

**The real opportunity:** peraturan.go.id has **clean, paginatable listing pages** with 61,740 regulations. We can crawl them systematically.

- `/uu?page=1` → 1,926 UU laws, 20 per page
- `/pp?page=1` → 4,989 PP regulations
- `/perpres?page=1` → 2,640 Presidential regulations
- `/permen?page=1` → 19,962 Minister regulations
- etc.

Each detail page at `/id/{slug}` has metadata + PDF links.

## Architecture

```
┌──────────────────────────────────────────────┐
│           Railway (Cron Service)              │
│                                              │
│  scripts/worker/run.py                       │
│  ┌─────────────┐  ┌──────────┐  ┌────────┐  │
│  │  1. Discover │→ │ 2. Parse │→ │3. Load │  │
│  │  (crawl      │  │ (PDF →   │  │(→ Supa │  │
│  │   listings)  │  │  JSON)   │  │ base)  │  │
│  └─────────────┘  └──────────┘  └────────┘  │
│          ↕               ↕            ↕      │
└──────────────────────────────────────────────┘
                       ↕
              ┌────────────────┐
              │   Supabase DB  │
              │  crawl_jobs    │
              │  scraper_runs  │
              │  works         │
              │  legal_chunks  │
              └────────────────┘
                       ↕
┌──────────────────────────────────────────────┐
│           Vercel (Next.js)                   │
│                                              │
│  /admin/scraper        → Dashboard overview  │
│  /admin/scraper/jobs   → Job list + filters  │
│  /api/admin/scraper/*  → Stats + triggers    │
└──────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Database Migration (013_scraper_runs.sql)

Add `scraper_runs` table to track each worker execution:

```sql
CREATE TABLE scraper_runs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'running',
    jobs_discovered INTEGER DEFAULT 0,
    jobs_processed INTEGER DEFAULT 0,
    jobs_succeeded INTEGER DEFAULT 0,
    jobs_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

Also add public read RLS on `crawl_jobs` and `scraper_runs` for the dashboard.

### Step 2: Listing Page Crawler (scripts/worker/discover.py)

New module that crawls peraturan.go.id listing pages to discover all regulation URLs:

- Crawl `/uu?page=1`, `/uu?page=2`, ... `/uu?page=97` (1,926 UU / 20 per page)
- Extract: slug, title, PDF URL, regulation type, number, year
- Upsert into `crawl_jobs` with status `pending`
- Skip URLs already in `crawl_jobs` (dedup via `source_id + url` unique constraint)
- Start with UU and PP only (~7,000 regulations), expand later

### Step 3: Job Processor (scripts/worker/process.py)

Process pending `crawl_jobs`:

1. Fetch batch of pending jobs from Supabase
2. For each job:
   - Download PDF from peraturan.go.id
   - Parse with existing `parse_law.py` → `parse_into_nodes()`
   - Load into Supabase using existing `load_to_supabase.py` functions
   - Update `crawl_jobs` status: pending → crawling → parsed → loaded (or failed)
3. Track stats in `scraper_runs` table
4. Respect rate limits (2s delay between requests)
5. Safety: max runtime of 25 minutes per run

### Step 4: Worker Entry Point (scripts/worker/run.py)

CLI that combines discover + process:

```bash
# Discover new regulations from listing pages
python -m scripts.worker.run discover --types uu,pp --max-pages 5

# Process pending jobs
python -m scripts.worker.run process --batch-size 20 --max-runtime 1500

# Full run (discover + process) — what the cron job calls
python -m scripts.worker.run full --types uu,pp --batch-size 20
```

### Step 5: Dockerfile (scripts/worker/Dockerfile)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY scripts/ ./scripts/
COPY packages/ ./packages/
RUN pip install --no-cache-dir -r scripts/requirements.txt
CMD ["python", "-m", "scripts.worker.run", "full", "--types", "uu,pp", "--batch-size", "20"]
```

Deploy as Railway cron service: `0 */6 * * *` (every 6 hours).

### Step 6: Admin Dashboard — Overview Page (/admin/scraper)

Server Component showing:

- **Stats cards:** Total jobs, Pending, Processing, Loaded, Failed
- **Recent runs table:** Last 10 scraper runs with outcome stats
- **Source/type breakdown:** Jobs per regulation type (UU, PP, etc.)
- **Data growth:** Total works + chunks in database

### Step 7: Admin Dashboard — Jobs Page (/admin/scraper/jobs)

Server Component with URL-based filters:

- Filter by: status, regulation type, source
- Paginated table: Slug, Type, Number/Year, Status, Error, Updated
- Color-coded status badges (verdigris for loaded, red for failed)

### Step 8: Admin API Routes

- `GET /api/admin/scraper/stats` — aggregated job counts + recent runs
- `POST /api/admin/scraper/trigger` — seed new discovery jobs (with simple API key auth)

### Step 9: Deploy to Railway

- Create `pasal-scraper-worker` service
- Set env vars: `SUPABASE_URL`, `SUPABASE_KEY`
- Set cron: `0 */6 * * *`
- Run initial discovery to seed ~7,000 UU+PP jobs
- Let the cron process 20 per run, growing the corpus gradually

## What Gets Cut If Behind Schedule

**Priority order (stop whenever needed):**

1. **Must have:** Steps 1-4 (migration + worker scripts). This alone gives you a production scraper you can run locally or on Railway.
2. **Should have:** Step 6 (admin overview dashboard). One page, ~45 min.
3. **Nice to have:** Step 5 + 9 (Docker + Railway deploy). Can always run manually.
4. **Cut if needed:** Steps 7-8 (jobs list page, API routes). Polish features.

## Existing Code Reused

- `scripts/crawler/state.py` → `upsert_job()`, `get_pending_jobs()`, `update_status()`
- `scripts/parser/parse_law.py` → `parse_into_nodes()`, `extract_text_from_pdf()`
- `scripts/loader/load_to_supabase.py` → `load_work()`, `load_nodes_recursive()`, `create_chunks()`
- `scripts/crawler/config.py` → delays, headers, paths
- `packages/supabase/migrations/012_crawl_state.sql` → existing `crawl_jobs` table
