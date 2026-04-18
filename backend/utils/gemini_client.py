"""
Gemini AI Integration + Groq Backup + Template Fallback

Priority order:
  1. Gemini (google-genai) — uses explicit api_key arg first, then GEMINI_API_KEY env var
  2. Groq   (groq)         — uses GROQ_API_KEY env var
  3. Template fallback      — static structured response, no external dependency
"""

import os
import json
import re
from typing import Dict, Any, List, Optional

from google import genai
from groq import Groq


# ─────────────────────────────────────────
# Gemini Client
# ─────────────────────────────────────────

def get_client(api_key: Optional[str] = None):
    """
    Return a Gemini client.
    Uses `api_key` if supplied; otherwise falls back to the GEMINI_API_KEY env var.
    Returns None if no key is available.
    """
    resolved_key = api_key or os.getenv("GEMINI_API_KEY")

    if not resolved_key:
        return None

    return genai.Client(api_key=resolved_key)


# ─────────────────────────────────────────
# CLEAN JSON PARSER
# ─────────────────────────────────────────

def extract_json(text: str):
    try:
        text = text.replace("```json", "").replace("```", "").strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as e:
        print(f"⚠️  JSON parsing failed: {e}")
    return None


# ─────────────────────────────────────────
# Groq Backup
# ─────────────────────────────────────────

def generate_with_groq(prompt: str):
    """Attempt to generate a response via Groq (llama-3.1-8b-instant). Returns None on failure."""
    try:
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            return None

        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "Return ONLY valid JSON. No markdown."},
                {"role": "user",   "content": prompt},
            ],
        )

        text = response.choices[0].message.content

        print("✅ Groq backup used")

        parsed = extract_json(text)
        if parsed:
            return parsed

        print("⚠️  Groq returned invalid JSON")
        return None

    except Exception as e:
        print(f"❌ Groq error: {e}")
        return None


# ─────────────────────────────────────────
# MAIN FUNCTION 1 — Bias Explanation
# ─────────────────────────────────────────

def generate_bias_explanation(
    dataset_summary: Dict[str, Any],
    bias_score: float,
    stat_parity: Dict,
    di_results: Dict,
    sensitive_cols: List[str],
    target_cols: List[str],
    api_key: Optional[str] = None,
) -> Dict[str, str]:

    client = get_client(api_key)

    prompt = f"""
IMPORTANT:
- Return ONLY valid JSON
- No markdown
- No explanation outside JSON

Format:
{{
  "EXECUTIVE_SUMMARY": "...",
  "ROOT_CAUSE": "...",
  "REAL_WORLD_IMPACT": "...",
  "TOP_RECOMMENDATIONS": "..."
}}

Dataset: {dataset_summary.get('rows')} rows
Sensitive Attributes: {', '.join(sensitive_cols)}
Target Variables: {', '.join(target_cols)}
Bias Score: {bias_score}

Statistical Parity:
{json.dumps(stat_parity)}

Disparate Impact:
{json.dumps(di_results)}
"""

    # ─── Gemini First ───
    if client:
        try:
            print("🚀 Using Gemini (primary)")

            response = client.models.generate_content(
                model="models/gemini-2.0-flash",
                contents=prompt,
            )

            parsed = extract_json(response.text)
            if parsed:
                return parsed

        except Exception as e:
            print(f"❌ Gemini error: {e}")
            print("🔄 Falling back to Groq…")

    # ─── Groq Backup ───
    backup = generate_with_groq(prompt)
    if backup:
        return backup

    # ─── Template Fallback ───
    return _template_explanation(bias_score, stat_parity, di_results, sensitive_cols, target_cols)


# ─────────────────────────────────────────
# MAIN FUNCTION 2 — Correction Narrative
# ─────────────────────────────────────────

def generate_correction_narrative(
    suggestions: List[Dict],
    bias_score: float,
    api_key: Optional[str] = None,
) -> str:

    client = get_client(api_key)

    prompt = f"""
Explain bias correction clearly.

Bias Score: {bias_score}
Suggestions:
{json.dumps(suggestions)}
"""

    if client:
        try:
            response = client.models.generate_content(
                model="models/gemini-2.0-flash",
                contents=prompt,
            )
            return response.text

        except Exception:
            pass

    backup = generate_with_groq(prompt)
    if backup:
        return backup.get("EXECUTIVE_SUMMARY", _template_correction_narrative(suggestions, bias_score))

    return _template_correction_narrative(suggestions, bias_score)


# ─────────────────────────────────────────
# MAIN FUNCTION 3 — Report Summary
# ─────────────────────────────────────────

def generate_report_summary(
    full_analysis: Dict[str, Any],
    api_key: Optional[str] = None,
) -> str:

    client = get_client(api_key)

    bias_score = full_analysis.get("bias_risk_score", {}).get("score", 0)

    prompt = f"""
Write a short executive summary for a bias audit report.
Bias Score: {bias_score}
"""

    if client:
        try:
            response = client.models.generate_content(
                model="models/gemini-2.0-flash",
                contents=prompt,
            )
            return response.text

        except Exception:
            pass

    backup = generate_with_groq(prompt)
    if backup:
        return backup.get("EXECUTIVE_SUMMARY", _template_report_summary(full_analysis))

    return _template_report_summary(full_analysis)


# ─────────────────────────────────────────
# TEMPLATE FALLBACK
# ─────────────────────────────────────────

def _template_explanation(bias_score, stat_parity, di_results, sensitive_cols, target_cols):
    print("⚠️  Template fallback used (no AI provider available)")

    return {
        "EXECUTIVE_SUMMARY": (
            f"A bias risk score of {bias_score}/100 was detected across the analysed dataset. "
            "Review the statistical parity and disparate impact sections for detailed breakdowns."
        ),
        "ROOT_CAUSE": (
            f"Bias was identified in the sensitive attribute(s): {', '.join(sensitive_cols)}. "
            "Historical imbalances in training data are the most likely root cause."
        ),
        "REAL_WORLD_IMPACT": (
            "Unchecked bias can lead to discriminatory outcomes in decisions such as hiring, "
            "lending, or access to services."
        ),
        "TOP_RECOMMENDATIONS": (
            "Apply fairness-aware techniques such as re-sampling, re-weighting, or adversarial "
            "debiasing. Re-evaluate model outcomes regularly across all sensitive groups."
        ),
    }


def _template_correction_narrative(suggestions, bias_score):
    return (
        f"A bias score of {bias_score}/100 was detected. "
        f"{len(suggestions)} correction technique(s) are recommended to improve dataset fairness."
    )


def _template_report_summary(full_analysis):
    score = full_analysis.get("bias_risk_score", {}).get("score", 0)
    level = full_analysis.get("bias_risk_score", {}).get("risk_level", "Unknown")
    return (
        f"This bias audit recorded a risk score of {score}/100 ({level} risk). "
        "See the detailed sections below for statistical parity, disparate impact analysis, "
        "and recommended corrective actions."
    )
