"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export default function SectionLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 sm:p-1 rounded text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring no-print"
      aria-label="Salin link bagian ini"
    >
      <span aria-live="polite">
        {copied ? (
          <Check aria-hidden="true" className="h-4 w-4 text-primary" />
        ) : (
          <Link2 aria-hidden="true" className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}
