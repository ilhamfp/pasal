import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Database, FileText, MessageSquare, Quote, Scale, Search, ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import CopyButton from "@/components/CopyButton";
import MCPDemo from "@/components/connect/MCPDemo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Hubungkan ke Claude via MCP",
  description:
    "Berikan Claude akses langsung ke hukum Indonesia melalui Model Context Protocol (MCP). Tanpa halusinasi, dengan sitasi nyata.",
  openGraph: {
    title: "Hubungkan ke Claude via MCP | Pasal.id",
    description:
      "Berikan Claude akses langsung ke hukum Indonesia melalui Model Context Protocol (MCP).",
  },
};

const MCP_URL = "https://pasal-mcp-server-production.up.railway.app/mcp/";
const INSTALL_CMD = `claude mcp add pasal-id --transport http --url ${MCP_URL}`;

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "pasal-id": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-proxy", "https://pasal-mcp-server-production.up.railway.app/mcp/"]
    }
  }
}`;

const EXAMPLE_PROMPTS = [
  "Jelaskan Pasal 81 UU Cipta Kerja tentang ketenagakerjaan",
  "Apakah UU Perkawinan 1974 masih berlaku?",
  "Apa hak pekerja kontrak menurut hukum Indonesia?",
  "Berapa usia minimum menikah di Indonesia?",
  "Bandingkan hak pekerja sebelum dan sesudah UU Cipta Kerja",
];

const HOW_IT_WORKS_STEPS = [
  {
    icon: MessageSquare,
    title: "Ketik pertanyaan hukum",
    description: "Tanyakan apa saja tentang hukum Indonesia kepada Claude, dalam bahasa sehari-hari.",
  },
  {
    icon: Database,
    title: "MCP mencari database",
    description: "Claude secara otomatis memanggil Pasal.id untuk mencari peraturan yang relevan.",
  },
  {
    icon: Scale,
    title: "Dapatkan pasal yang tepat",
    description: "Sistem mengembalikan teks pasal asli beserta metadata dan status hukumnya.",
  },
  {
    icon: Quote,
    title: "Jawaban dengan sitasi",
    description: "Claude menjawab pertanyaan Anda dengan mengutip langsung dari sumber hukum resmi.",
  },
];

const MCP_TOOLS = [
  {
    name: "search_laws",
    description: "Cari peraturan berdasarkan topik",
    detail: "Pencarian teks penuh dengan stemmer bahasa Indonesia. Mendukung filter berdasarkan jenis peraturan dan tahun.",
    icon: Search,
  },
  {
    name: "get_pasal",
    description: "Ambil teks pasal tertentu",
    detail: "Dapatkan isi lengkap satu pasal beserta ayat-ayatnya dari undang-undang tertentu.",
    icon: FileText,
  },
  {
    name: "get_law_status",
    description: "Cek apakah UU masih berlaku",
    detail: "Periksa status hukum: berlaku, diubah, atau dicabut, beserta riwayat perubahannya.",
    icon: ShieldCheck,
  },
  {
    name: "list_laws",
    description: "Jelajahi daftar peraturan",
    detail: "Lihat daftar semua peraturan yang tersedia, dengan filter jenis dan paginasi.",
    icon: BookOpen,
  },
];

export default function ConnectPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Two-column hero: instructions + demo side by side */}
        <div className="max-w-6xl mx-auto mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left column: Connect instructions */}
            <div className="space-y-8">
              <div className="space-y-3">
                <h1 className="font-heading text-4xl tracking-tight text-pretty">
                  Hubungkan ke Claude
                </h1>
                <p className="text-lg text-muted-foreground">
                  Berikan Claude akses langsung ke hukum Indonesia, tanpa
                  halusinasi, dengan sitasi nyata.
                </p>
              </div>

              {/* Install Command — Claude Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-xl">
                    Claude Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Jalankan perintah ini di terminal Claude Code:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">
                      {INSTALL_CMD}
                    </code>
                    <CopyButton text={INSTALL_CMD} label="Salin" />
                  </div>
                </CardContent>
              </Card>

              {/* Claude Desktop JSON Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-xl">
                    Claude Desktop
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Tambahkan konfigurasi berikut ke file{" "}
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                      claude_desktop_config.json
                    </code>{" "}
                    Anda:
                  </p>
                  <div className="relative">
                    <pre className="rounded-lg bg-muted px-4 py-3 text-sm font-mono overflow-x-auto">
                      {CLAUDE_DESKTOP_CONFIG}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton text={CLAUDE_DESKTOP_CONFIG} label="Salin" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Buka Claude Desktop, masuk ke Settings &rarr; Developer
                    &rarr; Edit Config, lalu tempel konfigurasi di atas.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right column: Live MCP Demo */}
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="space-y-2">
                <h2 className="font-heading text-2xl tracking-tight text-pretty">
                  Lihat MCP Beraksi
                </h2>
                <p className="text-sm text-muted-foreground">
                  Demo otomatis: Claude menggunakan 4 tool Pasal.id untuk
                  menjawab pertanyaan hukum dengan kutipan akurat.
                </p>
              </div>
              <MCPDemo />
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-12">
          {/* Cara Kerjanya — How it works */}
          <section className="space-y-6">
            <h2 className="font-heading text-2xl tracking-tight text-center text-pretty">
              Cara Kerjanya
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOW_IT_WORKS_STEPS.map((item, i) => (
                <Card key={item.title}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-sans font-semibold">
                        {i + 1}
                      </div>
                      <item.icon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <h3 className="font-heading text-lg">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* MCP Tools Grid */}
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-heading text-2xl tracking-tight text-pretty">
                Tool yang Tersedia
              </h2>
              <p className="text-sm text-muted-foreground">
                Empat tool MCP yang dapat digunakan Claude untuk mengakses database hukum Indonesia.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MCP_TOOLS.map((tool) => (
                <Card key={tool.name}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <tool.icon className="w-5 h-5 text-primary" aria-hidden="true" />
                      <code className="font-mono text-sm text-primary">{tool.name}</code>
                    </div>
                    <p className="text-sm font-sans font-medium">{tool.description}</p>
                    <p className="text-xs text-muted-foreground">{tool.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Example Prompts */}
          <section id="coba-sekarang" className="space-y-6 scroll-mt-20">
            <h2 className="font-heading text-2xl tracking-tight text-center text-pretty">
              Coba Sekarang
            </h2>
            <div className="space-y-3">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <Card key={i} className="transition-colors hover:border-primary/30">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="text-sm">&ldquo;{prompt}&rdquo;</p>
                    <CopyButton text={prompt} label="Salin" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* What is MCP */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Apa itu MCP?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Model Context Protocol (MCP) adalah standar terbuka yang memungkinkan
                AI seperti Claude untuk mengakses data eksternal secara aman.
              </p>
              <p>
                Dengan MCP, Claude dapat mencari undang-undang, membaca pasal tertentu,
                dan memeriksa status hukum, langsung dari database Pasal.id.
              </p>
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Pelajari lebih lanjut tentang MCP &rarr;
              </a>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center pt-4">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-sans font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Coba cari hukum Indonesia &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

