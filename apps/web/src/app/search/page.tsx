export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PasalLogo from "@/components/PasalLogo";
import StaggeredList from "@/components/StaggeredList";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import type { ChunkResult } from "@/lib/group-search-results";
import { groupChunksByWork, formatPasalList } from "@/lib/group-search-results";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/legal-status";
import { workSlug } from "@/lib/work-url";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

interface SearchParams {
  q?: string;
  type?: string;
  page?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q;

  return {
    title: query ? `Hasil pencarian: ${query}` : "Cari Peraturan",
    robots: { index: false, follow: true },
  };
}

interface WorkResult {
  id: number;
  frbr_uri: string;
  title_id: string;
  number: string;
  year: number;
  status: string;
  slug: string | null;
  regulation_types: { code: string }[] | { code: string } | null;
}

function sanitizeSnippet(html: string): string {
  let cleaned = html.replace(/<(?!\/?mark\b)[^>]*>/gi, "");
  cleaned = cleaned.replace(/<mark\b[^>]*>/gi, "<mark>");
  return cleaned;
}

function formatRelevance(score: number, maxScore: number): string {
  const pct = Math.round((score / maxScore) * 100);
  if (pct >= 70) return `${pct}% · Sangat relevan`;
  if (pct >= 40) return `${pct}% · Relevan`;
  return `${pct}% · Mungkin relevan`;
}

interface SearchResultsProps {
  query: string;
  type?: string;
  page: number;
}

async function SearchResults({ query, type, page }: SearchResultsProps) {
  const supabase = await createClient();

  const metadataFilter = type ? { type: type.toUpperCase() } : {};

  const { data: chunks, error } = await supabase.rpc("search_legal_chunks", {
    query_text: query,
    match_count: 200,
    metadata_filter: metadataFilter,
  });

  if (error) {
    console.error("Search error:", error);
    return (
      <div className="rounded-lg border border-destructive p-4 text-destructive">
        Terjadi kesalahan saat mencari. Silakan coba lagi.
      </div>
    );
  }

  if (!chunks || chunks.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <PasalLogo size={56} className="mx-auto mb-4 text-muted-foreground/20" />
        <p className="text-lg font-medium">Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;</p>
        <p className="mt-2 text-muted-foreground">
          Coba gunakan kata kunci yang lebih sederhana atau hapus filter.
        </p>
      </div>
    );
  }

  // Group chunks by regulation
  const grouped = groupChunksByWork(chunks as ChunkResult[]);

  // Pagination
  const totalResults = grouped.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const currentPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const pageResults = grouped.slice(offset, offset + PAGE_SIZE);

  // Fetch work metadata for all results on this page
  const workIds = pageResults.map((g) => g.work_id);
  const { data: works } = await supabase
    .from("works")
    .select("id, frbr_uri, title_id, number, year, status, slug, regulation_types(code)")
    .in("id", workIds);

  const worksMap = new Map((works || []).map((w: WorkResult) => [w.id, w]));

  const maxScore = Math.max(...grouped.map((g) => g.bestScore), 0.001);

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    params.set("q", query);
    if (type) params.set("type", type);
    if (p > 1) params.set("page", String(p));
    return `/search?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <DisclaimerBanner />

      <p className="text-sm text-muted-foreground">
        Menampilkan {totalResults} peraturan untuk &ldquo;{query}&rdquo;
        {totalPages > 1 && (
          <> &middot; Halaman {currentPage} dari {totalPages}</>
        )}
      </p>

      <StaggeredList className="space-y-4">
        {pageResults.map((group) => {
          const work = worksMap.get(group.work_id);
          if (!work) return null;

          const regType = getRegTypeCode(work.regulation_types);
          const slug = workSlug(work, regType);
          const rawSnippet = group.bestChunk.snippet || group.bestChunk.content.split("\n").slice(2).join(" ").slice(0, 250);
          const snippetHtml = sanitizeSnippet(rawSnippet);
          const pasalLabel = formatPasalList(group.matchingPasals);

          return (
            <Link key={group.work_id} href={`/peraturan/${regType.toLowerCase()}/${slug}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{regType}</Badge>
                    <CardTitle className="text-base">
                      {regType} {work.number}/{work.year}
                    </CardTitle>
                    <Badge className={STATUS_COLORS[work.status] || ""} variant="outline">
                      {STATUS_LABELS[work.status] || work.status}
                    </Badge>
                    {group.totalChunks > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {group.totalChunks} bagian cocok
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {work.title_id}
                  </p>
                </CardHeader>
                <CardContent>
                  {pasalLabel && (
                    <p className="text-sm font-medium mb-1">{pasalLabel}</p>
                  )}
                  <p
                    className="text-sm text-muted-foreground line-clamp-3 [&_mark]:bg-primary/15 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: snippetHtml }}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Relevansi: {formatRelevance(group.bestScore, maxScore)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </StaggeredList>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Halaman" className="flex items-center justify-center gap-2 mt-8">
          {currentPage > 1 && (
            <Link
              href={pageUrl(currentPage - 1)}
              aria-label="Halaman sebelumnya"
              className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}

          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let page: number;
            if (totalPages <= 7 || currentPage <= 4) {
              page = i + 1;
            } else if (currentPage >= totalPages - 3) {
              page = totalPages - 6 + i;
            } else {
              page = currentPage - 3 + i;
            }
            return (
              <Link
                key={page}
                href={pageUrl(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  page === currentPage
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:border-primary/30"
                }`}
              >
                {page}
              </Link>
            );
          })}

          {currentPage < totalPages && (
            <Link
              href={pageUrl(currentPage + 1)}
              aria-label="Halaman berikutnya"
              className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const type = params.type;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  return (
    <div className="min-h-screen">
      <Header showSearch searchDefault={query} />

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {query ? (
          <Suspense
            fallback={
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            }
          >
            <SearchResults query={query} type={type} page={page} />
          </Suspense>
        ) : (
          <div className="text-center py-16">
            <PasalLogo size={72} className="mx-auto mb-6 text-muted-foreground/15" />
            <p className="text-lg text-muted-foreground">
              Masukkan kata kunci untuk mencari hukum Indonesia
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
