export interface TopicQuestion {
  question: string;
  searchQuery: string;
  pasal?: string;
  lawRef?: string;
}

export interface Topic {
  slug: string;
  title: string;
  description: string;
  icon: string;
  relatedLaws: { type: string; number: string; year: number; title: string }[];
  questions: TopicQuestion[];
}

export const TOPICS: Topic[] = [
  {
    slug: "ketenagakerjaan",
    title: "Ketenagakerjaan",
    description: "Hak pekerja, upah minimum, PHK, cuti, dan lembur menurut hukum Indonesia.",
    icon: "Briefcase",
    relatedLaws: [
      { type: "UU", number: "13", year: 2003, title: "Ketenagakerjaan" },
      { type: "UU", number: "6", year: 2023, title: "Cipta Kerja" },
    ],
    questions: [
      {
        question: "Berapa upah minimum yang harus dibayar perusahaan?",
        searchQuery: "upah minimum pekerja",
        pasal: "88",
        lawRef: "UU 13/2003",
      },
      {
        question: "Apa hak saya jika di-PHK?",
        searchQuery: "pemutusan hubungan kerja",
        pasal: "156",
        lawRef: "UU 13/2003",
      },
      {
        question: "Berapa lama cuti tahunan yang saya dapatkan?",
        searchQuery: "cuti tahunan pekerja",
        pasal: "79",
        lawRef: "UU 13/2003",
      },
      {
        question: "Bagaimana aturan kerja lembur?",
        searchQuery: "waktu kerja lembur",
        pasal: "78",
        lawRef: "UU 13/2003",
      },
      {
        question: "Apa hak pekerja kontrak (PKWT)?",
        searchQuery: "perjanjian kerja waktu tertentu",
        pasal: "59",
        lawRef: "UU 13/2003",
      },
    ],
  },
  {
    slug: "pernikahan-keluarga",
    title: "Pernikahan & Keluarga",
    description: "Syarat menikah, usia minimum, perceraian, dan hak dalam perkawinan.",
    icon: "Heart",
    relatedLaws: [
      { type: "UU", number: "1", year: 1974, title: "Perkawinan" },
      { type: "UU", number: "16", year: 2019, title: "Perubahan UU Perkawinan" },
    ],
    questions: [
      {
        question: "Berapa usia minimum untuk menikah?",
        searchQuery: "usia perkawinan",
        pasal: "7",
        lawRef: "UU 16/2019",
      },
      {
        question: "Apa syarat sah perkawinan?",
        searchQuery: "syarat perkawinan",
        pasal: "2",
        lawRef: "UU 1/1974",
      },
      {
        question: "Bagaimana proses perceraian?",
        searchQuery: "perceraian",
        pasal: "39",
        lawRef: "UU 1/1974",
      },
      {
        question: "Apa hak istri dalam harta bersama?",
        searchQuery: "harta bersama perkawinan",
        pasal: "35",
        lawRef: "UU 1/1974",
      },
    ],
  },
  {
    slug: "data-pribadi",
    title: "Data Pribadi",
    description: "Hak atas data pribadi, kewajiban pengendali data, dan sanksi pelanggaran.",
    icon: "Shield",
    relatedLaws: [
      { type: "UU", number: "27", year: 2022, title: "Perlindungan Data Pribadi" },
    ],
    questions: [
      {
        question: "Apa hak saya atas data pribadi saya?",
        searchQuery: "hak subjek data pribadi",
      },
      {
        question: "Apa kewajiban perusahaan yang mengolah data saya?",
        searchQuery: "kewajiban pengendali data pribadi",
      },
      {
        question: "Apa sanksi jika data pribadi saya disalahgunakan?",
        searchQuery: "sanksi pelanggaran data pribadi",
      },
    ],
  },
  {
    slug: "hukum-pidana",
    title: "Hukum Pidana",
    description: "KUHP baru 2023: perubahan penting, pidana pokok, dan hak tersangka.",
    icon: "Scale",
    relatedLaws: [
      { type: "UU", number: "1", year: 2023, title: "Kitab Undang-Undang Hukum Pidana" },
    ],
    questions: [
      {
        question: "Apa saja jenis pidana pokok dalam KUHP baru?",
        searchQuery: "pidana pokok KUHP",
        pasal: "65",
        lawRef: "UU 1/2023",
      },
      {
        question: "Kapan KUHP baru mulai berlaku?",
        searchQuery: "pemberlakuan KUHP baru",
      },
      {
        question: "Apa hak tersangka dalam proses hukum?",
        searchQuery: "hak tersangka pidana",
      },
      {
        question: "Bagaimana aturan penghinaan presiden dalam KUHP baru?",
        searchQuery: "penghinaan presiden KUHP",
      },
    ],
  },
];

export function getTopicBySlug(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
