import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/legal-status";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import CopyButton from "@/components/CopyButton";
import TableOfContents from "@/components/TableOfContents";

export const revalidate = 86400; // ISR: 24 hours

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
}

export default async function LawDetailPage({ params }: PageProps) {
  const { type, slug } = await params;
  const supabase = await createClient();

  // Parse slug: "uu-13-2003" -> type=UU, number=13, year=2003
  const parts = slug.split("-");
  if (parts.length < 3) notFound();
  const lawNumber = parts[parts.length - 2];
  const lawYear = parseInt(parts[parts.length - 1]);
  if (isNaN(lawYear)) notFound();

  // Get regulation type ID
  const { data: regTypes } = await supabase
    .from("regulation_types")
    .select("id, code")
    .eq("code", type.toUpperCase())
    .single();

  if (!regTypes) notFound();

  // Get the work
  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("regulation_type_id", regTypes.id)
    .eq("number", lawNumber)
    .eq("year", lawYear)
    .single();

  if (!work) notFound();

  // Get all document nodes
  const { data: nodes } = await supabase
    .from("document_nodes")
    .select("*")
    .eq("work_id", work.id)
    .order("sort_order");

  // Get relationships
  const { data: relationships } = await supabase
    .from("work_relationships")
    .select("*, relationship_types(code, name_id, name_en)")
    .or(`source_work_id.eq.${work.id},target_work_id.eq.${work.id}`);

  // Get related work info
  const relatedWorkIds = (relationships || [])
    .map((r) => (r.source_work_id === work.id ? r.target_work_id : r.source_work_id))
    .filter(Boolean);

  let relatedWorks: Record<number, { id: number; title_id: string; number: string; year: number; frbr_uri: string; regulation_type_id: number }> = {};
  if (relatedWorkIds.length > 0) {
    const { data: rw } = await supabase
      .from("works")
      .select("id, title_id, number, year, frbr_uri, regulation_type_id")
      .in("id", relatedWorkIds);
    relatedWorks = Object.fromEntries((rw || []).map((w) => [w.id, w]));
  }

  // Build tree structure
  const allNodes = nodes || [];
  const babNodes = allNodes.filter((n) => n.node_type === "bab");
  const pasalNodes = allNodes.filter((n) => n.node_type === "pasal");

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">{type.toUpperCase()}</Badge>
            <Badge className={STATUS_COLORS[work.status] || ""} variant="outline">
              {STATUS_LABELS[work.status] || work.status}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold mb-2">{work.title_id}</h1>
          <p className="text-sm text-muted-foreground">
            {type.toUpperCase()} Nomor {work.number} Tahun {work.year}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr_280px] gap-8">
          <aside className="hidden lg:block">
            <TableOfContents babs={babNodes} pasals={pasalNodes} />
          </aside>

          <main className="min-w-0">
            {babNodes.length > 0 ? (
              babNodes.map((bab) => {
                const babPasals = pasalNodes.filter((p) => p.parent_id === bab.id);
                // Also get pasals under bagian/paragraf that are under this bab
                const childNodeIds = allNodes
                  .filter((n) => n.parent_id === bab.id)
                  .map((n) => n.id);
                const nestedPasals = pasalNodes.filter(
                  (p) => childNodeIds.includes(p.parent_id ?? -1) && !babPasals.includes(p)
                );
                const allBabPasals = [...babPasals, ...nestedPasals];

                return (
                  <section key={bab.id} id={`bab-${bab.number}`} className="mb-12">
                    <h2 className="text-lg font-bold text-center mb-1">
                      BAB {bab.number}
                    </h2>
                    {bab.heading && (
                      <p className="text-center text-sm font-semibold text-muted-foreground mb-6">
                        {bab.heading}
                      </p>
                    )}

                    {allBabPasals.map((pasal) => (
                      <PasalBlock key={pasal.id} pasal={pasal} />
                    ))}
                  </section>
                );
              })
            ) : (
              // No BAB structure — just show all pasals
              pasalNodes.map((pasal) => (
                <PasalBlock key={pasal.id} pasal={pasal} />
              ))
            )}

            {pasalNodes.length === 0 && (
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                Konten pasal belum tersedia untuk peraturan ini.
              </div>
            )}
          </main>

          <aside className="hidden lg:block space-y-6">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-2">Status</h3>
              <Badge className={STATUS_COLORS[work.status] || ""} variant="outline">
                {STATUS_LABELS[work.status] || work.status}
              </Badge>
            </div>

            {relationships && relationships.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">Hubungan Hukum</h3>
                <div className="space-y-3">
                  {relationships.map((rel) => {
                    const relType = rel.relationship_types as {
                      code: string;
                      name_id: string;
                      name_en: string;
                    };
                    const otherId =
                      rel.source_work_id === work.id
                        ? rel.target_work_id
                        : rel.source_work_id;
                    const otherWork = relatedWorks[otherId];
                    if (!otherWork) return null;

                    return (
                      <div key={rel.id} className="text-sm">
                        <p className="text-muted-foreground">{relType.name_id}</p>
                        <p className="font-medium">
                          {type.toUpperCase()} {otherWork.number}/{otherWork.year}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {work.source_url && (
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-2">Sumber</h3>
                <a
                  href={work.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  peraturan.go.id
                </a>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

interface PasalNode {
  id: number;
  number: string;
  content_text: string | null;
  heading: string | null;
}

function PasalBlock({ pasal }: { pasal: PasalNode }) {
  const content = pasal.content_text || "";
  const jsonData = JSON.stringify({ pasal: pasal.number, content }, null, 2);

  return (
    <article
      id={`pasal-${pasal.number}`}
      className="mb-8 scroll-mt-20"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold">Pasal {pasal.number}</h3>
        <CopyButton text={jsonData} label="JSON" />
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </article>
  );
}
