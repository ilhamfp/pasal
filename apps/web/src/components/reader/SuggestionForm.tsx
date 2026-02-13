"use client";

import { useState } from "react";
import { X, Send, AlertCircle, Check } from "lucide-react";

interface SuggestionFormProps {
  workId: number;
  nodeId: number;
  nodeType: string;
  nodeNumber: string;
  currentContent: string;
  onClose: () => void;
}

export default function SuggestionForm({
  workId,
  nodeId,
  nodeType,
  nodeNumber,
  currentContent,
  onClose,
}: SuggestionFormProps) {
  const [suggestedContent, setSuggestedContent] = useState(currentContent);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasChanges = suggestedContent.trim() !== currentContent.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;

    setStatus("loading");
    setErrorMsg("");

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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl mx-4 rounded-lg border bg-card shadow-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-heading text-lg">
            Sarankan Koreksi — Pasal {nodeNumber}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {status === "success" ? (
          <div className="p-8 text-center">
            <Check className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p className="font-heading text-lg mb-1">Saran Terkirim</p>
            <p className="text-sm text-muted-foreground">
              Terima kasih! Saran Anda akan ditinjau oleh tim admin.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Teks Saat Ini
              </label>
              <div className="rounded-lg border bg-secondary/50 p-3 text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {currentContent}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Koreksi yang Disarankan
              </label>
              <textarea
                value={suggestedContent}
                onChange={(e) => setSuggestedContent(e.target.value)}
                className="w-full rounded-lg border bg-card p-3 text-sm font-mono min-h-[120px] focus:ring-2 focus:ring-primary focus:ring-offset-2 outline-none"
                placeholder="Edit teks di atas..."
              />
            </div>

            {hasChanges && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary mb-1">Perubahan terdeteksi</p>
                <p className="text-xs text-muted-foreground">
                  Admin akan meninjau perubahan Anda sebelum diterapkan.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Alasan koreksi (opsional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 outline-none"
                placeholder="Contoh: Typo pada paragraf kedua, huruf besar salah"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Email (opsional, untuk notifikasi)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 outline-none"
                placeholder="email@contoh.com"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-secondary"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!hasChanges || status === "loading"}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {status === "loading" ? "Mengirim..." : "Kirim Saran"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
