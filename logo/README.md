# Pasal.id Logo — The Seal (S3 Heavy Ring)

## Design

A heavy circular ring containing a section symbol (§). The ring carries the authority (8px stroke), the glyph provides the detail (4.5px stroke). Reads as an official legal seal/stamp.

## Geometry (200×200 viewBox)

```
Ring:        cx=100 cy=100 r=72 stroke-width=8
§ stem:      line (100,56) → (100,144) stroke-width=4.5
§ upper:     M100,72 C112,66 126,74 126,84 C126,94 112,100 100,96
§ lower:     M100,96 C88,92 74,98 74,108 C74,118 88,126 100,120
All strokes: linecap=round
```

Both § curves meet at (100,96) — continuous S-flow, no gap.

## Color Rules

| Context         | Color                | Note                              |
|-----------------|----------------------|-----------------------------------|
| On light bg     | `#1D1A18` (ink)      | Primary usage                     |
| On dark bg      | `#F8F5F0` (stone)    | Or pure white                     |
| Mono            | Pure black or white  | For print, single-color contexts  |
| **Never**       | `#2B6150` (verdigris)| Logo stays neutral — no accent    |

## Source Files

| File                   | Purpose                                    |
|------------------------|--------------------------------------------|
| `icon-primary.svg`     | Ink mark, transparent bg — light surfaces  |
| `icon-dark-bg.svg`     | Stone mark, transparent bg — dark surfaces |
| `icon-mono-black.svg`  | Pure black, transparent bg                 |
| `icon-mono-white.svg`  | Pure white, transparent bg                 |
| `mark-standalone.svg`  | § only (no ring) — watermarks, inline use  |
| `lockup-primary.svg`   | Icon + "Pasal.id" wordmark — light bg      |
| `lockup-dark-bg.svg`   | Icon + "Pasal.id" wordmark — dark bg       |
| `favicon.svg`          | 32×32 optimized, stone bg, rounded corners |
| `safari-pinned-tab.svg`| Single-color black for Safari pinned tabs  |
| `og-image-source.svg`  | 1200×630 source for social sharing image   |

## Generated Files (via `scripts/generate-favicons.py`)

After running the generation script, these files go into `apps/web/public/`:

```
favicon.ico            — Multi-size ICO (16, 32, 48)
favicon-16x16.png      — 16×16 PNG
favicon-32x32.png      — 32×32 PNG
apple-touch-icon.png   — 180×180 PNG (with padding + stone bg)
android-chrome-192.png — 192×192 PNG (with stone bg)
android-chrome-512.png — 512×512 PNG (with stone bg)
mstile-150x150.png     — 150×150 PNG (Windows tiles)
og-image.png           — 1200×630 PNG (social sharing)
safari-pinned-tab.svg  — Copied as-is
favicon.svg            — Copied as-is (modern browsers)
```

## Wordmark

Font: Instrument Serif 400 (weight 400 only — hierarchy through size, not boldness)
"Pasal" in `#1D1A18` (ink) + ".id" in `#958D88` (muted)
Letter-spacing: -0.01em

```html
<span class="font-heading tracking-tight">Pasal<span class="text-muted-foreground">.id</span></span>
```

## Minimum Size

The logo mark should not be rendered smaller than 16×16px.
At sizes below 24px, use `favicon.svg` (optimized stroke weights).
