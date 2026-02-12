# BRAND_GUIDELINES.md

> **Purpose:** Single source of truth for Pasal.id's visual identity. Reference this file before writing any frontend code, component, or page. When in doubt about a color, font, spacing, or component style — look here first.

---

## Quick Reference (for fast lookups)

```
PRIMARY COLOR:    oklch(0.450 0.065 170)  →  #2B6150  (verdigris — aged copper patina)
SURFACE:          #F8F5F0 (warm stone)
HEADING FONT:     Instrument Serif (font-heading)
BODY FONT:        Instrument Sans (font-sans)
MONO FONT:        JetBrains Mono (font-mono)
DEFAULT RADIUS:   0.5rem (8px)
BASE SPACING:     4px (0.25rem)
MAX WIDTH:        1280px (80rem)
READER WIDTH:     768px (48rem)
```

---

## 1. Brand Personality

**Five words:** Trustworthy, Accessible, Clear, Modern, Open.

**The feeling:** A stone-walled museum gallery with excellent lighting. Quiet power. The restraint *is* the brand — color is earned, not given. Near-monochrome warm graphite provides the authority. One deliberate accent (verdigris) provides the life. Typography, whitespace, and the quality of the reading experience carry everything.

**Design DNA:** Batu Candi — the weathered volcanic stone of Borobudur and Prambanan. Warm gray with depth, not cold corporate gray. Authority through material honesty and restraint, not decoration.

**What this is NOT:** AI-slop purple gradients. Generic SaaS blue. Cheap fintech teal/mint. Over-decorated government portals. Busy, colorful dashboards. Gold-and-burgundy "luxury" theater.

---

## 2. Color System

### 2.1 Design Rationale

**Near-monochrome with one accent:**

The Batu Candi palette is deliberately restrained. A warm graphite neutral scale handles 95% of the interface — backgrounds, text, borders, cards, navigation. One accent color (verdigris, an aged copper-green patina) handles all interactive elements: buttons, links, focus rings, status accents. Nothing else competes for attention. The content is the design.

**Why this works for a legal platform:**
- Dense legal text needs zero visual competition — warm neutrals stay invisible
- One accent color means links and actions are instantly identifiable
- The warm undertone (hue 40–60° in neutrals) prevents the coldness of pure gray
- Verdigris is culturally resonant (aged metal, patinated temple fixtures) without being literal
- Error/destructive states (cool red) have zero collision with a green accent

**Scale generation:** Both the graphite and verdigris scales use smooth oklch curves with very low chroma. The graphite scale is near-achromatic (chroma 0.005–0.012) with a warm yellow-brown undertone. The verdigris scale peaks at chroma 0.065 — muted and earthy, not mint or emerald.

### 2.2 Primary — "Patina" (Verdigris Accent)

| Token   | Hex       | oklch                        | CR (stone) | Use                                |
|---------|-----------|------------------------------|------------|------------------------------------|
| `50`    | `#EAF7F2` | `oklch(0.965 0.015 170)`    | 1.0:1      | Subtle tinted backgrounds          |
| `100`   | `#D8EEE5` | `oklch(0.930 0.025 170)`    | 1.1:1      | Selected states, hover bg          |
| `200`   | `#BCDDCF` | `oklch(0.870 0.040 168)`    | 1.3:1      | Decorative, light accents          |
| `300`   | `#96C3B1` | `oklch(0.780 0.055 168)`    | 1.8:1      | Dark mode primary, icons           |
| `400`   | `#6B9B88` | `oklch(0.650 0.060 168)`    | 2.9:1      | Large text only, secondary icons   |
| `500`   | `#437865` | `oklch(0.530 0.065 168)`    | 4.7:1 AA   | Links on white surfaces            |
| `600`   | `#2B6150` | `oklch(0.450 0.065 170)`    | 6.6:1 AA   | **★ PRIMARY — buttons, links, UI** |
| `700`   | `#204C3E` | `oklch(0.380 0.055 170)`    | 8.9:1 AAA  | Hover state                        |
| `800`   | `#15382D` | `oklch(0.310 0.045 170)`    | 11.8:1 AAA | Pressed/active state               |
| `900`   | `#0E271F` | `oklch(0.250 0.035 170)`    | 14.5:1 AAA | Deep accent                        |
| `950`   | `#0C1C16` | `oklch(0.210 0.025 170)`    | 16.2:1 AAA | Near-black verdigris               |

**NOTE:** The base primary is at the `600` step (#2B6150). Contrast with white: 7.2:1 (WCAG AA). Contrast with stone (#F8F5F0): 6.6:1 (AA). Use `700` for hover, `800` for pressed.

**Button state mapping:**
- Default: `600` (#2B6150)
- Hover: `700` (#204C3E)
- Pressed: `800` (#15382D) + `scale(0.98)`
- On dark backgrounds: `300` (#96C3B1) text or filled buttons with dark text

### 2.3 Neutrals — "Batu" (Warm Graphite)

Near-achromatic with warm undertone (hue 38–60°). NOT cool slate — these have a subtle yellow-brown warmth that harmonizes with verdigris and prevents clinical coldness.

| Token   | Hex       | oklch                        | Use                            |
|---------|-----------|------------------------------|--------------------------------|
| `50`    | `#F6F3F0` | `oklch(0.965 0.005 60)`     | Alternate background           |
| `100`   | `#EEE8E4` | `oklch(0.935 0.008 60)`     | Card background alt            |
| `200`   | `#DDD6D1` | `oklch(0.880 0.010 60)`     | Borders, dividers              |
| `300`   | `#C4BCB6` | `oklch(0.800 0.012 58)`     | Disabled states                |
| `400`   | `#958D88` | `oklch(0.650 0.012 55)`     | Placeholder text, muted        |
| `500`   | `#68625E` | `oklch(0.500 0.010 50)`     | Secondary text                 |
| `600`   | `#524C48` | `oklch(0.420 0.010 48)`     | Body text                      |
| `700`   | `#3F3936` | `oklch(0.350 0.010 45)`     | Strong body text               |
| `800`   | `#2D2826` | `oklch(0.280 0.008 42)`     | Heading text                   |
| `900`   | `#1D1A18` | `oklch(0.220 0.006 40)`     | Ink — primary text, nav        |
| `950`   | `#141110` | `oklch(0.180 0.005 38)`     | True dark, near-black          |

**Key surface tokens:**
- **Page background:** `#F8F5F0` (warm stone — between 50 and 100)
- **Cards:** `#FFFFFF` (pure white — lifts off warm background)
- **Ink (primary text):** `#1D1A18` (neutral-900)
- **Body text:** `#524C48` (neutral-600)
- **Muted text:** `#958D88` (neutral-400)
- **Borders:** `#DDD6D1` (neutral-200)

### 2.4 Semantic Colors

| Purpose                | Light BG    | Base        | Dark text   |
|------------------------|-------------|-------------|-------------|
| Success (Hijau)        | `#E8F5EC`   | `#2E7D52`   | `#065F46`   |
| Warning (Kuning)       | `#FFF6E5`   | `#C47F17`   | `#92400E`   |
| Error (Merah)          | `#FDF2F2`   | `#C53030`   | `#991B1B`   |
| Info (Patina)          | `#EAF7F2`   | `#2B6150`   | `#15382D`   |

**Note:** Info states use the primary verdigris — no extra color needed. Error/destructive uses cool red (#C53030), which has zero hue collision with the green accent. Success uses a slightly different green (warmer, more yellow-green) to remain distinguishable from the blue-green verdigris primary.

### 2.5 Legal Status Colors

| Status               | Color       | Label           | Badge treatment                       |
|----------------------|-------------|-----------------|---------------------------------------|
| Berlaku (In force)   | `#2E7D52`   | Berlaku          | Green-tinted bg (#E8F5EC), green text |
| Diubah (Amended)     | `#C47F17`   | Diubah           | Amber-tinted bg (#FFF6E5), amber text |
| Dicabut (Revoked)    | `#C53030`   | Dicabut          | Red-tinted bg (#FDF2F2), red text     |

---

## 3. Typography

### 3.1 Typeface Selection

| Role       | Typeface           | Why                                                                 |
|------------|--------------------|---------------------------------------------------------------------|
| Headings   | **Instrument Serif** | Refined, slightly condensed serif with beautiful italics. Formal without being stiff. Reads as editorial, scholarly, deliberate. Only weight 400 — hierarchy comes from size and italic, not boldness. |
| Body / UI  | **Instrument Sans**  | Same designer, same proportions as Instrument Serif. Shared x-height and character width ensures seamless harmony. Clean enough for UI, warm enough for long-form reading. |
| Code       | **JetBrains Mono**   | Clear, readable monospace for MCP commands, article numbers, code blocks. |

**Why Instrument:** The serif and sans share DNA — designed as a family by Rodrigo Fuenzalida. This eliminates the "two fonts from different worlds" problem. The serif provides gravitas for headings; the sans provides clarity for body text and UI. They feel like one voice at two registers.

**The italic:** Instrument Serif's italic is a key brand element. Use it for emphasis, for the secondary line in hero text (*dengan mudah*), for legal Latin terms, and for pull quotes. It adds editorial elegance that sans-serif cannot provide.

### 3.2 Typography Scale

Base: `16px` (`1rem`).

| Level          | Size            | Weight | Line Height | Letter Spacing | Font            |
|----------------|-----------------|--------|-------------|----------------|-----------------|
| **Display**    | `2.75rem` (44px)| 400    | 1.15        | `-0.01em`      | `font-heading`  |
| **H1**         | `2.375rem`(38px)| 400    | 1.2         | `-0.01em`      | `font-heading`  |
| **H2**         | `1.75rem` (28px)| 400    | 1.25        | `-0.005em`     | `font-heading`  |
| **H3**         | `1.25rem` (20px)| 400    | 1.35        | `0`            | `font-heading`  |
| **H4**         | `1.125rem`(18px)| 400    | 1.4         | `0`            | `font-heading`  |
| **Body Large** | `1.125rem`(18px)| 400    | 1.8         | `0`            | `font-sans`     |
| **Body Base**  | `1rem` (16px)   | 400    | 1.85        | `0`            | `font-sans`     |
| **Body Small** | `0.875rem`(14px)| 400    | 1.7         | `0`            | `font-sans`     |
| **Caption**    | `0.75rem` (12px)| 500    | 1.5         | `0.01em`       | `font-sans`     |
| **Label**      | `0.75rem` (12px)| 600    | 1.5         | `0.05em`       | `font-sans`     |

**Important:** Instrument Serif only has weight 400. All heading hierarchy is achieved through size, not weight. This is by design — it creates a calmer, more refined visual rhythm than bold headings. For UI labels and navigation where weight variation is needed, use Instrument Sans (which supports 400–700).

**Usage in code:**
```html
<h1 class="font-heading text-4xl tracking-tight">
  Cari hukum Indonesia<br />
  <em class="text-muted-foreground">dengan mudah</em>
</h1>
<p class="font-sans text-base leading-relaxed">Body text in Instrument Sans</p>
<code class="font-mono text-sm">claude mcp add pasal-id</code>
```

---

## 4. Implementation: globals.css

Drop-in replacement for `apps/web/src/app/globals.css`. Full shadcn/ui compatibility.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-heading: var(--font-instrument-serif);
  --font-sans: var(--font-instrument-sans);
  --font-mono: var(--font-jetbrains);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
}

:root {
  --radius: 0.5rem;

  /* Primary (Patina / Verdigris) */
  --primary: oklch(0.450 0.065 170);
  --primary-foreground: oklch(1 0 0);

  /* Surfaces — warm stone */
  --background: oklch(0.970 0.006 65);
  --foreground: oklch(0.220 0.006 40);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.220 0.006 40);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.220 0.006 40);

  /* Secondary — warm graphite for muted surfaces */
  --secondary: oklch(0.935 0.008 60);
  --secondary-foreground: oklch(0.280 0.008 42);

  /* Muted */
  --muted: oklch(0.935 0.008 60);
  --muted-foreground: oklch(0.500 0.010 50);

  /* Accent — same as secondary in this minimal system */
  --accent: oklch(0.935 0.008 60);
  --accent-foreground: oklch(0.280 0.008 42);

  /* Destructive — cool red, zero collision with green */
  --destructive: oklch(0.520 0.180 22);

  /* Borders & Inputs */
  --border: oklch(0.880 0.010 60);
  --input: oklch(0.880 0.010 60);
  --ring: oklch(0.450 0.065 170);

  /* Charts — verdigris anchored, spread across warm tones */
  --chart-1: oklch(0.450 0.065 170);
  --chart-2: oklch(0.550 0.100 85);
  --chart-3: oklch(0.500 0.060 250);
  --chart-4: oklch(0.600 0.120 30);
  --chart-5: oklch(0.650 0.060 168);

  /* Sidebar */
  --sidebar: oklch(0.970 0.006 65);
  --sidebar-foreground: oklch(0.220 0.006 40);
  --sidebar-primary: oklch(0.450 0.065 170);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.935 0.008 60);
  --sidebar-accent-foreground: oklch(0.280 0.008 42);
  --sidebar-border: oklch(0.880 0.010 60);
  --sidebar-ring: oklch(0.450 0.065 170);

  /* Legal Status */
  --status-berlaku: oklch(0.540 0.120 155);
  --status-diubah: oklch(0.620 0.140 70);
  --status-dicabut: oklch(0.520 0.180 22);
}

.dark {
  /* Surfaces — warm graphite darks */
  --background: oklch(0.180 0.005 38);
  --foreground: oklch(0.935 0.008 60);
  --card: oklch(0.220 0.006 40);
  --card-foreground: oklch(0.935 0.008 60);
  --popover: oklch(0.220 0.006 40);
  --popover-foreground: oklch(0.935 0.008 60);

  /* Primary — verdigris-300 for contrast on dark bg */
  --primary: oklch(0.780 0.055 168);
  --primary-foreground: oklch(0.180 0.005 38);

  /* Secondary */
  --secondary: oklch(0.260 0.008 42);
  --secondary-foreground: oklch(0.935 0.008 60);

  /* Muted */
  --muted: oklch(0.260 0.008 42);
  --muted-foreground: oklch(0.650 0.012 55);

  /* Accent */
  --accent: oklch(0.260 0.008 42);
  --accent-foreground: oklch(0.935 0.008 60);

  /* Destructive — lighter cool red for dark bg */
  --destructive: oklch(0.600 0.170 22);

  /* Borders & Inputs */
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.780 0.055 168);

  /* Charts */
  --chart-1: oklch(0.780 0.055 168);
  --chart-2: oklch(0.700 0.090 85);
  --chart-3: oklch(0.650 0.060 250);
  --chart-4: oklch(0.700 0.100 30);
  --chart-5: oklch(0.750 0.055 168);

  /* Sidebar */
  --sidebar: oklch(0.200 0.006 40);
  --sidebar-foreground: oklch(0.935 0.008 60);
  --sidebar-primary: oklch(0.780 0.055 168);
  --sidebar-primary-foreground: oklch(0.935 0.008 60);
  --sidebar-accent: oklch(0.260 0.008 42);
  --sidebar-accent-foreground: oklch(0.935 0.008 60);
  --sidebar-border: oklch(1 0 0 / 8%);
  --sidebar-ring: oklch(0.780 0.055 168);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Dark mode notes:**
- Backgrounds use warm graphite darks (hue 38–42°, very low chroma) — NOT cool/neutral blacks
- Primary flips to verdigris-300 (#96C3B1) for readable contrast on dark surfaces
- Destructive shifts lighter but stays vivid cool red
- Borders use 10% white opacity for subtle separation

---

## 5. Implementation: layout.tsx Font Setup

Replace the font configuration in `apps/web/src/app/layout.tsx`:

```tsx
import { Instrument_Serif, Instrument_Sans, JetBrains_Mono } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

// In the <body> tag:
<body className={`${instrumentSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased font-sans`}>
```

**Font assignment rules:**
- `font-heading` (Instrument Serif) → Display, H1–H4, hero text, logo wordmark, card titles
- `font-sans` (Instrument Sans) → Body text, legal content, captions, labels, UI text, navigation, buttons
- `font-mono` (JetBrains Mono) → Code blocks, MCP commands, CLI snippets, article numbers

**The italic rule:** Use Instrument Serif italic for:
- Secondary hero text ("*dengan mudah*")
- Legal Latin terms (*ex post facto*, *lex specialis*)
- Subtle emphasis within headings
- Pull quotes or editorial callouts
- Never use italic on Instrument Sans for stylistic purposes — reserve it for conventional emphasis in body text

---

## 6. Spacing & Layout

### 6.1 Spacing Scale

Base unit: `4px`. Use Tailwind's built-in spacing utilities.

Key spacings:
- **Icon gaps:** `4px` (space-1)
- **Tight padding:** `8px` (space-2)
- **Standard padding:** `16px` (space-4)
- **Card padding:** `24px` (space-6)
- **Section gaps:** `32px` (space-8)
- **Major sections:** `48px` (space-12)
- **Hero spacing:** `64px` (space-16)

### 6.2 Border Radius

Default: `--radius: 0.5rem` (8px). Tight, restrained — matches the stone aesthetic.

- `--radius-sm`: 4px — badges, tags
- `--radius-md`: 6px — inputs, small buttons
- `--radius-lg`: 8px — **default** (buttons, cards)
- `--radius-xl`: 12px — large cards, modals
- `--radius-full`: 9999px — pills, chips, avatars

### 6.3 Layout

| Property              | Value                                    |
|-----------------------|------------------------------------------|
| Max content width     | `1280px` (`max-w-7xl`)                   |
| Reader content width  | `768px` (`max-w-3xl`) for legal text     |
| Gutter                | `24px` desktop, `16px` mobile            |
| Page padding          | `16px` mobile, `24px` tablet, `32px` desktop |

### 6.4 Breakpoints

| Name      | Range            | Layout                                           |
|-----------|------------------|--------------------------------------------------|
| Mobile    | `< 640px`        | Single column. Full-width. Stacked nav.          |
| Tablet    | `640–1023px`     | Two columns possible. Sidebar → drawer.          |
| Desktop   | `1024–1279px`    | Three-column reader. Sidebar visible.            |
| Wide      | `≥ 1280px`       | Max content width. Centered with margins.        |

---

## 7. Component Patterns

### 7.1 Buttons

| Variant       | Background         | Text                          | Border    |
|---------------|--------------------|---------------------------------|-----------|
| Primary       | `bg-primary`       | `text-primary-foreground`       | none      |
| Secondary     | `bg-secondary`     | `text-secondary-foreground`     | `border`  |
| Ghost         | transparent        | `text-primary`                  | none      |
| Destructive   | `bg-destructive`   | white                           | none      |

Sizes: `sm` (32px), `md` (40px), `lg` (48px). Font: `font-sans`. Weight: 600.

States:
- Hover: `700` (#204C3E)
- Active: `800` (#15382D) + `scale(0.98)`
- Disabled: `opacity-50`, `cursor-not-allowed`
- Loading: preserve width, replace content with spinner

### 7.2 Cards

```
Background:  bg-card (pure white — lifts off warm stone bg)
Border:      border (1px, neutral-200 #DDD6D1)
Shadow:      none (borders provide structure, not shadows)
Padding:     p-6 (24px)
Radius:      rounded-lg (--radius-lg, 8px)
Hover:       border-primary/30
```

**Note:** Minimal shadow. The Batu Candi aesthetic relies on borders and background contrast for depth, not elevation shadows. Use `shadow-sm` sparingly and only for popovers/dropdowns.

### 7.3 Links

One link style — verdigris for everything:

```
Color:       primary-600 (#2B6150)
Hover:       primary-700 (#204C3E)
Underline:   border-bottom 1px solid primary/25
Font weight: 500
Use for:     all links — cross-references, CTAs, navigation
```

**Why one style:** The near-monochrome palette means links need exactly one clear signal. Verdigris is that signal. No need to differentiate "reference links" from "action links" when there's only one color doing interactive duty.

### 7.4 Inputs

```
Height:      h-10 (40px), h-12 (48px for search)
Border:      border (neutral-200 #DDD6D1)
Radius:      rounded-lg (--radius-lg)
Background:  bg-background (stone #F8F5F0) or bg-card (white)
Focus:       ring-2 ring-primary ring-offset-2
Placeholder: text-muted-foreground
Error:       border-destructive (#C53030) — zero confusion with green primary
Labels:      above input, text-xs font-medium font-sans
```

### 7.5 Badges / Status Tags

```
Shape:       rounded-full (pill)
Background:  status color at 10% opacity
Text:        status color at full saturation
Font:        text-xs font-sans font-semibold
Padding:     px-2.5 py-0.5
```

### 7.6 Navigation

```
Header:      bg-card (white), border-b
Height:      h-14 (56px)
Logo:        font-heading (Instrument Serif), text-foreground
Active tab:  border-b-2 border-primary (verdigris), text-foreground font-semibold
Inactive:    text-muted-foreground
Mobile:      slide-out drawer
```

---

## 8. Iconography

**Library:** Lucide React. Outlined, 1.5px stroke, rounded caps, 24px viewbox.

**Key icons:**
- `Scale` — law/justice
- `Search` — search
- `BookOpen` — reader/browse
- `Link` — MCP connection
- `FileText` — legal document
- `ChevronRight` — navigation, TOC
- `Copy` — copy article/JSON
- `Check` / `AlertTriangle` / `XCircle` — status

**Icon color:** Default `text-muted-foreground` (#958D88). Active/interactive `text-primary` (#2B6150).

---

## 9. Motion

**Philosophy:** Barely there. Legal content demands focus. Motion serves function, never decoration.

```css
--transition-default: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow:    300ms cubic-bezier(0.4, 0, 0.2, 1);
```

- **Buttons:** 150ms background-color, `scale(0.98)` on active
- **Cards:** 150ms border-color on hover
- **Loading:** Always skeletons, never spinners
- **Page transitions:** Minimal — use `loading.tsx` skeletons
- **No spring animations.** No bouncy physics. Restrained.

---

## 10. Logo

**Mark:** Section symbol (§) merged with open page/book form. Typographic-first, not illustrative. Works at 16px.

**Wordmark:** Instrument Serif 400, `Pasal` + `.id` at muted color.

```html
<h1 class="font-heading text-xl tracking-tight">
  Pasal<span class="text-muted-foreground">.id</span>
</h1>
```

**Color rules:**
- Default: `text-foreground` (#1D1A18) on light backgrounds
- On dark surfaces: `#F8F5F0` (stone) or white
- Must work in monochrome (black/white)
- The mark should never use the accent color — keep the logo neutral

---

## 11. Page Structure Reference

| Page                          | Key design notes                                        |
|-------------------------------|--------------------------------------------------------|
| `/` (Landing)                 | Hero search, centered. Clean white hero. Stats below.  |
| `/search?q=...`               | Results list with status badges, skeleton loading.     |
| `/peraturan/[type]/[slug]`    | Three-column: TOC left, content center, context right. |
| `/connect`                    | Developer-focused. Copyable MCP command. Code blocks.  |

**Landing page hierarchy:**
1. Search input (primary action)
2. Tagline in Instrument Serif, with italic second line
3. MCP CTA card (dark graphite-900 background)
4. Stats bar

---

## 12. Do / Don't Quick Reference

### DO:
- Use Instrument Serif for all headings — weight 400 only, hierarchy through size
- Use Instrument Serif italic for editorial emphasis and secondary hero text
- Use Instrument Sans for body, UI, buttons, navigation
- Use verdigris (`primary`) as the single accent color — buttons, links, focus rings, everything interactive
- Keep the palette near-monochrome — warm graphite handles 95% of the interface
- Use the warm stone background (#F8F5F0), not pure white, as the page surface
- Use pure white (#FFFFFF) for cards to create lift
- Let typography and whitespace carry the design
- Use `rounded-lg` (8px) as the default radius
- Use borders for depth — avoid shadows except on popovers

### DON'T:
- Add a second accent color — the restraint is the brand
- Use Instrument Serif at any weight other than 400 (it only has 400)
- Use bold Instrument Sans for headings — that's the serif's job
- Use cool gray/slate neutrals — always warm graphite
- Use heavy box-shadows — this is a stone-and-light aesthetic, not material design
- Add gradients, decorative borders, or ornamental elements
- Use more than the one accent color for interactive states
- Make the interface colorful — if you're reaching for a second color, reconsider
