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
    // Call Gemini 3 Flash Preview via REST API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const prompt = `Verifikasi koreksi berikut pada ${suggestion.node_type} ${suggestion.node_number || ""}:

## Teks Saat Ini:
${suggestion.current_content}

## Koreksi yang Disarankan:
${suggestion.suggested_content}

## Alasan Pengguna:
${suggestion.user_reason || "(tidak diberikan)"}

Bandingkan kedua teks dan berikan keputusan verifikasi dalam format JSON:
{
  "decision": "accept" | "modify" | "reject",
  "confidence": 0.0-1.0,
  "reasoning": "Penjelasan singkat"
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
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

    // Update suggestion with AI result
    await sb
      .from("suggestions")
      .update({
        agent_model: "gemini-2.0-flash",
        agent_response: { raw: responseText, parsed: result },
        agent_decision: result.decision,
        agent_confidence: result.confidence,
        agent_modified_content: result.modified_content || null,
        agent_completed_at: new Date().toISOString(),
      })
      .eq("id", suggestion_id);

    return NextResponse.json({
      decision: result.decision,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });

  } catch (e) {
    console.error("Verify suggestion error:", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
