import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/legal-status";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { createClient } from "@/lib/supabase/server";

export default async function FeaturedArticlePreview() {
  const supabase = await createClient();

  // Fetch UU 1/1974 (Marriage Law)
  const { data: work } = await supabase
    .from("works")
    .select("id, title_id, number, year, status, regulation_types(code)")
    .eq("number", "1")
    .eq("year", 1974)
    .limit(1)
    .single();

  if (!work) return null;

  // Fetch Pasal 1
  const { data: pasal } = await supabase
    .from("document_nodes")
    .select("number, content_text")
    .eq("work_id", work.id)
    .eq("node_type", "pasal")
    .eq("number", "1")
    .limit(1)
    .single();

  if (!pasal) return null;

  // Fetch ayat children
  const { data: ayats } = await supabase
    .from("document_nodes")
    .select("number, content_text")
    .eq("work_id", work.id)
    .eq("node_type", "ayat")
    .order("sort_order")
    .limit(3);

  const regCode = getRegTypeCode(work.regulation_types) || "UU";
  const slug = `${regCode.toLowerCase()}-${work.number}-${work.year}`;

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-xl px-4">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Langsung dari database
        </p>

        <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{regCode}</Badge>
            <Badge
              className={STATUS_COLORS[work.status] || ""}
              variant="outline"
            >
              {STATUS_LABELS[work.status] || work.status}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {regCode} No. {work.number} Tahun {work.year}
            </span>
          </div>

          <h3 className="font-heading text-xl">Pasal {pasal.number}</h3>

          <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground/80">
            {pasal.content_text && <p>{pasal.content_text}</p>}
            {ayats &&
              ayats.map((ayat) => (
                <p key={ayat.number}>
                  ({ayat.number}) {ayat.content_text}
                </p>
              ))}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground line-clamp-1">
              {work.title_id}
            </p>
            <Link
              href={`/peraturan/${regCode.toLowerCase()}/${slug}`}
              className="shrink-0 text-sm font-medium text-primary hover:underline"
            >
              Baca &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
