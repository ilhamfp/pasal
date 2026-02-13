import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PasalLogo from "@/components/PasalLogo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/legal-status";
import { createClient } from "@/lib/supabase/server";

interface SearchParams {
  q?: string;
  type?: string;
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

interface ChunkResult {
  id: number;
  work_id: number;
  content: string;
  metadata: Record<string, string>;
  score: number;
  snippet?: string;
}

interface WorkResult {
  id: number;
  frbr_uri: string;
  title_id: string;
  number: string;
  year: number;
  status: string;
  regulation_types: { code: string }[] | { code: string } | null;
}

function sanitizeSnippet(html: string): string {
  return html.replace(/<(?!\/?mark\b)[^>]*>/gi, "");
}

function formatRelevance(score: number, maxScore: number): string {
  const pct = Math.round((score / maxScore) * 100);
  if (pct >= 70) return `${pct}% — Sangat relevan`;
  if (pct >= 40) return `${pct}% — Relevan`;
  return `${pct}% — Mungkin relevan`;
}

interface SearchResultsProps {
  query: string;
  type?: string;
}

async function SearchResults({ query, type }: SearchResultsProps) {
  const supabase = await createClient();

  const metadataFilter = type ? { type: type.toUpperCase() } : {};

  const { data: chunks, error } = await supabase.rpc("search_legal_chunks", {
    query_text: query,
    match_count: 20,
    metadata_filter: metadataFilter,
  });

  if (error) {
    return (
      <div className="rounded-lg border border-destructive p-4 text-destructive">
        Terjadi kesalahan saat mencari: {error.message}
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

  // Fetch work metadata for all results
  const workIds = [...new Set(chunks.map((c: ChunkResult) => c.work_id))];
  const { data: works } = await supabase
    .from("works")
    .select("id, frbr_uri, title_id, number, year, status, regulation_types(code)")
    .in("id", workIds);

  const worksMap = new Map((works || []).map((w: WorkResult) => [w.id, w]));

  const maxScore = Math.max(...chunks.map((c: ChunkResult) => c.score), 0.001);

  return (
    <div className="space-y-4">
      <DisclaimerBanner />

      <p className="text-sm text-muted-foreground">
        {chunks.length} hasil ditemukan untuk &ldquo;{query}&rdquo;
      </p>

      {chunks.map((chunk: ChunkResult) => {
        const work = worksMap.get(chunk.work_id);
        if (!work) return null;

        const regType = getRegTypeCode(work.regulation_types);
        const meta = chunk.metadata || {};
        const slug = `${regType.toLowerCase()}-${work.number}-${work.year}`;
        const rawSnippet = chunk.snippet || chunk.content.split("\n").slice(2).join(" ").slice(0, 250);
        const snippetHtml = sanitizeSnippet(rawSnippet);

        return (
          <Link key={chunk.id} href={`/peraturan/${regType.toLowerCase()}/${slug}`}>
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
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {work.title_id}
                </p>
              </CardHeader>
              <CardContent>
                {meta.pasal && (
                  <p className="text-sm font-medium mb-1">Pasal {meta.pasal}</p>
                )}
                <p
                  className="text-sm text-muted-foreground line-clamp-3 [&_mark]:bg-primary/15 [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{ __html: snippetHtml }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Relevansi: {formatRelevance(chunk.score, maxScore)}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
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
            <SearchResults query={query} type={type} />
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
