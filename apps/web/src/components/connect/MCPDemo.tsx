"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { EASE_OUT } from "@/lib/motion";
import { DEMO_SCRIPT } from "@/lib/mcp-demo/script";
import { useAnimation } from "@/lib/mcp-demo/use-animation";

import DemoChatMessage from "./DemoChatMessage";
import DemoToolCall from "./DemoToolCall";
import DemoThinkingIndicator from "./DemoThinkingIndicator";

export default function MCPDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: "-100px" });
  const { state, start, pause, resume } = useAnimation(DEMO_SCRIPT);

  /** Whether the user has manually paused the demo. */
  const [userPaused, setUserPaused] = useState(false);
  /** Whether the demo has started at least once (to distinguish initial load from resume). */
  const hasStartedRef = useRef(false);

  // Track reduced-motion preference
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Start/stop based on viewport visibility, respecting user pause
  useEffect(() => {
    if (prefersReduced) return;

    if (isInView) {
      if (userPaused) return; // User explicitly paused — don't auto-resume
      if (hasStartedRef.current) {
        resume();
      } else {
        hasStartedRef.current = true;
        start();
      }
    } else {
      if (!userPaused) {
        pause();
      }
    }
  }, [isInView, prefersReduced, userPaused, start, pause, resume]);

  const togglePause = useCallback(() => {
    if (state.isPlaying) {
      setUserPaused(true);
      pause();
    } else {
      setUserPaused(false);
      resume();
    }
  }, [state.isPlaying, pause, resume]);

  // Auto-scroll as content grows (typing word-wrap, tool result expansion, new steps).
  // A ResizeObserver on the content wrapper fires whenever its height changes,
  // covering all cases without relying on specific state dependencies.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    let rafId: number;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        scrollEl.scrollTo({
          top: scrollEl.scrollHeight,
          behavior: "smooth",
        });
      });
    });

    observer.observe(contentEl);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Reduced-motion fallback: show static screenshot
  if (prefersReduced) {
    return (
      <div ref={containerRef} className="rounded-lg border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">
          Demo animasi tidak ditampilkan karena preferensi gerakan dikurangi.
          Lihat contoh penggunaan MCP di bagian{" "}
          <a href="#coba-sekarang" className="text-primary font-medium hover:text-primary/80 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
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
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex-1 text-center">
            <span className="font-mono text-xs text-muted-foreground">
              Claude · Pasal.id MCP
            </span>
          </div>
          <div className="flex items-center gap-2">
            {state.isPlaying && (
              <span className="h-2 w-2 rounded-full bg-status-berlaku animate-pulse" aria-hidden="true" />
            )}
            <button
              onClick={togglePause}
              className="text-muted-foreground hover:text-primary transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 p-0.5"
              aria-label={state.isPlaying ? "Jeda demo" : "Lanjutkan demo"}
            >
              {state.isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div
          ref={scrollRef}
          className="h-[360px] sm:h-[420px] overflow-y-auto px-4 py-4 bg-background"
        >
          <div ref={contentRef} className="space-y-3">
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
