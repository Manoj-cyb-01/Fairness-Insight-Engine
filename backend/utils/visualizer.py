"""
Visualization Generator — FIXED
Creates interactive Plotly charts for the dashboard.

ROOT FIX: All fig.update_layout() calls previously spread **PLOTLY_TEMPLATE["layout"]
(which contained "xaxis" and "yaxis") AND then passed explicit xaxis=/yaxis= kwargs —
causing: TypeError: multiple values for keyword argument 'xaxis'.

Solution: safe_layout() builds the merged dict WITHOUT xaxis/yaxis from the base
template. Callers pass their own axis dicts explicitly.
"""
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import json
from typing import Dict, List

# ── Palette / colours ─────────────────────────────────────────────────────────
COLORS = {
    "bg":            "#0D1117",
    "surface":       "#161B22",
    "surface2":      "#1C2128",
    "border":        "#30363D",
    "accent_blue":   "#58A6FF",
    "accent_purple": "#BC8CFF",
    "accent_orange": "#F78166",
    "accent_green":  "#3FB950",
    "text":          "#E6EDF3",
    "text_muted":    "#8B949E",
}

PALETTE = ["#58A6FF","#BC8CFF","#F78166","#3FB950","#D2A8FF","#FFA657","#79C0FF","#56D364"]

# Shared axis styling — callers include this in their own axis dicts
_AXIS = {
    "gridcolor":    COLORS["border"],
    "linecolor":    COLORS["border"],
    "zerolinecolor": COLORS["border"],
    "tickfont":     {"color": COLORS["text_muted"]},
}

# Base layout WITHOUT xaxis / yaxis (avoids duplicate-kwarg crash)
_BASE = {
    "paper_bgcolor": "rgba(0,0,0,0)",
    "plot_bgcolor":  "rgba(0,0,0,0)",
    "font":    {"color": COLORS["text"], "family": "IBM Plex Mono, monospace", "size": 11},
    "colorway": PALETTE,
    "legend":  {"bgcolor": COLORS["surface"], "font": {"color": COLORS["text"]}},
}


def safe_layout(**overrides) -> dict:
    """
    Merge _BASE with caller-supplied overrides.
    xaxis / yaxis MUST be supplied as keyword overrides — never inherited from _BASE —
    so there is never a duplicate keyword argument.
    """
    out = dict(_BASE)
    out.update(overrides)
    return out


def _to_json(fig) -> dict:
    return json.loads(fig.to_json())


def _binarize(series: pd.Series) -> pd.Series:
    """
    Convert target column to 0/1 with an explicit positive-class heuristic.
    - Already 0/1 int → use as-is.
    - Numeric non-binary → values strictly > median are positive.
    - Categorical / object → most-frequent value is the positive class.
    """
    s = series.dropna()
    if s.empty:
        return series.fillna(0).astype(int)

    if pd.api.types.is_object_dtype(s) or pd.api.types.is_categorical_dtype(s):
        pos = s.value_counts().index[0]
        return (series == pos).astype(int)

    uniq = set(s.unique())
    if uniq <= {0, 1}:
        return series.fillna(0).astype(int)

    median = float(s.median())
    return (series > median).astype(int)


# ── Charts ────────────────────────────────────────────────────────────────────

def bias_distribution_chart(stat_parity: Dict, sensitive_cols: List[str]) -> Dict:
    """Bar: positive-outcome rate per group."""
    out = {}
    for col in sensitive_cols:
        res = stat_parity.get(col)
        if not isinstance(res, dict):
            continue
        gr = res.get("group_positive_rates", {})
        if not gr:
            continue
        groups = list(gr.keys())
        rates  = [v * 100 for v in gr.values()]
        fig = go.Figure(go.Bar(
            x=groups, y=rates,
            marker=dict(
                color=rates,
                colorscale=[[0,COLORS["accent_green"]],[0.5,COLORS["accent_blue"]],[1,COLORS["accent_orange"]]],
                showscale=True,
                colorbar=dict(title="Rate %", tickfont=dict(color=COLORS["text_muted"])),
            ),
            text=[f"{r:.1f}%" for r in rates], textposition="outside",
            textfont=dict(color=COLORS["text"]),
        ))
        ymax = max(rates) * 1.3 if rates else 100
        fig.update_layout(**safe_layout(
            title=dict(text=f"Positive Rate — '{col}'", font=dict(size=13,color=COLORS["text"])),
            xaxis=dict(title="Group", **_AXIS),
            yaxis=dict(title="Positive Rate (%)", range=[0, ymax], **_AXIS),
            height=350, margin=dict(t=55,b=45,l=55,r=25),
        ))
        out[col] = _to_json(fig)
    return out


def disparate_impact_chart(di_results: Dict, sensitive_cols: List[str]) -> Dict:
    """Horizontal bar: DI ratios + 80 % line."""
    out = {}
    for col in sensitive_cols:
        res = di_results.get(col)
        if not isinstance(res, dict):
            continue
        di = res.get("disparate_impact_ratios", {})
        if not di:
            continue
        groups = list(di.keys())
        ratios = [float(v) for v in di.values()]
        colors = [COLORS["accent_orange"] if r < 0.8 else COLORS["accent_green"] for r in ratios]
        fig = go.Figure(go.Bar(
            x=ratios, y=groups, orientation="h",
            marker_color=colors,
            text=[f"{r:.3f}" for r in ratios], textposition="outside",
            textfont=dict(color=COLORS["text"]),
        ))
        fig.add_vline(x=0.8, line_dash="dash", line_color=COLORS["accent_orange"],
                      annotation_text="80% Rule", annotation_font_color=COLORS["accent_orange"])
        h = max(270, len(groups)*60+110)
        fig.update_layout(**safe_layout(
            title=dict(text=f"Disparate Impact — '{col}'", font=dict(size=13,color=COLORS["text"])),
            xaxis=dict(title="DI Ratio", range=[0, 1.2], **_AXIS),
            yaxis=dict(**_AXIS),
            height=h, margin=dict(t=55,b=45,l=90,r=65),
        ))
        out[col] = _to_json(fig)
    return out


def correlation_heatmap(corr_matrix_data: Dict) -> Dict:
    """Annotated correlation-matrix heatmap."""
    cols   = corr_matrix_data.get("columns", [])
    matrix = corr_matrix_data.get("matrix", [])
    if not cols or not matrix:
        return {}
    safe = [[0.0 if (v != v) else float(v) for v in row] for row in matrix]
    fig = go.Figure(go.Heatmap(
        z=safe, x=cols, y=cols,
        colorscale=[[0,"#F78166"],[0.5,COLORS["surface2"]],[1,"#58A6FF"]],
        zmid=0, zmin=-1, zmax=1,
        text=[[f"{v:.2f}" for v in row] for row in safe],
        texttemplate="%{text}", textfont={"size":9,"color":COLORS["text"]},
        showscale=True,
        colorbar=dict(
    title=dict(
        text="Correlation",
        font=dict(color=COLORS["text"])
    ),
    tickfont=dict(color=COLORS["text_muted"])
)
    ))
    h = max(420, len(cols)*36+110)
    fig.update_layout(**safe_layout(
        title=dict(text="Feature Correlation Matrix", font=dict(size=13,color=COLORS["text"])),
        xaxis=dict(tickangle=-40, **_AXIS),
        yaxis=dict(autorange="reversed", **_AXIS),
        height=h, margin=dict(t=55,b=90,l=90,r=25),
    ))
    return _to_json(fig)


def bias_risk_gauge(score: float) -> Dict:
    """Indicator gauge for composite Bias Risk Score."""
    score = 0.0 if score != score else float(score)  # NaN guard
    color = (COLORS["accent_green"]  if score < 25 else
             COLORS["accent_blue"]   if score < 50 else
             COLORS["accent_orange"] if score < 75 else "#FF4444")
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=score,
        title={"text":"Bias Risk Score","font":{"color":COLORS["text"],"size":15}},
        number={"font":{"color":color,"size":44},"suffix":" / 100"},
        gauge={
            "axis":{"range":[0,100],"tickcolor":COLORS["text_muted"],
                    "tickfont":{"color":COLORS["text_muted"]}},
            "bar":{"color":color},
            "bgcolor":COLORS["surface"], "bordercolor":COLORS["border"],
            "steps":[
                {"range":[0,25],  "color":"rgba(63,185,80,0.18)"},
                {"range":[25,50], "color":"rgba(88,166,255,0.18)"},
                {"range":[50,75], "color":"rgba(247,129,102,0.18)"},
                {"range":[75,100],"color":"rgba(255,68,68,0.18)"},
            ],
            "threshold":{"line":{"color":color,"width":4},"thickness":0.76,"value":score},
        },
    ))
    # Gauge charts do not use xaxis/yaxis
    fig.update_layout(**safe_layout(height=290, margin=dict(t=35,b=15,l=25,r=25)))
    return _to_json(fig)


def feature_importance_chart(importances: Dict[str, float], sensitive_cols: List[str]) -> Dict:
    """Horizontal bar: feature importances, sensitive attrs highlighted."""
    if not importances:
        return {}
    items    = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:15]
    features = [i[0] for i in items]
    values   = [float(i[1]) for i in items]
    colors   = [COLORS["accent_orange"] if f in sensitive_cols else COLORS["accent_blue"]
                for f in features]
    fig = go.Figure(go.Bar(
        x=values, y=features, orientation="h",
        marker_color=colors,
        text=[f"{v:.3f}" for v in values], textposition="outside",
        textfont=dict(color=COLORS["text"]),
    ))
    mv = max(values) if values else 1
    fig.add_annotation(x=mv*0.72, y=len(features)-1,
                       text="🟠 Sensitive   🔵 Regular",
                       showarrow=False, font=dict(color=COLORS["text_muted"],size=10))
    h = max(310, len(features)*32+110)
    fig.update_layout(**safe_layout(
        title=dict(text="Feature Importance (Bias Contribution)",
                   font=dict(size=13,color=COLORS["text"])),
        xaxis=dict(title="Importance Score", **_AXIS),
        yaxis=dict(**_AXIS),
        height=h, margin=dict(t=55,b=45,l=135,r=65),
    ))
    return _to_json(fig)


def before_after_chart(before_after: Dict) -> Dict:
    """Grouped bar: parity gap before / after auto-fix."""
    before = before_after.get("before", {})
    after  = before_after.get("after",  {})
    if not before:
        return {}
    cols   = list(before.keys())
    b_vals = [before[c].get("parity_difference", 0)*100 for c in cols]
    a_vals = [after.get(c, {}).get("parity_difference", 0)*100 for c in cols]
    fig = go.Figure()
    fig.add_trace(go.Bar(name="Before Fix", x=cols, y=b_vals,
                         marker_color=COLORS["accent_orange"],
                         text=[f"{v:.1f}%" for v in b_vals], textposition="outside",
                         textfont=dict(color=COLORS["text"])))
    fig.add_trace(go.Bar(name="After Fix",  x=cols, y=a_vals,
                         marker_color=COLORS["accent_green"],
                         text=[f"{v:.1f}%" for v in a_vals], textposition="outside",
                         textfont=dict(color=COLORS["text"])))
    fig.update_layout(**safe_layout(
        title=dict(text="Bias Before vs After Auto-Fix",
                   font=dict(size=13,color=COLORS["text"])),
        barmode="group",
        xaxis=dict(**_AXIS),
        yaxis=dict(title="Parity Gap (%)", **_AXIS),
        height=370, margin=dict(t=55,b=45,l=65,r=25),
    ))
    return _to_json(fig)


def distribution_charts(df: pd.DataFrame, sensitive_cols: List[str]) -> Dict:
    """Pie / histogram per sensitive attribute."""
    charts = {}
    for col in sensitive_cols:
        if col not in df.columns:
            continue
        try:
            if df[col].dtype == object or df[col].nunique() <= 12:
                vc = df[col].value_counts().head(12)
                fig = go.Figure(go.Pie(
                    labels=vc.index.astype(str).tolist(),
                    values=vc.values.tolist(),
                    marker=dict(colors=PALETTE),
                    hole=0.42,
                    textinfo="label+percent",
                    textfont=dict(color=COLORS["text"], size=11),
                    insidetextorientation="radial",
                ))
            else:
                fig = go.Figure(go.Histogram(
                    x=df[col].dropna(), marker_color=COLORS["accent_blue"],
                    nbinsx=20, opacity=0.85,
                ))
            fig.update_layout(**safe_layout(
                title=dict(text=f"Distribution: {col}",
                           font=dict(size=13,color=COLORS["text"])),
                xaxis=dict(**_AXIS),
                yaxis=dict(**_AXIS),
                height=290, margin=dict(t=50,b=45,l=45,r=25),
                showlegend=False,
            ))
            charts[col] = _to_json(fig)
        except Exception:
            pass
    return charts
