export const revalidate = 3600; // ISR: 1 hour

import type { Metadata } from "next";
import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { Link } from "@/i18n/routing";
import { Search } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import HeroSection from "@/components/landing/HeroSection";
import StatsSection from "@/components/landing/StatsSection";
import CuratedLaws from "@/components/landing/CuratedLaws";
import BrowseSection from "@/components/landing/BrowseSection";
import { getAlternates } from "@/lib/i18n-metadata";

const TrustBlock = nextDynamic(() => import("@/components/landing/TrustBlock"));
const RevealOnScroll = nextDynamic(() => import("@/components/landing/RevealOnScroll"));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "metadata" });

  return {
    title: { absolute: t("siteTitle") },
    description: t("siteDescription"),
    alternates: getAlternates("/", locale),
  };
}

const STATS_SKELETON = (
  <section className="border-y bg-card py-12 sm:py-16">
    <div className="mx-auto max-w-5xl px-4">
      <div className="mx-auto mb-8 h-4 w-56 rounded bg-muted animate-pulse" />
      <div className="grid gap-8 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-10 w-20 rounded bg-muted animate-pulse" />
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

const CURATED_SKELETON = (
  <section className="border-b py-16 sm:py-20">
    <div className="mx-auto max-w-5xl px-4">
      <div className="mx-auto h-10 w-64 rounded bg-muted animate-pulse" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    </div>
  </section>
);

const BROWSE_SKELETON = (
  <section className="border-b bg-card py-16 sm:py-20">
    <div className="mx-auto max-w-5xl px-4">
      <div className="mx-auto h-10 w-64 rounded bg-muted animate-pulse" />
      <div className="mt-10 grid gap-3 grid-cols-2 sm:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-28 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    </div>
  </section>
);

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const [metaT, devT, ctaT] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "metadata" }),
    getTranslations({ locale: locale as Locale, namespace: "developer" }),
    getTranslations({ locale: locale as Locale, namespace: "cta" }),
  ]);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pasal.id",
    url: "https://pasal.id",
    description: metaT("siteDescription"),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://pasal.id/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: "Pasal.id",
      url: "https://pasal.id",
      logo: {
        "@type": "ImageObject",
        url: "https://pasal.id/android-chrome-512.png",
        width: 512,
        height: 512,
      },
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd data={websiteLd} />

      {/* 1. Hero — staggered reveal on load */}
      <HeroSection />

      {/* 2. Stats — numbers count up on scroll */}
      <Suspense fallback={STATS_SKELETON}>
        <StatsSection />
      </Suspense>

      {/* 3. Peraturan Populer — carousel with auto-advance */}
      <Suspense fallback={CURATED_SKELETON}>
        <CuratedLaws />
      </Suspense>

      {/* 4. Browse by Type — regulation type cards */}
      <Suspense fallback={BROWSE_SKELETON}>
        <BrowseSection />
      </Suspense>

      {/* 5. Trust Block — staggered items on scroll */}
      <TrustBlock />

      {/* 6. Developer CTAs — reveal on scroll */}
      <RevealOnScroll>
        <section className="border-y bg-card py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {devT("sectionLabel")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* MCP Card */}
              <Link
                href="/connect"
                className="rounded-lg bg-[#1D1A18] p-6 transition-colors hover:bg-[#2D2826]"
              >
                <p className="mb-3 font-medium text-[#EEE8E4]">
                  {devT("mcpTitle")}
                </p>
                <code className="block break-all rounded bg-black/30 px-3 py-2 font-mono text-sm text-[#96C3B1]">
                  claude mcp add --transport http pasal-id
                  https://pasal-mcp-server-production.up.railway.app/mcp
                </code>
                <p className="mt-3 text-sm text-[#958D88]">
                  {devT("mcpGuide")}
                </p>
              </Link>

              {/* API Card */}
              <Link
                href="/api"
                className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30"
              >
                <p className="mb-3 font-medium">{devT("apiTitle")}</p>
                <code className="block break-all rounded bg-muted px-3 py-2 font-mono text-sm">
                  curl https://pasal.id/api/v1/search?q=ketenagakerjaan
                </code>
                <p className="mt-3 text-sm text-muted-foreground">
                  {devT("apiDocs")}
                </p>
              </Link>
            </div>
          </div>
        </section>
      </RevealOnScroll>

      {/* 7. Final CTA — reveal on scroll */}
      <RevealOnScroll>
        <section className="py-20 sm:py-32">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="font-heading text-4xl tracking-tight sm:text-5xl">
              {ctaT("heading1")}
              <br />
              <em className="text-muted-foreground">
                {ctaT("heading2")}
              </em>
            </h2>
            <div className="mt-8">
              <Link
                href="/search"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
              >
                <Search className="mr-2 h-4 w-4" />
                {ctaT("searchNow")}
              </Link>
            </div>
          </div>
        </section>
      </RevealOnScroll>
    </div>
  );
}
