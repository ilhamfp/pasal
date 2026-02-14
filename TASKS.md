# TASKS — Connect Page: Animated MCP Demo

> **Objective:** Build an auto-playing animated demo on `/connect` that shows Claude using Pasal.id's four MCP tools to answer a real Indonesian legal question. The animation plays when scrolled into view, loops infinitely, and respects `prefers-reduced-motion`.
>
> **Time estimate:** 4–6 hours for a junior developer following this guide.
>
> **Priority:** HIGH — this is the centerpiece of our hackathon demo (30% of score).

---

## Before You Begin

**Read these files first. Do not skip this.**

| File | Why |
|------|-----|
| `BRAND_GUIDELINES.md` | Colors, typography, spacing, component patterns — every visual decision |
| `CLAUDE.md` | Coding conventions, project structure, domain terminology |
| `apps/web/src/lib/motion.ts` | Existing Framer Motion constants (`EASE_OUT`, `fadeUp`) — reuse these |
| `apps/web/src/app/connect/page.tsx` | The current connect page — you'll add the demo here |
| `apps/mcp-server/server.py` | The actual MCP server — understand what each tool does |

**Key brand rules that apply to this task:**

- Background: `bg-background` (#F8F5F0 warm stone), never pure white for page surfaces
- Cards: `bg-card` (#FFFFFF) to create lift off the stone background
- Borders: `border` (neutral-200 #DDD6D1), no shadows except popovers
- Headings: `font-heading` (Instrument Serif), weight 400 only
- Body/UI: `font-sans` (Instrument Sans)
- Code: `font-mono` (JetBrains Mono)
- Accent: `text-primary` / `bg-primary` (verdigris #2B6150) — the ONE interactive color
- Radius: `rounded-lg` (8px)
- Animation: fade + translate only, duration 200–400ms, ease-out. No bouncy physics.
- Legal status colors: Berlaku → green, Diubah → amber, Dicabut → red (see §2.5 of brand guide)

---

## Architecture Overview

```
apps/web/src/
├── lib/
│   └── mcp-demo/
│       ├── script.ts            ← Task 1: Animation script data
│       ├── types.ts             ← Task 1: TypeScript types
│       └── use-animation.ts     ← Task 2: Animation orchestration hook
├── components/
│   └── connect/
│       ├── MCPDemo.tsx          ← Task 4: Main demo container
│       ├── DemoChatMessage.tsx  ← Task 3: User/assistant chat bubbles
│       ├── DemoToolCall.tsx     ← Task 3: Collapsible tool call card
│       └── DemoTypingEffect.tsx ← Task 3: Streaming text component
└── app/
    └── connect/
        └── page.tsx             ← Task 5: Integration point
```

**Why this structure:**
- `lib/mcp-demo/` — data and hooks are logic, not UI. They belong in `lib/`.
- `components/connect/` — demo components are page-specific, not shared. Namespace them.
- Separate files per component — a junior dev can work on one piece at a time without merge conflicts.
- Types in their own file — imported by both `lib/` and `components/`.

---

<a id="task-1"></a>
## Task 1 — Define types and animation script data

**WHY:** The entire animation is data-driven. A typed script array defines every step — what appears, in what order, with what timing. Separating data from rendering means you can tweak the demo story without touching any component code.

**FILES TO CREATE:**

### 1a. `apps/web/src/lib/mcp-demo/types.ts`

```typescript
/** A single step in the MCP demo animation sequence. */
export type DemoStep =
  | { type: "user"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool-call"; name: string; input: Record<string, unknown> }
  | { type: "tool-result"; name: string; data: Record<string, unknown> }
  | { type: "assistant"; text: string }
  | { type: "pause"; duration: number };

/** Timing configuration (milliseconds). */
export type DemoTiming = {
  /** Delay before each character when showing user typing. */
  userTypingSpeed: number;
  /** Delay before each word when streaming assistant response. */
  assistantWordSpeed: number;
  /** How long the "thinking" indicator shows before first tool call. */
  thinkingDuration: number;
  /** How long to show each tool call before expanding its result. */
  toolCallDuration: number;
  /** How long tool results stay visible before next step. */
  toolResultDuration: number;
  /** Pause after the full sequence before restarting. */
  restartDelay: number;
};

export const DEFAULT_TIMING: DemoTiming = {
  userTypingSpeed: 35,
  assistantWordSpeed: 30,
  thinkingDuration: 1500,
  toolCallDuration: 800,
  toolResultDuration: 1800,
  restartDelay: 4000,
};
```

### 1b. `apps/web/src/lib/mcp-demo/script.ts`

This is the heart of the demo — the exact story it tells. The script must showcase all 4 MCP tools in the recommended workflow order: `search_laws` → `get_pasal` → `get_law_status` → `list_laws`.

**The scenario:** A user working on a legal case asks about worker contract rights. Claude uses all four tools to build a grounded, cited answer.

```typescript
import type { DemoStep } from "./types";

export const DEMO_SCRIPT: DemoStep[] = [
  // ── Act 1: The Question ──────────────────────────────────
  {
    type: "user",
    text: "Apa hak pekerja kontrak yang sudah bekerja 8 tahun menurut hukum Indonesia?",
  },

  // ── Act 2: Claude Thinks & Searches ──────────────────────
  {
    type: "thinking",
    text: "Mencari ketentuan hukum ketenagakerjaan Indonesia...",
  },

  // Tool 1: search_laws — find relevant provisions
  {
    type: "tool-call",
    name: "search_laws",
    input: { query: "hak pekerja kontrak", regulation_type: "UU" },
  },
  {
    type: "tool-result",
    name: "search_laws",
    data: {
      results: [
        {
          law_title: "Ketenagakerjaan",
          regulation_type: "UU",
          number: "13",
          year: 2003,
          pasal_number: "59",
          snippet:
            "...perjanjian kerja waktu tertentu paling lama 2 tahun dan hanya boleh diperpanjang 1 kali...",
          status: "diubah",
        },
        {
          law_title: "Cipta Kerja",
          regulation_type: "UU",
          number: "6",
          year: 2023,
          pasal_number: "81",
          snippet:
            "...mengubah ketentuan Pasal 59 UU Ketenagakerjaan...",
          status: "berlaku",
        },
      ],
    },
  },

  // Tool 2: get_pasal — exact article text
  {
    type: "tool-call",
    name: "get_pasal",
    input: {
      law_type: "UU",
      law_number: "13",
      year: 2003,
      pasal_number: "59",
    },
  },
  {
    type: "tool-result",
    name: "get_pasal",
    data: {
      law_title: "Ketenagakerjaan",
      pasal_number: "59",
      chapter_info: "BAB IX - Hubungan Kerja",
      content:
        "Perjanjian kerja untuk waktu tertentu hanya dapat dibuat untuk pekerjaan tertentu yang menurut jenis dan sifat atau kegiatan pekerjaannya akan selesai dalam waktu tertentu.",
      ayat: [
        "(1) Perjanjian kerja waktu tertentu didasarkan atas jangka waktu paling lama 2 tahun.",
        "(2) Dapat diperpanjang atau diperbaharui untuk jangka waktu paling lama 1 tahun.",
      ],
      status: "diubah",
    },
  },

  // Tool 3: get_law_status — verify the law is current
  {
    type: "tool-call",
    name: "get_law_status",
    input: { law_type: "UU", law_number: "13", year: 2003 },
  },
  {
    type: "tool-result",
    name: "get_law_status",
    data: {
      status: "diubah",
      status_explanation:
        "Sebagian ketentuan telah diubah. Pasal yang tidak diubah tetap berlaku.",
      amendments: [
        {
          relationship: "Diubah oleh",
          law: "UU 6/2023",
          full_title: "Penetapan Perpu 2/2022 tentang Cipta Kerja menjadi UU",
        },
      ],
    },
  },

  // Tool 4: list_laws — show browsing capability
  {
    type: "tool-call",
    name: "list_laws",
    input: { regulation_type: "UU", search: "ketenagakerjaan", page: 1 },
  },
  {
    type: "tool-result",
    name: "list_laws",
    data: {
      total: 3,
      laws: [
        { title: "UU 13/2003 Ketenagakerjaan", status: "diubah" },
        { title: "UU 6/2023 Cipta Kerja", status: "berlaku" },
        { title: "UU 11/2020 Cipta Kerja (dicabut)", status: "dicabut" },
      ],
    },
  },

  // ── Act 3: The Answer ────────────────────────────────────
  {
    type: "assistant",
    text: 'Berdasarkan Pasal 59 UU No. 13 Tahun 2003, perjanjian kerja waktu tertentu (PKWT) hanya dapat dibuat untuk jangka waktu paling lama 2 tahun dan diperpanjang 1 kali paling lama 1 tahun.\n\nKarena pekerja ini telah bekerja selama 8 tahun, kontrak tersebut melanggar batas waktu PKWT. Menurut Pasal 59 ayat (7), PKWT yang melebihi ketentuan "demi hukum menjadi perjanjian kerja waktu tidak tertentu" — artinya pekerja tersebut secara hukum berstatus sebagai pekerja tetap.\n\n⚠️ Catatan: UU 13/2003 telah diubah oleh UU 6/2023 (Cipta Kerja). Ketentuan terbaru mengubah sebagian aturan PKWT, namun prinsip perlindungan pekerja kontrak tetap berlaku.',
  },

  // ── Loop gap ─────────────────────────────────────────────
  { type: "pause", duration: 4000 },
];

/**
 * Tool metadata for rendering icons and labels.
 * Maps tool names to their visual treatment in the demo.
 */
export const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  search_laws:    { icon: "🔍", label: "Mencari hukum",       color: "text-primary" },
  get_pasal:      { icon: "📄", label: "Membaca pasal",       color: "text-primary" },
  get_law_status: { icon: "⚖️",  label: "Memeriksa status",   color: "text-primary" },
  list_laws:      { icon: "📋", label: "Menelusuri peraturan", color: "text-primary" },
};
```

**WHY THIS SCRIPT:**
- **Realistic scenario** — a contract worker who has exceeded the legal PKWT limit. This is a real, common legal issue in Indonesia.
- **All 4 tools used** — follows the exact workflow from our MCP server's `instructions` field.
- **Amendment chain shown** — UU 13/2003 → UU 6/2023, demonstrating `get_law_status` value.
- **`list_laws` shows discovery** — reveals there's also a revoked UU 11/2020, showing the law evolved.
- **The answer cites precisely** — "Pasal 59 UU No. 13 Tahun 2003" matches our citation format rule.
- **All text in Bahasa Indonesia** — brand requirement.

### ✅ Verification Checklist — Task 1

Before proceeding to Task 2, verify ALL of the following:

- [ ] File `apps/web/src/lib/mcp-demo/types.ts` exists and exports `DemoStep`, `DemoTiming`, `DEFAULT_TIMING`.
- [ ] File `apps/web/src/lib/mcp-demo/script.ts` exists and exports `DEMO_SCRIPT`, `TOOL_META`.
- [ ] Run `cd apps/web && npx tsc --noEmit` — zero type errors.
- [ ] `DEMO_SCRIPT` contains exactly **12 steps**: 1 user + 1 thinking + 4 tool-calls + 4 tool-results + 1 assistant + 1 pause.
- [ ] Count them manually now: user(1) + thinking(1) + tool-call(1) + tool-result(1) + tool-call(2) + tool-result(2) + tool-call(3) + tool-result(3) + tool-call(4) + tool-result(4) + assistant(1) + pause(1) = 12. ✓
- [ ] Every `tool-call` has a matching `tool-result` immediately after it with the same `name`.
- [ ] All tool names are exactly: `search_laws`, `get_pasal`, `get_law_status`, `list_laws` (match `server.py`).
- [ ] All user-facing text is in Bahasa Indonesia.
- [ ] `TOOL_META` has entries for all 4 tool names.
- [ ] No hardcoded hex colors in the script file — only Tailwind class names (like `"text-primary"`).

---

<a id="task-2"></a>
## Task 2 — Build the animation orchestration hook

**WHY:** The animation engine must be decoupled from the UI. A custom hook manages the state machine: which step we're on, whether text is still "typing", and when to advance. This lets us unit-test the logic independently and swap out the rendering later.

**FILE TO CREATE:** `apps/web/src/lib/mcp-demo/use-animation.ts`

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DemoStep, DemoTiming } from "./types";
import { DEFAULT_TIMING } from "./types";

export type AnimationState = {
  /** Steps that are currently visible (accumulated, not replaced). */
  visibleSteps: DemoStep[];
  /** Index of the step currently being "typed" or animated. */
  activeIndex: number;
  /** For typing effects: how much of the current text to show (word count). */
  revealedWords: number;
  /** Total word count of the current text step (for progress calculation). */
  totalWords: number;
  /** Whether the animation is currently running. */
  isPlaying: boolean;
};

/**
 * Orchestrates the MCP demo animation sequence.
 *
 * Usage:
 * ```tsx
 * const { state, start, reset } = useAnimation(DEMO_SCRIPT);
 * ```
 *
 * The hook accumulates visible steps over time, advancing through
 * the script with appropriate delays for each step type. Text steps
 * ("user" and "assistant") reveal word-by-word.
 */
export function useAnimation(
  script: DemoStep[],
  timing: DemoTiming = DEFAULT_TIMING,
) {
  const [state, setState] = useState<AnimationState>({
    visibleSteps: [],
    activeIndex: -1,
    revealedWords: 0,
    totalWords: 0,
    isPlaying: false,
  });

  // Refs to avoid stale closures in timeouts
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const indexRef = useRef(-1);
  const isPlayingRef = useRef(false);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  /**
   * Get the total duration (ms) to display a step before moving on.
   * Text steps use word count × speed; other steps use fixed durations.
   */
  const getStepDuration = useCallback(
    (step: DemoStep): number => {
      switch (step.type) {
        case "user":
          return step.text.length * timing.userTypingSpeed + 600;
        case "assistant":
          return step.text.split(/\s+/).length * timing.assistantWordSpeed + 1200;
        case "thinking":
          return timing.thinkingDuration;
        case "tool-call":
          return timing.toolCallDuration;
        case "tool-result":
          return timing.toolResultDuration;
        case "pause":
          return step.duration;
      }
    },
    [timing],
  );

  /**
   * Advance to the next step in the script.
   * Called recursively via setTimeout to create the animation loop.
   */
  const advanceStep = useCallback(() => {
    if (!isPlayingRef.current) return;

    const nextIndex = indexRef.current + 1;

    // Loop: restart from beginning
    if (nextIndex >= script.length) {
      setState((s) => ({ ...s, visibleSteps: [], activeIndex: -1 }));
      indexRef.current = -1;
      timeoutRef.current = setTimeout(advanceStep, 300);
      return;
    }

    indexRef.current = nextIndex;
    const step = script[nextIndex];

    // Calculate word count for text steps
    const words =
      step.type === "user" || step.type === "assistant" || step.type === "thinking"
        ? step.text.split(/\s+/)
        : [];

    setState((s) => ({
      ...s,
      visibleSteps: [...s.visibleSteps, step],
      activeIndex: nextIndex,
      revealedWords: 0,
      totalWords: words.length,
    }));

    // For text steps, animate word-by-word reveal
    if (words.length > 0) {
      const speed =
        step.type === "user" ? timing.userTypingSpeed * 4 : timing.assistantWordSpeed;
      let wordIndex = 0;

      const revealNextWord = () => {
        if (!isPlayingRef.current) return;
        wordIndex++;
        setState((s) => ({ ...s, revealedWords: wordIndex }));
        if (wordIndex < words.length) {
          timeoutRef.current = setTimeout(revealNextWord, speed);
        } else {
          // All words revealed — wait, then advance
          timeoutRef.current = setTimeout(advanceStep, step.type === "user" ? 600 : 1200);
        }
      };
      timeoutRef.current = setTimeout(revealNextWord, speed);
    } else {
      // Non-text step — wait fixed duration, then advance
      timeoutRef.current = setTimeout(advanceStep, getStepDuration(step));
    }
  }, [script, timing, getStepDuration]);

  const start = useCallback(() => {
    clearPending();
    isPlayingRef.current = true;
    indexRef.current = -1;
    setState({
      visibleSteps: [],
      activeIndex: -1,
      revealedWords: 0,
      totalWords: 0,
      isPlaying: true,
    });
    timeoutRef.current = setTimeout(advanceStep, 500);
  }, [advanceStep, clearPending]);

  const stop = useCallback(() => {
    clearPending();
    isPlayingRef.current = false;
    setState((s) => ({ ...s, isPlaying: false }));
  }, [clearPending]);

  const reset = useCallback(() => {
    stop();
    setState({
      visibleSteps: [],
      activeIndex: -1,
      revealedWords: 0,
      totalWords: 0,
      isPlaying: false,
    });
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => clearPending, [clearPending]);

  return { state, start, stop, reset };
}
```

**Design decisions explained:**
- **Accumulated steps** (`visibleSteps` grows, not replaces) — the chat scrolls down like a real conversation.
- **Word-by-word reveal** — more realistic than character-by-character for an AI response. User typing uses `userTypingSpeed × 4` per word (simulating character-level speed grouped by words).
- **Ref-based index tracking** — avoids stale closure issues with nested `setTimeout` chains.
- **`pause` step type** — the restart gap is part of the data, not hardcoded in the hook.

### ✅ Verification Checklist — Task 2

- [ ] File `apps/web/src/lib/mcp-demo/use-animation.ts` exists.
- [ ] Has `"use client"` directive at the top (this is a hook that uses `useState`/`useEffect`).
- [ ] Exports `useAnimation` function and `AnimationState` type.
- [ ] Run `cd apps/web && npx tsc --noEmit` — zero type errors.
- [ ] The hook imports from `./types` only (no component imports in `lib/`).
- [ ] `start()` resets state before beginning (prevents stacking if called twice).
- [ ] `stop()` calls `clearPending()` to prevent orphaned timeouts.
- [ ] Cleanup effect exists: `useEffect(() => clearPending, [clearPending])`.
- [ ] No Framer Motion imports in this file — this is pure React state logic.
- [ ] No hardcoded timing values — everything comes from `DemoTiming` parameter.

---

<a id="task-3"></a>
## Task 3 — Build the rendering sub-components

**WHY:** Each visual element in the demo (user message, tool call card, assistant response) has distinct visual treatment. Separate components keep each one simple and testable.

### 3a. `apps/web/src/components/connect/DemoTypingEffect.tsx`

A component that reveals text word-by-word, driven by the parent's `revealedWords` count.

```typescript
"use client";

import { useMemo } from "react";

type Props = {
  text: string;
  revealedWords: number;
  className?: string;
};

export default function DemoTypingEffect({ text, revealedWords, className }: Props) {
  const words = useMemo(() => text.split(/\s+/), [text]);
  const isComplete = revealedWords >= words.length;

  return (
    <span className={className}>
      {words.slice(0, revealedWords).join(" ")}
      {!isComplete && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary" />
      )}
    </span>
  );
}
```

**Notes:**
- The cursor is a simple `bg-primary` bar that uses Tailwind's built-in `animate-pulse`.
- No internal state — fully controlled by parent via `revealedWords` prop.
- `useMemo` on the split avoids re-splitting on every render.

### 3b. `apps/web/src/components/connect/DemoChatMessage.tsx`

Renders a user or assistant message bubble.

```typescript
"use client";

import { motion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import DemoTypingEffect from "./DemoTypingEffect";

type Props = {
  role: "user" | "assistant";
  text: string;
  revealedWords: number;
  isActive: boolean;
};

const enterVariant = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

export default function DemoChatMessage({ role, text, revealedWords, isActive }: Props) {
  const isUser = role === "user";

  return (
    <motion.div
      variants={enterVariant}
      initial="hidden"
      animate="show"
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border"
        }`}
      >
        {isActive ? (
          <DemoTypingEffect
            text={text}
            revealedWords={revealedWords}
            className={isUser ? "" : "text-foreground"}
          />
        ) : (
          /* Render newlines as paragraphs for completed assistant messages */
          <div className="space-y-2">
            {text.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

**Brand compliance:**
- User messages: `bg-primary text-primary-foreground` (verdigris with white text).
- Assistant messages: `bg-card border` (white card with warm graphite border, lifted off stone).
- `rounded-lg` (8px radius — brand default).
- `text-sm leading-relaxed` — readable at demo scale.
- Enter animation: fade + translate 12px, 300ms, ease-out. Restrained per brand guide §9.

### 3c. `apps/web/src/components/connect/DemoToolCall.tsx`

The star of the show — renders a tool invocation with collapsible result.

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { TOOL_META } from "@/lib/mcp-demo/script";

type Props = {
  name: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  showResult: boolean;
};

const enterVariant = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

const expandVariant = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.35, ease: EASE_OUT },
  },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

export default function DemoToolCall({ name, input, result, showResult }: Props) {
  const meta = TOOL_META[name] ?? { icon: "🔧", label: name, color: "text-primary" };

  return (
    <motion.div
      variants={enterVariant}
      initial="hidden"
      animate="show"
      className="rounded-lg border bg-card overflow-hidden"
    >
      {/* Tool call header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/50">
        <span className="text-base" aria-hidden>{meta.icon}</span>
        <code className="font-mono text-xs font-medium text-primary">
          {name}
        </code>
        <span className="text-xs text-muted-foreground">
          {meta.label}
        </span>
        {!showResult && (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="ml-auto text-xs text-muted-foreground"
          >
            memproses...
          </motion.span>
        )}
        {showResult && (
          <span className="ml-auto text-xs text-green-700">✓</span>
        )}
      </div>

      {/* Input parameters — always visible */}
      <div className="px-4 py-2 border-b">
        <pre className="font-mono text-xs text-muted-foreground overflow-x-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>

      {/* Result — expands in */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            key="result"
            variants={expandVariant}
            initial="hidden"
            animate="show"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-muted/30">
              <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                hasil
              </p>
              <pre className="font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

**Key design decisions:**
- The header shows a pulsing "memproses..." (processing) indicator that changes to a green checkmark when the result arrives. This is the visual heartbeat of the demo — judges will see the tool *working*.
- Input params are always visible (developers want to see the exact API call).
- Results expand with a height animation via `AnimatePresence`. The `overflow-hidden` on the parent container ensures the expanding content doesn't flash.
- `max-h-32 overflow-y-auto` on results prevents the demo from growing too tall — large JSON results scroll within their container.
- `bg-muted/50` and `bg-muted/30` — subtle surface differentiation within the card. Uses opacity variants of the existing muted token, not new colors.

### 3d. `apps/web/src/components/connect/DemoThinkingIndicator.tsx`

The "Claude is thinking" animated dots.

```typescript
"use client";

import { motion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

const enterVariant = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

export default function DemoThinkingIndicator({ text }: { text: string }) {
  return (
    <motion.div
      variants={enterVariant}
      initial="hidden"
      animate="show"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <div className="flex gap-1" aria-label="Memproses">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
      <span className="font-sans text-xs italic">{text}</span>
    </motion.div>
  );
}
```

### ✅ Verification Checklist — Task 3

- [ ] All 4 component files exist in `apps/web/src/components/connect/`:
  - [ ] `DemoTypingEffect.tsx`
  - [ ] `DemoChatMessage.tsx`
  - [ ] `DemoToolCall.tsx`
  - [ ] `DemoThinkingIndicator.tsx`
- [ ] Every file has `"use client"` directive (they all use Framer Motion or hooks).
- [ ] Run `cd apps/web && npx tsc --noEmit` — zero type errors.
- [ ] **Brand check — colors:** No hardcoded hex values. Only Tailwind classes using design tokens: `bg-primary`, `text-primary`, `bg-card`, `border`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `text-primary-foreground`.
- [ ] **Brand check — typography:**
  - [ ] Tool names use `font-mono` (JetBrains Mono).
  - [ ] UI labels use `font-sans` (implied default — no need to add the class).
  - [ ] No `font-heading` in these components (headings live in the parent page, not the demo).
- [ ] **Brand check — radius:** All rounded elements use `rounded-lg` (not `rounded-xl` or `rounded-full` except the dots).
- [ ] **Brand check — animation:** No `type: "spring"` with bouncy stiffness. All transitions use `ease: EASE_OUT` from `@/lib/motion`.
- [ ] **Brand check — shadows:** Zero `shadow-*` classes. Depth comes from `border` and `bg-card`.
- [ ] `DemoChatMessage` user bubble is `bg-primary text-primary-foreground`.
- [ ] `DemoChatMessage` assistant bubble is `bg-card border`.
- [ ] `DemoToolCall` shows "memproses..." while loading and "✓" when complete.
- [ ] `DemoToolCall` result section uses `AnimatePresence` for enter/exit animation.
- [ ] `DemoThinkingIndicator` dots use `bg-primary` (verdigris, not arbitrary colors).
- [ ] All user-facing text strings are in Bahasa Indonesia ("memproses...", "hasil").

---

<a id="task-4"></a>
## Task 4 — Build the main MCPDemo container component

**WHY:** This is the main component that assembles everything — the chat panel wrapper, the scroll behavior, the viewport trigger, and the reduced-motion fallback.

**FILE TO CREATE:** `apps/web/src/components/connect/MCPDemo.tsx`

```typescript
"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { DEMO_SCRIPT } from "@/lib/mcp-demo/script";
import { useAnimation } from "@/lib/mcp-demo/use-animation";

import DemoChatMessage from "./DemoChatMessage";
import DemoToolCall from "./DemoToolCall";
import DemoThinkingIndicator from "./DemoThinkingIndicator";

export default function MCPDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: "-100px" });
  const { state, start, stop } = useAnimation(DEMO_SCRIPT);

  // Track reduced-motion preference
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Start/stop based on viewport visibility
  useEffect(() => {
    if (prefersReduced) return;
    if (isInView) {
      start();
    } else {
      stop();
    }
  }, [isInView, prefersReduced, start, stop]);

  // Auto-scroll to bottom as new steps appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [state.visibleSteps.length]);

  // Reduced-motion fallback: show static screenshot
  if (prefersReduced) {
    return (
      <div ref={containerRef} className="rounded-lg border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">
          Demo animasi tidak ditampilkan karena preferensi gerakan dikurangi.
          Lihat contoh penggunaan MCP di bagian{" "}
          <a href="#coba-sekarang" className="text-primary font-medium hover:text-primary/80">
            Coba Sekarang
          </a>{" "}
          di bawah.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EASE_OUT }}
    >
      {/* Mock application chrome */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
          </div>
          <div className="flex-1 text-center">
            <span className="font-mono text-xs text-muted-foreground">
              Claude — Pasal.id MCP
            </span>
          </div>
          {state.isPlaying && (
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>

        {/* Chat area */}
        <div
          ref={scrollRef}
          className="h-[420px] overflow-y-auto px-4 py-4 space-y-3 bg-background"
        >
          {state.visibleSteps.map((step, i) => {
            const isActive = i === state.activeIndex;

            switch (step.type) {
              case "user":
                return (
                  <DemoChatMessage
                    key={`${step.type}-${i}`}
                    role="user"
                    text={step.text}
                    revealedWords={isActive ? state.revealedWords : Infinity}
                    isActive={isActive}
                  />
                );

              case "thinking":
                return <DemoThinkingIndicator key={`${step.type}-${i}`} text={step.text} />;

              case "tool-call": {
                // Check if the next step is this tool's result and is visible
                const nextStep = state.visibleSteps[i + 1];
                const hasResult =
                  nextStep?.type === "tool-result" && nextStep.name === step.name;
                return (
                  <DemoToolCall
                    key={`${step.type}-${step.name}-${i}`}
                    name={step.name}
                    input={step.input}
                    result={hasResult ? nextStep.data : undefined}
                    showResult={hasResult}
                  />
                );
              }

              case "tool-result":
                // Rendered inside DemoToolCall above — skip standalone render
                return null;

              case "assistant":
                return (
                  <DemoChatMessage
                    key={`${step.type}-${i}`}
                    role="assistant"
                    text={step.text}
                    revealedWords={isActive ? state.revealedWords : Infinity}
                    isActive={isActive}
                  />
                );

              case "pause":
                return null;

              default:
                return null;
            }
          })}
        </div>

        {/* Bottom bar — shows what's happening */}
        <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">
            pasal-id MCP v0.3 · 4 tools
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {state.visibleSteps.filter((s) => s.type === "tool-call").length}/4 tool calls
          </span>
        </div>
      </div>
    </motion.div>
  );
}
```

**Design decisions:**
- **Fixed height `h-[420px]`** with `overflow-y-auto` — the chat scrolls internally, keeping the page layout stable. `420px` is tall enough to show 2–3 steps at once without dominating the page.
- **Auto-scroll** — as new steps appear, the container smoothly scrolls to the bottom. This mimics real chat behavior.
- **Viewport trigger** with `once: false` — the animation starts when scrolled into view and stops when scrolled away. This prevents it from playing off-screen (wasting resources) and lets judges re-trigger it by scrolling back up.
- **Mock app chrome** — the three dots + title bar makes this look like a real application window. The green dot pulses when the animation is running.
- **Bottom bar** — shows a live "3/4 tool calls" counter that updates as tools fire. This is a subtle "wow" detail for developers watching.
- **`tool-result` rendering** — results are NOT rendered as standalone items. Instead, each `tool-call` component looks ahead to check if its result is in `visibleSteps` and renders it inline. This creates the "expand in place" effect.
- **Reduced motion fallback** — no animation at all. A polite message directs to the static example prompts section instead. This is both accessible and respectful.

### ✅ Verification Checklist — Task 4

- [ ] File `apps/web/src/components/connect/MCPDemo.tsx` exists.
- [ ] Has `"use client"` directive.
- [ ] Run `cd apps/web && npx tsc --noEmit` — zero type errors.
- [ ] Imports use path aliases (`@/lib/...`, `@/components/...`), not relative paths climbing out of `components/`.
- [ ] `useInView` has `once: false` (animation restarts when scrolled back into view).
- [ ] `scrollRef` auto-scrolls with `behavior: "smooth"`.
- [ ] Chat area background is `bg-background` (warm stone #F8F5F0), not `bg-card`.
- [ ] Card/chrome wrapper is `bg-card` (white) with `border` and `rounded-lg`.
- [ ] No `shadow-*` classes anywhere in this component.
- [ ] `tool-result` case returns `null` (rendered inside `DemoToolCall` instead).
- [ ] `prefersReduced` state is initialized to `false` and updated via `matchMedia`.
- [ ] Reduced-motion fallback renders a meaningful message in Bahasa Indonesia.
- [ ] Cleanup: `removeEventListener` for media query listener.
- [ ] Cleanup: `stop()` called when `isInView` becomes false.
- [ ] The bottom bar tool call counter updates dynamically.
- [ ] Open the browser, scroll the demo into view — does it start? Scroll away — does it stop? Scroll back — does it restart?

**Functional smoke test** (do this before proceeding):
1. Temporarily add `<MCPDemo />` to any page (e.g., a test route).
2. Verify the full sequence plays through all 12 steps.
3. Verify it loops after the pause.
4. Verify the chat area scrolls as new messages appear.
5. Open DevTools → Performance → verify no memory leaks (timeout cleanup on unmount).
6. Test with `prefers-reduced-motion: reduce` in DevTools → Elements → Rendering.
7. Remove the temporary test route.

---

<a id="task-5"></a>
## Task 5 — Integrate into the /connect page

**WHY:** The demo needs to be placed in the right spot on the existing connect page — after the install commands but before the tool descriptions. This creates a narrative: install → see it in action → understand the tools.

**FILE TO EDIT:** `apps/web/src/app/connect/page.tsx`

**WHAT TO CHANGE:**

1. Add this import at the top of the file:

```typescript
import MCPDemo from "@/components/connect/MCPDemo";
```

2. Find the `{/* Cara Kerjanya — How it works */}` section. Add the demo **above** it (after the install cards, before "Cara Kerjanya"):

```tsx
{/* Live MCP Demo */}
<section className="space-y-4">
  <div className="text-center space-y-2">
    <h2 className="font-heading text-2xl tracking-tight">
      Lihat MCP Beraksi
    </h2>
    <p className="text-sm text-muted-foreground max-w-lg mx-auto">
      Demo otomatis: Claude menggunakan 4 tool Pasal.id
      untuk menjawab pertanyaan hukum dengan kutipan akurat.
    </p>
  </div>
  <MCPDemo />
</section>
```

**Placement rationale:**
- After install commands — "you've seen how to install it, now see what it does."
- Before "Cara Kerjanya" — the demo is the *experience*, the flow cards are the *explanation*.
- Before "Tool yang Tersedia" — after watching the demo, tool descriptions will make perfect sense.

### ✅ Verification Checklist — Task 5

- [ ] `MCPDemo` import added to `/connect/page.tsx`.
- [ ] The demo section is placed between the install cards and "Cara Kerjanya".
- [ ] Section heading uses `font-heading` (Instrument Serif) — "Lihat MCP Beraksi".
- [ ] Description text uses default font (Instrument Sans) with `text-muted-foreground`.
- [ ] Run `cd apps/web && npm run build` — build succeeds with zero errors.
- [ ] Run `cd apps/web && npm run dev` — visit `http://localhost:3000/connect`.
- [ ] **Visual check: Page layout**
  - [ ] The demo does not break the page width on desktop (max-width contained).
  - [ ] The demo does not break the page on mobile (test at 375px width).
  - [ ] There is appropriate spacing above and below the demo section.
- [ ] **Visual check: Animation plays**
  - [ ] Scroll down to the demo section — animation begins.
  - [ ] All 12 steps play in sequence.
  - [ ] Tool call cards show "memproses..." then expand with results.
  - [ ] Assistant response streams word-by-word.
  - [ ] Chat area scrolls as new items appear.
  - [ ] After the final pause, animation restarts.
- [ ] **Visual check: Brand compliance**
  - [ ] Background is warm stone, cards are white.
  - [ ] Verdigris accent on tool names, user bubble, cursor, and thinking dots.
  - [ ] No stray colors (no blue, no purple, no generic teal).
  - [ ] No heavy shadows. Borders only.
  - [ ] Typography: monospace for code, sans for labels, serif for section heading.
- [ ] **Accessibility check:**
  - [ ] Enable `prefers-reduced-motion: reduce` in DevTools → Rendering tab.
  - [ ] Verify the demo shows the static fallback message instead of animating.
  - [ ] Disable reduced motion → refresh → demo plays normally.

---

<a id="task-6"></a>
## Task 6 — Polish, responsive design, and final QA

**WHY:** The demo must look polished on all screen sizes and perform well. This is the final pass before the hackathon demo video.

**WHAT TO CHECK AND FIX:**

### 6a. Responsive breakpoints

Test at these widths (use Chrome DevTools device toolbar):

| Width | Expected behavior |
|-------|-------------------|
| 375px (iPhone SE) | Demo takes full width. JSON in tool results wraps. Font size legible. |
| 430px (iPhone 14 Pro Max) | Same as above, slightly more breathing room. |
| 768px (iPad) | Demo comfortably centered. No horizontal scroll in JSON. |
| 1280px+ (Desktop) | Demo constrained to page max-width. Not overly wide. |

**Potential fixes needed:**
- If JSON overflows horizontally: ensure `overflow-x-auto` and `whitespace-pre-wrap` are on the `<pre>` elements.
- If the chat area is too tall on mobile: consider reducing `h-[420px]` to `h-[360px]` on mobile with `h-[360px] sm:h-[420px]`.
- If user message bubble is too wide on mobile: the `max-w-[85%]` should handle this, but verify.

### 6b. Performance

- [ ] Open DevTools → Performance tab → record 30 seconds of the demo playing.
- [ ] Verify: no layout shifts (CLS) during animation.
- [ ] Verify: frame rate stays above 30fps during tool result expansion.
- [ ] Verify: memory does not continuously increase (no timeout leaks).

### 6c. Edge cases

- [ ] Rapid scroll in/out of view (triggers start/stop rapidly) — does it crash?
- [ ] Navigate away from `/connect` and back — does it restart cleanly?
- [ ] Browser tab hidden → unhidden — does it recover?

### 6d. Final git commit

```bash
cd /path/to/pasal
git add apps/web/src/lib/mcp-demo/
git add apps/web/src/components/connect/
git add apps/web/src/app/connect/page.tsx
git commit -m "feat(connect): add animated MCP demo showing all 4 tools

- Data-driven animation sequence with 12 steps
- Shows search_laws → get_pasal → get_law_status → list_laws workflow
- Word-by-word typing effect for user/assistant messages
- Collapsible tool call cards with expand animation
- Auto-scroll, viewport-triggered play/stop, infinite loop
- prefers-reduced-motion fallback
- All text in Bahasa Indonesia"
git push origin main
```

### ✅ Verification Checklist — Task 6

- [ ] Responsive at 375px — no horizontal overflow, text legible, demo usable.
- [ ] Responsive at 768px — comfortable layout, no wasted space.
- [ ] Responsive at 1280px — demo width contained, centered.
- [ ] Performance: no CLS, no memory leaks, smooth animations.
- [ ] Edge case: rapid scroll in/out doesn't crash.
- [ ] Edge case: navigation away and back works.
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` passes (or only pre-existing warnings).
- [ ] All changes committed and pushed to `main`.
- [ ] Visit the deployed Vercel preview — demo works in production.

---

## File Summary

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `lib/mcp-demo/types.ts` | ~35 | TypeScript types and timing defaults |
| `lib/mcp-demo/script.ts` | ~130 | Animation script data and tool metadata |
| `lib/mcp-demo/use-animation.ts` | ~120 | State machine hook for animation orchestration |
| `components/connect/DemoTypingEffect.tsx` | ~25 | Word-by-word text reveal |
| `components/connect/DemoChatMessage.tsx` | ~50 | User/assistant chat bubble |
| `components/connect/DemoToolCall.tsx` | ~85 | Collapsible tool call card |
| `components/connect/DemoThinkingIndicator.tsx` | ~30 | Animated thinking dots |
| `components/connect/MCPDemo.tsx` | ~140 | Main container with viewport trigger |
| **Total new code** | **~615** | |

**Dependencies:** None new. Uses existing `framer-motion` (v12.34.0) already in `package.json`.

---

## Quick Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| TypeScript error on `DemoStep` union | Missing type narrowing | Use `step.type` in switch, TS narrows automatically |
| Animation doesn't start | `useInView` margin too large | Reduce `margin` from `"-100px"` to `"-50px"` |
| Tool results don't show | `tool-result` step not immediately after `tool-call` in script | Check `DEMO_SCRIPT` order — every `tool-call` must be followed by its `tool-result` |
| Animation plays once then stops | `once: true` on `useInView` | Must be `once: false` for restart behavior |
| Memory leak warning | Timeout not cleaned up on unmount | Verify `useEffect(() => clearPending, [clearPending])` exists |
| Hydration mismatch | `prefersReduced` differs server vs client | Initial state is `false` (server), updated in `useEffect` (client) — this is correct |
| JSON overflow on mobile | Missing `whitespace-pre-wrap` | Add to `<pre>` elements in `DemoToolCall` |