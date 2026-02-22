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

/** Types where "Nomor X" doesn't apply (constitutions, TAP MPR, etc.) */
const NO_NOMOR_TYPES = new Set(["UUD", "UUDS"]);

/**
 * Format a regulation reference. Omits "Nomor {number}" for types without
 * regulation numbers (UUD, UUDS).
 *
 * label variants:
 *  - "compact": "UU 13/2003"  or "UUD 1945"
 *  - "short":   "UU Nomor 13 Tahun 2003" or "UUD Tahun 1945"
 *  - "long":    "Undang-Undang Nomor 13 Tahun 2003" or "Undang-Undang Dasar Tahun 1945"
 */
export function formatRegRef(
  type: string,
  number: string | null | undefined,
  year: number,
  { label = "short" }: { label?: "compact" | "short" | "long" } = {}
): string {
  const typeStr = label === "long" ? (TYPE_LABELS[type.toUpperCase()] || type.toUpperCase()) : type.toUpperCase();
  const noNomor = NO_NOMOR_TYPES.has(type.toUpperCase()) || !number;
  if (label === "compact") {
    if (noNomor) return number ? `${typeStr} ${number}` : `${typeStr} ${year}`;
    return `${typeStr} ${number}/${year}`;
  }
  return noNomor ? `${typeStr} Tahun ${year}` : `${typeStr} Nomor ${number} Tahun ${year}`;
}

export const LEGAL_FORCE_MAP: Record<string, string> = {
  berlaku: "InForce",
  diubah: "InForce",
  dicabut: "NotInForce",
  tidak_berlaku: "NotInForce",
};
