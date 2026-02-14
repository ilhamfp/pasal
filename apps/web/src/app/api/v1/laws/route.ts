import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { CORS_HEADERS } from "@/lib/api/cors";

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(null, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    if (!regType) {
      return NextResponse.json(
        { error: `Unknown regulation type: ${type}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    query = query.eq("regulation_type_id", regType.id);
  }

  if (year) query = query.eq("year", parseInt(year));
  if (status) query = query.eq("status", status);

  const { data: works, count, error } = await query
    .order("year", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Laws API error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memuat data." },
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
    type: getRegTypeCode(w.regulation_types),
  }));

  return NextResponse.json(
    { total: count || laws.length, limit, offset, laws },
    { headers: CORS_HEADERS },
  );
}
