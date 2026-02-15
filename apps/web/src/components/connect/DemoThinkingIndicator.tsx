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
