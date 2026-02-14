import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

const STATUS_ORDER = [
  "pending",
  "crawling",
  "downloaded",
  "parsed",
  "loaded",
  "failed",
] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  crawling: "bg-amber-100 text-amber-800",
  downloaded: "bg-blue-100 text-blue-800",
  parsed: "bg-indigo-100 text-indigo-800",
  loaded: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  running: "bg-amber-100 text-amber-800",
  completed: "bg-primary/10 text-primary",
};

interface RunRow {
  id: number;
  source_id: string;
  status: string;
  jobs_discovered: number;
  jobs_processed: number;
  jobs_succeeded: number;
  jobs_failed: number;
  started_at: string;
  completed_at: string | null;
}

async function DashboardContent() {
  const supabase = await createClient();

  // First fetch regulation types (small table, ~11 rows) so we can do targeted counts
  const { data: regTypes } = await supabase
    .from("regulation_types")
    .select("id, code")
    .order("hierarchy_level");

  const regTypeList = regTypes || [];

  // Run all queries in parallel — use head-only counts instead of fetching rows
  const [countResults, worksResult, chunksResult, runsResult, crawlTypeResults, worksTypeResults] =
    await Promise.all([
      // Job counts by status — 6 head-only counts
      Promise.all(
        STATUS_ORDER.map((status) =>
          supabase
            .from("crawl_jobs")
            .select("id", { count: "exact", head: true })
            .eq("status", status)
        )
      ),
      // Works total (head-only)
      supabase.from("works").select("id", { count: "exact", head: true }),
      // Chunks total (head-only)
      supabase.from("legal_chunks").select("id", { count: "exact", head: true }),
      // Recent runs (10 rows)
      supabase
        .from("scraper_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
      // Crawl jobs count per regulation type — head-only counts, no row fetching
      Promise.all(
        regTypeList.map((rt) =>
          supabase
            .from("crawl_jobs")
            .select("id", { count: "exact", head: true })
            .eq("regulation_type", rt.code)
        )
      ),
      // Works count per regulation type — head-only counts, no row fetching
      Promise.all(
        regTypeList.map((rt) =>
          supabase
            .from("works")
            .select("id", { count: "exact", head: true })
            .eq("regulation_type_id", rt.id)
        )
      ),
    ]);

  const jobCounts: Record<string, number> = {};
  STATUS_ORDER.forEach((status, i) => {
    jobCounts[status] = countResults[i].count || 0;
  });
  const totalJobs = Object.values(jobCounts).reduce((a, b) => a + b, 0);

  const worksCount = worksResult.count;
  const chunksCount = chunksResult.count;
  const runs = runsResult.data;

  // Build merged type breakdown from parallel count results
  const mergedTypes = regTypeList
    .map((rt, i) => ({
      code: rt.code,
      crawlCount: crawlTypeResults[i].count || 0,
      worksCount: worksTypeResults[i].count || 0,
    }))
    .filter((t) => t.crawlCount > 0 || t.worksCount > 0)
    .sort((a, b) => b.worksCount - a.worksCount || b.crawlCount - a.crawlCount);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans text-muted-foreground">
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading">{totalJobs.toLocaleString()}</p>
          </CardContent>
        </Card>

        {STATUS_ORDER.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans text-muted-foreground capitalize">
                {status}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-heading ${
                  status === "loaded"
                    ? "text-primary"
                    : status === "failed"
                    ? "text-destructive"
                    : ""
                }`}
              >
                {(jobCounts[status] || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans text-muted-foreground">
              Works in DB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading text-primary">
              {(worksCount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans text-muted-foreground">
              Search Chunks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading">
              {(chunksCount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Type Breakdown — shows both works in DB and crawl jobs in pipeline */}
      {mergedTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Per Jenis Peraturan
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Di DB = peraturan yang sudah dimuat &middot; Jobs = crawl jobs di pipeline
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {mergedTypes.map(({ code, crawlCount, worksCount }) => (
                <Link
                  key={code}
                  href={`/admin/peraturan?type=${code.toLowerCase()}`}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:border-primary/30 transition-colors"
                >
                  <span className="font-mono text-sm font-medium">{code}</span>
                  <span className="text-primary text-sm font-medium">
                    {worksCount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">di DB</span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="text-muted-foreground text-sm">
                    {crawlCount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">jobs</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-xl">
            Riwayat Scraper Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!runs || runs.length === 0) ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Belum ada scraper run. Jalankan worker untuk memulai.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Run</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Processed</th>
                    <th className="py-2 pr-4 text-right">OK</th>
                    <th className="py-2 pr-4 text-right">Failed</th>
                    <th className="py-2">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {(runs as RunRow[]).map((run) => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono">#{run.id}</td>
                      <td className="py-2 pr-4">{run.source_id}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          className={STATUS_STYLE[run.status] || ""}
                          variant="outline"
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">
                        {run.jobs_processed}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-primary">
                        {run.jobs_succeeded}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-destructive">
                        {run.jobs_failed}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(run.started_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link
          href="/admin/scraper/jobs"
          className="text-primary hover:underline text-sm"
        >
          Lihat semua jobs &rarr;
        </Link>
        <Link
          href="/api/admin/scraper/stats"
          className="text-muted-foreground hover:underline text-sm"
        >
          API Stats (JSON)
        </Link>
      </div>
    </div>
  );
}

export default function ScraperDashboardPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading">Monitor Scraper</h1>
        <p className="text-muted-foreground mt-1">
          Status pipeline scraping peraturan.go.id
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </>
  );
}
