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
            memproses…
          </motion.span>
        )}
        {showResult && (
          <span className="ml-auto text-xs text-status-berlaku" aria-hidden="true">✓</span>
        )}
      </div>

      {/* Input parameters — always visible */}
      <div className="px-4 py-2 border-b">
        <pre className="font-mono text-xs text-muted-foreground overflow-x-auto tabular-nums">
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
              <pre className="font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto tabular-nums">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
