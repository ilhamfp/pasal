"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, Eye, Pencil } from "lucide-react";
import TextPanel from "./TextPanel";
import PdfSidePanel from "./PdfSidePanel";
import DiffPreview from "./DiffPreview";
import SuggestionMeta from "./SuggestionMeta";
import { useSyncScroll } from "./use-sync-scroll";
import { useCorrectionTimer } from "./use-correction-timer";
import { diffStats, computeDiff } from "./diff-utils";

interface SuggestionOverlayProps {
  workId: number;
  nodeId: number;
  nodeType: string;
  nodeNumber: string;
  currentContent: string;
  onClose: () => void;
  slug: string;
  supabaseUrl: string;
  pdfPageStart: number | null;
  pdfPageEnd: number | null;
  sourcePdfUrl: string | null;
}

type ActiveView = "edit" | "diff";
type MobileTab = "original" | "correction" | "pdf" | "diff";

export default function SuggestionOverlay({
  workId,
  nodeId,
  nodeType,
  nodeNumber,
  currentContent,
  onClose,
  slug,
  supabaseUrl,
  pdfPageStart,
  pdfPageEnd,
  sourcePdfUrl,
}: SuggestionOverlayProps) {
  const [suggestedContent, setSuggestedContent] = useState(currentContent);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("edit");
  const [mobileTab, setMobileTab] = useState<MobileTab>("correction");
  const [pdfPage, setPdfPage] = useState(pdfPageStart || 1);

  const { leftRef, rightRef, handleScroll } = useSyncScroll();
  const { trackPageView, getMetadata } = useCorrectionTimer();

  const hasChanges = suggestedContent.trim() !== currentContent.trim();

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Track PDF page views
  useEffect(() => {
    trackPageView(pdfPage);
  }, [pdfPage, trackPageView]);

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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.error || "Gagal mengirim saran.");
        return;
      }

      setStatus("success");
      setTimeout(onClose, 2000);
    } catch {
      setStatus("error");
      setErrorMsg("Gagal mengirim saran. Periksa koneksi internet.");
    }
  }, [
    hasChanges,
    currentContent,
    suggestedContent,
    reason,
    email,
    workId,
    nodeId,
    nodeType,
    nodeNumber,
    getMetadata,
    onClose,
  ]);

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <Check className="h-16 w-16 mx-auto mb-4 text-primary" />
          <p className="font-heading text-xl mb-2">Saran Terkirim</p>
          <p className="text-sm text-muted-foreground">
            Terima kasih! Saran Anda akan ditinjau oleh tim admin.
          </p>
        </div>
      </div>
    );
  }

  const mobileTabs: { key: MobileTab; label: string }[] = [
    { key: "original", label: "Asli" },
    { key: "correction", label: "Koreksi" },
    { key: "pdf", label: "PDF" },
    { key: "diff", label: "Beda" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-secondary flex-none"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-heading text-base truncate">
            Koreksi — Pasal {nodeNumber}
          </h2>
        </div>

        {/* Desktop view toggle */}
        <div className="hidden lg:flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setActiveView("edit")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeView === "edit"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            onClick={() => setActiveView("diff")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeView === "diff"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            }`}
          >
            <Eye className="h-3 w-3" />
            Pratinjau Perubahan
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="flex-none lg:hidden flex border-b">
        {mobileTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
              mobileTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: 3-panel body */}
      <div className="hidden lg:flex flex-1 min-h-0">
        {activeView === "edit" ? (
          <>
            {/* PDF panel */}
            <div className="w-[280px] flex-none border-r">
              <PdfSidePanel
                slug={slug}
                supabaseUrl={supabaseUrl}
                currentPage={pdfPage}
                onPageChange={setPdfPage}
                sourcePdfUrl={sourcePdfUrl}
                maxPage={pdfPageEnd}
              />
            </div>

            {/* Current text panel */}
            <div className="flex-1 min-w-0 border-r">
              <TextPanel
                ref={leftRef}
                content={currentContent}
                editable={false}
                onScroll={() => handleScroll("left")}
                label="Teks Saat Ini"
              />
            </div>

            {/* Correction panel */}
            <div className="flex-1 min-w-0">
              <TextPanel
                ref={rightRef}
                content={suggestedContent}
                editable
                onChange={setSuggestedContent}
                onScroll={() => handleScroll("right")}
                label="Koreksi Anda"
              />
            </div>
          </>
        ) : (
          /* Diff view - full width */
          <div className="flex-1 min-w-0">
            <DiffPreview original={currentContent} modified={suggestedContent} />
          </div>
        )}
      </div>

      {/* Mobile: single panel */}
      <div className="flex-1 min-h-0 lg:hidden">
        {mobileTab === "original" && (
          <TextPanel
            content={currentContent}
            editable={false}
            label="Teks Saat Ini"
          />
        )}
        {mobileTab === "correction" && (
          <TextPanel
            content={suggestedContent}
            editable
            onChange={setSuggestedContent}
            label="Koreksi Anda"
          />
        )}
        {mobileTab === "pdf" && (
          <PdfSidePanel
            slug={slug}
            supabaseUrl={supabaseUrl}
            currentPage={pdfPage}
            onPageChange={setPdfPage}
            sourcePdfUrl={sourcePdfUrl}
          />
        )}
        {mobileTab === "diff" && (
          <DiffPreview original={currentContent} modified={suggestedContent} />
        )}
      </div>

      {/* Bottom bar */}
      <SuggestionMeta
        reason={reason}
        onReasonChange={setReason}
        email={email}
        onEmailChange={setEmail}
        hasChanges={hasChanges}
        status={status}
        errorMsg={errorMsg}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </div>
  );
}
