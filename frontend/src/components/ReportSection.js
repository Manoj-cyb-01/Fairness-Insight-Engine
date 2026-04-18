import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function ReportSection({ data, geminiKey, setAutoFixData }) {
  const [reportLoading, setReportLoading]   = useState(false);
  const [autoFixLoading, setAutoFixLoading] = useState(false);
  const [reportReady, setReportReady]       = useState(false);
  const [autoFixResult, setAutoFixResult]   = useState(null);
  const [reportError, setReportError]       = useState('');
  const [fixError, setFixError]             = useState('');

  const { bias_risk_score, detected_columns, validation, correction_suggestions, ethical_warnings } = data;
  const score      = bias_risk_score?.score ?? 0;
  const riskLevel  = bias_risk_score?.risk_level ?? 'Unknown';
  const scoreColor = score < 25 ? 'var(--accent-green)' : score < 50 ? 'var(--accent-blue)'
                   : score < 75 ? 'var(--accent-orange)' : '#FF4444';

  const generateReport = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const headers = {};
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
      const res = await axios.get(`${API}/api/report/generate`, {
        responseType: 'blob', headers,
      });
      const blob = new Blob([res.data], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bias_audit_report_${Date.now()}.html`;
      link.click();
      URL.revokeObjectURL(link.href);
      setReportReady(true);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Report generation failed.';
      setReportError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    setReportLoading(false);
  };

  const runAutoFix = async () => {
    setAutoFixLoading(true);
    setFixError('');
    try {
      const headers = {};
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
      const res = await axios.post(`${API}/api/analysis/auto-fix`, {}, { headers });
      setAutoFixResult(res.data);
      setAutoFixData(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Auto-fix failed.';
      setFixError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    setAutoFixLoading(false);
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Final Report</div>
        <div className="section-sub">
          Download the full audit report or apply one-click bias correction.
          Report narrative uses Gemini (primary), Groq (backup), or a built-in template when no key is set.
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {[
          { label: 'Bias Risk Score',   value: `${score.toFixed(0)}/100`,               color: scoreColor },
          { label: 'Risk Level',        value: riskLevel,                                color: scoreColor },
          { label: 'Rows Analysed',     value: validation?.rows?.toLocaleString() ?? '–', color: 'var(--accent-blue)' },
          { label: 'Sensitive Attrs',   value: detected_columns?.sensitive?.length ?? 0,  color: 'var(--accent-gold)' },
          { label: 'Warnings',          value: ethical_warnings?.length ?? 0,             color: 'var(--accent-orange)' },
          { label: 'Corrections Ready', value: correction_suggestions?.length ?? 0,       color: 'var(--accent-purple)' },
        ].map((s, i) => (
          <motion.div key={i} className="stat-card"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="two-col">
        {/* Report download */}
        <div className="card" style={{
          borderColor: 'rgba(88,166,255,0.3)',
          background: 'linear-gradient(135deg,rgba(88,166,255,0.04),transparent)',
        }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📄</div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 19, fontWeight: 700, marginBottom: 7 }}>
            Download Audit Report
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
            Professional HTML report with full dataset summary, bias metrics, AI insights
            (Gemini → Groq → template), and regulatory notes — ready for board-level presentation.
          </div>

          <ul style={{ listStyle: 'none', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              'Dataset overview',
              'Statistical parity',
              'Disparate impact (80% rule)',
              'AI-generated insights',
              'Correction recommendations',
              'Regulatory context',
            ].map(f => (
              <li key={f} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--accent-blue)' }}>✓</span>{f}
              </li>
            ))}
          </ul>

          {reportError && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', fontSize: 12,
              background: 'rgba(255,68,68,0.1)', borderRadius: 6,
              color: '#FF6B6B', lineHeight: 1.5,
            }}>
              ⚠ {reportError}
            </div>
          )}

          <button className="btn-primary" onClick={generateReport}
            disabled={reportLoading} style={{ width: '100%' }}>
            {reportLoading ? '⏳ Generating…' : reportReady ? '✓ Download Again' : '⬇ Generate & Download'}
          </button>
        </div>

        {/* Auto-fix */}
        <div className="card" style={{
          borderColor: 'rgba(63,185,80,0.3)',
          background: 'linear-gradient(135deg,rgba(63,185,80,0.04),transparent)',
        }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🔧</div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 19, fontWeight: 700, marginBottom: 7 }}>
            Auto Bias Fix
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
            One-click dataset rebalancing using bootstrap oversampling with Gaussian noise.
            Prevents exponential row growth across multiple sensitive attributes.
          </div>

          {autoFixResult ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {autoFixResult.changes?.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--accent-green)', padding: '3px 0', display: 'flex', gap: 6 }}>
                  <span>↑</span>
                  {c.attribute} — {c.group}: {c.original_count.toLocaleString()} → {c.new_count.toLocaleString()} rows
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                {autoFixResult.original_shape?.[0]?.toLocaleString()} → {autoFixResult.fixed_shape?.[0]?.toLocaleString()} rows total
              </div>
              {autoFixResult.narrative && (
                <div style={{
                  marginTop: 12, background: 'var(--surface-2)', borderRadius: 8,
                  padding: '11px 13px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7,
                }}>
                  {autoFixResult.narrative}
                </div>
              )}
              <div style={{ marginTop: 12, color: 'var(--accent-green)', fontSize: 12, fontWeight: 600 }}>
                ✓ Done — see Visualizations → Before vs After
              </div>
            </motion.div>
          ) : (
            <>
              {fixError && (
                <div style={{
                  marginBottom: 12, padding: '8px 12px', fontSize: 12,
                  background: 'rgba(255,68,68,0.1)', borderRadius: 6,
                  color: '#FF6B6B', lineHeight: 1.5,
                }}>
                  ⚠ {fixError}
                </div>
              )}
              <button
                onClick={runAutoFix}
                disabled={autoFixLoading}
                style={{
                  width: '100%', background: 'rgba(63,185,80,0.12)',
                  color: 'var(--accent-green)', border: '1px solid rgba(63,185,80,0.35)',
                  padding: '10px 24px', borderRadius: 8, fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                }}>
                {autoFixLoading ? '⏳ Applying…' : '⚡ Run Auto Bias Fix'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
