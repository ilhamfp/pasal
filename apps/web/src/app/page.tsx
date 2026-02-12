import { Suspense } from "react";
import SearchBar from "@/components/SearchBar";
import LawTypeChips from "@/components/LawTypeChips";
import StatsBar from "@/components/StatsBar";
import Link from "next/link";
import {
  Scale,
  BookOpen,
  Link as LinkIcon,
  Search,
  FileCheck,
  Shield,
  Code,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero Section ── */}
      <main className="flex flex-col items-center justify-center px-4 pb-24 pt-24 sm:pt-32">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="space-y-3">
            <h1 className="font-heading text-5xl tracking-tight sm:text-6xl">
              Pasal<span className="text-primary/60">.id</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Cari hukum Indonesia dengan mudah
            </p>
          </div>

          <SearchBar autoFocus />

          <LawTypeChips />

          <Suspense
            fallback={
              <div className="text-sm text-muted-foreground">Memuat...</div>
            }
          >
            <StatsBar />
          </Suspense>

          <Link
            href="/connect"
            className="mt-8 block w-full max-w-xl rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50"
          >
            <p className="mb-2 text-sm font-medium">
              Hubungkan ke Claude untuk akses hukum berbasis AI:
            </p>
            <code className="block break-all rounded bg-muted px-3 py-2 font-mono text-xs">
              claude mcp add pasal-id --transport http --url
              https://pasal-mcp-server-production.up.railway.app/mcp/
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Klik untuk detail lebih lanjut →
            </p>
          </Link>
        </div>
      </main>

      {/* ── Live Stats Bar (full-width) ── */}
      <section className="border-y bg-card py-6">
        <div className="mx-auto max-w-5xl px-4">
          <Suspense
            fallback={
              <div className="text-center text-sm text-muted-foreground">
                Memuat statistik...
              </div>
            }
          >
            <StatsBar />
          </Suspense>
        </div>
      </section>

      {/* ── Untuk Siapa? ── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-heading text-center text-3xl tracking-tight sm:text-4xl">
            Untuk Siapa?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Platform hukum terbuka untuk semua
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Warga Negara</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Cari tahu hak Anda tanpa jargon hukum
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Profesional Hukum</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Riset cepat dengan kutipan pasal yang akurat
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <LinkIcon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Developer</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                API &amp; MCP server untuk integrasi AI
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bagaimana Cara Kerjanya? ── */}
      <section className="border-y bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-heading text-center text-3xl tracking-tight sm:text-4xl">
            Bagaimana Cara Kerjanya?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Tiga langkah menuju jawaban hukum
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-heading text-xl">
                1
              </div>
              <h3 className="mt-4 font-heading text-xl">Ketik Pertanyaan</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Tulis pertanyaan hukum Anda dalam bahasa sehari-hari
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-heading text-xl">
                2
              </div>
              <h3 className="mt-4 font-heading text-xl">AI Mencari Database</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Sistem pencarian cerdas menelusuri ribuan pasal peraturan
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-heading text-xl">
                3
              </div>
              <h3 className="mt-4 font-heading text-xl">
                Jawaban dengan Sitasi
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Dapatkan jawaban lengkap dengan rujukan pasal yang tepat
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fitur Utama ── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-heading text-center text-3xl tracking-tight sm:text-4xl">
            Fitur Utama
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Dibangun untuk kebutuhan hukum Indonesia
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Pencarian Cerdas</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Full-text search dengan stemmer Bahasa Indonesia untuk hasil
                pencarian yang relevan
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Sitasi Akurat</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Rujukan presisi ke Pasal X UU No. Y Tahun Z, langsung dari
                sumber resmi
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Status Hukum</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Ketahui apakah peraturan masih berlaku, telah diubah, atau sudah
                dicabut
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/30">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Code className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-heading text-xl">Open Source</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Kode terbuka, data publik. Siapa saja bisa berkontribusi dan
                memverifikasi
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="border-t bg-card py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="font-heading text-3xl tracking-tight sm:text-4xl">
            Mulai Sekarang
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Akses hukum Indonesia yang terbuka, gratis, dan mudah dipahami
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/search"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
            >
              <Search className="mr-2 h-4 w-4" />
              Mulai Cari
            </Link>
            <Link
              href="/connect"
              className="inline-flex h-12 items-center justify-center rounded-lg border bg-background px-8 font-sans text-sm font-semibold text-foreground transition-colors hover:border-primary/50"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Hubungkan ke Claude
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link
            href="https://github.com/ilhamfp/pasal"
            className="hover:underline"
          >
            Open Source
          </Link>
          <span aria-hidden="true">·</span>
          <span>Gratis Selamanya</span>
          <span aria-hidden="true">·</span>
          <span>Powered by Claude</span>
        </div>
      </footer>
    </div>
  );
}
