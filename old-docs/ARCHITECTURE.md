# Pasal.id — Architecture Reference

> **How to use this file:** This is a reference document. Don't read it top to bottom. Jump to the section referenced by your current task in `TASKS.md` using the § headers.

---

## § Indonesian Legal Hierarchy

Indonesia's regulation hierarchy is defined in **Pasal 7(1) UU 12/2011**, unchanged by amendments UU 15/2019 and UU 13/2022:

| Rank | Code | Indonesian Name | English Name | Issued By |
|------|------|----------------|--------------|-----------|
| 1 | UUD | Undang-Undang Dasar 1945 | Constitution | MPR |
| 2 | TAP_MPR | Ketetapan MPR | Assembly Resolution | MPR |
| 3 | UU | Undang-Undang | Law | DPR + President |
| 3 | PERPPU | Peraturan Pemerintah Pengganti UU | Emergency Government Regulation | President |
| 4 | PP | Peraturan Pemerintah | Government Regulation | President |
| 5 | PERPRES | Peraturan Presiden | Presidential Regulation | President |
| 6 | PERDA_PROV | Peraturan Daerah Provinsi | Provincial Regulation | Governor + DPRD |
| 7 | PERDA_KAB | Peraturan Daerah Kabupaten/Kota | District/City Regulation | Bupati/Walikota + DPRD |

**Additional types (Pasal 8 — outside hierarchy but legally binding):**
- PERMEN (Ministerial Regulation)
- PERMA (Supreme Court Regulation)  
- PBI (Bank Indonesia Regulation)
- POJK (OJK Regulation)
- PERGUB (Governor Regulation — implementing Perda)
- PERBUP/PERWALI (Regent/Mayor Regulation)
- PERDES (Village Regulation)
- QANUN (Aceh provincial regulation = Perda)

**NOT legislation (policy rules / beleidsregels):**
- Surat Edaran (Circular Letter) — cannot create new norms
- Instruksi Presiden (Presidential Instruction)
- Keputusan (Decisions — individual/beschikking, not general/regeling)

**Override principles:**
- *lex superior derogat legi inferiori* — higher rank wins
- *lex specialis derogat legi generali* — specific wins over general
- *lex posterior derogat legi priori* — later law wins (same rank)

---

## § Document Structure

Every Indonesian regulation follows this nesting pattern:

```
Regulation (UU/PP/etc)
├── Konsiderans (Preamble)
│   ├── Menimbang (Considering) — reasons
│   └── Mengingat (In view of) — legal basis references
├── MEMUTUSKAN / Menetapkan
├── Batang Tubuh (Body)
│   ├── BAB I (Chapter)
│   │   ├── Bagian Kesatu (Section)
│   │   │   ├── Paragraf 1 (Paragraph group)
│   │   │   │   ├── Pasal 1 (Article)
│   │   │   │   │   ├── Ayat (1) (Sub-article)
│   │   │   │   │   │   ├── huruf a. (Letter item)
│   │   │   │   │   │   │   └── angka 1. (Numbered sub-item)
│   │   │   │   │   │   └── huruf b.
│   │   │   │   │   └── Ayat (2)
│   │   │   │   └── Pasal 2
│   │   │   └── Paragraf 2
│   │   └── Bagian Kedua
│   └── BAB II
├── Ketentuan Peralihan (Transitional Provisions)
├── Ketentuan Penutup (Closing Provisions)
└── PENJELASAN (Elucidation — published separately in Tambahan LN)
    ├── I. UMUM (General Explanation)
    └── II. PASAL DEMI PASAL (Article-by-Article)
        ├── Pasal 1: "Cukup jelas" / explanation
        ├── Pasal 2: explanation text
        └── ...
```

**Key facts about Penjelasan:**
- Has binding legal force (promulgated in Tambahan Lembaran Negara)
- Must NOT contain new norms, expand/narrow scope, or repeat body text
- "Cukup jelas" = self-explanatory, no further explanation needed
- Store as separate content linked to the same work

---

## § Document Node Types for Database

Use these `node_type` values in `document_nodes`:

| node_type | Indonesian | Regex Pattern | Example |
|-----------|-----------|---------------|---------|
| `bab` | BAB | `^BAB\s+([IVXLCDM]+)` | BAB I, BAB XII |
| `bagian` | Bagian | `^Bagian\s+(Ke\w+)` | Bagian Kesatu |
| `paragraf` | Paragraf | `^Paragraf\s+(\d+)` | Paragraf 1 |
| `pasal` | Pasal | `^Pasal\s+(\d+)` | Pasal 81 |
| `ayat` | Ayat | `^\((\d+)\)` | (1), (2) |
| `penjelasan_umum` | Penjelasan Umum | `^I\.\s*UMUM` | — |
| `penjelasan_pasal` | Penjelasan Pasal | `^Pasal\s+(\d+)` (within Penjelasan section) | — |

**Numbering conventions:**
- BAB: Roman numerals (I, II, III, IV, V, ...)
- Bagian: Indonesian ordinals (Kesatu, Kedua, Ketiga, Keempat, Kelima, Keenam, ...)
- Paragraf: Arabic numerals (1, 2, 3)
- Pasal: Arabic numerals (1, 2, 3, ..., can exceed 200+)
- Ayat: Arabic in parentheses ( (1), (2), (3) )
- Huruf: lowercase letters with period (a., b., c.)
- Angka: Arabic numerals with period (1., 2., 3.)

---

## § FRBR URI Convention

Follow Akoma Ntoso / Laws.Africa naming:

```
/akn/{country}/{doctype}/{subtype}/{year}/{number}

Examples:
/akn/id/act/uu/2003/13          → UU No. 13 Tahun 2003
/akn/id/act/perppu/2020/1       → Perppu No. 1 Tahun 2020
/akn/id/act/pp/2021/35          → PP No. 35 Tahun 2021
/akn/id/act/perpres/2023/5      → Perpres No. 5 Tahun 2023
/akn/id/act/permen-ketenagakerjaan/2024/1  → Permen specific ministry
```

For URL slugs on the website, use: `uu-13-2003`, `pp-35-2021`, etc.

---

## § Database Schema

### Complete SQL (copy-paste ready)

See TASKS.md Task 1.2 for the migration-by-migration SQL. Below are supplementary details.

### Keyword Search Function (MVP)

PostgreSQL's built-in full-text search with the `indonesian` text configuration handles Indonesian morphology (me-, ber-, per-, -kan, -an prefixes/suffixes). This is the MVP search — vector search can be added later.

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

**Usage from JavaScript:**
```javascript
const { data, error } = await supabase.rpc('search_legal_chunks', {
    query_text: 'upah minimum pekerja kontrak',
    match_count: 10,
    metadata_filter: { type: 'UU' }  // optional filter
});
```

**Tuning tips:**
- `websearch_to_tsquery` supports natural language input: `"cuti AND hamil"`, `"pekerja OR buruh"`, `"-magang"` (exclude)
- The `indonesian` config stems words: "pekerja", "pekerjaan", "bekerja" all match each other
- For exact phrase search, use `plainto_tsquery` instead
- Add `ts_headline()` in the SELECT to get highlighted snippets:
  ```sql
  ts_headline('indonesian', lc.content, websearch_to_tsquery('indonesian', query_text),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') AS snippet
  ```

---

## § Next.js + Supabase Client Setup

### Server client (for Server Components, Route Handlers, Server Actions)

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Component context — cannot write cookies
                    }
                },
            },
        }
    );
}
```

### Browser client (for Client Components)

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
```

### Middleware (refresh auth session on every request)

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options));
                },
            },
        }
    );
    await supabase.auth.getUser(); // refresh session
    return supabaseResponse;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

## § Frontend Architecture

### Route structure

```
src/app/
├── page.tsx                          # Landing + search hero
├── search/
│   └── page.tsx                      # Search results (dynamic, Server Component)
├── peraturan/
│   └── [type]/
│       ├── page.tsx                  # Browse by type (e.g., /peraturan/uu)
│       └── [slug]/
│           └── page.tsx              # Law detail reader (ISR, 24h revalidate)
├── connect/
│   └── page.tsx                      # MCP installation guide
├── ask/
│   └── page.tsx                      # Chat with Claude (BONUS — skip if short on time)
├── api/
│   ├── search/route.ts               # Search API endpoint
│   └── chat/route.ts                 # Claude API proxy (BONUS)
├── layout.tsx
└── not-found.tsx
```

### Component hierarchy

```
src/components/
├── search/
│   ├── SearchBar.tsx          # Client component — debounced input + typeahead
│   ├── SearchResults.tsx      # Server component — renders result cards
│   ├── SearchResultCard.tsx   # Individual result card
│   ├── SearchFilters.tsx      # Sidebar filters (type, year, status)
│   └── SearchSkeleton.tsx     # Loading skeleton
├── reader/
│   ├── LawReader.tsx          # Main reader layout (3-column)
│   ├── TableOfContents.tsx    # Left sidebar — clickable article list
│   ├── ArticleContent.tsx     # Center — rendered legal text
│   ├── ContextPanel.tsx       # Right sidebar — status, relationships
│   └── CopyJsonButton.tsx     # Per-article JSON copy
├── layout/
│   ├── Header.tsx             # Navigation bar
│   ├── Footer.tsx             # Links, attribution
│   └── StatsBar.tsx           # "X laws · Y articles available"
└── ui/
    ├── Badge.tsx              # Status badges (berlaku, dicabut)
    ├── Chip.tsx               # Filter chips
    └── Skeleton.tsx           # Generic skeleton loader
```

### Key patterns

**ISR for law pages:**
```typescript
// src/app/peraturan/[type]/[slug]/page.tsx
export const revalidate = 86400; // 24 hours

export async function generateStaticParams() {
    const supabase = createClient();
    const { data } = await supabase
        .from('works')
        .select('regulation_type_id, frbr_uri')
        .in('regulation_type_id', [3, 4, 5]) // UU, PP, PERPRES
        .limit(50);
    
    return data?.map(work => {
        const [type, slug] = parseFbrUri(work.frbr_uri);
        return { type, slug };
    }) ?? [];
}
```

**Streaming search results:**
```typescript
// src/app/search/page.tsx
import { Suspense } from 'react';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q } = await searchParams;
    
    return (
        <main>
            <SearchBar defaultValue={q} />
            <div className="flex gap-6">
                <SearchFilters />
                <Suspense fallback={<SearchSkeleton count={5} />}>
                    <SearchResults query={q || ''} />
                </Suspense>
            </div>
        </main>
    );
}
```

---

## § MCP Tools Specification

### Tool: search_laws

```json
{
    "name": "search_laws",
    "description": "Search Indonesian laws and regulations by keyword. Uses PostgreSQL full-text search with Indonesian stemming. Returns relevant legal provisions with citations.",
    "parameters": {
        "query": { "type": "string", "description": "Search query in Indonesian or English" },
        "regulation_type": { "type": "string", "enum": ["UU", "PP", "PERPRES", "PERMEN", "PERDA"], "description": "Filter by regulation type" },
        "year_from": { "type": "integer", "description": "Filter: enacted after this year" },
        "year_to": { "type": "integer", "description": "Filter: enacted before this year" },
        "limit": { "type": "integer", "default": 10, "description": "Max results" }
    },
    "required": ["query"]
}
```

**Return schema:**
```json
[
    {
        "law_title": "UU No. 13 Tahun 2003 tentang Ketenagakerjaan",
        "frbr_uri": "/akn/id/act/uu/2003/13",
        "regulation_type": "UU",
        "year": 2003,
        "pasal": "Pasal 81",
        "chapter": "BAB XII - Pemutusan Hubungan Kerja",
        "snippet": "Setiap pekerja/buruh yang mengalami pemutusan hubungan kerja...",
        "status": "diubah",
        "relevance_score": 0.87
    }
]
```

### Tool: get_pasal

```json
{
    "name": "get_pasal",
    "description": "Get the exact text of a specific article (Pasal) from an Indonesian regulation. Use this when you need the precise legal text.",
    "parameters": {
        "law_type": { "type": "string", "description": "e.g., 'UU', 'PP'" },
        "law_number": { "type": "string", "description": "e.g., '13'" },
        "year": { "type": "integer", "description": "e.g., 2003" },
        "pasal_number": { "type": "string", "description": "e.g., '81' or '81A'" }
    },
    "required": ["law_type", "law_number", "year", "pasal_number"]
}
```

**Return schema:**
```json
{
    "law_title": "UU No. 13 Tahun 2003 tentang Ketenagakerjaan",
    "pasal_number": "81",
    "chapter": "BAB XII",
    "content_id": "Full Indonesian text of the article...",
    "content_en": "English translation/summary (if available)",
    "penjelasan": "Explanation from the Penjelasan section (if not 'Cukup jelas')",
    "status": "berlaku",
    "source_url": "https://peraturan.go.id/id/uu-no-13-tahun-2003"
}
```

### Tool: get_law_status

```json
{
    "name": "get_law_status",
    "description": "Check whether an Indonesian regulation is still in force, has been amended, or was revoked. Returns the full amendment/revocation chain.",
    "parameters": {
        "law_type": { "type": "string" },
        "law_number": { "type": "string" },
        "year": { "type": "integer" }
    },
    "required": ["law_type", "law_number", "year"]
}
```

**Return schema:**
```json
{
    "law_title": "UU No. 1 Tahun 1974 tentang Perkawinan",
    "status": "diubah",
    "status_explanation": "This law has been partially amended. Most provisions remain in force.",
    "amendments": [
        {
            "type": "diubah_oleh",
            "law": "UU No. 16 Tahun 2019",
            "date": "2019-10-14",
            "description": "Changed minimum marriage age from 16 (women) to 19 (both)"
        }
    ],
    "related_laws": [
        {
            "type": "dilaksanakan_oleh",
            "law": "PP No. 9 Tahun 1975",
            "description": "Implementing regulation"
        }
    ]
}
```

### Tool: list_laws

```json
{
    "name": "list_laws",
    "description": "Browse available Indonesian regulations with optional filters.",
    "parameters": {
        "regulation_type": { "type": "string", "description": "Filter by type" },
        "year": { "type": "integer", "description": "Filter by year" },
        "status": { "type": "string", "enum": ["berlaku", "dicabut", "diubah"] },
        "search": { "type": "string", "description": "Title keyword filter" },
        "page": { "type": "integer", "default": 1 },
        "per_page": { "type": "integer", "default": 20 }
    }
}
```

---

## § Scraper Code Pattern

### For peraturan.go.id

```python
import httpx
from bs4 import BeautifulSoup
import json
import time
import os

BASE_URL = "https://peraturan.go.id"
OUTPUT_DIR = "data/raw/peraturan-go-id"
DELAY = 3  # seconds between requests

async def scrape_law_list(reg_type: str = "uu", max_pages: int = 10):
    """Scrape the listing pages to get all law URLs for a given type."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        laws = []
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/{reg_type}?page={page}"
            resp = await client.get(url)
            if resp.status_code != 200:
                break
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            # Adapt selectors to actual page structure
            items = soup.select('.regulation-item, .card, tr[data-href]')
            if not items:
                break
            
            for item in items:
                link = item.find('a')
                if link and link.get('href'):
                    laws.append({
                        'url': link['href'],
                        'title': link.get_text(strip=True)
                    })
            
            time.sleep(DELAY)
        
        return laws

async def scrape_law_detail(url: str) -> dict:
    """Scrape metadata and PDF link from a law's detail page."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(f"{BASE_URL}{url}")
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        metadata = {}
        # Extract metadata fields from the detail page
        # Adapt selectors based on actual page structure
        for row in soup.select('.detail-row, .info-item, tr'):
            label = row.select_one('.label, th, dt')
            value = row.select_one('.value, td, dd')
            if label and value:
                metadata[label.get_text(strip=True)] = value.get_text(strip=True)
        
        # Find PDF download link
        pdf_link = soup.select_one('a[href*=".pdf"], a[href*="download"]')
        if pdf_link:
            metadata['pdf_url'] = pdf_link['href']
        
        return metadata

async def download_pdf(pdf_url: str, filename: str):
    """Download a PDF file."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(pdf_url)
        filepath = os.path.join(OUTPUT_DIR, f"{filename}.pdf")
        with open(filepath, 'wb') as f:
            f.write(resp.content)
        return filepath
```

**Important notes:**
- The site has no CAPTCHA but be respectful with 3-second delays
- The exact CSS selectors will need to be adapted after inspecting the actual page
- Some PDFs may be behind a redirect — use `follow_redirects=True`
- Save both metadata JSON and raw PDF for each law

---

## § Parser Code Pattern

### Regex-based Indonesian legal document parser

```python
import re
import json
from pathlib import Path

# Patterns for Indonesian legal document structure
PATTERNS = {
    'bab': re.compile(r'^BAB\s+([IVXLCDM]+)\s*\n\s*(.+)', re.MULTILINE),
    'bagian': re.compile(r'^Bagian\s+(Kesatu|Kedua|Ketiga|Keempat|Kelima|Keenam|Ketujuh|Kedelapan|Kesembilan|Kesepuluh|Kesebelas|Kedua\s+Belas)', re.MULTILINE | re.IGNORECASE),
    'paragraf': re.compile(r'^Paragraf\s+(\d+)\s*\n\s*(.+)', re.MULTILINE),
    'pasal': re.compile(r'^Pasal\s+(\d+[A-Z]?)', re.MULTILINE),
    'ayat': re.compile(r'^\((\d+)\)\s+', re.MULTILINE),
    'huruf': re.compile(r'^([a-z])\.\s+', re.MULTILINE),
    'penjelasan_start': re.compile(r'^PENJELASAN\s*$', re.MULTILINE),
    'menimbang': re.compile(r'^Menimbang\s*:', re.MULTILINE),
    'mengingat': re.compile(r'^Mengingat\s*:', re.MULTILINE),
    'memutuskan': re.compile(r'^MEMUTUSKAN\s*:', re.MULTILINE),
}

def parse_law_text(text: str, metadata: dict) -> dict:
    """Parse raw legal text into structured document."""
    
    # Split body from penjelasan
    penjelasan_match = PATTERNS['penjelasan_start'].search(text)
    if penjelasan_match:
        body_text = text[:penjelasan_match.start()]
        penjelasan_text = text[penjelasan_match.end():]
    else:
        body_text = text
        penjelasan_text = None
    
    # Parse body into nodes
    nodes = parse_body(body_text)
    
    # Parse penjelasan if exists
    if penjelasan_text:
        penjelasan_nodes = parse_penjelasan(penjelasan_text)
        nodes.append({
            'type': 'penjelasan',
            'children': penjelasan_nodes
        })
    
    return {
        **metadata,
        'nodes': nodes,
        'raw_text': text
    }

def parse_body(text: str) -> list:
    """Parse the body of a law into hierarchical nodes."""
    nodes = []
    
    # Find all BAB positions
    bab_matches = list(PATTERNS['bab'].finditer(text))
    
    for i, match in enumerate(bab_matches):
        bab_start = match.start()
        bab_end = bab_matches[i + 1].start() if i + 1 < len(bab_matches) else len(text)
        bab_text = text[bab_start:bab_end]
        
        bab_node = {
            'type': 'bab',
            'number': match.group(1),
            'heading': match.group(2).strip(),
            'children': parse_articles(bab_text)
        }
        nodes.append(bab_node)
    
    return nodes

def parse_articles(text: str) -> list:
    """Extract articles (Pasal) from a chapter."""
    articles = []
    pasal_matches = list(PATTERNS['pasal'].finditer(text))
    
    for i, match in enumerate(pasal_matches):
        start = match.end()
        end = pasal_matches[i + 1].start() if i + 1 < len(pasal_matches) else len(text)
        content = text[start:end].strip()
        
        # Parse ayat within article
        ayat_list = parse_ayat(content)
        
        articles.append({
            'type': 'pasal',
            'number': match.group(1),
            'content': content if not ayat_list else None,
            'children': ayat_list
        })
    
    return articles

def parse_ayat(text: str) -> list:
    """Extract sub-articles (Ayat) from an article."""
    ayat_matches = list(PATTERNS['ayat'].finditer(text))
    if not ayat_matches:
        return []
    
    ayats = []
    for i, match in enumerate(ayat_matches):
        start = match.end()
        end = ayat_matches[i + 1].start() if i + 1 < len(ayat_matches) else len(text)
        content = text[start:end].strip()
        
        ayats.append({
            'type': 'ayat',
            'number': match.group(1),
            'content': content
        })
    
    return ayats
```

---

## § Priority Laws for MVP

Scrape and parse these 20 laws first — they cover the most commonly searched legal topics:

| # | FRBR URI | Law | Topic | Why Important |
|---|----------|-----|-------|---------------|
| 1 | /akn/id/act/uu/2003/13 | UU 13/2003 | Ketenagakerjaan (Labor) | Most referenced employment law |
| 2 | /akn/id/act/uu/2023/6 | UU 6/2023 | Cipta Kerja (Omnibus) | Massive amendment to labor + business |
| 3 | /akn/id/act/uu/1974/1 | UU 1/1974 | Perkawinan (Marriage) | Famous marriage age case |
| 4 | /akn/id/act/uu/2019/16 | UU 16/2019 | Perubahan UU Perkawinan | Raised marriage age to 19 |
| 5 | /akn/id/act/uu/2023/1 | UU 1/2023 | KUHP (New Criminal Code) | Newest major law |
| 6 | /akn/id/act/uu/1999/31 | UU 31/1999 | Pemberantasan Korupsi (Anti-Corruption) | High public interest |
| 7 | /akn/id/act/uu/2001/20 | UU 20/2001 | Perubahan UU Anti-Korupsi | Amendment to #6 |
| 8 | /akn/id/act/uu/2003/17 | UU 17/2003 | Keuangan Negara (State Finance) | Foundational fiscal law |
| 9 | /akn/id/act/uu/1995/8 | UU 8/1995 | Pasar Modal (Capital Markets) | Financial regulation |
| 10 | /akn/id/act/uu/1999/8 | UU 8/1999 | Perlindungan Konsumen (Consumer Protection) | Widely referenced |
| 11 | /akn/id/act/uu/2016/11 | UU 11/2016 | Pengampunan Pajak (Tax Amnesty) | Notable fiscal policy |
| 12 | /akn/id/act/uu/2007/40 | UU 40/2007 | Perseroan Terbatas (Companies) | Corporate law foundation |
| 13 | /akn/id/act/uu/2012/24 | UU 24/2012 | Sistem Jaminan Sosial | Social security |
| 14 | /akn/id/act/uu/2004/24 | UU 24/2004 | Mahkamah Konstitusi | Constitutional Court |
| 15 | /akn/id/act/uu/2011/12 | UU 12/2011 | Pembentukan Peraturan | How laws are made (meta-law) |
| 16 | /akn/id/act/uu/2022/13 | UU 13/2022 | Perubahan UU 12/2011 | Amendment to #15 |
| 17 | /akn/id/act/uu/2008/14 | UU 14/2008 | Keterbukaan Informasi Publik | Public information access |
| 18 | /akn/id/act/uu/2016/19 | UU 19/2016 | ITE (Electronic Information) | Cyber law, controversial |
| 19 | /akn/id/act/uu/2024/27 | UU 27/2024 | Perubahan UU ITE | ITE amendment |
| 20 | /akn/id/act/uu/2022/27 | UU 27/2022 | Perlindungan Data Pribadi | Data protection |

---

## § Future Upgrade: Vector Search

The MVP uses keyword-only search. To add semantic/vector search post-hackathon:

**Step 1:** Enable pgvector in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 2:** Add embedding column to legal_chunks:
```sql
ALTER TABLE legal_chunks ADD COLUMN embedding VECTOR(1536);
CREATE INDEX idx_chunks_embedding ON legal_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

**Step 3:** Generate embeddings using one of these models:

| Model | Dimensions | Indonesian Quality | Cost |
|-------|-----------|-------------------|------|
| OpenAI `text-embedding-3-small` | 1536 | Good | $0.02/1M tokens |
| OpenAI `text-embedding-3-large` | 1024 (with `dimensions` param) | Best API | $0.13/1M tokens |
| BAAI/bge-m3 | 1024 | Excellent multilingual | Free (self-host) |
| archi-ai/Indo-LegalBERT | 768 | Specialized for Indo legal | Free (self-host) |

**Step 4:** Upgrade `search_legal_chunks` to hybrid search with RRF:
```sql
-- Add a hybrid function that combines keyword + semantic
-- See Supabase docs: https://supabase.com/docs/guides/ai/hybrid-search
```

---

## § MCP Server Deployment

### FastMCP with Streamable HTTP

```python
# apps/mcp-server/server.py
import os
from fastmcp import FastMCP
from supabase import create_client

# Initialize
mcp = FastMCP(
    "Pasal.id — Indonesian Legal Database",
    description="Search, read, and analyze Indonesian laws and regulations. Provides grounded legal information with citations to prevent hallucination."
)

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_KEY']
)

@mcp.tool
async def search_laws(
    query: str,
    regulation_type: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    limit: int = 10
) -> list[dict]:
    """Search Indonesian laws and regulations by keyword.
    Returns relevant legal provisions with exact citations.
    
    Args:
        query: Search query in Indonesian (e.g., "hak cuti pekerja", "upah minimum")
        regulation_type: Filter by type — UU (Law), PP (Govt Regulation), PERPRES (Presidential Regulation)
        year_from: Only return laws enacted after this year
        year_to: Only return laws enacted before this year
        limit: Maximum number of results (default 10)
    """
    metadata_filter = {}
    if regulation_type:
        metadata_filter['type'] = regulation_type
    
    result = supabase.rpc('search_legal_chunks', {
        'query_text': query,
        'match_count': limit,
        'metadata_filter': metadata_filter
    }).execute()
    
    # Enrich with work metadata
    enriched = []
    for chunk in result.data or []:
        work = supabase.table('works').select('*').eq('id', chunk['work_id']).single().execute()
        w = work.data
        if year_from and w['year'] < year_from:
            continue
        if year_to and w['year'] > year_to:
            continue
        
        enriched.append({
            'law_title': w['title_id'],
            'frbr_uri': w['frbr_uri'],
            'regulation_type': chunk['metadata'].get('type', ''),
            'year': w['year'],
            'pasal': chunk['metadata'].get('pasal', ''),
            'snippet': chunk['content'][:500],
            'status': w['status'],
            'relevance_score': chunk['score']
        })
    
    return enriched

@mcp.tool
async def get_pasal(
    law_type: str,
    law_number: str,
    year: int,
    pasal_number: str
) -> dict:
    """Get the exact text of a specific article (Pasal) from an Indonesian regulation.
    
    Args:
        law_type: Regulation type, e.g., "UU", "PP", "PERPRES"
        law_number: Law number, e.g., "13"
        year: Year of enactment, e.g., 2003
        pasal_number: Article number, e.g., "81" or "81A"
    """
    # Find the work
    frbr_pattern = f"%/{law_type.lower()}/{year}/{law_number}"
    work = supabase.table('works').select('*').ilike('frbr_uri', frbr_pattern).single().execute()
    
    if not work.data:
        return {"error": f"Law {law_type} {law_number}/{year} not found in database"}
    
    # Find the specific article
    node = supabase.table('document_nodes').select('*').eq('work_id', work.data['id']).eq('node_type', 'pasal').eq('number', pasal_number).single().execute()
    
    if not node.data:
        return {"error": f"Pasal {pasal_number} not found in {law_type} {law_number}/{year}"}
    
    # Get child ayat
    children = supabase.table('document_nodes').select('*').eq('parent_id', node.data['id']).order('sort_order').execute()
    
    content = node.data['content_text'] or ""
    if children.data:
        for child in children.data:
            content += f"\n({child['number']}) {child['content_text']}"
    
    return {
        'law_title': work.data['title_id'],
        'pasal_number': pasal_number,
        'chapter': node.data.get('heading', ''),
        'content_id': content,
        'status': work.data['status'],
        'source_url': work.data.get('source_url', '')
    }

@mcp.tool
async def get_law_status(
    law_type: str,
    law_number: str,
    year: int
) -> dict:
    """Check whether an Indonesian regulation is still in force, amended, or revoked.
    Returns the full amendment and revocation history.
    
    Args:
        law_type: e.g., "UU", "PP"
        law_number: e.g., "13"
        year: e.g., 2003
    """
    frbr_pattern = f"%/{law_type.lower()}/{year}/{law_number}"
    work = supabase.table('works').select('*').ilike('frbr_uri', frbr_pattern).single().execute()
    
    if not work.data:
        return {"error": f"Law {law_type} {law_number}/{year} not found"}
    
    # Get all relationships
    rels = supabase.table('work_relationships').select(
        '*, relationship_types(*), source:works!source_work_id(*), target:works!target_work_id(*)'
    ).or_(
        f"source_work_id.eq.{work.data['id']},target_work_id.eq.{work.data['id']}"
    ).execute()
    
    amendments = []
    related = []
    for rel in rels.data or []:
        other_work = rel['target'] if rel['source_work_id'] == work.data['id'] else rel['source']
        entry = {
            'relationship': rel['relationship_types']['name_en'],
            'law': other_work['title_id'],
            'year': other_work['year'],
            'frbr_uri': other_work['frbr_uri']
        }
        if rel['relationship_types']['code'] in ('mengubah', 'diubah_oleh', 'mencabut', 'dicabut_oleh'):
            amendments.append(entry)
        else:
            related.append(entry)
    
    return {
        'law_title': work.data['title_id'],
        'status': work.data['status'],
        'amendments': amendments,
        'related_laws': related
    }

@mcp.tool
async def list_laws(
    regulation_type: str | None = None,
    year: int | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20
) -> dict:
    """Browse available Indonesian regulations with optional filters.
    
    Args:
        regulation_type: Filter by type (UU, PP, PERPRES, PERMEN)
        year: Filter by year of enactment
        status: Filter by status (berlaku, dicabut, diubah)
        search: Keyword search in titles
        page: Page number (default 1)
        per_page: Results per page (default 20)
    """
    query = supabase.table('works').select('*', count='exact')
    
    if regulation_type:
        type_id = supabase.table('regulation_types').select('id').eq('code', regulation_type).single().execute()
        if type_id.data:
            query = query.eq('regulation_type_id', type_id.data['id'])
    if year:
        query = query.eq('year', year)
    if status:
        query = query.eq('status', status)
    if search:
        query = query.ilike('title_id', f'%{search}%')
    
    offset = (page - 1) * per_page
    result = query.order('year', desc=True).range(offset, offset + per_page - 1).execute()
    
    return {
        'total': result.count,
        'page': page,
        'per_page': per_page,
        'laws': [{
            'frbr_uri': w['frbr_uri'],
            'title': w['title_id'],
            'number': w['number'],
            'year': w['year'],
            'status': w['status']
        } for w in result.data or []]
    }

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
```

### Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "server.py"]
```

### Connect from Claude API

```python
response = client.beta.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    messages=[{"role": "user", "content": "Jelaskan hak cuti pekerja menurut UU Ketenagakerjaan"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://your-deployed-url.up.railway.app/mcp/",
        "name": "pasal-id",
        "authorization_token": "your-token"
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "pasal-id"}],
    extra_headers={"anthropic-beta": "mcp-client-2025-11-20"}
)
```

---

## § Demo Script

**Total: 3 minutes. Practice until you can do it in 2:45.**

| Time | Beat | Action | What Judges See |
|------|------|--------|-----------------|
| 0:00 | The Problem | Open peraturan.go.id, click a law → PDF downloads | Clunky government site |
| 0:15 | | Open Hukumonline → paywall | The only alternative costs money |
| 0:25 | | "280 million people. Zero open access." | Emotional hook |
| 0:30 | The Website | Open pasal.id → search "ketenagakerjaan" | Clean, fast, Google-like |
| 0:45 | | Click result → structured reader with TOC | Night and day vs PDF |
| 0:55 | | Show "Copy as JSON" → show relationships panel | Developer-friendly + smart |
| 1:00 | The Magic | "But the real power is what happens when we connect this to Claude." | Transition |
| 1:05 | | Open Claude. Ask WITHOUT MCP: "Berapa usia minimum menikah di Indonesia?" | Claude hedges or hallucinates |
| 1:20 | | Connect MCP. Ask SAME question. | Claude calls search_laws → get_pasal → answers with "Pasal 7 UU 16/2019: 19 tahun" |
| 1:40 | | Show tool calls in Claude's thinking | Judges see the MCP magic |
| 1:50 | | Complex query: "Compare worker rights before and after Omnibus Law" | Claude pulls from 2 laws, cross-references |
| 2:15 | | Claude produces cited comparative analysis | Wow moment |
| 2:20 | Architecture | Quick diagram (30 seconds max) | Shows depth |
| 2:35 | | "We used Opus 4.6 to structure unstructured PDFs during our build" | Hits the Opus 4.6 criteria |
| 2:45 | Close | "Open source. Free forever. `claude mcp add pasal-id`" | Call to action |
| 2:55 | | GitHub link on screen | Clean ending |
