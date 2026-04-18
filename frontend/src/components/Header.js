import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function Header({ geminiKey, setGeminiKey }) {
  const [show, setShow] = useState(false);

  return (
    <header className="header">
      <motion.div className="header-logo"
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <span style={{ fontSize: 19 }}>⚖</span>
        <span>
          Unbiased
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> AI</span>
        </span>
        <div style={{
          fontSize: 9, background: 'rgba(88,166,255,0.14)', color: 'var(--accent-blue)',
          padding: '2px 8px', borderRadius: 20,
          fontFamily: 'IBM Plex Mono, monospace', letterSpacing: 1,
        }}>
          DECISION SYSTEM
        </div>
      </motion.div>

      <motion.div className="header-right"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>

        {/*
          Gemini API key — sent as X-Gemini-Key request header, never in the URL.
          Falls back to Groq (GROQ_API_KEY env var) then to template responses when omitted.
        */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap',
          }}>
            GEMINI KEY
          </span>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              className="api-key-input"
              placeholder="AIza… (optional)"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              title="Gemini API key — sent as X-Gemini-Key header. Falls back to Groq then template."
            />
            <button
              onClick={() => setShow(s => !s)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
              }}
            >
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {geminiKey && (
            <div
              title="Gemini key set — AI insights enabled"
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 5px var(--accent-green)', flexShrink: 0,
              }}
            />
          )}
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--border)' }} />

        <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'IBM Plex Mono' }}>
          v1.1.0
        </span>
      </motion.div>
    </header>
  );
}
