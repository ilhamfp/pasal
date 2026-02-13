"""PyMuPDF-based text extraction for Indonesian legal PDFs.

~100x faster than pdfplumber. Reuses dedup and cleaning logic from parse_law.py.
"""
import re
from pathlib import Path

_PAGE_HEADER_RE = re.compile(
    r'^(?:SALINAN\s*\n)?'
    r'PRESIDEN\s*\n'
    r'\s*REPU\w+\s+INDONESIA\s*\n'
    r'(?:\s*-\s*\d+\s*-?\s*\n)?',
    re.MULTILINE | re.IGNORECASE,
)
_PAGE_FOOTER_RE = re.compile(
    r'(?:^Halaman\s+\d+\s+dari\s+\d+\s*$'
    r'|^SK\s+No\s+\d+[A-Z]?\s*$'
    r'|^;?\*?[a-zA-Z]*(?:trE|EtrN)\s*$'
    r'|^(?:iIi|REFUBLIK|REPUEUK)\s+INDONESIA\s*$)',
    re.MULTILINE | re.IGNORECASE,
)


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

    try:
        doc = pymupdf.open(str(pdf_path))
        stats["page_count"] = len(doc)
        pages: list[str] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")

            if text and len(text.strip()) > 20:
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
