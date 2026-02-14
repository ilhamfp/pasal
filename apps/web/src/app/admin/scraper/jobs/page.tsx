import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  crawling: "bg-amber-100 text-amber-800",
  downloaded: "bg-blue-100 text-blue-800",
  parsed: "bg-indigo-100 text-indigo-800",
  loaded: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
};

const STATUSES = [
  "pending",
  "crawling",
  "downloaded",
  "parsed",
  "loaded",
  "failed",
] as const;

interface JobRow {
  id: number;
  source_id: string;
  url: string;
  regulation_type: string | null;
  number: string | null;
  year: number | null;
  title: string | null;
  status: string;
  error_message: string | null;
  updated_at: string;
}

interface SearchParams {
  status?: string;
  type?: string;
  page?: string;
}

const PAGE_SIZE = 50;

async function JobsList({ status, type, page }: { status?: string; type?: string; page: number }) {
  const supabase = await createClient();
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("crawl_jobs")
    .select("id, source_id, url, regulation_type, number, year, title, status, error_message, updated_at", {
      count: "exact",
    })
    .order("updated_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) {
    query = query.eq("status", status);
  }
  if (type) {
    query = query.eq("regulation_type", type.toUpperCase());
  }

  const { data: jobs, count } = await query;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {(count || 0).toLocaleString()} jobs
        {status ? ` dengan status "${status}"` : ""}
        {type ? ` tipe ${type.toUpperCase()}` : ""}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">No/Year</th>
              <th className="py-2 pr-3 max-w-xs">Title</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 max-w-xs">Error</th>
              <th className="py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(!jobs || jobs.length === 0) ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Tidak ada jobs ditemukan
                </td>
              </tr>
            ) : (
              (jobs as JobRow[]).map((job) => (
                <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-mono text-xs">{job.id}</td>
                  <td className="py-2 pr-3">
                    <span className="font-mono text-xs">{job.regulation_type || "—"}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {job.number && job.year ? `${job.number}/${job.year}` : "—"}
                  </td>
                  <td className="py-2 pr-3 max-w-xs truncate text-xs" title={job.title || ""}>
                    {job.title || "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={STATUS_STYLE[job.status] || ""} variant="outline">
                      {job.status}
                    </Badge>
                  </td>
                  <td
                    className="py-2 pr-3 max-w-[200px] truncate text-xs text-destructive"
                    title={job.error_message || ""}
                  >
                    {job.error_message || ""}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(job.updated_at).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center pt-4">
          {page > 1 && (
            <Link
              href={`/admin/scraper/jobs?page=${page - 1}${status ? `&status=${status}` : ""}${type ? `&type=${type}` : ""}`}
            >
              <Button variant="outline" size="sm">
                &larr; Sebelumnya
              </Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground px-4">
            Halaman {page} dari {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/scraper/jobs?page=${page + 1}${status ? `&status=${status}` : ""}${type ? `&type=${type}` : ""}`}
            >
              <Button variant="outline" size="sm">
                Selanjutnya &rarr;
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default async function ScraperJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = params.status;
  const type = params.type;
  const page = parseInt(params.page || "1", 10);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading">Crawl Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Daftar semua pekerjaan scraping
          </p>
        </div>
        <Link href="/admin/scraper">
          <Button variant="outline" size="sm">
            &larr; Dashboard
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/scraper/jobs">
              <Badge
                variant={!status ? "default" : "outline"}
                className={!status ? "bg-primary text-primary-foreground" : "cursor-pointer"}
              >
                Semua
              </Badge>
            </Link>
            {STATUSES.map((s) => (
              <Link key={s} href={`/admin/scraper/jobs?status=${s}${type ? `&type=${type}` : ""}`}>
                <Badge
                  variant={status === s ? "default" : "outline"}
                  className={
                    status === s
                      ? "bg-primary text-primary-foreground"
                      : `cursor-pointer ${STATUS_STYLE[s]}`
                  }
                >
                  {s}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Suspense
            fallback={
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            }
          >
            <JobsList status={status} type={type} page={page} />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
