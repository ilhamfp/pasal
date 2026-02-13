"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

interface PdfViewerProps {
  slug: string;
  supabaseUrl: string;
  sourcePdfUrl?: string | null;
  totalPages?: number;
  /** Controlled page — parent can drive this via scroll sync */
  page?: number;
  onPageChange?: (page: number) => void;
}

export default function PdfViewer({ slug, supabaseUrl, sourcePdfUrl, totalPages, page, onPageChange }: PdfViewerProps) {
  const [internalPage, setInternalPage] = useState(page || 1);
  const [hasError, setHasError] = useState(false);
  const [useIframe, setUseIframe] = useState(false);

  // Sync with controlled page prop
  useEffect(() => {
    if (page != null && page !== internalPage) {
      setInternalPage(page);
      setHasError(false);
    }
  }, [page]);

  const currentPage = internalPage;
  const maxPages = totalPages || 500;
  const imageUrl = `${supabaseUrl}/storage/v1/object/public/regulation-pdfs/${slug}/page-${currentPage}.png`;

  const goToPage = (p: number) => {
    setInternalPage(p);
    setHasError(false);
    onPageChange?.(p);
  };

  if (useIframe && sourcePdfUrl) {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium">PDF Asli</span>
          <button
            onClick={() => setUseIframe(false)}
            className="text-xs text-primary hover:text-primary/80"
          >
            Tampilkan Halaman
          </button>
        </div>
        <iframe
          src={sourcePdfUrl}
          className="w-full h-[600px]"
          title="PDF Viewer"
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium tabular-nums">
          Halaman {currentPage}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg border p-1.5 hover:border-primary/30 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToPage(Math.min(maxPages, currentPage + 1))}
            disabled={currentPage >= maxPages}
            className="rounded-lg border p-1.5 hover:border-primary/30 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {sourcePdfUrl && (
            <button
              onClick={() => setUseIframe(true)}
              className="text-xs text-primary hover:text-primary/80 ml-2"
            >
              PDF Asli
            </button>
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
