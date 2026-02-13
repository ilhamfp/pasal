"""Regex state machine parser for Indonesian legal document structure.

Parses text into hierarchical structure:
BAB -> Bagian -> Paragraf -> Pasal -> Ayat

Improved version of parse_law.py's parse_into_nodes(), with:
- Proper state machine
- Better Penjelasan handling
- Flat regulation support (no BAB)
- Output compatible with document_nodes schema
"""
import re

# Structural patterns
BAB_RE = re.compile(r'^BAB\s+([IVXLCDM]+)\s*$', re.MULTILINE)
BAGIAN_RE = re.compile(
    r'^Bagian\s+(Kesatu|Kedua|Ketiga|Keempat|Kelima|Keenam|Ketujuh|Kedelapan|Kesembilan|Kesepuluh'
    r'|Kesebelas|Kedua\s*Belas|Ketiga\s*Belas|Keempat\s*Belas|Kelima\s*Belas|Keenam\s*Belas'
    r'|Ketujuh\s*Belas|Kedelapan\s*Belas|Kesembilan\s*Belas|Kedua\s*Puluh'
    r'|Ke-\d+)',
    re.MULTILINE | re.IGNORECASE
)
PARAGRAF_RE = re.compile(r'^Paragraf\s+(\d+)\s*$', re.MULTILINE)
PASAL_RE = re.compile(r'^Pasal\s+(\d+[A-Z]?)\s*$', re.MULTILINE)
AYAT_RE = re.compile(r'^\((\d+)\)\s+', re.MULTILINE)
PENJELASAN_RE = re.compile(r'^PENJELASAN\s*$', re.MULTILINE)

# Structural boundary pattern
BOUNDARY_RE = re.compile(
    r'^(BAB\s+[IVXLCDM]+|Pasal\s+\d+[A-Z]?|Bagian\s+\w+|Paragraf\s+\d+|PENJELASAN)\s*$',
    re.MULTILINE | re.IGNORECASE,
)


def _parse_ayat(content: str) -> list[dict]:
    """Parse ayat (sub-article) from pasal content."""
    ayat_children = []
    seen: set[str] = set()
    matches = list(re.finditer(r'^\((\d+)\)\s*', content, re.MULTILINE))

    if not matches:
        return []

    for idx, am in enumerate(matches):
        ayat_num = am.group(1)
        if ayat_num in seen:
            continue
        seen.add(ayat_num)
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(content)
        ayat_text = content[am.end():end].strip()
        ayat_children.append({
            "type": "ayat",
            "number": ayat_num,
            "content": ayat_text,
        })

    return ayat_children


def parse_structure(text: str) -> list[dict]:
    """Parse law text into hierarchical node structure.

    Returns list of nodes matching document_nodes schema:
    {type, number, heading, content, children, sort_order}
    """
    # Split off penjelasan
    penjelasan_match = PENJELASAN_RE.search(text)
    body_text = text[:penjelasan_match.start()] if penjelasan_match else text

    nodes = []
    current_bab = None
    current_bagian = None
    sort_order = 0

    lines = body_text.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Detect BAB
        bab_match = re.match(r'^BAB\s+([IVXLCDM]+)\s*$', line)
        if bab_match:
            bab_num = bab_match.group(1)
            heading = ""
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                heading = lines[j].strip()
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
        paragraf_match = re.match(r'^Paragraf\s+(\d+)\s*$', line)
        if paragraf_match:
            para_num = paragraf_match.group(1)
            heading = ""
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and not re.match(r'^(BAB|Bagian|Pasal|Paragraf)\s', lines[j].strip()):
                heading = lines[j].strip()
                i = j

            paragraf_node = {
                "type": "paragraf",
                "number": para_num,
                "heading": heading,
                "children": [],
                "sort_order": sort_order,
            }
            if current_bagian:
                current_bagian["children"].append(paragraf_node)
            elif current_bab:
                current_bab["children"].append(paragraf_node)
            else:
                nodes.append(paragraf_node)
            current_bagian = paragraf_node
            sort_order += 1
            i += 1
            continue

        # Detect Pasal
        pasal_match = re.match(r'^Pasal\s+(\d+[A-Z]?)\s*$', line)
        if pasal_match:
            pasal_num = pasal_match.group(1)
            content_lines = []
            j = i + 1
            while j < len(lines):
                next_line = lines[j].strip()
                if re.match(
                    r'^(BAB\s+[IVXLCDM]+|Pasal\s+\d+[A-Z]?|Bagian\s+\w+|Paragraf\s+\d+|PENJELASAN)\s*$',
                    next_line, re.IGNORECASE
                ):
                    break
                content_lines.append(lines[j])
                j += 1

            content = '\n'.join(content_lines).strip()
            ayat_children = _parse_ayat(content)

            pasal_node = {
                "type": "pasal",
                "number": pasal_num,
                "content": content,
                "children": ayat_children,
                "sort_order": sort_order,
            }

            if current_bagian:
                current_bagian["children"].append(pasal_node)
            elif current_bab:
                current_bab["children"].append(pasal_node)
            else:
                nodes.append(pasal_node)

            sort_order += 1
            i = j
            continue

        i += 1

    # Parse penjelasan
    if penjelasan_match:
        penjelasan_text = text[penjelasan_match.start():]
        penjelasan_nodes = parse_penjelasan(penjelasan_text)
        nodes.extend(penjelasan_nodes)

    return nodes


def parse_penjelasan(text: str) -> list[dict]:
    """Parse PENJELASAN section into nodes."""
    nodes = []
    sort_base = 90000

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
        splits = re.split(r'(Pasal\s+\d+[A-Z]?)\s*\n', pasal_text)
        i = 1
        while i < len(splits) - 1:
            header = splits[i].strip()
            content = splits[i + 1].strip()
            num_match = re.match(r'Pasal\s+(\d+[A-Z]?)', header)
            if num_match:
                num = num_match.group(1)
                nodes.append({
                    "type": "penjelasan_pasal",
                    "number": num,
                    "heading": f"Penjelasan Pasal {num}",
                    "content": content,
                    "children": [],
                    "sort_order": sort_base + int(num.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ") or "0"),
                })
            i += 2

    return nodes


def count_pasals(nodes: list[dict]) -> int:
    """Count total pasal nodes in tree."""
    count = 0
    for node in nodes:
        if node["type"] == "pasal":
            count += 1
        count += count_pasals(node.get("children", []))
    return count
