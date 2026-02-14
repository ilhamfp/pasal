import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RATE_LIMIT = 10; // max suggestions per IP per hour

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_id, node_id, node_type, node_number, current_content, suggested_content, user_reason, submitter_email, metadata } = body;

    // Validate required fields
    if (!work_id || !node_id || !current_content || !suggested_content) {
      return NextResponse.json(
        { error: "Semua field wajib harus diisi." },
        { status: 400 }
      );
    }

    // Validate content length (max 50KB each)
    const MAX_CONTENT_LENGTH = 50_000;
    if (current_content.length > MAX_CONTENT_LENGTH || suggested_content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: "Teks terlalu panjang (maks 50.000 karakter)." },
        { status: 400 }
      );
    }
    if (user_reason && user_reason.length > 2_000) {
      return NextResponse.json(
        { error: "Alasan terlalu panjang (maks 2.000 karakter)." },
        { status: 400 }
      );
    }

    // Validate content is actually different
    if (current_content.trim() === suggested_content.trim()) {
      return NextResponse.json(
        { error: "Teks koreksi harus berbeda dari teks saat ini." },
        { status: 400 }
      );
    }

    // Validate metadata size if provided
    if (metadata) {
      const metaStr = JSON.stringify(metadata);
      if (metaStr.length > 10_000) {
        return NextResponse.json(
          { error: "Metadata terlalu besar." },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Get IP for rate limiting (x-real-ip is set by Vercel and not spoofable)
    const ip = request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";

    // Rate limit: count suggestions from this IP in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip", ip)
      .gte("created_at", oneHourAgo);

    if ((count || 0) >= RATE_LIMIT) {
      return NextResponse.json(
        { error: "Terlalu banyak saran. Coba lagi nanti (maks 10/jam)." },
        { status: 429 }
      );
    }

    // Insert suggestion
    const { data, error } = await supabase
      .from("suggestions")
      .insert({
        work_id,
        node_id,
        node_type: node_type || "pasal",
        node_number: node_number || null,
        current_content,
        suggested_content: suggested_content.trim(),
        user_reason: user_reason || null,
        submitter_email: submitter_email || null,
        submitter_ip: ip,
        status: "pending",
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("Suggestion insert error:", error);
      return NextResponse.json(
        { error: "Gagal menyimpan saran." },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id, message: "Saran berhasil dikirim." });
  } catch (e) {
    console.error("Suggestion API error:", e);
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
