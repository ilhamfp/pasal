import { describe, it, expect } from "vitest";
import { tokenize } from "@/lib/crossref";

const lookup: Record<string, string> = {
  "uu-no-13-tahun-2003": "/peraturan/uu/uu-no-13-tahun-2003",
  "pp-no-74-tahun-2008": "/peraturan/pp/pp-no-74-tahun-2008",
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
        href: "/peraturan/uu/uu-no-13-tahun-2003",
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
      { type: "uu", href: "/peraturan/pp/pp-no-74-tahun-2008" },
      { type: "text" },
    ]);
  });

  it("handles both Perpu and Perppu spellings", () => {
    const lookup2 = { "perppu-no-1-tahun-2022": "/peraturan/perppu/perppu-no-1-tahun-2022" };
    const r1 = tokenize("Perpu Nomor 1 Tahun 2022", lookup2);
    const r2 = tokenize("Perppu Nomor 1 Tahun 2022", lookup2);
    // Both spellings must resolve to the same perppu slug
    const uuTokens1 = r1.filter((t) => t.type === "uu");
    const uuTokens2 = r2.filter((t) => t.type === "uu");
    expect(uuTokens1).toHaveLength(1);
    expect(uuTokens2).toHaveLength(1);
    expect(uuTokens1[0]).toMatchObject({ href: "/peraturan/perppu/perppu-no-1-tahun-2022" });
    expect(uuTokens2[0]).toMatchObject({ href: "/peraturan/perppu/perppu-no-1-tahun-2022" });
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

  it("detects Peraturan Presiden cross-reference", () => {
    const lookup2 = { "perpres-no-12-tahun-2010": "/peraturan/perpres/perpres-no-12-tahun-2010" };
    const result = tokenize("diatur dalam Peraturan Presiden Nomor 12 Tahun 2010.", lookup2);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "uu", href: "/peraturan/perpres/perpres-no-12-tahun-2010" },
      { type: "text" },
    ]);
  });

  it("detects Peraturan Daerah cross-reference", () => {
    const lookup2 = { "perda-no-5-tahun-2015": "/peraturan/perda/perda-no-5-tahun-2015" };
    const result = tokenize("sebagaimana Peraturan Daerah Nomor 5 Tahun 2015 mengatur.", lookup2);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "uu", href: "/peraturan/perda/perda-no-5-tahun-2015" },
      { type: "text" },
    ]);
  });

  it("detects UU citation without Nomor keyword", () => {
    // Match starts at index 0 — no leading text token
    const result = tokenize("Undang-Undang 13 Tahun 2003 berlaku.", lookup);
    expect(result).toMatchObject([
      { type: "uu", href: "/peraturan/uu/uu-no-13-tahun-2003" },
      { type: "text", value: " berlaku." },
    ]);
  });

  it("handles mixed Pasal and UU references in one string", () => {
    const result = tokenize(
      "Sesuai Pasal 5 Undang-Undang Nomor 13 Tahun 2003 tentang ketenagakerjaan.",
      lookup
    );
    const pasalTokens = result.filter((t) => t.type === "pasal");
    const uuTokens = result.filter((t) => t.type === "uu");
    expect(pasalTokens).toHaveLength(1);
    expect(uuTokens).toHaveLength(1);
    expect(pasalTokens[0]).toMatchObject({ pasalNumber: "5" });
    expect(uuTokens[0]).toMatchObject({ href: "/peraturan/uu/uu-no-13-tahun-2003" });
  });

  it("preserves trailing plain text after last reference", () => {
    const result = tokenize("Lihat Pasal 3 untuk ketentuan lebih lanjut.", lookup);
    const last = result[result.length - 1];
    expect(last).toEqual({ type: "text", value: " untuk ketentuan lebih lanjut." });
  });

  it("renders unknown regulation type as plain text", () => {
    // "Keputusan Menteri" is not in TYPE_PREFIX_MAP — should stay as text
    const result = tokenize("berdasarkan Keputusan Menteri Nomor 5 Tahun 2020.", lookup);
    expect(result.every((t) => t.type === "text")).toBe(true);
    expect(result.map((t) => t.value).join("")).toBe(
      "berdasarkan Keputusan Menteri Nomor 5 Tahun 2020."
    );
  });

  it("detects Pasal with capital-A Ayat (scanned PDF variant)", () => {
    // Some PDFs capitalize Ayat — must still produce a pasal link
    const result = tokenize("sebagaimana dimaksud dalam Pasal 90 Ayat (3).", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", value: "Pasal 90 Ayat (3)", href: "#pasal-90" },
      { type: "text" },
    ]);
  });

  it("detects all-caps UNDANG-UNDANG citation from scanned PDFs", () => {
    const result = tokenize(
      "sebagaimana dimaksud dalam UNDANG-UNDANG Nomor 13 Tahun 2003 tentang Ketenagakerjaan.",
      lookup
    );
    expect(result).toMatchObject([
      { type: "text" },
      {
        type: "uu",
        value: "UNDANG-UNDANG Nomor 13 Tahun 2003",
        href: "/peraturan/uu/uu-no-13-tahun-2003",
      },
      { type: "text" },
    ]);
  });

  it("detects all-caps PASAL reference from scanned PDFs", () => {
    const result = tokenize("Ketentuan PASAL 5 berlaku.", lookup);
    expect(result).toMatchObject([
      { type: "text" },
      { type: "pasal", pasalNumber: "5", href: "#pasal-5" },
      { type: "text" },
    ]);
  });
});
