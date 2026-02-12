"""Unit tests for parse_law.py — regex patterns and parse_into_nodes."""

import re
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure the parser module is importable
sys.path.insert(0, str(Path(__file__).parent))

from parse_law import (
    BAB_RE,
    BAGIAN_RE,
    PASAL_RE,
    AYAT_RE,
    PENJELASAN_RE,
    parse_into_nodes,
    count_pasals,
    extract_text_from_pdf,
)


# ===================================================================
# Regex pattern tests
# ===================================================================


class TestBABRegex:
    def test_simple_bab(self):
        assert BAB_RE.search("BAB I")
        assert BAB_RE.search("BAB IV")
        assert BAB_RE.search("BAB XIV")

    def test_high_numeral(self):
        assert BAB_RE.search("BAB XXIV")

    def test_no_match_inline(self):
        """BAB must be at start of line."""
        assert not BAB_RE.search("  text BAB I text")

    def test_multiline(self):
        text = "some text\nBAB II\nmore text"
        m = BAB_RE.search(text)
        assert m and m.group(1) == "II"


class TestPASALRegex:
    def test_simple_pasal(self):
        m = PASAL_RE.search("Pasal 1")
        assert m and m.group(1) == "1"

    def test_high_number(self):
        m = PASAL_RE.search("Pasal 185")
        assert m and m.group(1) == "185"

    def test_suffix_letter(self):
        m = PASAL_RE.search("Pasal 81A")
        assert m and m.group(1) == "81A"

    def test_no_match_within_text(self):
        assert not PASAL_RE.search("lihat Pasal 5 di atas")

    def test_multiline(self):
        text = "content\nPasal 42\nnext line"
        m = PASAL_RE.search(text)
        assert m and m.group(1) == "42"


class TestAYATRegex:
    def test_simple_ayat(self):
        m = AYAT_RE.search("(1) Setiap pekerja berhak")
        assert m and m.group(1) == "1"

    def test_high_number(self):
        m = AYAT_RE.search("(15) Ketentuan lebih lanjut")
        assert m and m.group(1) == "15"

    def test_must_be_at_line_start(self):
        m = AYAT_RE.search("lihat ayat (2) di atas")
        assert m is None


class TestBAGIANRegex:
    def test_kesatu(self):
        assert BAGIAN_RE.search("Bagian Kesatu")

    def test_kedua(self):
        assert BAGIAN_RE.search("Bagian Kedua")

    def test_kesepuluh(self):
        assert BAGIAN_RE.search("Bagian Kesepuluh")

    def test_case_insensitive(self):
        assert BAGIAN_RE.search("BAGIAN KETIGA")

    def test_kesebelas(self):
        assert BAGIAN_RE.search("Bagian Kesebelas")

    def test_kedua_belas(self):
        assert BAGIAN_RE.search("Bagian Kedua Belas")

    def test_ketiga_belas(self):
        assert BAGIAN_RE.search("Bagian Ketiga Belas")


class TestPENJELASANRegex:
    def test_simple(self):
        assert PENJELASAN_RE.search("PENJELASAN")

    def test_multiline(self):
        text = "last pasal\nPENJELASAN\nATAS"
        assert PENJELASAN_RE.search(text)


# ===================================================================
# parse_into_nodes tests
# ===================================================================


class TestParseIntoNodes:
    def test_empty_text(self):
        assert parse_into_nodes("") == []

    def test_no_structure(self):
        """Text with no BAB/Pasal/etc returns empty list."""
        result = parse_into_nodes("This is just plain text without legal structure.")
        assert result == []

    def test_bab_only(self):
        text = "BAB I\nKETENTUAN UMUM"
        nodes = parse_into_nodes(text)
        assert len(nodes) == 1
        assert nodes[0]["type"] == "bab"
        assert nodes[0]["number"] == "I"
        assert "KETENTUAN UMUM" in nodes[0]["heading"]

    def test_bab_with_pasals(self):
        text = """BAB I
KETENTUAN UMUM
Pasal 1
Dalam Undang-Undang ini yang dimaksud dengan:
(1) Pekerja adalah setiap orang yang bekerja
(2) Pengusaha adalah orang perseorangan
Pasal 2
Pembangunan ketenagakerjaan dilaksanakan"""
        nodes = parse_into_nodes(text)
        assert len(nodes) == 1  # One BAB
        bab = nodes[0]
        assert bab["type"] == "bab"
        assert len(bab["children"]) == 2  # Two pasals
        assert bab["children"][0]["number"] == "1"
        assert bab["children"][1]["number"] == "2"

    def test_pasal_with_ayat(self):
        text = """Pasal 5
(1) Setiap tenaga kerja memiliki kesempatan
(2) Setiap tenaga kerja berhak memperoleh
(3) Pemberi kerja wajib memberikan"""
        nodes = parse_into_nodes(text)
        assert len(nodes) == 1
        pasal = nodes[0]
        assert pasal["type"] == "pasal"
        assert len(pasal["children"]) == 3
        assert pasal["children"][0]["number"] == "1"
        assert pasal["children"][2]["number"] == "3"

    def test_bagian_nesting(self):
        text = """BAB I
KETENTUAN UMUM
Bagian Kesatu
Pengertian
Pasal 1
Definisi umum
BAB II
HAK
Bagian Kesatu
Hak Pekerja
Pasal 2
Hak pekerja"""
        nodes = parse_into_nodes(text)
        assert len(nodes) == 2
        bab = nodes[0]
        assert len(bab["children"]) == 1  # One bagian
        assert bab["children"][0]["type"] == "bagian"
        assert bab["children"][0]["number"] == "Kesatu"
        assert len(bab["children"][0]["children"]) == 1  # One pasal in bagian

    def test_penjelasan_excluded(self):
        text = """Pasal 1
Content here
PENJELASAN
ATAS UNDANG-UNDANG
Pasal 1 penjelasan text"""
        nodes = parse_into_nodes(text)
        assert len(nodes) == 1
        assert nodes[0]["type"] == "pasal"
        # The penjelasan Pasal should not appear
        assert count_pasals(nodes) == 1

    def test_multiple_babs(self):
        text = """BAB I
KETENTUAN UMUM
Pasal 1
Definisi
BAB II
HAK DAN KEWAJIBAN
Pasal 2
Setiap warga negara"""
        nodes = parse_into_nodes(text)
        assert len(nodes) == 2
        assert nodes[0]["number"] == "I"
        assert nodes[1]["number"] == "II"

    def test_pasal_suffix_letter(self):
        text = """Pasal 81A
Ketentuan peralihan"""
        nodes = parse_into_nodes(text)
        assert len(nodes) == 1
        assert nodes[0]["number"] == "81A"


# ===================================================================
# count_pasals tests
# ===================================================================


class TestCountPasals:
    def test_empty(self):
        assert count_pasals([]) == 0

    def test_flat_pasals(self):
        nodes = [
            {"type": "pasal", "children": []},
            {"type": "pasal", "children": []},
        ]
        assert count_pasals(nodes) == 2

    def test_nested_in_bab(self):
        nodes = [
            {
                "type": "bab",
                "children": [
                    {"type": "pasal", "children": []},
                    {"type": "pasal", "children": []},
                ],
            },
        ]
        assert count_pasals(nodes) == 2

    def test_deeply_nested(self):
        nodes = [
            {
                "type": "bab",
                "children": [
                    {
                        "type": "bagian",
                        "children": [
                            {"type": "pasal", "children": [
                                {"type": "ayat", "children": []},
                            ]},
                        ],
                    },
                ],
            },
        ]
        assert count_pasals(nodes) == 1

    def test_long_document(self):
        """Simulate a document with many pasals."""
        nodes = [{"type": "pasal", "children": []} for _ in range(200)]
        assert count_pasals(nodes) == 200


# ===================================================================
# extract_text_from_pdf tests (mocked)
# ===================================================================


class TestExtractTextFromPdf:
    def test_returns_joined_text(self, tmp_path):
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 text"
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 text"

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch("parse_law.pdfplumber") as mock_pdfplumber:
            mock_pdfplumber.open.return_value = mock_pdf
            result = extract_text_from_pdf(tmp_path / "test.pdf")

        assert result == "Page 1 text\nPage 2 text"

    def test_handles_none_pages(self, tmp_path):
        mock_page = MagicMock()
        mock_page.extract_text.return_value = None

        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)

        with patch("parse_law.pdfplumber") as mock_pdfplumber:
            mock_pdfplumber.open.return_value = mock_pdf
            result = extract_text_from_pdf(tmp_path / "test.pdf")

        assert result == ""

    def test_handles_exception(self, tmp_path):
        with patch("parse_law.pdfplumber") as mock_pdfplumber:
            mock_pdfplumber.open.side_effect = Exception("corrupt")
            result = extract_text_from_pdf(tmp_path / "bad.pdf")

        assert result == ""
