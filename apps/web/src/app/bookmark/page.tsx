"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark as BookmarkIcon, Clock, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import PasalLogo from "@/components/PasalLogo";
import { getBookmarks, getHistory, removeBookmark, type Bookmark, type HistoryItem } from "@/lib/bookmarks";
import { frbrToPath } from "@/lib/frbr";

function tabClass(isActive: boolean): string {
  const base = "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors";
  if (isActive) {
    return `${base} border-primary text-foreground`;
  }
  return `${base} border-transparent text-muted-foreground hover:text-foreground`;
}

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<"bookmarks" | "history">("bookmarks");

  useEffect(() => {
    setBookmarks(getBookmarks());
    setHistory(getHistory());
  }, []);

  function handleRemoveBookmark(frbr_uri: string, pasal?: string): void {
    removeBookmark(frbr_uri, pasal);
    setBookmarks(getBookmarks());
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-heading text-3xl mb-6">Tersimpan</h1>

        <div className="flex gap-1 mb-8 border-b">
          <button onClick={() => setTab("bookmarks")} className={tabClass(tab === "bookmarks")}>
            <BookmarkIcon className="h-4 w-4" />
            Bookmark ({bookmarks.length})
          </button>
          <button onClick={() => setTab("history")} className={tabClass(tab === "history")}>
            <Clock className="h-4 w-4" />
            Riwayat ({history.length})
          </button>
        </div>

        {tab === "bookmarks" && (
          <div>
            {bookmarks.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                <PasalLogo size={48} className="mx-auto mb-3 opacity-20" />
                <p>Belum ada bookmark.</p>
                <p className="text-sm mt-1">
                  Klik ikon bookmark pada pasal untuk menyimpannya.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookmarks.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                    <Link href={frbrToPath(b.frbr_uri)} className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{b.title}</p>
                      {b.pasal && (
                        <p className="text-xs text-muted-foreground">Pasal {b.pasal}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(b.addedAt).toLocaleDateString("id-ID")}
                      </p>
                    </Link>
                    <button
                      onClick={() => handleRemoveBookmark(b.frbr_uri, b.pasal)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            {history.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                <PasalLogo size={48} className="mx-auto mb-3 opacity-20" />
                <p>Belum ada riwayat.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <Link key={i} href={frbrToPath(h.frbr_uri)}>
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{h.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.visitedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
