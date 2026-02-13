import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS } from "@/lib/legal-status";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 3600;

const PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string; year?: string; status?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const typeLabel = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  return {
    title: `${typeLabel} — Jelajahi Peraturan — Pasal.id`,
    description: `Daftar ${typeLabel} dalam database hukum Indonesia.`,
  };
}

export default async function TypeListingPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const { page: pageStr, year, status } = await searchParams;
  const supabase = await createClient();

  const typeCode = type.toUpperCase();
  const typeLabel = TYPE_LABELS[typeCode] || typeCode;

  // Get regulation type
  const { data: regType } = await supabase
    .from("regulation_types")
    .select("id, code, name_id")
    .eq("code", typeCode)
    .single();

  if (!regType) notFound();

  const currentPage = Math.max(1, parseInt(pageStr || "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Build query
  let query = supabase
    .from("works")
    .select("id, frbr_uri, number, year, title_id, status, slug, tanggal_pengundangan", { count: "exact" })
    .eq("regulation_type_id", regType.id)
    .order("year", { ascending: false })
    .order("number", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (year) {
    query = query.eq("year", parseInt(year));
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: works, count } = await query;

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Get available years for filter
  const { data: yearData } = await supabase
    .from("works")
    .select("year")
    .eq("regulation_type_id", regType.id)
    .order("year", { ascending: false });

  const uniqueYears = [...new Set((yearData || []).map((w) => w.year))];

  // Build slug for reader page links
  function readerUrl(work: { number: string; year: number }) {
    return `/peraturan/${type.toLowerCase()}/${type.toLowerCase()}-${work.number}-${work.year}`;
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", String(p));
    if (year) params.set("year", year);
    if (status) params.set("status", status);
    const qs = params.toString();
    return `/jelajahi/${type.toLowerCase()}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/jelajahi"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali ke Jelajahi
        </Link>

        <div className="mb-8">
          <h1 className="font-heading text-3xl tracking-tight mb-2">
            {typeLabel} ({typeCode})
          </h1>
          <p className="text-muted-foreground">
            {(count || 0).toLocaleString("id-ID")} peraturan
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            defaultValue={year || ""}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
            onChange={() => {}}
          >
            <option value="">Semua Tahun</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            defaultValue={status || ""}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
            onChange={() => {}}
          >
            <option value="">Semua Status</option>
            <option value="berlaku">Berlaku</option>
            <option value="diubah">Diubah</option>
            <option value="dicabut">Dicabut</option>
          </select>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {(works || []).map((work) => (
            <Link
              key={work.id}
              href={readerUrl(work)}
              className="block rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-heading text-base mb-1 truncate">
                    {typeCode} No. {work.number} Tahun {work.year}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {work.title_id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {work.status && (
                    <Badge
                      className={STATUS_COLORS[work.status] || ""}
                      variant="outline"
                    >
                      {STATUS_LABELS[work.status] || work.status}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}

          {(!works || works.length === 0) && (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Tidak ada peraturan ditemukan.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {currentPage > 1 && (
              <Link
                href={pageUrl(currentPage - 1)}
                className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}

            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <Link
                  key={page}
                  href={pageUrl(page)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    page === currentPage
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:border-primary/30"
                  }`}
                >
                  {page}
                </Link>
              );
            })}

            {currentPage < totalPages && (
              <Link
                href={pageUrl(currentPage + 1)}
                className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
