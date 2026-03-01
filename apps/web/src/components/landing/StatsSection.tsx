import { getTranslations } from "next-intl/server";
import { getLandingStats } from "@/lib/stats";
import AnimatedStats from "./AnimatedStats";
import RevealOnScroll from "./RevealOnScroll";

export default async function StatsSection() {
  const t = await getTranslations("stats");
  const { totalWorks, pasalCount, minYear, maxYear } = await getLandingStats();

  const stats = [
    {
      numericValue: totalWorks,
      label: t("regulations"),
      detail: t("regulationsDetail", { count: 11, minYear, maxYear }),
    },
    {
      numericValue: pasalCount,
      label: t("structuredArticles"),
      detail: t("structuredArticlesDetail"),
    },
    {
      displayValue: t("freeValue"),
      label: t("freeAndOpen"),
      detail: t("freeAndOpenDetail"),
    },
  ];

  return (
    <section className="border-y bg-card py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <p className="mb-4 sm:mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t("sectionLabel")}
        </p>
        <AnimatedStats stats={stats} />
      </div>
    </section>
  );
}
