"use client";

import { useEffect, useState } from "react";
import { Check, X, Bot, Loader2 } from "lucide-react";

interface Suggestion {
  id: number;
  work_id: number;
  node_id: number;
  node_type: string;
  node_number: string | null;
  current_content: string;
  suggested_content: string;
  user_reason: string | null;
  submitter_email: string | null;
  status: string;
  agent_decision: string | null;
  agent_confidence: number | null;
  agent_modified_content: string | null;
  agent_response: {
    parsed?: {
      reasoning?: string;
      additional_issues?: Array<{ type: string; description: string; location: string }>;
      parser_feedback?: string;
      corrected_content?: string;
    };
  } | null;
  created_at: string;
}

export default function SuggestionReviewClient() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchSuggestions();
  }, []);

  async function fetchSuggestions() {
    const res = await fetch("/api/admin/suggestions");
    if (res.ok) {
      const data = await res.json();
      setSuggestions(data);
    }
    setLoading(false);
  }

  async function handleVerify(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/verify-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: id }),
      });
      if (res.ok) {
        await fetchSuggestions();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(id: number, useAiContent?: boolean) {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/approve-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: id, use_ai_content: useAiContent }),
      });
      if (res.ok) {
        await fetchSuggestions();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/reject-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: id, review_note: rejectNote[id] || "" }),
      });
      if (res.ok) {
        await fetchSuggestions();
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-tight mb-2">Saran Koreksi</h1>
      <p className="text-muted-foreground mb-8">
        {suggestions.filter((s) => s.status === "pending").length} saran menunggu review
      </p>

      <div className="space-y-4">
        {suggestions.map((s) => (
          <div key={s.id} className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <span className="font-heading text-sm">Pasal {s.node_number || "?"}</span>
                <span className="mx-2 text-muted-foreground">&middot;</span>
                <span className="text-xs text-muted-foreground">
                  {s.submitter_email || "Anonim"} &middot;{" "}
                  {new Date(s.created_at).toLocaleDateString("id-ID")}
                </span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                s.status === "pending" ? "bg-amber-50 text-amber-700" :
                s.status === "approved" ? "bg-green-50 text-green-700" :
                "bg-red-50 text-red-700"
              }`}>
                {s.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-px bg-border">
              <div className="bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Teks Saat Ini</p>
                <div className="text-sm font-mono whitespace-pre-wrap bg-secondary/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {s.current_content}
                </div>
              </div>
              <div className="bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Koreksi Disarankan</p>
                <div className="text-sm font-mono whitespace-pre-wrap bg-primary/5 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {s.suggested_content}
                </div>
              </div>
            </div>

            {s.user_reason && (
              <div className="px-4 py-2 border-t text-sm">
                <span className="text-muted-foreground">Alasan: </span>
                {s.user_reason}
              </div>
            )}

            {s.agent_decision && (
              <div className="border-t">
                <div className="px-4 py-2 text-sm bg-secondary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-muted-foreground">AI:</span>
                    <span className={
                      s.agent_decision === "accept" || s.agent_decision === "accept_with_corrections"
                        ? "text-green-700 font-medium" : s.agent_decision === "reject"
                        ? "text-red-700 font-medium" : "text-amber-700 font-medium"
                    }>
                      {s.agent_decision === "accept_with_corrections" ? "Terima dengan koreksi" :
                       s.agent_decision === "accept" ? "Terima" :
                       s.agent_decision === "reject" ? "Tolak" : s.agent_decision}
                    </span>
                    {s.agent_confidence != null && (
                      <span className="text-muted-foreground">({(s.agent_confidence * 100).toFixed(0)}%)</span>
                    )}
                  </div>
                  {s.agent_response?.parsed?.reasoning && (
                    <p className="text-muted-foreground text-xs mb-1">{s.agent_response.parsed.reasoning}</p>
                  )}
                </div>

                {/* Show AI-corrected content if different from suggestion */}
                {s.agent_modified_content && s.agent_modified_content !== s.suggested_content && (
                  <div className="px-4 py-2 bg-primary/5">
                    <p className="text-xs font-medium text-primary mb-1">Teks yang dikoreksi AI:</p>
                    <div className="text-sm font-mono whitespace-pre-wrap bg-card rounded-lg p-2 max-h-32 overflow-y-auto border">
                      {s.agent_modified_content}
                    </div>
                  </div>
                )}

                {/* Show additional issues found */}
                {s.agent_response?.parsed?.additional_issues && s.agent_response.parsed.additional_issues.length > 0 && (
                  <div className="px-4 py-2 bg-amber-50/50">
                    <p className="text-xs font-medium text-amber-700 mb-1">Masalah tambahan ditemukan:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {s.agent_response.parsed.additional_issues.map((issue, i) => (
                        <li key={i}>[{issue.type}] {issue.description}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Parser feedback for future improvements */}
                {s.agent_response?.parsed?.parser_feedback && (
                  <div className="px-4 py-2 bg-secondary/10 text-xs text-muted-foreground">
                    <span className="font-medium">Parser feedback:</span> {s.agent_response.parsed.parser_feedback}
                  </div>
                )}
              </div>
            )}

            {s.status === "pending" && (
              <div className="flex items-center gap-2 p-4 border-t">
                <button
                  onClick={() => handleVerify(s.id)}
                  disabled={actionLoading === s.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:border-primary/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  Verifikasi AI
                </button>
                <button
                  onClick={() => handleApprove(s.id)}
                  disabled={actionLoading === s.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Setujui & Terapkan
                </button>
                {s.agent_modified_content && s.agent_modified_content !== s.suggested_content && (
                  <button
                    onClick={() => handleApprove(s.id, true)}
                    disabled={actionLoading === s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-sm text-primary hover:bg-primary/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Terapkan Versi AI
                  </button>
                )}
                <div className="flex-1" />
                <input
                  type="text"
                  name="reject-reason"
                  autoComplete="off"
                  placeholder="Alasan penolakan..."
                  value={rejectNote[s.id] || ""}
                  onChange={(e) => setRejectNote({ ...rejectNote, [s.id]: e.target.value })}
                  className="rounded-lg border px-2 py-1.5 text-sm w-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <button
                  onClick={() => handleReject(s.id)}
                  disabled={actionLoading === s.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Tolak
                </button>
              </div>
            )}
          </div>
        ))}

        {suggestions.length === 0 && (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            Belum ada saran koreksi.
          </div>
        )}
      </div>
    </div>
  );
}
