"""Adapter that wraps our existing regex parser output into the shared LawExtraction format.

No new parsing logic — just reshapes the tree from parse_law.py into the flat
BabNode/PasalNode/AyatNode structure used for comparison.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add scripts/ to path so we can import parser module
sys.path.insert(0, str(Path(__file__).parent.parent))

from parser.parse_law import (
    count_pasals,
    extract_metadata_from_filename,
    extract_metadata_from_text,
    extract_text_from_pdf,
    LAW_METADATA,
    parse_into_nodes,
)

from .models import AyatNode, BabNode, LawExtraction, PasalNode


def _extract_pasals_from_children(children: list[dict]) -> list[PasalNode]:
    """Recursively extract PasalNode objects from a list of child nodes.

    Handles nested Bagian/Paragraf containers that sit between BAB and Pasal.
    """
    pasals: list[PasalNode] = []
    for node in children:
        if node["type"] == "pasal":
            ayat_list = [
                AyatNode(number=child["number"], content=child.get("content", ""))
                for child in node.get("children", [])
                if child["type"] == "ayat"
            ]
            pasals.append(
                PasalNode(
                    number=node["number"],
                    content=node.get("content", ""),
                    ayat=ayat_list,
                )
            )
        elif node["type"] in ("bagian", "paragraf"):
            # Recurse into container nodes
            pasals.extend(_extract_pasals_from_children(node.get("children", [])))
    return pasals


def extract_with_our_parser(pdf_path: Path) -> LawExtraction:
    """Run our regex parser on a PDF and return a LawExtraction.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        LawExtraction with the structured data from our parser.
    """
    slug = pdf_path.stem

    # Extract text
    text = extract_text_from_pdf(pdf_path)
    if not text or len(text) < 100:
        print(f"  Warning: very short text from {slug} ({len(text)} chars)")
        return LawExtraction()

    # Resolve metadata
    meta = LAW_METADATA.get(slug)
    if not meta:
        meta = extract_metadata_from_filename(slug)
    if not meta:
        meta = extract_metadata_from_text(text)
    if not meta:
        meta = {"type": "", "number": "", "year": 0, "title_id": ""}

    # Parse nodes
    nodes = parse_into_nodes(text)
    total_pasals = count_pasals(nodes)

    # Convert to LawExtraction
    babs: list[BabNode] = []
    pasals_outside_bab: list[PasalNode] = []

    for node in nodes:
        if node["type"] == "bab":
            bab_pasals = _extract_pasals_from_children(node.get("children", []))
            babs.append(
                BabNode(
                    number=node.get("number", ""),
                    heading=node.get("heading", ""),
                    pasals=bab_pasals,
                )
            )
        elif node["type"] == "pasal":
            ayat_list = [
                AyatNode(number=child["number"], content=child.get("content", ""))
                for child in node.get("children", [])
                if child["type"] == "ayat"
            ]
            pasals_outside_bab.append(
                PasalNode(
                    number=node["number"],
                    content=node.get("content", ""),
                    ayat=ayat_list,
                )
            )
        # Skip penjelasan_umum, penjelasan_pasal — not part of comparison

    return LawExtraction(
        title=meta.get("title_id", ""),
        type=meta.get("type", ""),
        number=meta.get("number", ""),
        year=meta.get("year", 0),
        babs=babs,
        pasals_outside_bab=pasals_outside_bab,
        total_pasal_count=total_pasals,
    )
