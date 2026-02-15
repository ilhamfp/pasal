"use client";

import { useMemo } from "react";
import { stripLinkSyntax, parseInlineLinks } from "@/lib/mcp-demo/parse-links";

type Props = {
  text: string;
  revealedWords: number;
  className?: string;
};

export default function DemoTypingEffect({ text, revealedWords, className }: Props) {
  const plainText = useMemo(() => stripLinkSyntax(text), [text]);
  const words = useMemo(() => plainText.split(/\s+/), [plainText]);
  const isComplete = revealedWords >= words.length;

  return (
    <span className={className}>
      {isComplete ? (
        /* Fully revealed — render with clickable links */
        parseInlineLinks(text)
      ) : (
        <>
          {words.slice(0, revealedWords).join(" ")}
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary" />
        </>
      )}
    </span>
  );
}
