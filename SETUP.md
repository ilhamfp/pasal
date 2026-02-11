# Pasal.id — Setup Guide & Agent Kickoff

## Part 1: Accounts & Keys to Prepare BEFORE Starting

Do all of this manually before giving the agent its first prompt.

---

### 1. Supabase Project

**Go to:** https://supabase.com/dashboard → New Project

| Setting | Value |
|---------|-------|
| Project name | `pasal-id` |
| Database password | Generate a strong one, save it |
| Region | `Southeast Asia (Singapore)` ← closest to Indonesia |
| Plan | Free tier is fine for hackathon |

**After creation, grab these from Settings → API:**

| Key | Where to find | What it looks like |
|-----|--------------|-------------------|
| `SUPABASE_URL` | Project URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | `anon` `public` key | `eyJhbGciOiJIUzI1NiIs...` (long JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` `secret` key | `eyJhbGciOiJIUzI1NiIs...` (different long JWT) |

> ⚠️ **ANON key** = safe for frontend (respects RLS policies)
> ⚠️ **SERVICE_ROLE key** = bypasses RLS, use ONLY in backend/scripts/MCP server. Never expose to browser.

**Also do this now in Supabase SQL Editor:**
```sql
CREATE EXTENSION IF NOT EXISTS ltree;
```

---

### 2. Anthropic API Key (for chat feature + MCP testing)

You already have this from the hackathon.

| Key | What it looks like |
|-----|-------------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

> Used in: the optional chat feature (Task 4.5) and for testing MCP connector via API.

---

### 3. Vercel (frontend deployment)

**Go to:** https://vercel.com → Sign up / connect GitHub

No API key needed upfront. You'll connect the GitHub repo later (Task 4.6). Just make sure your account is ready.

**For custom domain `pasal.id`:**
- In Vercel project settings → Domains → Add `pasal.id`
- Update your domain's DNS:
  - `A` record → `76.76.21.21`
  - `CNAME` for `www` → `cname.vercel-dns.com`

---

### 4. Railway (MCP server deployment)

**Go to:** https://railway.app → Sign up with GitHub

| Key | What it looks like |
|-----|-------------------|
| `RAILWAY_TOKEN` (optional) | Only if using CLI: `railway login` |

Free tier gives $5/month credit — more than enough for the hackathon. You'll deploy the MCP server here in Task 3.3.

---

### 5. Local Prerequisites

Make sure these are installed:

```bash
# Check Node.js (need 18+)
node --version

# Check Python (need 3.11+)
python3 --version

# Check Docker
docker --version

# Check Git
git --version
```

If missing anything:
```bash
# macOS
brew install node python@3.12 docker git

# Ubuntu/Debian
sudo apt install nodejs python3.12 docker.io git
```

---

## Part 2: Create the Root Environment File

Create a single `.env` file in your project root with all keys. The agent will distribute them to sub-projects.

### `.env` (project root)
```env
# Supabase
SUPABASE_URL=https://jnnqvmfhkqwfdlzevfao.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://jnnqvmfhkqwfdlzevfao.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...YOUR_ANON_JWT_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ...YOUR_SERVICE_ROLE_JWT_KEY

# Anthropic (optional — only needed for chat feature)
ANTHROPIC_API_KEY=sk-ant-...YOUR_KEY
```

The agent will read this file and create the sub-project env files (`apps/web/.env.local`, `apps/mcp-server/.env`, `scripts/.env`) as part of setup.

---

## Part 3: The Initial Agent Prompt

Copy-paste the block below as your FIRST message to Claude Code.

---

```
Read CLAUDE.md first, then start working through TASKS.md from Task 0.1.

Context:
- Supabase project is already created. Extension `ltree` is enabled. All API keys are in the root `.env` file — read it and distribute keys to `apps/web/.env.local`, `apps/mcp-server/.env`, and `scripts/.env` as described in CLAUDE.md § "Environment Variables".
- Domain pasal.id is registered and DNS is pointed to Vercel.
- We're building for the "Built with Opus 4.6" Claude Code Hackathon. Deadline is Monday Feb 16 3PM EST. Ship fast.
- After finishing each task, git commit AND push with the format: "task X.Y: description". Also commit+push mid-task whenever you have something working. We need to track progress on GitHub.
- If you get stuck on any sub-problem for more than 15 minutes (especially scraping, PDF parsing, or CSS), use the simplest fallback that works and move forward. We can polish later.

Start now with Task 0.1.
```

---

## Part 4: Helpful Follow-Up Prompts

Keep these handy for when you need to intervene or redirect the agent:

### If the agent gets stuck on scraping
```
Stop scraping. Download 5 sample PDFs manually from peraturan.go.id and put them in data/raw/. Then use pdfplumber to extract text from those 5 files. If that also fails, create hardcoded JSON files in data/parsed/ for the top 5 laws from the priority list in ARCHITECTURE.md § "Priority Laws for MVP". We need data in the database — how we get it doesn't matter for the demo.
```

### If the agent is spending too long on the frontend
```
Stop polishing the UI. We need a functional search page and a basic law reader page — that's it. No animations, no transitions, no custom components. Use basic Tailwind utilities. The demo video is the priority, not pixel-perfect design. Move to the next task.
```

### If the agent skips ahead or adds unplanned features
```
Stop. Go back to TASKS.md. What is the next unchecked task? Do only that task. Do not add features that aren't in TASKS.md. Commit what you have and move to the next sequential task.
```

### If you need to check progress
```
Give me a status report. For each task in TASKS.md (0.1 through 5.4), tell me: ✅ done, 🔧 in progress, or ⬜ not started. Also run the phase verification checks from CLAUDE.md for any completed phases and show me the output.
```

### When it's time to prioritize the demo (Saturday/Sunday)
```
We're switching to demo mode. Check TASKS.md — if Tasks 5.1 through 5.3 are not done, stop whatever you're working on and jump to Phase 5. The demo video is worth 30% of our score. A working MCP demo with 5 laws in the database is worth more than a complete website with no demo video.
```

### If the MCP server isn't connecting remotely
```
For now, skip remote deployment. Run the MCP server locally and demo it via Claude Desktop with this config in claude_desktop_config.json:

{
  "mcpServers": {
    "pasal-id": {
      "command": "python",
      "args": ["apps/mcp-server/server.py"],
      "env": {
        "SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_KEY": "your-service-role-key"
      }
    }
  }
}

This works perfectly for the demo video. We can deploy remotely after.
```

---

## Part 5: Timeline Gut-Check

| Day | Date | Goal | If Behind |
|-----|------|------|-----------|
| **Thu** | Feb 13 | Phase 0 + 1 done. Phase 2 started. DB has tables, data pipeline running. | Just get tables created and seed 5 laws manually as JSON. |
| **Fri** | Feb 14 | Phase 2 + 3 done. Data in DB with search working. MCP server working locally. | Hardcode 10 laws in parsed JSON, skip scraper entirely. |
| **Sat** | Feb 15 | Phase 4 done. Website deployed. MCP deployed remotely. | Skip website polish. Deploy MCP locally, demo via Claude Desktop. |
| **Sun** | Feb 16 AM | Phase 5. Record demo video. Write README. | This is the ONLY thing that matters today. |
| **Sun** | Feb 16 3PM | SUBMIT. | Submit whatever you have. A rough submission beats no submission. |

---

## Quick Reference: Full Env Var Map

| Root `.env` Variable | Distributed To | Used For |
|---------------------|---------------|----------|
| `SUPABASE_URL` | `apps/mcp-server/.env`, `scripts/.env` | Backend Supabase access |
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` | Frontend Supabase access (browser-safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Frontend auth (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/mcp-server/.env` as `SUPABASE_KEY`, `scripts/.env` as `SUPABASE_KEY` | **Secret** — bypasses RLS, backend only |
| `ANTHROPIC_API_KEY` | `apps/web/.env.local` | Optional chat feature |