import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TYPE_LABELS } from "@/lib/legal-status";
import Header from "@/components/Header";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Jelajahi Peraturan — Pasal.id",
  description: "Telusuri database hukum Indonesia berdasarkan jenis peraturan.",
};

export const revalidate = 3600; // ISR: 1 hour

export default async function JelajahiPage() {
  const supabase = await createClient();

  // Single query with inline count — replaces N+1 pattern
  const { data: types } = await supabase
    .from("regulation_types")
    .select("id, code, name_id, hierarchy_level, works(count)")
    .order("hierarchy_level");

  const typesWithCounts = (types || [])
    .map((t) => ({
      ...t,
      count: (t.works as unknown as { count: number }[])?.[0]?.count ?? 0,
      label: TYPE_LABELS[t.code] || t.name_id,
    }))
    .filter((t) => t.count > 0);

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl tracking-tight mb-3">
            Jelajahi Peraturan
          </h1>
          <p className="text-muted-foreground text-lg">
            Telusuri database hukum Indonesia berdasarkan jenis peraturan
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {typesWithCounts.map((type) => (
            <Link
              key={type.id}
              href={`/jelajahi/${type.code.toLowerCase()}`}
              className="rounded-lg border bg-card p-6 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <FileText className="h-5 w-5 text-primary/60" />
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

        {typesWithCounts.length === 0 && (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            Belum ada peraturan dalam database.
          </div>
        )}
      </div>
    </div>
  );
}
