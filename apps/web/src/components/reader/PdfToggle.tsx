"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import PdfViewer from "./PdfViewer";

interface PdfToggleProps {
  slug: string;
  supabaseUrl: string;
  sourcePdfUrl?: string | null;
  children: React.ReactNode;
}

export default function PdfToggle({ slug, supabaseUrl, sourcePdfUrl, children }: PdfToggleProps) {
  const [showPdf, setShowPdf] = useState(false);

  return (
    <aside className="hidden lg:block space-y-6">
      <button
        onClick={() => setShowPdf(!showPdf)}
        className={`w-full flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
          showPdf
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card hover:border-primary/30"
        }`}
      >
        <FileText className="h-4 w-4" />
        {showPdf ? "Sembunyikan PDF" : "Tampilkan PDF"}
      </button>

      {showPdf ? (
        <PdfViewer
          slug={slug}
          supabaseUrl={supabaseUrl}
          sourcePdfUrl={sourcePdfUrl}
        />
      ) : (
        children
      )}
    </aside>
  );
}
