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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const year = searchParams.get("year");
  const status = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const limit = Math.min(Math.max(parseInt(limitParam || "20"), 1), 100);
  const offset = Math.max(parseInt(offsetParam || "0"), 0);

  const supabase = await createClient();

  let query = supabase
    .from("works")
    .select("id, frbr_uri, title_id, number, year, status, content_verified, regulation_types(code)", { count: "exact" });

  if (type) {
    const { data: regType } = await supabase
      .from("regulation_types")
      .select("id")
      .eq("code", type.toUpperCase())
      .single();
    if (regType) {
      query = query.eq("regulation_type_id", regType.id);
    } else {
      return NextResponse.json(
        { error: `Unknown regulation type: ${type}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }
  }

  if (year) query = query.eq("year", parseInt(year));
  if (status) query = query.eq("status", status);

  const { data: works, count, error } = await query
    .order("year", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const laws = (works || []).map((w: {
    id: number;
    frbr_uri: string;
    title_id: string;
    number: string;
    year: number;
    status: string;
    content_verified: boolean;
    regulation_types: { code: string }[] | { code: string } | null;
  }) => ({
    id: w.id,
    frbr_uri: w.frbr_uri,
    title: w.title_id,
    number: w.number,
    year: w.year,
    status: w.status,
    content_verified: w.content_verified,
    type: Array.isArray(w.regulation_types)
      ? w.regulation_types[0]?.code
      : w.regulation_types?.code || "",
  }));

  return NextResponse.json(
    { total: count || laws.length, limit, offset, laws },
    { headers: CORS_HEADERS },
  );
}
