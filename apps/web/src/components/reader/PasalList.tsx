"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import PasalBlock from "./PasalBlock";

interface DocumentNode {
  id: number;
  node_type: string;
  number: string;
  heading: string | null;
  parent_id: number | null;
  sort_order: number;
  content_text: string;
  pdf_page_start: number | null;
  pdf_page_end: number | null;
}

interface PasalListProps {
  workId: number;
  babId?: number;
  initialPasals: DocumentNode[];
  totalPasals: number;
  pathname: string;
  pageUrl: string;
}

export default function PasalList({
  workId,
  babId,
  initialPasals,
  totalPasals,
  pathname,
  pageUrl,
}: PasalListProps) {
  const t = useTranslations("reader");
  const [pasals, setPasals] = useState<DocumentNode[]>(initialPasals);
  const [offset, setOffset] = useState(initialPasals.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const hasMore = offset < totalPasals;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: "30",
        offset: offset.toString(),
      });
      if (babId !== undefined) {
        params.set("bab_id", babId.toString());
      }

      const response = await fetch(`/api/laws/${workId}/nodes?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setPasals((prev) => [...prev, ...(data.nodes || [])]);
      setOffset((prev) => prev + (data.nodes?.length || 0));
    } catch (err) {
      console.error("Error loading more pasals:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [workId, babId, offset, loading, hasMore]);

  // Infinite scroll: observe when user scrolls near bottom
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "800px" } // Trigger 800px before reaching the element
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <>
      {pasals.map((pasal) => (
        <PasalBlock
          key={pasal.id}
          pasal={pasal}
          pathname={pathname}
          pageUrl={pageUrl}
        />
      ))}

      {/* Infinite scroll trigger point */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 sm:py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("loading")}</span>
        </div>
      )}

      {/* Error state with retry */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-4 sm:py-8">
          <p className="text-sm text-destructive">
            Error: {error}
          </p>
          <button
            onClick={loadMore}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {/* Load more button (fallback if infinite scroll doesn't work) */}
      {hasMore && !loading && !error && (
        <div className="flex justify-center py-4 sm:py-8">
          <button
            onClick={loadMore}
            className="rounded-lg border border-input bg-background px-4 py-2.5 sm:px-6 sm:py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t("loadMorePasals", { remaining: totalPasals - pasals.length })}
          </button>
        </div>
      )}

      {/* All loaded message */}
      {!hasMore && pasals.length > 0 && (
        <div className="py-4 sm:py-8 text-center text-sm text-muted-foreground">
          {t("noMorePasals")}
        </div>
      )}
    </>
  );
}
