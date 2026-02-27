import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { formatRegRef } from "@/lib/legal-status";

export const runtime = "edge";

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  const s = status.toLowerCase();
  if (s === "berlaku") return { bg: "#E8F5EC", text: "#2E7D52", label: "Berlaku" };
  if (s === "diubah") return { bg: "#FFF6E5", text: "#C47F17", label: "Diubah" };
  if (s === "dicabut") return { bg: "#FDF2F2", text: "#C53030", label: "Dicabut" };
  return { bg: "#EEE8E4", text: "#524C48", label: status };
}

function defaultTemplate() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#F8F5F0",
        fontFamily: "Instrument Serif",
      }}
    >
      {/* PasalLogo SVG */}
      <svg
        viewBox="0 0 200 200"
        width="110"
        height="110"
        style={{ marginBottom: "38px" }}
      >
        <circle cx="100" cy="100" r="72" stroke="#1D1A18" strokeWidth="8" fill="none" />
        <line x1="100" y1="56" x2="100" y2="144" stroke="#1D1A18" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M100,72 C112,66 126,74 126,84 C126,94 112,100 100,96" stroke="#1D1A18" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M100,96 C88,92 74,98 74,108 C74,118 88,126 100,120" stroke="#1D1A18" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </svg>

      {/* Heading */}
      <div
        style={{
          fontSize: "80px",
          color: "#1D1A18",
          lineHeight: 1.15,
          marginBottom: "22px",
          textAlign: "center",
        }}
      >
        Temukan pasal yang Anda butuhkan
      </div>

      {/* Subheading */}
      <div
        style={{
          fontSize: "40px",
          color: "#68625E",
          fontStyle: "italic",
          marginBottom: "48px",
        }}
      >
        Hukum Indonesia, terbuka untuk semua
      </div>

      {/* Search bar mock */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "680px",
          height: "68px",
          borderRadius: "16px",
          border: "1.5px solid #DDD6D1",
          backgroundColor: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            paddingLeft: "28px",
            fontSize: "24px",
            color: "#A8A29E",
            fontFamily: "Instrument Sans",
          }}
        >
          Cari undang-undang...
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "0 32px",
            backgroundColor: "#2B6150",
            color: "#FFFFFF",
            fontSize: "24px",
            fontFamily: "Instrument Sans",
          }}
        >
          Cari
        </div>
      </div>
    </div>
  );
}

function lawTemplate({
  title, type, number, year, status, pasalCount, snippet,
}: {
  title: string; type: string; number: string; year: string;
  status: string; pasalCount: string; snippet: string;
}) {
  const statusStyle = getStatusStyle(status);
  const displayTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        backgroundColor: "#1D1A18",
        padding: "80px",
        fontFamily: "Instrument Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "16px",
              color: "#FFFFFF",
              backgroundColor: "#2B6150",
              padding: "6px 14px",
              borderRadius: "6px",
              fontFamily: "Instrument Sans",
            }}
          >
            {formatRegRef(type, number, Number(year), { label: "compact" })}
          </span>
          <span
            style={{
              fontSize: "16px",
              color: statusStyle.text,
              backgroundColor: statusStyle.bg,
              padding: "6px 14px",
              borderRadius: "6px",
              fontFamily: "Instrument Sans",
            }}
          >
            {statusStyle.label}
          </span>
        </div>
        <div
          style={{
            fontSize: "44px",
            color: "#F8F5F0",
            fontFamily: "Instrument Serif",
            lineHeight: 1.2,
          }}
        >
          {displayTitle}
        </div>
        {snippet && (
          <div style={{
            fontSize: "20px",
            color: "#958D88",
            fontFamily: "Instrument Sans",
            lineHeight: 1.5,
            overflow: "hidden",
          }}>
            {"\u201C"}{snippet.length > 120 ? snippet.slice(0, 117) + "..." : snippet}{"\u201D"}
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "24px", color: "#68625E" }}>§</span>
          <span style={{ fontSize: "18px", color: "#68625E", fontFamily: "Instrument Serif" }}>
            Pasal.id
          </span>
        </div>
        {pasalCount && (
          <span style={{ fontSize: "16px", color: "#68625E", fontFamily: "Instrument Sans" }}>
            {pasalCount} Pasal
          </span>
        )}
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const title = searchParams.get("title") || "Cari Hukum Indonesia";
  const type = searchParams.get("type") || "";
  const number = searchParams.get("number") || "";
  const year = searchParams.get("year") || "";
  const status = searchParams.get("status") || "";
  const pasalCount = searchParams.get("pasalCount") || "";
  const snippet = searchParams.get("snippet") || "";
  const page = searchParams.get("page") || "default";

  const [instrumentSerifData, instrumentSerifItalicData, instrumentSansData] = await Promise.all([
    fetch(new URL("./fonts/InstrumentSerif-Regular.ttf", import.meta.url)).then((res) => res.arrayBuffer()),
    fetch(new URL("./fonts/InstrumentSerif-Italic.ttf", import.meta.url)).then((res) => res.arrayBuffer()),
    fetch(new URL("./fonts/InstrumentSans-Regular.ttf", import.meta.url)).then((res) => res.arrayBuffer()),
  ]);

  const fonts = [
    { name: "Instrument Serif", data: instrumentSerifData, weight: 400 as const, style: "normal" as const },
    { name: "Instrument Serif", data: instrumentSerifItalicData, weight: 400 as const, style: "italic" as const },
    { name: "Instrument Sans", data: instrumentSansData, weight: 400 as const },
  ];

  if (page === "law") {
    return new ImageResponse(
      lawTemplate({ title, type, number, year, status, pasalCount, snippet }),
      {
        width: 1200,
        height: 630,
        fonts,
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        },
      }
    );
  }

  return new ImageResponse(
    defaultTemplate(),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800",
      },
    }
  );
}
