"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { m } from "framer-motion";
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
import { computeDiff, diffStats, type DiffOp, type DiffStats } from "@/components/suggestions/diff-utils";
import { useCorrectionTimer } from "@/components/suggestions/use-correction-timer";
import { formatRegRef } from "@/lib/legal-status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
type SubmitStatus = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// useKoreksiSubmit — submission logic decoupled from UI
// ---------------------------------------------------------------------------

function useKoreksiSubmit({
  workId,
  nodeId,
  nodeType,
  nodeNumber,
  currentContent,
  suggestedContent,
  reason,
  email,
  hasChanges,
  getMetadata,
}: {
  workId: number;
  nodeId: number;
  nodeType: string;
  nodeNumber: string;
  currentContent: string;
  suggestedContent: string;
  reason: string;
  email: string;
  hasChanges: boolean;
  getMetadata: () => Record<string, unknown>;
}) {
  const t = useTranslations("correction");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = useCallback(async () => {
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
        setErrorMsg(t("errorRateLimit"));
        return;
      }

      if (res.status === 409) {
        setStatus("error");
        setErrorMsg(t("errorStaleContent"));
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.error || t("errorGeneric"));
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("errorNetwork"));
    }
  }, [hasChanges, currentContent, suggestedContent, reason, email, workId, nodeId, nodeType, nodeNumber, getMetadata, t]);

  return { status, errorMsg, submit };
}

// ---------------------------------------------------------------------------
// KoreksiPdfPanel — PDF image display with zoom/pagination toolbar
// ---------------------------------------------------------------------------

function KoreksiPdfPanel({
  imageUrl,
  pdfPage,
  pdfPageEnd,
  pdfZoom,
  pdfError,
  sourcePdfUrl,
  onPageChange,
  onZoomChange,
  onError,
  onLoad,
}: {
  imageUrl: string;
  pdfPage: number;
  pdfPageEnd: number | null;
  pdfZoom: number;
  pdfError: boolean;
  sourcePdfUrl: string | null;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onError: () => void;
  onLoad: () => void;
}) {
  const t = useTranslations("correction");
  return (
    <div className="lg:w-[55%] xl:w-[60%] flex-none flex flex-col min-h-0 border-r">
      {/* PDF toolbar */}
      <div className="flex-none flex items-center justify-between px-3 py-2 border-b bg-secondary/30">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("pdfSourceLabel")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onZoomChange(Math.max(50, pdfZoom - 25))}
            disabled={pdfZoom <= 50}
            className="rounded border p-1 hover:border-primary/30 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={t("zoomOut")}
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="text-xs tabular-nums min-w-[3rem] text-center">
            {pdfZoom}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(200, pdfZoom + 25))}
            disabled={pdfZoom >= 200}
            className="rounded border p-1 hover:border-primary/30 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={t("zoomIn")}
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => onPageChange(Math.max(1, pdfPage - 1))}
            disabled={pdfPage <= 1}
            aria-label={t("previousPage")}
            className="rounded border p-1 hover:border-primary/30 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="text-xs tabular-nums min-w-[3.5rem] text-center">
            {t("pageLabel")} {pdfPage}
          </span>
          <button
            onClick={() => onPageChange(pdfPage + 1)}
            disabled={pdfError || (pdfPageEnd != null && pdfPage >= pdfPageEnd)}
            aria-label={t("nextPage")}
            className="rounded border p-1 hover:border-primary/30 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {sourcePdfUrl && (
            <a
              href={sourcePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border p-1 hover:border-primary/30 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={t("openOriginalPdf")}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {/* PDF image with zoom */}
      <div className="flex-1 min-h-0 overflow-auto bg-secondary/10">
        {pdfError ? (
          <div className="flex items-center justify-center h-full text-center p-6 text-muted-foreground">
            <div>
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" aria-hidden="true" />
              <p className="text-xs mb-2">{t("pdfNotAvailable")}</p>
              {sourcePdfUrl && (
                <a
                  href={sourcePdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  {t("openOriginalPdf")}
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
              alt={`${t("pageLabel")} ${pdfPage}`}
              className="w-full h-auto"
              onError={onError}
              onLoad={onLoad}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KoreksiEditView — current text + correction textarea side-by-side
// ---------------------------------------------------------------------------

function KoreksiEditView({
  currentContent,
  suggestedContent,
  onContentChange,
}: {
  currentContent: string;
  suggestedContent: string;
  onContentChange: (value: string) => void;
}) {
  const t = useTranslations("correction");
  return (
    <>
      {/* Current text */}
      <div className="flex-1 min-h-0 flex flex-col border-b">
        <div className="flex-none px-4 py-2 border-b bg-secondary/30">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("currentTextLabel")}
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
            {t("yourCorrectionLabel")}
          </span>
        </div>
        <textarea
          value={suggestedContent}
          onChange={(e) => onContentChange(e.target.value)}
          maxLength={50000}
          className="flex-1 min-h-0 w-full font-mono text-sm leading-relaxed whitespace-pre-wrap p-4 outline-none resize-none bg-card"
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// KoreksiDiffView — rendered diff with stats
// ---------------------------------------------------------------------------

function KoreksiDiffView({
  diffOps,
  stats,
}: {
  diffOps: DiffOp[];
  stats: DiffStats | null;
}) {
  const t = useTranslations("correction");
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b bg-secondary/30">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("changesPreviewLabel")}
        </span>
        {stats && (
          <span className="text-xs text-muted-foreground">
            {t("changesStats", {
              changes: stats.changes,
              deleted: stats.charsDeleted,
              inserted: stats.charsInserted,
            })}
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
  );
}

// ---------------------------------------------------------------------------
// KoreksiSubmitBar — error display + form fields + submit/cancel buttons
// ---------------------------------------------------------------------------

function KoreksiSubmitBar({
  errorMsg,
  reason,
  email,
  hasChanges,
  status,
  onReasonChange,
  onEmailChange,
  onSubmit,
  onCancel,
}: {
  errorMsg: string;
  reason: string;
  email: string;
  hasChanges: boolean;
  status: SubmitStatus;
  onReasonChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("correction");
  const commonT = useTranslations("common");
  return (
    <div className="flex-none border-t bg-card px-4 py-3">
      {errorMsg && (
        <div className="flex items-center gap-2 text-sm text-destructive mb-2">
          <AlertCircle className="h-4 w-4 flex-none" aria-hidden="true" />
          {errorMsg}
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t("reasonLabel")}
          </label>
          <input
            type="text"
            name="correction-reason"
            autoComplete="off"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            maxLength={2000}
            className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-1 outline-none"
            placeholder={t("reasonPlaceholder")}
          />
        </div>
        <div className="flex-1 min-w-0 sm:max-w-[220px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t("emailLabel")}
          </label>
          <input
            type="email"
            name="submitter-email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-1 outline-none"
            placeholder={t("emailPlaceholder")}
          />
        </div>
        <div className="flex gap-2 flex-none">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-1.5 text-sm hover:bg-secondary"
          >
            {commonT("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!hasChanges || status === "loading"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {status === "loading" ? t("submitting") : t("submitButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KoreksiEditor — main orchestrator
// ---------------------------------------------------------------------------

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
  const t = useTranslations("correction");
  const [suggestedContent, setSuggestedContent] = useState(currentContent);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [pdfPage, setPdfPage] = useState(pdfPageStart || 1);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfError, setPdfError] = useState(false);

  const { trackPageView, getMetadata } = useCorrectionTimer();
  const hasChanges = suggestedContent.trim() !== currentContent.trim();
  const imageUrl = `${supabaseUrl}/storage/v1/object/public/regulation-pdfs/${slug}/page-${pdfPage}.png`;

  const { status, errorMsg, submit } = useKoreksiSubmit({
    workId, nodeId, nodeType, nodeNumber,
    currentContent, suggestedContent, reason, email,
    hasChanges, getMetadata,
  });

  useEffect(() => {
    trackPageView(pdfPage);
  }, [pdfPage, trackPageView]);

  useEffect(() => {
    setPdfError(false);
  }, [pdfPage]);

  const diffOps = useMemo(
    () => viewMode === "diff" ? computeDiff(currentContent, suggestedContent) : [],
    [viewMode, currentContent, suggestedContent],
  );
  const stats = useMemo(
    () => viewMode === "diff" ? diffStats(diffOps) : null,
    [viewMode, diffOps],
  );

  const goBack = useCallback(() => router.push(backHref), [router, backHref]);

  if (status === "success") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <m.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <Check className="h-16 w-16 mx-auto mb-4 text-primary" aria-hidden="true" />
          <p className="font-heading text-xl mb-2">{t("successTitle")}</p>
          <p className="text-sm text-muted-foreground mb-6">
            {t("successMessage")}
          </p>
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("backToRegulation")}
          </button>
        </m.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="flex-none border-b px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goBack}
            aria-label={t("backToRegulation")}
            className="rounded-lg p-1.5 hover:bg-secondary flex-none"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="font-heading text-base truncate">
              {t("pageTitle", { number: nodeNumber })}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {formatRegRef(regType, lawNumber, lawYear)} | {lawTitle}
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode("edit")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              viewMode === "edit"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            {t("editTab")}
          </button>
          <button
            onClick={() => setViewMode("diff")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
              viewMode === "diff"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            {t("changesTab")}
          </button>
        </div>
      </div>

      {/* Main body: PDF (dominant) + text panels */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <KoreksiPdfPanel
          imageUrl={imageUrl}
          pdfPage={pdfPage}
          pdfPageEnd={pdfPageEnd}
          pdfZoom={pdfZoom}
          pdfError={pdfError}
          sourcePdfUrl={sourcePdfUrl}
          onPageChange={setPdfPage}
          onZoomChange={setPdfZoom}
          onError={() => setPdfError(true)}
          onLoad={() => setPdfError(false)}
        />

        {/* Text panels */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {viewMode === "edit" ? (
            <KoreksiEditView
              currentContent={currentContent}
              suggestedContent={suggestedContent}
              onContentChange={setSuggestedContent}
            />
          ) : (
            <KoreksiDiffView diffOps={diffOps} stats={stats} />
          )}
        </div>
      </div>

      <KoreksiSubmitBar
        errorMsg={errorMsg}
        reason={reason}
        email={email}
        hasChanges={hasChanges}
        status={status}
        onReasonChange={setReason}
        onEmailChange={setEmail}
        onSubmit={submit}
        onCancel={goBack}
      />
    </div>
  );
}
