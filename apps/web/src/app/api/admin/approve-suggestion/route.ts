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
  const { suggestion_id, use_ai_content } = body;

  if (!suggestion_id) {
    return NextResponse.json({ error: "suggestion_id required" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Get the suggestion
  const { data: suggestion, error: fetchErr } = await sb
    .from("suggestions")
    .select("*")
    .eq("id", suggestion_id)
    .eq("status", "pending")
    .single();

  if (fetchErr || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found or already processed" }, { status: 404 });
  }

  // Determine which content to apply: user's suggestion or AI-corrected version
  const contentToApply = use_ai_content && suggestion.agent_modified_content
    ? suggestion.agent_modified_content
    : suggestion.suggested_content;

  // Use atomic apply_revision RPC — no manual fallback
  const { data: revisionId, error: rpcError } = await sb.rpc("apply_revision", {
    p_node_id: suggestion.node_id,
    p_work_id: suggestion.work_id,
    p_new_content: contentToApply,
    p_revision_type: "suggestion_approved",
    p_reason: suggestion.user_reason || "Suggestion approved by admin",
    p_suggestion_id: suggestion.id,
    p_actor_type: "admin",
    p_created_by: user.id,
  });

  if (rpcError) {
    console.error("apply_revision RPC error:", rpcError);
    return NextResponse.json({ error: "Gagal menerapkan revisi." }, { status: 500 });
  }

  return NextResponse.json({ revision_id: revisionId });
}
