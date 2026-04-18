import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function WhatIfSimulator({ data }) {
  const { detected_columns, bias_risk_score } = data;
  const sensitive  = detected_columns?.sensitive || [];
  const origScore  = bias_risk_score?.score ?? 0;

  const [scenarios, setScenarios]       = useState([]);
  const [modifications, setMods]        = useState({});
  const [result, setResult]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    axios.get(`${API}/api/simulation/scenarios`)
      .then(r => setScenarios(r.data.scenarios || []))
      .catch(() => {});
  }, []);

  const runSim = async () => {
    if (!Object.keys(modifications).length) {
      setError('Add at least one modification first.');
      return;
    }
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await axios.post(`${API}/api/simulation/what-if`, { modifications });
      setResult(res.data);
    } catch (err) {
      const d = err.response?.data?.detail || err.message;
      setError(typeof d === 'string' ? d : JSON.stringify(d));
    }
    setLoading(false);
  };

  const applyPreset = (s) => { setMods(s.modifications); setResult(null); };

  const toggleRemove = (col) => {
    setMods(prev => {
      const n = { ...prev };
      if (n[col]?.remove) { delete n[col]; } else { n[col] = { remove: true }; }
      return n;
    });
    setResult(null);
  };

  const setRatio = (col, val) => {
    setMods(prev => ({ ...prev, [col]: { ratio: val } }));
    setResult(null);
  };

  const clearMod = (col) => {
    setMods(prev => { const n = { ...prev }; delete n[col]; return n; });
    setResult(null);
  };

  const delta      = result ? result.score_delta        : 0;
  const simScore   = result ? result.simulated_score    : null;
  const improved   = delta > 0;

  return (
    <div>
      <div className="section-header">
        <div className="section-title">What-If Simulator</div>
        <div className="section-sub">Modify dataset attributes and predict how bias metrics change</div>
      </div>

      <div className="two-col" style={{ gap: 22 }}>
        {/* Controls */}
        <div>
          <div className="card">
            <div className="card-title">⚡ Preset Scenarios</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {!scenarios.length && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>}
              {scenarios.map(s => {
                const active = JSON.stringify(modifications) === JSON.stringify(s.modifications);
                return (
                  <button key={s.id} onClick={() => applyPreset(s)} style={{
                    background: active ? 'rgba(88,166,255,0.1)' : 'var(--surface-2)',
                    border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border-2)'}`,
                    borderRadius: 8, padding: '9px 13px', color: 'var(--text)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.14s',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{s.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-title">🔧 Manual Controls</div>
            {sensitive.map(col => (
              <div key={col} style={{ marginBottom: 18, paddingBottom: 16,
                                      borderBottom: '1px solid var(--border-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                               alignItems: 'center', marginBottom: 9 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12,
                                  color: 'var(--accent-orange)', fontWeight: 600 }}>
                    {col}
                  </span>
                  {modifications[col] && (
                    <button onClick={() => clearMod(col)} style={{ background: 'none',
                      border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 11 }}>
                      ✕ clear
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                  {[0.5, 0.4, 0.33].map(r => (
                    <button key={r}
                      onClick={() => setRatio(col, r)}
                      className={modifications[col]?.ratio === r ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 11, padding: '5px 12px' }}>
                      {Math.round(r*100)}/{Math.round((1-r)*100)}
                    </button>
                  ))}
                  <button
                    onClick={() => toggleRemove(col)}
                    className={modifications[col]?.remove ? 'btn-danger' : 'btn-secondary'}
                    style={{ fontSize: 11, padding: '5px 12px' }}>
                    Remove
                  </button>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Custom split: {modifications[col]?.ratio != null
                    ? `${Math.round(modifications[col].ratio*100)} / ${Math.round((1-modifications[col].ratio)*100)}`
                    : '—'}
                </div>
                <input type="range" min={10} max={90} step={5}
                  value={modifications[col]?.ratio != null
                    ? modifications[col].ratio * 100 : 50}
                  onChange={e => setRatio(col, Number(e.target.value)/100)}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
              </div>
            ))}

            {error && (
              <div style={{ color: 'var(--accent-orange)', fontSize: 12, marginBottom: 10 }}>
                ⚠ {error}
              </div>
            )}

            <button className="btn-primary" onClick={runSim}
              disabled={loading} style={{ width: '100%' }}>
              {loading ? '⏳ Running…' : '▶ Run Simulation'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              {/* Score comparison */}
              <div className="card" style={{
                borderColor: improved ? 'rgba(63,185,80,0.35)' : 'rgba(247,129,102,0.35)',
                background:  improved ? 'rgba(63,185,80,0.04)' : 'rgba(247,129,102,0.04)',
              }}>
                <div className="card-title">Simulation Results</div>
                <div style={{ display: 'flex', alignItems: 'center',
                               gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[
                    { label: 'Original',  val: origScore.toFixed(0),  color: 'var(--accent-orange)' },
                    { label: '→',         val: null },
                    { label: 'Simulated', val: simScore?.toFixed(0),
                      color: improved ? 'var(--accent-green)' : 'var(--accent-orange)' },
                  ].map((item, i) => item.val === null ? (
                    <span key={i} style={{ fontSize: 24, color: 'var(--text-muted)' }}>→</span>
                  ) : (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 38,
                                    fontWeight: 700, color: item.color }}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 26, fontWeight: 700,
                                  color: improved ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                      {improved ? '↓' : '↑'} {Math.abs(delta).toFixed(1)} pts
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {improved
                        ? `${result.improvement_percentage}% improvement`
                        : 'Score increased'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Changes applied */}
              <div className="card">
                <div className="card-title">Modifications Applied</div>
                {result.applied_changes?.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, padding: '4px 0',
                                         fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--accent-blue)' }}>✓</span>{c}
                  </div>
                ))}
                <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-subtle)' }}>
                  Simulated: {result.simulated_rows?.toLocaleString()} rows
                </div>
              </div>

              {/* Per-attribute breakdown */}
              {Object.keys(result.attribute_changes || {}).length > 0 && (
                <div className="card">
                  <div className="card-title">Per-Attribute Parity Gap</div>
                  {Object.entries(result.attribute_changes).map(([col, ch]) => (
                    <div key={col} style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11,
                                    color: 'var(--accent-orange)', marginBottom: 7 }}>
                        {col}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { l: 'Before', v: `${ch.original_parity_gap}%`,  c: 'var(--accent-orange)' },
                          { l: 'After',  v: `${ch.simulated_parity_gap}%`, c: 'var(--accent-green)'  },
                          { l: 'Δ',      v: `${ch.improvement > 0 ? '-' : '+'}${Math.abs(ch.improvement).toFixed(1)}%`,
                                         c: ch.improvement > 0 ? 'var(--accent-green)' : 'var(--accent-orange)' },
                        ].map(item => (
                          <div key={item.l} style={{ textAlign: 'center', background: 'var(--surface-2)',
                                                     borderRadius: 7, padding: '9px 14px',
                                                     border: '1px solid var(--border-2)' }}>
                            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 16,
                                          fontWeight: 600, color: item.c }}>{item.v}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                              {item.l}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🔬</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 7 }}>Ready to Simulate</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Choose a preset or configure controls, then run the simulation.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
