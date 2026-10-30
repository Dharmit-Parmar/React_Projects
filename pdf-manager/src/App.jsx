import React, { useState, Suspense, lazy } from 'react';
import {
  Files,
  Layers,
  ArrowLeftRight,
  FileSignature,
  FileText,
  Sparkles,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import PdfMerger from './components/PdfMerger';
import ConvertAndMerge from './components/ConvertAndMerge';
import PdfEditor from './components/PdfEditor';

// Lazy-load heavier components to optimize initial load
const FileConverter = lazy(() => import('./components/FileConverter'));
const ImageEnhancer = lazy(() => import('./components/ImageEnhancer'));
const WordEditor = lazy(() => import('./components/WordEditor'));

const TABS = [
  { id: 'merge',     label: 'Merge PDFs',        icon: Files,          desc: 'Reorder & bind documents' },
  { id: 'convert',   label: 'Convert & Merge',   icon: Layers,         desc: 'Harmonize multi-format batches' },
  { id: 'converter', label: 'File Converter',    icon: ArrowLeftRight, desc: 'Universal file format matrix' },
  { id: 'editor',    label: 'Edit PDF',          icon: FileSignature,  desc: 'In-place text & signatures' },
  { id: 'word',      label: 'Word Editor',       icon: FileText,       desc: 'Rich document flow authoring' },
  { id: 'enhancer',  label: 'Image Enhancer',    icon: Sparkles,       desc: 'Pure Rust super-resolution' },
];

function LoadingFallback() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
      <div className="workspace-spinner" style={{ margin: '0 auto 16px' }} />
      <p style={{ fontSize: '0.86rem', letterSpacing: '0.02em' }}>Initializing studio workspace…</p>
    </div>
  );
}

function ErrorFallback({ error }) {
  return (
    <div className="fc-error" style={{ margin: '20px 0', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
      <p><strong>Failed to load component:</strong></p>
      <pre style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap', marginTop: 8 }}>
        {error?.message || 'Unknown error'}
      </pre>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('merge');
  const [sharedFiles, setSharedFiles] = useState([]);

  const currentTabObj = TABS.find(t => t.id === activeTab) || TABS[0];
  const CurrentIcon = currentTabObj.icon;

  return (
    <div className="app-canvas">
      {/* Studio Background Grid (Ultra-lightweight, 0 GPU repaints) */}
      <div className="studio-grid" />

      <div className="workspace-shell">
        {/* Architectural Top Bar */}
        <header className="workspace-header">
          <div className="header-brand">
            <div className="brand-mark">
              <Files size={20} strokeWidth={1.75} color="#f8fafc" />
            </div>
            <div>
              <div className="brand-title">PDF Studio</div>
              <div className="brand-subtitle">Standalone Document & Media Processing</div>
            </div>
          </div>

          <div className="engine-status-pill">
            <Cpu size={14} strokeWidth={1.75} color="#38bdf8" />
            <span>Rust Axum Microservice</span>
            <span className="status-dot" />
          </div>
        </header>

        {/* Studio Navigation Bar */}
        <nav className="studio-nav" role="tablist" aria-label="Processing Tools">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} strokeWidth={1.75} className="nav-icon" />
                <span className="nav-label">{tab.label}</span>
                {isActive && <span className="nav-active-pip" />}
              </button>
            );
          })}
        </nav>

        {/* Tool Header Context Bar */}
        <div className="tool-context-bar">
          <div className="tool-context-left">
            <div className="tool-icon-wrap">
              <CurrentIcon size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="tool-heading">{currentTabObj.label}</h2>
              <p className="tool-subheading">{currentTabObj.desc}</p>
            </div>
          </div>
          <div className="tool-context-badge">
            <ShieldCheck size={13} strokeWidth={1.75} />
            <span>Client & Local Sandboxed</span>
          </div>
        </div>

        {/* Active Tool Main Canvas */}
        <main className="tool-canvas">
          {activeTab === 'merge'     && <PdfMerger files={sharedFiles} setFiles={setSharedFiles} />}
          {activeTab === 'convert'   && <ConvertAndMerge files={sharedFiles} setFiles={setSharedFiles} />}
          {activeTab === 'editor'    && <PdfEditor files={sharedFiles} setFiles={setSharedFiles} />}
          {activeTab === 'word'      && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <WordEditor />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'converter' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <FileConverter files={sharedFiles} setFiles={setSharedFiles} />
              </Suspense>
            </ErrorBoundary>
          )}
          {activeTab === 'enhancer' && (
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <ImageEnhancer />
              </Suspense>
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
