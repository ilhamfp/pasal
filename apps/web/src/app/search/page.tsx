import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SearchBar from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SearchParams {
  q?: string;
  type?: string;
}

async function SearchResults({ query, type }: { query: string; type?: string }) {
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
        <p className="text-lg font-medium">Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;</p>
        <p className="mt-2 text-muted-foreground">
          Coba gunakan kata kunci yang lebih sederhana atau hapus filter.
        </p>
      </div>
    );
  }

  // Fetch work metadata for all results
  const workIds = [...new Set(chunks.map((c: { work_id: number }) => c.work_id))];
  const { data: works } = await supabase
    .from("works")
    .select("id, frbr_uri, title_id, number, year, status, regulation_types(code)")
    .in("id", workIds);

  const worksMap = new Map((works || []).map((w: Record<string, unknown>) => [w.id, w]));

  const statusColors: Record<string, string> = {
    berlaku: "bg-green-100 text-green-800",
    diubah: "bg-yellow-100 text-yellow-800",
    dicabut: "bg-red-100 text-red-800",
  };

  const statusLabels: Record<string, string> = {
    berlaku: "Berlaku",
    diubah: "Diubah",
    dicabut: "Dicabut",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {chunks.length} hasil ditemukan untuk &ldquo;{query}&rdquo;
      </p>

      {chunks.map((chunk: { id: number; work_id: number; content: string; metadata: Record<string, string>; score: number }) => {
        const work = worksMap.get(chunk.work_id) as Record<string, unknown> | undefined;
        if (!work) return null;

        const regType = (work.regulation_types as { code: string } | null)?.code || "";
        const meta = chunk.metadata || {};
        const slug = `${regType.toLowerCase()}-${work.number}-${work.year}`;
        const snippet = chunk.content.split("\n").slice(2).join(" ").slice(0, 250);

        return (
          <Link key={chunk.id} href={`/peraturan/${regType.toLowerCase()}/${slug}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{regType}</Badge>
                  <CardTitle className="text-base">
                    {regType} {work.number as string}/{work.year as number}
                  </CardTitle>
                  <Badge className={statusColors[(work.status as string)] || ""} variant="outline">
                    {statusLabels[(work.status as string)] || (work.status as string)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {work.title_id as string}
                </p>
              </CardHeader>
              <CardContent>
                {meta.pasal && (
                  <p className="text-sm font-medium mb-1">Pasal {meta.pasal}</p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {snippet}...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Relevansi: {(chunk.score * 100).toFixed(1)}%
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
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex items-center gap-4 py-3 px-4">
          <Link href="/" className="text-xl font-bold shrink-0">
            Pasal<span className="text-primary/60">.id</span>
          </Link>
          <SearchBar defaultValue={query} />
        </div>
      </header>

      {/* Results */}
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
            <p className="text-lg text-muted-foreground">
              Masukkan kata kunci untuk mencari hukum Indonesia
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
