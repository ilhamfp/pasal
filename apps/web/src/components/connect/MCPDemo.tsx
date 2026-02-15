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
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex-1 text-center">
            <span className="font-mono text-xs text-muted-foreground">
              Claude — Pasal.id MCP
            </span>
          </div>
          {state.isPlaying && (
            <span className="h-2 w-2 rounded-full bg-status-berlaku animate-pulse" />
          )}
        </div>

        {/* Chat area */}
        <div
          ref={scrollRef}
          className="h-[360px] sm:h-[420px] overflow-y-auto px-4 py-4 space-y-3 bg-background"
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
