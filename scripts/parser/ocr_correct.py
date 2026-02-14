"""Deterministic OCR error correction for Indonesian legal text.

Fixes common OCR artifacts found in scanned legal documents.
Fixes common OCR artifacts: broken ligatures, misread characters, spacing issues.
"""
import re


# Common OCR substitutions in Indonesian legal text
_OCR_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Letter-digit confusion
    (re.compile(r'^(Pasal)[ \t]+l\s*$', re.MULTILINE), r'\1 1'),  # Standalone Pasal l -> Pasal 1
    (re.compile(r'(?<=Pasal\s)[lI](\d+)', re.MULTILINE), r'1\1'),  # Pasal l3 -> Pasal 13
    (re.compile(r'(\d)O(?=\s|$|\n)'), lambda m: m.group(1) + '0'),  # 1O -> 10, 9O -> 90
    (re.compile(r'(?<=Pasal\s)(\d+)O\b'), lambda m: m.group(1) + '0'),  # Pasal 1O -> Pasal 10
    (re.compile(r'(?<=\s)l(?=\d{2,})'), '1'),  # l23 -> 123
    (re.compile(r'(?<=\d)l(?=\d)'), '1'),  # 2l3 -> 213

    # Common word-level OCR errors in Indonesian legal text
    (re.compile(r'\bFRESIDEN\b', re.IGNORECASE), 'PRESIDEN'),     # P->F OCR confusion
    (re.compile(r'\bPRES[!I1]DEN\b', re.IGNORECASE), 'PRESIDEN'),
    (re.compile(r'\bREPUB[!I1]IK\b', re.IGNORECASE), 'REPUBLIK'),
    (re.compile(r'\bINDONES[!I1]A\b', re.IGNORECASE), 'INDONESIA'),
    (re.compile(r'\bUNDANG[\s-]*UNDANG\b', re.IGNORECASE), 'UNDANG-UNDANG'),
    (re.compile(r'\bPERATURAN\s+PEMER[!I1]NTAH\b', re.IGNORECASE), 'PERATURAN PEMERINTAH'),
    (re.compile(r'\bMENIMBANG\b', re.IGNORECASE), 'Menimbang'),
    (re.compile(r'\bMENGINGAT\b', re.IGNORECASE), 'Mengingat'),
    (re.compile(r'\bMEMUTUSKAN\b', re.IGNORECASE), 'MEMUTUSKAN'),
    (re.compile(r'\bMENETAPKAN\b', re.IGNORECASE), 'MENETAPKAN'),

    # Ligature and encoding artifacts
    (re.compile(r'ﬁ'), 'fi'),
    (re.compile(r'ﬂ'), 'fl'),
    (re.compile(r'ﬀ'), 'ff'),
    (re.compile(r'\u00a0'), ' '),  # Non-breaking space → regular space

    # Common scanner artifacts
    (re.compile(r'^[;,.]$', re.MULTILINE), ''),  # Lone punctuation on a line
    (re.compile(r'^\s*[-_]{3,}\s*$', re.MULTILINE), ''),  # Horizontal rules from scan lines
]


def correct_ocr_errors(text: str) -> str:
    """Apply deterministic OCR error corrections to text.

    Returns corrected text.
    """
    for pattern, replacement in _OCR_PATTERNS:
        if callable(replacement):
            text = pattern.sub(replacement, text)
        else:
            text = pattern.sub(replacement, text)

    # Collapse runs of blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text
