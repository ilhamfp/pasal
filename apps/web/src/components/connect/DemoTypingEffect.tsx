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
