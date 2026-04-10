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

  return (
    <div className="glass-container">
      <header className="app-header">
        <h1 className="app-title">PDF Manager</h1>
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
        {activeTab === 'merge'     && <PdfMerger />}
        {activeTab === 'convert'   && <ConvertAndMerge />}
        {activeTab === 'converter' && (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <FileConverter />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
