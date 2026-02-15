import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getAlternates } from "@/lib/i18n-metadata";
import Header from "@/components/Header";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "apiDocs" });
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: getAlternates("/api", locale),
    openGraph: {
      title: `${t("pageTitle")} | Pasal.id`,
      description: t("pageDescription"),
    },
  };
}

const REGULATION_TYPES = [
  "UU", "PP", "PERPRES", "PERPPU", "PERMEN", "KEPPRES", "INPRES", "PERDA",
  "PERDA_PROV", "PERDA_KAB", "UUD", "TAP_MPR", "PERMA", "PBI", "PENPRES",
  "KEPMEN", "SE", "PERBAN", "PERMENKUMHAM", "PERMENKUM", "UUDRT", "UUDS",
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

export default async function ApiDocsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("apiDocs");
  const regTypeT = await getTranslations("regulationType");

  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/search",
      description: t("searchDesc"),
      params: [
        { name: "q", required: true, description: t("searchParamQ") },
        { name: "type", required: false, description: t("searchParamType") },
        { name: "limit", required: false, description: t("searchParamLimit") },
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
      description: t("lawsDesc"),
      params: [
        { name: "type", required: false, description: t("lawsParamType") },
        { name: "year", required: false, description: t("lawsParamYear") },
        { name: "status", required: false, description: t("lawsParamStatus") },
        { name: "limit", required: false, description: t("lawsParamLimit") },
        { name: "offset", required: false, description: t("lawsParamOffset") },
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
      description: t("lawDetailDesc"),
      params: [
        { name: "frbr_uri", required: true, description: t("lawDetailParamFbrr") },
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

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-heading text-3xl mb-2">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("pageDescription")}
        </p>

        <div className="rounded-lg border bg-card p-4 mb-8">
          <h2 className="font-heading text-sm mb-2">{t("baseUrl")}</h2>
          <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
            https://pasal.id/api/v1
          </code>
        </div>

        {/* Endpoints */}
        <h2 className="font-heading text-2xl mb-4">{t("endpoints")}</h2>
        <div className="space-y-8 mb-12">
          {endpoints.map((ep) => (
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
                  <h3 className="text-sm font-heading mb-2">{t("parameter")}</h3>
                  <div className="space-y-2">
                    {ep.params.map((p) => (
                      <div key={p.name} className="flex items-start gap-2 text-sm">
                        <code className="bg-muted px-1.5 py-0.5 rounded shrink-0 font-mono text-xs">
                          {p.name}
                        </code>
                        {p.required && (
                          <span className="text-xs text-destructive font-medium shrink-0">
                            {t("required")}
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
                <CodeBlock title={t("exampleRequest")}>{ep.exampleRequest}</CodeBlock>
                <CodeBlock title={t("exampleResponse")}>{ep.exampleResponse}</CodeBlock>
              </div>
            </div>
          ))}
        </div>

        {/* Regulation Types Reference */}
        <h2 className="font-heading text-2xl mb-4" id="jenis-peraturan">
          {t("regulationTypeCodes")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("regulationTypeCodesHint")}
        </p>
        <div className="rounded-lg border bg-card overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-sans font-semibold w-36">{t("codeColumn")}</th>
                  <th className="text-left p-3 font-sans font-semibold">{t("nameColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {REGULATION_TYPES.map((code) => (
                  <tr key={code} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">
                        {code}
                      </code>
                    </td>
                    <td className="p-3 font-medium">
                      {regTypeT(code as "UU" | "PP" | "PERPRES" | "PERPPU" | "PERMEN" | "KEPPRES" | "INPRES" | "PERDA" | "PERDA_PROV" | "PERDA_KAB" | "UUD" | "TAP_MPR" | "PERMA" | "PBI" | "PENPRES" | "KEPMEN" | "SE" | "PERBAN" | "PERMENKUMHAM" | "PERMENKUM" | "UUDRT" | "UUDS")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Values */}
        <h2 className="font-heading text-2xl mb-4" id="status">
          {t("statusValues")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("statusValuesHint")}
        </p>
        <div className="rounded-lg border bg-card overflow-hidden mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-sans font-semibold w-36">{t("valueColumn")}</th>
                <th className="text-left p-3 font-sans font-semibold">{t("descriptionColumn")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">berlaku</code>
                </td>
                <td className="p-3 text-muted-foreground">{t("berlakuDesc")}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">dicabut</code>
                </td>
                <td className="p-3 text-muted-foreground">{t("dicabutDesc")}</td>
              </tr>
              <tr>
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">diubah</code>
                </td>
                <td className="p-3 text-muted-foreground">{t("diubahDesc")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Quick Start */}
        <h2 className="font-heading text-2xl mb-4">{t("quickStart")}</h2>
        <div className="rounded-lg border bg-card p-6 mb-12 space-y-4">
          <CodeBlock title={t("quickStartSearch")}>
            {`curl "https://pasal.id/api/v1/search?q=ketenagakerjaan"`}
          </CodeBlock>
          <CodeBlock title={t("quickStartList")}>
            {`curl "https://pasal.id/api/v1/laws?type=PP&year=2020"`}
          </CodeBlock>
          <CodeBlock title={t("quickStartDetail")}>
            {`curl "https://pasal.id/api/v1/laws/akn/id/act/uu/2003/13"`}
          </CodeBlock>
          <CodeBlock title={t("quickStartJs")}>
            {`const res = await fetch("https://pasal.id/api/v1/search?q=upah+minimum");
const data = await res.json();

// data.results berisi array hasil pencarian
for (const result of data.results) {
  console.log(result.work.title, "-", result.metadata.node_type, result.metadata.node_number);
  console.log(result.snippet);
}`}
          </CodeBlock>
          <CodeBlock title={t("quickStartPython")}>
            {`import requests

res = requests.get("https://pasal.id/api/v1/laws", params={"type": "UU", "limit": 5})
data = res.json()

for law in data["laws"]:
    print(f"{law['type']} {law['number']}/{law['year']} - {law['title']}")`}
          </CodeBlock>
        </div>

        {/* Error Responses */}
        <h2 className="font-heading text-2xl mb-4">{t("errorResponse")}</h2>
        <div className="rounded-lg border bg-card overflow-hidden mb-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-sans font-semibold w-20">{t("codeColumn")}</th>
                <th className="text-left p-3 font-sans font-semibold">{t("descriptionColumn")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">400</code>
                </td>
                <td className="p-3 text-muted-foreground">{t("error400Desc")}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">404</code>
                </td>
                <td className="p-3 text-muted-foreground">{t("error404Desc")}</td>
              </tr>
              <tr>
                <td className="p-3">
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">429</code>
                </td>
                <td className="p-3 text-muted-foreground">{t("error429Desc")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rate Limiting */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="font-heading text-xl">{t("rateLimit")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("rateLimitIntro")}
          </p>
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("requestsPerMinute")}</span>
              <span className="font-mono font-medium">60</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("requestsPerDay")}</span>
              <span className="font-mono font-medium">1.000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("authentication")}</span>
              <span className="font-mono font-medium">{t("notRequired")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CORS</span>
              <span className="font-mono font-medium">{t("allOrigins")}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("rateLimitExceeded")}
          </p>
        </div>

        {/* Contact for higher limits */}
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-3">
          <h2 className="font-heading text-xl">{t("needHigherLimits")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("needHigherLimitsDesc")}
          </p>
          <a
            href="https://twitter.com/ilhamfputra"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-sans font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("contactUs")}
          </a>
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            {t.rich("mcpNote", {
              link: (chunks) => (
                <a href="/connect" className="text-primary hover:underline">{chunks}</a>
              ),
            })}
          </p>
        </div>
      </main>
    </div>
  );
}
