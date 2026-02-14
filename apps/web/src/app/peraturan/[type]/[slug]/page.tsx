import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_FORCE_MAP, STATUS_COLORS, STATUS_LABELS, TYPE_LABELS } from "@/lib/legal-status";
import { parseSlug } from "@/lib/parse-slug";
import Header from "@/components/Header";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PasalLogo from "@/components/PasalLogo";
import JsonLd from "@/components/JsonLd";
import { Badge } from "@/components/ui/badge";
import TableOfContents from "@/components/TableOfContents";
import AmendmentTimeline from "@/components/reader/AmendmentTimeline";
import ReaderLayout from "@/components/reader/ReaderLayout";
import PasalBlock from "@/components/reader/PasalBlock";

export const revalidate = 86400; // ISR: 24 hours

const getWorkBySlug = cache(async (typeCode: string, lawNumber: string, lawYear: number) => {
  const supabase = await createClient();
  const { data: regType } = await supabase
    .from("regulation_types")
    .select("id, code")
    .eq("code", typeCode)
    .single();
  if (!regType) return null;

  const { data: work } = await supabase
    .from("works")
    .select("id, title_id, number, year, status, subject_tags, content_verified, source_url, frbr_uri, slug, source_pdf_url")
    .eq("regulation_type_id", regType.id)
    .eq("number", lawNumber)
    .eq("year", lawYear)
    .single();

  return work ? { regType, work } : null;
});

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type, slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return {};

  const result = await getWorkBySlug(type.toUpperCase(), parsed.lawNumber, parsed.lawYear);
  if (!result) return {};

  const { work } = result;
  const typeLabel = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  const title = `${work.title_id} — ${typeLabel} No. ${work.number} Tahun ${work.year}`;
  const description = `Baca teks lengkap ${typeLabel} Nomor ${work.number} Tahun ${work.year} tentang ${work.title_id}. Status: ${STATUS_LABELS[work.status] || work.status}.`;
  const url = `https://pasal.id/peraturan/${type.toLowerCase()}/${slug}`;

  return {
    title,
    description,
    keywords: work.subject_tags || undefined,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
    },
  };
}

interface RelatedWork {
  id: number;
  title_id: string;
  number: string;
  year: number;
  frbr_uri: string;
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
  for (const rel of relationships) {
    const otherId = rel.source_work_id === workId ? rel.target_work_id : rel.source_work_id;
    const otherWork = relatedWorks[otherId];
    if (!otherWork) continue;
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
  const supabase = await createClient();

  // Fetch nodes and relationships in parallel
  const [{ data: nodes }, { data: relationships }] = await Promise.all([
    supabase
      .from("document_nodes")
      .select("id, node_type, number, heading, parent_id, sort_order, content_text, pdf_page_start, pdf_page_end")
      .eq("work_id", workId)
      .order("sort_order"),
    supabase
      .from("work_relationships")
      .select("*, relationship_types(code, name_id, name_en)")
      .or(`source_work_id.eq.${workId},target_work_id.eq.${workId}`),
  ]);

  // Get related work info
  const relatedWorkIds = (relationships || [])
    .map((r) => (r.source_work_id === workId ? r.target_work_id : r.source_work_id))
    .filter(Boolean);

  let relatedWorks: Record<number, RelatedWork> = {};
  if (relatedWorkIds.length > 0) {
    const { data: rw } = await supabase
      .from("works")
      .select("id, title_id, number, year, frbr_uri, regulation_type_id")
      .in("id", relatedWorkIds);
    relatedWorks = Object.fromEntries((rw || []).map((w) => [w.id, w]));
  }

  const resolvedRels = resolveRelationships(relationships || [], workId, relatedWorks);

  // Build tree structure
  const allNodes = nodes || [];
  const babNodes = allNodes.filter((n) => n.node_type === "bab");
  const pasalNodes = allNodes.filter((n) => n.node_type === "pasal");

  const mainContent = (
    <>
      {babNodes.length > 0 ? (
        babNodes.map((bab) => {
          const directPasals = pasalNodes.filter((p) => p.parent_id === bab.id);
          const directPasalIds = new Set(directPasals.map((p) => p.id));
          const subSectionIds = new Set(
            allNodes.filter((n) => n.parent_id === bab.id).map((n) => n.id),
          );
          const nestedPasals = pasalNodes.filter(
            (p) => subSectionIds.has(p.parent_id ?? -1) && !directPasalIds.has(p.id),
          );
          const allBabPasals = [...directPasals, ...nestedPasals]
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <section key={bab.id} id={`bab-${bab.number}`} className="mb-12">
              <h2 className="font-heading text-lg text-center mb-1">
                BAB {bab.number}
              </h2>
              {bab.heading && (
                <p className="text-center text-sm font-heading text-muted-foreground mb-6">
                  {bab.heading}
                </p>
              )}

              {allBabPasals.map((pasal) => (
                <PasalBlock key={pasal.id} pasal={pasal} pathname={pathname} />
              ))}
            </section>
          );
        })
      ) : (
        pasalNodes.map((pasal) => (
          <PasalBlock key={pasal.id} pasal={pasal} pathname={pathname} />
        ))
      )}

      {pasalNodes.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <PasalLogo size={48} className="mx-auto mb-3 opacity-20" />
          Konten pasal belum tersedia untuk peraturan ini.
        </div>
      )}
    </>
  );

  return (
    <ReaderLayout
      toc={<TableOfContents babs={babNodes} pasals={pasalNodes} />}
      content={mainContent}
      sidebar={
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-heading text-sm mb-2">Status</h3>
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_COLORS[work.status] || ""} variant="outline">
                {STATUS_LABELS[work.status] || work.status}
              </Badge>
              {work.content_verified ? (
                <Badge className="bg-status-berlaku-bg text-status-berlaku border-status-berlaku/20" variant="outline">
                  ✓ Terverifikasi
                </Badge>
              ) : (
                <Badge className="bg-status-diubah-bg text-status-diubah border-status-diubah/20" variant="outline">
                  ⚠ Belum Diverifikasi
                </Badge>
              )}
            </div>
          </div>

          <AmendmentTimeline
            currentWork={work}
            relationships={resolvedRels}
            regTypeCode={type.toUpperCase()}
          />

          {work.source_url && (
            <div className="rounded-lg border p-4">
              <h3 className="font-heading text-sm mb-2">Sumber</h3>
              <a
                href={work.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 break-all"
              >
                peraturan.go.id
              </a>
            </div>
          )}
        </div>
      }
      sourcePdfUrl={work.source_pdf_url ?? null}
      slug={work.slug || slug}
    />
  );
}

function ReaderSkeleton() {
  return (
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
}

export default async function LawDetailPage({ params }: PageProps) {
  const { type, slug } = await params;

  // Parse slug: "uu-13-2003" -> number=13, year=2003
  const parsed = parseSlug(slug);
  if (!parsed) notFound();
  const { lawNumber, lawYear } = parsed;

  // Use cached function (shared with generateMetadata — second call hits cache)
  const result = await getWorkBySlug(type.toUpperCase(), lawNumber, lawYear);
  if (!result) notFound();
  const { work } = result;

  const typeLabel = TYPE_LABELS[type.toUpperCase()] || type.toUpperCase();
  const pageUrl = `https://pasal.id/peraturan/${type.toLowerCase()}/${slug}`;
  const pathname = `/peraturan/${type.toLowerCase()}/${slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: "https://pasal.id" },
      { "@type": "ListItem", position: 2, name: type.toUpperCase(), item: `https://pasal.id/search?type=${type.toLowerCase()}` },
      { "@type": "ListItem", position: 3, name: `${type.toUpperCase()} ${work.number}/${work.year}` },
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
          </div>
          <h1 className="font-heading text-2xl mb-2">{work.title_id}</h1>
          <p className="text-sm text-muted-foreground">
            {type.toUpperCase()} Nomor {work.number} Tahun {work.year}
          </p>
        </div>

        <DisclaimerBanner className="mb-6" />

        <Suspense fallback={<ReaderSkeleton />}>
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
