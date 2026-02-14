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

  // Manual apply_revision steps:
  // 1. Get current content
  const { data: node } = await sb
    .from("document_nodes")
    .select("content_text")
    .eq("id", suggestion.node_id)
    .single();

  // 2. Create revision
  const { data: revision, error: revError } = await sb
    .from("revisions")
    .insert({
      work_id: suggestion.work_id,
      node_id: suggestion.node_id,
      node_type: suggestion.node_type,
      node_number: suggestion.node_number,
      old_content: node?.content_text || null,
      new_content: contentToApply,
      revision_type: "suggestion_approved",
      reason: suggestion.user_reason || "Suggestion approved by admin",
      suggestion_id: suggestion.id,
      actor_type: "admin",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (revError) {
    return NextResponse.json({ error: "Failed to create revision" }, { status: 500 });
  }

  // 3. Update document_nodes
  await sb
    .from("document_nodes")
    .update({
      content_text: contentToApply,
      revision_id: revision.id,
    })
    .eq("id", suggestion.node_id);

  // 4. Update legal_chunks
  await sb
    .from("legal_chunks")
    .update({ content: contentToApply })
    .eq("node_id", suggestion.node_id);

  // 5. Update suggestion status
  await sb
    .from("suggestions")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      revision_id: revision.id,
    })
    .eq("id", suggestion.id);

  return NextResponse.json({ revision_id: revision.id });
}
