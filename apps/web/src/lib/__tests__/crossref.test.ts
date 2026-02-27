import { describe, it, expect } from "vitest";
import { tokenize } from "@/lib/crossref";

const lookup: Record<string, string> = {
  "uu-13-2003": "/peraturan/uu/uu-13-2003",
  "pp-74-2008": "/peraturan/pp/pp-74-2008",
};

describe("tokenize", () => {
  it("returns plain text token for content with no references", () => {
    const result = tokenize("Hak dan kewajiban warga negara.", lookup);
    expect(result).toEqual([{ type: "text", value: "Hak dan kewajiban warga negara." }]);
  });

  it("detects bare Pasal reference", () => {
    const result = tokenize("Sesuai dengan Pasal 5 tentang hak.", lookup);
    expect(result).toEqual([
      { type: "text", value: "Sesuai dengan " },
      { type: "pasal", value: "Pasal 5", pasalNumber: "5", href: "#pasal-5" },
      { type: "text", value: " tentang hak." },
    ]);
  });

  it("detects Pasal with letter suffix", () => {
    const result = tokenize("Lihat Pasal 5A.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", pasalNumber: "5A", href: "#pasal-5A" },
      { type: "text" },
    ]);
  });

  it("detects Pasal with ayat", () => {
    const result = tokenize("Merujuk Pasal 12 ayat (2) undang-undang ini.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", value: "Pasal 12 ayat (2)", href: "#pasal-12" },
      { type: "text" },
    ]);
  });

  it("detects Pasal with lowercase", () => {
    const result = tokenize("sebagaimana dimaksud dalam pasal 7.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", pasalNumber: "7", href: "#pasal-7" },
      { type: "text" },
    ]);
  });

  it("detects resolvable UU cross-reference", () => {
    const result = tokenize(
      "Sesuai dengan Undang-Undang Nomor 13 Tahun 2003.",
      lookup
    );
    expect(result).toMatchObject([
      { type: "text" },
      {
        type: "uu",
        value: "Undang-Undang Nomor 13 Tahun 2003",
        href: "/peraturan/uu/uu-13-2003",
      },
      { type: "text" },
    ]);
  });

  it("renders unresolvable UU reference as plain text", () => {
    const result = tokenize(
      "Sesuai Undang-Undang Nomor 99 Tahun 1888.",
      lookup
    );
    expect(result.every((t) => t.type === "text")).toBe(true);
    expect(result.map((t) => t.value).join("")).toBe(
      "Sesuai Undang-Undang Nomor 99 Tahun 1888."
    );
  });

  it("detects Peraturan Pemerintah cross-reference", () => {
    const result = tokenize(
      "diatur dalam Peraturan Pemerintah Nomor 74 Tahun 2008.",
      lookup
    );
    expect(result).toMatchObject([
      { type: "text" },
      { type: "uu", href: "/peraturan/pp/pp-74-2008" },
      { type: "text" },
    ]);
  });

  it("handles both Perpu and Perppu spellings", () => {
    const lookup2 = { "perppu-1-2022": "/peraturan/perppu/perppu-1-2022" };
    const r1 = tokenize("Perpu Nomor 1 Tahun 2022", lookup2);
    const r2 = tokenize("Perppu Nomor 1 Tahun 2022", lookup2);
    // Both spellings must resolve to the same perppu slug
    const uuTokens1 = r1.filter((t) => t.type === "uu");
    const uuTokens2 = r2.filter((t) => t.type === "uu");
    expect(uuTokens1).toHaveLength(1);
    expect(uuTokens2).toHaveLength(1);
    expect(uuTokens1[0]).toMatchObject({ href: "/peraturan/perppu/perppu-1-2022" });
    expect(uuTokens2[0]).toMatchObject({ href: "/peraturan/perppu/perppu-1-2022" });
  });

  it("handles multiple references in one string", () => {
    const result = tokenize(
      "Lihat Pasal 3 dan Pasal 7 ayat (1).",
      lookup
    );
    const pasalTokens = result.filter((t) => t.type === "pasal");
    expect(pasalTokens).toHaveLength(2);
    expect(pasalTokens[0]).toMatchObject({ pasalNumber: "3" });
    expect(pasalTokens[1]).toMatchObject({ pasalNumber: "7" });
  });

  it("returns single text token for empty string", () => {
    expect(tokenize("", lookup)).toEqual([{ type: "text", value: "" }]);
  });
});
