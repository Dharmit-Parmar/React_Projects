import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles, Download, ImageIcon, RefreshCw, ZoomIn, ZoomOut,
  Maximize2, SplitSquareVertical, Columns, AlertCircle, FileImage, Check
} from 'lucide-react';
import { useImageProcessor } from '../hooks/useImageProcessor';

export default function ImageEnhancer() {
  const {
    file,
    previewUrl,
    enhancedUrl,
    setEnhancedUrl,
    enhancedRef,
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    error,
    setError,
    origInfo,
    enhInfo,
    setEnhInfo,
    loadFile,
    reset,
  } = useImageProcessor();

  // Settings: Simple, Ponytail-style
  const [scale, setScale] = useState('2x'); // '1x' | '2x' | '4x'
  const [customFilename, setCustomFilename] = useState('');

  // Comparison controls
  const [comparisonMode, setComparisonMode] = useState('split'); // 'split' | 'side'
  const [sliderPos, setSliderPos] = useState(50);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit, 2 = 100% actual pixels, 3 = 200%

  const origContainerRef = useRef(null);
  const enhContainerRef = useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      const selected = acceptedFiles[0];
      if (selected.type.startsWith('image/')) {
        loadFile(selected);
        const base = selected.name.replace(/\.[^/.]+$/, '');
        setCustomFilename(`${base}_enhanced`);
      } else {
        setError('Please drop a valid image file (JPG, PNG, WebP).');
      }
    }
  }, [loadFile, setError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleEnhance = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(10);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('scale', scale);
    formData.append('preset', 'wallpaper');
    formData.append('sharpness', '75');
    formData.append('denoise', '15');
    formData.append('clarity', '50');
    formData.append('format', 'auto');
    formData.append('quality', '95');

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + 10;
        if (prev < 80) return prev + 6;
        if (prev < 95) return prev + 2;
        return prev;
      });
    }, 250);

    try {
      const response = await fetch('/api/enhance-image', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);
      setProgress(100);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to enhance image on backend.');
      }

      const blob = await response.blob();
      if (enhancedRef.current) URL.revokeObjectURL(enhancedRef.current);

      const objectUrl = URL.createObjectURL(blob);
      enhancedRef.current = objectUrl;
      setEnhancedUrl(objectUrl);

      const img = new Image();
      img.onload = () => {
        setEnhInfo({
          width: img.width,
          height: img.height,
          bytes: blob.size,
        });
      };
      img.src = objectUrl;

      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const base = file.name.replace(/\.[^/.]+$/, '');
      setCustomFilename(`${base}_${scale}_enhanced.${ext}`);

    } catch (err) {
      clearInterval(progressTimer);
      console.error(err);
      setError('Enhancement error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedUrl) return;
    const a = document.createElement('a');
    a.href = enhancedUrl;
    a.download = customFilename.trim() || 'enhanced-image.jpg';
    a.click();
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  // Synchronized scroll in 100% actual size side-by-side mode
  const handleScroll = (source) => {
    if (zoomLevel === 1) return;
    if (source === 'orig' && origContainerRef.current && enhContainerRef.current) {
      enhContainerRef.current.scrollTop = origContainerRef.current.scrollTop * (scale === '4x' ? 4 : scale === '2x' ? 2 : 1);
      enhContainerRef.current.scrollLeft = origContainerRef.current.scrollLeft * (scale === '4x' ? 4 : scale === '2x' ? 2 : 1);
    }
  };

  return (
    <div className="fc-wrapper" style={{ maxWidth: '1050px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div className="fc-header-strip" style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} className="warn-text" />
          <span style={{ fontWeight: 600 }}>Pure Rust Ultra HD Image Enhancer & Upscaler</span>
        </div>
        <span style={{ fontSize: '0.74rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
          High Speed • High Fidelity
        </span>
      </div>

      {/* Upload Dropzone */}
      {!previewUrl && (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`} style={{ padding: '48px 24px' }}>
          <input {...getInputProps()} />
          <ImageIcon size={48} className="dropzone-icon" color="#3b82f6" />
          <div className="dropzone-text" style={{ fontSize: '1.1rem', marginTop: '12px', fontWeight: 600 }}>
            {isDragActive ? 'Drop image here...' : 'Drag and drop your photo or wallpaper here'}
          </div>
          <div className="dropzone-subtext" style={{ marginTop: '6px', color: '#94a3b8' }}>
            Supports JPG, PNG, and WebP images of any resolution
          </div>
        </div>
      )}

      {/* Active File Card */}
      {previewUrl && (
        <div className="fc-file-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div className="fc-file-icon" style={{ background: 'rgba(37, 99, 235, 0.12)', padding: '10px', borderRadius: '8px' }}>
              <FileImage size={24} color="#3b82f6" />
            </div>
            <div className="fc-file-info" style={{ minWidth: 0 }}>
              <div className="fc-file-name" style={{ fontWeight: 600, color: '#f8fafc' }}>{file?.name}</div>
              <div className="fc-file-size" style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                {origInfo.width > 0 && `${origInfo.width} × ${origInfo.height} px`} • {formatSize(origInfo.bytes)}
              </div>
            </div>
          </div>
          <button
            className="remove-btn"
            onClick={reset}
            disabled={isProcessing}
            title="Upload different image"
            style={{ padding: '6px 14px', fontSize: '0.84rem' }}
          >
            Change Image
          </button>
        </div>
      )}

      {error && (
        <div className="fc-error" style={{ marginBottom: '16px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Upscale Controls (Before Enhancement) */}
      {previewUrl && !isProcessing && !enhancedUrl && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '14px' }}>
            Select Desired Upscale Level:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { id: '2x', label: '2× Ultra HD', badge: 'Recommended', desc: 'Doubles width & height (4× total pixels). Crisp details, fast processing.' },
              { id: '4x', label: '4× Cinema 4K/8K', badge: 'Maximum', desc: 'Quadruples resolution (16× total pixels). Ideal for large wallpaper displays.' },
              { id: '1x', label: '1× Smart Enhance', badge: 'Same Size', desc: 'Enhances edge clarity and micro-contrast without increasing pixel dimensions.' },
            ].map(opt => {
              const isSelected = scale === opt.id;
              const targetW = origInfo.width * (opt.id === '4x' ? 4 : opt.id === '2x' ? 2 : 1);
              const targetH = origInfo.height * (opt.id === '4x' ? 4 : opt.id === '2x' ? 2 : 1);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScale(opt.id)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isSelected ? '#2563eb' : 'rgba(255,255,255,0.08)'}`,
                    background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isSelected ? '#fff' : '#cbd5e1' }}>{opt.label}</span>
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600 }}>
                      {opt.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.35, marginBottom: '8px' }}>
                    {opt.desc}
                  </div>
                  {origInfo.width > 0 && (
                    <div style={{ fontSize: '0.72rem', color: isSelected ? '#93c5fd' : '#64748b', fontWeight: 600 }}>
                      Output: {targetW} × {targetH} px
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={handleEnhance}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={18} />
              Enhance & Upscale Now ({scale})
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', margin: '20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.86rem' }}>
            <span style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="warn-text" />
              Upscaling and enhancing image in pure Rust...
            </span>
            <span style={{ fontWeight: 700, color: '#3b82f6' }}>{progress}%</span>
          </div>
          <div className="fc-progress-track" style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div
              className="fc-progress-bar"
              style={{
                width: `${progress}%`,
                height: '100%',
                background: '#2563eb',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Comparison Suite (When Enhanced) */}
      {previewUrl && enhancedUrl && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          
          {/* Controls Bar: Mode Switcher + Zoom Level */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setComparisonMode('split')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: comparisonMode === 'split' ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  color: comparisonMode === 'split' ? '#fff' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <SplitSquareVertical size={15} />
                Split Wipe Slider
              </button>

              <button
                type="button"
                onClick={() => setComparisonMode('side')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: comparisonMode === 'side' ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  color: comparisonMode === 'side' ? '#fff' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Columns size={15} />
                Side-by-Side Dual View
              </button>
            </div>

            {/* View Magnification: Fit vs 100% Actual Pixels */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Inspection View:</span>
              {[
                { level: 1, label: 'Fit to Screen' },
                { level: 2, label: '100% Actual Pixels' },
                { level: 3, label: '200% Zoom' },
              ].map(z => (
                <button
                  key={z.level}
                  type="button"
                  onClick={() => setZoomLevel(z.level)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: zoomLevel === z.level ? 'rgba(37, 99, 235, 0.25)' : 'rgba(0,0,0,0.2)',
                    color: zoomLevel === z.level ? '#fff' : '#94a3b8',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          {/* VIEW 1: Split Wipe Slider */}
          {comparisonMode === 'split' && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxHeight: zoomLevel === 1 ? '600px' : 'none',
                overflow: zoomLevel === 1 ? 'hidden' : 'auto',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: '#0a0a0c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ position: 'relative', width: zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%` }}>
                {/* Enhanced Image (Background) */}
                <img
                  src={enhancedUrl}
                  alt="Enhanced"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    maxHeight: zoomLevel === 1 ? '600px' : 'none',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                  draggable={false}
                />

                {/* Original Image (Foreground with Clip) */}
                <img
                  src={previewUrl}
                  alt="Original"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                    pointerEvents: 'none',
                  }}
                  draggable={false}
                />

                {/* Interactive Slider Input */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => setSliderPos(parseFloat(e.target.value))}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'ew-resize',
                    margin: 0,
                    zIndex: 10,
                  }}
                />

                {/* Dividing Line & Center Handle */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${sliderPos}%`,
                    width: '2px',
                    background: '#fff',
                    pointerEvents: 'none',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                    zIndex: 5,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '32px',
                      height: '32px',
                      background: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                      color: '#2563eb',
                    }}
                  >
                    <SplitSquareVertical size={16} />
                  </div>
                </div>

                {/* Labels */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.75)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', color: '#fff', pointerEvents: 'none', zIndex: 6 }}>
                  Original: {origInfo.width} × {origInfo.height} px
                </div>
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(34, 197, 94, 0.85)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', color: '#fff', pointerEvents: 'none', zIndex: 6, fontWeight: 700 }}>
                  Enhanced: {enhInfo.width} × {enhInfo.height} px
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Side-by-Side Dual View */}
          {comparisonMode === 'side' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Left Column: Original Image */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0c' }}>
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '0.82rem' }}>Original Image</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px' }}>
                    {origInfo.width} × {origInfo.height} px ({formatSize(origInfo.bytes)})
                  </span>
                </div>
                <div
                  ref={origContainerRef}
                  onScroll={() => handleScroll('orig')}
                  style={{
                    padding: '12px',
                    maxHeight: zoomLevel === 1 ? '480px' : '520px',
                    overflow: zoomLevel === 1 ? 'hidden' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Original Image"
                    style={{
                      width: zoomLevel === 1 ? '100%' : `${origInfo.width * (zoomLevel === 3 ? 2 : 1)}px`,
                      maxHeight: zoomLevel === 1 ? '450px' : 'none',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      display: 'block',
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Enhanced Image */}
              <div style={{ border: '1.5px solid rgba(37, 99, 235, 0.4)', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0c' }}>
                <div style={{ padding: '10px 14px', background: 'rgba(37, 99, 235, 0.08)', borderBottom: '1px solid rgba(37, 99, 235, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#93c5fd', fontSize: '0.82rem' }}>Ultra HD Enhanced ({scale})</span>
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>
                    {enhInfo.width} × {enhInfo.height} px ({formatSize(enhInfo.bytes)})
                  </span>
                </div>
                <div
                  ref={enhContainerRef}
                  style={{
                    padding: '12px',
                    maxHeight: zoomLevel === 1 ? '480px' : '520px',
                    overflow: zoomLevel === 1 ? 'hidden' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={enhancedUrl}
                    alt="Enhanced Image"
                    style={{
                      width: zoomLevel === 1 ? '100%' : `${enhInfo.width * (zoomLevel === 3 ? 0.5 : 0.25) * (zoomLevel === 3 ? 2 : 1)}px`,
                      maxHeight: zoomLevel === 1 ? '450px' : 'none',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Clean Technical Resolution Metrics Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '16px',
              padding: '14px 18px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Original Image</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {origInfo.width} × {origInfo.height} px
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{formatSize(origInfo.bytes)}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Enhanced Resolution</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4ade80', marginTop: '2px' }}>
                {enhInfo.width} × {enhInfo.height} px
              </div>
              <div style={{ fontSize: '0.74rem', color: '#93c5fd' }}>{formatSize(enhInfo.bytes)}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pixel Increase</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#3b82f6', marginTop: '2px' }}>
                {origInfo.width > 0 && ((enhInfo.width * enhInfo.height) / (origInfo.width * origInfo.height)).toFixed(0)}× Resolution
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {((enhInfo.width * enhInfo.height) / 1000000).toFixed(1)} Megapixels
              </div>
            </div>
          </div>

          {/* Download & Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>File Name:</label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.84rem',
                  outline: 'none',
                  flex: 1,
                  maxWidth: '360px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setEnhancedUrl(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#cbd5e1',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} />
                Try Another Scale
              </button>

              <button
                className="btn-primary"
                onClick={handleDownload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Download size={16} />
                Download Enhanced Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
