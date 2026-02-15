import type { DemoStep } from "./types";

export const DEMO_SCRIPT: DemoStep[] = [
  // ── Act 1: The Question ──────────────────────────────────
  {
    type: "user",
    text: "Apa hak pekerja kontrak yang sudah bekerja 8 tahun menurut hukum Indonesia?",
  },

  // ── Act 2: Claude Thinks & Searches ──────────────────────
  {
    type: "thinking",
    text: "Mencari ketentuan hukum ketenagakerjaan Indonesia\u2026",
  },

  // Tool 1: search_laws — find relevant provisions
  {
    type: "tool-call",
    name: "search_laws",
    input: { query: "hak pekerja kontrak", regulation_type: "UU" },
  },
  {
    type: "tool-result",
    name: "search_laws",
    data: {
      results: [
        {
          law_title: "Ketenagakerjaan",
          regulation_type: "UU",
          number: "13",
          year: 2003,
          pasal_number: "59",
          snippet:
            "\u2026perjanjian kerja waktu tertentu paling lama 2 tahun dan hanya boleh diperpanjang 1 kali\u2026",
          status: "diubah",
        },
        {
          law_title: "Cipta Kerja",
          regulation_type: "UU",
          number: "6",
          year: 2023,
          pasal_number: "81",
          snippet:
            "\u2026mengubah ketentuan Pasal 59 UU Ketenagakerjaan\u2026",
          status: "berlaku",
        },
      ],
    },
  },

  // Tool 2: get_pasal — exact article text
  {
    type: "tool-call",
    name: "get_pasal",
    input: {
      law_type: "UU",
      law_number: "13",
      year: 2003,
      pasal_number: "59",
    },
  },
  {
    type: "tool-result",
    name: "get_pasal",
    data: {
      law_title: "Ketenagakerjaan",
      pasal_number: "59",
      chapter_info: "BAB IX - Hubungan Kerja",
      content:
        "Perjanjian kerja untuk waktu tertentu hanya dapat dibuat untuk pekerjaan tertentu yang menurut jenis dan sifat atau kegiatan pekerjaannya akan selesai dalam waktu tertentu.",
      ayat: [
        "(1) Perjanjian kerja waktu tertentu didasarkan atas jangka waktu paling lama 2 tahun.",
        "(2) Dapat diperpanjang atau diperbaharui untuk jangka waktu paling lama 1 tahun.",
      ],
      status: "diubah",
    },
  },

  // Tool 3: get_law_status — verify the law is current
  {
    type: "tool-call",
    name: "get_law_status",
    input: { law_type: "UU", law_number: "13", year: 2003 },
  },
  {
    type: "tool-result",
    name: "get_law_status",
    data: {
      status: "diubah",
      status_explanation:
        "Sebagian ketentuan telah diubah. Pasal yang tidak diubah tetap berlaku.",
      amendments: [
        {
          relationship: "Diubah oleh",
          law: "UU 6/2023",
          full_title: "Penetapan Perpu 2/2022 tentang Cipta Kerja menjadi UU",
        },
      ],
    },
  },

  // Tool 4: list_laws — show browsing capability
  {
    type: "tool-call",
    name: "list_laws",
    input: { regulation_type: "UU", search: "ketenagakerjaan", page: 1 },
  },
  {
    type: "tool-result",
    name: "list_laws",
    data: {
      total: 3,
      laws: [
        { title: "UU 13/2003 Ketenagakerjaan", status: "diubah" },
        { title: "UU 6/2023 Cipta Kerja", status: "berlaku" },
        { title: "UU 11/2020 Cipta Kerja (dicabut)", status: "dicabut" },
      ],
    },
  },

  // ── Act 3: The Answer ────────────────────────────────────
  {
    type: "assistant",
    text: 'Berdasarkan [Pasal 59 UU No. 13 Tahun 2003](/peraturan/uu/uu-13-2003), perjanjian kerja waktu tertentu (PKWT) hanya dapat dibuat untuk jangka waktu paling lama 2 tahun dan diperpanjang 1 kali paling lama 1 tahun.\n\nKarena pekerja ini telah bekerja selama 8 tahun, kontrak tersebut melanggar batas waktu PKWT. Menurut Pasal 59 ayat (7), PKWT yang melebihi ketentuan "demi hukum menjadi perjanjian kerja waktu tidak tertentu". Artinya pekerja tersebut secara hukum berstatus sebagai pekerja tetap.\n\n⚠️ Catatan: UU 13/2003 telah diubah oleh [UU 6/2023 (Cipta Kerja)](/peraturan/uu/uu-6-2023). Ketentuan terbaru mengubah sebagian aturan PKWT, namun prinsip perlindungan pekerja kontrak tetap berlaku.',
  },

  // ── Loop gap ─────────────────────────────────────────────
  { type: "pause", duration: 10000 },
];

/**
 * Tool metadata for rendering icons and labels.
 * Maps tool names to their visual treatment in the demo.
 */
export const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  search_laws:    { icon: "🔍", label: "Mencari hukum",       color: "text-primary" },
  get_pasal:      { icon: "📄", label: "Membaca pasal",       color: "text-primary" },
  get_law_status: { icon: "⚖️",  label: "Memeriksa status",   color: "text-primary" },
  list_laws:      { icon: "📋", label: "Menelusuri peraturan", color: "text-primary" },
};
