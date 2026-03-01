export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, formatRegRef } from "@/lib/legal-status";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;

interface SearchParams {
  type?: string;
  year?: string;
  q?: string;
  page?: string;
}

/* ───────── Type Grid (no ?type param) ───────── */
async function TypeGrid() {
  const supabase = await createClient();

  const typesRes = await supabase
    .from("regulation_types")
    .select("id, code, name_id, hierarchy_level")
    .order("hierarchy_level");

  const types = typesRes.data || [];

  // Get accurate count per type (HEAD requests — no data transferred)
  const countResults = await Promise.all(
    types.map((t) =>
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("regulation_type_id", t.id)
    )
  );

  const allTypes = types.map((t, i) => ({
    ...t,
    count: countResults[i].count || 0,
    label: TYPE_LABELS[t.code] || t.name_id,
  }));

  const typesWithWorks = allTypes.filter((t) => t.count > 0);
  const typesWithout = allTypes.filter((t) => t.count === 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {typesWithWorks.map((type) => (
          <Link
            key={type.id}
            href={`/admin/peraturan?type=${type.code.toLowerCase()}`}
            className="group rounded-lg border bg-card p-6 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <FileText className="h-5 w-5 text-primary/60" aria-hidden="true" />
              <span className="font-heading text-2xl text-primary">
                {type.count.toLocaleString("id-ID")}
              </span>
            </div>
            <h2 className="font-heading text-lg mb-1">{type.code}</h2>
            <p className="text-sm text-muted-foreground leading-snug">
              {type.label}
            </p>
          </Link>
        ))}
      </div>

      {typesWithout.length > 0 && (
        <div>
          <h3 className="font-heading text-lg mb-3 text-muted-foreground">
            Belum Ada Data
          </h3>
          <div className="flex flex-wrap gap-2">
            {typesWithout.map((type) => (
              <span
                key={type.id}
                className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground"
              >
                {type.code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Regulation List (with ?type param) ───────── */
async function RegulationList({
  typeCode,
  year,
  q,
  page,
}: {
  typeCode: string;
  year?: string;
  q?: string;
  page: number;
}) {
  const supabase = await createClient();

  // Get regulation type
  const { data: regType } = await supabase
    .from("regulation_types")
    .select("id, code, name_id")
    .eq("code", typeCode)
    .single();

  if (!regType) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Jenis peraturan &quot;{typeCode}&quot; tidak ditemukan.
      </div>
    );
  }

  const offset = (page - 1) * PAGE_SIZE;
  const typeLabel = TYPE_LABELS[typeCode] || regType.name_id;

  // Build works query
  let query = supabase
    .from("works")
    .select(
      "id, frbr_uri, number, year, title_id, status, slug, source_pdf_url, pdf_quality, parse_method, parse_confidence, parsed_at",
      { count: "exact" }
    )
    .eq("regulation_type_id", regType.id)
    .order("year", { ascending: false })
    .order("number", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (year) query = query.eq("year", parseInt(year));
  if (q) query = query.ilike("title_id", `%${q}%`);

  // Get works + available years in parallel
  const [worksRes, yearRes] = await Promise.all([
    query,
    supabase
      .from("works")
      .select("year")
      .eq("regulation_type_id", regType.id)
      .order("year", { ascending: false }),
  ]);

  const works = worksRes.data || [];
  const count = worksRes.count || 0;
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const uniqueYears = [...new Set((yearRes.data || []).map((w) => w.year))];

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    params.set("type", typeCode.toLowerCase());
    if (p > 1) params.set("page", String(p));
    if (year) params.set("year", year);
    if (q) params.set("q", q);
    return `/admin/peraturan?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/peraturan"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Semua Jenis
          </Link>
          <h2 className="font-heading text-2xl">
            {typeLabel} ({typeCode})
          </h2>
          <p className="text-muted-foreground text-sm">
            {count.toLocaleString("id-ID")} peraturan di database
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3" method="get">
        <input type="hidden" name="type" value={typeCode.toLowerCase()} />
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Cari judul..."
          className="rounded-lg border bg-card px-3 py-2 text-sm w-56"
        />
        <select
          name="year"
          defaultValue={year || ""}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <option value="">Semua Tahun</option>
          {uniqueYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">No/Tahun</th>
                  <th className="py-2 pr-3 max-w-sm">Judul</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">PDF</th>
                  <th className="py-2 pr-3">Confidence</th>
                  <th className="py-2">Parsed</th>
                </tr>
              </thead>
              <tbody>
                {works.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 sm:py-8 text-center text-muted-foreground"
                    >
                      Tidak ada peraturan ditemukan.
                    </td>
                  </tr>
                ) : (
                  works.map((work) => (
                    <tr
                      key={work.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-2 pr-3">
                        <Link
                          href={`/admin/peraturan/${work.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {formatRegRef(typeCode, work.number, work.year, { label: "compact" })}
                        </Link>
                      </td>
                      <td
                        className="py-2 pr-3 max-w-sm truncate text-xs"
                        title={work.title_id || ""}
                      >
                        <Link
                          href={`/admin/peraturan/${work.id}`}
                          className="hover:text-primary"
                        >
                          {work.title_id || "—"}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        {work.status ? (
                          <Badge
                            className={STATUS_COLORS[work.status] || ""}
                            variant="outline"
                          >
                            {STATUS_LABELS[work.status] || work.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {work.pdf_quality || "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {work.parse_confidence
                          ? `${(work.parse_confidence * 100).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td className="py-2 text-xs">
                        {work.parsed_at ? (
                          <span className="text-primary">
                            {new Date(work.parsed_at).toLocaleDateString(
                              "id-ID",
                              { day: "2-digit", month: "short", year: "numeric" }
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Belum</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {page > 1 && (
                <Link href={pageUrl(page - 1)}>
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-4">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages && (
                <Link href={pageUrl(page + 1)}>
                  <Button variant="outline" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Page Component ───────── */
export default async function AdminPeraturanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const type = params.type?.toUpperCase();
  const year = params.year;
  const q = params.q;
  const page = Math.max(1, parseInt(params.page || "1"));

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading">Kelola Peraturan</h1>
        <p className="text-muted-foreground mt-1">
          {type
            ? "Daftar peraturan dan aksi pengelolaan"
            : "Pilih jenis peraturan untuk melihat daftar"}
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        }
      >
        {type ? (
          <RegulationList typeCode={type} year={year} q={q} page={page} />
        ) : (
          <TypeGrid />
        )}
      </Suspense>
    </>
  );
}
