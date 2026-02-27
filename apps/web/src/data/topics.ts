export interface TopicQuestion {
  question: string;
  searchQuery: string;
  pasal?: string;
  lawRef?: string;
  answerSummary?: string;
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
        answerSummary: "Upah minimum ditetapkan oleh Gubernur berdasarkan kebutuhan hidup layak (KHL) dengan memperhatikan produktivitas dan pertumbuhan ekonomi. Setiap perusahaan dilarang membayar upah lebih rendah dari upah minimum provinsi atau kabupaten/kota. Pelanggaran dikenakan sanksi pidana penjara 1-4 tahun dan/atau denda Rp100 juta - Rp400 juta (Pasal 88-90 UU 13/2003).",
      },
      {
        question: "Apa hak saya jika di-PHK?",
        searchQuery: "pemutusan hubungan kerja",
        pasal: "156",
        lawRef: "UU 13/2003",
        answerSummary: "Pekerja yang di-PHK berhak atas uang pesangon, uang penghargaan masa kerja, dan uang penggantian hak. Besaran pesangon tergantung masa kerja: 1 bulan upah untuk masa kerja <1 tahun hingga 9 bulan upah untuk masa kerja ≥8 tahun. Pengusaha wajib merundingkan PHK terlebih dahulu, dan jika tidak tercapai kesepakatan, penyelesaian dilakukan melalui lembaga penyelesaian perselisihan hubungan industrial (Pasal 156 UU 13/2003).",
      },
      {
        question: "Berapa lama cuti tahunan yang saya dapatkan?",
        searchQuery: "cuti tahunan pekerja",
        pasal: "79",
        lawRef: "UU 13/2003",
        answerSummary: "Pekerja berhak atas cuti tahunan sekurang-kurangnya 12 hari kerja setelah bekerja selama 12 bulan secara terus-menerus. Selain cuti tahunan, pekerja juga berhak atas istirahat mingguan, cuti sakit, cuti melahirkan (3 bulan), dan cuti karena alasan penting seperti pernikahan atau kematian keluarga (Pasal 79 UU 13/2003).",
      },
      {
        question: "Bagaimana aturan kerja lembur?",
        searchQuery: "waktu kerja lembur",
        pasal: "78",
        lawRef: "UU 13/2003",
        answerSummary: "Waktu kerja lembur hanya dapat dilakukan paling banyak 4 jam dalam 1 hari dan 18 jam dalam 1 minggu. Pengusaha wajib membayar upah lembur: jam pertama dibayar 1,5 kali upah sejam, jam berikutnya dibayar 2 kali upah sejam. Kerja lembur harus ada persetujuan tertulis dari pekerja dan pengusaha wajib memberikan makanan/minuman jika lembur >3 jam (Pasal 78 UU 13/2003).",
      },
      {
        question: "Apa hak pekerja kontrak (PKWT)?",
        searchQuery: "perjanjian kerja waktu tertentu",
        pasal: "59",
        lawRef: "UU 13/2003",
        answerSummary: "Perjanjian Kerja Waktu Tertentu (PKWT) hanya boleh untuk pekerjaan yang bersifat sementara, musiman, atau terkait produk baru. PKWT tidak boleh mensyaratkan masa percobaan. Jangka waktu PKWT maksimal 2 tahun dan hanya boleh diperpanjang 1 kali untuk paling lama 1 tahun. Jika ketentuan dilanggar, PKWT otomatis menjadi Perjanjian Kerja Waktu Tidak Tertentu (PKWTT) atau pekerja tetap (Pasal 59 UU 13/2003).",
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
        answerSummary: "Sejak perubahan UU Perkawinan tahun 2019, usia minimum perkawinan adalah 19 tahun baik untuk pria maupun wanita. Sebelumnya batas usia wanita adalah 16 tahun. Jika belum mencapai usia tersebut, diperlukan dispensasi dari pengadilan dengan alasan mendesak dan bukti pendukung (Pasal 7 UU 16/2019).",
      },
      {
        question: "Apa syarat sah perkawinan?",
        searchQuery: "syarat perkawinan",
        pasal: "2",
        lawRef: "UU 1/1974",
        answerSummary: "Perkawinan sah apabila dilakukan menurut hukum masing-masing agama dan kepercayaannya. Selain itu, setiap perkawinan wajib dicatat menurut peraturan perundang-undangan yang berlaku untuk mendapatkan kepastian hukum (Pasal 2 UU 1/1974).",
      },
      {
        question: "Bagaimana proses perceraian?",
        searchQuery: "perceraian",
        pasal: "39",
        lawRef: "UU 1/1974",
        answerSummary: "Perceraian hanya dapat dilakukan di depan sidang pengadilan setelah pengadilan berusaha mendamaikan kedua belah pihak. Harus ada cukup alasan bahwa suami istri tidak dapat hidup rukun lagi. Tata cara perceraian diatur lebih lanjut dalam peraturan pemerintah (Pasal 39 UU 1/1974).",
      },
      {
        question: "Apa hak istri dalam harta bersama?",
        searchQuery: "harta bersama perkawinan",
        pasal: "35",
        lawRef: "UU 1/1974",
        answerSummary: "Harta benda yang diperoleh selama perkawinan menjadi harta bersama. Masing-masing suami dan istri memiliki hak yang sama atas harta bersama tersebut. Harta bawaan dan hadiah/warisan tetap berada di bawah penguasaan masing-masing pihak, kecuali ditentukan lain (Pasal 35-37 UU 1/1974).",
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
        pasal: "5",
        lawRef: "UU 27/2022",
        answerSummary: "Subjek data pribadi berhak mendapatkan informasi tentang kejelasan identitas, dasar kepentingan hukum, dan tujuan pengolahan data pribadinya. Hak lainnya meliputi akses, koreksi, penghapusan, penarikan persetujuan, dan mengajukan keberatan atas pemrosesan data. Hak ini dijamin oleh Pasal 5-13 UU 27/2022 tentang Perlindungan Data Pribadi.",
      },
      {
        question: "Apa kewajiban perusahaan yang mengolah data saya?",
        searchQuery: "kewajiban pengendali data pribadi",
        pasal: "20",
        lawRef: "UU 27/2022",
        answerSummary: "Pengendali data pribadi wajib memiliki dasar hukum pemrosesan, menjaga kerahasiaan, melakukan penilaian dampak, dan memberitahu subjek data jika terjadi kebocoran dalam waktu 3x24 jam. Pengendali juga wajib menunjuk pejabat perlindungan data pribadi (Pasal 20-40 UU 27/2022).",
      },
      {
        question: "Apa sanksi jika data pribadi saya disalahgunakan?",
        searchQuery: "sanksi pelanggaran data pribadi",
        pasal: "67",
        lawRef: "UU 27/2022",
        answerSummary: "Pelanggaran perlindungan data pribadi diancam pidana penjara maksimal 5 tahun dan/atau denda maksimal Rp5 miliar untuk individu. Korporasi dapat dikenakan denda hingga 10 kali lipat dari pidana denda pokok, serta sanksi administratif berupa peringatan tertulis, penghentian pemrosesan, hingga penghapusan data (Pasal 67-73 UU 27/2022).",
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
        answerSummary: "KUHP baru mengenal 5 jenis pidana pokok: pidana penjara, pidana tutupan, pidana pengawasan, pidana denda, dan pidana kerja sosial. Pidana kerja sosial dan pidana pengawasan merupakan jenis baru yang tidak ada dalam KUHP lama, memberikan alternatif pemidanaan non-penjara (Pasal 65 UU 1/2023).",
      },
      {
        question: "Kapan KUHP baru mulai berlaku?",
        searchQuery: "pemberlakuan KUHP baru",
        pasal: "624",
        lawRef: "UU 1/2023",
        answerSummary: "KUHP baru (UU 1/2023) diundangkan pada 2 Januari 2023 namun baru mulai berlaku 3 tahun setelah diundangkan, yaitu pada 2 Januari 2026. Masa transisi ini diberikan untuk mempersiapkan peraturan pelaksana dan sosialisasi kepada aparat penegak hukum serta masyarakat (Pasal 624 UU 1/2023).",
      },
      {
        question: "Apa hak tersangka dalam proses hukum?",
        searchQuery: "hak tersangka pidana",
        pasal: "17",
        lawRef: "UU 1/2023",
        answerSummary: "KUHP baru menegaskan asas legalitas dan praduga tak bersalah sebagai dasar perlindungan tersangka. Tidak seorang pun dapat dipidana tanpa dasar undang-undang yang berlaku sebelum tindak pidana dilakukan. Setiap orang juga berhak atas penerapan hukum yang paling menguntungkan jika terjadi perubahan undang-undang (Pasal 1-3, 17 UU 1/2023).",
      },
      {
        question: "Bagaimana aturan penghinaan presiden dalam KUHP baru?",
        searchQuery: "penghinaan presiden KUHP",
        pasal: "218",
        lawRef: "UU 1/2023",
        answerSummary: "KUHP baru mengatur bahwa penghinaan terhadap presiden dan wakil presiden diancam pidana penjara maksimal 3 tahun 6 bulan atau denda kategori IV. Namun pasal ini merupakan delik aduan, artinya hanya dapat diproses jika ada pengaduan dari pihak yang merasa dirugikan (Pasal 218-220 UU 1/2023).",
      },
    ],
  },
];

export function getTopicBySlug(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
