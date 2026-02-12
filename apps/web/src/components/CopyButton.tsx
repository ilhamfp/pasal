"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs h-7"
      onClick={handleCopy}
    >
      {copied ? "Tersalin!" : label}
    </Button>
  );
}
