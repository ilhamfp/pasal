import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const statuses = [
    "pending",
    "crawling",
    "downloaded",
    "parsed",
    "loaded",
    "failed",
  ];

  // Fetch counts per status
  const jobCounts: Record<string, number> = {};
  for (const status of statuses) {
    const { count } = await supabase
      .from("crawl_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    jobCounts[status] = count || 0;
  }

  // Total works and chunks
  const { count: worksCount } = await supabase
    .from("works")
    .select("id", { count: "exact", head: true });
  const { count: chunksCount } = await supabase
    .from("legal_chunks")
    .select("id", { count: "exact", head: true });

  // Recent runs
  const { data: recentRuns } = await supabase
    .from("scraper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    jobs: jobCounts,
    total_jobs: Object.values(jobCounts).reduce((a, b) => a + b, 0),
    works: worksCount || 0,
    chunks: chunksCount || 0,
    recent_runs: recentRuns || [],
  });
}
