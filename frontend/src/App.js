import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadSection from './components/UploadSection';
import DataOverview from './components/DataOverview';
import BiasAnalysis from './components/BiasAnalysis';
import VisualizationPanel from './components/VisualizationPanel';
import AIInsights from './components/AIInsights';
import ReportSection from './components/ReportSection';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import WhatIfSimulator from './components/WhatIfSimulator';
import './App.css';

const SECTIONS = [
  { id: 'upload', label: 'Upload', icon: '⬆' },
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'bias', label: 'Bias Analysis', icon: '⚖' },
  { id: 'viz', label: 'Visualizations', icon: '📈' },
  { id: 'insights', label: 'AI Insights', icon: '🤖' },
  { id: 'simulator', label: 'What-If', icon: '🔬' },
  { id: 'report', label: 'Report', icon: '📄' },
];

export default function App() {
  const [activeSection, setActiveSection] = useState('upload');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [autoFixData, setAutoFixData] = useState(null);

  const handleAnalysisComplete = useCallback((data) => {
    setAnalysisData(data);
    setActiveSection('overview');
  }, []);

  const isUnlocked = (sectionId) => {
    if (sectionId === 'upload') return true;
    return analysisData !== null;
  };

  return (
    <div className="app">
      <Header geminiKey={geminiKey} setGeminiKey={setGeminiKey} />
      
      <div className="app-body">
        <Sidebar 
          sections={SECTIONS} 
          active={activeSection} 
          onSelect={setActiveSection}
          isUnlocked={isUnlocked}
          hasData={!!analysisData}
        />
        
        <main className="main-content">
          <AnimatePresence mode="wait">
            {activeSection === 'upload' && (
              <motion.div key="upload" {...fadeProps}>
                <UploadSection 
                  onAnalysisComplete={handleAnalysisComplete}
                  loading={loading}
                  setLoading={setLoading}
                  geminiKey={geminiKey}
                />
              </motion.div>
            )}
            
            {activeSection === 'overview' && analysisData && (
              <motion.div key="overview" {...fadeProps}>
                <DataOverview data={analysisData} />
              </motion.div>
            )}
            
            {activeSection === 'bias' && analysisData && (
              <motion.div key="bias" {...fadeProps}>
                <BiasAnalysis data={analysisData} />
              </motion.div>
            )}
            
            {activeSection === 'viz' && analysisData && (
              <motion.div key="viz" {...fadeProps}>
                <VisualizationPanel data={analysisData} autoFixData={autoFixData} />
              </motion.div>
            )}
            
            {activeSection === 'insights' && analysisData && (
              <motion.div key="insights" {...fadeProps}>
                <AIInsights data={analysisData} />
              </motion.div>
            )}
            
            {activeSection === 'simulator' && analysisData && (
              <motion.div key="simulator" {...fadeProps}>
                <WhatIfSimulator data={analysisData} geminiKey={geminiKey} />
              </motion.div>
            )}
            
            {activeSection === 'report' && analysisData && (
              <motion.div key="report" {...fadeProps}>
                <ReportSection data={analysisData} geminiKey={geminiKey} setAutoFixData={setAutoFixData} />
              </motion.div>
            )}
            
            {activeSection !== 'upload' && !analysisData && (
              <motion.div key="locked" {...fadeProps} className="locked-state">
                <div className="locked-content">
                  <span className="locked-icon">🔒</span>
                  <h2>Upload a dataset first</h2>
                  <p>Navigate to the Upload section to get started.</p>
                  <button className="btn-primary" onClick={() => setActiveSection('upload')}>
                    Go to Upload
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

const fadeProps = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: 'easeOut' }
};
