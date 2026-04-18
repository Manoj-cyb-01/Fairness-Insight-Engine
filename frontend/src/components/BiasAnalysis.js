import React, { useState } from 'react';
import { motion } from 'framer-motion';

const severityBadge = (sev) => {
  const map = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical' };
  return <span className={`badge ${map[sev] || 'badge-blue'}`}>{sev}</span>;
};

export default function BiasAnalysis({ data }) {
  const {
    bias_risk_score,
    statistical_parity,
    disparate_impact,
    feature_importance,
    ethical_warnings,
    correction_suggestions,
    detected_columns,
  } = data;

  const [tab, setTab] = useState('parity');
  const sensitive = detected_columns?.sensitive || [];
  const score = bias_risk_score?.score ?? 0;
  const riskLevel = bias_risk_score?.risk_level ?? 'Unknown';
  const interpretation = bias_risk_score?.interpretation ?? '';

  const scoreColor =
    score < 25 ? 'var(--accent-green)' :
    score < 50 ? 'var(--accent-blue)' :
    score < 75 ? 'var(--accent-orange)' : '#FF4444';

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Bias Analysis</div>
        <div className="section-sub">Statistical parity, disparate impact, and feature contribution analysis</div>
      </div>

      {/* Score Hero */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${scoreColor}11 0%, transparent 70%), var(--surface)`,
          borderColor: `${scoreColor}44`,
          marginBottom: 24
        }}
      >
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="score-ring-container">
            <div className="score-number-large" style={{ color: scoreColor }}>{score.toFixed(0)}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>/ 100</div>
            <div className="risk-pill" style={{
              background: `${scoreColor}22`,
              color: scoreColor,
              border: `1px solid ${scoreColor}44`
            }}>
              {riskLevel} Risk
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Bias Risk Score</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              {interpretation}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(bias_risk_score?.components || {}).map(([key, val]) => (
                <div key={key} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: scoreColor, fontSize: 18 }}>
                    {val.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {key.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score bar */}
          <div style={{ width: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>Fair</span><span>Biased</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, var(--accent-green), var(--accent-blue), var(--accent-orange), #FF4444)` }}
              />
            </div>
            <div style={{
              marginTop: 4, fontSize: 11,
              color: 'var(--text-muted)',
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Ethical Warnings */}
      {ethical_warnings?.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="card-title">⚠ Ethical Warnings</div>
          {ethical_warnings.map((w, i) => (
            <div key={i} className={`warning-card ${w.level.toLowerCase()}`}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{w.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: w.level === 'CRITICAL' ? '#FF4444' : w.level === 'HIGH' ? 'var(--accent-orange)' : '#FFA657' }}>
                    {w.level}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{w.message}</div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'parity', label: 'Statistical Parity' },
          { id: 'di', label: 'Disparate Impact' },
          { id: 'features', label: 'Feature Importance' },
          { id: 'corrections', label: `Corrections (${correction_suggestions?.length || 0})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-muted)',
              padding: '10px 18px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Statistical Parity Tab */}
      {tab === 'parity' && (
        <motion.div key="parity" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card">
            <div className="card-title">Statistical Parity Analysis</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Measures whether groups receive equal positive outcome rates. A gap &gt;10% indicates potential bias.
            </p>
            {sensitive.map(col => {
              const res = statistical_parity?.[col];
              if (!res) return null;
              return (
                <div key={col} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, color: 'var(--accent-orange)', fontWeight: 600 }}>
                      {col}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {severityBadge(res.severity)}
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Gap: <strong style={{ color: 'var(--text)' }}>{(res.parity_difference * 100).toFixed(2)}%</strong>
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {Object.entries(res.group_positive_rates || {}).map(([group, rate]) => (
                      <div key={group} style={{
                        background: 'var(--surface-2)', borderRadius: 8,
                        padding: '12px 16px', minWidth: 120, textAlign: 'center',
                        border: '1px solid var(--border-2)'
                      }}>
                        <div style={{ fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--accent-blue)' }}>
                          {(rate * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{group}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Disparate Impact Tab */}
      {tab === 'di' && (
        <motion.div key="di" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card">
            <div className="card-title">Disparate Impact (EEOC 80% Rule)</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              A ratio below 0.8 means the least-favored group receives &lt;80% of the positive outcome rate of the best-off group — a regulatory red flag.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Group</th>
                  <th>DI Ratio</th>
                  <th>80% Rule</th>
                </tr>
              </thead>
              <tbody>
                {sensitive.flatMap(col => {
                  const res = disparate_impact?.[col];
                  if (!res?.disparate_impact_ratios) return [];
                  return Object.entries(res.disparate_impact_ratios).map(([group, ratio]) => (
                    <tr key={`${col}-${group}`}>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-orange)' }}>{col}</td>
                      <td>{group}</td>
                      <td>
                        <span style={{
                          fontFamily: 'IBM Plex Mono',
                          color: ratio < 0.8 ? 'var(--accent-orange)' : 'var(--accent-green)',
                          fontWeight: 600
                        }}>{ratio.toFixed(4)}</span>
                      </td>
                      <td>
                        {ratio < 0.8
                          ? <span style={{ color: 'var(--accent-orange)' }}>⚠ Violated</span>
                          : <span style={{ color: 'var(--accent-green)' }}>✓ Compliant</span>
                        }
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Feature Importance Tab */}
      {tab === 'features' && (
        <motion.div key="features" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="card">
            <div className="card-title">Feature Importance (Explainable AI Layer)</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              Random Forest model ranks how much each feature drives outcome decisions.
              <span style={{ color: 'var(--accent-orange)' }}> Orange</span> = sensitive attribute.
            </p>
            {feature_importance?.sensitive_contributions && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(247,129,102,0.08)', borderRadius: 8, borderLeft: '3px solid var(--accent-orange)' }}>
                <div style={{ fontSize: 12, color: 'var(--accent-orange)', fontWeight: 600, marginBottom: 4 }}>
                  Total Sensitive Attribute Impact
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 24, color: 'var(--accent-orange)' }}>
                  {(feature_importance.total_sensitive_impact * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>of model's decision power comes from sensitive attributes</div>
              </div>
            )}
            {Object.entries(feature_importance?.feature_importances || {})
              .sort(([, a], [, b]) => b - a)
              .slice(0, 12)
              .map(([feat, imp]) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 120, fontSize: 12, fontFamily: 'IBM Plex Mono',
                    color: sensitive.includes(feat) ? 'var(--accent-orange)' : 'var(--text-muted)',
                    textAlign: 'right', flexShrink: 0
                  }}>
                    {feat}
                  </div>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${imp * 100 * 4}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        background: sensitive.includes(feat) ? 'var(--accent-orange)' : 'var(--accent-blue)',
                        borderRadius: 3,
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                  <div style={{ width: 50, fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>
                    {(imp * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Corrections Tab */}
      {tab === 'corrections' && (
        <motion.div key="corrections" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {(correction_suggestions || []).map((c, i) => {
            const pColor = { HIGH: 'var(--accent-orange)', MEDIUM: '#FFA657', LOW: 'var(--accent-green)' }[c.priority] || 'var(--text-muted)';
            return (
              <div key={i} className="card" style={{ borderLeft: `3px solid ${pColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {i + 1}. {c.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.description}</div>
                  </div>
                  <span className={`badge badge-${c.priority === 'HIGH' ? 'high' : c.priority === 'MEDIUM' ? 'medium' : 'low'}`}>
                    {c.priority}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Technique: </span>
                    <span style={{ color: 'var(--accent-blue)' }}>{c.technique}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Expected Impact: </span>
                    <span style={{ color: 'var(--accent-green)' }}>{c.impact}</span>
                  </div>
                </div>
                {c.code_hint && <div className="code-block">{c.code_hint}</div>}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
