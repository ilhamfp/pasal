import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  // Dual auth: API key OR Supabase session — fail-closed
  let isAuthed = false;

  const authHeader = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader) {
    try {
      const a = Buffer.from(authHeader);
      const b = Buffer.from(adminKey);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        isAuthed = true;
      }
    } catch {
      // encoding error — reject
    }
  }

  if (!isAuthed) {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user && isAdminEmail(user.email)) {
      isAuthed = true;
    }
  }

  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get counts of pending jobs
  const { count: pendingCount } = await supabase
    .from("crawl_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Reset failed jobs back to pending for retry
  const { data: resetData } = await supabase
    .from("crawl_jobs")
    .update({ status: "pending", error_message: null })
    .eq("status", "failed")
    .select("id");
  const resetCount = resetData?.length ?? 0;

  return NextResponse.json({
    message: "Trigger received",
    pending_jobs: (pendingCount || 0) + (resetCount || 0),
    reset_failed: resetCount || 0,
    note: "The Railway cron worker will pick these up on its next run.",
  });
}
