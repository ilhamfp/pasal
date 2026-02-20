import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const RATE_LIMIT = 10; // max suggestions per IP per hour

const VALID_NODE_TYPES = new Set([
  "bab", "bagian", "paragraf", "pasal", "ayat",
  "penjelasan_umum", "penjelasan_pasal",
  "preamble", "content", "aturan",
]);

const ALLOWED_ORIGINS = new Set([
  "https://pasal.id",
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : []),
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    // --- Fix 7: Origin check (reject null origin to block non-browser requests) ---
    const origin = request.headers.get("origin");
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json(
        { error: "Origin tidak diizinkan." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      work_id, node_id, node_type, node_number,
      current_content, suggested_content,
      user_reason, submitter_email, metadata,
    } = body;

    // --- Fix 4: Type validation ---
    if (typeof work_id !== "number" || !Number.isInteger(work_id) || work_id <= 0) {
      return NextResponse.json(
        { error: "work_id harus berupa bilangan bulat positif." },
        { status: 400 },
      );
    }
    if (typeof node_id !== "number" || !Number.isInteger(node_id) || node_id <= 0) {
      return NextResponse.json(
        { error: "node_id harus berupa bilangan bulat positif." },
        { status: 400 },
      );
    }

    // Validate required string fields
    if (typeof current_content !== "string" || !current_content.trim()) {
      return NextResponse.json(
        { error: "current_content wajib diisi." },
        { status: 400 },
      );
    }
    if (typeof suggested_content !== "string" || !suggested_content.trim()) {
      return NextResponse.json(
        { error: "suggested_content wajib diisi." },
        { status: 400 },
      );
    }

    // Validate content length (max 50KB each)
    const MAX_CONTENT_LENGTH = 50_000;
    if (current_content.length > MAX_CONTENT_LENGTH || suggested_content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: "Teks terlalu panjang (maks 50.000 karakter)." },
        { status: 400 },
      );
    }
    if (user_reason && (typeof user_reason !== "string" || user_reason.length > 2_000)) {
      return NextResponse.json(
        { error: "Alasan terlalu panjang (maks 2.000 karakter)." },
        { status: 400 },
      );
    }

    // Validate content is actually different
    if (current_content.trim() === suggested_content.trim()) {
      return NextResponse.json(
        { error: "Teks koreksi harus berbeda dari teks saat ini." },
        { status: 400 },
      );
    }

    // --- Fix 5: node_type whitelist ---
    const resolvedNodeType = node_type || "pasal";
    if (!VALID_NODE_TYPES.has(resolvedNodeType)) {
      return NextResponse.json(
        { error: "node_type tidak valid." },
        { status: 400 },
      );
    }

    // --- Fix 6: Email format validation ---
    if (submitter_email && (typeof submitter_email !== "string" || !EMAIL_RE.test(submitter_email))) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 },
      );
    }

    // Validate metadata size if provided
    if (metadata) {
      const metaStr = JSON.stringify(metadata);
      if (metaStr.length > 10_000) {
        return NextResponse.json(
          { error: "Metadata terlalu besar." },
          { status: 400 },
        );
      }
    }

    // --- Fix 1: Use service client (RLS bypass prevention) ---
    const supabase = createServiceClient();

    // --- Fix 2: Verify work_id/node_id exist and match ---
    const { data: node, error: nodeErr } = await supabase
      .from("document_nodes")
      .select("id, work_id, content_text")
      .eq("id", node_id)
      .single();

    if (nodeErr || !node) {
      return NextResponse.json(
        { error: "Node tidak ditemukan." },
        { status: 404 },
      );
    }
    if (node.work_id !== work_id) {
      return NextResponse.json(
        { error: "work_id tidak cocok dengan node_id." },
        { status: 400 },
      );
    }

    // --- Fix 3: Stale content detection ---
    if (node.content_text?.trim() !== current_content.trim()) {
      return NextResponse.json(
        { error: "Teks sudah diperbarui oleh pihak lain. Muat ulang halaman untuk melihat versi terbaru." },
        { status: 409 },
      );
    }

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
        { status: 429 },
      );
    }

    // Insert suggestion
    const { data, error } = await supabase
      .from("suggestions")
      .insert({
        work_id,
        node_id,
        node_type: resolvedNodeType,
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
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id, message: "Saran berhasil dikirim." });
  } catch (e) {
    console.error("Suggestion API error:", e);
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 },
    );
  }
}
