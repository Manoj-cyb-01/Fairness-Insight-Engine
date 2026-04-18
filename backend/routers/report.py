"""
Report Router — FIXED
- REPORT_PATH uses tempfile / pathlib (cross-platform, no hardcoded /tmp)
- API key via header only
- Structured error responses
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import HTMLResponse, FileResponse
from typing import Optional
import pathlib, tempfile, os, json
from datetime import datetime

from utils.storage import get_analysis
from utils.gemini_client import generate_report_summary

router = APIRouter()

# Cross-platform temp directory
_REPORT_DIR  = pathlib.Path(tempfile.gettempdir())
_REPORT_FILE = _REPORT_DIR / "unbiased_ai_bias_report.html"


def _get_key(h: Optional[str]) -> Optional[str]:
    if not h:
        return None
    return h.removeprefix("Bearer ").strip() or None


@router.get("/generate", response_class=HTMLResponse)
async def generate_report(
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
):
    analysis = get_analysis()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found. Upload a dataset first.")

    try:
        summary = generate_report_summary(analysis, api_key=_get_key(x_gemini_key))
        html    = _build_report_html(analysis, summary)
        _REPORT_FILE.write_text(html, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")

    return HTMLResponse(content=html)


@router.get("/download")
async def download_report():
    if not _REPORT_FILE.exists():
        raise HTTPException(status_code=404, detail="No report generated yet. Call /generate first.")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        str(_REPORT_FILE),
        media_type="text/html",
        filename=f"bias_audit_report_{stamp}.html",
    )


# ── HTML builder ──────────────────────────────────────────────────────────────

def _build_report_html(analysis: dict, exec_summary: str) -> str:
    bias_score   = analysis.get("bias_risk_score", {}).get("score", 0)
    risk_level   = analysis.get("bias_risk_score", {}).get("risk_level", "Unknown")
    filename     = analysis.get("filename", "Unknown")
    validation   = analysis.get("validation", {})
    sensitive    = analysis.get("detected_columns", {}).get("sensitive", [])
    targets      = analysis.get("detected_columns", {}).get("targets", [])
    warns        = analysis.get("ethical_warnings", [])
    corrections  = analysis.get("correction_suggestions", [])
    ai_insights  = analysis.get("ai_insights", {})
    stat_parity  = analysis.get("statistical_parity", {})
    di_results   = analysis.get("disparate_impact", {})
    now          = datetime.now().strftime("%B %d, %Y at %H:%M UTC")

    score_color = (
        "#3FB950" if bias_score < 25 else
        "#58A6FF" if bias_score < 50 else
        "#F78166" if bias_score < 75 else
        "#FF4444"
    )

    def warn_html():
        out = ""
        for w in warns:
            lc = {"CRITICAL":"#FF4444","HIGH":"#F78166","MEDIUM":"#FFA657","LOW":"#3FB950"}.get(w["level"],"#8B949E")
            out += f"""<div style="border-left:4px solid {lc};padding:12px 16px;margin:8px 0;
background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
<span style="font-weight:700;color:{lc};">{w['icon']} {w['level']}</span>
<p style="margin:4px 0 0;color:#E6EDF3;">{w['message']}</p></div>"""
        return out

    def corrections_html():
        out = ""
        for i, c in enumerate(corrections, 1):
            pc = {"HIGH":"#F78166","MEDIUM":"#FFA657","LOW":"#3FB950"}.get(c["priority"],"#8B949E")
            out += f"""<div style="border:1px solid #30363D;border-radius:8px;padding:16px;
margin:8px 0;background:#161B22;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
<span style="font-weight:700;color:#E6EDF3;">{i}. {c['type'].replace('_',' ').title()}</span>
<span style="background:{pc}22;color:{pc};padding:2px 10px;border-radius:12px;
font-size:12px;font-weight:600;">{c['priority']}</span></div>
<p style="color:#8B949E;margin:0 0 8px;">{c['description']}</p>
<p style="color:#58A6FF;margin:0 0 4px;font-size:13px;"><strong>Technique:</strong> {c['technique']}</p>
<p style="color:#3FB950;margin:0;font-size:13px;"><strong>Expected Impact:</strong> {c['impact']}</p>
<pre style="background:#0D1117;border-radius:6px;padding:10px;margin-top:10px;
font-size:11px;color:#79C0FF;overflow-x:auto;">{c.get('code_hint','')}</pre></div>"""
        return out

    def parity_rows():
        out = ""
        for col, res in stat_parity.items():
            if not isinstance(res, dict): continue
            pd_ = res.get("parity_difference", 0)
            sev = res.get("severity", "N/A")
            sc  = {"Low":"#3FB950","Medium":"#FFA657","High":"#F78166","Critical":"#FF4444"}.get(sev,"#8B949E")
            out += f"""<tr><td style="padding:10px 12px;color:#E6EDF3;">{col}</td>
<td style="padding:10px 12px;color:#58A6FF;">{pd_*100:.2f}%</td>
<td style="padding:10px 12px;"><span style="color:{sc};font-weight:600;">{sev}</span></td>
<td style="padding:10px 12px;color:{'#F78166' if res.get('bias_detected') else '#3FB950'};">
{'⚠ Detected' if res.get('bias_detected') else '✓ OK'}</td></tr>"""
        return out

    def di_rows():
        out = ""
        for col, res in di_results.items():
            if not isinstance(res, dict): continue
            mr  = res.get("minimum_ratio", 1.0)
            vio = res.get("four_fifths_rule_violated", False)
            out += f"""<tr><td style="padding:10px 12px;color:#E6EDF3;">{col}</td>
<td style="padding:10px 12px;color:#BC8CFF;">{mr:.4f}</td>
<td style="padding:10px 12px;color:{'#F78166' if vio else '#3FB950'};">
{'⚠ VIOLATED' if vio else '✓ Compliant'}</td></tr>"""
        return out

    def ai_cards():
        labels = {
            "EXECUTIVE_SUMMARY": ("📋","Executive Summary","#58A6FF"),
            "ROOT_CAUSE":        ("🔍","Root Cause","#BC8CFF"),
            "REAL_WORLD_IMPACT": ("🌍","Real-World Impact","#F78166"),
            "TOP_RECOMMENDATIONS":("💡","Recommendations","#3FB950"),
        }
        out = ""
        for k, v in ai_insights.items():
            if not isinstance(v, str): continue
            icon, label, color = labels.get(k, ("🔹", k.replace("_"," "), "#58A6FF"))
            out += f"""<div style="background:#161B22;border:1px solid #30363D;
border-left:3px solid {color};border-radius:8px;padding:18px;margin-bottom:14px;">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:{color};
font-family:'IBM Plex Mono',monospace;font-weight:600;margin-bottom:8px;">{icon} {label}</div>
<div style="color:#C9D1D9;line-height:1.75;font-size:14px;">{v}</div></div>"""
        return out

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bias Audit Report — {filename}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600;700&display=swap');
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'IBM Plex Sans',sans-serif;background:#0D1117;color:#E6EDF3;line-height:1.6}}
.header{{background:linear-gradient(135deg,#161B22,#0D1117);border-bottom:1px solid #30363D;
         padding:48px;text-align:center}}
.logo{{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#58A6FF;letter-spacing:4px;
       text-transform:uppercase;margin-bottom:14px}}
h1{{font-size:32px;font-weight:700;margin-bottom:6px}}
.subtitle{{color:#8B949E;font-size:15px}}
.meta{{margin-top:22px;display:flex;justify-content:center;gap:28px;flex-wrap:wrap}}
.meta-item{{text-align:center}}
.meta-label{{font-size:10px;color:#8B949E;text-transform:uppercase;letter-spacing:1px}}
.meta-value{{font-size:14px;color:#E6EDF3;font-weight:600;margin-top:3px}}
.score-hero{{text-align:center;padding:48px;
            background:linear-gradient(180deg,rgba(88,166,255,.05),transparent);
            border-bottom:1px solid #30363D}}
.score-num{{font-size:96px;font-weight:700;color:{score_color};
            font-family:'IBM Plex Mono',monospace;line-height:1}}
.score-lbl{{font-size:17px;color:#8B949E;margin-top:6px}}
.badge{{display:inline-block;background:{score_color}22;color:{score_color};
        padding:5px 18px;border-radius:20px;font-weight:700;font-size:13px;
        margin-top:10px;border:1px solid {score_color}44}}
.container{{max-width:1050px;margin:0 auto;padding:0 30px}}
.section{{padding:44px 0;border-bottom:1px solid #30363D}}
h2{{font-size:20px;font-weight:700;margin-bottom:22px;display:flex;align-items:center;gap:10px}}
h2::before{{content:'';display:inline-block;width:4px;height:22px;
            background:linear-gradient(180deg,#58A6FF,#BC8CFF);border-radius:2px}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}}
.stat-card{{background:#161B22;border:1px solid #30363D;border-radius:10px;padding:18px;text-align:center}}
.stat-val{{font-size:28px;font-weight:700;font-family:'IBM Plex Mono',monospace}}
.stat-lbl{{font-size:11px;color:#8B949E;margin-top:5px;text-transform:uppercase;letter-spacing:1px}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;
    color:#8B949E;border-bottom:1px solid #30363D;font-family:'IBM Plex Mono',monospace}}
tr:hover{{background:rgba(255,255,255,.02)}}
.exec{{background:#161B22;border:1px solid #30363D;border-left:4px solid #58A6FF;
       border-radius:8px;padding:22px;font-size:14px;line-height:1.8;color:#C9D1D9;white-space:pre-line}}
.footer{{text-align:center;padding:28px;color:#8B949E;font-size:12px}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">⚖ Unbiased AI · Bias Audit Report</div>
  <h1>Dataset Fairness Analysis</h1>
  <p class="subtitle">{filename}</p>
  <div class="meta">
    <div class="meta-item"><div class="meta-label">Generated</div><div class="meta-value">{now}</div></div>
    <div class="meta-item"><div class="meta-label">Rows</div><div class="meta-value">{validation.get('rows',0):,}</div></div>
    <div class="meta-item"><div class="meta-label">Columns</div><div class="meta-value">{validation.get('columns',0)}</div></div>
    <div class="meta-item"><div class="meta-label">Sensitive</div><div class="meta-value">{len(sensitive)}</div></div>
    <div class="meta-item"><div class="meta-label">Warnings</div><div class="meta-value">{len(warns)}</div></div>
  </div>
</div>
<div class="score-hero">
  <div class="score-num">{bias_score:.0f}</div>
  <div class="score-lbl">Bias Risk Score / 100</div>
  <div class="badge">{risk_level} Risk</div>
</div>
<div class="container">
  <div class="section">
    <h2>Executive Summary</h2>
    <div class="exec">{exec_summary}</div>
  </div>
  <div class="section">
    <h2>Dataset Overview</h2>
    <div class="stats">
      <div class="stat-card"><div class="stat-val" style="color:#58A6FF;">{validation.get('rows',0):,}</div><div class="stat-lbl">Rows</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#BC8CFF;">{validation.get('columns',0)}</div><div class="stat-lbl">Columns</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#F78166;">{validation.get('duplicate_rows',0)}</div><div class="stat-lbl">Duplicates</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#E3B341;">{len(sensitive)}</div><div class="stat-lbl">Sensitive Attrs</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#3FB950;">{len(targets)}</div><div class="stat-lbl">Target Vars</div></div>
    </div>
    <p style="color:#8B949E;font-size:13px;">
      <strong style="color:#E6EDF3;">Sensitive:</strong> {', '.join(sensitive) or 'None'}<br>
      <strong style="color:#E6EDF3;">Targets:</strong>   {', '.join(targets)   or 'None'}
    </p>
  </div>
  {'<div class="section"><h2>⚠ Ethical Warnings</h2>' + warn_html() + '</div>' if warns else ''}
  <div class="section">
    <h2>Statistical Parity</h2>
    <p style="color:#8B949E;font-size:13px;margin-bottom:14px;">Gap &gt;10 % signals potential bias.</p>
    <table><thead><tr><th>Attribute</th><th>Parity Gap</th><th>Severity</th><th>Status</th></tr></thead>
    <tbody>{parity_rows()}</tbody></table>
  </div>
  <div class="section">
    <h2>Disparate Impact (80 % Rule)</h2>
    <p style="color:#8B949E;font-size:13px;margin-bottom:14px;">Ratio &lt;0.8 indicates adverse impact.</p>
    <table><thead><tr><th>Attribute</th><th>Min DI Ratio</th><th>80 % Rule</th></tr></thead>
    <tbody>{di_rows()}</tbody></table>
  </div>
  <div class="section"><h2>AI-Powered Insights</h2>{ai_cards()}</div>
  <div class="section"><h2>Bias Correction Recommendations</h2>{corrections_html()}</div>
  <div class="section">
    <h2>Methodology &amp; Disclaimer</h2>
    <div style="background:#161B22;border-radius:8px;padding:18px;color:#8B949E;font-size:13px;line-height:1.8;">
      <p>Generated by <strong style="color:#E6EDF3;">Unbiased AI Decision System</strong> using Statistical Parity
      Difference, Disparate Impact Ratio (EEOC 4/5ths rule), Pearson correlation, and Random-Forest feature
      importance. AI narratives via Gemini (primary), Groq (backup), or built-in template fallback.</p>
      <p style="margin-top:10px;">This report is informational and does not constitute legal advice.
      Consult qualified experts before deployment.</p>
    </div>
  </div>
</div>
<div class="footer"><p>Unbiased AI Decision System — {now}</p></div>
</body></html>"""
