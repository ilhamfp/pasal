# TASKS-GROWTH.md — Shareability & Growth Features

> **How to use this file:** Work through tasks in order. Each task is atomic — complete it fully before moving to the next. Every task ends with verification checkboxes and mandatory skill runs. Do NOT skip verification steps.
>
> **Stack:** Next.js 16+ (App Router) on Vercel, Supabase (Postgres), Tailwind CSS + shadcn/ui
> **Brand:** Read `BRAND_GUIDELINES.md` before any frontend work. Batu Candi aesthetic — near-monochrome warm graphite, one verdigris accent (#2B6150), Instrument Serif/Sans typography.
> **Repo:** `ilhamfp/pasal` on GitHub
>
> **Key principle:** Every feature here serves one goal — make every pasal.id URL irresistible to click when shared on WhatsApp, Telegram, and Twitter. Indonesia has 112M WhatsApp users. That's our distribution channel.

## Phase 1: Dynamic OG Images [~3-4 hours]

The single highest-visibility change. Every link shared on WhatsApp/Telegram/Twitter gets a visual card. Right now we have a static `/og-image.png`. We need dynamic, per-page OG images.

---

### Task 1.1 — Install `@vercel/og` and create the OG image API route

**WHY:** `@vercel/og` uses Satori (JSX → SVG → PNG) at the edge. It's ~5× faster than Puppeteer and native to Vercel. We need this for dynamic per-law OG images.

**WHAT EXISTS NOW:**
- `apps/web/src/app/layout.tsx` has static OG metadata pointing to `/og-image.png`
- No dynamic OG generation exists
- Fonts: Instrument Serif + Instrument Sans already loaded via `next/font/google` in layout.tsx (but Satori can't use these — it needs the raw `.ttf` files from M1)

**ACTIONS:**

1. Install the package:
   ```bash
   cd apps/web
   npm install @vercel/og
   ```

2. Verify the font files exist (placed by founder in M1):
   ```bash
   ls src/app/api/og/fonts/
   # Should show: InstrumentSerif-Regular.ttf  InstrumentSans-Regular.ttf
   ```
   If they don't exist, STOP and ask the founder to complete M1.

3. Create `apps/web/src/app/api/og/route.tsx` with placeholder templates:

   ```tsx
   import { ImageResponse } from "next/og";
   import { NextRequest } from "next/server";

   export const runtime = "edge";

   // --- Helper: status badge colors (from BRAND_GUIDELINES.md § 2.5) ---

   function getStatusStyle(status: string): { bg: string; text: string; label: string } {
     const s = status.toLowerCase();
     if (s === "berlaku") return { bg: "#E8F5EC", text: "#2E7D52", label: "Berlaku" };
     if (s === "diubah") return { bg: "#FFF6E5", text: "#C47F17", label: "Diubah" };
     if (s === "dicabut") return { bg: "#FDF2F2", text: "#C53030", label: "Dicabut" };
     return { bg: "#EEE8E4", text: "#524C48", label: status };
   }

   // --- Templates ---

   function defaultTemplate({ title }: { title: string }) {
     return (
       <div
         style={{
           display: "flex",
           flexDirection: "column",
           justifyContent: "center",
           width: "100%",
           height: "100%",
           backgroundColor: "#F8F5F0",
           padding: "80px",
           fontFamily: "Instrument Serif",
         }}
       >
         <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
           <span style={{ fontSize: "36px", color: "#2B6150" }}>§</span>
           <span style={{ fontSize: "24px", color: "#1D1A18" }}>Pasal.id</span>
         </div>
         <div style={{ fontSize: "48px", color: "#1D1A18", lineHeight: 1.2, marginBottom: "8px" }}>
           {title}
         </div>
         <div style={{ fontSize: "48px", color: "#68625E", fontStyle: "italic", lineHeight: 1.2 }}>
           dengan mudah
         </div>
         <div style={{ width: "120px", height: "1px", backgroundColor: "#DDD6D1", marginTop: "32px", marginBottom: "24px" }} />
         <div style={{ fontSize: "20px", color: "#524C48", fontFamily: "Instrument Sans", lineHeight: 1.6 }}>
           Platform hukum Indonesia terbuka pertama berbasis AI
         </div>
       </div>
     );
   }

   function lawTemplate({
     title, type, number, year, status, pasalCount, snippet,
   }: {
     title: string; type: string; number: string; year: string;
     status: string; pasalCount: string; snippet: string;
   }) {
     const statusStyle = getStatusStyle(status);
     const displayTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;

     return (
       <div
         style={{
           display: "flex",
           flexDirection: "column",
           justifyContent: "space-between",
           width: "100%",
           height: "100%",
           backgroundColor: "#1D1A18",
           padding: "80px",
           fontFamily: "Instrument Sans",
         }}
       >
         <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
           <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
             <span
               style={{
                 fontSize: "16px",
                 color: "#FFFFFF",
                 backgroundColor: "#2B6150",
                 padding: "6px 14px",
                 borderRadius: "6px",
                 fontFamily: "Instrument Sans",
               }}
             >
               {type} {number}/{year}
             </span>
             <span
               style={{
                 fontSize: "16px",
                 color: statusStyle.text,
                 backgroundColor: statusStyle.bg,
                 padding: "6px 14px",
                 borderRadius: "6px",
                 fontFamily: "Instrument Sans",
               }}
             >
               {statusStyle.label}
             </span>
           </div>
           <div
             style={{
               fontSize: "44px",
               color: "#F8F5F0",
               fontFamily: "Instrument Serif",
               lineHeight: 1.2,
             }}
           >
             {displayTitle}
           </div>
           {snippet && (
             <div style={{
               fontSize: "20px",
               color: "#958D88",
               fontFamily: "Instrument Sans",
               lineHeight: 1.5,
               overflow: "hidden",
             }}>
               &ldquo;{snippet.length > 120 ? snippet.slice(0, 117) + "..." : snippet}&rdquo;
             </div>
           )}
         </div>
         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
             <span style={{ fontSize: "24px", color: "#68625E" }}>§</span>
             <span style={{ fontSize: "18px", color: "#68625E", fontFamily: "Instrument Serif" }}>
               Pasal.id
             </span>
           </div>
           {pasalCount && (
             <span style={{ fontSize: "16px", color: "#68625E", fontFamily: "Instrument Sans" }}>
               {pasalCount} Pasal
             </span>
           )}
         </div>
       </div>
     );
   }

   // --- Route handler ---

   export async function GET(request: NextRequest) {
     const { searchParams } = request.nextUrl;

     const title = searchParams.get("title") || "Cari Hukum Indonesia";
     const type = searchParams.get("type") || "";
     const number = searchParams.get("number") || "";
     const year = searchParams.get("year") || "";
     const status = searchParams.get("status") || "";
     const pasalCount = searchParams.get("pasalCount") || "";
     const snippet = searchParams.get("snippet") || "";
     const page = searchParams.get("page") || "default";

     // Load fonts — Satori needs raw ArrayBuffer data, not CSS
     const instrumentSerifData = await fetch(
       new URL("./fonts/InstrumentSerif-Regular.ttf", import.meta.url)
     ).then((res) => res.arrayBuffer());

     const instrumentSansData = await fetch(
       new URL("./fonts/InstrumentSans-Regular.ttf", import.meta.url)
     ).then((res) => res.arrayBuffer());

     const fonts = [
       { name: "Instrument Serif", data: instrumentSerifData, weight: 400 as const },
       { name: "Instrument Sans", data: instrumentSansData, weight: 400 as const },
     ];

     if (page === "law") {
       return new ImageResponse(
         lawTemplate({ title, type, number, year, status, pasalCount, snippet }),
         { width: 1200, height: 630, fonts }
       );
     }

     return new ImageResponse(
       defaultTemplate({ title }),
       { width: 1200, height: 630, fonts }
     );
   }
   ```

4. **Test locally:**
   ```bash
   npm run dev
   # Open in browser:
   # http://localhost:3000/api/og
   # http://localhost:3000/api/og?page=law&title=Ketenagakerjaan&type=UU&number=13&year=2003&status=berlaku&pasalCount=193
   ```
   You should see PNG images render in the browser. Right-click → "Save Image As" to check file size.

**IMPORTANT Satori gotchas you'll hit:**
- Only `display: "flex"` works. NO `grid`, NO `position: absolute`.
- ALL styles must be inline `style={{ }}` objects. No Tailwind classes.
- Every `<div>` that contains text or children needs `display: "flex"` explicitly.
- Colors must be hex strings, not CSS variables.
- If text overflows, it won't wrap automatically — set `overflow: "hidden"` on the container.

**DONE WHEN:**
- [x] `@vercel/og` is in `apps/web/package.json` dependencies
- [x] Font `.ttf` files exist in `src/app/api/og/fonts/`
- [x] `GET /api/og` returns a PNG with stone background, § mark, and "Cari Hukum Indonesia"
- [x] `GET /api/og?page=law&title=Ketenagakerjaan&type=UU&number=13&year=2003&status=berlaku&pasalCount=193` returns a PNG with dark background, verdigris type badge, green status badge
- [x] Save both images locally — each must be under 300KB (if over, reduce font sizes or padding)
- [x] `npm run build` succeeds
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑
- [ ] Run `/web-design-guidelines` skill, verify against `BRAND_GUIDELINES.md`. ☑
- [ ] Run `/frontend-design` skill. ☑
- [ ] **Notify founder for visual review (M3).**

---

### Task 1.2 — Wire dynamic OG images into page metadata

**WHY:** Each page needs to reference the correct dynamic OG image URL in its `<meta>` tags so social platforms fetch the right image.

**WHAT EXISTS NOW:**
- `apps/web/src/app/layout.tsx` → has `openGraph.images: [{ url: "/og-image.png" }]` (static)
- `apps/web/src/app/peraturan/[type]/[slug]/page.tsx` → has `generateMetadata` but NO `openGraph.images`
- `apps/web/src/app/topik/[slug]/page.tsx` → has `generateMetadata` with basic OG, no image
- `apps/web/src/app/api/page.tsx` → has static metadata, no OG image

**ACTIONS:**

1. **Update `apps/web/src/app/layout.tsx`** — find the `openGraph` block and change the static image. Replace:
   ```tsx
   url: "/og-image.png",
   ```
   with:
   ```tsx
   url: "/api/og",
   ```
   Also update the `twitter` block in the same file:
   ```tsx
   twitter: {
     card: "summary_large_image",
     title: "Pasal.id — Cari Hukum Indonesia",
     description: "Platform hukum Indonesia terbuka pertama berbasis AI.",
     images: ["/api/og"],
   },
   ```

2. **Update `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`** — in the `generateMetadata` function, after the existing `const title = ...` and `const description = ...` lines, add:
   ```tsx
   const ogParams = new URLSearchParams({
     page: "law",
     title: work.title_id,
     type: type.toUpperCase(),
     number: work.number,
     year: String(work.year),
     status: work.status,
   });
   const ogImageUrl = `/api/og?${ogParams.toString()}`;
   ```
   Then add to the returned metadata object (alongside existing `title`, `description`, `keywords`, `alternates`):
   ```tsx
   openGraph: {
     title,
     description,
     url,
     type: "article",
     images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
   },
   twitter: {
     card: "summary_large_image",
     title,
     description,
     images: [ogImageUrl],
   },
   other: {
     "twitter:label1": "Status",
     "twitter:data1": STATUS_LABELS[work.status] || work.status,
     "twitter:label2": "Jenis",
     "twitter:data2": typeLabel,
   },
   ```

3. **Update `apps/web/src/app/topik/[slug]/page.tsx`** — in its `generateMetadata`, add an OG image:
   ```tsx
   openGraph: {
     title: `${topic.title} — Panduan Hukum | Pasal.id`,
     description: topic.description,
     images: [{ url: `/api/og?title=${encodeURIComponent(topic.title)}`, width: 1200, height: 630 }],
   },
   ```

4. **Update `apps/web/src/app/api/page.tsx`** — add to its static `metadata.openGraph`:
   ```tsx
   images: [{ url: "/api/og?title=API+Dokumentasi", width: 1200, height: 630 }],
   ```

5. **Verify by viewing page source:**
   ```bash
   npm run dev
   curl -s http://localhost:3000/ | grep 'og:image'
   curl -s http://localhost:3000/peraturan/uu/uu-nomor-13-tahun-2003 | grep 'og:image'
   ```

**DONE WHEN:**
- [x] `curl ... | grep 'og:image'` shows `/api/og` for the landing page
- [x] `curl ... | grep 'og:image'` shows `page=law&title=...` for a law detail page
- [x] Topic pages and `/api` page have dynamic OG images
- [x] All pages have `<meta name="twitter:card" content="summary_large_image">`
- [x] Law detail pages have `twitter:label1` / `twitter:data1` meta tags
- [x] `npm run build` succeeds
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑

---

## Phase 2: Share Buttons [~2-3 hours]

Every law page needs frictionless sharing. Priority: WhatsApp > Web Share API > Copy Link > Telegram > Twitter.

---

### Task 2.1 — Create the `ShareButton` component

**WHY:** A reusable share button that handles all share targets. Indonesia = WhatsApp first.

**WHAT EXISTS NOW:**
- `apps/web/src/components/CopyButton.tsx` — copies text to clipboard with feedback. Reference its pattern.
- No share functionality exists anywhere.
- shadcn `DropdownMenu` should already be installed (check `components/ui/dropdown-menu.tsx`). If not: `npx shadcn@latest add dropdown-menu`

**ACTIONS:**

1. Create `apps/web/src/components/ShareButton.tsx`:

   ```tsx
   "use client";

   import { useState } from "react";
   import { Share2, Link, MessageCircle, Send, Check } from "lucide-react";
   import {
     DropdownMenu,
     DropdownMenuContent,
     DropdownMenuItem,
     DropdownMenuTrigger,
   } from "@/components/ui/dropdown-menu";
   import { Button } from "@/components/ui/button";

   interface ShareButtonProps {
     url: string;
     title: string;
     description?: string;
     className?: string;
   }

   export default function ShareButton({ url, title, description, className }: ShareButtonProps) {
     const [copied, setCopied] = useState(false);

     // Pre-filled Indonesian share text.
     // URL MUST be on its own line so WhatsApp generates a link preview.
     const shareText = `${title}\n\n${url}`;

     const handleNativeShare = async () => {
       if (typeof navigator !== "undefined" && navigator.share) {
         try {
           await navigator.share({ title, text: description || title, url });
         } catch {
           // User cancelled — not an error
         }
       }
     };

     const handleCopyLink = async () => {
       await navigator.clipboard.writeText(url);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     };

     const openWhatsApp = () => {
       // Use wa.me (universal link), NOT api.whatsapp.com
       window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
     };

     const openTelegram = () => {
       window.open(
         `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
         "_blank"
       );
     };

     const openTwitter = () => {
       window.open(
         `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
         "_blank"
       );
     };

     // Mobile: native share sheet (shows WhatsApp, Telegram, etc. automatically)
     // Desktop: dropdown with explicit options
     const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

     if (canNativeShare) {
       return (
         <Button variant="ghost" size="sm" onClick={handleNativeShare} className={className}>
           <Share2 size={16} className="mr-1.5" />
           Bagikan
         </Button>
       );
     }

     return (
       <DropdownMenu>
         <DropdownMenuTrigger asChild>
           <Button variant="ghost" size="sm" className={className}>
             <Share2 size={16} className="mr-1.5" />
             Bagikan
           </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
           <DropdownMenuItem onClick={openWhatsApp}>
             <MessageCircle size={16} className="mr-2" />
             WhatsApp
           </DropdownMenuItem>
           <DropdownMenuItem onClick={openTelegram}>
             <Send size={16} className="mr-2" />
             Telegram
           </DropdownMenuItem>
           <DropdownMenuItem onClick={openTwitter}>
             <Share2 size={16} className="mr-2" />
             Twitter / X
           </DropdownMenuItem>
           <DropdownMenuItem onClick={handleCopyLink}>
             {copied ? <Check size={16} className="mr-2" /> : <Link size={16} className="mr-2" />}
             {copied ? "Link disalin!" : "Salin Link"}
           </DropdownMenuItem>
         </DropdownMenuContent>
       </DropdownMenu>
     );
   }
   ```

2. **Test the component.** Import it temporarily in any page to verify it renders correctly.

**DONE WHEN:**
- [x] `ShareButton.tsx` exists at `apps/web/src/components/ShareButton.tsx`
- [x] It's a `"use client"` component
- [x] Desktop: "Bagikan" button opens dropdown with 4 options
- [x] WhatsApp opens `https://wa.me/?text=...` with title + URL on separate lines
- [x] "Salin Link" copies to clipboard, shows "Link disalin!" with checkmark for 2 seconds
- [x] All UI text is Indonesian
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑
- [ ] Run `/web-design-guidelines` skill, verify against `BRAND_GUIDELINES.md`. ☑
- [ ] Run `/frontend-design` skill. ☑

---

### Task 2.2 — Add ShareButton to law detail pages

**WHY:** The law detail page is the #1 page type that gets shared.

**WHAT EXISTS NOW in `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`:**
- A header area with `<Badge>` components for type and status
- The variable `pageUrl` already defined as `const pageUrl = \`https://pasal.id/peraturan/${type.toLowerCase()}/${slug}\`;`
- `PasalBlock` component renders each article with a `CopyButton`
- A right `<aside className="hidden lg:block space-y-6">`

**ACTIONS:**

1. **Add import at top of file:**
   ```tsx
   import ShareButton from "@/components/ShareButton";
   ```

2. **Add ShareButton to header.** Find the `<div>` containing `<Badge variant="secondary">{type.toUpperCase()}</Badge>` and the status badge. Add a `ml-auto` wrapped ShareButton in the same flex row:
   ```tsx
   <div className="flex items-center gap-2 mb-2">
     <Badge variant="secondary">{type.toUpperCase()}</Badge>
     <Badge className={STATUS_COLORS[work.status] || ""} variant="outline">
       {STATUS_LABELS[work.status] || work.status}
     </Badge>
     {/* ...existing badges... */}
     <div className="ml-auto">
       <ShareButton
         url={pageUrl}
         title={`${type.toUpperCase()} ${work.number}/${work.year} — ${work.title_id}`}
         description={`Baca teks lengkap ${typeLabel} Nomor ${work.number} Tahun ${work.year}.`}
       />
     </div>
   </div>
   ```

3. **Add ShareButton to right sidebar.** Find the `<aside className="hidden lg:block space-y-6">`. Add a new card:
   ```tsx
   <div className="rounded-lg border p-4">
     <h3 className="font-heading text-sm mb-3">Bagikan</h3>
     <ShareButton
       url={pageUrl}
       title={`${type.toUpperCase()} ${work.number}/${work.year} — ${work.title_id}`}
     />
   </div>
   ```

4. **Add per-pasal link copy.** The `PasalBlock` component needs `pageUrl`. Currently it receives `frbrUri` and `lawTitle` but NOT `pageUrl`. Update the component:
   - Add `pageUrl: string` to the PasalBlock props interface
   - Pass `pageUrl={pageUrl}` where `<PasalBlock>` is rendered
   - Inside PasalBlock, add a link copy button next to the existing JSON CopyButton:
     ```tsx
     <CopyButton text={`${pageUrl}#pasal-${pasal.number}`} label="Link" />
     ```

**DONE WHEN:**
- [x] Law page header has a "Bagikan" button aligned right
- [x] Right sidebar has a "Bagikan" card
- [x] Each PasalBlock has a "Link" copy button
- [x] Clicking "Link" copies `https://pasal.id/peraturan/...#pasal-{number}`
- [x] `npm run build` succeeds
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑
- [ ] Run `/web-design-guidelines` skill, verify against `BRAND_GUIDELINES.md`. ☑
- [ ] Run `/frontend-design` skill. ☑

---

### Task 2.3 — Add ShareButton to topic and connect pages

**WHY:** Consistency across all shareable pages.

**ACTIONS:**

1. **Topic pages** — edit `apps/web/src/app/topik/[slug]/page.tsx`. Find the `<h1>` and `<p>` description block. Add after the description:
   ```tsx
   import ShareButton from "@/components/ShareButton";
   // ...inside the component:
   <div className="mt-4">
     <ShareButton
       url={`https://pasal.id/topik/${slug}`}
       title={`${topic.title} — Panduan Hukum Indonesia`}
       description={topic.description}
     />
   </div>
   ```

2. **Connect page** — edit `apps/web/src/app/connect/page.tsx`. Add near the MCP install command:
   ```tsx
   <ShareButton
     url="https://pasal.id/connect"
     title="Hubungkan Claude ke database hukum Indonesia 🇮🇩"
   />
   ```

**DONE WHEN:**
- [x] Topic pages have a share button below the description
- [x] Connect page has a share button
- [x] `npm run build` succeeds
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑

---

## Phase 3: Deep Linking & Citation [~2 hours]

---

### Task 3.1 — Add section IDs and copy-link to BAB headings

**WHY:** Only pasal elements have IDs. BAB headings don't, so they can't be deep-linked. Lawyers reference "BAB V UU Ketenagakerjaan" all the time.

**WHAT EXISTS NOW in `apps/web/src/app/peraturan/[type]/[slug]/page.tsx`:**
- `babNodes` variable contains BAB-type document nodes
- `pasalNodes` are rendered inside `PasalBlock` with `id={`pasal-${pasal.number}`}` and `scroll-mt-20`
- Search for where `babNodes` is used in the JSX to find the rendering location

**ACTIONS:**

1. **Add IDs to BAB sections.** Where BAB nodes are rendered, wrap in a section:
   ```tsx
   <section id={`bab-${bab.number}`} className="scroll-mt-20 mb-12">
     <h2 className="font-heading text-xl mb-1">BAB {bab.number}</h2>
     {bab.heading && <p className="text-sm text-muted-foreground mb-6">{bab.heading}</p>}
   </section>
   ```

2. **Add hover-to-reveal 🔗 icon** on BAB headings:
   ```tsx
   import { Link as LinkIcon } from "lucide-react";
   // ...
   <div className="group flex items-center gap-2">
     <h2 className="font-heading text-xl">BAB {bab.number}</h2>
     <button
       onClick={() => navigator.clipboard.writeText(`${pageUrl}#bab-${bab.number}`)}
       className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
       title="Salin link"
     >
       <LinkIcon size={14} />
     </button>
   </div>
   ```

3. **Update `apps/web/src/components/TableOfContents.tsx`** — use anchor links:
   ```tsx
   <a href={`#bab-${bab.number}`}>BAB {bab.number}</a>
   <a href={`#pasal-${pasal.number}`}>Pasal {pasal.number}</a>
   ```

4. **Add smooth scrolling** — in `apps/web/src/app/globals.css`, check if `html { scroll-behavior: smooth; }` exists. If not, add it.

**DONE WHEN:**
- [x] BAB sections have `id="bab-{number}"` attributes
- [x] Hovering a BAB heading reveals a link icon
- [x] Clicking the icon copies the URL with `#bab-{number}` anchor
- [x] TOC links scroll to the correct section
- [x] Direct navigation to `...#bab-I` scrolls correctly
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑
- [ ] Run `/web-design-guidelines` skill, verify against `BRAND_GUIDELINES.md`. ☑
- [ ] Run `/frontend-design` skill. ☑

---

### Task 3.2 — Citation copy button ("Kutip")

**WHY:** One-click citation copy for legal professionals. Every citation in a document is a permanent reference to pasal.id.

**ACTIONS:**

1. Check that shadcn `Popover` is installed: `ls apps/web/src/components/ui/popover.tsx`. If missing: `npx shadcn@latest add popover`

2. Create `apps/web/src/components/CitationButton.tsx`:

   ```tsx
   "use client";

   import { useState } from "react";
   import { Quote, Check } from "lucide-react";
   import { Button } from "@/components/ui/button";
   import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

   // Formal Indonesian legal names for citations
   const TYPE_FORMAL: Record<string, string> = {
     UU: "Undang-Undang",
     PP: "Peraturan Pemerintah",
     PERPRES: "Peraturan Presiden",
   };

   interface CitationButtonProps {
     type: string;
     number: string;
     year: number;
     title: string;
     pasal?: string;
     url: string;
   }

   export default function CitationButton({ type, number, year, title, pasal, url }: CitationButtonProps) {
     const [copied, setCopied] = useState(false);
     const formalType = TYPE_FORMAL[type.toUpperCase()] || type;

     const citation = pasal
       ? `Pasal ${pasal} ${formalType} Nomor ${number} Tahun ${year} tentang ${title}\nTersedia di: ${url}`
       : `${formalType} Nomor ${number} Tahun ${year} tentang ${title}\nTersedia di: ${url}`;

     const handleCopy = async () => {
       await navigator.clipboard.writeText(citation);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     };

     return (
       <Popover>
         <PopoverTrigger asChild>
           <Button variant="ghost" size="sm">
             <Quote size={16} className="mr-1.5" />
             Kutip
           </Button>
         </PopoverTrigger>
         <PopoverContent className="w-80" align="end">
           <div className="space-y-3">
             <h4 className="font-heading text-sm">Kutipan</h4>
             <pre className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap font-sans leading-relaxed">
               {citation}
             </pre>
             <Button size="sm" onClick={handleCopy} className="w-full">
               {copied ? <Check size={16} className="mr-1.5" /> : <Quote size={16} className="mr-1.5" />}
               {copied ? "Disalin!" : "Salin Kutipan"}
             </Button>
           </div>
         </PopoverContent>
       </Popover>
     );
   }
   ```

3. **Add to law page header.** In the law detail page, next to the ShareButton:
   ```tsx
   import CitationButton from "@/components/CitationButton";
   // ...
   <div className="ml-auto flex items-center gap-1">
     <CitationButton type={type} number={work.number} year={work.year} title={work.title_id} url={pageUrl} />
     <ShareButton url={pageUrl} title={...} />
   </div>
   ```

4. **Optionally add to PasalBlock** for per-pasal citations. This requires passing `type`, `number`, `year` props down to PasalBlock — only do this if the prop threading isn't too messy. If it is, skip per-pasal citations for now and only keep the law-level citation.

**DONE WHEN:**
- [x] `CitationButton` component exists and renders
- [x] Clicking "Kutip" shows the formal citation: `Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan`
- [x] Citation includes the pasal.id URL
- [x] "Salin Kutipan" copies to clipboard with feedback
- [x] Popover uses white bg, border, no heavy shadow
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑
- [ ] Run `/web-design-guidelines` skill, verify against `BRAND_GUIDELINES.md`. ☑
- [ ] Run `/frontend-design` skill. ☑

---

## Phase 4: Structured Data & SEO [~1.5 hours]

---

### Task 4.1 — Enhance JSON-LD structured data

**WHY:** Existing law pages have Legislation + BreadcrumbList JSON-LD (good). But they're missing fields, and other pages have none.

**WHAT EXISTS NOW in `peraturan/[type]/[slug]/page.tsx`:**
- `legislationLd` object with `name`, `legislationIdentifier`, `legislationType`, `legislationDate`, `legislationLegalForce`, `inLanguage`, `url`
- `breadcrumbLd` object ✅
- `<JsonLd>` component renders `<script type="application/ld+json">` ✅

**ACTIONS:**

1. **Enhance `legislationLd`** — add two new fields to the existing object:
   ```tsx
   legislationLegalValue: "UnofficialLegalValue",
   legislationJurisdiction: {
     "@type": "AdministrativeArea",
     name: "Indonesia",
   },
   ```

2. **Add `WebSite` JSON-LD to landing page** (`apps/web/src/app/page.tsx`):
   ```tsx
   import JsonLd from "@/components/JsonLd";
   // Inside the return, add:
   <JsonLd data={{
     "@context": "https://schema.org",
     "@type": "WebSite",
     name: "Pasal.id",
     url: "https://pasal.id",
     potentialAction: {
       "@type": "SearchAction",
       target: "https://pasal.id/search?q={search_term_string}",
       "query-input": "required name=search_term_string",
     },
   }} />
   ```

3. **Add `BreadcrumbList` to topic pages** (`apps/web/src/app/topik/[slug]/page.tsx`):
   ```tsx
   <JsonLd data={{
     "@context": "https://schema.org",
     "@type": "BreadcrumbList",
     itemListElement: [
       { "@type": "ListItem", position: 1, name: "Beranda", item: "https://pasal.id" },
       { "@type": "ListItem", position: 2, name: "Topik", item: "https://pasal.id/topik" },
       { "@type": "ListItem", position: 3, name: topic.title },
     ],
   }} />
   ```

4. **Validate:** View page source → copy JSON-LD → paste in https://validator.schema.org/

**DONE WHEN:**
- [x] Law `Legislation` JSON-LD has `legislationLegalValue` and `legislationJurisdiction`
- [x] Landing page has `WebSite` JSON-LD with `SearchAction`
- [x] Topic pages have `BreadcrumbList` JSON-LD
- [ ] All validate at validator.schema.org
- [x] `npm run build` succeeds
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑

---

### Task 4.2 — Create `robots.ts` and verify sitemap

**ACTIONS:**

1. Check: `ls apps/web/src/app/robots.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"`

2. If missing, create `apps/web/src/app/robots.ts`:
   ```tsx
   import type { MetadataRoute } from "next";

   export default function robots(): MetadataRoute.Robots {
     return {
       rules: [{ userAgent: "*", allow: "/", disallow: ["/api/og"] }],
       sitemap: "https://pasal.id/sitemap.xml",
     };
   }
   ```

3. Verify: `npm run build` then check `/robots.txt` and `/sitemap.xml` responses.

**DONE WHEN:**
- [x] `robots.ts` exists
- [x] `/robots.txt` contains `Sitemap:` line
- [x] `/api/og` is disallowed
- [x] `/sitemap.xml` contains law page URLs
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑

---

## Phase 5: Print & Export [~1 hour]

---

### Task 5.1 — Add print-friendly CSS and "Cetak" button

**ACTIONS:**

1. **Add `@media print` rules** to bottom of `apps/web/src/app/globals.css`:
   ```css
   @media print {
     header, footer, nav, aside,
     .no-print, [data-no-print] {
       display: none !important;
     }

     body {
       background: white !important;
       color: black !important;
       font-size: 12pt !important;
     }

     main {
       max-width: 100% !important;
       padding: 0 !important;
       margin: 0 !important;
     }

     article[id^="pasal-"] {
       break-inside: avoid;
     }

     section[id^="bab-"] > h2,
     section[id^="bab-"] > div:first-child {
       break-after: avoid;
     }
   }
   ```

2. **Add `no-print` class** to ShareButton, CitationButton, and CopyButton wrappers in the law page.

3. **Add "Cetak" button** in the right sidebar:
   ```tsx
   import { Printer } from "lucide-react";
   // In the <aside>:
   <div className="rounded-lg border p-4 no-print">
     <button
       onClick={() => window.print()}
       className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
     >
       <Printer size={16} />
       Cetak halaman ini
     </button>
   </div>
   ```

4. **Test:** Ctrl+P on a law page → should show clean content only.

**DONE WHEN:**
- [x] Ctrl+P shows clean print preview (no header, sidebar, buttons)
- [x] White background, black text
- [x] Pasal blocks don't break across pages
- [x] "Cetak" button exists in sidebar and is hidden in print
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑
- [ ] Run `/web-design-guidelines` skill, verify against `BRAND_GUIDELINES.md`. ☑
- [ ] Run `/frontend-design` skill. ☑

---

## Phase 6: MCP Discoverability [~30 min]

---

### Task 6.1 — Create `server.json` manifest and README badges

> **Note:** Actual registration on directories is founder task M5. This task only creates the files.

**ACTIONS:**

1. Create `server.json` in the project root:
   ```json
   {
     "name": "pasal-id",
     "display_name": "Pasal.id — Indonesian Law",
     "description": "Search and access Indonesian legislation with structured data and real citations.",
     "version": "1.0.0",
     "transport": "http",
     "url": "https://pasal-mcp-server-production.up.railway.app/mcp/",
     "tools": [
       { "name": "search_laws", "description": "Full-text search across Indonesian legislation" },
       { "name": "get_pasal", "description": "Retrieve a specific article from a specific law" },
       { "name": "get_law_detail", "description": "Get full metadata and structure of a law" },
       { "name": "list_laws", "description": "List available regulations with filters" }
     ],
     "categories": ["legal", "government", "indonesia", "reference"],
     "homepage": "https://pasal.id",
     "repository": "https://github.com/ilhamfp/pasal",
     "license": "AGPL-3.0"
   }
   ```

2. Add badges to the top of `README.md`:
   ```markdown
   [![Legal Data by Pasal.id](https://img.shields.io/badge/Legal_Data-Pasal.id-2B6150?style=flat)](https://pasal.id)
   [![MCP Server](https://img.shields.io/badge/MCP-Server-blue?style=flat)](https://pasal.id/connect)
   [![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-green?style=flat)](LICENSE)
   ```

**DONE WHEN:**
- [ ] `server.json` exists and is valid JSON
- [ ] README badges render on GitHub
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑

---

## Phase 7: Final Optimizations [~30 min]

---

### Task 7.1 — Truncate og:title and og:description for WhatsApp

**WHY:** WhatsApp truncates `og:title` at ~60 chars on mobile. Long titles look broken.

**ACTIONS:**

1. In `apps/web/src/app/peraturan/[type]/[slug]/page.tsx` `generateMetadata`, add truncation:
   ```tsx
   const ogTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
   const ogDescription = description.length > 155 ? description.slice(0, 152) + "..." : description;
   ```
   Use `ogTitle`/`ogDescription` in the `openGraph` and `twitter` blocks. Keep the full `title` for the page `<title>` tag.

2. Verify `og:locale` is `id_ID` in `layout.tsx` (should already exist).

3. **Spot-check:** `curl -s localhost:3000/peraturan/uu/uu-nomor-13-tahun-2003 | grep 'og:title'` — count characters, must be ≤ 60.

**DONE WHEN:**
- [ ] No `og:title` exceeds 60 characters on law pages
- [ ] No `og:description` exceeds 155 characters on law pages
- [ ] Page `<title>` still shows full title (truncation is OG-only)
- [ ] `og:locale` is `id_ID`
- [ ] Run `code-simplifier` skill. ☑
- [ ] Run `code-review` skill. ☑

---

## Summary Checklist

### Manual Tasks (Founder)
| Task | Description | Status |
|------|-------------|--------|
| M1 | Download font .ttf files for OG generation | ☐ |
| M2 | Create @pasalid Twitter account | ☐ |
| M3 | Review & approve OG image designs | ☐ |
| M4 | Test OG previews on real WhatsApp/Telegram | ☐ |
| M5 | Register MCP server on 6 directories | ☐ |

### Development Tasks (Junior Dev)
| Phase | Task | Status |
|-------|------|--------|
| 1 | Install @vercel/og + create OG route with templates | ☑ |
| 1 | Wire dynamic OG into all page metadata | ☑ |
| 2 | Create ShareButton component | ☑ |
| 2 | Add ShareButton to law detail pages | ☑ |
| 2 | Add ShareButton to topic + connect pages | ☑ |
| 3 | Section IDs + copy-link on BAB headings | ☑ |
| 3 | Citation copy button ("Kutip") | ☑ |
| 4 | Enhance JSON-LD structured data | ☑ |
| 4 | Create robots.ts + verify sitemap | ☑ |
| 5 | Print CSS + "Cetak" button | ☑ |
| 6 | Create server.json + README badges | ☑ |
| 7 | Truncate og:title/description for WhatsApp | ☑ |

**Estimated dev time: 10-12 hours**

---

## Appendix: Brand Quick Reference

| Element | Value |
|---------|-------|
| Primary accent | `#2B6150` (verdigris) |
| Ink (text) | `#1D1A18` |
| Stone (background) | `#F8F5F0` |
| Card background | `#FFFFFF` |
| Muted text | `#958D88` |
| Body text | `#524C48` |
| Borders | `#DDD6D1` |
| Heading font | Instrument Serif, weight 400 only |
| Body font | Instrument Sans, weight 400-700 |
| Mono font | JetBrains Mono |
| Border radius | `rounded-lg` (8px) |
| Shadows | None (use borders). Only `shadow-sm` on popovers. |
| Status: Berlaku | Green `#2E7D52` on `#E8F5EC` |
| Status: Diubah | Amber `#C47F17` on `#FFF6E5` |
| Status: Dicabut | Red `#C53030` on `#FDF2F2` |

**DO NOT:** Add second accent colors, use cool grays, use bold Instrument Serif, use heavy shadows, make the interface colorful.