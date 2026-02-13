# Prompt: Generate Pasal.id Favicons & Integrate Logo

## Context

You are working on the Pasal.id monorepo (`ilhamfp/pasal`). The logo source SVGs are in `logo/`. The web app is a Next.js 16+ App Router project at `apps/web/`. You need to:

1. Write a Python script that converts the source SVGs into every favicon/icon format a modern web app needs
2. Place the generated files in `apps/web/public/`
3. Wire up the HTML meta tags in the Next.js layout
4. Create the web app manifest

## Logo Source Files

All source SVGs are in `logo/`. Read `logo/README.md` for full documentation. Key files:

- `icon-primary.svg` — Ink (#1D1A18) mark on transparent background, 200×200 viewBox. This is the master source for all icon generation.
- `icon-dark-bg.svg` — Stone (#F8F5F0) mark on transparent, for dark contexts.
- `favicon.svg` — Pre-optimized 32×32 viewBox with stone background and rounded corners. Copy directly to `public/`.
- `safari-pinned-tab.svg` — Single-color black. Copy directly to `public/`.
- `og-image-source.svg` — 1200×630 with logo centered on stone background, wordmark below. Source for the OG image PNG.

Brand colors for reference:
- Ink: `#1D1A18`
- Stone (warm background): `#F8F5F0`
- Muted: `#958D88`

## Task 1: Python Favicon Generation Script

Create `scripts/generate-favicons.py` at the repo root. This script reads from `logo/` and writes to `apps/web/public/`.

### Why each format exists (first principles)

Browsers and operating systems each have their own icon discovery mechanism. You can't just provide one PNG — here's why each file is needed:

| File | Size | Why it exists |
|------|------|---------------|
| `favicon.ico` | 16+32+48 multi | Legacy format. Every browser since IE6 looks for `/favicon.ico`. Must be multi-resolution ICO containing 16×16, 32×32, and 48×48 PNGs. The browser picks the best size. |
| `favicon.svg` | vector | Modern browsers (Chrome 80+, Firefox 41+, Safari 16+) prefer SVG favicons — they scale perfectly to any tab size, including high-DPI. Declared via `<link rel="icon" type="image/svg+xml">`. |
| `favicon-16x16.png` | 16×16 | Fallback PNG for browsers that don't support SVG favicons but do support `<link rel="icon">` with PNG. 16px is the standard browser tab size. |
| `favicon-32x32.png` | 32×32 | 2× retina version of the 16px favicon. High-DPI displays pick this up. Also used in browser bookmarks. |
| `apple-touch-icon.png` | 180×180 | iOS requires this exact file when users "Add to Home Screen." iOS does NOT read favicon.ico or SVG. It looks for `<link rel="apple-touch-icon">` pointing to a 180×180 PNG. Must have OPAQUE background (iOS does not handle transparency — it renders black behind transparent PNGs). Add ~20% padding around the mark. |
| `android-chrome-192.png` | 192×192 | Android Chrome reads this from `site.webmanifest` for the home screen icon. Must have opaque background for the same transparency reason. |
| `android-chrome-512.png` | 512×512 | Android uses this for the splash screen when launching a PWA. Also used in the Chrome "Install App" prompt. Same opaque background rule. |
| `mstile-150x150.png` | 150×150 | Windows uses this for Start Menu tiles and Edge browser. Declared via `<meta name="msapplication-TileImage">`. Opaque background. |
| `og-image.png` | 1200×630 | Social sharing preview (Twitter/X, LinkedIn, Facebook, Slack, Discord). This is the image shown when someone pastes a Pasal.id URL. 1200×630 is the standard OG ratio. |
| `safari-pinned-tab.svg` | vector | Safari's pinned tabs render SVGs as a single silhouette color. Must be all-black SVG with no fill colors — Safari colorizes it using `<link color="...">`. |

### Implementation requirements

```
pip install cairosvg Pillow
```

**cairosvg** renders SVG to PNG at arbitrary resolution using Cairo (the same renderer Firefox uses). This produces crisp rasterization of the stroked paths.

**Pillow** handles PNG resizing, compositing (mark onto background), and ICO multi-resolution packing.

### Generation logic (pseudocode)

```python
# 1. Render icon-primary.svg → high-res PNG (1024×1024) as master raster
#    Use cairosvg.svg2png(url=..., output_width=1024, output_height=1024)

# 2. For each target that needs an OPAQUE background:
#    - Create a new 1024×1024 image filled with stone (#F8F5F0)
#    - Calculate padding: for 180px apple-touch-icon, use ~15% padding each side
#      (so the mark occupies ~70% of the canvas)
#    - Paste the mark (with alpha compositing) centered on the stone background
#    - Resize to target dimensions using LANCZOS resampling
#    - Save as PNG

# 3. For favicon PNGs (16, 32):
#    - These CAN be transparent (browser handles the background)
#    - Render favicon.svg at target size for best small-size rendering
#    - Or resize the master 1024px raster with LANCZOS

# 4. For favicon.ico:
#    - Create 16, 32, 48px PNGs (transparent background OK)
#    - Use Pillow's ICO save: img.save('favicon.ico', sizes=[(16,16),(32,32),(48,48)])

# 5. For og-image.png:
#    - Render og-image-source.svg at 1200×630 using cairosvg
#    - Note: the OG SVG contains text in Instrument Serif. If the font is not
#      installed on the system, cairosvg will fall back to a default serif.
#      For perfect rendering, install the font first or accept the fallback
#      (the logo mark renders perfectly regardless since it's all paths).

# 6. Copy favicon.svg and safari-pinned-tab.svg as-is to public/
```

### Padding math for app icons

The mark in `icon-primary.svg` has a viewBox of 200×200 where the ring spans from (28,28) to (172,172) — so the mark already has ~14% built-in padding in the SVG. When compositing onto opaque backgrounds for app icons:

- apple-touch-icon (180×180): Render mark at ~126px (70% of 180) and center it on 180×180 stone background. This gives comfortable visual padding matching Apple's HIG.
- android-chrome-192 (192×192): Render mark at ~134px (70% of 192), center on stone background.
- android-chrome-512 (512×512): Render mark at ~358px (70% of 512), center on stone background.
- mstile-150 (150×150): Render mark at ~105px (70% of 150), center on stone background.

### Script output

The script should print what it generated:

```
✓ favicon.ico (16+32+48)
✓ favicon-16x16.png
✓ favicon-32x32.png
✓ apple-touch-icon.png (180×180)
✓ android-chrome-192.png
✓ android-chrome-512.png
✓ mstile-150x150.png
✓ og-image.png (1200×630)
✓ favicon.svg (copied)
✓ safari-pinned-tab.svg (copied)
```

## Task 2: Web App Manifest

Create `apps/web/public/site.webmanifest`:

```json
{
  "name": "Pasal.id",
  "short_name": "Pasal",
  "description": "Cari hukum Indonesia dengan mudah",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F8F5F0",
  "theme_color": "#1D1A18",
  "icons": [
    {
      "src": "/android-chrome-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Why these manifest values:**
- `background_color: #F8F5F0` — matches the page background (stone). This is the splash screen color shown while the PWA loads. Must match the actual CSS background or there's a jarring flash.
- `theme_color: #1D1A18` — controls the browser toolbar color on Android. Ink matches the near-black nav bar.
- `display: standalone` — hides the browser chrome when installed as PWA.

## Task 3: Next.js Layout Meta Tags

In `apps/web/src/app/layout.tsx`, add the icon metadata. Next.js App Router uses the `metadata` export:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Pasal.id — Cari Hukum Indonesia",
    template: "%s | Pasal.id",
  },
  description: "Cari hukum Indonesia dengan mudah. Akses undang-undang, peraturan, dan pasal secara langsung.",
  metadataBase: new URL("https://pasal.id"),
  icons: {
    // Modern browsers: SVG favicon (scales to any size)
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    // iOS home screen
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    // Safari pinned tab
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#1D1A18", // Safari colorizes the SVG with this
      },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://pasal.id",
    siteName: "Pasal.id",
    title: "Pasal.id — Cari Hukum Indonesia",
    description: "Cari hukum Indonesia dengan mudah. Akses undang-undang, peraturan, dan pasal secara langsung.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pasal.id — Cari hukum Indonesia dengan mudah",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pasal.id — Cari Hukum Indonesia",
    description: "Cari hukum Indonesia dengan mudah",
    images: ["/og-image.png"],
  },
  other: {
    "msapplication-TileColor": "#F8F5F0",
    "msapplication-TileImage": "/mstile-150x150.png",
  },
};
```

**Why this ordering matters:**
- `icon` array is ordered SVG first, then 32px, then 16px. Browsers pick the first format they support. Modern browsers grab the SVG; older ones fall through to PNG.
- `apple` is separate because iOS ignores the `icon` rel entirely — it ONLY reads `apple-touch-icon`.
- `mask-icon` is Safari-specific for pinned tabs. The `color` attribute tells Safari what color to render the single-color SVG in.

## Task 4: Also keep favicon.ico accessible at root

Next.js App Router serves files from `public/` at the root URL automatically. So `apps/web/public/favicon.ico` will be accessible at `https://pasal.id/favicon.ico` — which is important because many browsers and crawlers still request `/favicon.ico` directly without reading any HTML meta tags.

No additional configuration needed — just make sure the file exists in `public/`.

## Verification

After running the script and wiring up the layout:

1. `ls apps/web/public/favicon*` should show `.ico`, `.svg`, `-16x16.png`, `-32x32.png`
2. `ls apps/web/public/apple-touch-icon.png` should exist
3. `ls apps/web/public/android-chrome-*` should show 192 and 512
4. `ls apps/web/public/og-image.png` should exist (1200×630)
5. `ls apps/web/public/site.webmanifest` should exist
6. The `<head>` of the rendered HTML should contain all the icon link tags

## File tree after completion

```
logo/                              ← Source SVGs (committed, never modified by scripts)
  ├── README.md
  ├── icon-primary.svg
  ├── icon-dark-bg.svg
  ├── icon-mono-black.svg
  ├── icon-mono-white.svg
  ├── mark-standalone.svg
  ├── lockup-primary.svg
  ├── lockup-dark-bg.svg
  ├── favicon.svg
  ├── safari-pinned-tab.svg
  └── og-image-source.svg

scripts/
  └── generate-favicons.py           ← The generation script

apps/web/public/                     ← Generated outputs (gitignored or committed — your choice)
  ├── favicon.ico
  ├── favicon.svg
  ├── favicon-16x16.png
  ├── favicon-32x32.png
  ├── apple-touch-icon.png
  ├── android-chrome-192.png
  ├── android-chrome-512.png
  ├── mstile-150x150.png
  ├── og-image.png
  ├── safari-pinned-tab.svg
  └── site.webmanifest
```
