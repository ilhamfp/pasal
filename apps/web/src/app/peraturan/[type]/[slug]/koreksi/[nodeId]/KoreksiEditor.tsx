"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Send,
  AlertCircle,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { computeDiff, diffStats } from "@/components/suggestions/diff-utils";
import { useCorrectionTimer } from "@/components/suggestions/use-correction-timer";

interface KoreksiEditorProps {
  workId: number;
  nodeId: number;
  nodeType: string;
  nodeNumber: string;
  currentContent: string;
  slug: string;
  supabaseUrl: string;
  pdfPageStart: number | null;
  pdfPageEnd: number | null;
  sourcePdfUrl: string | null;
  lawTitle: string;
  lawNumber: string;
  lawYear: number;
  regType: string;
  backHref: string;
}

type ViewMode = "edit" | "diff";

export default function KoreksiEditor({
  workId,
  nodeId,
  nodeType,
  nodeNumber,
  currentContent,
  slug,
  supabaseUrl,
  pdfPageStart,
  pdfPageEnd,
  sourcePdfUrl,
  lawTitle,
  lawNumber,
  lawYear,
  regType,
  backHref,
}: KoreksiEditorProps) {
  const router = useRouter();
  const [suggestedContent, setSuggestedContent] = useState(currentContent);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [pdfPage, setPdfPage] = useState(pdfPageStart || 1);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfError, setPdfError] = useState(false);

  const { trackPageView, getMetadata } = useCorrectionTimer();
  const hasChanges = suggestedContent.trim() !== currentContent.trim();

  const imageUrl = `${supabaseUrl}/storage/v1/object/public/regulation-pdfs/${slug}/page-${pdfPage}.png`;

  useEffect(() => {
    trackPageView(pdfPage);
  }, [pdfPage, trackPageView]);

  // Reset error on page change
  useEffect(() => {
    setPdfError(false);
  }, [pdfPage]);

  const handleSubmit = useCallback(async () => {
    if (!hasChanges) return;
    setStatus("loading");
    setErrorMsg("");

    const ops = computeDiff(currentContent, suggestedContent);
    const stats = diffStats(ops);
    const meta = getMetadata();

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_id: workId,
          node_id: nodeId,
          node_type: nodeType,
          node_number: nodeNumber,
          current_content: currentContent,
          suggested_content: suggestedContent.trim(),
          user_reason: reason.trim() || undefined,
          submitter_email: email.trim() || undefined,
          metadata: {
            ...meta,
            chars_changed: stats.charsInserted + stats.charsDeleted,
          },
        }),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMsg("Terlalu banyak saran. Coba lagi nanti (maks 10/jam).");
        return;
      }

      if (res.status === 409) {
        setStatus("error");
        setErrorMsg("Teks sudah diperbarui oleh pihak lain. Muat ulang halaman untuk melihat versi terbaru.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.error || "Gagal mengirim saran.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Gagal mengirim saran. Periksa koneksi internet.");
    }
  }, [hasChanges, currentContent, suggestedContent, reason, email, workId, nodeId, nodeType, nodeNumber, getMetadata]);

  // Hooks must be called before any early return (Rules of Hooks)
  const diffOps = useMemo(
    () => viewMode === "diff" ? computeDiff(currentContent, suggestedContent) : [],
    [viewMode, currentContent, suggestedContent],
  );
  const stats = useMemo(
    () => viewMode === "diff" ? diffStats(diffOps) : null,
    [viewMode, diffOps],
  );

  if (status === "success") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <Check className="h-16 w-16 mx-auto mb-4 text-primary" />
          <p className="font-heading text-xl mb-2">Saran Terkirim</p>
          <p className="text-sm text-muted-foreground mb-6">
            Terima kasih! Saran Anda akan ditinjau oleh tim admin.
          </p>
          <button
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Peraturan
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex-none border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(backHref)}
            aria-label="Kembali"
            className="rounded-lg p-1.5 hover:bg-secondary flex-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-heading text-base truncate">
              Koreksi Pasal {nodeNumber}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {regType} No. {lawNumber} Tahun {lawYear} — {lawTitle}
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode("edit")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "edit"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            onClick={() => setViewMode("diff")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "diff"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <Eye className="h-3 w-3" />
            Perubahan
          </button>
        </div>
      </div>

      {/* Main body: PDF (dominant) + text panels */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* PDF panel — dominant (60% on desktop) */}
        <div className="lg:w-[55%] xl:w-[60%] flex-none flex flex-col min-h-0 border-r">
          {/* PDF toolbar */}
          <div className="flex-none flex items-center justify-between px-3 py-2 border-b bg-secondary/30">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              PDF Sumber
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPdfZoom(Math.max(50, pdfZoom - 25))}
                disabled={pdfZoom <= 50}
                className="rounded border p-1 hover:border-primary/30 disabled:opacity-30"
                title="Perkecil"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs tabular-nums min-w-[3rem] text-center">
                {pdfZoom}%
              </span>
              <button
                onClick={() => setPdfZoom(Math.min(200, pdfZoom + 25))}
                disabled={pdfZoom >= 200}
                className="rounded border p-1 hover:border-primary/30 disabled:opacity-30"
                title="Perbesar"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={() => { setPdfPage(Math.max(1, pdfPage - 1)); }}
                disabled={pdfPage <= 1}
                aria-label="Halaman sebelumnya"
                className="rounded border p-1 hover:border-primary/30 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs tabular-nums min-w-[3.5rem] text-center">
                Hal. {pdfPage}
              </span>
              <button
                onClick={() => setPdfPage(pdfPage + 1)}
                disabled={pdfError || (pdfPageEnd != null && pdfPage >= pdfPageEnd)}
                aria-label="Halaman berikutnya"
                className="rounded border p-1 hover:border-primary/30 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {sourcePdfUrl && (
                <a
                  href={sourcePdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border p-1 hover:border-primary/30 ml-1"
                  title="Buka PDF asli"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* PDF image with zoom */}
          <div className="flex-1 min-h-0 overflow-auto bg-secondary/10">
            {pdfError ? (
              <div className="flex items-center justify-center h-full text-center p-6 text-muted-foreground">
                <div>
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
              </div>
            ) : (
              <div
                className="origin-top-left"
                style={{ width: `${pdfZoom}%` }}
              >
                <img
                  src={imageUrl}
                  alt={`Halaman ${pdfPage}`}
                  className="w-full h-auto"
                  onError={() => setPdfError(true)}
                  onLoad={() => setPdfError(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Text panels (40% on desktop) */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {viewMode === "edit" ? (
            <>
              {/* Current text */}
              <div className="flex-1 min-h-0 flex flex-col border-b">
                <div className="flex-none px-4 py-2 border-b bg-secondary/30">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Teks Saat Ini
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap bg-secondary/20">
                  {currentContent}
                </div>
              </div>

              {/* Correction textarea */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-none px-4 py-2 border-b bg-secondary/30">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Koreksi Anda
                  </span>
                </div>
                <textarea
                  value={suggestedContent}
                  onChange={(e) => setSuggestedContent(e.target.value)}
                  maxLength={50000}
                  className="flex-1 min-h-0 w-full font-mono text-sm leading-relaxed whitespace-pre-wrap p-4 outline-none resize-none bg-card"
                />
              </div>
            </>
          ) : (
            /* Diff view */
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-none flex items-center justify-between px-4 py-2 border-b bg-secondary/30">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pratinjau Perubahan
                </span>
                {stats && (
                  <span className="text-xs text-muted-foreground">
                    {stats.changes} perubahan &middot; {stats.charsDeleted} dihapus &middot; {stats.charsInserted} ditambahkan
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {diffOps.map((op, i) => {
                  if (op.type === "equal") return <span key={i}>{op.text}</span>;
                  if (op.type === "delete") {
                    return (
                      <span key={i} className="bg-destructive/10 text-destructive line-through">
                        {op.text}
                      </span>
                    );
                  }
                  return (
                    <span key={i} className="bg-status-berlaku-bg text-status-berlaku underline">
                      {op.text}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom submit bar */}
      <div className="flex-none border-t bg-card px-4 py-3">
        {errorMsg && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-2">
            <AlertCircle className="h-4 w-4 flex-none" />
            {errorMsg}
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Alasan koreksi
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-1 outline-none"
              placeholder="Contoh: Typo pada ayat (2), huruf besar salah"
            />
          </div>
          <div className="flex-1 min-w-0 sm:max-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Email (opsional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-1 outline-none"
              placeholder="email@contoh.com"
            />
          </div>
          <div className="flex gap-2 flex-none">
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="rounded-lg border px-4 py-1.5 text-sm hover:bg-secondary"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasChanges || status === "loading"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {status === "loading" ? "Mengirim..." : "Kirim Saran"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
