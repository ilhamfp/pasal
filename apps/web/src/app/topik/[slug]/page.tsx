import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { getTopicBySlug, TOPICS } from "@/data/topics";
import { workSlug as makeWorkSlug } from "@/lib/work-url";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) return {};

  const lawList = topic.relatedLaws
    .map((l) => `${l.type} ${l.number}/${l.year}`)
    .join(", ");

  return {
    title: `${topic.title}: Panduan Hukum`,
    description: `${topic.description} Peraturan terkait: ${lawList}.`,
    openGraph: {
      title: `${topic.title}: Panduan Hukum | Pasal.id`,
      description: topic.description,
    },
  };
}

export default async function TopicDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) notFound();

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <Link
            href="/topik"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Semua Topik
          </Link>
        </div>

        <div className="mb-10">
          <h1 className="font-heading text-3xl mb-2">{topic.title}</h1>
          <p className="text-muted-foreground text-lg">{topic.description}</p>
        </div>

        <div className="mb-10">
          <h2 className="font-heading text-xl mb-4">Peraturan Terkait</h2>
          <div className="flex flex-wrap gap-2">
            {topic.relatedLaws.map((law) => {
              const lawSlug = makeWorkSlug(law, law.type);
              return (
                <Link
                  key={lawSlug}
                  href={`/peraturan/${law.type.toLowerCase()}/${lawSlug}`}
                >
                  <Badge variant="secondary" className="hover:bg-primary/10 transition-colors cursor-pointer">
                    {law.type} {law.number}/{law.year}: {law.title}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-xl mb-4">Pertanyaan Umum</h2>
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
                    Cari jawaban
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                  {q.pasal && q.lawRef && (
                    <span className="text-xs text-muted-foreground">
                      Lihat: Pasal {q.pasal} {q.lawRef}
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
