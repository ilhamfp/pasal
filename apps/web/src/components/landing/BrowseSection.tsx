import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { TYPE_LABELS } from "@/lib/legal-status";
import { FileText, ArrowRight } from "lucide-react";
import RevealOnScroll from "./RevealOnScroll";

// Types to feature on the landing page, in display order
const FEATURED_TYPES = ["UU", "PP", "PERPRES", "PERMEN", "PERPPU", "PERDA"];

export default async function BrowseSection() {
  const t = await getTranslations("browse");
  const supabase = await createClient();

  const { data: types } = await supabase
    .from("regulation_types")
    .select("id, code, name_id, hierarchy_level, works(count)")
    .order("hierarchy_level");

  const typesWithCounts = (types || [])
    .map((tp) => ({
      ...tp,
      count: (tp.works as unknown as { count: number }[])?.[0]?.count ?? 0,
      label: TYPE_LABELS[tp.code] || tp.name_id,
    }))
    .filter((tp) => tp.count > 0 && FEATURED_TYPES.includes(tp.code))
    .sort((a, b) => FEATURED_TYPES.indexOf(a.code) - FEATURED_TYPES.indexOf(b.code));

  if (typesWithCounts.length === 0) return null;

  return (
    <section className="border-b bg-card py-16 sm:py-20">
      <RevealOnScroll>
        <div className="mx-auto max-w-5xl px-4">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("sectionLabel")}
          </p>
          <h2 className="font-heading text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
            {t("sectionTitle")}
          </h2>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {typesWithCounts.map((type) => (
              <Link
                key={type.id}
                href={`/jelajahi/${type.code.toLowerCase()}`}
                className="rounded-lg border bg-background p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <FileText className="h-5 w-5 text-primary/60" aria-hidden="true" />
                  <span className="font-heading text-xl text-primary">
                    {type.count.toLocaleString("id-ID")}
                  </span>
                </div>
                <h3 className="font-heading text-base mb-0.5">{type.code}</h3>
                <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
                  {type.label}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/jelajahi"
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {t("seeAllTypes")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}
