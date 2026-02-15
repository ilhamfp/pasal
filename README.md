<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/lockup-dark-bg.svg" />
    <img src="logo/lockup-primary.svg" alt="Pasal.id" height="64" />
  </picture>
</p>

<h3 align="center">Democratizing Indonesian Law — The First Open, AI-Native Legal Platform</h3>

<p align="center">
  <a href="https://pasal.id">Website</a> ·
  <a href="https://pasal.id/connect">Connect to Claude</a> ·
  <a href="https://pasal.id/api">REST API</a> ·
  <a href="LICENSE">MIT License</a>
</p>

<p align="center">
  <a href="https://pasal.id"><img src="https://img.shields.io/badge/Legal_Data-Pasal.id-2B6150?style=flat" alt="Legal Data by Pasal.id" /></a>
  <a href="https://pasal.id/connect"><img src="https://img.shields.io/badge/MCP-Server-blue?style=flat" alt="MCP Server" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/FastMCP-Python-4B8BBE?logo=python&logoColor=white" alt="FastMCP" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat" alt="License: MIT" /></a>
</p>

---

## The Problem

280 million Indonesians access their laws through government PDFs and expensive paywalls. The official legal database ([peraturan.go.id](https://peraturan.go.id)) offers only PDF downloads — no search, no structure, no API. When you ask AI about Indonesian law, you get hallucinated articles and wrong citations.

## The Solution

Pasal.id transforms Indonesia's legal corpus into structured, searchable data — accessible to both humans and AI through a web interface, REST API, and the first-ever MCP server for Indonesian law.

### Connect Claude in one command

```bash
claude mcp add --transport http pasal-id https://pasal-mcp-server-production.up.railway.app/mcp
```

Then ask Claude:

> *"Berapa usia minimum menikah di Indonesia?"*
> *"Jelaskan hak pekerja kontrak menurut UU Ketenagakerjaan"*
> *"Apakah UU Perkawinan 1974 masih berlaku?"*

Claude will search the actual legal database, cite specific articles (Pasal), and give grounded answers instead of hallucinating.

## Features

| | Feature | Description |
|---|---|---|
| **Search** | Full-Text Search | Indonesian stemmer + trigram fuzzy matching across 1,600+ articles |
| **Read** | Structured Reader | Three-column law reader with TOC, amendment timeline, and verification badges |
| **AI** | MCP Server | 4 grounded tools giving Claude access to actual legislation with exact citations |
| **API** | REST API | Public JSON endpoints for search, browsing, and article retrieval |
| **Topics** | Kenali Hakmu | Topic guides bridging life situations to specific laws |
| **Track** | Amendment Chains | Full relationship tracking — amendments, revocations, cross-references |
| **Save** | Bookmarks & History | Save articles and track reading history |
| **Verify** | Trust Signals | Verification badges, legal disclaimers, links to official sources |

## Architecture

```
                    ┌─────────────────────────────────┐
                    │         Supabase (PostgreSQL)    │
                    │  20 laws · 1,600+ articles · FTS │
                    └──────────┬──────────┬───────────┘
                               │          │
              ┌────────────────┘          └────────────────┐
              ▼                                            ▼
   ┌─────────────────────┐                    ┌───────────────────────┐
   │   MCP Server (Py)   │                    │   Next.js Frontend    │
   │   FastMCP · Railway │                    │   Vercel · pasal.id   │
   │                     │                    │                       │
   │  · search_laws      │                    │  · /search            │
   │  · get_pasal        │                    │  · /peraturan/[type]  │
   │  · get_law_status   │                    │  · /topik             │
   │  · list_laws        │                    │  · /connect           │
   └─────────┬───────────┘                    │  · /api               │
             │                                │  · /bookmark          │
             ▼                                └───────────────────────┘
   ┌─────────────────────┐
   │   Claude / AI       │
   │   Grounded answers  │
   │   with citations    │
   └─────────────────────┘
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_laws` | Full-text keyword search across all legal provisions with Indonesian stemming |
| `get_pasal` | Get the exact text of a specific article (Pasal) by law and number |
| `get_law_status` | Check if a law is in force, amended, or revoked with full amendment chain |
| `list_laws` | Browse available regulations with type, year, and status filters |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Database | Supabase (PostgreSQL FTS with `indonesian` stemmer + pg_trgm) |
| MCP Server | Python + FastMCP, deployed on Railway |
| Data Pipeline | Python — httpx, BeautifulSoup, pdfplumber |
| Search | `websearch_to_tsquery('indonesian', ...)` with trigram fallback |

## Legal Coverage

Currently covers 20+ major Indonesian laws including:

- **UU 13/2003** Ketenagakerjaan (Labor) & **UU 6/2023** Cipta Kerja (Job Creation)
- **UU 1/1974** Perkawinan (Marriage) & **UU 16/2019** Perubahan (Amendment)
- **UU 1/2023** KUHP (New Criminal Code)
- **UU 27/2022** Perlindungan Data Pribadi (Data Privacy)
- **UU 8/1999** Perlindungan Konsumen (Consumer Protection)
- **UU 31/1999** Pemberantasan Tindak Pidana Korupsi (Anti-Corruption)
- And more — sourced from [peraturan.go.id](https://peraturan.go.id) and [peraturan.bpk.go.id](https://peraturan.bpk.go.id)

## Development

```bash
# Frontend
cd apps/web && npm install && npm run dev

# MCP Server
cd apps/mcp-server && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python server.py

# Data Pipeline
cd scripts && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scraper/scrape_laws.py
python parser/parse_law.py
python loader/load_to_supabase.py
```

## REST API

Base URL: `https://pasal.id/api/v1`

```bash
# Search across all laws
curl "https://pasal.id/api/v1/search?q=ketenagakerjaan&limit=10"

# List laws by type
curl "https://pasal.id/api/v1/laws?type=UU&year=2023"

# Get a specific law
curl "https://pasal.id/api/v1/laws/akn/id/act/uu/2003/13"
```

Full documentation at [pasal.id/api](https://pasal.id/api).

## Contributing

Contributions welcome — especially:

- Adding more laws to the database
- Improving the PDF parser for edge cases
- Adding English translations
- Building vector/semantic search (post-MVP)

## Built With

Built with [Claude Opus 4.6](https://anthropic.com) for the [Claude Code Hackathon](https://cerebralvalley.ai/e/claude-code-hackathon).

## License

[MIT](LICENSE)
