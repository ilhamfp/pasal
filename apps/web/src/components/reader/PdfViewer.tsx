"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";

interface PdfViewerProps {
  slug: string;
  sourcePdfUrl?: string | null;
  page: number;
  onPageChange: (page: number) => void;
}

export default function PdfViewer({ slug, sourcePdfUrl: rawPdfUrl, page, onPageChange }: PdfViewerProps) {
  const sourcePdfUrl = rawPdfUrl?.startsWith("https://") ? rawPdfUrl : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [page]);

  const imageUrl = `${supabaseUrl}/storage/v1/object/public/regulation-pdfs/${slug}/page-${page}.png`;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium tabular-nums">
          Halaman {page}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
            className="rounded-lg border p-1.5 hover:border-primary/30 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={hasError}
            aria-label="Halaman berikutnya"
            className="rounded-lg border p-1.5 hover:border-primary/30 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {sourcePdfUrl && (
            <a
              href={sourcePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary/80 ml-2 inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              PDF Asli
            </a>
          )}
        </div>
      </div>

      <div className="relative min-h-[400px] flex items-center justify-center">
        {hasError ? (
          <div className="text-center p-4 sm:p-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" aria-hidden="true" />
            <p className="text-sm mb-2">Pratinjau halaman tidak tersedia.</p>
            {sourcePdfUrl && (
              <a
                href={sourcePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Buka PDF Asli
              </a>
            )}
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`Halaman ${page}`}
            width={800}
            height={1132}
            className="w-full h-auto"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </div>
  );
}
