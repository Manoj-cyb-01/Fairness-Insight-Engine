"""
Analysis Router — FIXED
- gemini_api_key moved from query param to X-Gemini-Key request header (security)
- All endpoints return structured JSON errors (no naked crashes)
- auto_detect_columns() warnings surfaced to the response
- _run_full_analysis wrapped in try/except with detailed error propagation
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from fastapi.responses import JSONResponse
import pandas as pd
import io
import traceback
from typing import Optional

from utils.storage import store_dataframe, get_dataframe, store_analysis, get_analysis
from models.bias_detector import (
    auto_detect_columns, validate_dataset, statistical_parity,
    disparate_impact, correlation_analysis, full_correlation_matrix,
    compute_bias_risk_score, feature_importance_bias, ethical_warnings,
)
from models.bias_corrector import suggest_corrections, apply_auto_fix, compute_before_after_metrics
from utils.gemini_client import generate_bias_explanation, generate_correction_narrative
from utils.visualizer import (
    bias_distribution_chart, disparate_impact_chart, correlation_heatmap,
    bias_risk_gauge, feature_importance_chart, before_after_chart, distribution_charts,
)

router = APIRouter()


def _get_key(header_val: Optional[str]) -> Optional[str]:
    """Strip 'Bearer ' prefix if present."""
    if not header_val:
        return None
    return header_val.removeprefix("Bearer ").strip() or None


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
):
    """
    Upload CSV → run full auto-analysis pipeline.
    Pass Gemini API key via request header: X-Gemini-Key: <key>
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        raw = await file.read()
        # Try UTF-8, then latin-1 fallback
        try:
            df = pd.read_csv(io.StringIO(raw.decode("utf-8")))
        except UnicodeDecodeError:
            df = pd.read_csv(io.StringIO(raw.decode("latin-1")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded CSV is empty.")
    if len(df.columns) < 2:
        raise HTTPException(status_code=400, detail="CSV must have at least 2 columns.")

    store_dataframe(df, file.filename)

    try:
        results = await _run_full_analysis(df, file.filename, _get_key(x_gemini_key))
    except Exception as exc:
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}\n{tb}")

    store_analysis(results)
    return JSONResponse(content=results)


@router.get("/results")
async def get_results():
    results = get_analysis()
    if not results:
        raise HTTPException(status_code=404, detail="No analysis found. Upload a dataset first.")
    return JSONResponse(content=results)


@router.post("/auto-fix")
async def auto_fix(
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
):
    df = get_dataframe()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset loaded.")

    analysis = get_analysis() or {}
    sensitive_cols = analysis.get("detected_columns", {}).get("sensitive", [])
    target_cols    = analysis.get("detected_columns", {}).get("targets", [])

    if not sensitive_cols:
        raise HTTPException(status_code=400, detail="No sensitive columns detected in this dataset.")

    target_col = target_cols[0] if target_cols else df.columns[-1]

    try:
        fix_result = apply_auto_fix(df, sensitive_cols, target_col)
        df_fixed   = fix_result["fixed_dataframe"]
        ba_metrics = compute_before_after_metrics(df, df_fixed, sensitive_cols, target_col)
        chart      = before_after_chart(ba_metrics)
        narrative  = generate_correction_narrative(
            analysis.get("correction_suggestions", []),
            analysis.get("bias_risk_score", {}).get("score", 0),
            api_key=_get_key(x_gemini_key),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Auto-fix failed: {exc}")

    return JSONResponse(content={
        "changes":             fix_result["changes"],
        "original_shape":      fix_result["original_shape"],
        "fixed_shape":         fix_result["fixed_shape"],
        "before_after_metrics": ba_metrics,
        "before_after_chart":  chart,
        "narrative":           narrative,
    })


# ── internal pipeline ─────────────────────────────────────────────────────────

async def _run_full_analysis(df: pd.DataFrame, filename: str, gemini_key: Optional[str]) -> dict:
    validation = validate_dataset(df)

    detected       = auto_detect_columns(df)
    sensitive_cols = detected["sensitive"]
    target_cols    = detected["targets"]
    det_warnings   = detected.get("warnings", [])

    # Fallback: use object columns as sensitive if none detected
    if not sensitive_cols:
        cat = df.select_dtypes(include=["object", "category"]).columns.tolist()
        sensitive_cols = cat[:3]

    target_col = target_cols[0] if target_cols else df.columns[-1]

    stat_parity, di_results = {}, {}
    for s_col in sensitive_cols:
        stat_parity[s_col] = statistical_parity(df, s_col, target_col)
        di_results[s_col]  = disparate_impact(df, s_col, target_col)

    correlations = correlation_analysis(df, sensitive_cols)
    corr_matrix  = full_correlation_matrix(df)
    feat_imp     = feature_importance_bias(df, target_col, sensitive_cols)
    bias_risk    = compute_bias_risk_score(stat_parity, di_results, correlations)
    warns        = ethical_warnings(bias_risk["score"], stat_parity, di_results)
    corrections  = suggest_corrections(df, sensitive_cols, target_cols, bias_risk["score"])

    charts = {
        "bias_distribution":  bias_distribution_chart(stat_parity, sensitive_cols),
        "disparate_impact":   disparate_impact_chart(di_results, sensitive_cols),
        "correlation_heatmap": correlation_heatmap(corr_matrix),
        "risk_gauge":         bias_risk_gauge(bias_risk["score"]),
        "feature_importance": feature_importance_chart(
            feat_imp.get("feature_importances", {}), sensitive_cols
        ),
        "distributions":      distribution_charts(df, sensitive_cols),
    }

    ai_insights = generate_bias_explanation(
        dataset_summary=validation,
        bias_score=bias_risk["score"],
        stat_parity=stat_parity,
        di_results=di_results,
        sensitive_cols=sensitive_cols,
        target_cols=target_cols,
        api_key=gemini_key,
    )

    preview_df = df.head(10).fillna("N/A")
    preview = {
        "columns": list(df.columns),
        "rows":    preview_df.astype(str).to_dict(orient="records"),
        "dtypes":  {col: str(dt) for col, dt in df.dtypes.items()},
    }

    return {
        "filename":            filename,
        "validation":          validation,
        "detected_columns":    {"sensitive": sensitive_cols, "targets": target_cols},
        "detection_warnings":  det_warnings,
        "statistical_parity":  stat_parity,
        "disparate_impact":    di_results,
        "correlations":        correlations,
        "feature_importance":  feat_imp,
        "bias_risk_score":     bias_risk,
        "ethical_warnings":    warns,
        "correction_suggestions": corrections,
        "charts":              charts,
        "ai_insights":         ai_insights,
        "preview":             preview,
    }
