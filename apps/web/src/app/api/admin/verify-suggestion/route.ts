import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  // Verify admin auth — must be authenticated AND in admin list
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { suggestion_id } = body;

  if (!suggestion_id) {
    return NextResponse.json({ error: "suggestion_id required" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Get the suggestion
  const { data: suggestion, error: fetchErr } = await sb
    .from("suggestions")
    .select("*")
    .eq("id", suggestion_id)
    .single();

  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  // Mark as verification in progress
  await sb
    .from("suggestions")
    .update({ agent_triggered_at: new Date().toISOString() })
    .eq("id", suggestion_id);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // --- Gather context: surrounding nodes from the same work ---
    // Get the target node
    const { data: targetNode } = await sb
      .from("document_nodes")
      .select("id, node_type, number, heading, content_text, parent_id, sort_order, work_id")
      .eq("id", suggestion.node_id)
      .single();

    // Get sibling nodes (same parent, nearby sort order) for context
    let surroundingContext = "";
    if (targetNode) {
      const { data: siblings } = await sb
        .from("document_nodes")
        .select("node_type, number, heading, content_text, sort_order")
        .eq("work_id", targetNode.work_id)
        .eq("node_type", "pasal")
        .gte("sort_order", (targetNode.sort_order || 0) - 3)
        .lte("sort_order", (targetNode.sort_order || 0) + 3)
        .order("sort_order")
        .limit(7);

      if (siblings && siblings.length > 0) {
        surroundingContext = siblings
          .map((s) => {
            const marker = s.number === targetNode.number ? " ← [PASAL YANG DIKOREKSI]" : "";
            const text = s.content_text || "(kosong)";
            // Truncate long sibling content to save tokens
            const truncated = text.length > 500 ? text.slice(0, 500) + "..." : text;
            return `### Pasal ${s.number}${marker}\n${truncated}`;
          })
          .join("\n\n");
      }
    }

    // Get work metadata for additional context
    const { data: work } = await sb
      .from("works")
      .select("title_id, number, year, frbr_uri, source_pdf_url")
      .eq("id", suggestion.work_id)
      .single();

    const workContext = work
      ? `Peraturan: ${work.title_id} (${work.frbr_uri})`
      : "";

    // --- Build the prompt ---
    const prompt = `Anda adalah agen verifikasi teks hukum Indonesia. Anda membantu memverifikasi koreksi yang disarankan pengguna terhadap teks peraturan perundang-undangan.

## Konteks Peraturan
${workContext}

## Teks Sekitar (Pasal-pasal di sekitar yang dikoreksi)
${surroundingContext || "(tidak tersedia)"}

## Pasal yang Dikoreksi: Pasal ${suggestion.node_number || "?"}

### Teks Saat Ini (hasil parsing PDF):
${suggestion.current_content}

### Koreksi yang Disarankan Pengguna:
${suggestion.suggested_content}

### Alasan Pengguna:
${suggestion.user_reason || "(tidak diberikan)"}

## Instruksi
Bandingkan teks saat ini dengan koreksi yang disarankan. Teks saat ini berasal dari parsing PDF yang mungkin mengandung kesalahan OCR, formatting rusak, atau teks hilang.

Analisis dan berikan keputusan dalam format JSON berikut:

{
  "decision": "accept" | "accept_with_corrections" | "reject",
  "confidence": 0.0-1.0,
  "reasoning": "Penjelasan detail mengapa keputusan ini diambil",
  "corrected_content": "Teks final yang benar (WAJIB diisi jika decision=accept atau accept_with_corrections). Jika accept tanpa perubahan, isi sama dengan suggested_content. Jika accept_with_corrections, isi dengan versi yang sudah diperbaiki.",
  "additional_issues": [
    {
      "type": "typo|ocr_artifact|missing_text|formatting|numbering",
      "description": "Deskripsi masalah yang ditemukan",
      "location": "Di mana masalah ditemukan (bisa di teks saat ini ATAU teks yang disarankan)"
    }
  ],
  "parser_feedback": "Catatan untuk meningkatkan parser di masa depan (misalnya: 'Parser gagal mendeteksi ayat (3) karena format indentasi tidak standar')"
}

Panduan keputusan:
- "accept": Koreksi pengguna benar dan meningkatkan akurasi. Tidak ada perubahan tambahan.
- "accept_with_corrections": Koreksi pengguna pada dasarnya benar, tapi ada typo atau masalah kecil yang perlu diperbaiki (baik di teks asli maupun teks yang disarankan). Isi corrected_content dengan versi final yang benar.
- "reject": Koreksi salah, memperburuk teks, atau tidak ada perbedaan bermakna.

PENTING: Selalu isi "additional_issues" jika Anda menemukan masalah lain di teks sekitar (bahkan yang tidak terkait koreksi ini). Ini membantu kami memperbaiki parser.
PENTING: Selalu isi "parser_feedback" dengan catatan tentang kemungkinan kesalahan parser.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json({ error: "Gemini API error" }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    let result;
    try {
      let jsonText = responseText;
      if (jsonText.includes("```json")) {
        jsonText = jsonText.split("```json")[1].split("```")[0].trim();
      } else if (jsonText.includes("```")) {
        jsonText = jsonText.split("```")[1].split("```")[0].trim();
      }
      result = JSON.parse(jsonText);
    } catch {
      result = { decision: "error", confidence: 0, reasoning: "Failed to parse AI response" };
    }

    // Store the full AI result — we always save the diff for future learning
    await sb
      .from("suggestions")
      .update({
        agent_model: "gemini-3-flash-preview",
        agent_response: {
          raw: responseText,
          parsed: result,
          context_nodes_count: targetNode ? 7 : 0,
          work_title: work?.title_id || null,
        },
        agent_decision: result.decision,
        agent_confidence: result.confidence,
        agent_modified_content: result.corrected_content || result.modified_content || null,
        agent_completed_at: new Date().toISOString(),
      })
      .eq("id", suggestion_id);

    return NextResponse.json({
      decision: result.decision,
      confidence: result.confidence,
      reasoning: result.reasoning,
      corrected_content: result.corrected_content || null,
      additional_issues: result.additional_issues || [],
      parser_feedback: result.parser_feedback || null,
    });

  } catch (e) {
    console.error("Verify suggestion error:", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
