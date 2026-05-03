import React, { useState, Suspense, lazy } from 'react';
import PdfMerger from './components/PdfMerger';
import ConvertAndMerge from './components/ConvertAndMerge';

// Lazy-load FileConverter since it uses heavy libraries (docx, pdfjs-dist)
// that can fail at import time; this prevents a blank-screen crash.
const FileConverter = lazy(() => import('./components/FileConverter'));

const TABS = [
  { id: 'merge',     label: 'Merge PDFs',       icon: '📄' },
  { id: 'convert',   label: 'Convert & Merge',   icon: '🔄' },
  { id: 'converter', label: 'File Converter',    icon: '⚡' },
];

function LoadingFallback() {
  return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
      <div className="spin" style={{ display: 'inline-block', marginBottom: 12 }}>⏳</div>
      <p>Loading converter…</p>
    </div>
  );
}

function ErrorFallback({ error }) {
  return (
    <div className="fc-error" style={{ margin: '20px 0' }}>
      <p><strong>Failed to load File Converter:</strong></p>
      <pre style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', marginTop: 8 }}>
        {error?.message || 'Unknown error'}
      </pre>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('merge');
  const [sharedFiles, setSharedFiles] = useState([]);

  return (
    <>
      {/* Premium Aurora Background */}
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="glass-container">
        <header className="app-header">
          <div className="logo-container">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="app-logo">
              <path d="M16 6C16 4.89543 16.8954 4 18 4H34C35.1046 4 36 4.89543 36 6V30C36 31.1046 35.1046 32 34 32H18C16.8954 32 16 31.1046 16 30V6Z" fill="url(#paint0_linear)"/>
              <path d="M12 12C12 10.8954 12.8954 10 14 10H30C31.1046 10 32 10.8954 32 12V36C32 37.1046 31.1046 38 30 38H14C12.8954 38 12 37.1046 12 36V12Z" fill="url(#paint1_linear)"/>
              <path d="M18 20H26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M18 26H26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="28" cy="34" r="10" fill="#10b981" />
              <path d="M25 34.5L27 36.5L31.5 31.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="paint0_linear" x1="16" y1="4" x2="36" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8" stopOpacity="0.85"/>
                  <stop offset="1" stopColor="#c084fc" stopOpacity="0.85"/>
                </linearGradient>
                <linearGradient id="paint1_linear" x1="12" y1="10" x2="32" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4f46e5" stopOpacity="0.95"/>
                  <stop offset="1" stopColor="#9333ea" stopOpacity="0.95"/>
                </linearGradient>
              </defs>
            </svg>
            <h1 className="app-title">PDF Manager</h1>
          </div>
          <p className="app-subtitle">Merge, convert, arrange — all formats, all in your browser.</p>
        </header>

      {/* Tab Bar */}
      <div className="tab-bar" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      <main>
        {activeTab === 'merge'     && <PdfMerger files={sharedFiles} setFiles={setSharedFiles} />}
        {activeTab === 'convert'   && <ConvertAndMerge files={sharedFiles} setFiles={setSharedFiles} />}
        {activeTab === 'converter' && (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <FileConverter files={sharedFiles} setFiles={setSharedFiles} />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
    </div>
    </>
  );
}
