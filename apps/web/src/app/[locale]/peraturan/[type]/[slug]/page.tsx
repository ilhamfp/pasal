import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_FORCE_MAP, STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, formatRegRef } from "@/lib/legal-status";
import { parseSlug } from "@/lib/parse-slug";
import { getAlternates } from "@/lib/i18n-metadata";
import Header from "@/components/Header";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PasalLogo from "@/components/PasalLogo";
import JsonLd from "@/components/JsonLd";
import { Badge } from "@/components/ui/badge";
import TableOfContents from "@/components/TableOfContents";
import AmendmentTimeline from "@/components/reader/AmendmentTimeline";
import ReaderLayout from "@/components/reader/ReaderLayout";
import PasalBlock from "@/components/reader/PasalBlock";
import PasalList from "@/components/reader/PasalList";
import HashHighlighter from "@/components/reader/HashHighlighter";
import VerificationBadge from "@/components/reader/VerificationBadge";
import LegalContentLanguageNotice from "@/components/LegalContentLanguageNotice";
import PrintButton from "@/components/PrintButton";
import ShareButton from "@/components/ShareButton";
import SectionLinkButton from "@/components/SectionLinkButton";

export const revalidate = 86400; // ISR: 24 hours

const getWorkBySlug = cache(async (typeCode: string, slug: string) => {
  const supabase = await createClient();
  const { data: regType } = await supabase
    .from("regulation_types")
    .select("id, code")
    .eq("code", typeCode)
    .single();
  if (!regType) return null;

  // Primary: look up by slug directly
  const { data: work } = await supabase
    .from("works")
    .select("id, title_id, number, year, status, subject_tags, content_verified, source_url, frbr_uri, slug, source_pdf_url")
    .eq("regulation_type_id", regType.id)
    .eq("slug", slug)
    .single();

  if (work) return { regType, work };

  // Fallback: parse slug into number+year for backwards compat
  const parsed = parseSlug(slug);
  if (parsed) {
    const { data: fallbackWork } = await supabase
      .from("works")
      .select("id, title_id, number, year, status, subject_tags, content_verified, source_url, frbr_uri, slug, source_pdf_url")
      .eq("regulation_type_id", regType.id)
      .eq("number", parsed.lawNumber)
      .eq("year", parsed.lawYear)
      .single();

    if (fallbackWork) return { regType, work: fallbackWork };
  }

  // Stage 3: Strip trailing year segment (handles old UUD URLs like uud-1945-1945 → uud-1945)
  const lastDash = slug.lastIndexOf("-");
  if (lastDash > 0) {
    const slugWithoutYear = slug.substring(0, lastDash);
    const { data: strippedWork } = await supabase
      .from("works")
      .select("id, title_id, number, year, status, subject_tags, content_verified, source_url, frbr_uri, slug, source_pdf_url")
      .eq("regulation_type_id", regType.id)
      .eq("slug", slugWithoutYear)
      .single();
    if (strippedWork) return { regType, work: strippedWork };
  }

  return null;
});

interface PageProps {
  params: Promise<{ locale: string; type: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, type, slug } = await params;

  const result = await getWorkBySlug(type.toUpperCase(), slug);
  if (!result) return {};

  const { work } = result;
  const [t, statusT] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "reader" }),
    getTranslations({ locale: locale as Locale, namespace: "status" }),
  ]);

  // TYPE_LABELS stay in Indonesian — they are official legal nomenclature
  const typeLabel = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  const title = `${work.title_id} | ${formatRegRef(type, work.number, work.year, { label: "long" })}`;
  const regRef = formatRegRef(type, work.number, work.year, { label: "long" });
  const description = t("readFullText", {
    ref: regRef,
    title: work.title_id,
  }) + ` Status: ${statusT(work.status as "berlaku" | "diubah" | "dicabut" | "tidak_berlaku")}.`;
  const path = `/peraturan/${type.toLowerCase()}/${slug}`;
  const url = `https://pasal.id${path}`;

  // Truncate for social platforms — WhatsApp truncates og:title at ~60 chars
  const ogTitle = title.length > 60 ? title.slice(0, 57) + "\u2026" : title;
  const ogDescription = description.length > 155 ? description.slice(0, 152) + "\u2026" : description;

  const ogParams = new URLSearchParams({
    page: "law",
    title: work.title_id,
    type: type.toUpperCase(),
    number: work.number,
    year: work.year,
  });
  const ogImageUrl = `https://pasal.id/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    keywords: work.subject_tags || undefined,
    alternates: getAlternates(path, locale),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      type: "article",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImageUrl],
    },
    other: {
      "twitter:label1": "Status",
      "twitter:data1": STATUS_LABELS[work.status] || work.status,
      "twitter:label2": "Jenis",
      "twitter:data2": typeLabel,
    },
  };
}

interface RelatedWork {
  id: number;
  title_id: string;
  number: string;
  year: number;
  frbr_uri: string;
  slug: string | null;
  regulation_type_id: number;
}

interface ResolvedRelationship {
  id: number;
  nameId: string;
  otherWork: RelatedWork;
}

function resolveRelationships(
  relationships: Array<{
    id: number;
    source_work_id: number;
    target_work_id: number;
    relationship_types: { code: string; name_id: string; name_en: string };
  }>,
  workId: number,
  relatedWorks: Record<number, RelatedWork>,
): ResolvedRelationship[] {
  const resolved: ResolvedRelationship[] = [];
  const seenWorkIds = new Set<number>();
  for (const rel of relationships) {
    const otherId = rel.source_work_id === workId ? rel.target_work_id : rel.source_work_id;
    const otherWork = relatedWorks[otherId];
    if (!otherWork) continue;
    // Deduplicate: DB stores both directions (mengubah + diubah_oleh).
    // Keep only one entry per related work — prefer the row where current work is source.
    if (seenWorkIds.has(otherId)) {
      if (rel.source_work_id === workId) {
        const idx = resolved.findIndex((r) => r.otherWork.id === otherId);
        if (idx !== -1) {
          resolved[idx] = { id: rel.id, nameId: rel.relationship_types.name_id, otherWork };
        }
      }
      continue;
    }
    seenWorkIds.add(otherId);
    resolved.push({
      id: rel.id,
      nameId: rel.relationship_types.name_id,
      otherWork,
    });
  }
  return resolved;
}

async function LawReaderSection({
  workId,
  work,
  type,
  slug,
  pathname,
}: {
  workId: number;
  work: { year: number; number: string; title_id: string; frbr_uri: string; status: string; content_verified: boolean; source_url: string | null; source_pdf_url: string | null; slug: string | null };
  type: string;
  slug: string;
  pathname: string;
}) {
  const [t, statusT] = await Promise.all([
    getTranslations("reader"),
    getTranslations("status"),
  ]);
  const supabase = await createClient();

  // Fire all initial queries in parallel (1 RTT instead of 2)
  const [{ count: totalPasalCount }, { data: structure }, { data: initialPasals }, { data: rels }] = await Promise.all([
    supabase
      .from("document_nodes")
      .select("id", { count: "exact", head: true })
      .eq("work_id", workId)
      .eq("node_type", "pasal"),
    supabase
      .from("document_nodes")
      .select("id, node_type, number, heading, parent_id, sort_order")
      .eq("work_id", workId)
      .in("node_type", ["bab", "aturan", "bagian", "paragraf", "lampiran"])
      .order("sort_order"),
    supabase
      .from("document_nodes")
      .select("id, node_type, number, heading, parent_id, sort_order, content_text, pdf_page_start, pdf_page_end")
      .eq("work_id", workId)
      .eq("node_type", "pasal")
      .order("sort_order")
      .limit(30),
    supabase
      .from("work_relationships")
      .select("*, relationship_types(code, name_id, name_en)")
      .or(`source_work_id.eq.${workId},target_work_id.eq.${workId}`)
      .order("id"),
  ]);

  const usePagination = (totalPasalCount || 0) >= 100;
  const structuralNodes = structure;
  let pasalNodes = initialPasals;
  const relationships = rels;

  // For small documents with >30 pasals, fetch the rest
  if (!usePagination && (totalPasalCount || 0) > 30) {
    const { data: remaining } = await supabase
      .from("document_nodes")
      .select("id, node_type, number, heading, parent_id, sort_order, content_text, pdf_page_start, pdf_page_end")
      .eq("work_id", workId)
      .eq("node_type", "pasal")
      .order("sort_order")
      .range(30, (totalPasalCount || 100) - 1);
    pasalNodes = [...(initialPasals || []), ...(remaining || [])];
  }

  // Get related work info
  const relatedWorkIds = (relationships || [])
    .map((r) => (r.source_work_id === workId ? r.target_work_id : r.source_work_id))
    .filter(Boolean);

  let relatedWorks: Record<number, RelatedWork> = {};
  if (relatedWorkIds.length > 0) {
    const { data: rw } = await supabase
      .from("works")
      .select("id, title_id, number, year, frbr_uri, slug, regulation_type_id")
      .in("id", relatedWorkIds);
    relatedWorks = Object.fromEntries((rw || []).map((w) => [w.id, w]));
  }

  const resolvedRels = resolveRelationships(relationships || [], workId, relatedWorks);

  const pageUrl = `https://pasal.id/peraturan/${type.toLowerCase()}/${slug}`;

  // Build tree structure
  const babNodes = structuralNodes || [];
  const allPasals = pasalNodes || [];

  const mainContent = (
    <>
      {babNodes.length > 0 ? (
        babNodes.map((bab) => {
          // Filter pasals for this BAB
          const directPasals = allPasals.filter((p) => p.parent_id === bab.id);
          const subSectionIds = new Set(
            babNodes.filter((n) => n.parent_id === bab.id).map((n) => n.id),
          );
          const nestedPasals = allPasals.filter(
            (p) => subSectionIds.has(p.parent_id ?? -1),
          );
          const allBabPasals = [...directPasals, ...nestedPasals]
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <section key={bab.id} id={`bab-${bab.number}`} className="mb-12 scroll-mt-20">
              <div className="group flex justify-center items-center gap-2 mb-1">
                <h2 className="font-heading text-xl">
                  {bab.node_type === "aturan" ? bab.number : bab.node_type === "lampiran" ? "LAMPIRAN" : `BAB ${bab.number}`}
                </h2>
                <SectionLinkButton url={`${pageUrl}#bab-${bab.number}`} />
              </div>
              {bab.heading && bab.node_type !== "aturan" && bab.node_type !== "lampiran" && (
                <p className="text-center text-base font-heading text-muted-foreground mb-6">
                  {bab.heading}
                </p>
              )}

              {allBabPasals.map((pasal) => (
                <PasalBlock key={pasal.id} pasal={pasal} pathname={pathname} pageUrl={pageUrl} />
              ))}
            </section>
          );
        })
      ) : (
        <>
          {/* No BABs - render pasals directly */}
          {usePagination ? (
            <PasalList
              workId={workId}
              initialPasals={allPasals}
              totalPasals={totalPasalCount || 0}
              pathname={pathname}
              pageUrl={pageUrl}
            />
          ) : (
            allPasals.map((pasal) => (
              <PasalBlock key={pasal.id} pasal={pasal} pathname={pathname} pageUrl={pageUrl} />
            ))
          )}
        </>
      )}

      {allPasals.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <PasalLogo size={48} className="mx-auto mb-3 opacity-20" />
          {t("noContentYet")}
        </div>
      )}
    </>
  );

  return (
    <ReaderLayout
      toc={<TableOfContents babs={babNodes} pasals={allPasals} />}
      content={
        <>
          <HashHighlighter />
          <LegalContentLanguageNotice />
          {mainContent}
        </>
      }
      sidebar={
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-heading text-sm mb-2">{t("statusLabel")}</h3>
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_COLORS[work.status] || ""} variant="outline">
                {statusT(work.status as "berlaku" | "diubah" | "dicabut" | "tidak_berlaku")}
              </Badge>
              <VerificationBadge verified={work.content_verified ?? false} />
            </div>
          </div>

          <AmendmentTimeline
            currentWork={work}
            relationships={resolvedRels}
            regTypeCode={type.toUpperCase()}
          />

          {work.source_url && (
            <div className="rounded-lg border p-4">
              <h3 className="font-heading text-sm mb-2">{t("sourceLabel")}</h3>
              <a
                href={work.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 break-all"
              >
                {t("sourceLink")}
              </a>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <h3 className="font-heading text-sm mb-3">Bagikan</h3>
            <ShareButton
              url={pageUrl}
              title={`${formatRegRef(type, work.number, work.year)} — ${work.title_id}`}
            />
          </div>

          <div className="rounded-lg border p-4 no-print">
            <PrintButton />
          </div>
        </div>
      }
      sourcePdfUrl={work.source_pdf_url ?? null}
      slug={work.slug || slug}
    />
  );
}

const READER_SKELETON = (
  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr_280px]">
    <aside>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-4 rounded bg-muted animate-pulse" />
        ))}
      </div>
    </aside>
    <main className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          <div className="h-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </main>
    <aside className="hidden lg:block space-y-4">
      <div className="h-20 rounded-lg bg-muted animate-pulse" />
      <div className="h-32 rounded-lg bg-muted animate-pulse" />
    </aside>
  </div>
);

export default async function LawDetailPage({ params }: PageProps) {
  const { locale, type, slug } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations({ locale: locale as Locale, namespace: "reader" });

  // Use cached function (shared with generateMetadata — second call hits cache)
  const result = await getWorkBySlug(type.toUpperCase(), slug);
  if (!result) notFound();
  const { work } = result;

  // TYPE_LABELS stay in Indonesian — they are official legal nomenclature
  const typeLabel = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  const pageUrl = `https://pasal.id/peraturan/${type.toLowerCase()}/${slug}`;
  const pathname = `/peraturan/${type.toLowerCase()}/${slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("breadcrumbHome"), item: "https://pasal.id" },
      { "@type": "ListItem", position: 2, name: type.toUpperCase(), item: `https://pasal.id/search?type=${type.toLowerCase()}` },
      { "@type": "ListItem", position: 3, name: formatRegRef(type, work.number, work.year) },
    ],
  };

  const legislationLd = {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: work.title_id,
    legislationIdentifier: work.frbr_uri,
    legislationType: typeLabel,
    legislationDate: `${work.year}`,
    legislationLegalForce: LEGAL_FORCE_MAP[work.status] || "InForce",
    inLanguage: "id",
    url: pageUrl,
    legislationLegalValue: "UnofficialLegalValue",
    legislationJurisdiction: {
      "@type": "AdministrativeArea",
      name: "Indonesia",
    },
  };

  return (
    <div className="min-h-screen">
      <Header />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={legislationLd} />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">{type.toUpperCase()}</Badge>
            <div className="ml-auto flex items-center gap-1 no-print">
              <ShareButton
                url={pageUrl}
                title={`${formatRegRef(type, work.number, work.year)} — ${work.title_id}`}
                description={`Baca teks lengkap ${formatRegRef(type, work.number, work.year, { label: "long" })}.`}
              />
            </div>
          </div>
          <h1 className="font-heading text-2xl text-pretty mb-2">{work.title_id}</h1>
          <p className="text-sm text-muted-foreground">
            {formatRegRef(type, work.number, work.year)}
          </p>
        </div>

        <DisclaimerBanner className="mb-6 no-print" />

        <Suspense fallback={READER_SKELETON}>
          <LawReaderSection
            workId={work.id}
            work={work}
            type={type}
            slug={slug}
            pathname={pathname}
          />
        </Suspense>
      </div>
    </div>
  );
}
