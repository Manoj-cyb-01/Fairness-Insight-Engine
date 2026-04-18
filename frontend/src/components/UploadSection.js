import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const STEPS = [
  'Parsing CSV structure…',
  'Detecting sensitive attributes…',
  'Running statistical parity analysis…',
  'Computing disparate impact ratios…',
  'Analysing feature correlations…',
  'Calculating Bias Risk Score…',
  'Generating AI insights…',
  'Building visualisations…',
];

export default function UploadSection({ onAnalysisComplete, loading, setLoading, geminiKey }) {
  const [error, setError]       = useState('');
  const [progress, setProgress] = useState('');
  const [stepIdx, setStepIdx]   = useState(0);
  const [fileName, setFileName] = useState('');
  const [success, setSuccess]   = useState(false);
  const fileInputRef            = useRef(null);
  const intervalRef             = useRef(null);

  // ── process uploaded file ──────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }
    setError('');
    setSuccess(false);
    setFileName(file.name);
    setLoading(true);
    setStepIdx(0);
    setProgress(STEPS[0]);

    let i = 0;
    intervalRef.current = setInterval(() => {
      i = Math.min(i + 1, STEPS.length - 1);
      setStepIdx(i);
      setProgress(STEPS[i]);
    }, 900);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers = { 'Content-Type': 'multipart/form-data' };
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey;

      const res = await axios.post(`${API}/api/analysis/upload`, formData, { headers });
      clearInterval(intervalRef.current);
      setProgress('Analysis complete ✓');
      setSuccess(true);
      setTimeout(() => {
        setLoading(false);
        onAnalysisComplete(res.data);
      }, 700);
    } catch (err) {
      clearInterval(intervalRef.current);
      setLoading(false);
      setProgress('');
      const detail = err.response?.data?.detail || err.message || 'Upload failed — is the backend running?';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  }, [geminiKey, onAnalysisComplete, setLoading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop:   (files) => files[0] && processFile(files[0]),
    accept:   { 'text/csv': ['.csv'], 'application/octet-stream': ['.csv'] },
    multiple: false,
    disabled: loading,
    noClick:  true,   // Click handled manually so the button works reliably
  });

  // ── "Select CSV File" button — opens native picker directly ───────────────
  const openPicker = (e) => {
    e.stopPropagation();
    if (loading) return;
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';  // reset so same file can be re-uploaded
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Upload Dataset</div>
        <div className="section-sub">
          Drop a CSV file or click <em>Select CSV File</em> — analysis runs automatically.
          AI insights use Gemini (key optional), with Groq and template fallbacks built in.
        </div>
      </div>

      {/* Drop zone */}
      <motion.div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'dragover' : ''} ${success ? 'success' : ''}`}
        onClick={() => { if (!loading) fileInputRef.current?.click(); }}
        whileHover={!loading ? { scale: 1.004 } : {}}
        style={{ cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.82 : 1 }}
      >
        {/* Hidden native file input */}
        <input
          {...getInputProps()}
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={onFileInputChange}
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="spinner" style={{ margin: '0 auto 20px' }} />
              <div className="upload-title" style={{ color: 'var(--accent-blue)', fontSize: 16 }}>
                {fileName}
              </div>
              {/* Step progress bar */}
              <div style={{ width: 260, margin: '14px auto 0', background: 'var(--border)', height: 3, borderRadius: 2 }}>
                <motion.div
                  animate={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  style={{ height: '100%', background: 'var(--accent-purple)', borderRadius: 2 }}
                />
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent-purple)', marginTop: 10, minHeight: 18 }}>
                {progress}
              </div>
            </motion.div>
          ) : success ? (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div className="upload-title" style={{ color: 'var(--accent-green)' }}>
                Analysis Complete
              </div>
              <div className="upload-sub">{fileName}</div>
            </motion.div>
          ) : (
            <motion.div key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="upload-icon">{isDragActive ? '📂' : '📁'}</div>
              <div className="upload-title">
                {isDragActive ? 'Drop it here' : 'Drop your CSV file'}
              </div>
              <div className="upload-sub">or use the button below — analysis starts automatically</div>
              <button
                className="btn-primary"
                onClick={openPicker}
                type="button"
                style={{ pointerEvents: 'all' }}
              >
                Select CSV File
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              marginTop: 14, padding: '12px 16px',
              background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)',
              borderRadius: 8, color: '#FF6B6B', fontSize: 13, lineHeight: 1.6,
            }}
          >
            <strong>⚠ Error:</strong> {error}
            <button
              onClick={() => setError('')}
              style={{ marginLeft: 12, background: 'none', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            >×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature grid */}
      <div className="three-col" style={{ marginTop: 32 }}>
        {[
          { icon: '🔍', title: 'Auto-Detection',    desc: 'Sensitive attributes detected by semantic keyword matching' },
          { icon: '⚡', title: 'Instant Analysis',  desc: 'Full bias pipeline runs immediately — no config needed' },
          { icon: '🤖', title: 'AI Insights',       desc: 'Gemini primary, Groq backup, template fallback — always returns results' },
          { icon: '📊', title: 'Visualisations',    desc: 'Interactive Plotly charts, heatmaps, and risk gauges' },
          { icon: '🔬', title: 'What-If Simulator', desc: 'Simulate how dataset changes affect the Bias Risk Score' },
          { icon: '📄', title: 'Audit Report',      desc: 'Downloadable professional HTML report with all findings' },
        ].map((f, i) => (
          <motion.div key={i} className="card"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06 }}
            style={{ padding: '18px', marginBottom: 0 }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>{f.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>{f.desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Sample data tip */}
      <div className="card" style={{ marginTop: 22, background: 'rgba(88,166,255,0.04)', borderColor: 'rgba(88,166,255,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, marginTop: 1 }}>💡</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Sample Dataset Included</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Try{' '}
              <code style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent-blue)', fontSize: 11 }}>
                sample_data/hiring_dataset.csv
              </code>
              {' '}— a hiring dataset demonstrating gender &amp; race bias across 40 rows.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
