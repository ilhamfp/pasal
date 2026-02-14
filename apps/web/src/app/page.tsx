export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import HeroSection from "@/components/landing/HeroSection";
import StatsSection from "@/components/landing/StatsSection";
import CuratedLaws from "@/components/landing/CuratedLaws";
import BrowseSection from "@/components/landing/BrowseSection";
import TrustBlock from "@/components/landing/TrustBlock";
import RevealOnScroll from "@/components/landing/RevealOnScroll";

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Pasal.id",
  url: "https://pasal.id",
  description: "Platform hukum Indonesia terbuka pertama berbasis AI.",
  inLanguage: "id",
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
      url: "https://pasal.id/og-image.png",
    },
  },
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <JsonLd data={websiteLd} />

      {/* 1. Hero — staggered reveal on load */}
      <HeroSection />

      {/* 2. Stats — numbers count up on scroll */}
      <Suspense
        fallback={
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
        }
      >
        <StatsSection />
      </Suspense>

      {/* 3. Peraturan Populer — carousel with auto-advance */}
      <Suspense
        fallback={
          <section className="py-16 sm:py-20">
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
        }
      >
        <CuratedLaws />
      </Suspense>

      {/* 4. Browse by Type — regulation type cards */}
      <Suspense
        fallback={
          <section className="py-16 sm:py-20">
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
        }
      >
        <BrowseSection />
      </Suspense>

      {/* 5. Trust Block — staggered items on scroll */}
      <TrustBlock />

      {/* 6. Developer CTAs — reveal on scroll */}
      <RevealOnScroll>
        <section className="border-y bg-card py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Untuk Developer
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* MCP Card */}
              <Link
                href="/connect"
                className="rounded-lg bg-[#1D1A18] p-6 transition-colors hover:bg-[#2D2826]"
              >
                <p className="mb-3 font-medium text-[#EEE8E4]">
                  Hubungkan ke Claude via MCP
                </p>
                <code className="block break-all rounded bg-black/30 px-3 py-2 font-mono text-sm text-[#96C3B1]">
                  claude mcp add pasal-id --transport http --url
                  https://pasal-mcp-server-production.up.railway.app/mcp/
                </code>
                <p className="mt-3 text-sm text-[#958D88]">
                  Panduan lengkap &rarr;
                </p>
              </Link>

              {/* API Card */}
              <Link
                href="/api"
                className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30"
              >
                <p className="mb-3 font-medium">REST API</p>
                <code className="block break-all rounded bg-muted px-3 py-2 font-mono text-sm">
                  curl https://pasal.id/api/v1/search?q=ketenagakerjaan
                </code>
                <p className="mt-3 text-sm text-muted-foreground">
                  Dokumentasi API &rarr;
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
              Hukum yang mudah diakses
              <br />
              <em className="text-muted-foreground">
                adalah hak setiap warga
              </em>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
              Mulai dari satu pencarian.
            </p>
            <div className="mt-8">
              <Link
                href="/search"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
              >
                <Search className="mr-2 h-4 w-4" />
                Cari Sekarang
              </Link>
            </div>
          </div>
        </section>
      </RevealOnScroll>
    </div>
  );
}
