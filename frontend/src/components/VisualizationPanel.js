import React, { useState, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';

// Dynamic import so bundle doesn't bloat on first load
const Plot = lazy(() => import('react-plotly.js'));

const DARK = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font:  { color: '#E6EDF3', family: 'IBM Plex Mono, monospace', size: 11 },
  xaxis: { gridcolor: '#30363D', linecolor: '#30363D', zerolinecolor: '#30363D',
           tickfont: { color: '#8B949E' } },
  yaxis: { gridcolor: '#30363D', linecolor: '#30363D', zerolinecolor: '#30363D',
           tickfont: { color: '#8B949E' } },
};

function ChartCard({ title, chartData, height = 360 }) {
  if (!chartData) return null;
  try {
    const fig = typeof chartData === 'string' ? JSON.parse(chartData) : chartData;
    // Merge dark overrides WITHOUT clobbering per-chart axis settings
    const layout = {
      ...fig.layout,
      paper_bgcolor: DARK.paper_bgcolor,
      plot_bgcolor:  DARK.plot_bgcolor,
      font:          { ...DARK.font, ...fig.layout?.font },
      height:        fig.layout?.height || height,
      margin:        fig.layout?.margin || { t: 55, b: 50, l: 60, r: 30 },
      xaxis:         { ...DARK.xaxis, ...(fig.layout?.xaxis || {}) },
      yaxis:         { ...DARK.yaxis, ...(fig.layout?.yaxis || {}) },
    };
    return (
      <div className="card" style={{ padding: '18px 14px', overflow: 'hidden' }}>
        {title && <div className="card-title">{title}</div>}
        <Suspense fallback={
          <div style={{ height: layout.height, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading chart…
          </div>
        }>
          <Plot
            data={fig.data}
            layout={layout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </Suspense>
      </div>
    );
  } catch (e) {
    return (
      <div className="card">
        <div style={{ color: 'var(--accent-orange)', fontSize: 12 }}>
          Chart render error: {String(e)}
        </div>
      </div>
    );
  }
}

const TABS = [
  { id: 'gauge',       label: 'Risk Gauge' },
  { id: 'dist',        label: 'Distributions' },
  { id: 'bias',        label: 'Bias Rates' },
  { id: 'di',          label: 'Disparate Impact' },
  { id: 'heatmap',     label: 'Correlation Heatmap' },
  { id: 'features',    label: 'Feature Importance' },
  { id: 'beforeafter', label: 'Before vs After' },
];

export default function VisualizationPanel({ data, autoFixData }) {
  const { charts, detected_columns } = data;
  const sensitive = detected_columns?.sensitive || [];
  const [tab, setTab] = useState('gauge');

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Visualization Panel</div>
        <div className="section-sub">Hover for details · scroll to zoom · drag to pan</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, overflowX: 'auto',
                    borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => {
          const disabled = t.id === 'beforeafter' && !autoFixData?.before_after_chart;
          return (
            <button key={t.id} onClick={() => !disabled && setTab(t.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--accent-purple)' : '2px solid transparent',
                color: tab === t.id ? 'var(--accent-purple)' :
                       disabled ? 'var(--text-subtle)' : 'var(--text-muted)',
                padding: '9px 15px', cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
                transition: 'all 0.15s', marginBottom: -1, whiteSpace: 'nowrap',
              }}>
              {t.label}
              {t.id === 'beforeafter' && !autoFixData?.before_after_chart &&
                <span style={{ fontSize: 9, marginLeft: 5, opacity: 0.5 }}>(run auto-fix)</span>}
            </button>
          );
        })}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}>

        {tab === 'gauge' && (
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <ChartCard chartData={charts?.risk_gauge} height={300} />
          </div>
        )}

        {tab === 'dist' && (
          <div className="two-col">
            {sensitive.map(col =>
              charts?.distributions?.[col]
                ? <ChartCard key={col} title={`Distribution: ${col}`}
                             chartData={charts.distributions[col]} height={295} />
                : null
            )}
            {sensitive.every(c => !charts?.distributions?.[c]) && (
              <div className="card"><div style={{ color: 'var(--text-muted)' }}>
                No distribution data.
              </div></div>
            )}
          </div>
        )}

        {tab === 'bias' && (
          <div>
            {sensitive.map(col =>
              charts?.bias_distribution?.[col]
                ? <ChartCard key={col} chartData={charts.bias_distribution[col]} height={360} />
                : null
            )}
          </div>
        )}

        {tab === 'di' && (
          <div>
            {sensitive.map(col =>
              charts?.disparate_impact?.[col]
                ? <ChartCard key={col} chartData={charts.disparate_impact[col]} height={320} />
                : null
            )}
          </div>
        )}

        {tab === 'heatmap' && charts?.correlation_heatmap && (
          <ChartCard chartData={charts.correlation_heatmap} height={500} />
        )}

        {tab === 'features' && charts?.feature_importance && (
          <ChartCard chartData={charts.feature_importance} height={430} />
        )}

        {tab === 'beforeafter' && autoFixData?.before_after_chart && (
          <ChartCard title="Parity Gap — Before vs After Auto-Fix"
                     chartData={autoFixData.before_after_chart} height={390} />
        )}

      </motion.div>
    </div>
  );
}
