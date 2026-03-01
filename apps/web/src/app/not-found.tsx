import type { Metadata } from "next";
import Link from "next/link";
import PasalLogo from "@/components/PasalLogo";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan | Page Not Found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      {/* Giant faded § mark as the background "404" */}
      <div className="relative mb-4 sm:mb-8">
        <PasalLogo size={180} className="text-muted-foreground/10" />
        <span className="absolute inset-0 flex items-center justify-center font-heading text-5xl sm:text-6xl text-foreground">
          404
        </span>
      </div>

      <h1 className="font-heading text-3xl tracking-tight">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-1 text-lg text-muted-foreground/70">
        Page not found
      </p>
      <p className="mt-3 max-w-md text-muted-foreground">
        Pasal yang Anda cari mungkin telah dipindahkan, dicabut, atau tidak pernah ada.
      </p>
      <Link
        href="/"
        className="mt-4 sm:mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-4 sm:px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <PasalLogo size={18} />
        Kembali ke Beranda
      </Link>
    </div>
  );
}
