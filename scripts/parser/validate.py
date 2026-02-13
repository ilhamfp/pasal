"""Validation engine for parsed legal document structure.

Checks:
- Sequential Pasal numbering
- Ayat ordering within Pasal
- Content coverage (text vs. structure)
"""


def _collect_pasals(nodes: list[dict]) -> list[dict]:
    """Flatten all pasal nodes from the tree."""
    pasals = []
    for node in nodes:
        if node["type"] == "pasal":
            pasals.append(node)
        for child in node.get("children", []):
            if child.get("type") == "pasal":
                pasals.append(child)
            pasals.extend(_collect_pasals(child.get("children", [])))
    return pasals


def validate_structure(nodes: list[dict], text_length: int = 0) -> dict:
    """Validate parsed structure for correctness.

    Returns:
        {valid: bool, errors: list[str], warnings: list[str], stats: dict}
    """
    errors: list[str] = []
    warnings: list[str] = []
    stats = {"pasal_count": 0, "bab_count": 0, "ayat_count": 0}

    pasals = _collect_pasals(nodes)
    stats["pasal_count"] = len(pasals)
    stats["bab_count"] = sum(1 for n in nodes if n["type"] == "bab")

    if not pasals:
        if text_length > 500:
            warnings.append("No Pasal found despite having text content")
        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings, "stats": stats}

    # Check sequential Pasal numbering
    prev_num = 0
    for pasal in pasals:
        num_str = pasal["number"].rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        try:
            num = int(num_str)
        except ValueError:
            warnings.append(f"Non-numeric Pasal number: {pasal['number']}")
            continue

        if num < prev_num:
            warnings.append(f"Pasal {num} appears after Pasal {prev_num} (non-sequential)")
        elif num > prev_num + 5 and prev_num > 0:
            warnings.append(f"Gap: Pasal {prev_num} -> Pasal {num} (missing {num - prev_num - 1})")
        prev_num = num

    # Check Ayat ordering
    for pasal in pasals:
        children = pasal.get("children", [])
        ayat_nums = [int(c["number"]) for c in children if c.get("type") == "ayat" and c.get("number", "").isdigit()]
        stats["ayat_count"] += len(ayat_nums)

        for i in range(1, len(ayat_nums)):
            if ayat_nums[i] <= ayat_nums[i-1]:
                warnings.append(f"Pasal {pasal['number']}: Ayat {ayat_nums[i]} not sequential after {ayat_nums[i-1]}")

    # Check content coverage
    if text_length > 0:
        total_content = sum(len(p.get("content", "")) for p in pasals)
        coverage = total_content / text_length if text_length else 0
        stats["coverage"] = round(coverage, 2)
        if coverage < 0.1:
            warnings.append(f"Low content coverage: {coverage:.1%} of text captured in Pasal nodes")

    # Check for empty Pasals
    empty = sum(1 for p in pasals if not p.get("content") or len(p.get("content", "").strip()) < 5)
    if empty > 0:
        warnings.append(f"{empty} Pasal(s) have empty or very short content")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": stats,
    }
