# scripts/ — Data Pipeline

See root `CLAUDE.md` for project overview, database schema, and environment variables.

## Commands

```bash
pip install -r requirements.txt  # Install deps (from scripts/)

# Worker CLI (from project root)
python -m scripts.worker.run discover --types uu,pp       # Crawl listing pages → seed crawl_jobs
python -m scripts.worker.run process --batch-size 20       # Download, parse, load pending jobs
python -m scripts.worker.run full --types uu,pp            # Discover then process
python -m scripts.worker.run continuous --discovery-first  # Loop forever (Railway service)
python -m scripts.worker.run reprocess --force             # Re-extract from existing PDFs
python -m scripts.worker.run retry-failed --limit 100      # Reset failed jobs to pending
python -m scripts.worker.run stats                         # Show pipeline stats
```

Useful flags: `--dry-run`, `--max-pages N`, `--freshness-hours N`, `--ignore-freshness`, `--batch-size N`, `--max-runtime N`.

## Pipeline Flow

```
peraturan.go.id listing pages
    ↓  worker/discover.py — crawl /uu?page=1, /pp?page=1, etc.
crawl_jobs table [status: pending]
    ↓  worker/process.py — claim jobs atomically (FOR UPDATE SKIP LOCKED)
Download PDF from detail page → Supabase Storage
    ↓  parser/extract_pymupdf.py — PyMuPDF text extraction
    ↓  parser/ocr_correct.py — deterministic OCR fixes
    ↓  parser/parse_structure.py — regex state machine → node tree
    ↓  loader/load_to_supabase.py — insert works + document_nodes (FTS auto-generated)
crawl_jobs [status: loaded]
```

## Directory Structure

| Path | Purpose |
|------|---------|
| `crawler/config.py` | HTTP headers, delays, SSL context, file paths |
| `crawler/db.py` | Supabase singleton client |
| `crawler/models.py` | `CrawlJob` pydantic model |
| `crawler/state.py` | Job state management: `upsert_job`, `claim_pending_jobs`, `update_status` |
| `crawler/source_registry.py` | Data source definitions (peraturan.go.id, OTF, BPK, JDIH) |
| `crawler/dedup.py` | FRBR URI building, duplicate detection |
| `worker/run.py` | CLI entrypoint — all subcommands |
| `worker/discover.py` | `discover_regulations()` — listing page crawler |
| `worker/process.py` | `process_jobs()`, `reprocess_jobs()` — PDF → DB pipeline |
| `parser/extract_pymupdf.py` | `extract_text_pymupdf(path)` → `(text, stats)` |
| `parser/classify_pdf.py` | `classify_pdf(path)` → `born_digital` / `scanned_clean` / `image_only` |
| `parser/ocr_correct.py` | `correct_ocr_errors(text)` → cleaned text |
| `parser/parse_structure.py` | `parse_structure(text)` → node tree with BAB/Pasal/Ayat hierarchy |
| `loader/load_to_supabase.py` | `load_work()`, `load_nodes_by_level()` |
| `agent/apply_revision.py` | Python wrapper for `apply_revision()` SQL function |
| `agent/verify_suggestion.py` | Gemini Flash verification of user suggestions |
| `eval/` | Dev utility — compare our extraction vs Gemini extraction |
| `load_uud.py` | One-off UUD 1945 loader (bypasses crawler) |
| `seed_relationships.py` | One-off cross-reference seeder |

## Extraction Version

Current: **v5** (stored in `crawl_jobs.extraction_version`). Bump `EXTRACTION_VERSION` in `worker/process.py` when changing parser logic. `reprocess` command will re-extract outdated jobs.

## Key Patterns

### Job state machine

`pending` → `crawling` → `downloaded` → `parsed` → `loaded` (or `failed` at any step)

Jobs are claimed atomically via `claim_jobs()` SQL function (`FOR UPDATE SKIP LOCKED`). Stuck jobs (in `crawling` > 15min) are auto-recovered.

### Node insertion is breadth-first

`load_nodes_by_level()` inserts all depth-1 nodes, then depth-2, etc. This avoids FK ordering issues (parent must exist before child).

### Search is on document_nodes directly

No separate chunks table. The `document_nodes.fts` TSVECTOR column is `GENERATED ALWAYS` from `content_text`. The `search_legal_chunks()` SQL function queries content-bearing node types (`pasal`, `ayat`, `preamble`, `content`, `aturan`, `penjelasan_umum`, `penjelasan_pasal`) and skips structural nodes (bab, bagian, paragraf).

### Reprocess recovers from missing local files

After container restart, local PDFs are gone. `reprocess_jobs()` auto-downloads from Supabase Storage via `_download_from_storage()`.

## Environment

```bash
# scripts/.env
SUPABASE_URL=https://...       # Project URL
SUPABASE_KEY=eyJ...            # Service role key (bypasses RLS)
GEMINI_API_KEY=AIzaSy...       # For verify_suggestion.py
```

## Gotchas

- **PDF URLs are unpredictable.** Can't guess from slug — must scrape the detail page HTML to find the real download link.
- **Page boundary dedup.** PyMuPDF sometimes duplicates text at page breaks. `_dedup_page_breaks()` in extract_pymupdf.py handles this.
- **Discovery freshness is per-type.** Cached in `discovery_progress` table, keyed `(source_id, regulation_type)`. Default 24h TTL. Use `--ignore-freshness` to force re-crawl.
- **Roman numeral Pasals are real** in amendment laws and ATURAN PERALIHAN. The parser detects context and preserves them (doesn't convert to Arabic).
- **OCR correction runs on all PDFs** (v5+), not just classified scanned ones.
- **Gemini model** is hardcoded as `gemini-3-flash-preview` in `verify_suggestion.py`. System prompt is in Indonesian.
- **`data/` is gitignored.** Downloaded PDFs go to `data/pdfs/`, parsed output to `data/parsed/`.
- **`load_uud.py` is manual-only** — not run by the worker. After changing it, run `python scripts/load_uud.py --upload` locally to apply. It sets `source_pdf_url` via direct UPDATE (not through `load_work()`): the `--upload` flag uploads PDFs then updates `works.source_pdf_url` in a separate step. `load_work()` only includes `source_pdf_url` in the upsert when truthy, to avoid clearing URLs set by a previous `--upload` run.
