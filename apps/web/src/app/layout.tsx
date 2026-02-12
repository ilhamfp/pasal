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
        <footer className="border-t mt-16 py-6 text-center text-xs text-muted-foreground px-4">
          <p>
            Konten ini bukan nasihat hukum. Selalu rujuk sumber resmi di{" "}
            <a href="https://peraturan.go.id" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              peraturan.go.id
            </a>{" "}
            untuk kepastian hukum.
          </p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Pasal.id — Platform Hukum Indonesia Terbuka</p>
        </footer>
      </body>
    </html>
  );
}
