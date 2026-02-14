import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import type { ChunkResult } from "@/lib/group-search-results";
import { groupChunksByWork } from "@/lib/group-search-results";
import { CORS_HEADERS } from "@/lib/api/cors";

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const type = searchParams.get("type");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10"), 1), 50);

  if (!q) {
    return NextResponse.json(
      { error: "Missing required parameter: q" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const supabase = await createClient();
  const metadataFilter = type ? { type: type.toUpperCase() } : {};

  // Over-fetch to account for grouping collapse
  const fetchCount = Math.min(limit * 3, 150);

  const { data: chunks, error } = await supabase.rpc("search_legal_chunks", {
    query_text: q,
    match_count: fetchCount,
    metadata_filter: metadataFilter,
  });

  if (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mencari." },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const chunkList = (chunks || []) as ChunkResult[];

  // Group by regulation and trim to requested limit
  const grouped = groupChunksByWork(chunkList).slice(0, limit);

  const workIds = grouped.map((g) => g.work_id);
  let worksMap: Record<number, Record<string, unknown>> = {};

  if (workIds.length > 0) {
    const { data: works } = await supabase
      .from("works")
      .select("id, frbr_uri, title_id, number, year, status, regulation_types(code)")
      .in("id", workIds);
    worksMap = Object.fromEntries((works || []).map((w: { id: number }) => [w.id, w]));
  }

  const results = grouped.map((group) => {
    const work = worksMap[group.work_id] as {
      frbr_uri: string;
      title_id: string;
      number: string;
      year: number;
      status: string;
      regulation_types: { code: string }[] | { code: string } | null;
    } | undefined;

    return {
      work_id: group.work_id,
      snippet: (group.bestChunk.snippet || group.bestChunk.content || "").replace(/<\/?mark>/g, ""),
      score: group.bestScore,
      matching_pasals: group.matchingPasals,
      total_chunks: group.totalChunks,
      work: work
        ? {
            frbr_uri: work.frbr_uri,
            title: work.title_id,
            number: work.number,
            year: work.year,
            status: work.status,
            type: getRegTypeCode(work.regulation_types),
          }
        : null,
    };
  });

  return NextResponse.json(
    { query: q, total: results.length, results },
    { headers: CORS_HEADERS },
  );
}
