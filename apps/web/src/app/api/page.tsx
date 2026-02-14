import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "API Dokumentasi",
  description:
    "API publik Pasal.id untuk mengakses data peraturan Indonesia. Gratis, tanpa autentikasi, mendukung CORS.",
  openGraph: {
    title: "API Dokumentasi — Pasal.id",
    description:
      "API publik Pasal.id untuk mengakses data peraturan Indonesia. Gratis, tanpa autentikasi.",
  },
};

const REGULATION_TYPES = [
  { code: "UU", name: "Undang-Undang", desc: "Undang-undang yang disahkan DPR" },
  { code: "PP", name: "Peraturan Pemerintah", desc: "Peraturan pelaksana UU" },
  { code: "PERPRES", name: "Peraturan Presiden", desc: "Peraturan eksekutif presiden" },
  { code: "PERPPU", name: "Perpu", desc: "Peraturan Pemerintah Pengganti UU" },
  { code: "PERMEN", name: "Peraturan Menteri", desc: "Peraturan kementerian" },
  { code: "KEPPRES", name: "Keputusan Presiden", desc: "Keputusan presiden" },
  { code: "INPRES", name: "Instruksi Presiden", desc: "Instruksi presiden" },
  { code: "PERDA", name: "Peraturan Daerah", desc: "Peraturan daerah" },
  { code: "PERDA_PROV", name: "Perda Provinsi", desc: "Peraturan daerah tingkat provinsi" },
  { code: "PERDA_KAB", name: "Perda Kabupaten/Kota", desc: "Peraturan daerah kabupaten/kota" },
  { code: "UUD", name: "UUD 1945", desc: "Undang-Undang Dasar 1945" },
  { code: "TAP_MPR", name: "Ketetapan MPR", desc: "Ketetapan Majelis Permusyawaratan Rakyat" },
  { code: "PERMA", name: "Peraturan MA", desc: "Peraturan Mahkamah Agung" },
  { code: "PBI", name: "Peraturan BI", desc: "Peraturan Bank Indonesia" },
  { code: "PENPRES", name: "Penetapan Presiden", desc: "Penetapan presiden" },
  { code: "KEPMEN", name: "Keputusan Menteri", desc: "Keputusan menteri" },
  { code: "SE", name: "Surat Edaran", desc: "Surat edaran" },
  { code: "PERBAN", name: "Peraturan Badan/Lembaga", desc: "Peraturan badan atau lembaga" },
  { code: "PERMENKUMHAM", name: "Permen Hukum dan HAM", desc: "Peraturan Menteri Hukum dan HAM" },
  { code: "PERMENKUM", name: "Permen Hukum", desc: "Peraturan Menteri Hukum" },
  { code: "UUDRT", name: "UU Darurat", desc: "Undang-Undang Darurat" },
  { code: "UUDS", name: "UUD Sementara", desc: "Undang-Undang Dasar Sementara" },
];

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/search",
    description: "Cari peraturan berdasarkan kata kunci. Menggunakan full-text search dengan fallback otomatis.",
    params: [
      { name: "q", required: true, description: "Kata kunci pencarian" },
      {
        name: "type",
        required: false,
        description: "Filter jenis peraturan — lihat daftar kode di bawah",
      },
      { name: "limit", required: false, description: "Jumlah hasil (default: 10, max: 50)" },
    ],
    exampleRequest: `curl "https://pasal.id/api/v1/search?q=upah+minimum&type=UU&limit=3"`,
    exampleResponse: `{
  "query": "upah minimum",
  "total": 3,
  "results": [
    {
      "id": 142,
      "snippet": "Upah minimum sebagaimana dimaksud dalam ayat (1) ditetapkan oleh Gubernur...",
      "metadata": {
        "type": "UU",
        "node_type": "pasal",
        "node_number": "89"
      },
      "score": 0.85,
      "work": {
        "frbr_uri": "/akn/id/act/uu/2003/13",
        "title": "Ketenagakerjaan",
        "number": "13",
        "year": 2003,
        "status": "berlaku",
        "type": "UU"
      }
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/laws",
    description: "Daftar peraturan dengan filter jenis, tahun, dan status. Mendukung pagination.",
    params: [
      {
        name: "type",
        required: false,
        description: "Filter jenis peraturan — lihat daftar kode di bawah",
      },
      { name: "year", required: false, description: "Filter tahun (contoh: 2023)" },
      {
        name: "status",
        required: false,
        description: "Filter status: berlaku, dicabut, atau diubah",
      },
      { name: "limit", required: false, description: "Jumlah hasil (default: 20, max: 100)" },
      { name: "offset", required: false, description: "Offset untuk pagination (default: 0)" },
    ],
    exampleRequest: `curl "https://pasal.id/api/v1/laws?type=UU&year=2003&limit=2"`,
    exampleResponse: `{
  "total": 5,
  "limit": 2,
  "offset": 0,
  "laws": [
    {
      "id": 1,
      "frbr_uri": "/akn/id/act/uu/2003/13",
      "title": "Ketenagakerjaan",
      "number": "13",
      "year": 2003,
      "status": "berlaku",
      "content_verified": true,
      "type": "UU"
    },
    {
      "id": 7,
      "frbr_uri": "/akn/id/act/uu/2003/17",
      "title": "Keuangan Negara",
      "number": "17",
      "year": 2003,
      "status": "berlaku",
      "content_verified": true,
      "type": "UU"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/laws/{frbr_uri}",
    description:
      "Detail lengkap satu peraturan: metadata, daftar pasal beserta isi, dan relasi ke peraturan lain.",
    params: [
      {
        name: "frbr_uri",
        required: true,
        description: "Path FRBR URI, contoh: akn/id/act/uu/2003/13",
      },
    ],
    exampleRequest: `curl "https://pasal.id/api/v1/laws/akn/id/act/uu/2003/13"`,
    exampleResponse: `{
  "work": {
    "id": 1,
    "frbr_uri": "/akn/id/act/uu/2003/13",
    "title": "Ketenagakerjaan",
    "number": "13",
    "year": 2003,
    "status": "berlaku",
    "content_verified": true,
    "type": "UU",
    "type_name": "Undang-Undang",
    "source_url": "https://peraturan.go.id/..."
  },
  "articles": [
    {
      "id": 10,
      "type": "bab",
      "number": "I",
      "heading": "KETENTUAN UMUM",
      "content": null,
      "parent_id": null,
      "sort_order": 1
    },
    {
      "id": 11,
      "type": "pasal",
      "number": "1",
      "heading": null,
      "content": "Dalam undang-undang ini yang dimaksud dengan: 1. Ketenagakerjaan adalah...",
      "parent_id": 10,
      "sort_order": 2
    }
  ],
  "relationships": [
    {
      "type": "Mengubah",
      "type_en": "Amends",
      "related_work": {
        "frbr_uri": "/akn/id/act/uu/1969/14",
        "title": "Ketentuan-Ketentuan Pokok Mengenai Tenaga Kerja",
        "number": "14",
        "year": 1969,
        "status": "dicabut"
      }
    }
  ]
}`,
  },
];

function CodeBlock({ children, title }: { children: string; title: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5 font-sans">{title}</p>
      <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

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
          <h2 className="font-heading text-sm mb-2">Base URL</h2>
          <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
            https://pasal.id/api/v1
          </code>
        </div>

        {/* Endpoints */}
        <h2 className="font-heading text-2xl mb-4">Endpoint</h2>
        <div className="space-y-8 mb-12">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="rounded-lg border bg-card" id={ep.path.replace(/[/{}.]/g, "-")}>
              <div className="border-b p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-primary/10 text-primary text-xs font-bold font-mono px-2 py-0.5 rounded">
                    {ep.method}
                  </span>
                  <code className="text-sm font-medium font-mono">{ep.path}</code>
                </div>
                <p className="text-sm text-muted-foreground">{ep.description}</p>
              </div>

              {ep.params.length > 0 && (
                <div className="border-b p-4">
                  <h3 className="text-sm font-heading mb-2">Parameter</h3>
                  <div className="space-y-2">
                    {ep.params.map((p) => (
                      <div key={p.name} className="flex items-start gap-2 text-sm">
                        <code className="bg-muted px-1.5 py-0.5 rounded shrink-0 font-mono text-xs">
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

              <div className="p-4 space-y-4">
                <CodeBlock title="Contoh request">{ep.exampleRequest}</CodeBlock>
                <CodeBlock title="Contoh response">{ep.exampleResponse}</CodeBlock>
              </div>
            </div>
          ))}
        </div>

        {/* Regulation Types Reference */}
        <h2 className="font-heading text-2xl mb-4" id="jenis-peraturan">
          Kode Jenis Peraturan
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Gunakan kode berikut pada parameter{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">type</code>{" "}
          di endpoint <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/search</code>{" "}
          dan <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/laws</code>.
          Tidak case-sensitive — <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">uu</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">UU</code>, dan{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Uu</code> semua valid.
        </p>
        <div className="rounded-lg border bg-card overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-sans font-semibold w-36">Kode</th>
                  <th className="text-left p-3 font-sans font-semibold">Nama</th>
                  <th className="text-left p-3 font-sans font-semibold hidden sm:table-cell">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {REGULATION_TYPES.map((rt) => (
                  <tr key={rt.code} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                        {rt.code}
                      </code>
                    </td>
                    <td className="p-3 font-medium">{rt.name}</td>
                    <td className="p-3 text-muted-foreground hidden sm:table-cell">{rt.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Values */}
        <h2 className="font-heading text-2xl mb-4" id="status">
          Nilai Status
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Gunakan pada parameter{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">status</code>{" "}
          di endpoint <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">/laws</code>.
        </p>
        <div className="rounded-lg border bg-card overflow-hidden mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-sans font-semibold w-36">Nilai</th>
                <th className="text-left p-3 font-sans font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">berlaku</code>
                </td>
                <td className="p-3 text-muted-foreground">Peraturan masih berlaku (in force)</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">dicabut</code>
                </td>
                <td className="p-3 text-muted-foreground">Peraturan telah dicabut (revoked)</td>
              </tr>
              <tr>
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">diubah</code>
                </td>
                <td className="p-3 text-muted-foreground">Peraturan telah diubah/diamandemen (amended)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Quick Start */}
        <h2 className="font-heading text-2xl mb-4">Mulai Cepat</h2>
        <div className="rounded-lg border bg-card p-6 mb-12 space-y-4">
          <CodeBlock title="Cari peraturan tentang ketenagakerjaan">
            {`curl "https://pasal.id/api/v1/search?q=ketenagakerjaan"`}
          </CodeBlock>
          <CodeBlock title="Daftar semua Peraturan Pemerintah tahun 2020">
            {`curl "https://pasal.id/api/v1/laws?type=PP&year=2020"`}
          </CodeBlock>
          <CodeBlock title="Detail UU 13/2003 (Ketenagakerjaan) dengan semua pasal">
            {`curl "https://pasal.id/api/v1/laws/akn/id/act/uu/2003/13"`}
          </CodeBlock>
          <CodeBlock title="Gunakan di JavaScript / TypeScript">
            {`const res = await fetch("https://pasal.id/api/v1/search?q=upah+minimum");
const data = await res.json();

// data.results berisi array hasil pencarian
for (const result of data.results) {
  console.log(result.work.title, "—", result.metadata.node_type, result.metadata.node_number);
  console.log(result.snippet);
}`}
          </CodeBlock>
          <CodeBlock title="Gunakan di Python">
            {`import requests

res = requests.get("https://pasal.id/api/v1/laws", params={"type": "UU", "limit": 5})
data = res.json()

for law in data["laws"]:
    print(f"{law['type']} {law['number']}/{law['year']} — {law['title']}")`}
          </CodeBlock>
        </div>

        {/* Error Responses */}
        <h2 className="font-heading text-2xl mb-4">Error Response</h2>
        <div className="rounded-lg border bg-card overflow-hidden mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-sans font-semibold w-20">Kode</th>
                <th className="text-left p-3 font-sans font-semibold">Keterangan</th>
                <th className="text-left p-3 font-sans font-semibold hidden sm:table-cell">Contoh</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">400</code>
                </td>
                <td className="p-3 text-muted-foreground">Parameter tidak valid atau tidak lengkap</td>
                <td className="p-3 hidden sm:table-cell">
                  <code className="text-xs font-mono text-muted-foreground">{`{"error": "Missing required parameter: q"}`}</code>
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">404</code>
                </td>
                <td className="p-3 text-muted-foreground">Peraturan tidak ditemukan</td>
                <td className="p-3 hidden sm:table-cell">
                  <code className="text-xs font-mono text-muted-foreground">{`{"error": "Law not found: /akn/id/act/uu/2099/1"}`}</code>
                </td>
              </tr>
              <tr>
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">429</code>
                </td>
                <td className="p-3 text-muted-foreground">Terlalu banyak request</td>
                <td className="p-3 hidden sm:table-cell">
                  <code className="text-xs font-mono text-muted-foreground">{`{"error": "Too many requests"}`}</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rate Limiting */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="font-heading text-xl">Rate Limit</h2>
          <p className="text-sm text-muted-foreground">
            API ini <strong className="text-foreground">gratis</strong> dan terbuka untuk semua.
            Untuk menjaga kualitas layanan, kami menerapkan batas berikut:
          </p>
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Request per menit</span>
              <span className="font-mono font-medium">60</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Request per hari</span>
              <span className="font-mono font-medium">1.000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Autentikasi</span>
              <span className="font-mono font-medium">Tidak diperlukan</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CORS</span>
              <span className="font-mono font-medium">Semua origin (*)</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Request yang melebihi batas akan mendapat respons{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">429 Too Many Requests</code>.
          </p>
        </div>

        {/* Contact for higher limits */}
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-3">
          <h2 className="font-heading text-xl">Butuh limit lebih besar?</h2>
          <p className="text-sm text-muted-foreground">
            Jika Anda membangun aplikasi yang memerlukan akses lebih banyak, kami siap membantu.
            Hubungi kami untuk mendiskusikan kebutuhan Anda — termasuk API key khusus dan batas yang lebih besar.
          </p>
          <a
            href="mailto:hello@pasal.id"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-sans font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Hubungi kami
          </a>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            Untuk integrasi AI, gunakan{" "}
            <a href="/connect" className="text-primary hover:underline">
              MCP Server
            </a>{" "}
            kami — akses langsung dari Claude tanpa perlu menulis kode.
          </p>
        </div>
      </main>
    </div>
  );
}
