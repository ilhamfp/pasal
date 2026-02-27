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
| `src/components/ShareButton.tsx` | Social sharing dropdown (WhatsApp, Telegram, X, clipboard). Uses Web Share API on mobile |
| `src/components/CitationButton.tsx` | Formal legal citation copy button |
| `src/components/SectionLinkButton.tsx` | Copy anchor link for BAB/section headings |
| `src/components/PrintButton.tsx` | Triggers `window.print()` |

## OG Image Route (`src/app/api/og/route.tsx`)

- Edge runtime. Uses `ImageResponse` from `next/og` (bundled — do NOT install `@vercel/og`).
- Font `.ttf` files at `src/app/api/og/fonts/`. Loaded via `new URL("./fonts/...", import.meta.url)`.
- **Satori constraints:** Only `display: "flex"`, inline `style={{}}` objects, hex color strings (no CSS vars, no Tailwind). Hardcoded hex values are acceptable here since CSS custom properties are unavailable at edge.

## Gotchas

- **Search snippets contain HTML.** The `ts_headline` function returns `<mark>` tags. Sanitize to only allow `<mark>` — strip everything else.
- **Suggestion rate limiting** uses `x-real-ip` header (set by Vercel, not spoofable). Check count of `created_at >= oneHourAgo` from the `suggestions` table.
- **Stale content detection:** Before accepting a suggestion, compare the submitted `current_content` against the DB to catch concurrent edits.
- **`createServiceClient()` must only be used in API routes**, never in Server Components or client code.
- **middleware.ts is i18n only.** `src/middleware.ts` handles `next-intl` locale detection and routing — it does NOT handle auth. Auth is per-page via `requireAdmin()` and per-API-route with manual checks.
- **SEO on every public page.** Use `generateMetadata()` for dynamic OG tags and `<JsonLd>` component for schema.org structured data.
- **Hreflang on every public page.** Use `alternates: getAlternates(path, locale)` in `generateMetadata()`. Also add the page to `sitemap.ts` with matching `alternates.languages`.
- **noindex pages.** Pages like `/search` and `/koreksi/` use `robots: { index: false }` in their metadata AND are `Disallow`ed in `robots.ts`. When adding new noindex pages, update both.
- **Title template override.** Pages that want their exact title (not `%s | Pasal.id`) must use `title: { absolute: "..." }` in `generateMetadata`. The landing page uses this pattern.
- **OG truncation for WhatsApp.** `og:title` truncates at ~60 chars, `og:description` at ~155. The law detail page truncates both in `generateMetadata()`.
- **Print CSS.** `globals.css` has `@media print` rules. Use `.no-print` class to hide elements when printing.
- **Interactive button pattern.** Small action buttons (`ShareButton`, `CitationButton`, etc.) are `"use client"`, use lucide icons with `aria-hidden="true"`, and wrap state-change text in `<span aria-live="polite">`.
- **Deep linking.** BAB/section headings have `id` attributes for anchor links. `SectionLinkButton` copies the full URL with hash.
- **Local build fails on prerender.** `npm run build` errors on `/en` with "supabaseUrl is required" because `NEXT_PUBLIC_SUPABASE_URL` isn't available at static generation time locally. This is expected — Vercel provides env vars at build time. Use `npx tsc --noEmit` for local TypeScript verification.
- **Supabase RPC typing.** `supabase.rpc("fn").single()` returns `unknown`. Always provide a generic: `.single<{ col: type }>()` to avoid TypeScript errors.
