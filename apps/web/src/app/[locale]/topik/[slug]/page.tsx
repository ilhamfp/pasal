import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ShareButton from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { getTopicBySlug, TOPICS } from "@/data/topics";
import { workSlug as makeWorkSlug } from "@/lib/work-url";
import { formatRegRef } from "@/lib/legal-status";
import { getAlternates } from "@/lib/i18n-metadata";

export const revalidate = 86400; // ISR: 24 hours

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) return {};

  const t = await getTranslations({ locale: locale as Locale, namespace: "topics" });

  const lawList = topic.relatedLaws
    .map((l) => formatRegRef(l.type, l.number, l.year, { label: "compact" }))
    .join(", ");

  return {
    title: `${topic.title}: ${t("guideSuffix")}`,
    description: `${topic.description} ${lawList}.`,
    alternates: getAlternates(`/topik/${slug}`, locale),
    openGraph: {
      title: `${topic.title}: ${t("guideSuffix")}`,
      description: topic.description,
    },
  };
}

export default async function TopicDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const topic = getTopicBySlug(slug);
  if (!topic) notFound();

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
          { "@type": "ListItem", position: 1, name: navT("home"), item: locale === "en" ? "https://pasal.id/en" : "https://pasal.id" },
          { "@type": "ListItem", position: 2, name: navT("topics"), item: locale === "en" ? "https://pasal.id/en/topik" : "https://pasal.id/topik" },
          { "@type": "ListItem", position: 3, name: topic.title },
        ],
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: topic.questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: q.answerSummary
              ? q.answerSummary
              : q.pasal && q.lawRef
                ? `Diatur dalam Pasal ${q.pasal} ${q.lawRef}. Baca teks lengkap pasal tersebut di Pasal.id.`
                : `Cari jawaban lengkap untuk "${q.question}" di Pasal.id.`,
          },
        })),
      }} />

      <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-12">
        <PageBreadcrumb items={[
          { label: navT("home"), href: "/" },
          { label: navT("topics"), href: "/topik" },
          { label: topic.title },
        ]} />

        <div className="mb-6 sm:mb-10">
          <h1 className="font-heading text-3xl mb-2">{topic.title}</h1>
          <p className="text-muted-foreground text-lg">{topic.description}</p>
          <div className="mt-4">
            <ShareButton
              url={`https://pasal.id/topik/${slug}`}
              title={`${topic.title} — Panduan Hukum Indonesia`}
              description={topic.description}
            />
          </div>
        </div>

        <div className="mb-6 sm:mb-10">
          <h2 className="font-heading text-xl mb-4">{t("relatedRegulations")}</h2>
          <div className="flex flex-wrap gap-2">
            {topic.relatedLaws.map((law) => {
              const lawSlug = makeWorkSlug(law, law.type);
              return (
                <Link
                  key={lawSlug}
                  href={`/peraturan/${law.type.toLowerCase()}/${lawSlug}`}
                >
                  <Badge variant="secondary" className="hover:bg-primary/10 transition-colors cursor-pointer">
                    {formatRegRef(law.type, law.number, law.year, { label: "compact" })}: {law.title}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-xl mb-4">{t("commonQuestions")}</h2>
          <div className="space-y-4">
            {topic.questions.map((q, i) => (
              <div key={i} className="rounded-lg border bg-card p-5">
                <h3 className="font-medium mb-2">{q.question}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/search?q=${encodeURIComponent(q.searchQuery)}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("searchAnswer")}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                  {q.pasal && q.lawRef && (
                    <span className="text-xs text-muted-foreground">
                      {t("seeArticle", { pasal: q.pasal, lawRef: q.lawRef })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
