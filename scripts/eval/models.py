"""Shared Pydantic models for parser evaluation.

Both our regex parser and Gemini must produce the same LawExtraction structure.
The diff engine compares two LawExtraction objects and produces a DiffReport.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AyatNode(BaseModel):
    number: str
    content: str


class PasalNode(BaseModel):
    number: str
    content: str
    ayat: list[AyatNode] = []


class BabNode(BaseModel):
    number: str = ""  # Roman numeral: "I", "II", etc.
    heading: str = ""
    pasals: list[PasalNode] = []


class LawExtraction(BaseModel):
    title: str = ""
    type: str = ""  # UU, PP, PERPRES
    number: str = ""
    year: int = 0
    babs: list[BabNode] = []
    pasals_outside_bab: list[PasalNode] = []  # Pasals not inside any BAB
    total_pasal_count: int = 0


class PasalDiff(BaseModel):
    pasal_number: str
    content_similarity: float = Field(ge=0.0, le=1.0)
    ours_preview: str = ""  # First 200 chars
    gemini_preview: str = ""  # First 200 chars
    issues: list[str] = []


class DiffReport(BaseModel):
    pdf_file: str
    metadata_diffs: list[str] = []
    pasal_count_ours: int = 0
    pasal_count_gemini: int = 0
    missing_in_ours: list[str] = []  # Pasal numbers Gemini found but we didn't
    missing_in_gemini: list[str] = []  # Pasal numbers we found but Gemini didn't
    content_diffs: list[PasalDiff] = []
    summary: str = ""
