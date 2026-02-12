"""Parse Indonesian legal PDFs into structured JSON.

Extracts text from PDFs using pdfplumber, then parses the hierarchical
structure (BAB > Bagian > Paragraf > Pasal > Ayat).
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

DATA_DIR = Path(__file__).parent.parent.parent / "data"
PDF_DIR = DATA_DIR / "raw" / "pdfs"
PARSED_DIR = DATA_DIR / "parsed"
META_DIR = DATA_DIR / "raw" / "peraturan-go-id"

# Regex patterns for Indonesian legal document structure
BAB_RE = re.compile(r'^BAB\s+([IVXLCDM]+)\s*$', re.MULTILINE)
BAB_HEADING_RE = re.compile(r'^BAB\s+[IVXLCDM]+\s*\n\s*(.+)', re.MULTILINE)
BAGIAN_RE = re.compile(
    r'^Bagian\s+(Kesatu|Kedua|Ketiga|Keempat|Kelima|Keenam|Ketujuh|Kedelapan|Kesembilan|Kesepuluh'
    r'|Kesebelas|Kedua\s*Belas|Ketiga\s*Belas|Keempat\s*Belas|Kelima\s*Belas|Keenam\s*Belas'
    r'|Ketujuh\s*Belas|Kedelapan\s*Belas|Kesembilan\s*Belas|Kedua\s*Puluh'
    r'|Ke-\d+)',
    re.MULTILINE | re.IGNORECASE
)
PARAGRAF_RE = re.compile(r'^Paragraf\s+(\d+)\s*\n\s*(.+)', re.MULTILINE)
PASAL_RE = re.compile(r'^Pasal\s+(\d+[A-Z]?)\s*$', re.MULTILINE)
AYAT_RE = re.compile(r'^\((\d+)\)\s+', re.MULTILINE)
PENJELASAN_RE = re.compile(r'^PENJELASAN\s*$', re.MULTILINE)

# Auto-metadata extraction patterns
FILENAME_RE = re.compile(r'^(uu|pp|perpres|perppu|permen|perda)-no-(\d+)-tahun-(\d{4})$', re.IGNORECASE)
TITLE_TEXT_RE = re.compile(
    r'(?:UNDANG-UNDANG|PERATURAN\s+PEMERINTAH|PERATURAN\s+PRESIDEN)'
    r'.*?(?:REPUBLIK\s+INDONESIA\s+)?NOMOR\s+(\d+)\s+TAHUN\s+(\d{4})\s+TENTANG\s+(.+?)(?:\n\n|DENGAN)',
    re.IGNORECASE | re.DOTALL,
)

_TYPE_NAME_MAP = {
    "UU": "Undang-Undang",
    "PP": "Peraturan Pemerintah",
    "PERPRES": "Peraturan Presiden",
    "PERPPU": "Peraturan Pemerintah Pengganti Undang-Undang",
    "PERMEN": "Peraturan Menteri",
    "PERDA": "Peraturan Daerah",
}

_TYPE_ACT_MAP = {
    "UU": "uu", "PP": "pp", "PERPRES": "perpres",
    "PERPPU": "perppu", "PERMEN": "permen", "PERDA": "perda",
}

# Law metadata from file names
LAW_METADATA = {
    "uu-no-13-tahun-2003": {"type": "UU", "number": "13", "year": 2003, "frbr_uri": "/akn/id/act/uu/2003/13", "title_id": "Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan", "status": "diubah"},
    "uu-no-6-tahun-2023": {"type": "UU", "number": "6", "year": 2023, "frbr_uri": "/akn/id/act/uu/2023/6", "title_id": "Undang-Undang Nomor 6 Tahun 2023 tentang Penetapan Perppu Cipta Kerja menjadi Undang-Undang", "status": "berlaku"},
    "uu-no-1-tahun-1974": {"type": "UU", "number": "1", "year": 1974, "frbr_uri": "/akn/id/act/uu/1974/1", "title_id": "Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan", "status": "diubah"},
    "uu-no-16-tahun-2019": {"type": "UU", "number": "16", "year": 2019, "frbr_uri": "/akn/id/act/uu/2019/16", "title_id": "Undang-Undang Nomor 16 Tahun 2019 tentang Perubahan atas UU 1/1974 tentang Perkawinan", "status": "berlaku"},
    "uu-no-1-tahun-2023": {"type": "UU", "number": "1", "year": 2023, "frbr_uri": "/akn/id/act/uu/2023/1", "title_id": "Undang-Undang Nomor 1 Tahun 2023 tentang Kitab Undang-Undang Hukum Pidana", "status": "berlaku"},
    "uu-no-31-tahun-1999": {"type": "UU", "number": "31", "year": 1999, "frbr_uri": "/akn/id/act/uu/1999/31", "title_id": "Undang-Undang Nomor 31 Tahun 1999 tentang Pemberantasan Tindak Pidana Korupsi", "status": "diubah"},
    "uu-no-20-tahun-2001": {"type": "UU", "number": "20", "year": 2001, "frbr_uri": "/akn/id/act/uu/2001/20", "title_id": "Undang-Undang Nomor 20 Tahun 2001 tentang Perubahan atas UU 31/1999 tentang Pemberantasan Tindak Pidana Korupsi", "status": "berlaku"},
    "uu-no-17-tahun-2003": {"type": "UU", "number": "17", "year": 2003, "frbr_uri": "/akn/id/act/uu/2003/17", "title_id": "Undang-Undang Nomor 17 Tahun 2003 tentang Keuangan Negara", "status": "berlaku"},
    "uu-no-8-tahun-1995": {"type": "UU", "number": "8", "year": 1995, "frbr_uri": "/akn/id/act/uu/1995/8", "title_id": "Undang-Undang Nomor 8 Tahun 1995 tentang Pasar Modal", "status": "berlaku"},
    "uu-no-8-tahun-1999": {"type": "UU", "number": "8", "year": 1999, "frbr_uri": "/akn/id/act/uu/1999/8", "title_id": "Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen", "status": "berlaku"},
    "uu-no-11-tahun-2016": {"type": "UU", "number": "11", "year": 2016, "frbr_uri": "/akn/id/act/uu/2016/11", "title_id": "Undang-Undang Nomor 11 Tahun 2016 tentang Pengampunan Pajak", "status": "berlaku"},
    "uu-no-40-tahun-2007": {"type": "UU", "number": "40", "year": 2007, "frbr_uri": "/akn/id/act/uu/2007/40", "title_id": "Undang-Undang Nomor 40 Tahun 2007 tentang Perseroan Terbatas", "status": "berlaku"},
    "uu-no-24-tahun-2011": {"type": "UU", "number": "24", "year": 2011, "frbr_uri": "/akn/id/act/uu/2011/24", "title_id": "Undang-Undang Nomor 24 Tahun 2011 tentang Badan Penyelenggara Jaminan Sosial", "status": "berlaku"},
    "uu-no-24-tahun-2003": {"type": "UU", "number": "24", "year": 2003, "frbr_uri": "/akn/id/act/uu/2003/24", "title_id": "Undang-Undang Nomor 24 Tahun 2003 tentang Mahkamah Konstitusi", "status": "berlaku"},
    "uu-no-12-tahun-2011": {"type": "UU", "number": "12", "year": 2011, "frbr_uri": "/akn/id/act/uu/2011/12", "title_id": "Undang-Undang Nomor 12 Tahun 2011 tentang Pembentukan Peraturan Perundang-undangan", "status": "diubah"},
    "uu-no-13-tahun-2022": {"type": "UU", "number": "13", "year": 2022, "frbr_uri": "/akn/id/act/uu/2022/13", "title_id": "Undang-Undang Nomor 13 Tahun 2022 tentang Perubahan Kedua atas UU 12/2011", "status": "berlaku"},
    "uu-no-14-tahun-2008": {"type": "UU", "number": "14", "year": 2008, "frbr_uri": "/akn/id/act/uu/2008/14", "title_id": "Undang-Undang Nomor 14 Tahun 2008 tentang Keterbukaan Informasi Publik", "status": "berlaku"},
    "uu-no-19-tahun-2016": {"type": "UU", "number": "19", "year": 2016, "frbr_uri": "/akn/id/act/uu/2016/19", "title_id": "Undang-Undang Nomor 19 Tahun 2016 tentang Perubahan atas UU ITE", "status": "diubah"},
    "uu-no-27-tahun-2024": {"type": "UU", "number": "27", "year": 2024, "frbr_uri": "/akn/id/act/uu/2024/27", "title_id": "Undang-Undang Nomor 27 Tahun 2024 tentang Perubahan Kedua atas UU ITE", "status": "berlaku"},
    "uu-no-27-tahun-2022": {"type": "UU", "number": "27", "year": 2022, "frbr_uri": "/akn/id/act/uu/2022/27", "title_id": "Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi", "status": "berlaku"},
}


def extract_metadata_from_filename(filename: str) -> dict | None:
    """Extract law metadata from PDF filename pattern like 'uu-no-13-tahun-2003'."""
    stem = Path(filename).stem
    m = FILENAME_RE.match(stem)
    if not m:
        return None
    raw_type = m.group(1).upper()
    number = m.group(2)
    year = int(m.group(3))
    act_code = _TYPE_ACT_MAP.get(raw_type, raw_type.lower())
    type_name = _TYPE_NAME_MAP.get(raw_type, raw_type)
    return {
        "type": raw_type,
        "number": number,
        "year": year,
        "frbr_uri": f"/akn/id/act/{act_code}/{year}/{number}",
        "title_id": f"{type_name} Nomor {number} Tahun {year}",
        "status": "berlaku",
    }


def extract_metadata_from_text(text: str) -> dict | None:
    """Extract law metadata from the first ~2000 chars of the document text."""
    header = text[:2000]
    m = TITLE_TEXT_RE.search(header)
    if not m:
        return None
    # Determine type from what matched
    header_upper = header[:m.end()].upper()
    if "UNDANG-UNDANG" in header_upper and "PERATURAN" not in header_upper:
        raw_type = "UU"
    elif "PERATURAN PEMERINTAH" in header_upper and "PRESIDEN" not in header_upper:
        raw_type = "PP"
    elif "PERATURAN PRESIDEN" in header_upper:
        raw_type = "PERPRES"
    else:
        raw_type = "UU"  # default fallback

    number = m.group(1)
    year = int(m.group(2))
    tentang = " ".join(m.group(3).split())  # normalize whitespace
    act_code = _TYPE_ACT_MAP.get(raw_type, raw_type.lower())
    type_name = _TYPE_NAME_MAP.get(raw_type, raw_type)
    return {
        "type": raw_type,
        "number": number,
        "year": year,
        "frbr_uri": f"/akn/id/act/{act_code}/{year}/{number}",
        "title_id": f"{type_name} Nomor {number} Tahun {year} tentang {tentang}",
        "status": "berlaku",
    }


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract all text from a PDF using pdfplumber."""
    try:
        text_parts = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        return '\n'.join(text_parts)
    except Exception as e:
        print(f"  ERROR reading PDF: {e}")
        return ""


def parse_penjelasan(text: str) -> list[dict]:
    """Parse a PENJELASAN section into nodes.

    Returns nodes of type 'penjelasan_umum' and 'penjelasan_pasal'.
    """
    nodes = []
    sort_base = 90000  # high sort_order to place after body content

    # Split at "I. UMUM" and "II. PASAL DEMI PASAL"
    umum_match = re.search(r'I\.\s*UMUM', text)
    pasal_demi_match = re.search(r'II\.\s*PASAL\s+DEMI\s+PASAL', text)

    if umum_match:
        umum_end = pasal_demi_match.start() if pasal_demi_match else len(text)
        umum_text = text[umum_match.end():umum_end].strip()
        if umum_text and len(umum_text) > 20:
            nodes.append({
                "type": "penjelasan_umum",
                "number": "",
                "heading": "Penjelasan Umum",
                "content": umum_text,
                "children": [],
                "sort_order": sort_base,
            })

    if pasal_demi_match:
        pasal_text = text[pasal_demi_match.end():]
        # Split by "Pasal N" patterns
        pasal_splits = re.split(r'(Pasal\s+\d+[A-Z]?)\s*\n', pasal_text)
        # pasal_splits alternates: [pre, "Pasal N", content, "Pasal M", content, ...]
        i = 1
        while i < len(pasal_splits) - 1:
            pasal_header = pasal_splits[i].strip()
            pasal_content = pasal_splits[i + 1].strip()
            pasal_num_match = re.match(r'Pasal\s+(\d+[A-Z]?)', pasal_header)
            if pasal_num_match:
                pasal_num = pasal_num_match.group(1)
                is_cukup_jelas = pasal_content.strip().lower().startswith("cukup jelas")
                nodes.append({
                    "type": "penjelasan_pasal",
                    "number": pasal_num,
                    "heading": f"Penjelasan Pasal {pasal_num}",
                    "content": pasal_content,
                    "children": [],
                    "sort_order": sort_base + int(pasal_num.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ") or "0"),
                    "metadata": {"cukup_jelas": is_cukup_jelas},
                })
            i += 2

    return nodes


def parse_into_nodes(text: str) -> list[dict]:
    """Parse law text into a hierarchical node structure."""
    # Split off penjelasan
    penjelasan_match = PENJELASAN_RE.search(text)
    if penjelasan_match:
        body_text = text[:penjelasan_match.start()]
    else:
        body_text = text

    # Parse penjelasan if present
    penjelasan_nodes = []
    if penjelasan_match:
        penjelasan_text = text[penjelasan_match.start():]
        penjelasan_nodes = parse_penjelasan(penjelasan_text)

    nodes = []
    current_bab = None
    current_bagian = None
    current_pasal = None
    sort_order = 0

    # Split text into lines for processing
    lines = body_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Detect BAB
        bab_match = re.match(r'^BAB\s+([IVXLCDM]+)\s*$', line)
        if bab_match:
            bab_num = bab_match.group(1)
            # Next non-empty line is the heading
            heading = ""
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                heading = lines[j].strip()
                # Sometimes heading spans multiple lines
                k = j + 1
                while k < len(lines) and lines[k].strip() and not re.match(r'^(BAB|Bagian|Pasal|Paragraf)\s', lines[k].strip()):
                    heading += " " + lines[k].strip()
                    k += 1
                i = k - 1

            current_bab = {
                "type": "bab",
                "number": bab_num,
                "heading": heading,
                "children": [],
                "sort_order": sort_order,
            }
            nodes.append(current_bab)
            current_bagian = None
            sort_order += 1
            i += 1
            continue

        # Detect Bagian
        bagian_match = BAGIAN_RE.match(line)
        if bagian_match:
            bagian_name = bagian_match.group(1)
            heading = ""
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                heading = lines[j].strip()
                i = j

            current_bagian = {
                "type": "bagian",
                "number": bagian_name,
                "heading": heading,
                "children": [],
                "sort_order": sort_order,
            }
            if current_bab:
                current_bab["children"].append(current_bagian)
            else:
                nodes.append(current_bagian)
            sort_order += 1
            i += 1
            continue

        # Detect Paragraf
        paragraf_match = PARAGRAF_RE.match(line + ("\n" + lines[i + 1] if i + 1 < len(lines) else ""))
        if paragraf_match:
            para_num = paragraf_match.group(1)
            para_heading = paragraf_match.group(2).strip() if paragraf_match.group(2) else ""
            paragraf_node = {
                "type": "paragraf",
                "number": para_num,
                "heading": para_heading,
                "children": [],
                "sort_order": sort_order,
            }
            if current_bagian:
                current_bagian["children"].append(paragraf_node)
            elif current_bab:
                current_bab["children"].append(paragraf_node)
            else:
                nodes.append(paragraf_node)
            # Use current_bagian slot to nest subsequent pasals under paragraf
            current_bagian = paragraf_node
            sort_order += 1
            i += 2  # skip heading line
            continue

        # Detect Pasal
        pasal_match = re.match(r'^Pasal\s+(\d+[A-Z]?)\s*$', line)
        if pasal_match:
            pasal_num = pasal_match.group(1)
            # Collect all content until next Pasal, BAB, Bagian, or Penjelasan
            content_lines = []
            j = i + 1
            while j < len(lines):
                next_line = lines[j].strip()
                if re.match(r'^(BAB\s+[IVXLCDM]+|Pasal\s+\d+[A-Z]?|Bagian\s+(Ke|Ke-\d+)|Paragraf\s+\d+|PENJELASAN)\s*$', next_line, re.IGNORECASE):
                    break
                content_lines.append(lines[j])
                j += 1

            content = '\n'.join(content_lines).strip()

            # Parse ayat from content
            ayat_children = []
            ayat_matches = list(re.finditer(r'^\((\d+)\)\s*', content, re.MULTILINE))
            if ayat_matches:
                for idx, am in enumerate(ayat_matches):
                    ayat_start = am.start()
                    ayat_end = ayat_matches[idx + 1].start() if idx + 1 < len(ayat_matches) else len(content)
                    ayat_text = content[am.end():ayat_end].strip()
                    ayat_children.append({
                        "type": "ayat",
                        "number": am.group(1),
                        "content": ayat_text,
                    })

            pasal_node = {
                "type": "pasal",
                "number": pasal_num,
                "content": content,
                "children": ayat_children,
                "sort_order": sort_order,
            }

            # Add to appropriate parent
            if current_bagian:
                current_bagian["children"].append(pasal_node)
            elif current_bab:
                current_bab["children"].append(pasal_node)
            else:
                nodes.append(pasal_node)

            current_pasal = pasal_node
            sort_order += 1
            i = j
            continue

        i += 1

    if penjelasan_nodes:
        nodes.extend(penjelasan_nodes)

    return nodes


def count_pasals(nodes: list[dict]) -> int:
    """Count total number of pasal nodes in the tree."""
    count = 0
    for node in nodes:
        if node["type"] == "pasal":
            count += 1
        count += count_pasals(node.get("children", []))
    return count


def parse_single_law(pdf_path: Path) -> dict | None:
    """Parse a single law PDF into structured JSON.

    Metadata resolution order: LAW_METADATA (hardcoded) → filename → text header.
    """
    slug = pdf_path.stem

    print(f"  Extracting text from {slug}...")
    text = extract_text_from_pdf(pdf_path)
    if not text or len(text) < 100:
        print(f"  WARNING: Very short text ({len(text)} chars)")
        return None

    # Resolve metadata: hardcoded → filename → text extraction
    meta = LAW_METADATA.get(slug)
    if not meta:
        meta = extract_metadata_from_filename(slug)
        if meta:
            print(f"  Auto-extracted metadata from filename: {meta['type']} {meta['number']}/{meta['year']}")
    if not meta:
        meta = extract_metadata_from_text(text)
        if meta:
            print(f"  Auto-extracted metadata from text: {meta['title_id']}")
    if not meta:
        print(f"  No metadata for {slug}, skipping")
        return None

    print(f"  Text: {len(text)} chars, parsing structure...")
    nodes = parse_into_nodes(text)
    pasal_count = count_pasals(nodes)
    print(f"  Found {len(nodes)} top-level nodes, {pasal_count} pasals")

    return {
        "frbr_uri": meta["frbr_uri"],
        "type": meta["type"],
        "number": meta["number"],
        "year": meta["year"],
        "title_id": meta["title_id"],
        "status": meta.get("status", "berlaku"),
        "source_url": f"https://peraturan.go.id/id/{slug}",
        "source_pdf_url": f"https://peraturan.go.id/files/{slug.replace('-', '')}.pdf",
        "full_text": text,
        "nodes": nodes,
        "stats": {
            "text_length": len(text),
            "pasal_count": pasal_count,
            "node_count": len(nodes),
        }
    }


def main():
    PARSED_DIR.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDF files")

    results = []
    for pdf_path in pdf_files:
        print(f"\nParsing {pdf_path.name}...")
        result = parse_single_law(pdf_path)
        if result:
            # Save parsed JSON
            safe_uri = result["frbr_uri"].replace("/", "_").lstrip("_")
            outfile = PARSED_DIR / f"{safe_uri}.json"
            with open(outfile, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"  Saved to {outfile.name}")
            results.append({
                "frbr_uri": result["frbr_uri"],
                "title": result["title_id"],
                "pasals": result["stats"]["pasal_count"],
                "text_length": result["stats"]["text_length"],
            })

    print(f"\n=== Summary ===")
    print(f"Parsed: {len(results)}/{len(pdf_files)} laws")
    total_pasals = sum(r["pasals"] for r in results)
    print(f"Total pasals: {total_pasals}")
    for r in results:
        print(f"  {r['frbr_uri']}: {r['pasals']} pasals, {r['text_length']} chars")


if __name__ == "__main__":
    main()
