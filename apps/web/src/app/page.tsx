import { Suspense } from "react";
import SearchBar from "@/components/SearchBar";
import LawTypeChips from "@/components/LawTypeChips";
import StatsBar from "@/components/StatsBar";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
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

          <Link href="/connect" className="mt-8 rounded-lg border bg-card p-4 text-left max-w-xl w-full block hover:border-primary/50 transition-colors">
            <p className="text-sm font-medium mb-2">
              Hubungkan ke Claude untuk akses hukum berbasis AI:
            </p>
            <code className="block rounded bg-muted px-3 py-2 text-xs font-mono break-all">
              claude mcp add pasal-id --transport http --url
              https://pasal-mcp-server-production.up.railway.app/mcp/
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Klik untuk detail lebih lanjut →
            </p>
          </Link>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link href="https://github.com/ilhamfp/pasal" className="hover:underline">
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
