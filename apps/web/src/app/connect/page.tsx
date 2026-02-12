import Link from "next/link";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CopyButton from "@/components/CopyButton";

const MCP_URL = "https://pasal-mcp-server-production.up.railway.app/mcp/";
const INSTALL_CMD = `claude mcp add pasal-id --transport http --url ${MCP_URL}`;

const EXAMPLE_PROMPTS = [
  "Jelaskan Pasal 81 UU Cipta Kerja tentang ketenagakerjaan",
  "Apakah UU Perkawinan 1974 masih berlaku?",
  "Apa hak pekerja kontrak menurut hukum Indonesia?",
  "Berapa usia minimum menikah di Indonesia?",
  "Bandingkan hak pekerja sebelum dan sesudah UU Cipta Kerja",
];

export default function ConnectPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      <main className="container mx-auto max-w-2xl px-4 py-12">
        <div className="space-y-8">
          {/* Hero */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold">Hubungkan Pasal.id ke Claude</h1>
            <p className="text-lg text-muted-foreground">
              Berikan Claude akses langsung ke hukum Indonesia — tanpa halusinasi,
              dengan sitasi nyata.
            </p>
          </div>

          {/* Install command */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perintah Instalasi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {INSTALL_CMD}
                </code>
                <CopyButton text={INSTALL_CMD} label="Salin" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Jalankan perintah ini di terminal Claude Code atau tambahkan di
                pengaturan Claude Desktop.
              </p>
            </CardContent>
          </Card>

          {/* Example prompts */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Coba Sekarang</h2>
            <div className="space-y-3">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <Card key={i} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="text-sm">&ldquo;{prompt}&rdquo;</p>
                    <CopyButton text={prompt} label="Salin" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* What is MCP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apa itu MCP?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Model Context Protocol (MCP) adalah standar terbuka yang memungkinkan
                AI seperti Claude untuk mengakses data eksternal secara aman.
              </p>
              <p>
                Dengan MCP, Claude dapat mencari undang-undang, membaca pasal tertentu,
                dan memeriksa status hukum — langsung dari database Pasal.id.
              </p>
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Pelajari lebih lanjut tentang MCP →
              </a>
            </CardContent>
          </Card>

          {/* CTA to search */}
          <div className="text-center pt-4">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Coba cari hukum Indonesia →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
