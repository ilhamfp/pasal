"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Pencil, Loader2, Save, X } from "lucide-react";

interface AdminActionsProps {
  workId: number;
  crawlJobId: number | null;
  currentSourceUrl: string;
  currentPdfUrl: string;
  currentTitle: string;
}

export default function AdminActions({
  workId,
  crawlJobId,
  currentSourceUrl,
  currentPdfUrl,
  currentTitle,
}: AdminActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [sourceUrl, setSourceUrl] = useState(currentSourceUrl);
  const [pdfUrl, setPdfUrl] = useState(currentPdfUrl);
  const [title, setTitle] = useState(currentTitle);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleRetrigger(action: "rescrape" | "reparse") {
    setLoading(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/peraturan/${workId}/retrigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Berhasil" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(null);
    }
  }

  async function handleSave() {
    setLoading("save");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/peraturan/${workId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: sourceUrl || null,
          source_pdf_url: pdfUrl || null,
          title_id: title || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Metadata disimpan" });
        setEditing(false);
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Gagal menyimpan" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Aksi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Retrigger buttons */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={!crawlJobId || loading !== null}
            onClick={() => handleRetrigger("reparse")}
          >
            {loading === "reparse" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retrigger Parse
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={!crawlJobId || loading !== null}
            onClick={() => handleRetrigger("rescrape")}
          >
            {loading === "rescrape" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Retrigger Scrape
          </Button>
          {!crawlJobId && (
            <p className="text-xs text-muted-foreground">
              Retrigger tidak tersedia — tidak ada crawl job yang terhubung.
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setEditing(!editing)}
          >
            {editing ? (
              <X className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            {editing ? "Batal Edit" : "Edit Metadata"}
          </Button>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Judul
              </label>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Source URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                PDF URL
              </label>
              <input
                type="url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm font-mono"
                placeholder="https://...pdf"
              />
            </div>
            <Button
              size="sm"
              className="w-full gap-2"
              disabled={loading !== null}
              onClick={handleSave}
            >
              {loading === "save" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan Perubahan
            </Button>
          </div>
        )}

        {/* Status message */}
        {message && (
          <p
            className={`text-xs ${
              message.type === "success" ? "text-primary" : "text-destructive"
            }`}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
