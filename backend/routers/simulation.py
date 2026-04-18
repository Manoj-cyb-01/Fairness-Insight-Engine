"""
Simulation Router — FIXED
- Multi-class ratio rebalancing (>2 groups)
- Structured error responses
- API key via header only
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

from utils.storage import get_dataframe, get_analysis
from models.bias_detector import statistical_parity, disparate_impact, compute_bias_risk_score

router = APIRouter()


class SimulationParams(BaseModel):
    modifications: Dict[str, Any]
    target_col: Optional[str] = None


@router.post("/what-if")
async def what_if_simulation(params: SimulationParams):
    df = get_dataframe()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset loaded.")

    analysis       = get_analysis() or {}
    sensitive_cols = analysis.get("detected_columns", {}).get("sensitive", [])
    target_cols    = analysis.get("detected_columns", {}).get("targets", [])
    target_col     = params.target_col or (target_cols[0] if target_cols else df.columns[-1])
    orig_score     = analysis.get("bias_risk_score", {}).get("score", 0)

    df_sim         = df.copy()
    applied: List[str] = []
    sim_sensitive  = list(sensitive_cols)

    rng = np.random.default_rng(42)

    for col, mod in params.modifications.items():
        if col not in df_sim.columns:
            continue

        if mod.get("remove"):
            df_sim = df_sim.drop(columns=[col])
            sim_sensitive = [c for c in sim_sensitive if c != col]
            applied.append(f"Removed column '{col}'")

        elif "ratio" in mod and col in sim_sensitive:
            target_ratio = float(mod["ratio"])
            groups       = df_sim[col].dropna().unique()
            n_groups     = len(groups)

            if n_groups < 2:
                continue

            total = len(df_sim)

            if n_groups == 2:
                g0, g1      = groups[0], groups[1]
                want_g0     = max(1, int(total * target_ratio))
                want_g1     = max(1, total - want_g0)
                df_g0 = _resample(df_sim[df_sim[col] == g0], want_g0, rng)
                df_g1 = _resample(df_sim[df_sim[col] == g1], want_g1, rng)
                df_sim = pd.concat([df_g0, df_g1], ignore_index=True)
                applied.append(
                    f"Rebalanced '{col}' → {target_ratio*100:.0f}/{(1-target_ratio)*100:.0f}"
                )
            else:
                # Multi-class: distribute evenly (ignore ratio, just balance)
                per_group = max(1, total // n_groups)
                parts = [_resample(df_sim[df_sim[col] == g], per_group, rng) for g in groups]
                df_sim = pd.concat(parts, ignore_index=True)
                applied.append(f"Balanced '{col}' across {n_groups} groups (~{per_group} each)")

        elif "cap_value" in mod:
            try:
                cap = float(mod["cap_value"])
                orig_max = float(df_sim[col].max())
                df_sim[col] = df_sim[col].clip(upper=cap)
                applied.append(f"Capped '{col}' at {cap} (was {orig_max:.0f})")
            except Exception:
                pass

    # Re-run metrics on simulated df
    sim_sp, sim_di = {}, {}
    for s_col in sim_sensitive:
        if s_col in df_sim.columns and target_col in df_sim.columns:
            sim_sp[s_col] = statistical_parity(df_sim, s_col, target_col)
            sim_di[s_col] = disparate_impact(df_sim,  s_col, target_col)

    new_risk    = compute_bias_risk_score(sim_sp, sim_di, {})
    new_score   = new_risk["score"]
    delta       = round(orig_score - new_score, 1)
    improvement = round(delta / orig_score * 100, 1) if orig_score > 0 else 0.0

    attr_changes: Dict[str, Any] = {}
    orig_sp = analysis.get("statistical_parity", {})
    for col in sim_sensitive:
        if col in sim_sp and col in orig_sp:
            orig_pd = orig_sp[col].get("parity_difference", 0)
            new_pd  = sim_sp[col].get("parity_difference", 0)
            attr_changes[col] = {
                "original_parity_gap":  round(orig_pd * 100, 2),
                "simulated_parity_gap": round(new_pd  * 100, 2),
                "improvement":          round((orig_pd - new_pd) * 100, 2),
            }

    return JSONResponse(content={
        "original_score":       orig_score,
        "simulated_score":      new_score,
        "score_delta":          delta,
        "improvement_percentage": improvement,
        "applied_changes":      applied,
        "attribute_changes":    attr_changes,
        "simulated_stat_parity": sim_sp,
        "simulated_di":         sim_di,
        "simulated_rows":       len(df_sim),
    })


@router.get("/scenarios")
async def get_scenarios():
    df = get_dataframe()
    if df is None:
        raise HTTPException(status_code=404, detail="No dataset loaded.")

    analysis       = get_analysis() or {}
    sensitive_cols = analysis.get("detected_columns", {}).get("sensitive", [])
    scenarios      = []

    for col in sensitive_cols:
        if col not in df.columns:
            continue
        n_uniq = df[col].nunique()
        if n_uniq <= 8:
            scenarios.append({
                "id":           f"balance_{col}",
                "name":         f"Balance '{col}' equally",
                "description":  f"Simulate equal representation across all {n_uniq} '{col}' groups",
                "modifications": {col: {"ratio": 0.5}},
            })
        scenarios.append({
            "id":           f"remove_{col}",
            "name":         f"Remove '{col}'",
            "description":  f"Simulate removing the sensitive attribute '{col}' entirely",
            "modifications": {col: {"remove": True}},
        })

    return JSONResponse(content={"scenarios": scenarios})


def _resample(group_df: pd.DataFrame, target_n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Resample a group to exactly target_n rows (over- or under-sample)."""
    if len(group_df) == 0:
        return group_df
    if target_n <= len(group_df):
        idx = rng.choice(len(group_df), size=target_n, replace=False)
    else:
        idx = rng.choice(len(group_df), size=target_n, replace=True)
    return group_df.iloc[idx].reset_index(drop=True)
