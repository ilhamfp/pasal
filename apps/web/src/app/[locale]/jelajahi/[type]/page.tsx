import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { STATUS_COLORS, TYPE_LABELS, formatRegRef } from "@/lib/legal-status";
import { workPath } from "@/lib/work-url";
import { getAlternates } from "@/lib/i18n-metadata";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 3600; // ISR: 1 hour

const PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<{ page?: string; year?: string; status?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale, type } = await params;
  const { page: pageStr, year, status } = await searchParams;
  const t = await getTranslations({ locale: locale as Locale, namespace: "browse" });
  const typeLabel = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  const currentPage = parseInt(pageStr || "1", 10) || 1;
  const hasFilters = !!(year || status);
  return {
    title: t("typePageTitle", { type: typeLabel }),
    description: t("typePageDescription", { type: typeLabel }),
    alternates: getAlternates(`/jelajahi/${type}`, locale),
    ...(currentPage > 1 || hasFilters ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: t("typePageTitle", { type: typeLabel }),
      description: t("typePageDescription", { type: typeLabel }),
    },
  };
}

export default async function TypeListingPage({ params, searchParams }: PageProps) {
  const { locale, type } = await params;
  setRequestLocale(locale as Locale);
  const { page: pageStr, year, status } = await searchParams;

  const [t, statusT, filtersT, searchT, navT] = await Promise.all([
    getTranslations("browse"),
    getTranslations("status"),
    getTranslations("filters"),
    getTranslations("search"),
    getTranslations("navigation"),
  ]);
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
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: navT("home"), item: locale === "en" ? "https://pasal.id/en" : "https://pasal.id" },
          { "@type": "ListItem", position: 2, name: t("title"), item: locale === "en" ? "https://pasal.id/en/jelajahi" : "https://pasal.id/jelajahi" },
          { "@type": "ListItem", position: 3, name: `${typeLabel} (${typeCode})` },
        ],
      }} />

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 sm:py-8">
        <PageBreadcrumb items={[
          { label: navT("home"), href: "/" },
          { label: navT("browse"), href: "/jelajahi" },
          { label: typeLabel },
        ]} />

        <div className="mb-4 sm:mb-8">
          <h1 className="font-heading text-3xl tracking-tight mb-2">
            {typeLabel} ({typeCode})
          </h1>
          <p className="text-muted-foreground">
            {t("regulationsCount", { count: (count || 0).toLocaleString("id-ID") })}
          </p>
        </div>

        {/* Filters — native form GET submission for Server Component */}
        <form className="flex flex-wrap gap-3 mb-4 sm:mb-6" method="get">
          <select
            name="year"
            defaultValue={year || ""}
            aria-label={t("filterByYear")}
            className="rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
          >
            <option value="">{t("allYears")}</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={status || ""}
            aria-label={t("filterByStatus")}
            className="rounded-lg border bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
          >
            <option value="">{filtersT("allStatus")}</option>
            <option value="berlaku">{filtersT("statusActive")}</option>
            <option value="diubah">{filtersT("statusAmended")}</option>
            <option value="dicabut">{filtersT("statusRevoked")}</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {t("filterButton")}
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
                    {formatRegRef(typeCode, work.number, work.year)}
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
                      {statusT(work.status as "berlaku" | "diubah" | "dicabut" | "tidak_berlaku")}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}

          {(!works || works.length === 0) && (
            <div className="rounded-lg border p-4 sm:p-8 text-center text-muted-foreground">
              {t("noRegulationsFound")}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav aria-label={searchT("pagination")} className="flex items-center justify-center gap-2 mt-4 sm:mt-8">
            {currentPage > 1 && (
              <Link
                href={pageUrl(currentPage - 1)}
                aria-label={searchT("previousPage")}
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
                aria-label={searchT("nextPage")}
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
