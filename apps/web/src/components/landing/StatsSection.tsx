import { getLandingStats } from "@/lib/stats";
import AnimatedStats from "./AnimatedStats";
import RevealOnScroll from "./RevealOnScroll";

export default async function StatsSection() {
  const { totalWorks, pasalCount, minYear, maxYear } = await getLandingStats();

  const stats = [
    {
      numericValue: totalWorks,
      label: "Peraturan",
      detail: `11 jenis peraturan, dari ${minYear} hingga ${maxYear}`,
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
