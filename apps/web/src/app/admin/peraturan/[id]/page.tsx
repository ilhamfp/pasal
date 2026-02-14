export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS } from "@/lib/legal-status";
import { ChevronLeft, ExternalLink } from "lucide-react";
import AdminActions from "./AdminActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const PIPELINE_STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  crawling: "bg-amber-100 text-amber-800",
  downloaded: "bg-blue-100 text-blue-800",
  parsed: "bg-indigo-100 text-indigo-800",
  loaded: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
};

export default async function AdminPeraturanDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const workId = parseInt(id);

  if (isNaN(workId)) notFound();

  const supabase = await createClient();

  const [workRes, nodesCountRes, chunksCountRes, crawlJobRes, topNodesRes] =
    await Promise.all([
      supabase
        .from("works")
        .select(
          "*, regulation_types!inner(code, name_id, hierarchy_level)"
        )
        .eq("id", workId)
        .single(),
      supabase
        .from("document_nodes")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId),
      supabase
        .from("legal_chunks")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId),
      supabase
        .from("crawl_jobs")
        .select(
          "id, status, url, pdf_url, error_message, pdf_storage_url, updated_at"
        )
        .eq("work_id", workId)
        .maybeSingle(),
      supabase
        .from("document_nodes")
        .select("id, node_type, number, heading, depth")
        .eq("work_id", workId)
        .lte("depth", 1)
        .order("sort_order")
        .limit(60),
    ]);

  if (workRes.error || !workRes.data) notFound();

  const work = workRes.data;
  const regType = work.regulation_types as { code: string; name_id: string; hierarchy_level: number };
  const nodesCount = nodesCountRes.count || 0;
  const chunksCount = chunksCountRes.count || 0;
  const crawlJob = crawlJobRes.data;
  const topNodes = topNodesRes.data || [];
  const typeLabel = TYPE_LABELS[regType.code] || regType.name_id;

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/admin/peraturan?type=${regType.code.toLowerCase()}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {regType.code} — Daftar Peraturan
        </Link>
      </div>

      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading mb-2">
          {regType.code} No. {work.number} Tahun {work.year}
        </h1>
        <p className="text-muted-foreground">{work.title_id}</p>
        {work.status && (
          <Badge
            className={`mt-2 ${STATUS_COLORS[work.status] || ""}`}
            variant="outline"
          >
            {STATUS_LABELS[work.status] || work.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: metadata + source + parsing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Jenis</dt>
                  <dd className="font-medium">{typeLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nomor/Tahun</dt>
                  <dd className="font-mono">{work.number}/{work.year}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">FRBR URI</dt>
                  <dd className="font-mono text-xs break-all">{work.frbr_uri}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-xs">{work.slug || "—"}</dd>
                </div>
                {work.tanggal_penetapan && (
                  <div>
                    <dt className="text-muted-foreground">Tgl. Penetapan</dt>
                    <dd>{work.tanggal_penetapan}</dd>
                  </div>
                )}
                {work.tanggal_pengundangan && (
                  <div>
                    <dt className="text-muted-foreground">Tgl. Pengundangan</dt>
                    <dd>{work.tanggal_pengundangan}</dd>
                  </div>
                )}
                {work.pemrakarsa && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Pemrakarsa</dt>
                    <dd>{work.pemrakarsa}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Source Data */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Sumber Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {work.source_url && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Source URL: </span>
                  <a
                    href={work.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {work.source_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {work.source_pdf_url && (
                <div className="text-sm">
                  <span className="text-muted-foreground">PDF URL: </span>
                  <a
                    href={work.source_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {work.source_pdf_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Linked Crawl Job */}
              {crawlJob ? (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Crawl Job #{crawlJob.id}
                    </span>
                    <Badge
                      className={
                        PIPELINE_STATUS_STYLE[crawlJob.status] || ""
                      }
                      variant="outline"
                    >
                      {crawlJob.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(crawlJob.updated_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {crawlJob.error_message && (
                    <p className="text-xs text-destructive">
                      {crawlJob.error_message}
                    </p>
                  )}
                  {crawlJob.pdf_url && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">
                        Crawl PDF URL:{" "}
                      </span>
                      <a
                        href={crawlJob.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {crawlJob.pdf_url}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada crawl job yang terhubung dengan peraturan ini.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Parsing Info */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Info Parsing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Kualitas PDF</dt>
                  <dd className="font-mono">{work.pdf_quality || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Metode Parse</dt>
                  <dd className="font-mono">{work.parse_method || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Confidence</dt>
                  <dd className="font-mono">
                    {work.parse_confidence
                      ? `${(work.parse_confidence * 100).toFixed(1)}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Terakhir Parse</dt>
                  <dd>
                    {work.parsed_at
                      ? new Date(work.parsed_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </dd>
                </div>
              </dl>
              {work.parse_errors &&
                Array.isArray(work.parse_errors) &&
                work.parse_errors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Parse Errors:
                    </p>
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto max-h-40">
                      {JSON.stringify(work.parse_errors, null, 2)}
                    </pre>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Document Tree */}
          {topNodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">
                  Struktur Dokumen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {topNodes.map((node) => (
                    <li
                      key={node.id}
                      className={node.depth === 1 ? "ml-6" : ""}
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {node.node_type}
                      </span>
                      <span>
                        {node.number && (
                          <span className="font-medium">{node.number}</span>
                        )}
                        {node.heading && (
                          <span className="text-muted-foreground ml-1">
                            — {node.heading}
                          </span>
                        )}
                        {!node.number && !node.heading && (
                          <span className="text-muted-foreground italic">
                            (tanpa judul)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                  {topNodes.length >= 60 && (
                    <li className="text-muted-foreground text-xs mt-2">
                      ... dan lainnya
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: stats + actions */}
        <div className="space-y-6">
          {/* Content Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">
                Statistik Konten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Document Nodes
                </span>
                <span className="font-heading text-2xl text-primary">
                  {nodesCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Search Chunks
                </span>
                <span className="font-heading text-2xl">
                  {chunksCount.toLocaleString()}
                </span>
              </div>
              {work.slug && (
                <Link
                  href={`/peraturan/${regType.code.toLowerCase()}/${work.slug}`}
                  className="block text-center rounded-lg border px-4 py-2 text-sm text-primary hover:border-primary/30 transition-colors"
                >
                  Lihat di Reader
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <AdminActions
            workId={workId}
            crawlJobId={crawlJob?.id ?? null}
            currentSourceUrl={work.source_url || ""}
            currentPdfUrl={work.source_pdf_url || ""}
            currentTitle={work.title_id || ""}
          />
        </div>
      </div>
    </>
  );
}
