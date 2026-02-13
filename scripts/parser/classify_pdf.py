"""PDF quality classifier — routes PDFs through the right parser.

Classifies PDFs as:
- born_digital: Good text extraction, direct regex parsing
- scanned_clean: Has text but with OCR artifacts, needs correction
- image_only: Mostly images, needs OCR first
"""
from pathlib import Path


def classify_pdf_quality(pdf_path: str | Path) -> tuple[str, float]:
    """Classify PDF quality based on text density and image content.

    Returns:
        (quality, confidence) where quality is one of:
        'born_digital', 'scanned_clean', 'image_only'
    """
    import pymupdf

    pdf_path = Path(pdf_path)
    doc = pymupdf.open(str(pdf_path))

    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        return "image_only", 0.0

    text_chars_per_page: list[int] = []
    image_pages = 0
    total_images = 0

    for page_num in range(min(total_pages, 10)):  # Sample first 10 pages
        page = doc[page_num]
        text = page.get_text("text")
        text_len = len(text.strip()) if text else 0
        text_chars_per_page.append(text_len)

        images = page.get_images()
        total_images += len(images)
        if images and text_len < 50:
            image_pages += 1

    doc.close()

    sampled = len(text_chars_per_page)
    avg_chars = sum(text_chars_per_page) / sampled if sampled else 0
    text_pages = sum(1 for c in text_chars_per_page if c > 100)
    text_ratio = text_pages / sampled if sampled else 0

    # Classification logic
    if text_ratio >= 0.8 and avg_chars > 500:
        # Good text on most pages — born digital
        return "born_digital", min(1.0, text_ratio)

    if text_ratio >= 0.4 and avg_chars > 100:
        # Some text but mixed quality — scanned with OCR
        return "scanned_clean", text_ratio

    # Mostly images or very little text
    return "image_only", 1.0 - text_ratio
