"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";

interface PdfViewerProps {
  slug: string;
  sourcePdfUrl?: string | null;
  page: number;
  onPageChange: (page: number) => void;
}

export default function PdfViewer({ slug, sourcePdfUrl, page, onPageChange }: PdfViewerProps) {
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
            className="rounded-lg border p-1.5 hover:border-primary/30 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={hasError}
            aria-label="Halaman berikutnya"
            className="rounded-lg border p-1.5 hover:border-primary/30 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {sourcePdfUrl && (
            <a
              href={sourcePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary/80 ml-2 inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              PDF Asli
            </a>
          )}
        </div>
      </div>

      <div className="relative min-h-[400px] flex items-center justify-center">
        {hasError ? (
          <div className="text-center p-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm mb-2">Halaman PDF tidak tersedia.</p>
            {sourcePdfUrl && (
              <a
                href={sourcePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80"
              >
                Buka PDF asli
              </a>
            )}
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`Halaman ${page}`}
            className="w-full h-auto"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </div>
  );
}
