"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ExternalLink } from "lucide-react";

interface PdfSidePanelProps {
  slug: string;
  supabaseUrl: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  sourcePdfUrl?: string | null;
  maxPage?: number | null;
}

export default function PdfSidePanel({
  slug,
  supabaseUrl,
  currentPage,
  onPageChange,
  sourcePdfUrl,
  maxPage,
}: PdfSidePanelProps) {
  const [hasError, setHasError] = useState(false);

  const imageUrl = `${supabaseUrl}/storage/v1/object/public/regulation-pdfs/${slug}/page-${currentPage}.png`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none flex items-center justify-between px-3 py-2 border-b bg-secondary/30">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          PDF Sumber
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded border p-1 hover:border-primary/30 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs tabular-nums min-w-[3rem] text-center">
            Hal. {currentPage}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={maxPage != null && currentPage >= maxPage}
            className="rounded border p-1 hover:border-primary/30 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center bg-secondary/10">
        {hasError ? (
          <div className="text-center p-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-xs mb-2">Halaman PDF tidak tersedia.</p>
            {sourcePdfUrl && (
              <a
                href={sourcePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                <ExternalLink className="h-3 w-3" />
                Buka PDF asli
              </a>
            )}
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`Halaman ${currentPage}`}
            className="w-full h-auto"
            onError={() => setHasError(true)}
            onLoad={() => setHasError(false)}
          />
        )}
      </div>
    </div>
  );
}
