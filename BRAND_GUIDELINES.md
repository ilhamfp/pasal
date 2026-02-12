# BRAND_GUIDELINES.md

> **Purpose:** Single source of truth for Pasal.id's visual identity. Reference this file before writing any frontend code, component, or page. When in doubt about a color, font, spacing, or component style — look here first.

---

## Quick Reference (for fast lookups)

```
PRIMARY COLOR:    oklch(0.544 0.114 26)   →  #A8524C  (volcanic earth rosewood, hue ~26°)
ACCENT COLOR:     oklch(0.473 0.068 252)  →  #3F5E81  (warm steel-blue, hue ~252°)
GOLD (decorative): oklch(0.667 0.108 88)  →  #B0903D  (antique gold)
HEADING FONT:     Plus Jakarta Sans (font-heading)
BODY FONT:        Inter (font-sans)
MONO FONT:        JetBrains Mono (font-mono)
DEFAULT RADIUS:   0.625rem (10px)
BASE SPACING:     4px (0.25rem)
MAX WIDTH:        1280px (80rem)
READER WIDTH:     768px (48rem)
```

---

## 1. Brand Personality

**Five words:** Trustworthy, Accessible, Clear, Modern, Open.

**The feeling:** A modern, well-lit public library — not a dim government office. Calm authority. Quiet confidence. Clean typography, generous whitespace, warm but restrained color. The gravitas of a mahogany courtroom, the openness of a public resource. "Finally — someone built the legal resource Indonesia deserves."

**What this is NOT:** AI-slop purple gradients. Generic SaaS blue. Cold corporate gray. Busy government portals. Cheap teal/mint fintech aesthetic.

---

## 2. Color System

### 2.1 Design Rationale

**Three-color hierarchy:**

1. **Primary — Rosewood "Tanah Api"** (volcanic earth). Deep warm red-brown for brand identity, primary buttons, navigation, headers. Culturally rooted in Javanese volcanic soil, soga batik dye, Majapahit red-brick architecture, and sonokeling (Indonesian rosewood) heartwood.

2. **Accent — Steel-Blue "Baja"** (warm steel). Muted warm-leaning blue for inline links, focus rings, secondary interactive elements, and data visualization. Provides cool counterpoint to the warm palette — prevents monotone warmth. Think aged steel, twilight, not corporate SaaS blue.

3. **Gold — "Emas"** (antique gold). Purely decorative — premium badges, highlights, special callouts, icons. References the Garuda Pancasila and songket gold-thread tradition. Never used for primary actions.

**Distribution:** 60% warm neutrals, 30% rosewood (with steel-blue as a functional subset within the 30%), 10% gold decorative.

**Error-state differentiation:** The primary rosewood lives at hue ~26° with chroma ~0.114 (muted, earthy). Error/destructive states use a *cool vivid red* at hue ~23° with much higher chroma (~0.205). Combined with icon, container, and typography differentiation, this eliminates semantic collision. See Section 2.5.

**Scale generation:** The rosewood and steel-blue scales are generated using smooth oklch curves — lightness ramps linearly, chroma follows a bell curve (peaking in the mid-range where color is most alive), and hue drifts gently (warmer in light steps, cooler in dark steps). This ensures perceptually uniform steps with no jarring jumps.

### 2.2 Primary — "Tanah Api" (Volcanic Earth Rosewood)

| Token   | Hex       | oklch                        | Use                                |
|---------|-----------|------------------------------|------------------------------------|
| `50`    | `#FFEBE3` | `oklch(0.960 0.030 38)`     | Subtle tinted backgrounds          |
| `100`   | `#F9D3C9` | `oklch(0.896 0.045 35)`     | Selected states, hover bg          |
| `200`   | `#E9AB9E` | `oklch(0.796 0.075 32)`     | Dark mode primary, decorative      |
| `300`   | `#D8897C` | `oklch(0.708 0.100 30)`     | Majapahit terracotta — icons       |
| `400`   | `#C26B61` | `oklch(0.624 0.113 28)`     | Large text, secondary buttons      |
| `500`   | `#A8524C` | `oklch(0.544 0.114 26)`     | **★ PRIMARY — buttons, nav, UI**   |
| `600`   | `#8B3F3C` | `oklch(0.467 0.105 24)`     | Hover state                        |
| `700`   | `#6D2F2F` | `oklch(0.391 0.088 22)`     | Pressed/active state               |
| `800`   | `#502223` | `oklch(0.318 0.069 20)`     | Dark accent, immersive sections    |
| `900`   | `#351617` | `oklch(0.246 0.050 19)`     | Sonokeling dark — deep accents     |
| `950`   | `#291011` | `oklch(0.210 0.042 18)`     | Near-black rosewood                |

**NOTE:** The base primary is at the `500` step (#A8524C). This provides a comfortable balance of warmth, screen readability, and interactive headroom. Contrast with white: 5.3:1 (WCAG AA — passes for buttons, large text, and UI elements). Use `600` for hover, `700` for pressed. Steps `400` and lighter are decorative or for large text only.

**Button state mapping:**
- Default: `500` (#A8524C)
- Hover: `600` (#8B3F3C) — or white overlay at 10% for subtle lightening
- Pressed: `700` (#6D2F2F) + `scale(0.98)`
- Dark backgrounds, hero sections: `800`–`900`

### 2.3 Accent — "Baja" (Warm Steel-Blue)

| Token   | Hex       | oklch                        | Use                                |
|---------|-----------|------------------------------|------------------------------------|
| `50`    | `#EAF3FF` | `oklch(0.960 0.020 258)`    | Subtle info/link backgrounds       |
| `100`   | `#D1DEF1` | `oklch(0.897 0.030 257)`    | Selected link states               |
| `200`   | `#A9BFDE` | `oklch(0.799 0.050 256)`    | Dark mode accent, decorative       |
| `300`   | `#87A4CA` | `oklch(0.711 0.065 255)`    | Icons (secondary)                  |
| `400`   | `#698BB5` | `oklch(0.628 0.074 254)`    | Secondary interactive              |
| `500`   | `#52749C` | `oklch(0.549 0.074 253)`    | Inline links in body text          |
| `600`   | `#3F5E81` | `oklch(0.473 0.068 252)`    | **★ ACCENT — links, focus rings**  |
| `700`   | `#2F4A66` | `oklch(0.399 0.058 251)`    | Link hover                         |
| `800`   | `#21364B` | `oklch(0.326 0.046 250)`    | Pressed state                      |
| `900`   | `#152433` | `oklch(0.255 0.034 249)`    | Dark accent text                   |
| `950`   | `#0F1C27` | `oklch(0.220 0.029 248)`    | Near-black steel                   |

**NOTE:** The accent base is at the `600` step (#3F5E81). Contrast with white: 6.7:1 (WCAG AA). Contrast with cream (#FAF6F0): 6.2:1. This is the default link color in body text and the focus-ring color for form elements.

**Link hierarchy:**
- Inline references in legal text: steel-blue `500`–`600`
- Navigation CTAs ("Baca Selengkapnya →"): rosewood `500`
- This separation gives users two clear signals: "reference link" vs "action link"

### 2.4 Gold — "Emas" (Antique Gold, Decorative Only)

| Token   | Hex       | oklch                        | Use                            |
|---------|-----------|------------------------------|--------------------------------|
| `50`    | `#FBF7EE` | `oklch(0.977 0.013 87)`     | Callout/highlight bg           |
| `100`   | `#F5F0E3` | `oklch(0.955 0.018 89)`     | Badge backgrounds              |
| `200`   | `#E8DCC5` | `oklch(0.898 0.033 84)`     | Light accents                  |
| `300`   | `#D7B18B` | `oklch(0.785 0.067 67)`     | Champagne — bridge tone ★      |
| `400`   | `#C9A84C` | `oklch(0.743 0.117 90)`     | Premium badges, icons          |
| `500`   | `#B0903D` | `oklch(0.667 0.108 88)`     | **GOLD — highlights, premium** |
| `600`   | `#8B6914` | `oklch(0.541 0.104 84)`     | Solo keraton gold — hover      |
| `700`   | `#6B4E06` | `oklch(0.443 0.088 83)`     | Active/pressed                 |
| `800`   | `#4A3604` | `oklch(0.346 0.068 84)`     | Dark accent text               |
| `900`   | `#332500` | `oklch(0.274 0.056 87)`     | Darkest accent                 |

**Gold-300 (#D7B18B, "Champagne")** is the critical bridge tone. It connects rosewood warmth and gold richness. Use it for subtle dividers, premium card headers, or anywhere you need warmth without full gold saturation.

**Gold is decorative only.** Never use for primary/secondary actions. Never in the logo. Reserve for premium badges, star ratings, highlighted callouts, and sparse visual accents.

### 2.5 Neutrals — "Batu" (Warm Stone)

Warm-toned neutrals. NOT cool slate — these have a warm (yellow/ochre) undertone to harmonize with the rosewood + gold palette.

| Token   | Hex       | oklch                        | Use                            |
|---------|-----------|------------------------------|--------------------------------|
| `0`     | `#FFFFFF` | `oklch(1 0 0)`              | Card surfaces (lifts off bg)   |
| `25`    | `#FEFCFA` | `oklch(0.992 0.003 67)`     | Off-white                      |
| `50`    | `#FAF6F0` | `oklch(0.975 0.009 78)`     | Page background (light mode)   |
| `100`   | `#F5F0E8` | `oklch(0.957 0.012 80)`     | Card background alt            |
| `200`   | `#E8DFD4` | `oklch(0.908 0.018 73)`     | Borders, dividers              |
| `300`   | `#D4C9BB` | `oklch(0.841 0.023 74)`     | Disabled states                |
| `400`   | `#A89A8A` | `oklch(0.694 0.028 71)`     | Placeholder text               |
| `500`   | `#7A6E60` | `oklch(0.545 0.026 72)`     | Secondary text                 |
| `600`   | `#5C534A` | `oklch(0.448 0.019 67)`     | Body text                      |
| `700`   | `#433D36` | `oklch(0.364 0.014 72)`     | Heading text                   |
| `800`   | `#2D2923` | `oklch(0.283 0.012 78)`     | Primary text (light mode)      |
| `900`   | `#1C1916` | `oklch(0.216 0.007 67)`     | Near-black                     |
| `950`   | `#0F0E0C` | `oklch(0.164 0.004 85)`     | True dark                      |

### 2.6 Semantic Colors

Error states use a **cool vivid red** that is perceptually distinct from the brand rosewood through three channels:
- **Hue:** Brand ~26° (warm, toward brown) → Error ~23° oklch (cooler, toward pink-red)
- **Chroma:** Brand ~0.114 (muted, earthy) → Error ~0.205 (vivid, alarming) — nearly 2x
- **Context:** Brand = fills (buttons, headers). Error = borders on inputs, inline text with icon, contained alert boxes. Never share visual treatment.
- **Always pair error with icons** (✕, ⚠) and explicit text — never rely on color alone.

| Purpose                | Light BG    | Base        | Dark text   |
|------------------------|-------------|-------------|-------------|
| Success (Hijau)        | `#ECFDF5`   | `#2E9958`   | `#065F46`   |
| Warning (Kuning)       | `#FFF8EB`   | `#EB9114`   | `#92400E`   |
| Error (Merah)          | `#FBE9EB`   | `#CF2233`   | `#991B1B`   |
| Info (Biru)            | `#EAF3FF`   | `#3F5E81`   | `#21364B`   |

**Note:** Info now uses steel-blue (`#3F5E81` / `#EAF3FF`) rather than a separate blue. This keeps the overall palette cohesive — steel-blue does double duty as accent and info semantic.

### 2.7 Legal Status Colors

| Status               | Color       | Label           | Badge treatment                       |
|----------------------|-------------|-----------------|---------------------------------------|
| Berlaku (In force)   | `#2E9958`   | ✅ Berlaku       | Green-tinted bg, green text           |
| Diubah (Amended)     | `#EB9114`   | ⚠️ Diubah        | Amber-tinted bg, amber text           |
| Dicabut (Revoked)    | `#CF2233`   | ❌ Dicabut       | Cool red-tinted bg, cool red text     |

**Note on Dicabut:** Uses the cool vivid red (#CF2233), NOT the brand rosewood. The chroma difference (0.205 vs 0.114) ensures revoked status reads as a warning, not as a brand element.

---

## 3. Implementation: globals.css

Drop-in replacement for `apps/web/src/app/globals.css`. This preserves full shadcn/ui compatibility.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-heading: var(--font-plus-jakarta);
  --font-sans: var(--font-inter);
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
  --radius: 0.625rem;

  /* Primary (Tanah Api / Volcanic Earth Rosewood) */
  --primary: oklch(0.544 0.114 26);
  --primary-foreground: oklch(0.975 0.009 78);

  /* Surfaces — warm parchment tones */
  --background: oklch(0.975 0.009 78);
  --foreground: oklch(0.216 0.007 67);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.216 0.007 67);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.216 0.007 67);

  /* Secondary — warm stone for muted surfaces */
  --secondary: oklch(0.957 0.012 80);
  --secondary-foreground: oklch(0.283 0.012 78);

  /* Muted */
  --muted: oklch(0.957 0.012 80);
  --muted-foreground: oklch(0.545 0.026 72);

  /* Accent (Baja / Warm Steel-Blue) */
  --accent: oklch(0.473 0.068 252);
  --accent-foreground: oklch(0.975 0.009 78);

  /* Destructive — cool vivid red, NOT brand rosewood */
  --destructive: oklch(0.552 0.205 23);

  /* Borders & Inputs — warm */
  --border: oklch(0.908 0.018 73);
  --input: oklch(0.908 0.018 73);
  --ring: oklch(0.544 0.114 26);

  /* Charts — rosewood, steel-blue, gold anchored */
  --chart-1: oklch(0.544 0.114 26);
  --chart-2: oklch(0.473 0.068 252);
  --chart-3: oklch(0.667 0.108 88);
  --chart-4: oklch(0.607 0.137 153);
  --chart-5: oklch(0.708 0.100 30);

  /* Sidebar */
  --sidebar: oklch(0.975 0.009 78);
  --sidebar-foreground: oklch(0.216 0.007 67);
  --sidebar-primary: oklch(0.544 0.114 26);
  --sidebar-primary-foreground: oklch(0.975 0.009 78);
  --sidebar-accent: oklch(0.957 0.012 80);
  --sidebar-accent-foreground: oklch(0.283 0.012 78);
  --sidebar-border: oklch(0.908 0.018 73);
  --sidebar-ring: oklch(0.544 0.114 26);

  /* Legal Status */
  --status-berlaku: oklch(0.607 0.137 153);
  --status-diubah: oklch(0.734 0.159 66);
  --status-dicabut: oklch(0.552 0.205 23);
}

.dark {
  /* Surfaces — warm rosewood-tinted darks */
  --background: oklch(0.198 0.011 25);
  --foreground: oklch(0.957 0.012 80);
  --card: oklch(0.234 0.012 25);
  --card-foreground: oklch(0.957 0.012 80);
  --popover: oklch(0.234 0.012 25);
  --popover-foreground: oklch(0.957 0.012 80);

  /* Primary — rosewood-200 for contrast on dark bg */
  --primary: oklch(0.796 0.075 32);
  --primary-foreground: oklch(0.198 0.011 25);

  /* Secondary */
  --secondary: oklch(0.269 0.016 25);
  --secondary-foreground: oklch(0.957 0.012 80);

  /* Muted */
  --muted: oklch(0.269 0.016 25);
  --muted-foreground: oklch(0.650 0.020 72);

  /* Accent — steel-blue-200 for readability on dark bg */
  --accent: oklch(0.799 0.050 256);
  --accent-foreground: oklch(0.198 0.011 25);

  /* Destructive — lighter cool red for dark bg */
  --destructive: oklch(0.621 0.198 21);

  /* Borders & Inputs */
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.796 0.075 32);

  /* Charts */
  --chart-1: oklch(0.796 0.075 32);
  --chart-2: oklch(0.799 0.050 256);
  --chart-3: oklch(0.785 0.067 67);
  --chart-4: oklch(0.607 0.137 153);
  --chart-5: oklch(0.708 0.100 30);

  /* Sidebar */
  --sidebar: oklch(0.212 0.013 25);
  --sidebar-foreground: oklch(0.957 0.012 80);
  --sidebar-primary: oklch(0.796 0.075 32);
  --sidebar-primary-foreground: oklch(0.957 0.012 80);
  --sidebar-accent: oklch(0.269 0.016 25);
  --sidebar-accent-foreground: oklch(0.957 0.012 80);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.796 0.075 32);
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
- Backgrounds use rosewood-tinted warm darks (hue 25°, low chroma) — NOT cool/neutral blacks
- Primary flips to rosewood-200 (#E9AB9E) for readable contrast on dark surfaces
- Accent flips to steel-blue-200 (#A9BFDE) for link readability
- Gold adapts to champagne-300 (#D7B18B) in charts — warmer, lighter
- Legal status badges use 15% opacity backgrounds on dark surfaces
- Destructive shifts to oklch(0.621 0.198 21) — lighter but still vivid

---

## 4. Implementation: layout.tsx Font Setup

Replace the font configuration in `apps/web/src/app/layout.tsx`:

```tsx
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

// In the <body> tag:
<body className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}>
```

**Font assignment rules:**
- `font-heading` (Plus Jakarta Sans) → Display, H1–H4, hero text, logo wordmark
- `font-sans` (Inter) → Body text, legal content, captions, labels, UI text
- `font-mono` (JetBrains Mono) → Code blocks, MCP commands, CLI snippets, article numbers

---

## 5. Typography Scale

Base: `16px` (`1rem`).

| Level          | Size            | Weight | Line Height | Letter Spacing | Font            |
|----------------|-----------------|--------|-------------|----------------|-----------------|
| **Display**    | `3.5rem` (56px) | 800    | 1.1         | `-0.02em`      | `font-heading`  |
| **H1**         | `2.25rem` (36px)| 700    | 1.2         | `-0.015em`     | `font-heading`  |
| **H2**         | `1.75rem` (28px)| 700    | 1.3         | `-0.01em`      | `font-heading`  |
| **H3**         | `1.375rem`(22px)| 600    | 1.4         | `-0.005em`     | `font-heading`  |
| **H4**         | `1.125rem`(18px)| 600    | 1.5         | `0`            | `font-heading`  |
| **Body Large** | `1.125rem`(18px)| 400    | 1.7         | `0`            | `font-sans`     |
| **Body Base**  | `1rem` (16px)   | 400    | 1.7         | `0`            | `font-sans`     |
| **Body Small** | `0.875rem`(14px)| 400    | 1.6         | `0`            | `font-sans`     |
| **Caption**    | `0.75rem` (12px)| 500    | 1.5         | `0.01em`       | `font-sans`     |
| **Label**      | `0.75rem` (12px)| 600    | 1.5         | `0.05em`       | `font-sans`     |

**Usage in code:**
```html
<h1 class="font-heading text-4xl font-bold tracking-tight">Pasal.id</h1>
<p class="font-sans text-base leading-relaxed">Body text in Inter</p>
<code class="font-mono text-sm">claude mcp add pasal-id</code>
```

---

## 6. Spacing & Layout

### 6.1 Spacing Scale

Base unit: `4px`. Use Tailwind's built-in spacing utilities (`p-1` = 4px, `p-2` = 8px, etc.).

Key spacings:
- **Icon gaps:** `4px` (space-1)
- **Tight padding:** `8px` (space-2)
- **Standard padding:** `16px` (space-4)
- **Card padding:** `24px` (space-6)
- **Section gaps:** `32px` (space-8)
- **Major sections:** `48px` (space-12)
- **Hero spacing:** `64px` (space-16)

### 6.2 Border Radius

Default: `--radius: 0.625rem` (10px). shadcn derives all variants from this.

- `--radius-sm`: 6px — badges, tags
- `--radius-md`: 8px — inputs, small buttons
- `--radius-lg`: 10px — **default** (buttons, cards)
- `--radius-xl`: 14px — large cards, modals
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
| Ghost         | transparent        | `text-muted-foreground`         | none      |
| Destructive   | `bg-destructive`   | white                           | none      |
| Accent        | `bg-accent`        | `text-accent-foreground`        | none      |

Sizes: `sm` (32px), `md` (40px), `lg` (48px). Font weight: 500.

States:
- Hover: one step darker. For primary: `500` → `600`. Or use white overlay at 10% for subtle lightening.
- Active: `scale(0.98)`, two steps darker (`700`)
- Disabled: `opacity-50`, `cursor-not-allowed`
- Loading: preserve width, replace content with spinner

### 7.2 Cards

```
Background:  bg-card (pure white — lifts off warm page bg)
Border:      border (1px, neutral-200 #E8DFD4)
Shadow:      shadow-sm (0 1px 3px rgba(0,0,0,0.04))
Padding:     p-6 (24px)
Radius:      rounded-xl (--radius-xl, 14px)
Hover:       border-primary/30, shadow-md
```

### 7.3 Links

Two link styles for different contexts:

```
Inline references (in legal text):
  Color:       steel-blue-600 (#3F5E81) or steel-blue-500 (#52749C)
  Hover:       steel-blue-700 (#2F4A66)
  Underline:   border-bottom 1px solid steel-blue/30
  Use for:     cross-references, citations, pasal links in body text

Navigation / CTA links:
  Color:       rosewood-500 (#A8524C)
  Hover:       rosewood-600 (#8B3F3C)
  Underline:   border-bottom 1px solid rosewood/30
  Use for:     "Baca Selengkapnya →", "Lihat Pasal", action-oriented links
```

### 7.4 Inputs

```
Height:      h-10 (40px), h-12 (48px for search)
Border:      border (neutral-300 #D4C9BB)
Radius:      rounded-lg (--radius-lg)
Focus:       ring-2 ring-primary ring-offset-2
Placeholder: text-muted-foreground italic
Error:       border-destructive bg-destructive/5 (uses COOL red #CF2233, not brand)
Labels:      above input, text-xs font-medium
```

### 7.5 Badges / Status Tags

```
Shape:       rounded-full (pill)
Background:  status color at 10% opacity
Text:        status color at full saturation
Font:        text-xs font-medium
Padding:     px-2.5 py-0.5

Premium badge:
  Background: gold-100 (#F5F0E3)
  Text:       gold-600 (#8B6914)
```

### 7.6 Navigation

```
Header:      bg-card border-b, backdrop-blur on scroll
Height:      h-14 (56px)
Active:      border-b-2 border-primary (rosewood)
Mobile:      slide-out drawer (not bottom tabs)
Logo:        left-aligned, font-heading font-bold, text-primary
```

---

## 8. Iconography

**Library:** Lucide React (already installed). Outlined, 1.5px stroke, rounded caps, 24px viewbox.

**Key icons:**
- `Scale` — law/justice (header, logo concept)
- `Search` — search
- `BookOpen` — reader/browse
- `Link` — MCP connection
- `FileText` — legal document
- `ChevronRight` — navigation, TOC
- `Copy` — copy article/JSON
- `Check` / `AlertTriangle` / `XCircle` — status

---

## 9. Motion

**Philosophy:** Subtle and functional. Legal content demands focus.

```css
--transition-default: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow:    300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-spring:  300ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

- **Buttons:** 150ms background-color, `scale(0.98)` on active
- **Cards:** 150ms border-color on hover
- **Loading:** Always skeletons, never spinners
- **Page transitions:** Minimal — use `loading.tsx` skeletons

---

## 10. Logo

**Mark:** Section symbol (§) merged with open page/book form. Typographic-first, not illustrative. Works at 16px.

**Wordmark:** Plus Jakarta Sans 700, `Pasal` full weight + `.id` at 60% opacity or weight 400. Letter-spacing: `-0.02em`.

```html
<h1 class="font-heading text-5xl font-bold tracking-tight">
  Pasal<span class="text-primary/60">.id</span>
</h1>
```

**Color rules:**
- Primary: volcanic earth rosewood `#A8524C` mark on white/cream
- Must work in monochrome (black/white)
- Dark bg: use `primary-200` (#E9AB9E) or white
- The mark should never use gold — gold is decorative-only

---

## 11. Page Structure Reference

| Page                          | Key design notes                                        |
|-------------------------------|--------------------------------------------------------|
| `/` (Landing)                 | Hero search, centered. Stats. MCP CTA card.            |
| `/search?q=...`               | Results list with status badges, skeleton loading.     |
| `/peraturan/[type]/[slug]`    | Three-column: TOC left, content center, context right. |
| `/connect`                    | Developer-focused. Copyable MCP command. Code blocks.  |

**Landing page hierarchy:**
1. Search input (primary action)
2. Tagline ("Cari hukum Indonesia dengan mudah")
3. MCP CTA card
4. Stats bar (social proof)

---

## 12. Do / Don't Quick Reference

### DO:
- Use `font-heading` for all headings (H1–H4, display)
- Use `font-sans` (Inter) for body text and UI
- Use rosewood (`primary`) for buttons, navigation, headers, brand moments
- Use steel-blue (`accent`) for inline links in legal text and focus rings
- Use gold sparingly — only for decorative highlights, premium badges
- Use champagne gold (#D7B18B) as a bridge tone between rosewood and gold
- Use warm neutrals — the page background is `#FAF6F0`, not pure white
- Use `rounded-lg` (10px) as the default radius
- Use skeletons for all loading states
- Keep cards on pure white (`bg-card`) to lift off the warm page background
- Use **cool vivid red** (#CF2233) for error/destructive — clearly distinct from brand
- Use steel-blue for info states — keeps the system cohesive

### DON'T:
- Use violet, purple, or indigo anywhere — this is not an AI-aesthetic brand
- Use cool gray/slate neutrals — always use the warm stone palette
- Use gold as a primary or secondary action color — it's decorative only
- Use rosewood for inline text links in legal content — use steel-blue instead
- Use the brand rosewood for error/destructive states — they must be visually distinct
- Use spinners for content loading
- Use more than 2 font weights on the same element
- Mix warm and cool neutrals
- Add black to darken rosewood — increase saturation instead
- Pair rosewood with medium grays — use ivory/cream for contrast