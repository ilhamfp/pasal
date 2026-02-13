"""Diff engine: compare two LawExtraction objects and produce a DiffReport.

Matches pasals by number, computes text similarity, and identifies
missing/extra pasals between the two extractions.
"""

from __future__ import annotations

from difflib import SequenceMatcher

from .models import DiffReport, LawExtraction, PasalDiff, PasalNode


def _collect_all_pasals(extraction: LawExtraction) -> dict[str, PasalNode]:
    """Flatten all pasals from BABs and outside-BAB into a dict keyed by number."""
    pasals: dict[str, PasalNode] = {}
    for bab in extraction.babs:
        for pasal in bab.pasals:
            pasals[pasal.number] = pasal
    for pasal in extraction.pasals_outside_bab:
        pasals[pasal.number] = pasal
    return pasals


def _pasal_full_text(pasal: PasalNode) -> str:
    """Get the full text of a pasal including all ayat content."""
    parts = [pasal.content]
    for ayat in pasal.ayat:
        parts.append(f"({ayat.number}) {ayat.content}")
    return "\n".join(parts).strip()


def _normalize_for_comparison(text: str) -> str:
    """Normalize text for fair comparison between parsers."""
    import re
    # Normalize Gemini double-paren ayat: ((1)) -> (1)
    text = re.sub(r'\(\((\d+)\)\)', r'(\1)', text)
    # Normalize whitespace
    return " ".join(text.split())


def _compute_similarity(text_a: str, text_b: str) -> float:
    """Compute text similarity ratio between 0.0 and 1.0."""
    if not text_a and not text_b:
        return 1.0
    if not text_a or not text_b:
        return 0.0
    a = _normalize_for_comparison(text_a)
    b = _normalize_for_comparison(text_b)
    return SequenceMatcher(None, a, b).ratio()


def _detect_issues(
    ours: PasalNode, gemini: PasalNode, similarity: float
) -> list[str]:
    """Detect specific issues in a pasal comparison."""
    issues: list[str] = []

    if similarity < 0.3:
        issues.append("content_completely_different")
    elif similarity < 0.7:
        issues.append("content_significantly_different")

    # Check ayat count mismatch
    if len(ours.ayat) != len(gemini.ayat):
        issues.append(
            f"ayat_count_mismatch (ours={len(ours.ayat)}, gemini={len(gemini.ayat)})"
        )

    # Check for truncation (our content much shorter)
    our_text = _pasal_full_text(ours)
    gemini_text = _pasal_full_text(gemini)
    if len(our_text) < len(gemini_text) * 0.5 and len(gemini_text) > 50:
        issues.append("content_truncated_in_ours")
    if len(gemini_text) < len(our_text) * 0.5 and len(our_text) > 50:
        issues.append("content_truncated_in_gemini")

    # Check for OCR-like artifacts in our content
    for artifact in ["  ", "\x00", "ﬁ", "ﬂ", "ﬀ"]:
        if artifact in our_text and artifact not in gemini_text:
            issues.append("possible_ocr_artifact")
            break

    return issues


def compare_extractions(
    ours: LawExtraction,
    gemini: LawExtraction,
    pdf_file: str,
) -> DiffReport:
    """Compare our parser output against Gemini's extraction.

    Args:
        ours: LawExtraction from our regex parser.
        gemini: LawExtraction from Gemini.
        pdf_file: The PDF filename (for the report).

    Returns:
        DiffReport with detailed comparison results.
    """
    metadata_diffs: list[str] = []

    # Compare metadata
    if ours.title and gemini.title and ours.title != gemini.title:
        metadata_diffs.append(f"title: ours='{ours.title}' vs gemini='{gemini.title}'")
    if ours.type and gemini.type and ours.type != gemini.type:
        metadata_diffs.append(f"type: ours='{ours.type}' vs gemini='{gemini.type}'")
    if ours.number and gemini.number and ours.number != gemini.number:
        metadata_diffs.append(
            f"number: ours='{ours.number}' vs gemini='{gemini.number}'"
        )
    if ours.year and gemini.year and ours.year != gemini.year:
        metadata_diffs.append(f"year: ours={ours.year} vs gemini={gemini.year}")

    # Collect all pasals
    our_pasals = _collect_all_pasals(ours)
    gemini_pasals = _collect_all_pasals(gemini)

    our_numbers = set(our_pasals.keys())
    gemini_numbers = set(gemini_pasals.keys())

    missing_in_ours = sorted(gemini_numbers - our_numbers, key=_pasal_sort_key)
    missing_in_gemini = sorted(our_numbers - gemini_numbers, key=_pasal_sort_key)
    common = our_numbers & gemini_numbers

    # Compare content for common pasals
    content_diffs: list[PasalDiff] = []
    for num in sorted(common, key=_pasal_sort_key):
        our_pasal = our_pasals[num]
        gemini_pasal = gemini_pasals[num]

        our_text = _pasal_full_text(our_pasal)
        gemini_text = _pasal_full_text(gemini_pasal)

        similarity = _compute_similarity(our_text, gemini_text)
        issues = _detect_issues(our_pasal, gemini_pasal, similarity)

        # Only include in diffs if there are notable differences
        if similarity < 0.95 or issues:
            content_diffs.append(
                PasalDiff(
                    pasal_number=num,
                    content_similarity=round(similarity, 4),
                    ours_preview=our_text[:200],
                    gemini_preview=gemini_text[:200],
                    issues=issues,
                )
            )

    # Generate summary
    summary = _generate_summary(
        pdf_file=pdf_file,
        metadata_diffs=metadata_diffs,
        our_count=len(our_pasals),
        gemini_count=len(gemini_pasals),
        missing_ours=missing_in_ours,
        missing_gemini=missing_in_gemini,
        content_diffs=content_diffs,
    )

    return DiffReport(
        pdf_file=pdf_file,
        metadata_diffs=metadata_diffs,
        pasal_count_ours=len(our_pasals),
        pasal_count_gemini=len(gemini_pasals),
        missing_in_ours=missing_in_ours,
        missing_in_gemini=missing_in_gemini,
        content_diffs=content_diffs,
        summary=summary,
    )


def _pasal_sort_key(num: str) -> tuple[int, str]:
    """Sort pasal numbers numerically, handling letter suffixes like '81A'."""
    digits = ""
    suffix = ""
    for ch in num:
        if ch.isdigit():
            digits += ch
        else:
            suffix += ch
    return (int(digits) if digits else 0, suffix)


def _generate_summary(
    pdf_file: str,
    metadata_diffs: list[str],
    our_count: int,
    gemini_count: int,
    missing_ours: list[str],
    missing_gemini: list[str],
    content_diffs: list[PasalDiff],
) -> str:
    """Generate a human-readable summary of the diff."""
    lines: list[str] = [f"Evaluation: {pdf_file}"]

    # Metadata
    if metadata_diffs:
        lines.append(f"Metadata mismatches: {len(metadata_diffs)}")
        for d in metadata_diffs:
            lines.append(f"  - {d}")

    # Counts
    lines.append(f"Pasal count: ours={our_count}, gemini={gemini_count}")
    if our_count == gemini_count:
        lines.append("  Counts match!")
    else:
        diff = gemini_count - our_count
        lines.append(f"  Difference: {diff:+d} (gemini - ours)")

    # Missing
    if missing_ours:
        lines.append(f"Missing in our parser ({len(missing_ours)}): {', '.join(missing_ours)}")
    if missing_gemini:
        lines.append(f"Missing in Gemini ({len(missing_gemini)}): {', '.join(missing_gemini)}")

    # Content quality
    if content_diffs:
        avg_sim = sum(d.content_similarity for d in content_diffs) / len(content_diffs)
        low_sim = [d for d in content_diffs if d.content_similarity < 0.5]
        lines.append(f"Content diffs: {len(content_diffs)} pasals with differences")
        lines.append(f"  Average similarity (among differing): {avg_sim:.2%}")
        if low_sim:
            lines.append(
                f"  Low similarity (<50%): {', '.join(d.pasal_number for d in low_sim)}"
            )

        # Aggregate issues
        all_issues: dict[str, int] = {}
        for d in content_diffs:
            for issue in d.issues:
                # Normalize issue names (strip counts)
                base = issue.split(" (")[0]
                all_issues[base] = all_issues.get(base, 0) + 1
        if all_issues:
            lines.append("  Common issues:")
            for issue, count in sorted(all_issues.items(), key=lambda x: -x[1]):
                lines.append(f"    - {issue}: {count}")
    else:
        lines.append("No content differences found — perfect match!")

    return "\n".join(lines)
