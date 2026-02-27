// Known true abbreviations (2-4 letter acronyms pronounced as letters)
const TRUE_ABBREVIATIONS = new Set([
  // Government
  "RI", "NKRI",
  // Parliament
  "MPR", "DPR", "DPD", "DPRD",
  // Judiciary
  "MA", "MK", "KY",
  // Bodies
  "KPK", "BPK", "BPKP", "TNI", "POLRI", "OJK", "BI", "BPJS", "BPOM", "BPS", "KPU", "KPUD",
  // Legal/economic
  "APBN", "APBD", "BUMN", "BUMD", "PPN", "PBB", "HAM", "UMKM", "UKM", "KUHP", "ITE", "PHK",
  "ASN", "PNS", "SDM", "RPJMN", "RPJMD", "RPJPN",
  // Regulation types (short ones)
  "UU", "PP", "UUD", "SE", "PBI",
  // Company
  "PT", "CV", "TBK",
  // International/medical
  "COVID", "HIV", "AIDS", "WHO", "UNESCO", "ASEAN",
]);

const ROMAN_NUMERAL_RE = /^[IVXLC]+$/;

// Function words — lowercased unless first word
const FUNCTION_WORDS = new Set([
  // Conjunctions
  "dan", "atau", "serta", "maupun",
  // Short prepositions
  "di", "ke", "dari",
  // Relative
  "yang",
  // Other prepositions
  "untuk", "dengan", "pada", "dalam", "atas", "oleh", "tentang", "terhadap",
  "antara", "melalui", "tanpa", "kepada", "menurut", "sampai", "hingga",
  "sebagai", "bahwa",
]);

function titleCaseWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function processWord(word: string, isFirst: boolean): string {
  // Contains digits → leave unchanged
  if (/\d/.test(word)) return word;

  // Handle parentheses: (PERSERO) → (Persero)
  if (word.startsWith("(") && word.endsWith(")")) {
    const inner = word.slice(1, -1);
    return `(${processWord(inner, false)})`;
  }

  // Handle hyphens: UNDANG-UNDANG → Undang-Undang
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part, i) => processWord(part, isFirst && i === 0))
      .join("-");
  }

  // Handle slashes in non-numeric words: BARANG/JASA → Barang/Jasa
  if (word.includes("/") && !/\d/.test(word)) {
    return word
      .split("/")
      .map((part, i) => processWord(part, isFirst && i === 0))
      .join("/");
  }

  const upper = word.toUpperCase();

  // Known abbreviation → keep ALL CAPS
  if (TRUE_ABBREVIATIONS.has(upper)) return upper;

  // Roman numeral → keep ALL CAPS
  if (ROMAN_NUMERAL_RE.test(upper) && upper.length > 0) return upper;

  // Function word (not first) → lowercase
  if (!isFirst && FUNCTION_WORDS.has(word.toLowerCase())) {
    return word.toLowerCase();
  }

  // Everything else → Title Case
  return titleCaseWord(word);
}

/**
 * Converts an ALL CAPS Indonesian legal title to Title Case,
 * preserving abbreviations, Roman numerals, and numeric tokens.
 *
 * Only call this on titles that are entirely uppercase — mixed-case
 * titles from peraturan.go.id are already correctly cased.
 */
export function toTitleCase(text: string): string {
  return text
    .split(" ")
    .map((word, i) => processWord(word, i === 0))
    .join(" ");
}
