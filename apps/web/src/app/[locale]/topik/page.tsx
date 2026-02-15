import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { Briefcase, Heart, Scale, Shield } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getAlternates } from "@/lib/i18n-metadata";
import Header from "@/components/Header";
import { TOPICS } from "@/data/topics";

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
      title: `${t("pageTitle")} | Pasal.id`,
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

  const t = await getTranslations("topics");

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl mb-3">{t("pageTitle")}</h1>
          <p className="text-muted-foreground text-lg">
            {t("pageDescription")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TOPICS.map((topic) => {
            const Icon = ICONS[topic.icon] || Scale;
            return (
              <Link key={topic.slug} href={`/topik/${topic.slug}`}>
                <div className="rounded-lg border bg-card p-6 hover:border-primary/30 transition-colors h-full">
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
                        {topic.relatedLaws.map((l) => `${l.type} ${l.number}/${l.year}`).join(", ")}
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
