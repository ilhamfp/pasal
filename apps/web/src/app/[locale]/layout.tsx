import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { routing, Link } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import MotionProvider from "@/components/MotionProvider";
import PasalLogo from "@/components/PasalLogo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "metadata" });

  return {
    title: { default: t("siteTitle"), template: `%s | ${t("siteName")}` },
    description: t("siteDescription"),
    openGraph: {
      type: "website",
      locale: locale === "id" ? "id_ID" : "en_US",
      alternateLocale: locale === "id" ? ["en_US"] : ["id_ID"],
      url: "https://pasal.id",
      siteName: t("siteName"),
      title: t("siteTitle"),
      description: t("ogDescription"),
      images: [
        {
          url: "/api/og",
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("siteTitle"),
      description: t("ogDescription"),
      images: ["/api/og"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const [t, footerT, messages] = await Promise.all([
    getTranslations("navigation"),
    getTranslations("footer"),
    getMessages(),
  ]);

  const FOOTER_LINKS = [
    { href: "/" as const, label: t("home") },
    { href: "/jelajahi" as const, label: t("browse") },
    { href: "/search" as const, label: t("search") },
    { href: "/connect" as const, label: t("connect") },
    { href: "/api" as const, label: t("api") },
  ];

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>
      <NextIntlClientProvider messages={messages}>
        <MotionProvider>
          <main id="main-content">{children}</main>
        </MotionProvider>
        <footer className="border-t mt-16 py-8 px-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {FOOTER_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-3 text-xs text-muted-foreground">
              <PasalLogo size={24} className="text-muted-foreground/60" />
              <div className="space-y-1 text-center">
                <p>{footerT("disclaimer")}</p>
                <p suppressHydrationWarning>
                  {footerT("copyright", { year: new Date().getFullYear() })}
                </p>
              </div>
            </div>
          </div>
        </footer>
      </NextIntlClientProvider>
    </>
  );
}
