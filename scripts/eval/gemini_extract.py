"""Extract structured legal data from a PDF using Gemini Pro 3.

Uploads the PDF to Gemini, prompts for structured extraction matching
our LawExtraction schema, and caches results to avoid re-calling the API.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from google import genai
from google.genai import types

from .models import LawExtraction
from .prompt import EXTRACTION_PROMPT

DATA_DIR = Path(__file__).parent.parent.parent / "data"
CACHE_DIR = DATA_DIR / "eval"

# Rate limit: minimum seconds between Gemini API calls
MIN_CALL_INTERVAL = 2.0
_last_call_time = 0.0


def _get_client() -> genai.Client:
    """Create a Gemini client from environment variable."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY not set. Add it to scripts/.env or export it."
        )
    return genai.Client(api_key=api_key)


def _cache_path(slug: str) -> Path:
    """Return the cache file path for a given law slug."""
    return CACHE_DIR / f"{slug}_gemini.json"


def load_cached(slug: str) -> LawExtraction | None:
    """Load a cached Gemini extraction result if it exists."""
    path = _cache_path(slug)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return LawExtraction.model_validate(data)
    except Exception as e:
        print(f"  Warning: cached Gemini result for {slug} is invalid: {e}")
        return None


def save_cache(slug: str, extraction: LawExtraction) -> None:
    """Save a Gemini extraction result to cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(slug)
    path.write_text(
        extraction.model_dump_json(indent=2),
        encoding="utf-8",
    )


def extract_with_gemini(pdf_path: Path, force: bool = False) -> LawExtraction:
    """Extract structured legal data from a PDF using Gemini Pro 3.

    Args:
        pdf_path: Path to the PDF file.
        force: If True, skip cache and re-call the API.

    Returns:
        LawExtraction with the structured data.
    """
    global _last_call_time

    slug = pdf_path.stem
    if not force:
        cached = load_cached(slug)
        if cached is not None:
            print(f"  Using cached Gemini result for {slug}")
            return cached

    print(f"  Calling Gemini Pro 3 for {slug}...")
    client = _get_client()

    # Rate limiting
    elapsed = time.time() - _last_call_time
    if elapsed < MIN_CALL_INTERVAL:
        time.sleep(MIN_CALL_INTERVAL - elapsed)

    # Upload the PDF
    uploaded_file = client.files.upload(
        file=pdf_path,
        config=types.UploadFileConfig(mime_type="application/pdf"),
    )

    # Call Gemini with structured output
    response = client.models.generate_content(
        model="gemini-3-pro-preview",
        contents=[
            uploaded_file,
            EXTRACTION_PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=LawExtraction.model_json_schema(),
            temperature=0.0,
        ),
    )

    _last_call_time = time.time()

    # Parse the response
    raw_text = response.text
    if not raw_text:
        raise RuntimeError(f"Gemini returned empty response for {slug}")

    data = json.loads(raw_text)
    extraction = LawExtraction.model_validate(data)

    # Cache the result
    save_cache(slug, extraction)
    print(f"  Gemini extracted {extraction.total_pasal_count} pasals for {slug}")

    return extraction
