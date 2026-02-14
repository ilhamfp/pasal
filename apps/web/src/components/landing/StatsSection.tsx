import { createClient } from "@/lib/supabase/server";
import AnimatedStats from "./AnimatedStats";
import RevealOnScroll from "./RevealOnScroll";

export default async function StatsSection() {
  const supabase = await createClient();

  const [totalWorksResult, pasalResult, minYearResult, maxYearResult] =
    await Promise.all([
      supabase.from("works").select("id", { count: "exact", head: true }),
      supabase
        .from("document_nodes")
        .select("id", { count: "exact", head: true })
        .eq("node_type", "pasal"),
      supabase
        .from("works")
        .select("year")
        .order("year", { ascending: true })
        .limit(1)
        .single(),
      supabase
        .from("works")
        .select("year")
        .order("year", { ascending: false })
        .limit(1)
        .single(),
    ]);

  const totalWorks = totalWorksResult.count ?? 0;
  const pasalCount = pasalResult.count ?? 0;
  const minYear = minYearResult.data?.year ?? 1974;
  const maxYear = maxYearResult.data?.year ?? 2023;

  const stats = [
    {
      numericValue: totalWorks,
      label: "Peraturan",
      detail: `11 jenis peraturan — dari ${minYear} hingga ${maxYear}`,
    },
    {
      numericValue: pasalCount,
      label: "Pasal terstruktur",
      detail: "bisa dicari & dikutip",
    },
    {
      displayValue: "100%",
      label: "Gratis & Open Source",
      detail: "akses terbuka untuk semua",
    },
  ];

  return (
    <section className="border-y bg-card py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Database Hukum Indonesia Terbuka
        </p>
        <AnimatedStats stats={stats} />
      </div>
    </section>
  );
}
