import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { BookOpen, Database, FileText, MessageSquare, Quote, Scale, Search, ShieldCheck } from "lucide-react";
import { getAlternates } from "@/lib/i18n-metadata";
import nextDynamic from "next/dynamic";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import CopyButton from "@/components/CopyButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MCPDemo = nextDynamic(() => import("@/components/connect/MCPDemo"));

const MCP_URL = "https://pasal-mcp-server-production.up.railway.app/mcp";
const INSTALL_CMD = `claude mcp add --transport http pasal-id ${MCP_URL}`;

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "pasal-id": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-proxy", "https://pasal-mcp-server-production.up.railway.app/mcp"]
    }
  }
}`;

const STEP_ICONS = [MessageSquare, Database, Scale, Quote];
const TOOL_ICONS = [Search, FileText, ShieldCheck, BookOpen];

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "connect" });
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: getAlternates("/connect", locale),
    openGraph: {
      title: t("pageTitle"),
      description: t("pageDescription"),
    },
  };
}

export default async function ConnectPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const [t, commonT, navT] = await Promise.all([
    getTranslations("connect"),
    getTranslations("common"),
    getTranslations("navigation"),
  ]);

  const steps = [
    { icon: STEP_ICONS[0], title: t("step1Title"), description: t("step1Description") },
    { icon: STEP_ICONS[1], title: t("step2Title"), description: t("step2Description") },
    { icon: STEP_ICONS[2], title: t("step3Title"), description: t("step3Description") },
    { icon: STEP_ICONS[3], title: t("step4Title"), description: t("step4Description") },
  ];

  const tools = [
    { name: t("tool1Name"), description: t("tool1Description"), detail: t("tool1Detail"), icon: TOOL_ICONS[0] },
    { name: t("tool2Name"), description: t("tool2Description"), detail: t("tool2Detail"), icon: TOOL_ICONS[1] },
    { name: t("tool3Name"), description: t("tool3Description"), detail: t("tool3Detail"), icon: TOOL_ICONS[2] },
    { name: t("tool4Name"), description: t("tool4Description"), detail: t("tool4Detail"), icon: TOOL_ICONS[3] },
  ];

  const examplePrompts = [
    t("examplePrompt1"),
    t("examplePrompt2"),
    t("examplePrompt3"),
    t("examplePrompt4"),
    t("examplePrompt5"),
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: navT("home"), item: locale === "en" ? "https://pasal.id/en" : "https://pasal.id" },
          { "@type": "ListItem", position: 2, name: t("pageTitle") },
        ],
      }} />

      <main className="container mx-auto px-4 py-6 sm:py-12">
        <PageBreadcrumb items={[
          { label: navT("home"), href: "/" },
          { label: navT("connect") },
        ]} />
        {/* Two-column hero: instructions + demo side by side */}
        <div className="max-w-6xl mx-auto mb-8 sm:mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-12 items-start">
            {/* Left column: Connect instructions */}
            <div className="space-y-4 sm:space-y-8">
              <div className="space-y-3">
                <h1 className="font-heading text-3xl sm:text-4xl tracking-tight text-pretty">
                  {t("heroTitle")}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {t("heroTagline")}
                </p>
              </div>

              {/* Install Command — Claude Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-xl">
                    {t("claudeCodeTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("claudeCodeInstructions")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">
                      {INSTALL_CMD}
                    </code>
                    <CopyButton text={INSTALL_CMD} label={commonT("copy")} />
                  </div>
                </CardContent>
              </Card>

              {/* Claude Desktop JSON Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-xl">
                    {t("claudeDesktopTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("claudeDesktopInstructions", {
                      config: "claude_desktop_config.json",
                    })}
                  </p>
                  <div className="relative">
                    <pre className="rounded-lg bg-muted px-4 py-3 text-sm font-mono overflow-x-auto">
                      {CLAUDE_DESKTOP_CONFIG}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton text={CLAUDE_DESKTOP_CONFIG} label={commonT("copy")} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("claudeDesktopHint")}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right column: Live MCP Demo */}
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="space-y-2">
                <h2 className="font-heading text-2xl tracking-tight text-pretty">
                  {t("demoTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("demoDescription")}
                </p>
              </div>
              <MCPDemo />
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-12">
          {/* Cara Kerjanya — How it works */}
          <section className="space-y-4 sm:space-y-6">
            <h2 className="font-heading text-2xl tracking-tight text-center text-pretty">
              {t("howItWorks")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {steps.map((item, i) => (
                <Card key={item.title}>
                  <CardContent className="p-4 sm:p-6 space-y-3">
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
          <section className="space-y-4 sm:space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-heading text-2xl tracking-tight text-pretty">
                {t("toolsTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("toolsDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tools.map((tool) => (
                <Card key={tool.name}>
                  <CardContent className="p-4 sm:p-6 space-y-3">
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
          <section id="coba-sekarang" className="space-y-4 sm:space-y-6 scroll-mt-20">
            <h2 className="font-heading text-2xl tracking-tight text-center text-pretty">
              {t("tryNowTitle")}
            </h2>
            <div className="space-y-3">
              {examplePrompts.map((prompt, i) => (
                <Card key={i} className="transition-colors hover:border-primary/30">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="text-sm">&ldquo;{prompt}&rdquo;</p>
                    <CopyButton text={prompt} label={commonT("copy")} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* What is MCP */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">{t("whatIsMcpTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{t("whatIsMcpParagraph1")}</p>
              <p>{t("whatIsMcpParagraph2")}</p>
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {t("learnMoreMcp")}
              </a>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center pt-4">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 sm:px-6 py-3 text-sm font-sans font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("ctaButton")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
