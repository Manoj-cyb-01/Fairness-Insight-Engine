import React from 'react';
import { motion } from 'framer-motion';

export default function Sidebar({ sections, active, onSelect, isUnlocked, hasData }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-section-label">Navigation</div>
      {sections.map((s, i) => {
        const unlocked = isUnlocked(s.id);
        return (
          <motion.div
            key={s.id}
            className={`sidebar-nav-item ${active === s.id ? 'active' : ''} ${!unlocked ? 'locked' : ''}`}
            onClick={() => unlocked && onSelect(s.id)}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            title={!unlocked ? 'Upload a dataset first' : s.label}
          >
            <span className="sidebar-icon">{s.icon}</span>
            <span className="sidebar-label">{s.label}</span>
            {active === s.id && (
              <motion.div
                layoutId="activeIndicator"
                style={{
                  position: 'absolute',
                  right: 8,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--accent-blue)'
                }}
              />
            )}
          </motion.div>
        );
      })}
      
      {hasData && (
        <>
          <div className="sidebar-section-label" style={{ marginTop: 16 }}>Status</div>
          <div style={{ padding: '8px 20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--accent-green)',
              fontFamily: 'IBM Plex Mono'
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 4px var(--accent-green)'
              }} />
              Dataset loaded
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
