import { Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
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

  // Fetch job counts by status
  const jobCounts: Record<string, number> = {};
  for (const status of STATUS_ORDER) {
    const { count } = await supabase
      .from("crawl_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    jobCounts[status] = count || 0;
  }
  const totalJobs = Object.values(jobCounts).reduce((a, b) => a + b, 0);

  // Fetch works & chunks totals
  const { count: worksCount } = await supabase
    .from("works")
    .select("id", { count: "exact", head: true });
  const { count: chunksCount } = await supabase
    .from("legal_chunks")
    .select("id", { count: "exact", head: true });

  // Fetch recent runs
  const { data: runs } = await supabase
    .from("scraper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  // Fetch type breakdown
  const { data: typeBreakdown } = await supabase
    .from("crawl_jobs")
    .select("regulation_type")
    .limit(10000);

  const typeCounts: Record<string, number> = {};
  for (const row of typeBreakdown || []) {
    const t = row.regulation_type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

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

      {/* Type Breakdown */}
      {Object.keys(typeCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Per Jenis Peraturan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(typeCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="font-mono text-sm font-medium">{type}</span>
                    <span className="text-muted-foreground text-sm">
                      {count.toLocaleString()}
                    </span>
                  </div>
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
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8">
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
      </main>
    </div>
  );
}
