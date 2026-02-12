# Pasal.id — Build Tasks

> **How to use this file:** Work through tasks in order. Each task is atomic — complete it fully before moving to the next. When a task says `📖 See ARCHITECTURE.md § [section]`, open that section for schema details, code patterns, or context. Do NOT try to read the entire architecture doc at once.
>
> **Stack:** Next.js 14+ (App Router) on Vercel, Supabase (Postgres), Python (FastMCP) for MCP server + scraper, deployed on Railway/Fly.io
> **Search:** Keyword-only (PostgreSQL full-text search with Indonesian stemmer) for MVP. Vector search is a post-MVP upgrade.
>
> **Deadline:** Monday Feb 16, 3:00 PM EST

---

## Phase 0: Project Scaffolding [~1 hour]

### Task 0.1 — Initialize monorepo structure

Create the project root with this structure:

```
pasal-id/
├── apps/
│   ├── web/              # Next.js frontend
│   └── mcp-server/       # Python FastMCP server
├── packages/
│   └── supabase/         # Supabase migrations & seed data
├── scripts/              # Data pipeline scripts (Python)
│   ├── scraper/
│   └── parser/
├── data/                 # Downloaded/processed legal data (gitignored)
│   ├── raw/              # Raw PDFs
│   └── parsed/           # Extracted JSON
├── README.md
├── LICENSE               # MIT
└── .gitignore
```

**Actions:**
1. `mkdir -p` the full directory tree
2. Initialize git repo
3. Create `.gitignore` (include `data/raw/`, `data/parsed/`, `node_modules/`, `.env*`, `__pycache__/`, `.next/`)
4. Create a placeholder `README.md` with project name and one-liner: "Democratizing Indonesian Law — The First Open, AI-Native Legal Platform"
5. Add MIT LICENSE file

**Done when:** `git status` shows clean repo with structure in place.

---

### Task 0.2 — Initialize Next.js app

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Actions:**
1. Create the Next.js app with App Router
2. Install Supabase client: `npm install @supabase/supabase-js @supabase/ssr`
3. Create `.env.local` with placeholders:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```
4. Create `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` using `@supabase/ssr`
5. Verify `npm run dev` works

📖 See ARCHITECTURE.md § "Next.js + Supabase Client Setup" for the exact server/client utility code.

**Done when:** Next.js app runs at localhost:3000 with Supabase clients configured.

---

### Task 0.3 — Initialize Python environment for scripts + MCP server

```bash
cd apps/mcp-server
python -m venv .venv
source .venv/bin/activate
```

**Actions:**
1. Create `apps/mcp-server/requirements.txt`:
   ```
   fastmcp>=2.0
   httpx
   supabase
   pydantic
   uvicorn
   ```
2. Create `scripts/requirements.txt`:
   ```
   httpx
   beautifulsoup4
   pdfplumber
   pytesseract
   pdf2image
   supabase
   tqdm
   ```
3. Install both: `pip install -r requirements.txt`
4. Create `apps/mcp-server/server.py` with a hello-world FastMCP server:
   ```python
   from fastmcp import FastMCP
   mcp = FastMCP("Pasal.id")
   
   @mcp.tool
   def ping() -> str:
       """Health check."""
       return "Pasal.id MCP server is running"
   
   if __name__ == "__main__":
       mcp.run(transport="streamable-http", port=8000)
   ```
5. Verify server starts: `python server.py`

**Done when:** MCP server responds to ping tool call.

---

## Phase 1: Database Setup [~2 hours]

### Task 1.1 — Create Supabase project and enable extensions

**Actions:**
1. Go to supabase.com → New Project → name it `pasal-id` (region: Singapore)
2. Save the project URL and anon key to `apps/web/.env.local`
3. In Supabase SQL Editor, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS ltree;
   ```
4. Verify with: `SELECT * FROM pg_extension WHERE extname = 'ltree';`

**Done when:** ltree extension is active on the Supabase project.

---

### Task 1.2 — Create core database tables

📖 See ARCHITECTURE.md § "Database Schema" for the complete SQL.

Run these migrations in order via Supabase SQL Editor (or save as migration files in `packages/supabase/migrations/`):

**Migration 001 — Enums and reference tables:**
```sql
-- Regulation types
CREATE TABLE regulation_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_id VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    hierarchy_level INTEGER NOT NULL,
    description TEXT
);

-- Seed the 7 hierarchy levels + common extras
INSERT INTO regulation_types (code, name_id, name_en, hierarchy_level) VALUES
    ('UUD', 'Undang-Undang Dasar 1945', 'Constitution', 1),
    ('TAP_MPR', 'Ketetapan MPR', 'MPR Resolution', 2),
    ('UU', 'Undang-Undang', 'Law', 3),
    ('PERPPU', 'Peraturan Pemerintah Pengganti Undang-Undang', 'Government Regulation in Lieu of Law', 3),
    ('PP', 'Peraturan Pemerintah', 'Government Regulation', 4),
    ('PERPRES', 'Peraturan Presiden', 'Presidential Regulation', 5),
    ('PERDA_PROV', 'Peraturan Daerah Provinsi', 'Provincial Regulation', 6),
    ('PERDA_KAB', 'Peraturan Daerah Kabupaten/Kota', 'District/City Regulation', 7),
    ('PERMEN', 'Peraturan Menteri', 'Ministerial Regulation', 8),
    ('PERMA', 'Peraturan Mahkamah Agung', 'Supreme Court Regulation', 8),
    ('PBI', 'Peraturan Bank Indonesia', 'Bank Indonesia Regulation', 8);

-- Relationship types between laws
CREATE TABLE relationship_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_id VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

INSERT INTO relationship_types (code, name_id, name_en) VALUES
    ('mengubah', 'Mengubah', 'Amends'),
    ('diubah_oleh', 'Diubah oleh', 'Amended by'),
    ('mencabut', 'Mencabut', 'Revokes'),
    ('dicabut_oleh', 'Dicabut oleh', 'Revoked by'),
    ('melaksanakan', 'Melaksanakan', 'Implements'),
    ('dilaksanakan_oleh', 'Dilaksanakan oleh', 'Implemented by'),
    ('merujuk', 'Merujuk', 'References');
```

**Migration 002 — Works (regulations) table:**
```sql
CREATE TABLE works (
    id SERIAL PRIMARY KEY,
    frbr_uri VARCHAR(255) UNIQUE NOT NULL,
    regulation_type_id INTEGER NOT NULL REFERENCES regulation_types(id),
    number VARCHAR(50),
    year INTEGER NOT NULL,
    title_id TEXT NOT NULL,
    title_en TEXT,
    date_enacted DATE,
    date_promulgated DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'berlaku'
        CHECK (status IN ('berlaku', 'dicabut', 'diubah', 'tidak_berlaku')),
    publication_name VARCHAR(200),
    publication_number VARCHAR(50),
    supplement_number VARCHAR(50),
    subject_tags TEXT[] DEFAULT '{}',
    source_url TEXT,
    source_pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_works_type ON works(regulation_type_id);
CREATE INDEX idx_works_year ON works(year);
CREATE INDEX idx_works_status ON works(status);
CREATE INDEX idx_works_frbr ON works(frbr_uri);
CREATE INDEX idx_works_tags ON works USING GIN(subject_tags);
```

**Migration 003 — Document structure (articles/chapters):**
```sql
CREATE TABLE document_nodes (
    id SERIAL PRIMARY KEY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    node_type VARCHAR(20) NOT NULL
        CHECK (node_type IN ('bab','bagian','paragraf','pasal','ayat','penjelasan_umum','penjelasan_pasal')),
    number VARCHAR(50),
    heading TEXT,
    content_text TEXT,
    parent_id INTEGER REFERENCES document_nodes(id),
    path LTREE,
    depth INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS ltree;
CREATE INDEX idx_nodes_work ON document_nodes(work_id);
CREATE INDEX idx_nodes_type ON document_nodes(node_type);
CREATE INDEX idx_nodes_parent ON document_nodes(parent_id);
CREATE INDEX idx_nodes_path ON document_nodes USING GIST(path);
```

**Migration 004 — Relationships between laws:**
```sql
CREATE TABLE work_relationships (
    id SERIAL PRIMARY KEY,
    source_work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    target_work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    relationship_type_id INTEGER NOT NULL REFERENCES relationship_types(id),
    notes TEXT,
    UNIQUE(source_work_id, target_work_id, relationship_type_id)
);

CREATE INDEX idx_rel_source ON work_relationships(source_work_id);
CREATE INDEX idx_rel_target ON work_relationships(target_work_id);
```

**Migration 005 — Search chunks (for full-text search):**
```sql
CREATE TABLE legal_chunks (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    node_id INTEGER REFERENCES document_nodes(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    content_en TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('indonesian', content)) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_work ON legal_chunks(work_id);
CREATE INDEX idx_chunks_fts ON legal_chunks USING GIN(fts);
CREATE INDEX idx_chunks_metadata ON legal_chunks USING GIN(metadata);
```

**Migration 006 — Full-text search function:**

```sql
CREATE OR REPLACE FUNCTION search_legal_chunks(
    query_text TEXT,
    match_count INT DEFAULT 10,
    metadata_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    work_id INTEGER,
    content TEXT,
    metadata JSONB,
    score FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        lc.id,
        lc.work_id,
        lc.content,
        lc.metadata,
        ts_rank_cd(lc.fts, websearch_to_tsquery('indonesian', query_text))::float AS score
    FROM legal_chunks lc
    WHERE lc.fts @@ websearch_to_tsquery('indonesian', query_text)
        AND (metadata_filter = '{}'::jsonb OR lc.metadata @> metadata_filter)
    ORDER BY score DESC
    LIMIT match_count;
$$;
```

**Migration 007 — Row Level Security:**
```sql
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_relationships ENABLE ROW LEVEL SECURITY;

-- Public read access for all legal data
CREATE POLICY "Public read works" ON works FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read nodes" ON document_nodes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read chunks" ON legal_chunks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read rels" ON work_relationships FOR SELECT TO anon, authenticated USING (true);
```

**Done when:** All tables exist, seed data in `regulation_types` and `relationship_types`, RLS policies active, `search_legal_chunks` function callable via `supabase.rpc('search_legal_chunks', ...)`.

---

## Phase 2: Data Pipeline [~6 hours]

### Task 2.1 — Acquire seed data from existing open sources

**Priority order — stop as soon as you have enough data for the MVP:**

**Option A (fastest, ~30 min):** Clone the Open-Technology-Foundation corpus.
```bash
cd data/
git clone https://github.com/Open-Technology-Foundation/peraturan.go.id.git raw/otf-corpus
```
This contains 5,817 documents processed into 541,445 text segments. Check if the format is directly usable (it may be plain text files organized by law). If usable, skip to Task 2.3.

**Option B (1-2 hours):** Download from HuggingFace.
```bash
pip install datasets
python -c "
from datasets import load_dataset
ds = load_dataset('Azzindani/Indonesian_Legal_QA')
ds.to_json('data/raw/indo_legal_qa.json')
"
```
Also check HuggingFace for pre-processed datasets: `Azzindani/Indonesian_Legal_QA`.

**Option C (4-6 hours):** Build a targeted scraper for the 20 most important laws.
📖 See ARCHITECTURE.md § "Priority Laws for MVP" for the list of laws to scrape.
📖 See ARCHITECTURE.md § "Scraper Code Pattern" for the httpx + BeautifulSoup code.

**Done when:** You have raw text content for at least 20-50 Indonesian laws in `data/raw/`.

---

### Task 2.2 — Parse legal documents into structured JSON

Create `scripts/parser/parse_law.py`:

📖 See ARCHITECTURE.md § "Document Structure" for how Indonesian laws are organized (Bab → Bagian → Paragraf → Pasal → Ayat).

**Input:** Raw text file or PDF of a law.
**Output:** JSON file in `data/parsed/{frbr_uri}.json` with this structure:

```json
{
  "frbr_uri": "/akn/id/act/uu/2003/13",
  "type": "UU",
  "number": "13",
  "year": 2003,
  "title_id": "Undang-Undang Republik Indonesia Nomor 13 Tahun 2003 Tentang Ketenagakerjaan",
  "title_en": "Law Number 13 of 2003 on Manpower",
  "status": "diubah",
  "source_url": "https://peraturan.go.id/id/uu-no-13-tahun-2003",
  "nodes": [
    {
      "type": "bab",
      "number": "I",
      "heading": "Ketentuan Umum",
      "children": [
        {
          "type": "pasal",
          "number": "1",
          "content": "Dalam undang-undang ini yang dimaksud dengan:...",
          "children": [
            {
              "type": "ayat",
              "number": "1",
              "content": "Ketenagakerjaan adalah..."
            }
          ]
        }
      ]
    }
  ]
}
```

**The parser should:**
1. Detect `BAB [roman numeral]` → chapter boundaries
2. Detect `Bagian [ordinal]` → section boundaries  
3. Detect `Paragraf [number]` → paragraph group boundaries
4. Detect `Pasal [number]` → article boundaries
5. Detect `\([number]\)` at start of line → ayat boundaries
6. Detect `PENJELASAN` section → separate penjelasan nodes
7. Handle edge cases: multi-line articles, nested numbering (a, b, c within ayat)

**Use regex patterns:**
```python
BAB_PATTERN = r'^BAB\s+([IVXLCDM]+)\s*\n(.+)'
PASAL_PATTERN = r'^Pasal\s+(\d+)'
AYAT_PATTERN = r'^\((\d+)\)\s+'
BAGIAN_PATTERN = r'^Bagian\s+(Kesatu|Kedua|Ketiga|Keempat|Kelima|Keenam|Ketujuh|Kedelapan|Kesembilan|Kesepuluh)'
```

**Done when:** At least 20 laws parsed into valid JSON in `data/parsed/`.

---

### Task 2.3 — Load parsed data into Supabase

Create `scripts/loader/load_to_supabase.py`:

**Actions:**
1. Read each JSON file from `data/parsed/`
2. Insert into `works` table (metadata)
3. Recursively insert into `document_nodes` table (structured content)
4. Generate search chunks: one chunk per Pasal, prepend context (law title + chapter heading)
5. Insert chunks into `legal_chunks` table

**Chunking rules:**
- One chunk per Pasal (article) — this is the primary search unit
- Prepend: `"{law_title}\n{bab_heading}\n{pasal_number}\n"` for better keyword search context
- If a Pasal exceeds 800 tokens, split by Ayat
- Target: 200-500 tokens per chunk
- Store metadata JSON: `{"type": "UU", "number": "13", "year": 2003, "pasal": "5", "bab": "II"}`

**Done when:** `SELECT COUNT(*) FROM works` returns 20+, `SELECT COUNT(*) FROM legal_chunks` returns 500+.

---

### Task 2.4 — Test full-text search end-to-end

Run test queries against the `search_legal_chunks` function:

```sql
-- Test 1: Search for labor law
SELECT * FROM search_legal_chunks('ketenagakerjaan pekerja', 5, '{}'::jsonb);

-- Test 2: Search with metadata filter
SELECT * FROM search_legal_chunks('upah minimum', 5, '{"type": "UU"}'::jsonb);

-- Test 3: Search for specific article reference
SELECT * FROM search_legal_chunks('cuti hamil pekerja', 5, '{}'::jsonb);
```

**Also test from JavaScript:**
```javascript
const { data } = await supabase.rpc('search_legal_chunks', {
    query_text: 'upah minimum pekerja',
    match_count: 5
});
console.log(data);
```

**Done when:** Keyword queries return relevant legal chunks with scores. At least 3 of the test queries above return meaningful results.

---

## Phase 3: MCP Server [~2 hours]

### Task 3.1 — Implement core MCP tools

📖 See ARCHITECTURE.md § "MCP Tools Specification" for input/output schemas.

Edit `apps/mcp-server/server.py`. Implement these 4 tools:

**Tool 1: `search_laws`**
- Input: `query: str`, `regulation_type: str | None`, `year_from: int | None`, `year_to: int | None`, `limit: int = 10`
- Logic: Call `search_legal_chunks` RPC with query → enrich results with work metadata
- Output: List of `{law_title, law_number, year, pasal, snippet, relevance_score}`

**Tool 2: `get_pasal`**
- Input: `law_type: str`, `law_number: str`, `year: int`, `pasal_number: str`
- Logic: Look up work by type+number+year → fetch document_node where type='pasal' and number matches
- Output: `{law_title, pasal_number, content_id, content_en, chapter, status}`
- **Important:** Include both Indonesian text and English summary (generate with Claude if needed)

**Tool 3: `get_law_status`**
- Input: `law_type: str`, `law_number: str`, `year: int`
- Logic: Look up work → fetch all relationships from `work_relationships` → return status + amendment chain
- Output: `{status, amendment_history: [{amended_by, date, description}], related_laws: [...]}`

**Tool 4: `list_laws`**
- Input: `regulation_type: str | None`, `year: int | None`, `status: str | None`, `page: int = 1`, `per_page: int = 20`
- Logic: Simple paginated query on `works` table with filters
- Output: `{total, page, laws: [{frbr_uri, title, number, year, status}]}`

**Done when:** All 4 tools respond correctly when tested with `fastmcp dev server.py`.

---

### Task 3.2 — Deploy MCP server as remote endpoint

**Option A (recommended for hackathon): Railway**
1. Create `Dockerfile` in `apps/mcp-server/`:
   ```dockerfile
   FROM python:3.12-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   CMD ["python", "server.py"]
   ```
2. Create `railway.toml` or use Railway CLI
3. Deploy with environment variables
4. Note the public URL: `https://pasal-id-mcp.up.railway.app`

**Option B: Fly.io**
1. `fly launch` in `apps/mcp-server/`
2. Set secrets: `fly secrets set SUPABASE_URL=... SUPABASE_KEY=...`
3. Deploy: `fly deploy`

**Test remote MCP:**
```bash
# Using Claude Code CLI
claude mcp add pasal-id --transport http --url https://your-deployed-url/mcp/
```

**Done when:** MCP server is accessible at a public URL and responds to tool calls.

---

## Phase 4: Frontend [~6 hours]

### Task 4.1 — Build the landing page with search

📖 See ARCHITECTURE.md § "Frontend Architecture" for component structure.

Create `apps/web/src/app/page.tsx`:

**Design:**
- Full-screen hero with large search bar centered (think Google.com but for Indonesian law)
- Heading: "Pasal.id" with tagline "Cari hukum Indonesia dengan mudah"
- Below search bar: quick filter chips for law types (UU, PP, Perpres, Permen)
- Below that: stats bar showing "X undang-undang · Y peraturan · Z pasal tersedia"
- Footer: "Open Source · Free Forever · Powered by Claude"

**Components to create:**
- `src/components/SearchBar.tsx` — client component with debounced input, type-ahead
- `src/components/LawTypeChips.tsx` — filter chips
- `src/components/StatsBar.tsx` — server component fetching counts from Supabase

**Done when:** Landing page renders with working search input that navigates to `/search?q=...`.

---

### Task 4.2 — Build the search results page

Create `apps/web/src/app/search/page.tsx` as a **Server Component**:

**Actions:**
1. Read `searchParams.q` and optional filters
2. Call `search_legal_chunks` RPC from Supabase (keyword search — no embeddings needed)
4. Render results as cards:
   ```
   ┌──────────────────────────────────────────────┐
   │ 🏛️ UU 13/2003 · Ketenagakerjaan              │
   │ Pasal 81 · Bab XII Pemutusan Hubungan Kerja  │
   │                                               │
   │ "Setiap pekerja/buruh yang mengalami PHK..."  │
   │                                               │
   │ Status: ⚠️ Diubah oleh UU 6/2023             │
   │ [Baca Selengkapnya →]                         │
   └──────────────────────────────────────────────┘
   ```
5. Add `<Suspense>` boundary with skeleton loader
6. Include filter sidebar: by type, year range, status

**Done when:** `/search?q=upah+minimum` returns relevant results with clickable cards.

---

### Task 4.3 — Build the law detail / reader page

Create `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`:

**Layout — 3-column:**
```
┌─────────────┬──────────────────────────┬──────────────┐
│ Table of    │ Law Content              │ Context      │
│ Contents    │                          │ Panel        │
│             │ BAB I                    │              │
│ > Bab I     │ KETENTUAN UMUM          │ Status:      │
│   > Pasal 1 │                          │ ✅ Berlaku   │
│   > Pasal 2 │ Pasal 1                 │              │
│ > Bab II    │ Dalam undang-undang ini  │ Diubah oleh: │
│   > Pasal 3 │ yang dimaksud dengan:    │ • UU 6/2023  │
│   ...       │ (1) Ketenagakerjaan...   │              │
│             │                          │ Dasar Hukum: │
│             │ [📋 Copy as JSON]        │ • UUD 1945   │
│             │                          │ • UU 3/1992  │
└─────────────┴──────────────────────────┴──────────────┘
```

**Actions:**
1. Fetch work + document_nodes from Supabase by `frbr_uri` derived from URL params
2. Build Table of Contents from document_nodes tree (Bab → Pasal)
3. Render content with proper heading hierarchy
4. Add "Copy as JSON" button next to each Pasal (outputs the structured JSON for that article)
5. Right sidebar: law status, relationships (amends/amended by), metadata
6. Use ISR: `export const revalidate = 86400` (24 hours)
7. Generate static params for top 20 laws: `export async function generateStaticParams()`

**Done when:** `/peraturan/uu/uu-13-2003` renders full law with TOC navigation and context panel.

---

### Task 4.4 — Build the "Connect to Claude" section

Create `apps/web/src/app/connect/page.tsx` (or a section on the landing page):

**Content:**
1. Heading: "Connect Pasal.id to Claude"
2. Subheading: "Give Claude direct access to Indonesian law — no hallucinations, real citations."
3. Code block with install command:
   ```
   claude mcp add pasal-id --transport http --url https://mcp.pasal.id/mcp/
   ```
4. Copy button for the command
5. "Try it now" section with example prompts:
   - "Jelaskan Pasal 81 UU Cipta Kerja tentang ketenagakerjaan"
   - "Apakah UU Perkawinan 1974 masih berlaku?"
   - "Apa hak pekerja kontrak menurut hukum Indonesia?"
6. Brief explanation of what MCP is (2-3 sentences, link to modelcontextprotocol.io)

**Done when:** Page renders with copyable MCP install command and example prompts.

---

### Task 4.5 — Build the "Ask AI" chat interface

Create a simple chat component that calls Claude API with MCP tools:

**File:** `apps/web/src/app/ask/page.tsx`

**Architecture:**
1. Client component with chat UI (message list + input)
2. API route `apps/web/src/app/api/chat/route.ts` that:
   - Accepts user message
   - Calls Anthropic API with MCP connector pointing to your deployed MCP server
   - Streams response back
3. Display cited sources inline (when Claude uses `get_pasal`, show the source card)

**This is a BONUS feature.** If time is tight, skip this and focus on the demo video showing Claude Desktop + MCP instead.

**Done when:** User can ask a legal question and get a cited response powered by Claude + Pasal.id MCP.

---

### Task 4.6 — Deploy frontend to Vercel

**Actions:**
1. Push code to GitHub
2. Import repo in Vercel → select `apps/web` as root directory
3. Set environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Set custom domain if available: `pasal.id` or use Vercel default
5. Verify all pages render correctly in production

**Done when:** Site is live at a public URL with search, reader, and connect pages working.

---

## Phase 5: Polish & Demo [~4 hours]

### Task 5.1 — Seed the "wow" demo data

Make sure these specific laws are fully parsed, embedded, and browsable (these are your demo scripts):

1. **UU 13/2003 (Ketenagakerjaan / Labor Law)** — 193 articles, most referenced employment law
2. **UU 6/2023 (Cipta Kerja / Omnibus Job Creation)** — massive amendment to #1
3. **UU 1/1974 (Perkawinan / Marriage Law)** — famous for the marriage age controversy
4. **UU 16/2019 (Amendment to Marriage Law)** — raised marriage age
5. **KUHP / UU 1/2023 (New Criminal Code)** — recent and controversial

Also ensure `work_relationships` are populated:
- UU 6/2023 `mengubah` UU 13/2003
- UU 16/2019 `mengubah` UU 1/1974

**Done when:** All 5 laws are browsable with complete article structure and cross-references.

---

### Task 5.2 — Write README.md

**Structure:**
1. Project name + tagline + badge row (license, deploy status)
2. **The Problem** (3-4 sentences): 280M Indonesians can't access their own laws digitally
3. **The Solution** (3-4 sentences): Open, AI-native legal platform + MCP server
4. **Demo Video** (embedded YouTube/Loom link)
5. **Quick Start** — `claude mcp add pasal-id ...`
6. **Architecture** (one diagram showing: User/Claude → MCP Server → Supabase → peraturan.go.id)
7. **Tech Stack** (badges: Next.js, Supabase, Python, FastMCP, Vercel)
8. **Data Sources** (list with links)
9. **Contributing** 
10. **License** (MIT)

**Done when:** README is compelling enough that a judge spends 60 seconds reading it and understands the project.

---

### Task 5.3 — Record 3-minute demo video

📖 See ARCHITECTURE.md § "Demo Script" for the beat-by-beat script.

**Equipment:** Screen recording (OBS/Loom) + mic. No slides needed.

**Script (timed):**

**[0:00-0:30] The Problem**
- Show peraturan.go.id — click a law, get a PDF download. "This is how 280 million Indonesians access their laws."
- Show Hukumonline paywall. "Or they pay for this."

**[0:30-1:00] The Solution — Website**
- Open pasal.id → search "ketenagakerjaan" → click result
- Show the structured reader with TOC, clickable articles, "Copy as JSON" button
- Quick flash of the relationships sidebar: "This law was amended by UU 6/2023"

**[1:00-2:15] The Magic — Claude + MCP (THIS IS THE MONEY SHOT)**
- Open Claude Desktop (or Claude Code terminal)
- Show that Pasal.id MCP is connected
- **Demo 1 — Side-by-side:** Ask vanilla Claude: "Berapa usia minimum menikah di Indonesia?" → Claude gives uncertain or wrong answer
- Ask Claude with Pasal.id: same question → Claude calls `search_laws`, `get_pasal`, returns: "Menurut Pasal 7 UU 16/2019, usia minimum perkawinan adalah 19 tahun" with exact citation
- **Demo 2 — Complex reasoning:** "Bandingkan hak pekerja kontrak sebelum dan sesudah UU Cipta Kerja" → Claude pulls articles from both UU 13/2003 and UU 6/2023, produces comparative analysis

**[2:15-2:45] Technical Depth**
- Quick architecture slide/diagram
- "We built a data pipeline that processes Indonesian legal PDFs into structured, searchable data"
- "Our MCP server exposes 4 tools that ground Claude's responses in actual legislation"

**[2:45-3:00] Close**
- "Pasal.id is fully open source. Free forever. Install it now: `claude mcp add pasal-id`"
- Show GitHub link

**Done when:** 3-minute video recorded, uploaded to YouTube/Loom.

---

### Task 5.4 — Submit to hackathon

**Go to:** https://cerebralvalley.ai/e/claude-code-hackathon/hackathon/submit

**Required:**
1. Demo video URL (YouTube/Loom)
2. GitHub repository URL (must be public, open source)
3. Written description (100-200 words):

> **Pasal.id: Democratizing Indonesian Law**
>
> 280 million Indonesians access their laws through government PDFs and expensive paywalls. Pasal.id breaks these barriers with the first open, AI-native Indonesian legal platform.
>
> We built a complete data pipeline that transforms Indonesia's official legal database (peraturan.go.id) into structured, searchable data. Our web interface provides instant full-text search across Indonesian legislation, with a structured reader that makes dense legal text navigable.
>
> The core innovation is our MCP server — the first for Indonesian law — which gives Claude direct, grounded access to actual legislation. When connected, Claude can answer complex legal questions with exact article citations instead of hallucinating. We demonstrate this with side-by-side comparisons showing Claude going from uncertain guesses to precise, sourced legal analysis.
>
> Built with: Next.js, Supabase (PostgreSQL full-text search), Python FastMCP, Opus 4.6 for PDF structuring.

**Deadline:** Monday February 16, 3:00 PM EST.

**Done when:** Submission confirmed on platform.

---

## Appendix: Priority if Running Out of Time

If you're behind schedule, here's what to cut (in order):

1. **Cut first:** Task 4.5 (Chat interface) — demo via Claude Desktop instead
2. **Cut second:** Task 4.4 (Connect page) — just put the MCP command in README
3. **Cut third:** Task 4.3 columns 1 & 3 (TOC and context panel) — just show article content
4. **Cut fourth:** Complex parsing (Task 2.2) — use raw text chunks without Bab/Pasal structure
5. **NEVER cut:** The side-by-side demo (Task 5.3 [1:00-2:15]) — this IS your submission

**Minimum viable submission:** Supabase with chunked legal text + working MCP server with keyword search + 3-minute video showing Claude answering legal questions with citations. The website is secondary to the MCP demo for this hackathon.
