import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const workId = parseInt(id);
  if (isNaN(workId)) {
    return NextResponse.json({ error: "Invalid work ID" }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body;

  if (!["rescrape", "reparse"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Use 'rescrape' or 'reparse'." },
      { status: 400 }
    );
  }

  const sb = createServiceClient();

  // Find linked crawl_job
  const { data: crawlJob } = await sb
    .from("crawl_jobs")
    .select("id, status")
    .eq("work_id", workId)
    .maybeSingle();

  if (!crawlJob) {
    return NextResponse.json(
      {
        error:
          "Tidak ada crawl job yang terhubung dengan peraturan ini. Retrigger tidak dapat dilakukan.",
      },
      { status: 404 }
    );
  }

  // rescrape → pending (re-download PDF), reparse → downloaded (re-parse only)
  const targetStatus = action === "rescrape" ? "pending" : "downloaded";

  const { error } = await sb
    .from("crawl_jobs")
    .update({
      status: targetStatus,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", crawlJob.id);

  if (error) {
    return NextResponse.json(
      { error: "Gagal mengubah status crawl job" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Crawl job #${crawlJob.id} direset ke "${targetStatus}". Worker akan memproses di run berikutnya.`,
    crawl_job_id: crawlJob.id,
    new_status: targetStatus,
  });
}
