import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pasal.id — Cari Hukum Indonesia",
  description:
    "Platform hukum Indonesia terbuka pertama berbasis AI. Cari undang-undang, peraturan pemerintah, dan peraturan lainnya.",
  openGraph: {
    title: "Pasal.id — Cari Hukum Indonesia",
    description:
      "Platform hukum Indonesia terbuka pertama berbasis AI.",
    url: "https://pasal.id",
    siteName: "Pasal.id",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
