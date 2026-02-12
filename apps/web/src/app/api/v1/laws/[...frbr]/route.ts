import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json(null, { headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ frbr: string[] }> },
) {
  const { frbr } = await params;
  // Reconstruct FRBR URI: /akn/id/act/uu/2003/13
  const frbrUri = "/" + frbr.join("/");

  const supabase = await createClient();

  // Get the work
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("*, regulation_types(code, name_id)")
    .eq("frbr_uri", frbrUri)
    .single();

  if (workError || !work) {
    return NextResponse.json(
      { error: `Law not found: ${frbrUri}` },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // Get articles (pasals)
  const { data: articles } = await supabase
    .from("document_nodes")
    .select("id, node_type, number, heading, content_text, parent_id, sort_order")
    .eq("work_id", work.id)
    .in("node_type", ["bab", "pasal"])
    .order("sort_order");

  // Get relationships
  const { data: relationships } = await supabase
    .from("work_relationships")
    .select("*, relationship_types(code, name_id, name_en)")
    .or(`source_work_id.eq.${work.id},target_work_id.eq.${work.id}`);

  const relatedWorkIds = (relationships || [])
    .map((r: { source_work_id: number; target_work_id: number }) =>
      r.source_work_id === work.id ? r.target_work_id : r.source_work_id,
    )
    .filter(Boolean);

  let relatedWorks: Record<number, Record<string, unknown>> = {};
  if (relatedWorkIds.length > 0) {
    const { data: rw } = await supabase
      .from("works")
      .select("id, frbr_uri, title_id, number, year, status")
      .in("id", relatedWorkIds);
    relatedWorks = Object.fromEntries(
      (rw || []).map((w: { id: number }) => [w.id, w]),
    );
  }

  const resolvedRelationships = (relationships || []).map(
    (rel: {
      id: number;
      source_work_id: number;
      target_work_id: number;
      relationship_types: { code: string; name_id: string; name_en: string };
    }) => {
      const otherId =
        rel.source_work_id === work.id
          ? rel.target_work_id
          : rel.source_work_id;
      const other = relatedWorks[otherId] as {
        frbr_uri: string;
        title_id: string;
        number: string;
        year: number;
        status: string;
      } | undefined;
      return {
        type: rel.relationship_types?.name_id || rel.relationship_types?.code,
        type_en: rel.relationship_types?.name_en,
        related_work: other
          ? {
              frbr_uri: other.frbr_uri,
              title: other.title_id,
              number: other.number,
              year: other.year,
              status: other.status,
            }
          : null,
      };
    },
  );

  const regTypes = work.regulation_types as { code: string; name_id: string } | null;

  return NextResponse.json(
    {
      work: {
        id: work.id,
        frbr_uri: work.frbr_uri,
        title: work.title_id,
        number: work.number,
        year: work.year,
        status: work.status,
        content_verified: work.content_verified,
        type: regTypes?.code || "",
        type_name: regTypes?.name_id || "",
        source_url: work.source_url,
      },
      articles: (articles || []).map(
        (a: {
          id: number;
          node_type: string;
          number: string;
          heading: string | null;
          content_text: string | null;
          parent_id: number | null;
          sort_order: number;
        }) => ({
          id: a.id,
          type: a.node_type,
          number: a.number,
          heading: a.heading,
          content: a.content_text,
          parent_id: a.parent_id,
          sort_order: a.sort_order,
        }),
      ),
      relationships: resolvedRelationships,
    },
    { headers: CORS_HEADERS },
  );
}
