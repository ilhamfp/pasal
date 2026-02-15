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

function defaultTemplate({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#F8F5F0",
        padding: "80px",
        fontFamily: "Instrument Serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
        <span style={{ fontSize: "36px", color: "#2B6150" }}>§</span>
        <span style={{ fontSize: "24px", color: "#1D1A18" }}>Pasal.id</span>
      </div>
      <div style={{ fontSize: "48px", color: "#1D1A18", lineHeight: 1.2, marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "48px", color: "#68625E", fontStyle: "italic", lineHeight: 1.2 }}>
        dengan mudah
      </div>
      <div style={{ width: "120px", height: "1px", backgroundColor: "#DDD6D1", marginTop: "32px", marginBottom: "24px" }} />
      <div style={{ fontSize: "20px", color: "#524C48", fontFamily: "Instrument Sans", lineHeight: 1.6 }}>
        Platform hukum Indonesia terbuka pertama berbasis AI
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

  const instrumentSerifData = await fetch(
    new URL("./fonts/InstrumentSerif-Regular.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const instrumentSansData = await fetch(
    new URL("./fonts/InstrumentSans-Regular.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const fonts = [
    { name: "Instrument Serif", data: instrumentSerifData, weight: 400 as const },
    { name: "Instrument Sans", data: instrumentSansData, weight: 400 as const },
  ];

  if (page === "law") {
    return new ImageResponse(
      lawTemplate({ title, type, number, year, status, pasalCount, snippet }),
      { width: 1200, height: 630, fonts }
    );
  }

  return new ImageResponse(
    defaultTemplate({ title }),
    { width: 1200, height: 630, fonts }
  );
}
