"use client";

import { useState } from "react";
import { Quote, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TYPE_LABELS } from "@/lib/legal-status";

interface CitationButtonProps {
  type: string;
  number: string;
  year: number;
  title: string;
  url: string;
}

export default function CitationButton({ type, number, year, title, url }: CitationButtonProps) {
  const [copied, setCopied] = useState(false);

  const formalType = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  const citation = `${formalType} Nomor ${number} Tahun ${year} tentang ${title}\nTersedia di: ${url}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs h-7">
          <Quote aria-hidden="true" className="h-3 w-3" />
          Kutip
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-xs font-medium mb-2">Kutipan</p>
        <div className="rounded border bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-wrap mb-3">
          {citation}
        </div>
        <Button size="sm" className="w-full text-xs h-7" onClick={handleCopy}>
          <span aria-live="polite" className="flex items-center gap-1">
            {copied ? (
              <>
                <Check aria-hidden="true" className="h-3 w-3" />
                Tersalin!
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="h-3 w-3" />
                Salin Kutipan
              </>
            )}
          </span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
