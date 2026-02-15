import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import PasalLogo from "@/components/PasalLogo";
import MotionProvider from "@/components/MotionProvider";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pasal.id"),
  title: {
    default: "Cari Hukum Indonesia | Pasal.id",
    template: "%s | Pasal.id",
  },
  description:
    "Cari undang-undang, PP, Perpres, dan peraturan Indonesia lainnya. Teks lengkap terstruktur per pasal dan ayat. Gratis dan open source.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#2B6150",
      },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Cari Hukum Indonesia | Pasal.id",
    description:
      "Cari undang-undang, PP, Perpres, dan peraturan Indonesia lainnya. Gratis dan open source.",
    url: "https://pasal.id",
    siteName: "Pasal.id",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pasal.id: Cari hukum Indonesia dengan mudah",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cari Hukum Indonesia | Pasal.id",
    description:
      "Cari undang-undang, PP, Perpres, dan peraturan Indonesia lainnya. Gratis dan open source.",
    images: ["/og-image.png"],
  },
  other: {
    "msapplication-TileColor": "#F8F5F0",
    "msapplication-TileImage": "/mstile-150x150.png",
  },
};

const FOOTER_LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/jelajahi", label: "Jelajahi" },
  { href: "/topik", label: "Topik" },
  { href: "/connect", label: "Hubungkan Claude" },
  { href: "/api", label: "API" },
] as const;

const footerLinkClass = "text-muted-foreground hover:text-foreground transition-colors";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <meta name="theme-color" content="#F8F5F0" />
      </head>
      <body
        className={`${instrumentSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Langsung ke konten utama
        </a>
        <MotionProvider>
          <main id="main-content">{children}</main>
        </MotionProvider>
        <footer className="border-t mt-16 py-8 px-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {FOOTER_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className={footerLinkClass}>{label}</Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-3 text-xs text-muted-foreground">
              <PasalLogo size={24} className="text-muted-foreground/60" />
              <div className="space-y-1 text-center">
                <p>
                  Konten ini bukan nasihat hukum. Selalu rujuk sumber resmi untuk kepastian hukum.
                </p>
                <p suppressHydrationWarning>&copy; {new Date().getFullYear()} Pasal.id. Platform Hukum Indonesia Terbuka</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
