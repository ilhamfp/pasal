"""Adapter that wraps our PyMuPDF parser output into the shared LawExtraction format.

Reshapes the tree from parse_structure.py into the flat
BabNode/PasalNode/AyatNode structure used for comparison.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add scripts/ to path so we can import parser module
sys.path.insert(0, str(Path(__file__).parent.parent))

from parser.extract_pymupdf import extract_text_pymupdf
from parser.parse_structure import count_pasals, parse_structure

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
            pasals.extend(_extract_pasals_from_children(node.get("children", [])))
    return pasals


def extract_with_our_parser(pdf_path: Path) -> LawExtraction:
    """Run our PyMuPDF parser on a PDF and return a LawExtraction."""
    text, _ = extract_text_pymupdf(pdf_path)
    if not text or len(text) < 100:
        print(f"  Warning: very short text from {pdf_path.stem} ({len(text)} chars)")
        return LawExtraction()

    nodes = parse_structure(text)
    total_pasals = count_pasals(nodes)

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

    return LawExtraction(
        babs=babs,
        pasals_outside_bab=pasals_outside_bab,
        total_pasal_count=total_pasals,
    )
