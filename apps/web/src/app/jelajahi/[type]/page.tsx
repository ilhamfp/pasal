import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS } from "@/lib/legal-status";
import { workPath } from "@/lib/work-url";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 3600; // ISR: 1 hour

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
  const typePath = type.toLowerCase();
  const typeLabel = TYPE_LABELS[typeCode] || typeCode;

  const { data: regType } = await supabase
    .from("regulation_types")
    .select("id, code, name_id")
    .eq("code", typeCode)
    .single();

  if (!regType) notFound();

  const currentPage = Math.max(1, parseInt(pageStr || "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  let query = supabase
    .from("works")
    .select("id, number, year, title_id, status, slug", { count: "exact" })
    .eq("regulation_type_id", regType.id)
    .order("year", { ascending: false })
    .order("number", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (year) {
    const parsedYear = parseInt(year);
    if (!isNaN(parsedYear)) {
      query = query.eq("year", parsedYear);
    }
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: works, count } = await query;

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Fetch min/max year for the year filter dropdown
  const [{ data: minYearRow }, { data: maxYearRow }] = await Promise.all([
    supabase
      .from("works")
      .select("year")
      .eq("regulation_type_id", regType.id)
      .order("year", { ascending: true })
      .limit(1)
      .single(),
    supabase
      .from("works")
      .select("year")
      .eq("regulation_type_id", regType.id)
      .order("year", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const minYear = minYearRow?.year ?? 2000;
  const maxYear = maxYearRow?.year ?? new Date().getFullYear();
  const uniqueYears = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => maxYear - i,
  );

  function readerUrl(work: { number: string; year: number; slug?: string | null }): string {
    return workPath(work, typeCode);
  }

  function pageUrl(p: number): string {
    const queryParams = new URLSearchParams();
    if (p > 1) queryParams.set("page", String(p));
    if (year) queryParams.set("year", year);
    if (status) queryParams.set("status", status);
    const qs = queryParams.toString();
    return `/jelajahi/${typePath}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-8">
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

        {/* Filters — native form GET submission for Server Component */}
        <form className="flex flex-wrap gap-3 mb-6" method="get">
          <select
            name="year"
            defaultValue={year || ""}
            aria-label="Filter tahun"
            className="rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
          >
            <option value="">Semua Tahun</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={status || ""}
            aria-label="Filter status"
            className="rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
          >
            <option value="">Semua Status</option>
            <option value="berlaku">Berlaku</option>
            <option value="diubah">Diubah</option>
            <option value="dicabut">Dicabut</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Filter
          </button>
        </form>

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
          <nav aria-label="Halaman" className="flex items-center justify-center gap-2 mt-8">
            {currentPage > 1 && (
              <Link
                href={pageUrl(currentPage - 1)}
                aria-label="Halaman sebelumnya"
                className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}

            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 7 || currentPage <= 4) {
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
                  aria-current={page === currentPage ? "page" : undefined}
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
                aria-label="Halaman berikutnya"
                className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary/30"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
