import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TYPE_LABELS } from "@/lib/legal-status";
import { FileText, ArrowRight } from "lucide-react";
import RevealOnScroll from "./RevealOnScroll";

export default async function BrowseSection() {
  const supabase = await createClient();

  const [{ data: types }, { data: allWorks }] = await Promise.all([
    supabase
      .from("regulation_types")
      .select("id, code, name_id, hierarchy_level")
      .order("hierarchy_level"),
    supabase.from("works").select("regulation_type_id"),
  ]);

  // Count works per type client-side instead of N+1 queries
  const countsByType = new Map<number, number>();
  for (const w of allWorks || []) {
    countsByType.set(w.regulation_type_id, (countsByType.get(w.regulation_type_id) || 0) + 1);
  }

  const typesWithCounts = (types || [])
    .map((t) => ({
      ...t,
      count: countsByType.get(t.id) || 0,
      label: TYPE_LABELS[t.code] || t.name_id,
    }))
    .filter((t) => t.count > 0)
    .slice(0, 6); // Show top 6 on landing page

  if (typesWithCounts.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <RevealOnScroll>
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-heading text-center text-4xl tracking-tight sm:text-5xl">
            Jelajahi Berdasarkan Jenis
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-muted-foreground">
            Telusuri peraturan berdasarkan kategori
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {typesWithCounts.map((type) => (
              <Link
                key={type.id}
                href={`/jelajahi/${type.code.toLowerCase()}`}
                className="rounded-lg border bg-card p-5 hover:border-primary/30 transition-colors"
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
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Lihat semua jenis peraturan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}
