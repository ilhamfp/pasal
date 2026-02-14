"use client";

import { Send, AlertCircle } from "lucide-react";

interface SuggestionMetaProps {
  reason: string;
  onReasonChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  hasChanges: boolean;
  status: "idle" | "loading" | "success" | "error";
  errorMsg: string;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function SuggestionMeta({
  reason,
  onReasonChange,
  email,
  onEmailChange,
  hasChanges,
  status,
  errorMsg,
  onSubmit,
  onCancel,
}: SuggestionMetaProps) {
  return (
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
            onChange={(e) => onReasonChange(e.target.value)}
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
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-1 outline-none"
            placeholder="email@contoh.com"
          />
        </div>
        <div className="flex gap-2 flex-none">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-1.5 text-sm hover:bg-secondary"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!hasChanges || status === "loading"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {status === "loading" ? "Mengirim..." : "Kirim Saran"}
          </button>
        </div>
      </div>
    </div>
  );
}
