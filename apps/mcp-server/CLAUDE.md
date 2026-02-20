# apps/mcp-server — FastMCP Server

See root `CLAUDE.md` for project overview, database schema, and environment variables.

## Commands

```bash
pip install -r requirements.txt     # Install dependencies
python server.py                    # Start server (streamable-http on port 8000)
python -m pytest test_server.py -v  # Run tests
```

Requires: `SUPABASE_URL` + `SUPABASE_ANON_KEY` in `.env`.

## Tools

| Tool | Rate limit | Cache TTL | Purpose |
|------|-----------|-----------|---------|
| `search_laws(query, regulation_type?, year_from?, year_to?, language?, limit?)` | 30/min | None | Full-text search via `search_legal_chunks()` RPC |
| `get_pasal(law_type, law_number, year, pasal_number)` | 60/min | 1h | Exact article text with ayat and cross-references |
| `get_law_status(law_type, law_number, year)` | 60/min | 1h | Law validity + amendment/revocation chain |
| `list_laws(regulation_type?, year?, status?, search?, page?, per_page?)` | 30/min | None | Browse/filter regulations |
| `ping()` | None | None | Health check with DB law count |

### Response conventions

- Every response includes a `disclaimer` string (legal notice).
- Error responses return `{"error": "...", "disclaimer": "..."}`. Search errors return `[{"error": "..."}]`.
- `get_pasal` truncates content at 3000 chars with a `[...truncated]` notice.
- `get_pasal` includes `available_pasals` hint when the requested article isn't found.
- `pasal_number` is a **string** (e.g. `"81A"`), not an int — articles can have letter suffixes.

## Architecture

```
server.py          — All tools, caching, rate limiting, cross-reference extraction
test_server.py     — Pytest suite with mocked Supabase client
Dockerfile         — python:3.12-slim, runs server.py
requirements.txt   — fastmcp, supabase, python-dotenv
railway.json       — Railway deployment config
```

Single-file server. All five tools, the `TTLCache`, `RateLimiter`, regulation type cache, and cross-reference regex are in `server.py`.

### Key internals

- **`_ensure_reg_types()`** — lazily loads `regulation_types` table into memory, maps code ↔ id.
- **`_find_work(law_type, law_number, year)`** — shared helper to look up a regulation. Used by `get_pasal` and `get_law_status`.
- **`extract_cross_references(text)`** — regex extraction of Pasal/Ayat/Huruf references from legal text. Deterministic, not NLP.
- **`TTLCache`** — simple dict-based cache with per-key expiry. Pasal + status caches are 1h, law count is 5min.
- **`RateLimiter`** — per-instance sliding window. Not distributed — each server instance has its own counters.

### Supabase key

Requires `SUPABASE_ANON_KEY` env var (read-only via RLS). Raises `RuntimeError` at startup if missing. The server only reads data, so the anon key is sufficient and safer than a service role key.

## Deployment

- **Platform:** Railway
- **Transport:** `streamable-http` (FastMCP over HTTP with streaming)
- **Port:** `$PORT` env var (default 8000)
- **Docker:** `python:3.12-slim` base image

## Gotchas

- **Year filtering in `search_laws` is client-side.** Results are fetched from RPC then filtered in Python — not pushed to the DB query. This is intentional for simplicity.
- **Amendment relationship codes are hardcoded:** `{"mengubah", "diubah_oleh", "mencabut", "dicabut_oleh"}`. Any new relationship types in the DB won't auto-classify.
- **No Pydantic models for responses.** Tool return values are plain dicts/lists (pydantic is a FastMCP dependency, not used directly). FastMCP handles JSON serialization.
- **Tests mock Supabase at import time.** The mock patches `supabase.create_client` before `server.py` is imported. A `_reset()` fixture clears caches and rate limiters between tests.
- **No trailing slash on `/mcp` endpoint.** `/mcp/` triggers a Starlette 307 redirect that downgrades HTTPS→HTTP (Railway terminates TLS upstream), which breaks Claude Code's HTTP transport and triggers failed OAuth discovery.
