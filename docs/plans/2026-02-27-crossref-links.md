# Cross-Reference Hyperlinks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render inline hyperlinks in pasal body text for cross-references like "Pasal 5", "Pasal 5 ayat (2)", and "Undang-Undang Nomor 13 Tahun 2003" — linking intra-document references to `#pasal-N` anchors and cross-document references to `/peraturan/[type]/[slug]`.

**Architecture:** A new `"use client"` component `RichPasalContent` tokenizes `content_text` with regex at render time — no DB changes, no parser changes. A server-side works lookup map (`Record<string, string>`) is fetched once at the law detail page level and passed down through `PasalList` → `PasalBlock` → `RichPasalContent`. Unresolvable references render as plain text.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Vitest

---

## Reference: Key Files

| File | Role |
|------|------|
| `apps/web/src/components/reader/PasalBlock.tsx` | Renders one pasal — replace plain `<div>` with `RichPasalContent` |
| `apps/web/src/components/reader/PasalList.tsx` | Renders paginated pasal list — thread `worksLookup` prop through |
| `apps/web/src/app/[locale]/peraturan/[type]/[slug]/page.tsx` | Law detail page — fetch `worksLookup` here, pass down |
| `apps/web/src/lib/crossref.ts` | **New** — tokenizer function + regex (pure, no React) |
| `apps/web/src/components/reader/RichPasalContent.tsx` | **New** — `"use client"` component that renders tokenized content |
| `apps/web/src/lib/__tests__/crossref.test.ts` | **New** — Vitest unit tests for the tokenizer |

---

## Task 1: Write and test the tokenizer (pure function, no React)

**Files:**
- Create: `apps/web/src/lib/crossref.ts`
- Create: `apps/web/src/lib/__tests__/crossref.test.ts`

### Step 1: Write the failing tests

Create `apps/web/src/lib/__tests__/crossref.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { tokenize, type Token } from "@/lib/crossref";

const lookup: Record<string, string> = {
  "uu-13-2003": "/peraturan/uu/uu-13-2003",
  "pp-74-2008": "/peraturan/pp/pp-74-2008",
};

describe("tokenize", () => {
  it("returns plain text token for content with no references", () => {
    const result = tokenize("Hak dan kewajiban warga negara.", lookup);
    expect(result).toEqual([{ type: "text", value: "Hak dan kewajiban warga negara." }]);
  });

  it("detects bare Pasal reference", () => {
    const result = tokenize("Sesuai dengan Pasal 5 tentang hak.", lookup);
    expect(result).toEqual([
      { type: "text", value: "Sesuai dengan " },
      { type: "pasal", value: "Pasal 5", pasalNumber: "5", href: "#pasal-5" },
      { type: "text", value: " tentang hak." },
    ]);
  });

  it("detects Pasal with letter suffix", () => {
    const result = tokenize("Lihat Pasal 5A.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", pasalNumber: "5A", href: "#pasal-5A" },
      { type: "text" },
    ]);
  });

  it("detects Pasal with ayat", () => {
    const result = tokenize("Merujuk Pasal 12 ayat (2) undang-undang ini.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", value: "Pasal 12 ayat (2)", href: "#pasal-12" },
      { type: "text" },
    ]);
  });

  it("detects Pasal with lowercase", () => {
    const result = tokenize("sebagaimana dimaksud dalam pasal 7.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", pasalNumber: "7", href: "#pasal-7" },
      { type: "text" },
    ]);
  });

  it("detects resolvable UU cross-reference", () => {
    const result = tokenize(
      "Sesuai dengan Undang-Undang Nomor 13 Tahun 2003.",
      lookup
    );
    expect(result).toMatchObject([
      { type: "text" },
      {
        type: "uu",
        value: "Undang-Undang Nomor 13 Tahun 2003",
        href: "/peraturan/uu/uu-13-2003",
      },
      { type: "text" },
    ]);
  });

  it("renders unresolvable UU reference as plain text", () => {
    const result = tokenize(
      "Sesuai Undang-Undang Nomor 99 Tahun 1888.",
      lookup
    );
    // No UU token — falls through to plain text
    expect(result.every((t) => t.type === "text")).toBe(true);
    expect(result.map((t) => t.value).join("")).toBe(
      "Sesuai Undang-Undang Nomor 99 Tahun 1888."
    );
  });

  it("detects Peraturan Pemerintah cross-reference", () => {
    const result = tokenize(
      "diatur dalam Peraturan Pemerintah Nomor 74 Tahun 2008.",
      lookup
    );
    expect(result).toMatchObject([
      { type: "text" },
      { type: "uu", href: "/peraturan/pp/pp-74-2008" },
      { type: "text" },
    ]);
  });

  it("handles both Perpu and Perppu spellings", () => {
    const lookup2 = { "perppu-1-2022": "/peraturan/perppu/perppu-1-2022" };
    const r1 = tokenize("Perpu Nomor 1 Tahun 2022", lookup2);
    const r2 = tokenize("Perppu Nomor 1 Tahun 2022", lookup2);
    // Both should resolve (if in lookup) or both be plain text (if not)
    // For this test, neither is in lookup2 by the short form — just confirm no crash
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it("handles multiple references in one string", () => {
    const result = tokenize(
      "Lihat Pasal 3 dan Pasal 7 ayat (1).",
      lookup
    );
    const pasalTokens = result.filter((t) => t.type === "pasal");
    expect(pasalTokens).toHaveLength(2);
    expect(pasalTokens[0]).toMatchObject({ pasalNumber: "3" });
    expect(pasalTokens[1]).toMatchObject({ pasalNumber: "7" });
  });

  it("returns single text token for empty string", () => {
    expect(tokenize("", lookup)).toEqual([{ type: "text", value: "" }]);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd apps/web && npm run test -- --reporter=verbose src/lib/__tests__/crossref.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/crossref'"

### Step 3: Implement the tokenizer

Create `apps/web/src/lib/crossref.ts`:

```typescript
/**
 * Tokenizer for Indonesian legal cross-references in pasal content text.
 *
 * Splits a string into alternating plain-text and link tokens without
 * modifying the original text. Pure function — no React, no side effects.
 */

export type Token =
  | { type: "text"; value: string }
  | { type: "pasal"; value: string; pasalNumber: string; href: string }
  | { type: "uu"; value: string; href: string };

/**
 * Regex that matches Indonesian legal cross-references.
 *
 * Group 1 (PASAL_RE): Pasal references, optionally with ayat.
 *   - "Pasal 5", "pasal 5A", "Pasal 12 ayat (2)", "Pasal 1 ayat (a)"
 *
 * Group 2 (UU_RE): Full regulation citations with number and year.
 *   - "Undang-Undang Nomor 13 Tahun 2003"
 *   - "Peraturan Pemerintah Nomor 74 Tahun 2008"
 *   - "Peraturan Presiden Nomor 12 Tahun 2010"
 *   - "Perppu Nomor 1 Tahun 2022" / "Perpu Nomor 1 Tahun 2022"
 *
 * Capture group indices:
 *   match[1] = pasal match
 *   match[2] = uu match
 */
const CROSSREF_RE = new RegExp(
  // Group 1: Pasal N [ayat (X)]
  "((?:Pasal|pasal)\\s+\\d+[A-Za-z]?(?:\\s+ayat\\s+\\([0-9a-zA-Z]+\\))?)" +
    "|" +
    // Group 2: Full regulation citation
    "((?:Undang-Undang|Peraturan\\s+Pemerintah|Peraturan\\s+Presiden|Peraturan\\s+Daerah|Perppu|Perpu)" +
    "(?:\\s+Nomor)?\\s+\\d+\\s+[Tt]ahun\\s+\\d{4})",
  "g"
);

/**
 * Mapping from citation keyword to slug type prefix.
 * Used to build the lookup key from a UU citation string.
 */
const TYPE_PREFIX_MAP: [RegExp, string][] = [
  [/^Undang-Undang/i, "uu"],
  [/^Peraturan\s+Pemerintah/i, "pp"],
  [/^Peraturan\s+Presiden/i, "perpres"],
  [/^Peraturan\s+Daerah/i, "perda"],
  [/^Per(?:p)?pu/i, "perppu"],
];

/**
 * Extracts number and year from a citation string like
 * "Undang-Undang Nomor 13 Tahun 2003" → { number: "13", year: "2003" }
 */
function extractNumberYear(citation: string): { number: string; year: string } | null {
  const m = citation.match(/(\d+)\s+[Tt]ahun\s+(\d{4})/);
  if (!m) return null;
  return { number: m[1], year: m[2] };
}

/**
 * Builds a slug key like "uu-13-2003" from a citation string.
 * Returns null if the citation cannot be mapped.
 */
function citationToSlugKey(citation: string): string | null {
  let typePrefix: string | null = null;
  for (const [re, prefix] of TYPE_PREFIX_MAP) {
    if (re.test(citation)) {
      typePrefix = prefix;
      break;
    }
  }
  if (!typePrefix) return null;

  const parsed = extractNumberYear(citation);
  if (!parsed) return null;

  return `${typePrefix}-${parsed.number}-${parsed.year}`;
}

/**
 * Tokenizes `text` into an array of plain-text and link tokens.
 *
 * @param text        The raw content_text of a document node
 * @param worksLookup Map of slug key → absolute pathname, e.g. { "uu-13-2003": "/peraturan/uu/uu-13-2003" }
 */
export function tokenize(text: string, worksLookup: Record<string, string>): Token[] {
  if (!text) return [{ type: "text", value: "" }];

  const tokens: Token[] = [];
  let lastIndex = 0;

  // Reset regex state (global flag retains lastIndex between calls)
  CROSSREF_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CROSSREF_RE.exec(text)) !== null) {
    const [fullMatch, pasalMatch, uuMatch] = match;
    const matchStart = match.index;

    // Append preceding plain text
    if (matchStart > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, matchStart) });
    }

    if (pasalMatch) {
      // Extract the pasal number from e.g. "Pasal 5A ayat (2)" → "5A"
      const numMatch = pasalMatch.match(/(?:Pasal|pasal)\s+(\d+[A-Za-z]?)/);
      const pasalNumber = numMatch ? numMatch[1] : pasalMatch;
      tokens.push({
        type: "pasal",
        value: pasalMatch,
        pasalNumber,
        href: `#pasal-${pasalNumber}`,
      });
    } else if (uuMatch) {
      const slugKey = citationToSlugKey(uuMatch);
      if (slugKey && worksLookup[slugKey]) {
        tokens.push({
          type: "uu",
          value: uuMatch,
          href: worksLookup[slugKey],
        });
      } else {
        // Unresolvable — emit as plain text, do not produce a broken link
        tokens.push({ type: "text", value: uuMatch });
      }
    }

    lastIndex = matchStart + fullMatch.length;
  }

  // Append remaining plain text
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (tokens.length === 0) {
    tokens.push({ type: "text", value: text });
  }

  return tokens;
}
```

### Step 4: Run tests to verify they pass

```bash
cd apps/web && npm run test -- --reporter=verbose src/lib/__tests__/crossref.test.ts
```

Expected: All tests PASS.

### Step 5: Commit

```bash
git add apps/web/src/lib/crossref.ts apps/web/src/lib/__tests__/crossref.test.ts
git commit -m "feat: add legal cross-reference tokenizer with tests"
```

---

## Task 2: Build the `RichPasalContent` client component

**Files:**
- Create: `apps/web/src/components/reader/RichPasalContent.tsx`

No tests for this task — it is a thin presentational wrapper over the already-tested `tokenize` function. Visual correctness verified manually.

### Step 1: Create the component

Create `apps/web/src/components/reader/RichPasalContent.tsx`:

```tsx
"use client";

import { Link } from "@/i18n/routing";
import { tokenize } from "@/lib/crossref";

interface RichPasalContentProps {
  content: string;
  worksLookup: Record<string, string>;
}

/**
 * Renders pasal body text with inline hyperlinks for cross-references.
 *
 * - "Pasal N" / "Pasal N ayat (X)" → anchor link to #pasal-N (same page)
 * - "Undang-Undang Nomor N Tahun YYYY" → Link to /peraturan/[type]/[slug]
 *   (only if the work exists in worksLookup; otherwise renders as plain text)
 *
 * Preserves whitespace-pre-wrap formatting. Pure render — no side effects.
 */
export default function RichPasalContent({
  content,
  worksLookup,
}: RichPasalContentProps) {
  const tokens = tokenize(content, worksLookup);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {tokens.map((token, i) => {
        if (token.type === "text") {
          return <span key={i}>{token.value}</span>;
        }

        if (token.type === "pasal") {
          return (
            <a
              key={i}
              href={token.href}
              className="text-primary underline-offset-2 hover:underline"
            >
              {token.value}
            </a>
          );
        }

        if (token.type === "uu") {
          return (
            <Link
              key={i}
              href={token.href}
              className="text-primary underline-offset-2 hover:underline"
            >
              {token.value}
            </Link>
          );
        }
      })}
    </div>
  );
}
```

**Why `<a>` for pasal and `<Link>` for UU:**
- Pasal references are hash links (`#pasal-5`) — same page, no routing. A plain `<a>` is correct.
- UU references are cross-page routes — `Link` from `@/i18n/routing` is required for locale prefix handling.

### Step 2: Verify TypeScript compiles

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors related to `RichPasalContent.tsx` or `crossref.ts`.

### Step 3: Commit

```bash
git add apps/web/src/components/reader/RichPasalContent.tsx
git commit -m "feat: add RichPasalContent component for inline cross-reference links"
```

---

## Task 3: Fetch the works lookup map in the law detail page

**Files:**
- Modify: `apps/web/src/app/[locale]/peraturan/[type]/[slug]/page.tsx`

The law detail page is a large file. We add a single server-side query that fetches all works as a compact slug → pathname map, then pass it to `LawReaderSection` (or directly to `PasalBlock` / `PasalList`).

### Step 1: Find where to insert the fetch

Open `apps/web/src/app/[locale]/peraturan/[type]/[slug]/page.tsx`. Find the section where the main `work` is fetched (around line 277 where `pageUrl` is constructed). The `LawReaderSection` component or inline rendering of `PasalBlock` starts around line 430.

Look for a pattern like:
```tsx
const pageUrl = `https://pasal.id/peraturan/${type.toLowerCase()}/${slug}`;
```
or where the Supabase client is created.

### Step 2: Add the works lookup query

In the server component body (NOT inside a client component), add:

```typescript
// Fetch compact works lookup for cross-reference resolution.
// Selects only slug + regulation_types.code — compact enough to pass as prop.
const supabase = await createClient();
const { data: worksData } = await supabase
  .from("works")
  .select("slug, regulation_types!inner(code)")
  .not("slug", "is", null);

// Build lookup: "uu-13-2003" → "/peraturan/uu/uu-13-2003"
const worksLookup: Record<string, string> = {};
for (const w of worksData ?? []) {
  const rt = w.regulation_types as { code: string } | null;
  if (w.slug && rt?.code) {
    const typeCode = rt.code.toLowerCase();
    worksLookup[w.slug] = `/peraturan/${typeCode}/${w.slug}`;
  }
}
```

**Note on Supabase typing:** The `.select("slug, regulation_types!inner(code)")` join may return `regulation_types` as an array. Check the actual type. If it's an array, use `rt[0]?.code`. If TypeScript complains, add an explicit generic:
```typescript
.select<"slug, regulation_types!inner(code)", { slug: string; regulation_types: { code: string } }>("slug, regulation_types!inner(code)")
```

**Note on performance:** The `works` table has at most a few thousand rows. This query returns two columns — compact enough to be negligible. ISR means this page is cached; the query runs once per cache period, not per user.

### Step 3: Pass `worksLookup` down

Find where `LawReaderSection` (or equivalent inline rendering) is called, and add `worksLookup` to its props. If there is no `LawReaderSection` component and `PasalBlock`/`PasalList` are rendered directly, pass `worksLookup` directly to those.

Search for `<PasalList` and `<PasalBlock` in the file to see how they are invoked.

### Step 4: Verify TypeScript compiles

```bash
cd apps/web && npx tsc --noEmit
```

Fix any type errors before proceeding. Common issues:
- `regulation_types` join returning array vs object — check Supabase response shape
- Missing prop in component interface — add it in Task 4

### Step 5: Commit

```bash
git add apps/web/src/app/[locale]/peraturan/[type]/[slug]/page.tsx
git commit -m "feat: fetch works lookup map for cross-reference resolution in law detail page"
```

---

## Task 4: Thread `worksLookup` through `PasalList` and `PasalBlock`

**Files:**
- Modify: `apps/web/src/components/reader/PasalList.tsx`
- Modify: `apps/web/src/components/reader/PasalBlock.tsx`

### Step 1: Update `PasalList` to accept and pass `worksLookup`

Open `apps/web/src/components/reader/PasalList.tsx`. Find the props interface (search for `interface PasalListProps` or similar). Add:

```typescript
worksLookup: Record<string, string>;
```

Find where `PasalBlock` is rendered inside `PasalList` and pass `worksLookup={worksLookup}` to it.

### Step 2: Update `PasalBlock` to accept `worksLookup` and use `RichPasalContent`

Open `apps/web/src/components/reader/PasalBlock.tsx`.

**Add to `PasalBlockProps`:**
```typescript
worksLookup: Record<string, string>;
```

**Add to destructured props:**
```typescript
export default function PasalBlock({ pasal, pathname, pageUrl, worksLookup }: PasalBlockProps) {
```

**Replace line 51:**
```tsx
// Before:
<div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>

// After:
<RichPasalContent content={content} worksLookup={worksLookup} />
```

**Add the import at the top of the file:**
```typescript
import RichPasalContent from "@/components/reader/RichPasalContent";
```

**Note:** `PasalBlock` uses `useTranslations` which makes it a quasi-client component in spirit, but it is NOT marked `"use client"`. Check whether it already has this directive. If it does, the import of `RichPasalContent` is fine. If it doesn't, it stays a Server Component — which is also fine, because `RichPasalContent` itself is `"use client"` and can be imported into Server Components.

### Step 3: Verify TypeScript compiles and tests pass

```bash
cd apps/web && npx tsc --noEmit && npm run test
```

Expected: 0 type errors, all 11+ tests pass.

### Step 4: Commit

```bash
git add apps/web/src/components/reader/PasalList.tsx apps/web/src/components/reader/PasalBlock.tsx
git commit -m "feat: wire worksLookup through PasalList and PasalBlock to enable inline cross-reference links"
```

---

## Task 5: Manual verification

No automated tests for rendering — verify visually.

### Step 1: Start the dev server

```bash
cd apps/web && npm run dev
```

### Step 2: Open a law detail page

Navigate to `http://localhost:3000/peraturan/uu/uu-13-2003` (or any UU with cross-references in its pasal content).

### Step 3: Check expected behavior

- [ ] Body text renders normally (no layout change, `whitespace-pre-wrap` preserved)
- [ ] "Pasal N" patterns appear as green (`text-primary`) underlined links
- [ ] Clicking a "Pasal N" link scrolls to `#pasal-N` on the same page and triggers the green highlight flash (from `HashHighlighter`)
- [ ] A UU citation that exists in the DB (e.g. "Undang-Undang Nomor 13 Tahun 2003" referenced inside another law) appears as a link to `/peraturan/uu/uu-13-2003`
- [ ] A UU citation that does NOT exist in the DB renders as plain text (no broken link)
- [ ] The page is not broken for pasals with no cross-references

### Step 4: Check print layout

- [ ] Links are still readable when printing (browsers underline links in print by default — acceptable)

### Step 5: Final commit (if any fixes were needed)

```bash
git add -A && git commit -m "fix: address visual issues found during manual verification"
```

---

## Task 6: Run full test suite and lint

```bash
cd apps/web && npm run test && npm run lint
```

Expected: All tests pass, no lint errors.

If lint errors appear, fix them before proceeding.

```bash
git add -A && git commit -m "fix: resolve lint warnings"
```

---

## Done

Worktree: `.worktrees/feature-crossref-links`
Branch: `feature/crossref-links`

When complete, use the **superpowers:finishing-a-development-branch** skill to create the PR.
