# Pasal.id

**Democratizing Indonesian Law — The First Open, AI-Native Legal Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com)
[![FastMCP](https://img.shields.io/badge/FastMCP-Python-4B8BBE)](https://gofastmcp.com)

## The Problem

280 million Indonesians access their laws through government PDFs and expensive paywalls. The official legal database ([peraturan.go.id](https://peraturan.go.id)) offers only PDF downloads — no search, no structure, no API. When you ask AI about Indonesian law, you get hallucinated articles and wrong citations.

## The Solution

Pasal.id is a complete open-source platform that transforms Indonesia's legal corpus into structured, searchable data and makes it accessible to both humans and AI:

- **Web Interface** — Full-text search across 20+ Indonesian laws with a structured reader
- **MCP Server** — The first MCP server for Indonesian law, giving Claude grounded access to actual legislation with exact citations
- **Data Pipeline** — Automated scraping, PDF extraction, and parsing of legal documents into searchable articles

## Quick Start — Connect to Claude

```bash
claude mcp add pasal-id --transport http --url https://pasal-mcp-server-production.up.railway.app/mcp/
```

Then ask Claude:
- *"Berapa usia minimum menikah di Indonesia?"*
- *"Jelaskan hak pekerja kontrak menurut UU Ketenagakerjaan"*
- *"Apakah UU Perkawinan 1974 masih berlaku?"*

Claude will search the actual legal database, cite specific articles, and give grounded answers instead of hallucinating.

## Architecture

```
User / Claude ──→ MCP Server (FastMCP) ──→ Supabase (PostgreSQL)
                        │                        │
                  4 MCP tools:            Full-text search
                  - search_laws           with Indonesian
                  - get_pasal             stemmer (tsvector)
                  - get_law_status
                  - list_laws

Browser ──→ Next.js Frontend ──→ Supabase
              (Vercel)            20 laws, 1600+ articles
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), Tailwind CSS, shadcn/ui, Vercel |
| Database | Supabase (PostgreSQL FTS with `indonesian` stemmer) |
| MCP Server | Python + FastMCP, deployed on Railway |
| Data Pipeline | Python (httpx, BeautifulSoup, pdfplumber) |
| Search | `websearch_to_tsquery('indonesian', ...)` with `ts_rank_cd` |

## Data Sources

- [peraturan.go.id](https://peraturan.go.id) — Official Indonesian legal database (PDFs)
- [peraturan.bpk.go.id](https://peraturan.bpk.go.id) — Supreme Audit Agency legal database

Currently covers 20 major Indonesian laws including:
- UU 13/2003 (Labor Law) & UU 6/2023 (Omnibus Job Creation)
- UU 1/1974 (Marriage Law) & UU 16/2019 (Amendment)
- UU 1/2023 (New Criminal Code)
- UU 27/2022 (Data Privacy) and more

## MCP Tools

| Tool | Description |
|------|------------|
| `search_laws` | Full-text keyword search across all legal provisions |
| `get_pasal` | Get exact text of a specific article (Pasal) by law and number |
| `get_law_status` | Check if a law is in force, amended, or revoked |
| `list_laws` | Browse available regulations with filters |

## Development

```bash
# Frontend
cd apps/web && npm install && npm run dev

# MCP Server
cd apps/mcp-server && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python server.py

# Data pipeline
cd scripts && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scraper/scrape_laws.py
python parser/parse_law.py
python loader/load_to_supabase.py
```

## Contributing

This is an open-source project. Contributions welcome — especially:
- Adding more laws to the database
- Improving the PDF parser for edge cases
- Adding English translations
- Building vector/semantic search

## Built With

Built with Claude Opus 4.6 for the [Claude Code Hackathon](https://cerebralvalley.ai/e/claude-code-hackathon).

## License

MIT
