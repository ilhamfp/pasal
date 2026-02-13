export const STATUS_COLORS: Record<string, string> = {
  berlaku: "bg-status-berlaku-bg text-status-berlaku border-status-berlaku/20",
  diubah: "bg-status-diubah-bg text-status-diubah border-status-diubah/20",
  dicabut: "bg-status-dicabut-bg text-status-dicabut border-status-dicabut/20",
  tidak_berlaku: "bg-muted text-muted-foreground border-border",
};

export const STATUS_LABELS: Record<string, string> = {
  berlaku: "Berlaku",
  diubah: "Diubah",
  dicabut: "Dicabut",
  tidak_berlaku: "Tidak Berlaku",
};

export const TYPE_LABELS: Record<string, string> = {
  UUD: "Undang-Undang Dasar",
  TAP_MPR: "Ketetapan MPR",
  UU: "Undang-Undang",
  PERPPU: "Peraturan Pemerintah Pengganti Undang-Undang",
  PP: "Peraturan Pemerintah",
  PERPRES: "Peraturan Presiden",
  KEPPRES: "Keputusan Presiden",
  INPRES: "Instruksi Presiden",
  PENPRES: "Penetapan Presiden",
  PERMEN: "Peraturan Menteri",
  PERMENKUMHAM: "Peraturan Menteri Hukum dan HAM",
  PERMENKUM: "Peraturan Menteri Hukum",
  PERBAN: "Peraturan Badan/Lembaga",
  PERDA: "Peraturan Daerah",
  PERDA_PROV: "Peraturan Daerah Provinsi",
  PERDA_KAB: "Peraturan Daerah Kabupaten/Kota",
  KEPMEN: "Keputusan Menteri",
  SE: "Surat Edaran",
  PERMA: "Peraturan Mahkamah Agung",
  PBI: "Peraturan Bank Indonesia",
  UUDRT: "Undang-Undang Darurat",
  UUDS: "Undang-Undang Dasar Sementara",
};

export const LEGAL_FORCE_MAP: Record<string, string> = {
  berlaku: "InForce",
  diubah: "InForce",
  dicabut: "NotInForce",
  tidak_berlaku: "NotInForce",
};
