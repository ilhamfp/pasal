"""Text-first parser for Indonesian legal document structure.

Philosophy: capture ALL text first, then add structural metadata.
No text is ever dropped. If we can identify a section as BAB, Pasal, or Ayat,
we tag it. If we can't, we still keep the text as a generic content node.

Parses into hierarchy: preamble -> BAB -> Bagian -> Paragraf -> Pasal -> Ayat
Also handles PENJELASAN (Elucidation) sections.

Output compatible with document_nodes schema:
{type, number, heading, content, children, sort_order}
"""
import re

# ── Structural marker patterns ──────────────────────────────────────────────
BAB_RE = re.compile(r'^BAB\s+([IVXLCDM]+)\s*$', re.MULTILINE)
BAGIAN_RE = re.compile(
    r'^Bagian\s+(Kesatu|Kedua|Ketiga|Keempat|Kelima|Keenam|Ketujuh|Kedelapan|Kesembilan|Kesepuluh'
    r'|Kesebelas|Kedua\s*Belas|Ketiga\s*Belas|Keempat\s*Belas|Kelima\s*Belas|Keenam\s*Belas'
    r'|Ketujuh\s*Belas|Kedelapan\s*Belas|Kesembilan\s*Belas|Kedua\s*Puluh'
    r'|Ke-\d+)',
    re.MULTILINE | re.IGNORECASE,
)
PARAGRAF_RE = re.compile(r'^Paragraf\s+(\d+)\s*$', re.MULTILINE)
PASAL_RE = re.compile(r'^Pasal[ \t]+(\d+[A-Z]?)\s*$', re.MULTILINE)
PENJELASAN_RE = re.compile(r'^\s*PENJELASAN\s*$', re.MULTILINE)

# UUD 1945 special sections: ATURAN PERALIHAN and ATURAN TAMBAHAN
# These act as top-level sections (like BAB) but without BAB numbering.
ATURAN_RE = re.compile(r'^(ATURAN\s+PERALIHAN|ATURAN\s+TAMBAHAN)\s*$', re.MULTILINE)

# Roman numeral Pasal pattern (used legitimately in ATURAN PERALIHAN)
PASAL_ROMAN_RE = re.compile(r'^Pasal[ \t]+([IVXLCDM]+)\s*$', re.MULTILINE)

# Combined boundary pattern for detecting section breaks
BOUNDARY_RE = re.compile(
    r'^(BAB\s+[IVXLCDM]+|Pasal[ \t]+\d+[A-Z]?|Pasal[ \t]+[IVXLCDM]+'
    r'|Bagian\s+\w+|Paragraf\s+\d+|PENJELASAN|ATURAN\s+PERALIHAN|ATURAN\s+TAMBAHAN)\s*$',
    re.MULTILINE | re.IGNORECASE,
)

# ── Roman numeral Pasal fix (OCR artifact) ──────────────────────────────────
_ROMAN_PASAL_RE = re.compile(r'^(Pasal)[ \t]+([IVXLCDM]+)\s*$', re.MULTILINE)
_ROMAN_MAP = {
    'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
    'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10',
    'XI': '11', 'XII': '12', 'XIII': '13', 'XIV': '14', 'XV': '15',
}
_AMENDMENT_RE = re.compile(
    r'Perubahan\s+(?:Atas|Kedua|Ketiga|Keempat)',
    re.IGNORECASE,
)


def _is_amendment_law(text: str) -> bool:
    """Check if text is an amendment law (which legitimately uses Roman Pasal numbers)."""
    return bool(_AMENDMENT_RE.search(text[:2000]))


def _has_aturan_peralihan(text: str) -> bool:
    """Check if text contains ATURAN PERALIHAN (uses Roman Pasal numbers legitimately)."""
    return bool(ATURAN_RE.search(text))


def _fix_roman_pasals(text: str) -> str:
    """Convert OCR-artifact Roman Pasals to Arabic digits.

    Preserves Roman Pasal numbers when they're legitimate:
    - Amendment laws use Roman Pasals throughout
    - ATURAN PERALIHAN sections use Roman Pasals (I, II, III, IV)
    """
    if _is_amendment_law(text):
        return text

    if _has_aturan_peralihan(text):
        # Only convert Roman Pasals BEFORE the ATURAN PERALIHAN section.
        # Pasals after that marker are legitimately Roman-numbered.
        aturan_match = ATURAN_RE.search(text)
        before = text[:aturan_match.start()]
        after = text[aturan_match.start():]

        def _replacer(m: re.Match) -> str:
            roman = m.group(2)
            arabic = _ROMAN_MAP.get(roman)
            if arabic is not None:
                return f"{m.group(1)} {arabic}"
            return m.group(0)

        return _ROMAN_PASAL_RE.sub(_replacer, before) + after

    def _replacer(m: re.Match) -> str:
        roman = m.group(2)
        arabic = _ROMAN_MAP.get(roman)
        if arabic is not None:
            return f"{m.group(1)} {arabic}"
        return m.group(0)  # Unknown roman numeral, leave as-is

    return _ROMAN_PASAL_RE.sub(_replacer, text)


# ── Line rejoining ───────────────────────────────────────────────────────────
# PDF extraction produces one line per visual line (~50-60 chars). We rejoin
# lines that were split by column wrapping while preserving intentional breaks.
#
# Rule: join to previous line UNLESS:
#   - blank line (paragraph break)
#   - starts with (N) ayat marker
#   - starts with a./b. or 1./2. list item
#   - previous line ended with terminal punctuation (. ; :)
#
# This covers all cases: lowercase continuations, uppercase proper nouns
# mid-sentence (Undang-Undang, Republik, PPATK), and comma-separated clauses.
# Terminal punctuation on the previous line is the reliable signal that the
# next line starts something new (a new ayat, list item, or sentence).

_LIST_ITEM_RE = re.compile(r'^(?:[a-z]\.|[a-z]\.\s|\d+\.\s|\d+\.)')
_AYAT_START_RE = re.compile(r'^\(\d+\)')


_BARE_LIST_RE = re.compile(r'^[a-z]\.\s*$|^\d+\.\s*$')


def _rejoin_content_lines(text: str) -> str:
    """Rejoin PDF word-wrapped lines in node content.

    Joins a line to the previous one when the previous line does NOT end
    with terminal punctuation (. ; :), skipping blank lines and list/ayat
    markers which always start a new line.

    Special case: bare list markers ("a." / "1." alone on a line) get merged
    with the next non-blank line since the PDF split the marker from its text.
    """
    lines = text.split('\n')
    if not lines:
        return text

    # First pass: merge bare list markers with next non-blank line.
    # PDF often puts "a." on one line and the item text on the next.
    merged: list[str] = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if _BARE_LIST_RE.match(stripped):
            marker = stripped.rstrip()
            i += 1
            # Skip blanks between marker and its text
            while i < len(lines) and not lines[i].strip():
                i += 1
            if i < len(lines):
                merged.append(f'{marker} {lines[i].strip()}')
                i += 1
            else:
                merged.append(marker)
        else:
            merged.append(lines[i])
            i += 1

    # Second pass: rejoin word-wrapped lines based on terminal punctuation.
    result: list[str] = [merged[0].strip()]

    for i in range(1, len(merged)):
        stripped = merged[i].strip()

        # Blank line → paragraph break
        if not stripped:
            result.append('')
            continue

        # Ayat marker or list item → always new line
        if _AYAT_START_RE.match(stripped) or _LIST_ITEM_RE.match(stripped):
            result.append(stripped)
            continue

        # Check what the previous non-blank line ended with
        prev = result[-1] if result else ''
        if prev and prev[-1] not in '.;:':
            # Previous line ended mid-sentence → join
            result[-1] = prev + ' ' + stripped
        else:
            # Previous line ended with terminal punctuation → new line
            result.append(stripped)

    return '\n'.join(result)


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


def _find_markers(text: str) -> list[tuple[str, str, int, int]]:
    """Find all structural markers and their positions in the text.

    Returns list of (type, number, line_start, line_end) sorted by position.
    line_start is the start of the marker line, line_end is the end.
    """
    markers = []

    for m in BAB_RE.finditer(text):
        markers.append(("bab", m.group(1), m.start(), m.end()))

    # ATURAN PERALIHAN / ATURAN TAMBAHAN — top-level sections like BAB
    for m in ATURAN_RE.finditer(text):
        label = m.group(1).strip()
        markers.append(("aturan", label, m.start(), m.end()))

    for m in BAGIAN_RE.finditer(text):
        markers.append(("bagian", m.group(1), m.start(), m.end()))

    for m in PARAGRAF_RE.finditer(text):
        markers.append(("paragraf", m.group(1), m.start(), m.end()))

    # Arabic Pasals (Pasal 1, Pasal 2, etc.)
    for m in PASAL_RE.finditer(text):
        markers.append(("pasal", m.group(1), m.start(), m.end()))

    # Roman Pasals (Pasal I, Pasal II, etc.) — used in ATURAN PERALIHAN
    for m in PASAL_ROMAN_RE.finditer(text):
        # Only add if not already captured as an Arabic Pasal
        if not any(em[2] == m.start() for em in markers):
            markers.append(("pasal", m.group(1), m.start(), m.end()))

    markers.sort(key=lambda x: x[2])
    return markers


def _extract_heading(text: str) -> tuple[str, str]:
    """Extract heading from the beginning of a section's content.

    For BAB/Bagian/Paragraf, the heading is the first non-empty line(s)
    before the next structural marker.

    Returns (heading, remaining_content).
    """
    lines = text.split('\n')
    heading_lines = []
    content_start = 0

    for j, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            if heading_lines:
                content_start = j + 1
                break
            continue
        # Stop at structural markers
        if BOUNDARY_RE.match(stripped):
            content_start = j
            break
        heading_lines.append(stripped)
        content_start = j + 1
        # Headings are typically 1-3 lines
        if len(heading_lines) >= 3:
            break

    heading = ' '.join(heading_lines)
    remaining = '\n'.join(lines[content_start:]).strip()
    return heading, remaining


def parse_structure(text: str) -> list[dict]:
    """Parse law text into hierarchical node structure.

    TEXT-FIRST: every character of input text ends up in exactly one node.
    Structural markers (BAB, Pasal, etc.) add metadata to sections.
    Text that doesn't match any structure becomes 'preamble' or 'content' nodes.

    Returns list of nodes matching document_nodes schema:
    {type, number, heading, content, children, sort_order}
    """
    # Pre-process: fix Roman numeral Pasals (OCR artifact)
    text = _fix_roman_pasals(text)

    # Split off penjelasan
    penjelasan_match = PENJELASAN_RE.search(text)

    # Fallback: detect penjelasan by section markers in latter half of text
    if not penjelasan_match:
        half = len(text) // 2
        fb = re.search(r'^(?:I\.\s*UMUM|II?\.\s*PASAL\s+DEMI\s+PASAL)', text[half:], re.MULTILINE)
        if fb:
            # Walk back to find a reasonable split point (blank line before the marker)
            abs_pos = half + fb.start()
            # Find the last blank line before this position
            preceding = text[:abs_pos]
            last_blank = preceding.rfind('\n\n')
            split_pos = last_blank if last_blank > half - 200 else abs_pos
            penjelasan_match = type('Match', (), {'start': lambda self, _p=split_pos: _p})()
    body_text = text[:penjelasan_match.start()] if penjelasan_match else text

    # Find all structural markers
    markers = _find_markers(body_text)

    nodes: list[dict] = []
    sort_order = 0

    # ── Capture preamble (text before first marker) ──────────────────────
    first_marker_pos = markers[0][2] if markers else len(body_text)
    preamble = body_text[:first_marker_pos].strip()
    if preamble:
        nodes.append({
            "type": "preamble",
            "number": "",
            "heading": "",
            "content": _rejoin_content_lines(preamble),
            "children": [],
            "sort_order": sort_order,
        })
        sort_order += 1

    # ── Process markers: create nodes for each section ───────────────────
    current_bab = None
    current_bagian = None

    for i, (mtype, number, mstart, mend) in enumerate(markers):
        # Content: from end of this marker line to start of next marker
        next_start = markers[i + 1][2] if i + 1 < len(markers) else len(body_text)
        raw_content = body_text[mend:next_start].strip()

        if mtype == "bab":
            heading, leftover = _extract_heading(raw_content)
            current_bab = {
                "type": "bab",
                "number": number,
                "heading": heading,
                "content": leftover,
                "children": [],
                "sort_order": sort_order,
            }
            nodes.append(current_bab)
            current_bagian = None
            sort_order += 1

        elif mtype == "aturan":
            # ATURAN PERALIHAN / ATURAN TAMBAHAN — top-level like BAB
            current_bab = {
                "type": "aturan",
                "number": number,  # "ATURAN PERALIHAN" or "ATURAN TAMBAHAN"
                "heading": number,
                "content": raw_content,
                "children": [],
                "sort_order": sort_order,
            }
            nodes.append(current_bab)
            current_bagian = None
            sort_order += 1

        elif mtype == "bagian":
            heading, leftover = _extract_heading(raw_content)
            current_bagian = {
                "type": "bagian",
                "number": number,
                "heading": heading,
                "content": leftover,
                "children": [],
                "sort_order": sort_order,
            }
            if current_bab:
                current_bab["children"].append(current_bagian)
            else:
                nodes.append(current_bagian)
            sort_order += 1

        elif mtype == "paragraf":
            heading, leftover = _extract_heading(raw_content)
            paragraf_node = {
                "type": "paragraf",
                "number": number,
                "heading": heading,
                "content": leftover,
                "children": [],
                "sort_order": sort_order,
            }
            if current_bagian:
                current_bagian["children"].append(paragraf_node)
            elif current_bab:
                current_bab["children"].append(paragraf_node)
            else:
                nodes.append(paragraf_node)
            # Paragraf acts as the new "current_bagian" for subsequent pasals
            current_bagian = paragraf_node
            sort_order += 1

        elif mtype == "pasal":
            rejoined = _rejoin_content_lines(raw_content)
            ayat_children = _parse_ayat(rejoined)
            pasal_node = {
                "type": "pasal",
                "number": number,
                "content": rejoined,
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

    # ── No markers found: capture entire body as content ─────────────────
    if not markers and not preamble:
        nodes.append({
            "type": "content",
            "number": "",
            "heading": "",
            "content": _rejoin_content_lines(body_text.strip()),
            "children": [],
            "sort_order": sort_order,
        })
        sort_order += 1

    # ── Parse penjelasan ─────────────────────────────────────────────────
    if penjelasan_match:
        penjelasan_text = text[penjelasan_match.start():]
        penjelasan_nodes = parse_penjelasan(penjelasan_text)
        nodes.extend(penjelasan_nodes)

    return nodes


def parse_penjelasan(text: str) -> list[dict]:
    """Parse PENJELASAN section into nodes.

    Captures ALL penjelasan text — doesn't drop anything.
    """
    nodes = []
    sort_base = 90000

    umum_match = re.search(r'I\.\s*UMUM', text)
    pasal_demi_match = re.search(r'II\.\s*PASAL\s+DEMI\s+PASAL', text)

    # If no structured sub-sections found, capture the whole thing
    if not umum_match and not pasal_demi_match:
        content = text[len("PENJELASAN"):].strip() if text.upper().startswith("PENJELASAN") else text.strip()
        if content:
            nodes.append({
                "type": "penjelasan_umum",
                "number": "",
                "heading": "Penjelasan",
                "content": content,
                "children": [],
                "sort_order": sort_base,
            })
        return nodes

    # Text between PENJELASAN header and "I. UMUM" (if any)
    if umum_match:
        pre_umum = text[:umum_match.start()].strip()
        # Remove the "PENJELASAN" header itself
        pre_umum = re.sub(r'^PENJELASAN\s*', '', pre_umum).strip()
        # Capture preamble text before "I. UMUM" if substantial
        if pre_umum and len(pre_umum) > 20:
            nodes.append({
                "type": "penjelasan_umum",
                "number": "",
                "heading": "Penjelasan — Pendahuluan",
                "content": pre_umum,
                "children": [],
                "sort_order": sort_base - 1,
            })

    if umum_match:
        umum_end = pasal_demi_match.start() if pasal_demi_match else len(text)
        umum_text = text[umum_match.end():umum_end].strip()
        if umum_text:
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

        # Capture any text before the first "Pasal X" in the section
        pre_pasal = splits[0].strip() if splits else ""
        if pre_pasal and len(pre_pasal) > 20:
            nodes.append({
                "type": "penjelasan_umum",
                "number": "",
                "heading": "Penjelasan Pasal Demi Pasal — Pendahuluan",
                "content": pre_pasal,
                "children": [],
                "sort_order": sort_base + 1,
            })

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
                    "sort_order": sort_base + 2 + int(num.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ") or "0"),
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
