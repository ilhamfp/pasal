"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
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
      <span aria-live="polite" className="flex items-center gap-1">
        {copied ? (
          <>
            <Check aria-hidden="true" className="h-3 w-3 text-primary animate-in zoom-in-75 duration-150" />
            Tersalin!
          </>
        ) : (
          <>
            <Copy aria-hidden="true" className="h-3 w-3" />
            {label}
          </>
        )}
      </span>
    </Button>
  );
}
