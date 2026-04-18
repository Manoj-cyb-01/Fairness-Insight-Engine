import React from 'react';
import { motion } from 'framer-motion';

const INSIGHT_META = {
  EXECUTIVE_SUMMARY:   { icon: '📋', label: 'Executive Summary',    color: 'var(--accent-blue)' },
  ROOT_CAUSE:          { icon: '🔍', label: 'Root Cause Analysis',   color: 'var(--accent-purple)' },
  REAL_WORLD_IMPACT:   { icon: '🌍', label: 'Real-World Impact',     color: 'var(--accent-orange)' },
  TOP_RECOMMENDATIONS: { icon: '💡', label: 'AI Recommendations',    color: 'var(--accent-green)' },
};

export default function AIInsights({ data }) {
  const { ai_insights, correction_suggestions, bias_risk_score, detected_columns } = data;
  const score     = bias_risk_score?.score ?? 0;
  const riskLevel = bias_risk_score?.risk_level ?? 'Unknown';

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">AI-Powered Insights</h1>
        <p className="section-sub">
          Natural language analysis powered by Gemini (primary) with Groq as backup.
          Add your Gemini key in the header for enhanced insights — the system falls back
          automatically to Groq, then to built-in template responses if neither key is set.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(188,140,255,0.12), rgba(88,166,255,0.08))',
          border: '1px solid rgba(188,140,255,0.25)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span style={{ fontSize: 36 }}>🤖</span>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            AI Analysis — Gemini → Groq → Template
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Sensitive attributes:{' '}
            <strong style={{ color: 'var(--accent-purple)' }}>
              {detected_columns?.sensitive?.join(', ') || 'N/A'}
            </strong>
            &nbsp;· Risk Score:{' '}
            <strong style={{ color: score >= 50 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
              {score}/100 ({riskLevel})
            </strong>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gap: 16 }}>
        {ai_insights && Object.entries(ai_insights).map(([key, value], i) => {
          if (!value || typeof value !== 'string') return null;
          const meta = INSIGHT_META[key] || { icon: '💬', label: key.replace(/_/g, ' '), color: 'var(--accent-blue)' };
          return (
            <motion.div
              key={key}
              className="ai-card"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{ borderLeft: `3px solid ${meta.color}` }}
            >
              <div className="ai-card-label" style={{ color: meta.color }}>
                <span>{meta.icon}</span> {meta.label}
              </div>
              <div className="ai-card-text">{value}</div>
            </motion.div>
          );
        })}
      </div>

      {correction_suggestions && correction_suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: 32 }}
        >
          <div className="section-header">
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              Smart Correction Suggestions
            </h2>
            <p className="section-sub">Recommended steps to reduce bias in this dataset.</p>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {correction_suggestions.map((c, i) => (
              <motion.div
                key={i}
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                style={{ padding: '20px 24px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      background: 'var(--surface-2)', width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'IBM Plex Mono', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
                    }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {c.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <span className={`badge badge-${c.priority.toLowerCase()}`}>{c.priority}</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>{c.description}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent-blue)' }}>🔧 <strong>Technique:</strong> {c.technique}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>📈 <strong>Impact:</strong> {c.impact}</span>
                </div>
                {c.code_hint && <div className="code-block">{c.code_hint}</div>}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{
          marginTop: 28, padding: '16px 20px', background: 'var(--surface-2)',
          border: '1px solid var(--border-2)', borderRadius: 'var(--radius)',
          fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.7,
        }}
      >
        <strong style={{ color: 'var(--text-muted)' }}>About:</strong>{' '}
        Statistical Parity, Disparate Impact Ratio (EEOC 80% Rule), Pearson correlation,
        Random Forest feature importance. AI narrative via Gemini (primary), Groq (backup),
        or built-in template fallback when no API keys are configured.
      </motion.div>
    </div>
  );
}
