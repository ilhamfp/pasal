"use client";

import { useState } from "react";
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

  return (
    <div>
      {/* Toolbar with PDF toggle + context widgets (compact bar) */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Context widgets as compact inline items */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {contextWidgets}
        </div>

        {/* PDF toggle button — desktop only */}
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

      {/* Main grid */}
      <div
        className={`grid grid-cols-1 gap-8 ${
          showPdf
            ? "lg:grid-cols-[220px_1fr_1fr]"
            : "lg:grid-cols-[220px_1fr]"
        }`}
      >
        {/* TOC sidebar */}
        <aside>{toc}</aside>

        {/* Main content */}
        <main className="min-w-0">{content}</main>

        {/* PDF panel — only when toggled on */}
        {showPdf && (
          <aside className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
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
            />
          </aside>
        )}
      </div>
    </div>
  );
}
