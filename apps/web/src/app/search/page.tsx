export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import SearchFilters from "@/components/SearchFilters";
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
import { workSlug, workPath } from "@/lib/work-url";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

interface SearchParams {
  q?: string;
  type?: string;
  year?: string;
  status?: string;
  page?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q;
  const parts: string[] = [];
  if (query) parts.push(`"${query}"`);
  if (params.type) parts.push(params.type.toUpperCase());
  if (params.year) parts.push(`Tahun ${params.year}`);
  if (params.status) parts.push(STATUS_LABELS[params.status] || params.status);

  const suffix = parts.length > 0 ? parts.join(", ") : "";

  return {
    title: suffix ? `Hasil pencarian: ${suffix}` : "Cari Peraturan",
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

interface FilterParams {
  type?: string;
  year?: string;
  status?: string;
}

function buildPageUrl(query: string | undefined, filters: FilterParams, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filters.type) params.set("type", filters.type);
  if (filters.year) params.set("year", filters.year);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}

// -- Search mode: query text + optional filters --
interface SearchResultsProps {
  query: string;
  filters: FilterParams;
  page: number;
}

async function SearchResults({ query, filters, page }: SearchResultsProps) {
  const supabase = await createClient();

  const metadataFilter: Record<string, string> = {};
  if (filters.type) metadataFilter.type = filters.type.toUpperCase();
  if (filters.year) metadataFilter.year = filters.year;
  if (filters.status) metadataFilter.status = filters.status;

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

  const grouped = groupChunksByWork(chunks as ChunkResult[]);

  const totalResults = grouped.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const currentPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const pageResults = grouped.slice(offset, offset + PAGE_SIZE);

  const workIds = pageResults.map((g) => g.work_id);
  const { data: works } = await supabase
    .from("works")
    .select("id, frbr_uri, title_id, number, year, status, slug, regulation_types(code)")
    .in("id", workIds);

  const worksMap = new Map((works || []).map((w: WorkResult) => [w.id, w]));
  const maxScore = Math.max(...grouped.map((g) => g.bestScore), 0.001);

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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageUrl={(p) => buildPageUrl(query, filters, p)}
      />
    </div>
  );
}

// -- Browse mode: no query text, but filters applied --
interface BrowseResultsProps {
  filters: FilterParams;
  page: number;
}

async function BrowseResults({ filters, page }: BrowseResultsProps) {
  const supabase = await createClient();

  const currentPage = Math.max(page, 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  let query = supabase
    .from("works")
    .select("id, number, year, title_id, status, slug, regulation_types(code)", { count: "exact" })
    .order("year", { ascending: false })
    .order("number", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.type) {
    const { data: regType } = await supabase
      .from("regulation_types")
      .select("id")
      .eq("code", filters.type.toUpperCase())
      .single();
    if (regType) {
      query = query.eq("regulation_type_id", regType.id);
    }
  }
  if (filters.year) {
    const parsedYear = parseInt(filters.year);
    if (!isNaN(parsedYear)) {
      query = query.eq("year", parsedYear);
    }
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data: works, count } = await query;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  if (!works || works.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <PasalLogo size={56} className="mx-auto mb-4 text-muted-foreground/20" />
        <p className="text-lg font-medium">Tidak ada peraturan ditemukan</p>
        <p className="mt-2 text-muted-foreground">
          Coba ubah filter atau tambahkan kata kunci pencarian.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DisclaimerBanner />

      <p className="text-sm text-muted-foreground">
        Menampilkan {(count || 0).toLocaleString("id-ID")} peraturan
        {totalPages > 1 && (
          <> &middot; Halaman {currentPage} dari {totalPages}</>
        )}
      </p>

      <div className="space-y-3">
        {works.map((work) => {
          const regType = getRegTypeCode(work.regulation_types);
          return (
            <Link
              key={work.id}
              href={workPath(work, regType)}
              className="block rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">{regType}</Badge>
                    <h2 className="font-heading text-base truncate">
                      {regType} No. {work.number} Tahun {work.year}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {work.title_id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {work.status && (
                    <Badge
                      className={STATUS_COLORS[work.status] || ""}
                      variant="outline"
                    >
                      {STATUS_LABELS[work.status] || work.status}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageUrl={(p) => buildPageUrl(undefined, filters, p)}
      />
    </div>
  );
}

// -- Shared pagination component --
function Pagination({
  currentPage,
  totalPages,
  pageUrl,
}: {
  currentPage: number;
  totalPages: number;
  pageUrl: (p: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
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
  const year = params.year;
  const status = params.status;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const filters: FilterParams = { type, year, status };
  const hasFilters = type || year || status;

  // Build preserveParams for the header SearchBar
  const preserveParams: Record<string, string> = {};
  if (type) preserveParams.type = type;
  if (year) preserveParams.year = year;
  if (status) preserveParams.status = status;

  // Fetch regulation types for the filter dropdown
  const supabase = await createClient();
  const { data: regulationTypes } = await supabase
    .from("regulation_types")
    .select("code, name_id")
    .order("hierarchy_level", { ascending: true });

  return (
    <div className="min-h-screen">
      <Header showSearch searchDefault={query} searchPreserveParams={preserveParams} />

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {/* Filters */}
        <div className="mb-6">
          <SearchFilters
            regulationTypes={regulationTypes || []}
            currentType={type}
            currentYear={year}
            currentStatus={status}
            currentQuery={query || undefined}
          />
        </div>

        {query ? (
          /* Search mode: text query + optional filters */
          <Suspense
            fallback={
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            }
          >
            <SearchResults query={query} filters={filters} page={page} />
          </Suspense>
        ) : hasFilters ? (
          /* Browse mode: no text, but filters applied */
          <Suspense
            fallback={
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            }
          >
            <BrowseResults filters={filters} page={page} />
          </Suspense>
        ) : (
          /* Empty state: no query and no filters */
          <div className="text-center py-16">
            <PasalLogo size={72} className="mx-auto mb-6 text-muted-foreground/15" />
            <p className="text-lg text-muted-foreground">
              Masukkan kata kunci atau pilih filter untuk mencari peraturan Indonesia
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
