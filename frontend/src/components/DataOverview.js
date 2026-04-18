import React from 'react';
import { motion } from 'framer-motion';

export default function DataOverview({ data }) {
  const { validation, detected_columns, preview, filename } = data;
  const { rows, columns, duplicate_rows, missing_values, issues } = validation;
  const { sensitive, targets } = detected_columns;

  const missingCols = Object.entries(missing_values || {}).filter(([, v]) => v > 0);

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Data Overview</div>
        <div className="section-sub">
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--accent-blue)' }}>{filename}</span>
          {' '}— schema auto-detected
        </div>
      </div>

      {/* Key stats */}
      <div className="stat-grid">
        {[
          { label: 'Total Rows', value: rows?.toLocaleString(), color: 'var(--accent-blue)' },
          { label: 'Columns', value: columns, color: 'var(--accent-purple)' },
          { label: 'Duplicate Rows', value: duplicate_rows, color: duplicate_rows > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' },
          { label: 'Missing Values', value: missingCols.length, color: missingCols.length > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' },
          { label: 'Sensitive Attrs', value: sensitive.length, color: 'var(--accent-gold)' },
          { label: 'Target Variables', value: targets.length, color: 'var(--accent-green)' },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="stat-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Detected columns */}
      <div className="two-col">
        <div className="card">
          <div className="card-title">🛡 Detected Sensitive Attributes</div>
          {sensitive.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>None auto-detected.</div>
          ) : (
            sensitive.map(col => (
              <div key={col} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--border-2)'
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent-orange)', flexShrink: 0
                }} />
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--accent-orange)' }}>{col}</span>
                <span className="badge badge-high" style={{ marginLeft: 'auto' }}>Protected</span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-title">🎯 Detected Target Variables</div>
          {targets.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>None auto-detected.</div>
          ) : (
            targets.map(col => (
              <div key={col} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--border-2)'
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent-blue)', flexShrink: 0
                }} />
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--accent-blue)' }}>{col}</span>
                <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>Outcome</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Issues */}
      {issues && issues.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(255,166,87,0.3)' }}>
          <div className="card-title">⚠ Data Quality Issues</div>
          {issues.map((issue, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '6px 0',
              color: 'var(--text-muted)', fontSize: 13
            }}>
              <span style={{ color: '#FFA657' }}>›</span> {issue}
            </div>
          ))}
        </div>
      )}

      {/* Missing values */}
      {missingCols.length > 0 && (
        <div className="card">
          <div className="card-title">Missing Values by Column</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Missing Count</th>
                <th>% Missing</th>
              </tr>
            </thead>
            <tbody>
              {missingCols.map(([col, count]) => (
                <tr key={col}>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 12 }}>{col}</td>
                  <td style={{ color: 'var(--accent-orange)' }}>{count}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        height: 4, width: 80, background: 'var(--border)',
                        borderRadius: 2, overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min((count / rows) * 100, 100)}%`,
                          background: 'var(--accent-orange)',
                          borderRadius: 2
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {((count / rows) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Data preview */}
      {preview && (
        <div className="card">
          <div className="card-title">Data Preview (First 10 Rows)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {preview.columns.map(col => (
                    <th key={col} style={{
                      color: sensitive.includes(col) ? 'var(--accent-orange)' :
                        targets.includes(col) ? 'var(--accent-blue)' : 'var(--text-muted)'
                    }}>
                      {sensitive.includes(col) && '🛡 '}{targets.includes(col) && '🎯 '}{col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {preview.columns.map(col => (
                      <td key={col} style={{
                        fontFamily: 'IBM Plex Mono', fontSize: 11,
                        color: sensitive.includes(col) ? 'var(--accent-orange)' :
                          targets.includes(col) ? 'var(--accent-blue)' : 'var(--text)'
                      }}>
                        {String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
