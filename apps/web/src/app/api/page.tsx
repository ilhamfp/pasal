import Header from "@/components/Header";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/search",
    description: "Cari peraturan berdasarkan kata kunci",
    params: [
      { name: "q", required: true, description: "Kata kunci pencarian" },
      { name: "type", required: false, description: "Filter jenis peraturan (UU, PP, PERPRES)" },
      { name: "limit", required: false, description: "Jumlah hasil (default: 10, max: 50)" },
    ],
    example: "/api/v1/search?q=upah+minimum&type=UU&limit=5",
  },
  {
    method: "GET",
    path: "/api/v1/laws",
    description: "Daftar peraturan dengan filter",
    params: [
      { name: "type", required: false, description: "Jenis peraturan (UU, PP, PERPRES)" },
      { name: "year", required: false, description: "Filter tahun" },
      { name: "status", required: false, description: "Filter status (berlaku, dicabut, diubah)" },
      { name: "limit", required: false, description: "Jumlah hasil (default: 20, max: 100)" },
      { name: "offset", required: false, description: "Offset untuk pagination (default: 0)" },
    ],
    example: "/api/v1/laws?type=UU&year=2003",
  },
  {
    method: "GET",
    path: "/api/v1/laws/{frbr_uri}",
    description: "Detail lengkap satu peraturan beserta pasal dan relasinya",
    params: [],
    example: "/api/v1/laws/akn/id/act/uu/2003/13",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-heading text-3xl mb-2">API Dokumentasi</h1>
        <p className="text-muted-foreground mb-8">
          API publik Pasal.id untuk mengakses data peraturan Indonesia. Gratis,
          tanpa autentikasi, mendukung CORS.
        </p>

        <div className="rounded-lg border bg-card p-4 mb-8">
          <h2 className="font-semibold text-sm mb-2">Base URL</h2>
          <code className="text-sm bg-muted px-2 py-1 rounded">
            https://pasal.id/api/v1
          </code>
        </div>

        <div className="space-y-8">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="rounded-lg border">
              <div className="border-b p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded">
                    {ep.method}
                  </span>
                  <code className="text-sm font-medium">{ep.path}</code>
                </div>
                <p className="text-sm text-muted-foreground">{ep.description}</p>
              </div>

              {ep.params.length > 0 && (
                <div className="border-b p-4">
                  <h3 className="text-sm font-semibold mb-2">Parameter</h3>
                  <div className="space-y-2">
                    {ep.params.map((p) => (
                      <div key={p.name} className="flex items-start gap-2 text-sm">
                        <code className="bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {p.name}
                        </code>
                        {p.required && (
                          <span className="text-xs text-destructive font-medium shrink-0">
                            wajib
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {p.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4">
                <h3 className="text-sm font-semibold mb-2">Contoh</h3>
                <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                  {ep.example}
                </code>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg border p-6">
          <h2 className="font-semibold mb-3">Contoh Penggunaan</h2>
          <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
{`# Cari peraturan tentang ketenagakerjaan
curl "https://pasal.id/api/v1/search?q=ketenagakerjaan"

# Daftar semua UU
curl "https://pasal.id/api/v1/laws?type=UU"

# Detail UU 13/2003 (Ketenagakerjaan)
curl "https://pasal.id/api/v1/laws/akn/id/act/uu/2003/13"

# Gunakan di JavaScript
const res = await fetch("https://pasal.id/api/v1/search?q=upah+minimum");
const data = await res.json();
console.log(data.results);`}
          </pre>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            API ini bersifat publik dan gratis. Kami menerapkan rate limiting untuk
            menjaga kualitas layanan. Untuk integrasi AI, gunakan{" "}
            <a href="/connect" className="text-primary hover:underline">
              MCP Server
            </a>{" "}
            kami.
          </p>
        </div>
      </main>
    </div>
  );
}
