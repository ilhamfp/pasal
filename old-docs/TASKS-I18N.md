# Pasal.id — i18n Implementation Tasks

> **Goal:** Add internationalization to pasal.id. Default language is Bahasa Indonesia (no URL prefix). English is available at `/en/*`. Legal content stays in Bahasa Indonesia — only UI chrome is translated.
>
> **Library:** `next-intl` v4.x with `localePrefix: 'as-needed'`
>
> **Stack context:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, Vercel deployment
>
> **Current state:** All text is hardcoded in Bahasa Indonesia. No middleware.ts exists. Auth is handled per-page via `requireAdmin()`. There are 39 Supabase migrations. The CLAUDE.md says "No middleware.ts."
>
> **Key constraint:** DO NOT break existing functionality. Every task ends with `npm run build` verification. The site must remain fully functional in Bahasa Indonesia throughout the migration.
>
> **Skills to run after each task:**
> - `code-simplifier` — always
> - `code-review` — always
> - For frontend tasks: also run `/web-design-guidelines` and `/frontend-design` skills, verify against `BRAND_GUIDELINES.md`
>
> **How to use this file:** Complete tasks in order. Each task is atomic. Do NOT skip ahead. Commit after each task.

---

## Phase 0: Foundation — Install & Configure next-intl [~2 hours]

### Task 0.1 — Install next-intl and create config files

**WHY:** next-intl is the i18n library for Next.js App Router. We need the package, the routing config, the request config, and the Next.js plugin wired up before touching any pages.

**WHAT EXISTS NOW:**
- `apps/web/next.config.ts` — plain Next.js config with security headers, Turbopack cache, image optimization
- `apps/web/tsconfig.json` — has `resolveJsonModule: true` (needed for JSON message imports)
- No `middleware.ts` anywhere

**Actions:**

1. Install next-intl:
   ```bash
   cd apps/web
   npm install next-intl
   ```

2. Create `apps/web/src/i18n/routing.ts`:
   ```typescript
   import { defineRouting } from 'next-intl/routing';
   import { createNavigation } from 'next-intl/navigation';

   export const routing = defineRouting({
     locales: ['id', 'en'] as const,
     defaultLocale: 'id',
     localePrefix: 'as-needed', // no /id prefix, only /en prefix
     localeDetection: false, // we handle suggestion ourselves — don't auto-redirect
   });

   export type Locale = (typeof routing.locales)[number];

   export const { Link, redirect, usePathname, useRouter, getPathname } =
     createNavigation(routing);
   ```

3. Create `apps/web/src/i18n/request.ts`:
   ```typescript
   import { getRequestConfig } from 'next-intl/server';
   import { routing } from './routing';
   import { hasLocale } from 'next-intl';

   export default getRequestConfig(async ({ requestLocale }) => {
     const requested = await requestLocale;
     const locale = hasLocale(routing.locales, requested)
       ? requested
       : routing.defaultLocale;

     return {
       locale,
       messages: (await import(`../../../messages/${locale}.json`)).default,
       timeZone: 'Asia/Jakarta',
     };
   });
   ```

4. Update `apps/web/next.config.ts` — wrap with `createNextIntlPlugin`:
   ```typescript
   import type { NextConfig } from "next";
   import createNextIntlPlugin from 'next-intl/plugin';

   const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

   const nextConfig: NextConfig = {
     // ... keep ALL existing config (experimental, images, headers)
   };

   export default withNextIntl(nextConfig);
   ```

   ⚠️ **Do NOT remove any existing config.** Only add the `createNextIntlPlugin` import and wrap.

**Verification:**
- [x] `apps/web/src/i18n/routing.ts` exists with `locales: ['id', 'en']` and `localePrefix: 'as-needed'`
- [x] `apps/web/src/i18n/request.ts` exists with `timeZone: 'Asia/Jakarta'`
- [x] `next.config.ts` uses `withNextIntl()` wrapper AND still has all existing headers, experimental flags
- [x] `npm install` completes without errors
- [x] `npx tsc --noEmit` has no new type errors (message files don't exist yet — that's fine, next task)
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "chore: install next-intl and create i18n config" && git push`

---

### Task 0.2 — Create message files (id.json and en.json)

**WHY:** These are the translation dictionaries. Indonesian is the source of truth. English is the translation. We extract every hardcoded UI string from the current codebase.

**WHAT EXISTS NOW:** All strings are hardcoded in TSX files. Key files with hardcoded strings:
- `Header.tsx` → "Jelajahi", "API", "Hubungkan Claude"
- `MobileNav.tsx` → "Buka menu", "Tutup menu", same nav links
- `HeroSection.tsx` → "Temukan pasal yang Anda butuhkan", "Hukum Indonesia, terbuka untuk semua"
- `SearchSuggestions.tsx` → "Coba cari:", suggestion labels
- `StatsSection.tsx` → "Peraturan", "Pasal terstruktur", "Gratis & Open Source", "Database Hukum Indonesia Terbuka"
- `DisclaimerBanner.tsx` → "Konten ini bukan nasihat hukum..."
- `search/page.tsx` → "Hasil pencarian:", "Cari Peraturan", "Terjadi kesalahan...", "Sangat relevan", "Relevan", "Mungkin relevan", "Halaman", "Halaman sebelumnya", "Halaman berikutnya"
- `layout.tsx` → footer links ("Beranda", "Jelajahi", "Topik", "Hubungkan Claude", "API"), footer disclaimer, copyright
- `legal-status.ts` → STATUS_LABELS ("Berlaku", "Diubah", "Dicabut", "Tidak Berlaku")
- `peraturan/[type]/[slug]/page.tsx` → "Nomor", "Tahun", "Baca teks lengkap"
- `connect/page.tsx` → MCP setup instructions
- `jelajahi/page.tsx` → "Jelajahi Peraturan", browse labels
- `topik/page.tsx` → topic page labels
- `api/page.tsx` → API documentation labels
- Admin pages → admin-specific labels (lower priority — can stay Indonesian initially)

**Actions:**

1. Create `apps/web/messages/id.json`:
   ```json
   {
     "common": {
       "loading": "Memuat...",
       "error": "Terjadi kesalahan. Silakan coba lagi.",
       "save": "Simpan",
       "cancel": "Batal",
       "back": "Kembali",
       "seeAll": "Lihat semua",
       "learnMore": "Pelajari lebih lanjut"
     },
     "metadata": {
       "siteName": "Pasal.id",
       "siteDescription": "Cari undang-undang, PP, Perpres, dan peraturan Indonesia lainnya. Gratis dan open source.",
       "siteTitle": "Pasal.id — Cari Hukum Indonesia",
       "siteTitleTemplate": "{title} | Pasal.id"
     },
     "navigation": {
       "home": "Beranda",
       "browse": "Jelajahi",
       "topics": "Topik",
       "connect": "Hubungkan Claude",
       "api": "API",
       "openMenu": "Buka menu",
       "closeMenu": "Tutup menu",
       "skipToContent": "Langsung ke konten utama"
     },
     "hero": {
       "heading": "Temukan pasal yang Anda butuhkan",
       "subheading": "Hukum Indonesia, terbuka untuk semua",
       "trySuggestion": "Coba cari:"
     },
     "stats": {
       "sectionLabel": "Database Hukum Indonesia Terbuka",
       "regulations": "Peraturan",
       "regulationsDetail": "{count} jenis peraturan, dari {minYear} hingga {maxYear}",
       "structuredArticles": "Pasal terstruktur",
       "structuredArticlesDetail": "bisa dicari & dikutip",
       "freeAndOpen": "Gratis & Open Source",
       "freeAndOpenDetail": "akses terbuka untuk semua"
     },
     "search": {
       "title": "Cari Peraturan",
       "resultsTitle": "Hasil pencarian: {query}",
       "noQuery": "Masukkan kata kunci untuk mencari peraturan Indonesia.",
       "noResults": "Tidak ada hasil untuk \"{query}\"",
       "noResultsSuggestion": "Coba kata kunci lain atau periksa ejaan Anda.",
       "errorMessage": "Terjadi kesalahan saat mencari. Silakan coba lagi.",
       "placeholder": "Cari undang-undang, pasal, atau topik...",
       "relevanceHigh": "{pct}% · Sangat relevan",
       "relevanceMedium": "{pct}% · Relevan",
       "relevanceLow": "{pct}% · Mungkin relevan",
       "relevanceLabel": "Relevansi",
       "resultCount": "{count, plural, =0 {Tidak ada hasil} =1 {1 hasil} other {# hasil}}",
       "pagination": "Halaman",
       "previousPage": "Halaman sebelumnya",
       "nextPage": "Halaman berikutnya",
       "searchResults": "Hasil pencarian"
     },
     "reader": {
       "readFullText": "Baca teks lengkap {type} Nomor {number} Tahun {year} tentang {title}.",
       "number": "Nomor",
       "year": "Tahun",
       "viewInReader": "Lihat di Reader",
       "correction": "Koreksi",
       "copyJson": "Salin JSON",
       "copied": "Tersalin!",
       "tableOfContents": "Daftar Isi",
       "legalStatus": "Status Hukum",
       "relatedRegulations": "Peraturan Terkait",
       "sourceDocument": "Dokumen Sumber",
       "viewPdf": "Lihat PDF",
       "viewSource": "Lihat Sumber"
     },
     "disclaimer": {
       "text": "Konten ini bukan nasihat hukum. Selalu rujuk sumber resmi untuk kepastian hukum.",
       "legalContentNotice": "Dokumen hukum ditampilkan dalam Bahasa Indonesia, bahasa resmi publikasinya."
     },
     "status": {
       "berlaku": "Berlaku",
       "diubah": "Diubah",
       "dicabut": "Dicabut",
       "tidak_berlaku": "Tidak Berlaku"
     },
     "browse": {
       "title": "Jelajahi Peraturan",
       "description": "Telusuri peraturan Indonesia berdasarkan jenis",
       "seeAllTypes": "Lihat semua jenis peraturan",
       "readLink": "Baca",
       "filterByYear": "Filter tahun",
       "filterByStatus": "Filter status",
       "allYears": "Semua tahun",
       "allStatuses": "Semua status"
     },
     "connect": {
       "title": "Hubungkan Claude",
       "description": "Gunakan Pasal.id sebagai MCP server untuk Claude",
       "installCommand": "Perintah Instalasi",
       "examplePrompts": "Contoh Pertanyaan",
       "howItWorks": "Cara Kerjanya",
       "tools": "Alat yang Tersedia"
     },
     "footer": {
       "disclaimer": "Konten ini bukan nasihat hukum. Selalu rujuk sumber resmi untuk kepastian hukum.",
       "copyright": "© {year} Pasal.id. Platform Hukum Indonesia Terbuka"
     },
     "languageSwitcher": {
       "switchTo": "English",
       "label": "Ganti bahasa"
     }
   }
   ```

2. Create `apps/web/messages/en.json`:
   ```json
   {
     "common": {
       "loading": "Loading...",
       "error": "An error occurred. Please try again.",
       "save": "Save",
       "cancel": "Cancel",
       "back": "Back",
       "seeAll": "See all",
       "learnMore": "Learn more"
     },
     "metadata": {
       "siteName": "Pasal.id",
       "siteDescription": "Search Indonesian laws, government regulations, presidential decrees, and more. Free and open source.",
       "siteTitle": "Pasal.id — Search Indonesian Law",
       "siteTitleTemplate": "{title} | Pasal.id"
     },
     "navigation": {
       "home": "Home",
       "browse": "Browse",
       "topics": "Topics",
       "connect": "Connect Claude",
       "api": "API",
       "openMenu": "Open menu",
       "closeMenu": "Close menu",
       "skipToContent": "Skip to main content"
     },
     "hero": {
       "heading": "Find the legal article you need",
       "subheading": "Indonesian law, open for all",
       "trySuggestion": "Try searching:"
     },
     "stats": {
       "sectionLabel": "Indonesia's Open Legal Database",
       "regulations": "Regulations",
       "regulationsDetail": "{count} regulation types, from {minYear} to {maxYear}",
       "structuredArticles": "Structured articles",
       "structuredArticlesDetail": "searchable & citable",
       "freeAndOpen": "Free & Open Source",
       "freeAndOpenDetail": "open access for everyone"
     },
     "search": {
       "title": "Search Regulations",
       "resultsTitle": "Search results: {query}",
       "noQuery": "Enter a keyword to search Indonesian regulations.",
       "noResults": "No results for \"{query}\"",
       "noResultsSuggestion": "Try different keywords or check your spelling.",
       "errorMessage": "An error occurred while searching. Please try again.",
       "placeholder": "Search laws, articles, or topics...",
       "relevanceHigh": "{pct}% · Highly relevant",
       "relevanceMedium": "{pct}% · Relevant",
       "relevanceLow": "{pct}% · Possibly relevant",
       "relevanceLabel": "Relevance",
       "resultCount": "{count, plural, =0 {No results} =1 {1 result} other {# results}}",
       "pagination": "Page",
       "previousPage": "Previous page",
       "nextPage": "Next page",
       "searchResults": "Search results"
     },
     "reader": {
       "readFullText": "Read the full text of {type} Number {number} of {year} regarding {title}.",
       "number": "Number",
       "year": "Year",
       "viewInReader": "View in Reader",
       "correction": "Correction",
       "copyJson": "Copy JSON",
       "copied": "Copied!",
       "tableOfContents": "Table of Contents",
       "legalStatus": "Legal Status",
       "relatedRegulations": "Related Regulations",
       "sourceDocument": "Source Document",
       "viewPdf": "View PDF",
       "viewSource": "View Source"
     },
     "disclaimer": {
       "text": "This content is not legal advice. Always refer to official sources for legal certainty.",
       "legalContentNotice": "Legal documents are displayed in Bahasa Indonesia, their official language of publication."
     },
     "status": {
       "berlaku": "In Force",
       "diubah": "Amended",
       "dicabut": "Revoked",
       "tidak_berlaku": "Not In Force"
     },
     "browse": {
       "title": "Browse Regulations",
       "description": "Explore Indonesian regulations by type",
       "seeAllTypes": "See all regulation types",
       "readLink": "Read",
       "filterByYear": "Filter by year",
       "filterByStatus": "Filter by status",
       "allYears": "All years",
       "allStatuses": "All statuses"
     },
     "connect": {
       "title": "Connect Claude",
       "description": "Use Pasal.id as an MCP server for Claude",
       "installCommand": "Install Command",
       "examplePrompts": "Example Prompts",
       "howItWorks": "How It Works",
       "tools": "Available Tools"
     },
     "footer": {
       "disclaimer": "This content is not legal advice. Always refer to official sources for legal certainty.",
       "copyright": "© {year} Pasal.id. Indonesia's Open Legal Platform"
     },
     "languageSwitcher": {
       "switchTo": "Bahasa Indonesia",
       "label": "Switch language"
     }
   }
   ```

3. Create `apps/web/global.d.ts` for TypeScript type safety:
   ```typescript
   import id from './messages/id.json';

   type Messages = typeof id;

   declare module 'next-intl' {
     interface AppConfig {
       Locale: 'id' | 'en';
       Messages: Messages;
     }
   }
   ```

**Verification:**
- [x] `apps/web/messages/id.json` exists and is valid JSON (run `node -e "require('./messages/id.json')"`)
- [x] `apps/web/messages/en.json` exists and is valid JSON
- [x] Both files have identical keys (compare with `node -e "const id=Object.keys(require('./messages/id.json')); const en=Object.keys(require('./messages/en.json')); console.log('Match:', JSON.stringify(id)===JSON.stringify(en))"`)
- [x] `apps/web/global.d.ts` exists
- [x] `npx tsc --noEmit` shows no new errors
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "chore: add i18n message files (id + en)" && git push`

---

### Task 0.3 — Create middleware.ts for locale routing

**WHY:** next-intl middleware intercepts every request, reads the URL prefix and `Accept-Language` header, and rewrites to the correct `[locale]` path. This is the traffic router for i18n.

**WHAT EXISTS NOW:** The CLAUDE.md says "No middleware.ts. Auth is handled per-page via `requireAdmin()`." The old ARCHITECTURE.md shows a Supabase auth middleware but it was removed. We need to create middleware from scratch.

**CRITICAL:** The middleware must NOT interfere with:
- `/api/*` routes (REST API with CORS)
- `/_next/*` (Next.js internals)
- Static files (`.svg`, `.png`, `.ico`, etc.)
- `/admin/*` pages (auth handled by `requireAdmin()`)

**Actions:**

1. Create `apps/web/src/middleware.ts`:
   ```typescript
   import createMiddleware from 'next-intl/middleware';
   import { routing } from './i18n/routing';

   export default createMiddleware(routing);

   export const config = {
     // Match all paths EXCEPT:
     // - /api (REST API routes)
     // - /_next (Next.js internals)
     // - /_vercel (Vercel internals)
     // - Static files (anything with a file extension)
     matcher: [
       '/((?!api|_next|_vercel|admin|.*\\..*).*)',
       '/(id|en)/:path*',
     ],
   };
   ```

   ⚠️ **Notice `/admin` is excluded from the matcher.** Admin pages stay in Indonesian only — no i18n needed there. This keeps the admin auth flow (`requireAdmin()`) completely untouched.

**Verification:**
- [x] `apps/web/src/middleware.ts` exists
- [x] Matcher excludes `api`, `_next`, `_vercel`, `admin`, and static files
- [x] `npx tsc --noEmit` has no errors
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "feat: add next-intl middleware for locale routing" && git push`

---

## Phase 1: Route Migration — Move pages under [locale] [~3 hours]

> ⚠️ **This is the most delicate phase.** You are restructuring the entire `app/` directory. Do it carefully, file by file. After EACH sub-task, run `npm run build`.

### Task 1.1 — Create the [locale] layout shell

**WHY:** All public pages need to be nested under `app/[locale]/` so next-intl can inject the locale. The root `layout.tsx` becomes a thin shell, and a new `[locale]/layout.tsx` takes over most of the current root layout's responsibilities.

**WHAT EXISTS NOW:** `apps/web/src/app/layout.tsx` contains:
- Font loading (Instrument Serif, Instrument Sans, JetBrains Mono)
- `<html lang="id">` hardcoded
- `<body>` with font variables
- Skip-to-content link ("Langsung ke konten utama")
- `<MotionProvider>` wrapper
- Footer with `FOOTER_LINKS` array (all in Indonesian)
- Metadata export with `locale: "id_ID"` hardcoded

**WHAT TO DO:**

1. **Transform `apps/web/src/app/layout.tsx` into a minimal root layout.** It should ONLY have:
   - Font loading (keep exactly as-is)
   - `<html>` and `<body>` tags with font variables
   - `{children}` pass-through
   - NO metadata export (that moves to `[locale]/layout.tsx`)
   - NO footer (that moves to `[locale]/layout.tsx`)
   - NO skip-to-content link (moves to `[locale]/layout.tsx`)
   - NO `lang` attribute on `<html>` (next-intl sets this)

   The root layout becomes:
   ```tsx
   import type { ReactNode } from "react";
   import { Instrument_Serif, Instrument_Sans, JetBrains_Mono } from "next/font/google";
   import "./globals.css";

   // ... keep exact same font configs ...

   export default function RootLayout({ children }: { children: ReactNode }) {
     return (
       <html suppressHydrationWarning>
         <head>
           <meta name="theme-color" content="#F8F5F0" />
         </head>
         <body className={`${instrumentSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased font-sans`}>
           {children}
         </body>
       </html>
     );
   }
   ```

2. **Create `apps/web/src/app/[locale]/layout.tsx`** — this gets everything that was removed from root:
   ```tsx
   import type { ReactNode } from "react";
   import type { Metadata } from "next";
   import { notFound } from "next/navigation";
   import { setRequestLocale, getTranslations } from "next-intl/server";
   import { NextIntlClientProvider, useMessages } from "next-intl";
   import { hasLocale } from "next-intl";
   import Link from "next/link";
   import { routing } from "@/i18n/routing";
   import { MotionProvider } from "@/components/MotionProvider";
   import PasalLogo from "@/components/PasalLogo";
   import pick from "lodash/pick"; // install if not present: npm install lodash

   // Generate static params for both locales
   export function generateStaticParams() {
     return routing.locales.map((locale) => ({ locale }));
   }

   export async function generateMetadata({
     params,
   }: {
     params: Promise<{ locale: string }>;
   }): Promise<Metadata> {
     const { locale } = await params;
     const t = await getTranslations({ locale, namespace: "metadata" });

     return {
       title: { default: t("siteTitle"), template: `%s | ${t("siteName")}` },
       description: t("siteDescription"),
       metadataBase: new URL("https://pasal.id"),
       icons: {
         icon: [
           { url: "/favicon.svg", type: "image/svg+xml" },
           { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
           { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
         ],
         apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
         other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#1D1A18" }],
       },
       manifest: "/site.webmanifest",
       openGraph: {
         type: "website",
         locale: locale === "id" ? "id_ID" : "en_US",
         alternateLocale: locale === "id" ? ["en_US"] : ["id_ID"],
         url: "https://pasal.id",
         siteName: t("siteName"),
         title: t("siteTitle"),
         description: t("siteDescription"),
         images: [{ url: "/og-image.png", width: 1200, height: 630, alt: t("siteTitle") }],
       },
       twitter: {
         card: "summary_large_image",
         title: t("siteTitle"),
         description: t("siteDescription"),
         images: ["/og-image.png"],
       },
       other: {
         "msapplication-TileColor": "#F8F5F0",
         "msapplication-TileImage": "/mstile-150x150.png",
       },
     };
   }

   export default async function LocaleLayout({
     children,
     params,
   }: {
     children: ReactNode;
     params: Promise<{ locale: string }>;
   }) {
     const { locale } = await params;

     // Validate locale
     if (!hasLocale(routing.locales, locale)) {
       notFound();
     }

     setRequestLocale(locale);

     const t = await getTranslations("navigation");
     const footerT = await getTranslations("footer");
     const messages = useMessages();

     const FOOTER_LINKS = [
       { href: "/", label: t("home") },
       { href: "/jelajahi", label: t("browse") },
       { href: "/topik", label: t("topics") },
       { href: "/connect", label: t("connect") },
       { href: "/api", label: t("api") },
     ] as const;

     return (
       <>
         <a
           href="#main-content"
           className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
         >
           {t("skipToContent")}
         </a>
         <NextIntlClientProvider
           messages={pick(messages, ["common", "navigation", "search", "languageSwitcher"])}
         >
           <MotionProvider>
             <main id="main-content">{children}</main>
           </MotionProvider>
         </NextIntlClientProvider>
         <footer className="border-t mt-16 py-8 px-4">
           <div className="mx-auto max-w-5xl">
             <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
               {FOOTER_LINKS.map(({ href, label }) => (
                 <Link
                   key={href}
                   href={href}
                   className="text-muted-foreground hover:text-foreground transition-colors"
                 >
                   {label}
                 </Link>
               ))}
             </div>
             <div className="mt-6 flex flex-col items-center gap-3 text-xs text-muted-foreground">
               <PasalLogo size={24} className="text-muted-foreground/60" />
               <div className="space-y-1 text-center">
                 <p>{footerT("disclaimer")}</p>
                 <p suppressHydrationWarning>
                   {footerT("copyright", { year: new Date().getFullYear() })}
                 </p>
               </div>
             </div>
           </div>
         </footer>
       </>
     );
   }
   ```

   ⚠️ **Important:** The `Link` import in the footer should use the next-intl navigation `Link` from `@/i18n/routing` instead of `next/link` so it respects locale prefixes. Update the import:
   ```typescript
   import { Link } from "@/i18n/routing";
   ```

3. Install lodash if not present:
   ```bash
   npm install lodash @types/lodash
   ```

**Verification:**
- [x] `apps/web/src/app/layout.tsx` is minimal — only fonts, `<html>`, `<body>`, `{children}`
- [x] `apps/web/src/app/layout.tsx` does NOT have `lang="id"` on `<html>` (next-intl handles this)
- [x] `apps/web/src/app/[locale]/layout.tsx` exists with `generateStaticParams`, `generateMetadata`, `NextIntlClientProvider`
- [x] Footer links use `Link` from `@/i18n/routing`
- [x] `npx tsc --noEmit` — no errors
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/frontend-design` skill, verify footer matches `BRAND_GUIDELINES.md`

> 🔁 `git add -A && git commit -m "feat: create [locale] layout with translated metadata and footer" && git push`

---

### Task 1.2 — Move all public pages into [locale]/

**WHY:** Every public route must be under the `[locale]` segment for next-intl to inject the correct locale context. Admin pages stay outside.

**WHAT EXISTS NOW:** Pages directly in `src/app/`:
```
src/app/
├── page.tsx              → landing page
├── search/page.tsx       → search results
├── peraturan/[type]/[slug]/page.tsx → law reader
├── peraturan/[type]/[slug]/koreksi/[nodeId]/page.tsx → correction form
├── jelajahi/page.tsx     → browse index
├── jelajahi/[type]/page.tsx → browse by type
├── topik/page.tsx        → topics index
├── topik/[slug]/page.tsx → topic detail
├── connect/page.tsx      → MCP setup
├── api/page.tsx          → API docs (the PAGE, not the route handlers)
├── admin/                → admin pages (DO NOT MOVE)
├── api/v1/               → API route handlers (DO NOT MOVE)
├── api/suggestions/      → API route handler (DO NOT MOVE)
├── api/admin/            → API route handler (DO NOT MOVE)
```

**Actions:**

Move every public page into `src/app/[locale]/`. Do NOT move:
- `src/app/admin/` — stays as-is (excluded from middleware matcher)
- `src/app/api/` (route handlers at `api/v1/`, `api/suggestions/`, `api/admin/`) — stays as-is
- `src/app/globals.css` — stays in root
- `src/app/layout.tsx` — already handled (root layout)
- `src/app/not-found.tsx` — stays in root (global 404)
- `src/app/sitemap.ts` — stays in root (we'll update it later)
- `src/app/robots.ts` — stays in root

```bash
cd apps/web/src/app

# Create [locale] directory
mkdir -p "[locale]"

# Move public pages (preserve directory structure)
mv page.tsx "[locale]/page.tsx"
mv search "[locale]/search"
mv peraturan "[locale]/peraturan"
mv jelajahi "[locale]/jelajahi"
mv topik "[locale]/topik"
mv connect "[locale]/connect"

# The /api PAGE (not the route handlers) — this is the docs page
# Only move if it's a page.tsx for the API docs, NOT the route handlers
# Check: if src/app/api/page.tsx exists as a DOCS page, move it
# The api/v1/, api/suggestions/, api/admin/ directories MUST stay
```

⚠️ **Be extremely careful with `/api`.** The `/api/page.tsx` (API documentation page) should move to `[locale]/api/page.tsx`. The API route handlers (`/api/v1/*`, `/api/suggestions/*`, `/api/admin/*`) MUST stay in `src/app/api/`.

After moving, the structure should be:
```
src/app/
├── [locale]/
│   ├── layout.tsx         ← created in Task 1.1
│   ├── page.tsx           ← landing page
│   ├── search/page.tsx
│   ├── peraturan/[type]/[slug]/page.tsx
│   ├── peraturan/[type]/[slug]/koreksi/[nodeId]/page.tsx
│   ├── jelajahi/page.tsx
│   ├── jelajahi/[type]/page.tsx
│   ├── topik/page.tsx
│   ├── topik/[slug]/page.tsx
│   ├── connect/page.tsx
│   └── api/page.tsx       ← API docs page only
├── admin/                 ← UNCHANGED
├── api/                   ← route handlers UNCHANGED
│   ├── v1/
│   ├── suggestions/
│   └── admin/
├── layout.tsx             ← root (minimal)
├── globals.css
├── not-found.tsx
├── sitemap.ts
└── robots.ts
```

**After moving, add `setRequestLocale` to every moved page** that is a Server Component. Add this near the top of each page function:

```typescript
import { setRequestLocale } from 'next-intl/server';

export default async function SomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // ... rest of the page
}
```

For pages that already destructure `params` (like `peraturan/[type]/[slug]/page.tsx`), just add `locale` to the destructuring:

```typescript
export default async function Page({ params }: { params: Promise<{ locale: string; type: string; slug: string }> }) {
  const { locale, type, slug } = await params;
  setRequestLocale(locale);
  // ...
}
```

**Verification:**
- [x] All public pages are under `src/app/[locale]/`
- [x] Admin pages are still at `src/app/admin/` — UNCHANGED
- [x] API route handlers are still at `src/app/api/v1/`, `api/suggestions/`, `api/admin/` — UNCHANGED
- [x] Every moved Server Component page calls `setRequestLocale(locale)` early
- [x] `npm run build` succeeds ← **CRITICAL — do not proceed if this fails**
- [x] Visit `http://localhost:3000` — landing page loads (may show Indonesian — that's correct)
- [x] Visit `http://localhost:3000/en` — landing page loads (still Indonesian text is fine — we haven't wired translations yet)
- [x] Visit `http://localhost:3000/search?q=test` — search page loads
- [x] Visit `http://localhost:3000/admin` — admin page loads (not affected by i18n)
- [x] API endpoint `http://localhost:3000/api/v1/search?q=test` — returns JSON (not affected)
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "feat: move public pages under [locale] segment" && git push`

---

### Task 1.3 — Update all internal links to use next-intl Link

**WHY:** Every `<Link>` from `next/link` that points to a public page must be replaced with `Link` from `@/i18n/routing` so it automatically includes the locale prefix (e.g., `/en/search` when viewing in English).

**WHAT TO CHANGE:**

Search the entire `apps/web/src/` directory for:
```typescript
import Link from "next/link";
```

In every file that links to a PUBLIC route (not admin, not API), replace with:
```typescript
import { Link } from "@/i18n/routing";
```

**Files that MUST be updated** (non-exhaustive — search for all):
- `src/components/Header.tsx`
- `src/components/MobileNav.tsx`
- `src/components/landing/HeroSection.tsx` (if it links anywhere)
- `src/components/landing/SearchSuggestions.tsx`
- `src/components/landing/BrowseSection.tsx`
- `src/components/landing/CuratedLaws.tsx`
- `src/app/[locale]/page.tsx` (landing page)
- `src/app/[locale]/search/page.tsx`
- `src/app/[locale]/jelajahi/page.tsx`
- `src/app/[locale]/jelajahi/[type]/page.tsx`
- `src/app/[locale]/peraturan/[type]/[slug]/page.tsx`

**Files that should keep `next/link`:**
- `src/app/admin/*` — admin pages don't participate in i18n
- Any component that ONLY links to `/admin/*` paths

**Special case — SearchBar.tsx:**
If `SearchBar` uses `router.push('/search?q=...')` from `next/navigation`, replace with `useRouter` from `@/i18n/routing`:
```typescript
// Before:
import { useRouter } from "next/navigation";
// After:
import { useRouter } from "@/i18n/routing";
```

**Verification:**
- [x] `grep -r "from \"next/link\"" apps/web/src/` — only admin files and special cases remain
- [x] `grep -r "from \"next/navigation\"" apps/web/src/` — only admin files and route handlers remain (public components use `@/i18n/routing`)
- [x] `npm run build` succeeds
- [x] Click through the site — all links still work at `/` (Indonesian)
- [x] Navigate to `/en` — links in the page point to `/en/*` paths
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "refactor: replace next/link with next-intl Link for public routes" && git push`

---

## Phase 2: Wire Up Translations [~4 hours]

### Task 2.1 — Translate the Header and MobileNav

**WHY:** The header is visible on every page. It has hardcoded strings: "Jelajahi", "API", "Hubungkan Claude", "Buka menu", "Tutup menu".

**WHAT EXISTS NOW:**
- `Header.tsx` — Server Component with `NAV_LINKS` array containing hardcoded labels
- `MobileNav.tsx` — Client Component (`"use client"`) with same hardcoded nav links plus aria-labels

**Actions:**

1. **Update `Header.tsx`** — make it locale-aware. Header is a Server Component, so use `useTranslations` from `next-intl`:

   ```typescript
   import { useTranslations } from "next-intl";
   import { Link } from "@/i18n/routing";
   // ... other imports ...

   export default function Header({ showSearch = false, searchDefault }: HeaderProps) {
     const t = useTranslations("navigation");

     const NAV_LINKS = [
       { href: "/jelajahi" as const, label: t("browse") },
       { href: "/api" as const, label: t("api") },
     ];

     return (
       <header ...>
         <div ...>
           <Link href="/" ...>
             {/* logo unchanged */}
           </Link>
           {/* ... search ... */}
           <nav ...>
             {NAV_LINKS.map(({ href, label }) => (
               <Link key={href} href={href} ...>{label}</Link>
             ))}
             <ShimmerLink href="/connect" ...>
               {t("connect")}
             </ShimmerLink>
           </nav>
           <MobileNav />
         </div>
       </header>
     );
   }
   ```

2. **Update `MobileNav.tsx`** — it's a Client Component. The cleanest approach: pass translated strings as props from `Header.tsx`:

   Add props to MobileNav:
   ```typescript
   interface MobileNavProps {
     labels: {
       openMenu: string;
       closeMenu: string;
       browse: string;
       api: string;
       connect: string;
     };
   }
   ```

   In Header, pass the labels:
   ```tsx
   <MobileNav labels={{
     openMenu: t("openMenu"),
     closeMenu: t("closeMenu"),
     browse: t("browse"),
     api: t("api"),
     connect: t("connect"),
   }} />
   ```

   In MobileNav, use `labels.browse` instead of hardcoded "Jelajahi", etc.

3. **Add the Language Switcher** — create `src/components/LanguageSwitcher.tsx`:
   ```typescript
   "use client";

   import { useLocale, useTranslations } from "next-intl";
   import { usePathname, useRouter } from "@/i18n/routing";
   import type { Locale } from "@/i18n/routing";

   export default function LanguageSwitcher() {
     const t = useTranslations("languageSwitcher");
     const locale = useLocale() as Locale;
     const pathname = usePathname();
     const router = useRouter();

     const otherLocale: Locale = locale === "id" ? "en" : "id";

     function handleSwitch() {
       router.replace(pathname, { locale: otherLocale });
     }

     return (
       <button
         onClick={handleSwitch}
         className="text-sm text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
         aria-label={t("label")}
       >
         <span className="inline-flex items-center gap-1.5">
           <span aria-hidden="true">🌐</span>
           <span lang={otherLocale}>{t("switchTo")}</span>
         </span>
       </button>
     );
   }
   ```

4. Add `LanguageSwitcher` to `Header.tsx` (in the desktop nav, before the CTA button) and to `MobileNav.tsx` (above the nav links).

**📖 BRAND CHECK:** The language switcher must use `font-sans` (Instrument Sans), `text-sm`, `text-muted-foreground`. No globe emoji if it clashes with the Batu Candi aesthetic — use a simple text toggle instead. Check `BRAND_GUIDELINES.md`.

**Verification:**
- [x] Header shows translated nav labels at `/` (Indonesian) and `/en` (English)
- [x] Mobile nav shows translated labels and aria-labels
- [x] Language switcher is visible in both desktop and mobile nav
- [x] Clicking the switcher navigates between `/` and `/en` (preserving the current path)
- [x] CTA button says "Hubungkan Claude" in ID and "Connect Claude" in EN
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills
- [x] Verify language switcher placement and styling against `BRAND_GUIDELINES.md`

> 🔁 `git add -A && git commit -m "feat: translate Header, MobileNav, add LanguageSwitcher" && git push`

---

### Task 2.2 — Translate the Landing Page components

**WHY:** The landing page is the first thing users see. It has the most hardcoded text.

**WHAT TO CHANGE:**

1. **`HeroSection.tsx`** — Client Component (`"use client"`). Since it's client-side and uses Framer Motion, either:
   - **Option A (preferred):** Make the parent `[locale]/page.tsx` pass translated strings as props
   - **Option B:** Use `useTranslations` (works because `[locale]/layout.tsx` provides `NextIntlClientProvider` with the `"common"` namespace — but you'd need to also include `"hero"` in the provider pick list)

   Recommended: **Option A.** In `[locale]/page.tsx`:
   ```tsx
   import { getTranslations } from "next-intl/server";

   export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
     const { locale } = await params;
     setRequestLocale(locale);
     const t = await getTranslations("hero");

     return (
       <div ...>
         <Header />
         <HeroSection
           heading={t("heading")}
           subheading={t("subheading")}
         />
         {/* ... */}
       </div>
     );
   }
   ```

   Update HeroSection to accept `heading` and `subheading` props instead of hardcoded strings.

2. **`SearchSuggestions.tsx`** — Client Component. Pass translated label as prop:
   ```tsx
   <SearchSuggestions label={heroT("trySuggestion")} />
   ```
   The suggestion search terms themselves (like "uud 1945", "hak pekerja kontrak") are search queries — they should stay in Indonesian for both languages since the legal content is in Indonesian. Add a comment explaining why.

3. **`StatsSection.tsx`** — Server Component. Use `useTranslations('stats')` directly:
   ```typescript
   import { useTranslations } from "next-intl";

   export default async function StatsSection() {
     const t = useTranslations("stats");
     const { totalWorks, pasalCount, minYear, maxYear } = await getLandingStats();

     const stats = [
       {
         numericValue: totalWorks,
         label: t("regulations"),
         detail: t("regulationsDetail", { count: 11, minYear, maxYear }),
       },
       // ...
     ];
     // ...
   }
   ```

4. **`BrowseSection.tsx`** — translate "Lihat semua jenis peraturan" using `useTranslations('browse')`.

5. **`TrustBlock.tsx`** — check if it has hardcoded text and translate accordingly.

6. **`CuratedLaws.tsx`** — regulation titles and law names stay in Indonesian (they're legal content). Only translate UI labels like section headings.

7. **Update the `JsonLd` structured data** in `[locale]/page.tsx` — the `inLanguage` field should reflect the current locale:
   ```typescript
   const websiteLd = {
     // ...
     inLanguage: locale,
     description: t("siteDescription"), // from metadata namespace
     // ...
   };
   ```

**Verification:**
- [x] Landing page at `/` — all UI text in Indonesian
- [x] Landing page at `/en` — heading says "Find the legal article you need", stats say "Regulations", "Structured articles", "Free & Open Source"
- [x] Search suggestions still show Indonesian search terms (correct — legal content is in Indonesian)
- [x] Stats numbers still work (count up animation if applicable)
- [x] `JsonLd` `inLanguage` is `"id"` at `/` and `"en"` at `/en`
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills

> 🔁 `git add -A && git commit -m "feat: translate landing page components" && git push`

---

### Task 2.3 — Translate the Search page

**WHY:** Search is the core feature. The search page has many hardcoded UI strings.

**WHAT EXISTS NOW:** `search/page.tsx` contains:
- `generateMetadata` returning `"Hasil pencarian: ${query}"` / `"Cari Peraturan"`
- `formatRelevance()` function returning "Sangat relevan", "Relevan", "Mungkin relevan"
- Error message: "Terjadi kesalahan saat mencari..."
- Empty state: "Masukkan kata kunci..."
- Pagination aria-labels: "Halaman", "Halaman sebelumnya", "Halaman berikutnya"
- Status labels from `STATUS_LABELS`

**Actions:**

1. Update `generateMetadata` to use `getTranslations`:
   ```typescript
   export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }): Promise<Metadata> {
     const { locale } = await params;
     const { q } = await searchParams;
     const t = await getTranslations({ locale, namespace: "search" });

     return {
       title: q ? t("resultsTitle", { query: q }) : t("title"),
       robots: { index: false, follow: true },
     };
   }
   ```

2. Replace all hardcoded strings in the page with `t()` calls. Since this is a Server Component, use `useTranslations` from `next-intl`:
   ```typescript
   const t = useTranslations("search");
   const statusT = useTranslations("status");
   ```

3. **Create a locale-aware `formatRelevance` helper:**
   ```typescript
   function formatRelevance(score: number, maxScore: number, t: (key: string, values?: Record<string, unknown>) => string): string {
     const pct = Math.round((score / maxScore) * 100);
     if (pct >= 70) return t("relevanceHigh", { pct });
     if (pct >= 40) return t("relevanceMedium", { pct });
     return t("relevanceLow", { pct });
   }
   ```

4. Replace status label usage — instead of `STATUS_LABELS[status]`, use `statusT(status)`:
   ```tsx
   <Badge>{statusT(group.status)}</Badge>
   ```

5. Update pagination aria-labels.

**Verification:**
- [x] `/search?q=upah` — results page in Indonesian with "Hasil pencarian: upah"
- [x] `/en/search?q=upah` — results page in English with "Search results: upah"
- [x] Relevance labels show in correct language
- [x] Status badges ("In Force", "Amended") show in correct language
- [x] Pagination aria-labels are translated
- [x] Error and empty states show translated messages
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills

> 🔁 `git add -A && git commit -m "feat: translate search page" && git push`

---

### Task 2.4 — Translate the Law Reader page

**WHY:** The law reader is where users spend the most time. UI chrome needs translation; legal content stays in Indonesian.

**WHAT EXISTS NOW:** `peraturan/[type]/[slug]/page.tsx` contains:
- `generateMetadata` with "Baca teks lengkap..."
- Status badges using `STATUS_LABELS`
- Type labels using `TYPE_LABELS`
- `DisclaimerBanner` with hardcoded warning text
- Reader components: `TableOfContents`, `PasalBlock`, `AmendmentTimeline`

**Actions:**

1. Update `generateMetadata` with translated strings.

2. Update page body — translate UI labels, keep legal content as-is.

3. **Update `DisclaimerBanner.tsx`** — use translations:
   ```typescript
   import { useTranslations } from "next-intl";

   export default function DisclaimerBanner({ className }: { className?: string }) {
     const t = useTranslations("disclaimer");
     return (
       <div className={`...${className ?? ""}`}>
         <PasalLogo size={18} className="mt-px shrink-0 opacity-60" />
         <p>{t("text")}</p>
       </div>
     );
   }
   ```

4. **Add the Legal Content Language Notice** — when the UI is in English, show an extra notice near the legal content:
   ```tsx
   {locale === "en" && (
     <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground mb-4">
       <p lang="en">{t("legalContentNotice")}</p>
     </div>
   )}
   ```

5. **Add `lang="id"` to the legal content wrapper** for accessibility (screen readers switch pronunciation):
   ```tsx
   <article lang="id">
     {/* All PasalBlock content lives here */}
   </article>
   ```

6. **TYPE_LABELS stay in Indonesian** even when UI is in English — regulation type names are proper legal terms (e.g., "Undang-Undang" shouldn't become "Law"). These are not UI strings; they are Indonesian legal nomenclature. Add a code comment explaining this decision.

**Verification:**
- [x] `/peraturan/uu/uu-13-2003` — page metadata, disclaimers, and UI labels in Indonesian
- [x] `/en/peraturan/uu/uu-13-2003` — UI labels in English, legal content still in Indonesian
- [x] English version shows "Legal documents are displayed in Bahasa Indonesia..." notice
- [x] Legal content is wrapped in `<article lang="id">`
- [x] Status badges show "In Force" / "Amended" in English
- [x] TYPE_LABELS remain in Indonesian on both versions (correct behavior)
- [x] `DisclaimerBanner` translates correctly
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills

> 🔁 `git add -A && git commit -m "feat: translate law reader UI, add lang attributes for accessibility" && git push`

---

### Task 2.5 — Translate Browse, Topics, Connect, and API pages

**WHY:** These are the remaining public pages. Each needs the same treatment: `setRequestLocale`, `useTranslations`, and translated metadata.

**Actions for each page:**

#### `/jelajahi` and `/jelajahi/[type]`
- Translate page title, description, filter labels
- Regulation type names (`TYPE_LABELS`) stay in Indonesian — see Task 2.4 reasoning
- Translate "Lihat semua jenis peraturan", filter dropdowns

#### `/topik` and `/topik/[slug]`
- Topic titles and descriptions are content (stay in Indonesian for now)
- Translate UI chrome: section headings, CTA buttons, "Kembali" links

#### `/connect`
- Translate section headings: "Perintah Instalasi" → "Install Command", "Contoh Pertanyaan" → "Example Prompts"
- MCP install command stays unchanged (it's a CLI command)
- Example prompts stay in Indonesian (they're legal questions for the Indonesian database)
- Add note in English version: "Example prompts are in Indonesian as the legal database is in Bahasa Indonesia."

#### `/api` (docs page)
- Translate page title and description
- API endpoint documentation stays technical/English (endpoint paths, JSON schemas)

**For each page, update `generateMetadata` with locale-aware titles and add hreflang alternates:**
```typescript
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "browse" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "id" ? "https://pasal.id/jelajahi" : "https://pasal.id/en/jelajahi",
      languages: {
        id: "https://pasal.id/jelajahi",
        en: "https://pasal.id/en/jelajahi",
        "x-default": "https://pasal.id/jelajahi",
      },
    },
  };
}
```

**Verification:**
- [x] `/jelajahi` — Indonesian UI
- [x] `/en/jelajahi` — English UI, regulation types still in Indonesian
- [x] `/topik` — Indonesian
- [x] `/en/topik` — English UI chrome
- [x] `/connect` — Indonesian
- [x] `/en/connect` — English headings, Indonesian example prompts with note
- [x] `/api` — both versions work
- [x] All pages have `alternates` in their metadata
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills

> 🔁 `git add -A && git commit -m "feat: translate browse, topics, connect, and API pages" && git push`

---

## Phase 3: SEO & Polish [~2 hours]

### Task 3.1 — Update sitemap.ts with language alternates

**WHY:** Google needs language alternates in the sitemap to correctly index both language versions of each page.

**WHAT EXISTS NOW:** `src/app/sitemap.ts` (if it exists) generates URLs without language alternates.

**Actions:**

1. Update or create `apps/web/src/app/sitemap.ts`:
   ```typescript
   import type { MetadataRoute } from "next";
   import { createClient } from "@/lib/supabase/server";

   const BASE = "https://pasal.id";

   // Static pages
   const STATIC_PAGES = [
     "",           // homepage
     "/jelajahi",
     "/topik",
     "/connect",
     "/api",
     "/search",
   ];

   export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
     const supabase = await createClient();

     // Fetch all published works for dynamic pages
     const { data: works } = await supabase
       .from("works")
       .select("slug, regulation_types!inner(code), updated_at")
       .not("slug", "is", null);

     const entries: MetadataRoute.Sitemap = [];

     // Static pages — both locales
     for (const page of STATIC_PAGES) {
       entries.push({
         url: `${BASE}${page}`,
         alternates: {
           languages: {
             id: `${BASE}${page}`,
             en: `${BASE}/en${page}`,
           },
         },
         changeFrequency: "weekly",
         priority: page === "" ? 1.0 : 0.8,
       });
     }

     // Dynamic regulation pages
     if (works) {
       for (const work of works) {
         const type = Array.isArray(work.regulation_types)
           ? work.regulation_types[0]?.code?.toLowerCase()
           : (work.regulation_types as { code: string })?.code?.toLowerCase();
         if (!type || !work.slug) continue;

         const path = `/peraturan/${type}/${work.slug}`;
         entries.push({
           url: `${BASE}${path}`,
           lastModified: work.updated_at ? new Date(work.updated_at) : undefined,
           alternates: {
             languages: {
               id: `${BASE}${path}`,
               en: `${BASE}/en${path}`,
             },
           },
           changeFrequency: "monthly",
           priority: 0.7,
         });
       }
     }

     return entries;
   }
   ```

**Verification:**
- [x] Visit `http://localhost:3000/sitemap.xml` — XML renders with `<xhtml:link>` alternates for each URL
- [x] Each entry has both `id` and `en` alternates
- [x] Static pages and dynamic regulation pages are both included
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "feat: add language alternates to sitemap" && git push`

---

### Task 3.2 — Add hreflang to all page metadata

**WHY:** Every public page needs bidirectional hreflang tags + x-default so Google correctly cross-references the language versions. Some pages were already updated in Task 2.5, but we need to ensure comprehensive coverage.

**Actions:**

1. Create a helper function `apps/web/src/lib/i18n-metadata.ts`:
   ```typescript
   const BASE = "https://pasal.id";

   export function getAlternates(path: string, locale: string) {
     const idPath = `${BASE}${path}`;
     const enPath = `${BASE}/en${path}`;

     return {
       canonical: locale === "id" ? idPath : enPath,
       languages: {
         id: idPath,
         en: enPath,
         "x-default": idPath, // Indonesian is the default
       },
     };
   }
   ```

2. Apply `getAlternates()` in every page's `generateMetadata`:
   ```typescript
   import { getAlternates } from "@/lib/i18n-metadata";

   export async function generateMetadata({ params }: Props): Promise<Metadata> {
     const { locale } = await params;
     return {
       // ... existing metadata ...
       alternates: getAlternates("/jelajahi", locale),
     };
   }
   ```

3. For dynamic routes, pass the full path:
   ```typescript
   alternates: getAlternates(`/peraturan/${type}/${slug}`, locale),
   ```

4. **Audit every page's `generateMetadata`** to ensure it includes `alternates`.

**Verification:**
- [x] View source of every public page — each has `<link rel="alternate" hreflang="id" ...>` and `<link rel="alternate" hreflang="en" ...>` and `<link rel="alternate" hreflang="x-default" ...>`
- [x] `hreflang="id"` URLs never have `/id/` prefix (correct — they use root paths)
- [x] `hreflang="en"` URLs always have `/en/` prefix
- [x] `x-default` always points to the Indonesian (unprefixed) URL
- [x] Self-referencing canonical is correct for each language version
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`

> 🔁 `git add -A && git commit -m "feat: add hreflang alternates to all page metadata" && git push`

---

### Task 3.3 — Add the English content notice banner

**WHY:** When users visit `/en/*`, the UI is in English but legal documents are in Indonesian. Users need to understand this clearly. This follows the PERATURAN.GO.ID pattern.

**Actions:**

1. Create `apps/web/src/components/LegalContentLanguageNotice.tsx`:
   ```tsx
   import { useLocale, useTranslations } from "next-intl";

   export default function LegalContentLanguageNotice() {
     const locale = useLocale();
     const t = useTranslations("disclaimer");

     // Only show on English pages
     if (locale === "id") return null;

     return (
       <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
         <span aria-hidden="true" className="text-base">🔤</span>
         <p>{t("legalContentNotice")}</p>
       </div>
     );
   }
   ```

2. Add this component to:
   - `peraturan/[type]/[slug]/page.tsx` — above the reader content
   - `search/page.tsx` — above search results (when results are showing)
   - Any page that displays legal content from the database

**📖 BRAND CHECK:** Ensure the notice uses `text-xs`, `rounded-lg`, `border-primary/20`, `bg-primary/5`. No `shadow-*`. Check `BRAND_GUIDELINES.md`.

**Verification:**
- [x] At `/peraturan/uu/uu-13-2003` — NO notice shown (Indonesian page)
- [x] At `/en/peraturan/uu/uu-13-2003` — notice visible: "Legal documents are displayed in Bahasa Indonesia..."
- [x] Notice styling follows brand guidelines
- [x] `npm run build` succeeds
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills

> 🔁 `git add -A && git commit -m "feat: add legal content language notice for English pages" && git push`

---

### Task 3.4 — Final integration test and cleanup

**WHY:** Full end-to-end verification that everything works together.

**Actions:**

1. **Run a full build:**
   ```bash
   cd apps/web
   npm run build
   ```

2. **Run lint:**
   ```bash
   npm run lint
   ```

3. **Run tests:**
   ```bash
   npm run test
   ```
   Update any tests that broke due to i18n changes (e.g., `legal-status.test.ts` may need adjustment).

4. **Manual smoke test — Indonesian (default):**
   - [ ] `pasal.id/` — landing page, all text in Indonesian, no `/id` prefix in URL
   - [ ] `pasal.id/search?q=upah` — search works, results in Indonesian
   - [ ] `pasal.id/peraturan/uu/uu-13-2003` — reader loads, no language notice
   - [ ] `pasal.id/jelajahi` — browse page in Indonesian
   - [ ] `pasal.id/connect` — connect page in Indonesian
   - [ ] `pasal.id/admin` — admin pages work, completely unaffected by i18n
   - [ ] `pasal.id/api/v1/search?q=test` — API returns JSON, unaffected
   - [ ] Language switcher shows "🌐 English"

5. **Manual smoke test — English:**
   - [ ] `pasal.id/en` — landing page in English
   - [ ] `pasal.id/en/search?q=upah` — search in English UI, Indonesian content
   - [ ] `pasal.id/en/peraturan/uu/uu-13-2003` — English UI, Indonesian legal content, language notice visible
   - [ ] `pasal.id/en/jelajahi` — English UI
   - [ ] `pasal.id/en/connect` — English UI
   - [ ] Language switcher shows "🌐 Bahasa Indonesia"
   - [ ] Clicking switcher goes back to unprefixed Indonesian URL

6. **SEO verification:**
   - [ ] View source of any page — `<html lang="id">` on Indonesian, `<html lang="en">` on English
   - [ ] hreflang tags present on all public pages
   - [ ] `<article lang="id">` wraps legal content on English pages
   - [ ] `pasal.id/sitemap.xml` — has language alternates
   - [ ] OG tags: `locale: "id_ID"` on Indonesian, `locale: "en_US"` on English

7. **Clean up any unused imports or dead code.** Remove any commented-out old hardcoded strings.

8. **Update `CLAUDE.md`** to document the i18n setup:
   Add a new section:
   ```markdown
   ### i18n

   Uses `next-intl` with `localePrefix: 'as-needed'`. Indonesian (default) has no URL prefix. English uses `/en` prefix.

   - Config: `src/i18n/routing.ts`, `src/i18n/request.ts`
   - Messages: `messages/id.json` (source of truth), `messages/en.json`
   - Middleware: `src/middleware.ts` (excludes `/api`, `/admin`, static files)
   - Type safety: `global.d.ts` augments `next-intl` with message types
   - Navigation: Use `Link`, `useRouter`, `usePathname` from `@/i18n/routing` (not `next/link`)
   - Legal content stays in Indonesian regardless of UI locale
   - Admin pages are NOT internationalized
   ```

**Verification:**
- [x] `npm run build` — zero errors
- [x] `npm run lint` — zero errors
- [x] `npm run test` — all pass
- [x] All manual smoke tests above pass
- [x] `CLAUDE.md` updated with i18n section
- [x] Run `code-simplifier`
- [x] Run `code-review`
- [x] Run `/web-design-guidelines` and `/frontend-design` skills (final check)

> 🔁 `git add -A && git commit -m "feat: complete i18n implementation — Indonesian default + English at /en" && git push`

---

## Summary: Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `next-intl`, `lodash`, `@types/lodash` |
| `next.config.ts` | Wrapped with `createNextIntlPlugin` |
| `src/middleware.ts` | **NEW** — next-intl locale routing middleware |
| `src/i18n/routing.ts` | **NEW** — routing config (locales, prefix mode) |
| `src/i18n/request.ts` | **NEW** — request config (message loading, timezone) |
| `messages/id.json` | **NEW** — Indonesian translations (source of truth) |
| `messages/en.json` | **NEW** — English translations |
| `global.d.ts` | **NEW** — TypeScript type augmentation |
| `src/app/layout.tsx` | Stripped to minimal root layout |
| `src/app/[locale]/layout.tsx` | **NEW** — locale-aware layout with metadata, footer, providers |
| `src/app/[locale]/**` | All public pages moved here |
| `src/components/Header.tsx` | Uses translations + LanguageSwitcher |
| `src/components/MobileNav.tsx` | Receives translated labels as props |
| `src/components/LanguageSwitcher.tsx` | **NEW** — locale toggle button |
| `src/components/LegalContentLanguageNotice.tsx` | **NEW** — English-only content notice |
| `src/components/DisclaimerBanner.tsx` | Uses translations |
| `src/components/landing/*.tsx` | All use translations |
| `src/lib/i18n-metadata.ts` | **NEW** — hreflang helper |
| `src/app/sitemap.ts` | Updated with language alternates |
| `CLAUDE.md` | Updated with i18n documentation |

**Files NOT changed:**
- `src/app/admin/*` — completely untouched
- `src/app/api/v1/*`, `src/app/api/suggestions/*`, `src/app/api/admin/*` — route handlers untouched
- `apps/mcp-server/*` — untouched
- `scripts/*` — untouched
- `packages/supabase/*` — no migration needed
- `BRAND_GUIDELINES.md` — no changes needed