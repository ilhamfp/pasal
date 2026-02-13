"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X } from "lucide-react";
import PdfViewer from "./PdfViewer";

interface ReaderLayoutProps {
  toc: React.ReactNode;
  content: React.ReactNode;
  contextWidgets: React.ReactNode;
  sourcePdfUrl: string | null;
  slug: string;
  supabaseUrl: string;
}

export default function ReaderLayout({
  toc,
  content,
  contextWidgets,
  sourcePdfUrl,
  slug,
  supabaseUrl,
}: ReaderLayoutProps) {
  const [showPdf, setShowPdf] = useState(false);
  const [activePdfPage, setActivePdfPage] = useState(1);
  const mainRef = useRef<HTMLElement>(null);

  // Scroll sync: observe which pasal is in view and update PDF page
  useEffect(() => {
    if (!showPdf) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible pasal with a page mapping
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

    // Observe all pasal articles with data-pdf-page
    const articles = document.querySelectorAll("article[data-pdf-page]");
    articles.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [showPdf]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {contextWidgets}
        </div>

        {/* PDF toggle — desktop only */}
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
        {sourcePdfUrl && (
          <a
            href={sourcePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lg:hidden inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium bg-card hover:border-primary/30 transition-colors whitespace-nowrap"
          >
            <FileText className="h-4 w-4" />
            Buka PDF Asli
          </a>
        )}
      </div>

      {/* Main grid — animate between 2-col and 3-col */}
      <div
        className={`grid grid-cols-1 gap-8 transition-[grid-template-columns] duration-300 ease-in-out ${
          showPdf
            ? "lg:grid-cols-[220px_1fr_1fr]"
            : "lg:grid-cols-[220px_1fr]"
        }`}
      >
        {/* TOC sidebar */}
        <aside>{toc}</aside>

        {/* Main content */}
        <main ref={mainRef} className="min-w-0">
          {content}
        </main>

        {/* PDF panel with framer-motion enter/exit */}
        <AnimatePresence mode="popLayout">
          {showPdf && (
            <motion.aside
              key="pdf-panel"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-heading">PDF Sumber</span>
                <button
                  onClick={() => setShowPdf(false)}
                  className="rounded-lg border p-1 hover:border-primary/30 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <PdfViewer
                slug={slug}
                supabaseUrl={supabaseUrl}
                sourcePdfUrl={sourcePdfUrl}
                page={activePdfPage}
                onPageChange={setActivePdfPage}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
