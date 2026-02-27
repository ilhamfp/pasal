"""PDF page image fetching and page-finding utilities for verification.

Used by the Opus 4.6 correction agent to fetch PDF page images
for vision-based verification of parsed text.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client

STORAGE_BUCKET = "regulation-pdfs"

# Module-level cache: slug -> PDF bytes
_pdf_cache: dict[str, bytes] = {}


_supabase_client = None


def get_supabase():
    """Return a reusable Supabase client (singleton)."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"]
        )
    return _supabase_client


def _get_pdf_bytes(slug: str) -> bytes | None:
    """Download PDF from Supabase Storage, with in-memory caching.

    Returns raw PDF bytes or None on failure.
    """
    if slug in _pdf_cache:
        return _pdf_cache[slug]

    try:
        sb = get_supabase()
        data = sb.storage.from_(STORAGE_BUCKET).download(f"{slug}.pdf")
        if data and len(data) > 1000:
            _pdf_cache[slug] = data
            return data
    except Exception as e:
        print(f"PDF download failed for {slug}: {e}")

    return None


def find_page_for_node(
    slug: str,
    node_number: str,
    node_content: str,
) -> int | None:
    """Find the PDF page containing a specific Pasal.

    Searches each page for "Pasal {node_number}", picks the best match
    by also checking for the first ~100 chars of node_content.

    Returns 1-indexed page number or None if not found.
    """
    try:
        import pymupdf

        pdf_bytes = _get_pdf_bytes(slug)
        if not pdf_bytes:
            return None

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        try:
            marker = f"Pasal {node_number}"
            content_snippet = node_content[:100] if node_content else ""

            best_page = None
            best_score = -1

            for page_idx in range(len(doc)):
                page = doc[page_idx]
                text = page.get_text()

                if marker not in text:
                    continue

                score = 1
                if content_snippet and content_snippet[:50] in text:
                    score = 2

                if score > best_score:
                    best_score = score
                    best_page = page_idx + 1  # 1-indexed

            return best_page
        finally:
            doc.close()

    except Exception as e:
        print(f"find_page_for_node failed ({slug}, Pasal {node_number}): {e}")
        return None


def fetch_pdf_page_image(
    slug: str,
    page_number: int,
) -> bytes | None:
    """Fetch a PNG image of a specific PDF page.

    Tries pre-rendered image from Supabase Storage first
    (regulation-pdfs/{slug}/page-{N}.png), falls back to rendering
    from the full PDF via PyMuPDF at 150 DPI.

    Args:
        slug: Regulation slug (e.g. "uu-13-2003")
        page_number: 1-indexed page number

    Returns PNG bytes or None on failure.
    """
    # Try pre-rendered image from storage
    try:
        sb = get_supabase()
        storage_path = f"{slug}/page-{page_number}.png"
        data = sb.storage.from_(STORAGE_BUCKET).download(storage_path)
        if data and len(data) > 100:
            return data
    except Exception:
        pass  # Fall through to PDF rendering

    # Fallback: render from full PDF
    try:
        import pymupdf

        pdf_bytes = _get_pdf_bytes(slug)
        if not pdf_bytes:
            return None

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        try:
            page_idx = page_number - 1  # 0-indexed
            if page_idx < 0 or page_idx >= len(doc):
                return None

            page = doc[page_idx]
            pix = page.get_pixmap(dpi=150)
            return pix.tobytes("png")
        finally:
            doc.close()

    except Exception as e:
        print(f"fetch_pdf_page_image failed ({slug}, page {page_number}): {e}")
        return None
