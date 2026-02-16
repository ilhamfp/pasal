<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/lockup-dark-bg.svg" />
    <img src="logo/lockup-primary.svg" alt="Pasal.id" height="64" />
  </picture>
</p>

<h3 align="center">The First Open, AI-Native Platform for Indonesian Law</h3>

<p align="center">
  <a href="https://www.loom.com/share/da211318bbe14c4396840b97f5ab8603">Demo Video</a> ·
  <a href="https://pasal.id">Website</a> ·
  <a href="https://pasal.id/connect">Connect to Claude</a> ·
  <a href="https://pasal.id/api">REST API</a> ·
  <a href="LICENSE">AGPL-3.0 License</a>
</p>

<p align="center">
  <a href="https://pasal.id"><img src="https://img.shields.io/badge/Legal_Data-Pasal.id-2B6150?style=flat" alt="Legal Data by Pasal.id" /></a>
  <a href="https://pasal.id/connect"><img src="https://img.shields.io/badge/MCP-Server-blue?style=flat" alt="MCP Server" /></a>
  <img src="https://img.shields.io/badge/Built_with-Opus_4.6-cc785c?style=flat&logo=anthropic&logoColor=white" alt="Built with Opus 4.6" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase" alt="Supabase" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat" alt="License: AGPL-3.0" /></a>
</p>

---

## The Problem

**280 million Indonesians** have no practical way to read their own laws. The official legal database ([peraturan.go.id](https://peraturan.go.id)) offers **only PDF downloads**: no search, no structure, no API. When you ask AI about Indonesian law, you get **hallucinated articles and wrong citations** because no grounded data source exists.

## Try It Now

Connect Claude to real Indonesian legal data in one command:

```bash
claude mcp add --transport http pasal-id https://pasal-mcp-server-production.up.railway.app/mcp
```

Then ask:

> *"Apa saja hak pekerja kontrak menurut UU Ketenagakerjaan?"* (What are contract worker rights under the Labor Law?)
> *"Jelaskan pasal tentang perlindungan data pribadi"* (Explain articles on personal data protection)
> *"Apakah UU Perkawinan 1974 masih berlaku?"* (Is the 1974 Marriage Law still in force?)

Claude searches **40,000+ regulations and 937,000+ structured articles**, cites specific Pasal (articles), and gives grounded answers. No hallucination.

Or browse the web app at **[pasal.id](https://pasal.id)**.

## What We Built

| | Feature | Description |
|---|---|---|
| **Search** | Full-Text Legal Search | Indonesian stemmer + 3-tier fallback across 937,000+ articles |
| **Read** | Structured Reader | Three-column law reader with TOC, amendment timeline, and verification badges |
| **AI** | MCP Server | 4 grounded tools giving Claude access to actual legislation with exact citations |
| **API** | REST API | Public JSON endpoints for search, browsing, and article retrieval |
| **Correct** | Crowd-Sourced Corrections | Anyone can submit corrections; AI verifies before applying |
| **Verify** | AI Verification Agent | Opus 4.6 vision compares parsed text against original PDF images |
| **Track** | Amendment Chains | Full relationship tracking: amendments, revocations, cross-references |
| **Globe** | Bilingual UI | Indonesian + English interface via next-intl (legal content stays Indonesian) |

## How Opus 4.6 Powers the Platform

The entire codebase, from the Next.js frontend to the MCP server to the data pipeline, was built with Claude Opus 4.6 via Claude Code during the hackathon period. But Opus 4.6 isn't just the development tool. It's embedded in the product itself, running a **self-improving correction flywheel** that makes the platform more accurate over time:

```
                    ┌───────────────────────────────┐
                    │     Users submit corrections   │
                    │     via pasal.id web app       │
                    └──────────────┬────────────────┘
                                   ▼
                    ┌───────────────────────────────┐
                    │  Opus 4.6 Verification Agent   │
                    │  Uses VISION to compare text   │
                    │  against original PDF images   │
                    │  → accept / reject / correct   │
                    └──────┬───────────────┬────────┘
                           │               │
              ≥85% conf    │               │    parser_feedback
              auto-apply   │               │    from each review
                           ▼               ▼
                    ┌──────────┐   ┌───────────────────────┐
                    │ Database │   │  Opus 4.6 reads the   │
                    │ updated  │   │  parser source code   │
                    │ via safe │   │  + aggregated feedback │
                    │ revision │   │  → creates GitHub     │
                    │ function │   │    issues with fixes   │
                    └──────────┘   └───────────────────────┘
```

### 1. MCP Server: Grounded Legal Access

Claude gets 4 tools to search real legislation, retrieve specific articles, check amendment status, and browse regulations. All returning real data with exact citations, not generated text.

### 2. Multimodal Verification Agent

When users submit corrections, Opus 4.6 uses **vision** to compare the parsed text against the **original PDF page image**. It reads the actual PDF, character by character, and makes accept/reject/correct decisions with confidence scores. ([`scripts/agent/opus_verify.py`](scripts/agent/opus_verify.py))

### 3. Self-Improving Feedback Loop

Every verification produces `parser_feedback`: notes on *why* the parser got it wrong. Opus 4.6 **aggregates this feedback**, **fetches the parser source code from GitHub**, analyzes systematic bugs, and **creates GitHub issues with specific code fixes**. The AI improves the pipeline that feeds it. ([`scripts/agent/parser_improver.py`](scripts/agent/parser_improver.py))

### 4. Human-in-the-Loop Safety

High-confidence corrections (≥85%) are auto-applied through a transaction-safe revision function. Below that threshold, corrections are queued for admin review. Every mutation is logged in an append-only audit trail. Nothing is silently overwritten.

### 5. Claude Code as Development Tool

The entire platform was built with Claude Code guided by **489 lines of CLAUDE.md specifications** across 4 directories (root, web app, MCP server, and data pipeline), encoding architecture decisions, coding conventions, database invariants, and domain knowledge.

## Architecture

```
                ┌──────────────────────────────────────┐
                │          Supabase (PostgreSQL)        │
                │   40,143 regulations · 937,155 Pasal  │
                │   49 migrations · FTS · RLS            │
                └─────────┬──────────────┬─────────────┘
                          │              │
         ┌────────────────┘              └────────────────┐
         ▼                                                ▼
┌─────────────────────┐                     ┌───────────────────────┐
│   MCP Server (Py)   │                     │   Next.js 16 Web App  │
│   FastMCP · Railway │                     │   Vercel · pasal.id   │
│                     │                     │                       │
│  · search_laws      │                     │  · /search            │
│  · get_pasal        │                     │  · /jelajahi          │
│  · get_law_status   │                     │  · /peraturan/[type]  │
│  · list_laws        │                     │  · /connect · /api    │
└─────────┬───────────┘                     └───────────────────────┘
          │
          ▼                                 ┌───────────────────────┐
┌─────────────────────┐                     │  Opus 4.6 Correction  │
│   Claude / AI       │                     │  Agent · Railway      │
│   Grounded answers  │                     │                       │
│   with citations    │                     │  Verify · Auto-apply  │
└─────────────────────┘                     │  Parser improvement   │
                                            └───────────────────────┘
```

## Built to Last: Technical Depth

This isn't a weekend hack. Key engineering decisions:

- **49 SQL migrations** with iterative schema evolution, not a single dump
- **3-layer search with identity fast-path**: regex-detected regulation IDs (score 1000) → works FTS (score 1-15) → content FTS with 3-tier fallback (`websearch_to_tsquery` → `plainto_tsquery` → `ILIKE`), capped candidate CTEs to prevent O(N) snippet generation
- **Append-only revision audit trail**: content is never directly UPDATE'd; all mutations go through `apply_revision()` SQL function in a single transaction (revision insert + node update + suggestion update)
- **Transaction-safe content mutations**: if any step fails, everything rolls back
- **Row-Level Security** on all tables with public read policies for legal data
- **Input sanitization**: `[^a-zA-Z0-9 ]` stripped before tsquery to prevent injection
- **ISR with on-demand revalidation** for static generation + instant updates when content changes
- **Atomic job claiming**: `FOR UPDATE SKIP LOCKED` prevents duplicate processing in the scraper pipeline
- **11 regulation types** covering laws from 1945 to 2026, from official government sources

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
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui |
| Database | Supabase (PostgreSQL FTS with `indonesian` stemmer + pg_trgm) |
| MCP Server | Python + FastMCP, deployed on Railway |
| Correction Agent | Claude Opus 4.6 (vision + code analysis), deployed on Railway |
| Data Pipeline | Python, httpx, PyMuPDF, BeautifulSoup |
| Search | 3-layer: identity fast-path → works FTS → content FTS with ILIKE fallback |
| i18n | next-intl with Indonesian (default) + English |

## Legal Coverage

Currently covers **40,143 regulations** across 11 types including:

- **UU** (Undang-Undang) · Primary laws from parliament
- **PP** (Peraturan Pemerintah) · Government regulations
- **Perpres** (Peraturan Presiden) · Presidential regulations
- **UUD** · The 1945 Constitution
- **Permen**, **Perda**, and more from official government sources

## Development

```bash
# Frontend
cd apps/web && npm install && npm run dev

# MCP Server
cd apps/mcp-server && pip install -r requirements.txt && python server.py

# Correction Agent
cd scripts && pip install -r requirements.txt
python -m scripts.agent.run_correction_agent
```

---

<p align="center">
  Built with <a href="https://anthropic.com">Claude Opus 4.6</a> for the <a href="https://cerebralvalley.ai/e/claude-code-hackathon">Claude Code Hackathon</a>
  <br />
  <a href="LICENSE">AGPL-3.0</a>
</p>
