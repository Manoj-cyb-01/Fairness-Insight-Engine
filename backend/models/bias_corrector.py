"""
Bias Correction Engine — FIXED

Key fixes:
1. apply_auto_fix() no longer grows df_fixed in-place across multiple sensitive
   columns (was causing exponential row growth).  Instead we collect ALL new rows
   from the ORIGINAL dataframe, then append once at the end.
2. NaN-safe noise injection: std() on a single row is NaN → clamped to 0.
3. Multi-class sensitive attributes (>2 groups) are handled correctly — we
   balance every group to the max-count of the ORIGINAL distribution, not the
   ever-growing one.
4. Gemini API key is never accepted here; it arrives via request header in the router.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List


def suggest_corrections(
    df: pd.DataFrame,
    sensitive_cols: List[str],
    target_cols: List[str],
    bias_score: float,
) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []

    for s_col in sensitive_cols:
        if s_col not in df.columns:
            continue
        vc = df[s_col].value_counts()
        if len(vc) >= 2:
            ratio = vc.max() / max(vc.min(), 1)
            if ratio > 1.5:
                suggestions.append({
                    "type": "resampling", "priority": "HIGH", "attribute": s_col,
                    "description": f"Oversample underrepresented groups in '{s_col}' (imbalance {ratio:.1f}×)",
                    "technique": "SMOTE (Synthetic Minority Oversampling)",
                    "impact": "Reduces statistical parity gap by 40–60 %",
                    "code_hint": (
                        "from imblearn.over_sampling import SMOTE\n"
                        "sm = SMOTE(random_state=42)\n"
                        "X_res, y_res = sm.fit_resample(X, y)"
                    ),
                })

    if bias_score > 50:
        suggestions.append({
            "type": "feature_removal", "priority": "MEDIUM",
            "attribute": ", ".join(sensitive_cols),
            "description": f"Remove or mask: {', '.join(sensitive_cols)}",
            "technique": "Fairness-aware feature selection",
            "impact": "Eliminates direct discrimination (proxy vars may remain)",
            "code_hint": f"df_fair = df.drop(columns={sensitive_cols})",
        })

    for t_col in target_cols:
        if t_col in df.columns:
            suggestions.append({
                "type": "reweighting", "priority": "HIGH", "attribute": t_col,
                "description": f"Apply sample weights to balance representation in '{t_col}'",
                "technique": "Inverse Probability Weighting (IPW)",
                "impact": "Improves disparate impact ratio by 20–35 %",
                "code_hint": (
                    "from sklearn.utils.class_weight import compute_sample_weight\n"
                    "weights = compute_sample_weight('balanced', y)"
                ),
            })

    if bias_score > 30:
        suggestions.append({
            "type": "calibration", "priority": "MEDIUM", "attribute": "model output",
            "description": "Post-processing threshold calibration per demographic group",
            "technique": "Equalized Odds Post-processing",
            "impact": "Equalises true-positive rates across groups",
            "code_hint": (
                "# Fairlearn ThresholdOptimizer\n"
                "from fairlearn.postprocessing import ThresholdOptimizer"
            ),
        })

    suggestions.append({
        "type": "proxy_analysis", "priority": "LOW", "attribute": "proxy variables",
        "description": "Audit columns correlated with sensitive attributes (proxy discrimination)",
        "technique": "Correlation-based proxy detection",
        "impact": "Identifies hidden discrimination vectors",
        "code_hint": "# Inspect zip_code, income, education as potential proxies",
    })

    return suggestions


def apply_auto_fix(
    df: pd.DataFrame,
    sensitive_cols: List[str],
    target_col: str,
) -> Dict[str, Any]:
    """
    One-pass oversampling across all sensitive columns.

    Strategy:
    - For each sensitive column, compute how many rows each minority group
      needs to match the majority group size in the *original* df.
    - Collect all synthetic rows (bootstrap + tiny Gaussian noise).
    - Append them all once to avoid exponential growth across columns.
    """
    rng     = np.random.default_rng(42)
    all_new: List[pd.DataFrame] = []
    changes: List[Dict[str, Any]] = []

    numeric_cols = [
        c for c in df.select_dtypes(include=[np.number]).columns
        if c != target_col
    ]

    for s_col in sensitive_cols:
        if s_col not in df.columns:
            continue

        nc = [c for c in numeric_cols if c != s_col]
        vc = df[s_col].value_counts()                  # counts from original df
        max_count = int(vc.max())

        for group, count in vc.items():
            count = int(count)
            if count >= max_count:
                continue
            deficit   = max_count - count
            group_df  = df[df[s_col] == group]
            # Bootstrap sample
            idx       = rng.integers(0, len(group_df), size=deficit)
            synthetic = group_df.iloc[idx].copy().reset_index(drop=True)

            # Add tiny Gaussian noise to numeric columns (NaN-safe)
            for c in nc:
                col_std = float(group_df[c].std(ddof=0))
                if col_std > 0 and np.isfinite(col_std):
                    noise = rng.normal(0, col_std * 0.03, size=deficit)
                    synthetic[c] = (synthetic[c].values + noise).clip(
                        group_df[c].min(), group_df[c].max()
                    )

            all_new.append(synthetic)
            changes.append({
                "attribute":      s_col,
                "group":          str(group),
                "original_count": count,
                "new_count":      max_count,
                "added_rows":     deficit,
            })

    if all_new:
        df_fixed = pd.concat([df] + all_new, ignore_index=True)
    else:
        df_fixed = df.copy()

    return {
        "original_shape":  list(df.shape),
        "fixed_shape":     list(df_fixed.shape),
        "changes":         changes,
        "fixed_dataframe": df_fixed,
    }


def compute_before_after_metrics(
    df_original: pd.DataFrame,
    df_fixed: pd.DataFrame,
    sensitive_cols: List[str],
    target_col: str,
) -> Dict[str, Any]:
    from models.bias_detector import statistical_parity
    before, after = {}, {}
    for s_col in sensitive_cols:
        if s_col in df_original.columns and target_col in df_original.columns:
            before[s_col] = statistical_parity(df_original, s_col, target_col)
            after[s_col]  = statistical_parity(df_fixed,    s_col, target_col)
    return {"before": before, "after": after}
