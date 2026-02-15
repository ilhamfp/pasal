"use client";

import { motion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import { parseInlineLinks } from "@/lib/mcp-demo/parse-links";
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
              <p key={i}>{parseInlineLinks(paragraph)}</p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
