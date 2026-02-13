import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
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

  const { data: chunks, error } = await supabase.rpc("search_legal_chunks", {
    query_text: q,
    match_count: limit,
    metadata_filter: metadataFilter,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const chunkList = chunks || [];
  const workIds = [...new Set(chunkList.map((c: { work_id: number }) => c.work_id))];
  let worksMap: Record<number, Record<string, unknown>> = {};

  if (workIds.length > 0) {
    const { data: works } = await supabase
      .from("works")
      .select("id, frbr_uri, title_id, number, year, status, regulation_types(code)")
      .in("id", workIds);
    worksMap = Object.fromEntries((works || []).map((w: { id: number }) => [w.id, w]));
  }

  const results = chunkList.map((chunk: {
    id: number;
    work_id: number;
    snippet?: string;
    content: string;
    metadata: Record<string, string>;
    score: number;
  }) => {
    const work = worksMap[chunk.work_id] as {
      frbr_uri: string;
      title_id: string;
      number: string;
      year: number;
      status: string;
      regulation_types: { code: string }[] | { code: string } | null;
    } | undefined;

    return {
      id: chunk.id,
      snippet: (chunk.snippet || chunk.content || "").replace(/<\/?mark>/g, ""),
      metadata: chunk.metadata,
      score: chunk.score,
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
