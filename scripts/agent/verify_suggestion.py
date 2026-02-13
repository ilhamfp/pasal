"""Gemini Flash verification agent for crowd-sourced suggestions.

Sends current + suggested content to Gemini 3 Flash Preview.
Returns accept/modify/reject decision with confidence.

Advisory only — admin must approve.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")


SYSTEM_PROMPT = """Anda adalah agen verifikasi hukum Indonesia.
Tugas Anda adalah membandingkan teks hukum saat ini dengan koreksi yang disarankan pengguna.

Tentukan apakah koreksi tersebut:
1. "accept" — Koreksi benar dan meningkatkan akurasi teks
2. "modify" — Koreksi sebagian benar tapi perlu penyesuaian
3. "reject" — Koreksi salah atau tidak meningkatkan akurasi

Berikan respons dalam format JSON:
{
  "decision": "accept" | "modify" | "reject",
  "confidence": 0.0-1.0,
  "reasoning": "Penjelasan singkat keputusan",
  "modified_content": "Teks yang dimodifikasi (hanya jika decision=modify)"
}"""


def verify_suggestion(
    current_content: str,
    suggested_content: str,
    node_type: str = "pasal",
    node_number: str = "",
    user_reason: str = "",
) -> dict:
    """Verify a suggestion using Gemini 3 Flash Preview.

    Returns dict with decision, confidence, reasoning, modified_content.
    """
    try:
        from google import genai

        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

        prompt = f"""Verifikasi koreksi berikut pada {node_type} {node_number}:

## Teks Saat Ini:
{current_content}

## Koreksi yang Disarankan:
{suggested_content}

## Alasan Pengguna:
{user_reason or "(tidak diberikan)"}

Bandingkan kedua teks dan berikan keputusan verifikasi dalam format JSON."""

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=1024,
            ),
        )

        # Parse JSON from response
        text = response.text.strip()
        # Try to extract JSON from markdown code block
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)
        return {
            "decision": result.get("decision", "reject"),
            "confidence": float(result.get("confidence", 0.5)),
            "reasoning": result.get("reasoning", ""),
            "modified_content": result.get("modified_content"),
            "model": "gemini-3-flash-preview",
            "raw_response": response.text,
        }

    except Exception as e:
        return {
            "decision": "error",
            "confidence": 0.0,
            "reasoning": f"Verification failed: {str(e)}",
            "modified_content": None,
            "model": "gemini-3-flash-preview",
            "error": str(e),
        }
