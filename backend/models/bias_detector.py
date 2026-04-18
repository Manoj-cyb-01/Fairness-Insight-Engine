"""
Bias Detection Engine — FIXED v2
- _binarize_target: robust type checking before median (fixes TypeError on string dtype)
- auto_detect_columns: no overlap, validation warnings, graceful fallback
- statistical_parity / disparate_impact: use shared _binarize_target
- full_correlation_matrix: NaN-safe
- feature_importance_bias: constant-column guard, robust label encoding
"""
import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, List, Any
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)

SENSITIVE_KEYWORDS = [
    "gender","sex","race","ethnicity","age","religion",
    "nationality","disability","marital","zip","postal",
]
TARGET_KEYWORDS = [
    "approved","hired","outcome","decision","label","target",
    "result","accepted","rejected","class","loan",
]


# ── helpers ───────────────────────────────────────────────────────────────────

def _is_numeric_series(s: pd.Series) -> bool:
    """True only for genuinely numeric dtypes (int/float), not strings."""
    return pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s)


def _binarize_target(series: pd.Series) -> pd.Series:
    """
    Deterministic positive-class assignment:
    - bool dtype         → cast to int
    - categorical/object → most-frequent value is positive
    - binary numeric 0/1 → use as-is
    - continuous numeric → strictly above median is positive
    Returns int Series, NaN → 0.
    """
    s = series.dropna()
    if s.empty:
        return series.fillna(0).astype(int)

    # Boolean
    if pd.api.types.is_bool_dtype(s):
        return series.fillna(False).astype(int)

    # Categorical or string
    if pd.api.types.is_object_dtype(s) or pd.api.types.is_categorical_dtype(s):
        pos = s.value_counts().index[0]
        return (series == pos).fillna(False).astype(int)

    # Numeric only from here
    if not _is_numeric_series(s):
        # Fallback: label-encode then binary on majority code
        codes = pd.Categorical(s.astype(str)).codes
        pos_code = pd.Series(codes).value_counts().index[0]
        enc = pd.Categorical(series.astype(str)).codes
        return (pd.Series(enc, index=series.index) == pos_code).fillna(False).astype(int)

    unique_vals = set(s.unique())
    if unique_vals <= {0, 1}:
        return series.fillna(0).astype(int)

    median = float(s.median())
    return (series > median).fillna(False).astype(int)


def _encode_df(df: pd.DataFrame) -> pd.DataFrame:
    """Label-encode object/category columns; fill NaN with median/0."""
    out = df.copy()
    for col in out.select_dtypes(include=["object", "category"]).columns:
        out[col] = pd.Categorical(out[col].astype(str)).codes.astype(float)
    for col in out.columns:
        if out[col].isnull().any():
            fill = out[col].median() if _is_numeric_series(out[col]) and out[col].notna().any() else 0.0
            out[col] = out[col].fillna(fill)
    return out


# ── public API ────────────────────────────────────────────────────────────────

def auto_detect_columns(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Auto-detect sensitive and target columns by keyword matching.
    Falls back gracefully; logs warnings instead of silently corrupting.
    Returns {"sensitive": [...], "targets": [...], "warnings": [...]}.
    """
    det_warnings: List[str] = []
    cols_lower = {col: col.lower() for col in df.columns}
    sensitive, targets = [], []

    for col, cl in cols_lower.items():
        for kw in SENSITIVE_KEYWORDS:
            if kw in cl and col not in sensitive:
                sensitive.append(col)
        for kw in TARGET_KEYWORDS:
            if kw in cl and col not in targets:
                targets.append(col)

    # Remove overlap — a column cannot be both sensitive and a target
    targets = [t for t in targets if t not in sensitive]

    # Fallback: pick first binary column that isn't sensitive
    if not targets:
        for col in df.columns:
            if col not in sensitive and df[col].nunique() == 2:
                targets.append(col)
                det_warnings.append(
                    f"No target column detected by keyword — using '{col}' (first binary column)."
                )
                break

    # Still nothing → last non-sensitive column
    if not targets:
        candidates = [c for c in df.columns if c not in sensitive]
        if candidates:
            targets.append(candidates[-1])
        det_warnings.append(
            f"Could not auto-detect a target column. Defaulting to '{targets[0] if targets else '?'}'."
        )

    if not sensitive:
        det_warnings.append(
            "No sensitive attributes auto-detected. Column names did not match known keywords."
        )

    return {"sensitive": sensitive, "targets": targets, "warnings": det_warnings}


def validate_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """Validate dataset quality and return structured summary."""
    missing     = df.isnull().sum()
    missing_pct = (missing / len(df) * 100).round(2)
    has_missing = missing[missing > 0]
    duplicates  = int(df.duplicated().sum())
    issues: List[str] = []
    if len(has_missing):
        issues.append(f"{len(has_missing)} columns have missing values")
    if duplicates:
        issues.append(f"{duplicates} duplicate rows detected")
    return {
        "rows":               len(df),
        "columns":            len(df.columns),
        "missing_values":     {k: int(v) for k, v in missing.items()},
        "missing_percentage": {k: float(v) for k, v in missing_pct.items()},
        "duplicate_rows":     duplicates,
        "issues":             issues,
        "dtypes":             {col: str(dt) for col, dt in df.dtypes.items()},
    }


def statistical_parity(df: pd.DataFrame, sensitive_col: str, target_col: str) -> Dict[str, Any]:
    """
    Statistical Parity Difference: max(P(Y=1|A=a)) − min(P(Y=1|A=a)).
    """
    if sensitive_col not in df.columns or target_col not in df.columns:
        return {}

    target = _binarize_target(df[target_col])
    group_rates: Dict[str, float] = {}

    for g in df[sensitive_col].dropna().unique():
        mask = df[sensitive_col] == g
        n = int(mask.sum())
        rate = float(target[mask].mean()) if n > 0 else 0.0
        if np.isfinite(rate):
            group_rates[str(g)] = round(rate, 4)

    if len(group_rates) < 2:
        return {}

    vals        = list(group_rates.values())
    parity_diff = round(max(vals) - min(vals), 4)

    return {
        "group_positive_rates": group_rates,
        "parity_difference":    parity_diff,
        "bias_detected":        parity_diff > 0.1,
        "severity":             _severity(parity_diff),
    }


def disparate_impact(df: pd.DataFrame, sensitive_col: str, target_col: str) -> Dict[str, Any]:
    """
    Disparate Impact Ratio: min_group_rate / max_group_rate.
    < 0.8 violates the EEOC four-fifths rule.
    """
    if sensitive_col not in df.columns or target_col not in df.columns:
        return {}

    target = _binarize_target(df[target_col])
    group_rates: Dict[str, float] = {}

    for g in df[sensitive_col].dropna().unique():
        mask = df[sensitive_col] == g
        n    = int(mask.sum())
        rate = float(target[mask].mean()) if n > 0 else 0.0
        if np.isfinite(rate):
            group_rates[str(g)] = rate

    if not group_rates:
        return {}

    max_rate = max(group_rates.values())
    di_ratios = {
        g: round(r / max_rate, 4) if max_rate > 0 else 1.0
        for g, r in group_rates.items()
    }
    min_di = min(di_ratios.values())

    return {
        "disparate_impact_ratios":   di_ratios,
        "minimum_ratio":             round(min_di, 4),
        "four_fifths_rule_violated": min_di < 0.8,
        "severity":                  _severity(1 - min_di),
    }


def correlation_analysis(df: pd.DataFrame, sensitive_cols: List[str]) -> Dict[str, Any]:
    """Pearson correlations between sensitive attributes and all other columns."""
    enc = _encode_df(df)
    correlations: Dict[str, Dict] = {}

    for s_col in sensitive_cols:
        if s_col not in enc.columns:
            continue
        col_corr: Dict[str, Any] = {}
        x = enc[s_col].values.astype(float)
        if np.std(x) == 0:
            correlations[s_col] = col_corr
            continue
        for col in enc.columns:
            if col == s_col:
                continue
            try:
                y = enc[col].values.astype(float)
                if np.std(y) == 0:
                    continue
                r, p = stats.pearsonr(x, y)
                if np.isfinite(r) and np.isfinite(p):
                    col_corr[col] = {"r": round(float(r), 4), "p_value": round(float(p), 4)}
            except Exception:
                pass
        correlations[s_col] = col_corr

    return correlations


def full_correlation_matrix(df: pd.DataFrame) -> Dict[str, Any]:
    """Full correlation matrix for heatmap visualisation. NaN-safe."""
    enc  = _encode_df(df)
    corr = enc.corr(numeric_only=True).fillna(0).round(3)
    return {
        "columns": list(corr.columns),
        "matrix":  [[float(v) for v in row] for row in corr.values],
    }


def compute_bias_risk_score(
    stat_parity_results: Dict,
    di_results: Dict,
    correlations: Dict,
) -> Dict[str, Any]:
    """Composite Bias Risk Score 0–100."""
    score = 0.0
    components: Dict[str, float] = {}

    sp_vals = [
        res["parity_difference"]
        for res in stat_parity_results.values()
        if isinstance(res, dict) and "parity_difference" in res
    ]
    if sp_vals:
        contrib = min(float(np.mean(sp_vals)) * 200, 40)
        score  += contrib
        components["statistical_parity"] = round(contrib, 2)

    di_vals = [
        1 - res["minimum_ratio"]
        for res in di_results.values()
        if isinstance(res, dict) and "minimum_ratio" in res
    ]
    if di_vals:
        contrib = min(float(np.mean(di_vals)) * 200, 40)
        score  += contrib
        components["disparate_impact"] = round(contrib, 2)

    high, total = 0, 0
    for cv in correlations.values():
        for c in cv.values():
            if isinstance(c, dict) and "r" in c:
                total += 1
                if abs(c["r"]) > 0.5:
                    high += 1
    if total:
        contrib = (high / total) * 20
        score  += contrib
        components["correlations"] = round(contrib, 2)

    final = round(min(score, 100.0), 1)
    return {
        "score":          final,
        "components":     components,
        "risk_level":     _risk_level(final),
        "interpretation": _interpret_score(final),
    }


def feature_importance_bias(
    df: pd.DataFrame, target_col: str, sensitive_cols: List[str]
) -> Dict[str, Any]:
    """Random-Forest feature importance for explainability."""
    from sklearn.ensemble import RandomForestClassifier

    if target_col not in df.columns:
        return {}

    enc = _encode_df(df)
    X   = enc.drop(columns=[target_col], errors="ignore")
    y   = _binarize_target(df[target_col])

    # Remove constant features (RF cannot use them)
    X = X.loc[:, X.std() > 0]
    if X.empty or len(y.unique()) < 2:
        return {}

    try:
        rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
        rf.fit(X, y)
        importances    = {col: round(float(v), 4) for col, v in zip(X.columns, rf.feature_importances_)}
        sens_contrib   = {c: importances.get(c, 0.0) for c in sensitive_cols if c in importances}
        return {
            "feature_importances":     importances,
            "sensitive_contributions": sens_contrib,
            "total_sensitive_impact":  round(sum(sens_contrib.values()), 4),
        }
    except Exception as exc:
        return {"error": str(exc)}


def ethical_warnings(
    bias_score: float, stat_parity: Dict, di_results: Dict
) -> List[Dict[str, str]]:
    w: List[Dict[str, str]] = []
    if bias_score >= 70:
        w.append({"level":"CRITICAL","icon":"🚨",
                  "message":"Dataset shows extreme bias — deploying this model could cause severe real-world discrimination."})
    elif bias_score >= 50:
        w.append({"level":"HIGH","icon":"⚠️",
                  "message":"Significant bias detected. This dataset may violate equal opportunity laws (EEOC, ECOA)."})
    elif bias_score >= 30:
        w.append({"level":"MEDIUM","icon":"🔶",
                  "message":"Moderate bias present. Decisions may disproportionately affect protected groups."})

    for col, res in di_results.items():
        if isinstance(res, dict) and res.get("four_fifths_rule_violated"):
            w.append({"level":"HIGH","icon":"⚖️",
                      "message":f"'{col}' violates the 80% rule — would fail regulatory scrutiny in hiring/lending."})

    for col, res in stat_parity.items():
        pd_ = res.get("parity_difference", 0) if isinstance(res, dict) else 0
        if pd_ > 0.3:
            w.append({"level":"HIGH","icon":"📊",
                      "message":f"'{col}' shows a {pd_*100:.0f}% disparity in outcomes between groups."})

    return w


# ── private helpers ───────────────────────────────────────────────────────────

def _severity(v: float) -> str:
    if v < 0.05:  return "Low"
    if v < 0.15:  return "Medium"
    if v < 0.30:  return "High"
    return "Critical"

def _risk_level(s: float) -> str:
    if s < 25:  return "Low"
    if s < 50:  return "Moderate"
    if s < 75:  return "High"
    return "Critical"

def _interpret_score(s: float) -> str:
    if s < 25:  return "Dataset appears relatively fair. Minor adjustments may improve equity."
    if s < 50:  return "Moderate bias detected. Review sensitive attributes before deploying."
    if s < 75:  return "High bias risk. Significant debiasing required before use in decisions."
    return "Critical bias detected. This dataset should NOT be used for automated decisions without major intervention."
