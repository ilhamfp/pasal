"""PyMuPDF-based text extraction for Indonesian legal PDFs.

~100x faster than pdfplumber.
"""
import re
import signal
from pathlib import Path

EXTRACTION_TIMEOUT = 120  # seconds — abort if a single PDF takes longer

_PAGE_HEADER_RE = re.compile(
    r'^(?:SALINAN\s*\n)?'
    r'(?:[FP]RE\s*S\s*I\s*DEN|PRES\s+IDEN)\s*\n'      # PRESIDEN, FRESIDEN, PRES IDEN
    r'\s*(?:RE|NE|RF)\w+\s+(?:IN|TN)\w+\s*\n'           # REPUBLIK INDONESIA + OCR variants
    r'(?:\s*-\s*\d+\s*-?\s*\n)?',
    re.MULTILINE | re.IGNORECASE,
)
_PAGE_FOOTER_RE = re.compile(
    r'(?:^Halaman\s+\d+\s+dari\s+\d+\s*$'
    r'|^SK\s+No\s*[\d\'\s]+[A-Z]?\s*$'
    r'|^;?\*?[a-zA-Z]*(?:trE|EtrN)\s*$'
    r'|^(?:iIi|REFUBLIK|REPUEUK)\s+INDONESIA\s*$'
    r'|^(?:[FP]RE\s*S\s*I\s*DEN|PRES\s+IDEN)\s*$'       # standalone FRESIDEN/PRESIDEN line
    r'|^\s*(?:RE|NE|RF)\w+\s+(?:IN|TN)\w+\s*$'           # standalone REPUBLIK INDONESIA variants
    r'|^\s*-\s*\d+\s*-\s*$'                               # standalone page numbers like - 3 -
    r'|^\s*SALINAN\s*$'                                    # PERDA watermark/copy stamp
    r'|^\s*(?:www\.)?peraturan\.go\.id\s*$'                # peraturan.go.id watermark
    r'|^\s*(?:www\.)?djpp\.depkumham\.go\.id\s*$'          # old DJPP watermark (UU 2011-2014)
    r'|^\s*ditjen\s+Peraturan\s+Perundang-undangan\s*$'   # old ministry dept watermark
    r'|^\s*file:///\S+\s*$'                                # local file path from PDF printing
    r'|^\s*\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*$'  # print timestamp
    r'|^\s*\d+\s+of\s+\d+\s*$)',                           # "3 of 32" page counter
    re.MULTILINE | re.IGNORECASE,
)


def _strip_page_header(text: str, page_num: int) -> str:
    """Strip page headers from a single page's text (before concatenation).

    More reliable than post-concatenation regex because we know position
    context: first few lines are headers. Handles:
    - PERMEN/PERBAN: '-2-' or '- 2 -' (top of pages 2+)
    - PERDA: bare '2' (top of pages 2+)
    - PERDA: 'SALINAN' watermark at page boundaries
    - UU: '2022, No.4' gazette headers
    """
    if page_num == 0:
        # Page 1: only strip SALINAN if present as first substantial line
        lines = text.split('\n')
        cleaned = []
        for i, line in enumerate(lines):
            if i < 3 and line.strip() == 'SALINAN':
                continue
            cleaned.append(line)
        return '\n'.join(cleaned)

    # Pages 2+: strip leading page numbers (any format) and SALINAN
    # Only strip from the first ~5 lines to avoid false positives
    lines = text.split('\n')
    cleaned: list[str] = []
    header_zone = True
    for i, line in enumerate(lines):
        if header_zone and i < 5:
            stripped = line.strip()
            # Skip blank lines in header zone
            if not stripped:
                cleaned.append(line)
                continue
            # Skip page number lines: "- 2 -", "-2-", "2"
            if re.match(r'^-?\s*\d{1,4}\s*-?$', stripped):
                continue
            # Skip gazette headers: "2022, No.4"
            if re.match(r'^\d{4},\s*No\.\s*\d+', stripped):
                continue
            # Skip SALINAN watermark
            if stripped == 'SALINAN':
                continue
            # Skip website/watermark lines
            if stripped in ('www.peraturan.go.id', 'peraturan.go.id',
                            'www.djpp.depkumham.go.id'):
                continue
            if stripped.lower().startswith('ditjen peraturan'):
                continue
            if stripped.startswith('file:///'):
                continue
            if re.match(r'^\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}', stripped):
                continue
            if re.match(r'^\d+\s+of\s+\d+$', stripped, re.IGNORECASE):
                continue
            header_zone = False
        cleaned.append(line)
    return '\n'.join(cleaned)


def _clean_pdf_text(text: str) -> str:
    """Remove page headers, footers, and fix common OCR artifacts."""
    text = _PAGE_HEADER_RE.sub('', text)
    text = _PAGE_FOOTER_RE.sub('', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def _dedup_page_breaks(pages: list[str]) -> str:
    """Join pages while removing duplicated text at page boundaries."""
    if not pages:
        return ""
    result = pages[0]
    for page in pages[1:]:
        overlap = 0
        max_check = min(200, len(result), len(page))
        for length in range(max_check, 10, -1):
            suffix = result[-length:]
            if page.startswith(suffix):
                overlap = length
                break
        if overlap > 0:
            result += page[overlap:]
        else:
            result += '\n' + page
    return result


def extract_text_pymupdf(pdf_path: str | Path) -> tuple[str, dict]:
    """Extract text from a PDF using PyMuPDF (fitz).

    Returns:
        (text, stats) where stats has page_count, char_count, has_images, etc.
    """
    import pymupdf

    pdf_path = Path(pdf_path)
    stats = {
        "page_count": 0,
        "char_count": 0,
        "has_images": False,
        "image_pages": 0,
        "empty_pages": 0,
    }

    def _alarm_handler(signum: int, frame: object) -> None:
        raise TimeoutError(f"PDF extraction timed out after {EXTRACTION_TIMEOUT}s")

    # Set a timeout to prevent hanging on malformed PDFs (Unix only)
    use_alarm = hasattr(signal, "SIGALRM")
    if use_alarm:
        prev_handler = signal.signal(signal.SIGALRM, _alarm_handler)
        signal.alarm(EXTRACTION_TIMEOUT)

    try:
        doc = pymupdf.open(str(pdf_path))
        stats["page_count"] = len(doc)
        pages: list[str] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")

            if text and len(text.strip()) > 20:
                text = _strip_page_header(text, page_num)
                pages.append(text)
            else:
                stats["empty_pages"] += 1

            # Check for images
            images = page.get_images()
            if images:
                stats["has_images"] = True
                if not text or len(text.strip()) < 20:
                    stats["image_pages"] += 1

        doc.close()

        raw = _dedup_page_breaks(pages)
        cleaned = _clean_pdf_text(raw)
        stats["char_count"] = len(cleaned)

        return cleaned, stats

    except Exception as e:
        return "", {"error": str(e), **stats}
    finally:
        if use_alarm:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, prev_handler)
