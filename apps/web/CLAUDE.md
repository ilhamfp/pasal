# apps/web — Next.js Frontend

See root `CLAUDE.md` for project overview, database schema, and environment variables.
See `BRAND_GUIDELINES.md` for complete visual identity rules.

## Commands

```bash
npm run dev      # Dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint
npm run test     # Vitest (tests in src/lib/__tests__/)
```

Add shadcn components with `npx shadcn@latest add <component>` (config: `components.json`).

## Config

- **Path alias:** `@/*` maps to `src/*` — use `@/components/...`, `@/lib/...` for imports.
- **`next.config.ts`:** Turbopack file cache enabled, images unoptimized (Vercel), security headers (CSP, X-Frame-Options, etc.) applied to all routes.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page (ISR 1h, stats cached 24h via `unstable_cache`) |
| `/search?q=&type=` | Full-text search results |
| `/peraturan/[type]/[slug]` | Law reader — 3-column layout: TOC / content / sidebar (ISR 24h) |
| `/peraturan/[type]/[slug]/koreksi/[nodeId]` | Correction submission form |
| `/jelajahi`, `/jelajahi/[type]` | Browse by regulation type |
| `/topik`, `/topik/[slug]` | Topic pages |
| `/connect` | MCP setup guide |
| `/api` | API documentation |
| `/admin` | Dashboard (protected) |
| `/admin/login` | Admin login page |
| `/admin/suggestions` | Suggestion review queue |
| `/admin/peraturan` | Regulation management |
| `/admin/scraper` | Scraper job management |

### API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/search` | GET | Public | Search (CORS enabled) |
| `/api/v1/laws` | GET | Public | List laws (paginated) |
| `/api/v1/laws/[...frbr]` | GET | Public | Law detail by FRBR URI |
| `/api/suggestions` | POST | Public | Submit correction (rate limited 10/IP/hour) |
| `/api/admin/*` | POST | Admin | Approve/reject suggestions, trigger scraper, verify with AI |

## Key Patterns

### Supabase clients

Three clients in `src/lib/supabase/`:

| File | When to use |
|------|-------------|
| `server.ts` → `createClient()` | Server Components & Route Handlers — uses anon key, respects RLS |
| `client.ts` → `createClient()` | Client Components — browser auth state |
| `service.ts` → `createServiceClient()` | Admin API routes only — service role key, bypasses RLS |

### Data fetching

- Server Components fetch directly with `await createClient()` — no `useEffect`.
- Wrap repeated queries in `cache()` (React) for request deduplication within a render.
- Use `supabase.rpc("search_legal_chunks", { ... })` for search. This queries `document_nodes` directly (no separate chunks table).
- ISR via `export const revalidate = <seconds>` at page level.
- Landing stats use `unstable_cache()` with 24h TTL (`src/lib/stats.ts`).

### Admin auth

`src/lib/admin-auth.ts` exports `requireAdmin()` — call at top of every admin page. Checks Supabase auth + `ADMIN_EMAILS` env var (comma-separated). Redirects to `/admin/login` if unauthorized.

The admin layout (`/admin/layout.tsx`) does a soft check (renders chrome if admin, bare children if not) so the login page isn't caught in a redirect loop.

### Dynamic route params

Next.js 16 passes params as a Promise. Always await:
```tsx
export default async function Page({ params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
```

### Slug format

Regulations use `{type}-{number}-{year}` slugs (e.g. `uu-13-2003`). Parse with `src/lib/parse-slug.ts`. FRBR URI construction in `src/lib/frbr.ts`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/stats.ts` | `getLandingStats()` — cached DB counts for landing page |
| `src/lib/legal-status.ts` | Status labels, colors, type mappings |
| `src/lib/group-search-results.ts` | Groups search results by work, formats Pasal lists |
| `src/lib/parse-slug.ts` | Slug ↔ (number, year) parsing |
| `src/lib/frbr.ts` | FRBR URI builder/parser |
| `src/lib/api/cors.ts` | CORS headers for `/api/v1/` routes |
| `src/lib/motion.ts` | Framer Motion easing curves & variants |
| `src/components/reader/` | Law reader components (ReaderLayout, PasalBlock, AmendmentTimeline) |
| `src/components/landing/` | Landing page sections (HeroSection, StatsSection, CuratedLaws) |
| `src/components/suggestions/` | Correction submission UI |

## Gotchas

- **Search snippets contain HTML.** The `ts_headline` function returns `<mark>` tags. Sanitize to only allow `<mark>` — strip everything else.
- **Suggestion rate limiting** uses `x-real-ip` header (set by Vercel, not spoofable). Check count of `created_at >= oneHourAgo` from the `suggestions` table.
- **Stale content detection:** Before accepting a suggestion, compare the submitted `current_content` against the DB to catch concurrent edits.
- **`createServiceClient()` must only be used in API routes**, never in Server Components or client code.
- **No middleware.ts.** Auth is handled per-page via `requireAdmin()` and per-API-route with manual checks.
- **SEO on every public page.** Use `generateMetadata()` for dynamic OG tags and `<JsonLd>` component for schema.org structured data.
