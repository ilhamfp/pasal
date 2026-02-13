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
  const { suggestion_id, review_note } = body;

  if (!suggestion_id) {
    return NextResponse.json({ error: "suggestion_id required" }, { status: 400 });
  }

  const sb = createServiceClient();

  const { error } = await sb
    .from("suggestions")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: review_note || null,
    })
    .eq("id", suggestion_id)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: "Failed to reject suggestion" }, { status: 500 });
  }

  return NextResponse.json({ status: "rejected" });
}
