"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { m, AnimatePresence } from "framer-motion";
import { ExternalLink, FileText, X } from "lucide-react";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

interface ReaderLayoutProps {
  toc: React.ReactNode;
  content: React.ReactNode;
  /** Right sidebar content (status, timeline, source) — shown when PDF is off */
  sidebar: React.ReactNode;
  sourcePdfUrl: string | null;
  slug: string;
}

export default function ReaderLayout({
  toc,
  content,
  sidebar,
  sourcePdfUrl,
  slug,
}: ReaderLayoutProps) {
  const [showPdf, setShowPdf] = useState(false);
  const [activePdfPage, setActivePdfPage] = useState(1);

  // Scroll sync: observe which pasal is in view and update PDF page
  useEffect(() => {
    if (!showPdf) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (
              !bestEntry ||
              entry.boundingClientRect.top < bestEntry.boundingClientRect.top
            ) {
              bestEntry = entry;
            }
          }
        }
        if (bestEntry) {
          const page = bestEntry.target.getAttribute("data-pdf-page");
          if (page) {
            setActivePdfPage(parseInt(page, 10));
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    const articles = document.querySelectorAll("article[data-pdf-page]");
    articles.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [showPdf]);

  return (
    <div>
      {/* PDF toggle toolbar — only shown when a source PDF exists */}
      {sourcePdfUrl && (
        <div className="flex items-center justify-end gap-3 mb-6">
          {/* Desktop toggle */}
          <button
            onClick={() => setShowPdf(!showPdf)}
            className={`hidden lg:inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              showPdf
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:border-primary/30"
            }`}
          >
            <FileText className="h-4 w-4" />
            {showPdf ? "Sembunyikan PDF" : "Tampilkan PDF"}
          </button>

          {/* Mobile: link to original PDF */}
          <a
            href={sourcePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lg:hidden inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium bg-card hover:border-primary/30 transition-colors whitespace-nowrap"
          >
            <FileText className="h-4 w-4" />
            Buka PDF Asli
          </a>
        </div>
      )}

      {/* 3-column grid: TOC | content | sidebar/PDF */}
      <div
        className={`grid grid-cols-1 gap-8 transition-[grid-template-columns] duration-300 ease-in-out ${
          showPdf
            ? "lg:grid-cols-[220px_1fr_1fr]"
            : "lg:grid-cols-[220px_1fr_280px]"
        }`}
      >
        <aside>{toc}</aside>

        <main className="min-w-0">{content}</main>

        {/* Right column: context sidebar OR PDF */}
        <AnimatePresence mode="wait" initial={false}>
          {showPdf ? (
            <m.aside
              key="pdf-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-2">
                {sourcePdfUrl ? (
                  <a
                    href={sourcePdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-heading text-primary hover:text-primary/80 inline-flex items-center gap-1"
                  >
                    PDF Sumber
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm font-heading">PDF Sumber</span>
                )}
                <button
                  onClick={() => setShowPdf(false)}
                  aria-label="Tutup panel PDF"
                  className="rounded-lg border p-1 hover:border-primary/30 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <PdfViewer
                slug={slug}
                sourcePdfUrl={sourcePdfUrl}
                page={activePdfPage}
                onPageChange={setActivePdfPage}
              />
            </m.aside>
          ) : (
            <m.aside
              key="sidebar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto"
            >
              {sidebar}
            </m.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
