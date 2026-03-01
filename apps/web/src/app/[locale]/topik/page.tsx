import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { Briefcase, Heart, Scale, Shield } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getAlternates } from "@/lib/i18n-metadata";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { TOPICS } from "@/data/topics";
import { formatRegRef } from "@/lib/legal-status";

export const revalidate = 86400; // ISR: 24 hours

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "topics" });
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: getAlternates("/topik", locale),
    openGraph: {
      title: t("pageTitle"),
      description: t("pageDescription"),
    },
  };
}

const ICONS: Record<string, React.ElementType> = {
  Briefcase,
  Heart,
  Shield,
  Scale,
};

export default async function TopicsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const [t, navT] = await Promise.all([
    getTranslations("topics"),
    getTranslations("navigation"),
  ]);

  return (
    <div className="min-h-screen">
      <Header />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: navT("home"), item: "https://pasal.id" },
          { "@type": "ListItem", position: 2, name: t("pageTitle") },
        ],
      }} />

      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-12">
        <PageBreadcrumb items={[
          { label: navT("home"), href: "/" },
          { label: t("pageTitle") },
        ]} />
        <div className="text-center mb-6 sm:mb-10">
          <h1 className="font-heading text-3xl mb-3">{t("pageTitle")}</h1>
          <p className="text-muted-foreground text-lg">
            {t("pageDescription")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {TOPICS.map((topic) => {
            const Icon = ICONS[topic.icon] || Scale;
            return (
              <Link key={topic.slug} href={`/topik/${topic.slug}`}>
                <div className="rounded-lg border bg-card p-4 sm:p-6 hover:border-primary/30 transition-colors h-full">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-heading text-xl mb-1">{topic.title}</h2>
                      <p className="text-sm text-muted-foreground mb-3">
                        {topic.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("questionsCount", { count: topic.questions.length })} •{" "}
                        {topic.relatedLaws.map((l) => formatRegRef(l.type, l.number, l.year, { label: "compact" })).join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
