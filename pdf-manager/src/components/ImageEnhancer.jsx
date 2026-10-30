import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Sparkles, Download, ArrowRight, ImageIcon, Sliders, Eye,
  Maximize2, ZoomIn, ZoomOut, Check, RefreshCw, Layers, ShieldCheck,
  Compass, FileImage, Zap, AlertTriangle
} from 'lucide-react';

// Preset configurations
const PRESETS = [
  {
    id: 'wallpaper',
    title: 'Wallpaper & Scenery',
    icon: '🌄',
    description: 'Vibrant dynamic range, rich micro-contrast, crisp textures for desktop/phone wallpapers.',
    settings: { scale: '2x', clarity: 50, sharpness: 70, denoise: 15, format: 'auto', quality: 92 },
  },
  {
    id: 'photo',
    title: 'Photo & Portrait',
    icon: '📸',
    description: 'Natural texture preservation, skin-tone harmony, anti-aliased gentle edges.',
    settings: { scale: '2x', clarity: 30, sharpness: 45, denoise: 25, format: 'jpeg', quality: 92 },
  },
  {
    id: 'art',
    title: 'Digital Art & Anime',
    icon: '🎨',
    description: 'Clean vector-like outlines, artifact-free flat color regions, zero ringing.',
    settings: { scale: '2x', clarity: 40, sharpness: 75, denoise: 35, format: 'webp', quality: 90 },
  },
  {
    id: 'document',
    title: 'Text & Document Scan',
    icon: '📄',
    description: 'High-contrast letter edges, de-blurring, clean background for scanned notes/PDFs.',
    settings: { scale: '1x', clarity: 70, sharpness: 90, denoise: 10, format: 'png', quality: 100 },
  },
  {
    id: 'cinema',
    title: 'Ultra Cinema (4x)',
    icon: '⚡',
    description: 'Maximum 4x super-resolution upscaling for 4K / 8K ultra-wide monitors.',
    settings: { scale: '4x', clarity: 55, sharpness: 80, denoise: 20, format: 'webp', quality: 92 },
  },
];

export default function ImageEnhancer() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [enhancedPreview, setEnhancedPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState(null);

  // Settings
  const [preset, setPreset] = useState('wallpaper');
  const [scale, setScale] = useState('2x');
  const [sharpness, setSharpness] = useState(70);
  const [denoise, setDenoise] = useState(15);
  const [clarity, setClarity] = useState(50);
  const [format, setFormat] = useState('auto');
  const [quality, setQuality] = useState(92);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Comparison State
  const [comparisonMode, setComparisonMode] = useState('split'); // 'split' | 'side' | 'loupe'
  const [sliderPos, setSliderPos] = useState(50);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit, 2 = 200%, 3 = 300%
  const [loupePos, setLoupePos] = useState({ x: 50, y: 50, active: false });
  const [customFilename, setCustomFilename] = useState('');

  // Info
  const [origInfo, setOrigInfo] = useState({ width: 0, height: 0, bytes: 0, type: '' });
  const [enhInfo, setEnhInfo] = useState({ width: 0, height: 0, bytes: 0, type: '' });

  const containerRef = useRef(null);

  // Apply a preset
  const applyPreset = (presetId) => {
    const found = PRESETS.find(p => p.id === presetId);
    if (!found) return;
    setPreset(presetId);
    setScale(found.settings.scale);
    setClarity(found.settings.clarity);
    setSharpness(found.settings.sharpness);
    setDenoise(found.settings.denoise);
    setFormat(found.settings.format);
    setQuality(found.settings.quality);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (enhancedPreview) URL.revokeObjectURL(enhancedPreview);
    };
  }, [preview, enhancedPreview]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      const selected = acceptedFiles[0];
      if (selected.type.startsWith('image/')) {
        if (preview) URL.revokeObjectURL(preview);
        if (enhancedPreview) URL.revokeObjectURL(enhancedPreview);
        setFile(selected);

        const base = selected.name.replace(/\.[^/.]+$/, '');
        setCustomFilename(`${base}_enhanced`);
        const objUrl = URL.createObjectURL(selected);
        setPreview(objUrl);

        const img = new Image();
        img.onload = () => {
          setOrigInfo({
            width: img.width,
            height: img.height,
            bytes: selected.size,
            type: selected.type.split('/')[1]?.toUpperCase() || 'IMG'
          });
        };
        img.src = objUrl;

        setEnhancedPreview(null);
        setEnhInfo({ width: 0, height: 0, bytes: 0, type: '' });
        setError(null);
      } else {
        setError('Please drop a valid image file (JPEG, PNG, WebP).');
      }
    }
  }, [preview, enhancedPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleEnhance = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(5);
    setStatusText('Preparing image buffers...');
    setError(null);
    setEnhancedPreview(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('scale', scale);
    formData.append('preset', preset);
    formData.append('sharpness', sharpness.toString());
    formData.append('denoise', denoise.toString());
    formData.append('clarity', clarity.toString());
    formData.append('format', format);
    formData.append('quality', quality.toString());

    // Simulated progress transitions
    const stepTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 30) {
          setStatusText('Denoising & smoothing low-res compression artifacts...');
          return prev + 6;
        } else if (prev < 70) {
          setStatusText(`Super-resolution neural Lanczos3 interpolation (${scale})...`);
          return prev + 4;
        } else if (prev < 90) {
          setStatusText('Applying clarity midtone S-curve & edge sharpening...');
          return prev + 2;
        } else {
          setStatusText('Compressing & streaming optimized image...');
          return Math.min(prev + 1, 96);
        }
      });
    }, 280);

    try {
      const response = await fetch('/api/enhance-image', {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepTimer);
      setProgress(100);
      setStatusText('Enhancement completed!');

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Enhancement failed on backend.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setEnhancedPreview(objectUrl);

      // Determine output extension and mime
      const outMime = blob.type.split('/')[1]?.toUpperCase() || 'JPG';
      const img = new Image();
      img.onload = () => {
        setEnhInfo({
          width: img.width,
          height: img.height,
          bytes: blob.size,
          type: outMime
        });
      };
      img.src = objectUrl;

      // Update filename with correct extension
      const base = file.name.replace(/\.[^/.]+$/, '');
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      setCustomFilename(`${base}_enhanced.${ext}`);

    } catch (err) {
      clearInterval(stepTimer);
      console.error(err);
      setError('Enhancement failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedPreview) return;
    const a = document.createElement('a');
    a.href = enhancedPreview;
    a.download = customFilename.trim() || 'enhanced-image.jpg';
    a.click();
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  // Loupe Mouse Handling
  const handleLoupeMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setLoupePos({ x, y, active: true });
  };

  const handleLoupeLeave = () => {
    setLoupePos(prev => ({ ...prev, active: false }));
  };

  return (
    <div className="fc-wrapper" style={{ maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div className="fc-header-strip" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} className="warn-text" />
          <span style={{ fontWeight: 600 }}>Pure-Rust Ultra HD Image Enhancer & Super-Resolution</span>
        </div>
        <span style={{ fontSize: '0.74rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
          ⚡ 100% Rust Engine • Anti-150MB Guard Active
        </span>
      </div>

      {/* Upload Dropzone */}
      {!preview && (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`} style={{ padding: '48px 24px' }}>
          <input {...getInputProps()} />
          <ImageIcon size={52} className="dropzone-icon" color="#818cf8" />
          <div className="dropzone-text" style={{ fontSize: '1.1rem', marginTop: '12px' }}>
            {isDragActive ? 'Drop your wallpaper or image here...' : 'Upload Wallpaper or Photo to Enhance'}
          </div>
          <div className="dropzone-subtext" style={{ marginTop: '6px' }}>
            Supports JPG, PNG, WebP • Auto-Optimized Compression (No 150MB Bloat)
          </div>
          <div className="format-badges" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <span className="fmt-tag fmt-image">WALLPAPERS</span>
            <span className="fmt-tag fmt-image">PHOTOS</span>
            <span className="fmt-tag fmt-image">ANIME / ART</span>
            <span className="fmt-tag fmt-image">DOCUMENTS</span>
          </div>
        </div>
      )}

      {/* File Card when Loaded */}
      {preview && (
        <div className="fc-file-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div className="fc-file-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '10px', borderRadius: '8px' }}>
              <FileImage size={24} color="#818cf8" />
            </div>
            <div className="fc-file-info" style={{ minWidth: 0 }}>
              <div className="fc-file-name" style={{ fontWeight: 600, color: '#f8fafc' }}>{file?.name}</div>
              <div className="fc-file-size" style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                {origInfo.width > 0 && `${origInfo.width} × ${origInfo.height} px`} • {formatSize(origInfo.bytes)} • {origInfo.type}
              </div>
            </div>
          </div>
          <button
            className="remove-btn"
            onClick={() => {
              setFile(null);
              setPreview(null);
              setEnhancedPreview(null);
            }}
            disabled={isProcessing}
            title="Upload different image"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            Change Image
          </button>
        </div>
      )}

      {error && (
        <div className="fc-error" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Controls & Configuration (Before Enhancement) */}
      {preview && !isProcessing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          
          {/* Preset Buttons Grid */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#818cf8" />
              <span>Choose Enhancement Profile</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {PRESETS.map((p) => {
                const isActive = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${isActive ? '#818cf8' : 'rgba(255,255,255,0.08)'}`,
                      background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      outline: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isActive ? '#fff' : '#cbd5e1' }}>{p.title}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.3 }}>
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scale & Compression Settings Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            
            {/* Upscale Target Selection */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Upscale Factor (Resolution)</span>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>{scale}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { id: '1x', label: '1x Detail', sub: 'Native Size' },
                  { id: '2x', label: '2x Ultra HD', sub: 'Recommended' },
                  { id: '4x', label: '4x Cinema', sub: '4K / 8K Master' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScale(opt.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: `1px solid ${scale === opt.id ? '#818cf8' : 'rgba(255,255,255,0.06)'}`,
                      background: scale === opt.id ? 'rgba(99, 102, 241, 0.22)' : 'rgba(0,0,0,0.18)',
                      color: scale === opt.id ? '#fff' : '#94a3b8',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: '0.68rem', color: scale === opt.id ? '#c7d2fe' : '#64748b' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
              {origInfo.width > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '10px' }}>
                  Target Resolution: <strong>{origInfo.width * (scale === '4x' ? 4 : scale === '2x' ? 2 : 1)} × {origInfo.height * (scale === '4x' ? 4 : scale === '2x' ? 2 : 1)} px</strong>
                </div>
              )}
            </div>

            {/* File Size & Format Optimizer */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Output Format & Size Guard</span>
                <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>Zero 150MB Bloat</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { id: 'auto', label: 'Auto' },
                  { id: 'webp', label: 'WebP (Small)' },
                  { id: 'jpeg', label: 'JPEG (Crisp)' },
                  { id: 'png', label: 'PNG (Lossless)' }
                ].map(fmt => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: `1px solid ${format === fmt.id ? '#818cf8' : 'rgba(255,255,255,0.06)'}`,
                      background: format === fmt.id ? 'rgba(99, 102, 241, 0.22)' : 'rgba(0,0,0,0.18)',
                      color: format === fmt.id ? '#fff' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
              {format !== 'png' && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px' }}>
                    <span>Compression Quality:</span>
                    <strong>{quality}%</strong>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="98"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
                    Quality 90-95% keeps pristine wallpaper fidelity at ~4-8 MB instead of 150 MB!
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Sliders Drawer Toggle */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px' }}>
            <div
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                <Sliders size={16} color="#818cf8" />
                <span>Fine-Tuning Controls (Sharpness, Denoise, Dynamic Range)</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#818cf8' }}>{showAdvanced ? 'Hide ▲' : 'Customize ▼'}</span>
            </div>

            {showAdvanced && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Sharpness Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>
                    <span>Detail & Edge Sharpness</span>
                    <strong style={{ color: '#818cf8' }}>{sharpness}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sharpness}
                    onChange={(e) => setSharpness(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                    Multi-scale unsharp mask with threshold halo suppression.
                  </div>
                </div>

                {/* Clarity Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>
                    <span>Dynamic Range & Clarity</span>
                    <strong style={{ color: '#818cf8' }}>{clarity}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clarity}
                    onChange={(e) => setClarity(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                    Midtone micro-contrast S-curve expansion.
                  </div>
                </div>

                {/* Denoise Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>
                    <span>Artifact & Noise Reduction</span>
                    <strong style={{ color: '#818cf8' }}>{denoise}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={denoise}
                    onChange={(e) => setDenoise(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                    Suppresses low-res JPEG compression block artifacts before upscaling.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
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
              Enhance Image Now ({scale})
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar while Enhancing */}
      {isProcessing && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px', margin: '20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
            <span style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="warn-text" /> {statusText}
            </span>
            <span style={{ fontWeight: 700, color: '#818cf8' }}>{progress}%</span>
          </div>
          <div className="fc-progress-track" style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div
              className="fc-progress-bar"
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
            Running multi-stage compiled Rust SIMD image pipeline...
          </div>
        </div>
      )}

      {/* Comparison Suite (When Enhanced) */}
      {preview && enhancedPreview && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px', margin: '20px 0' }}>
          
          {/* Comparison Mode Header Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>Interactive Visual Inspection</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inspect fine textures, edge clarity, and pixel sharpness</div>
            </div>

            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', gap: '4px' }}>
              {[
                { id: 'split', label: '↔️ Split Wipe' },
                { id: 'side', label: '🪟 Side by Side' },
                { id: 'loupe', label: '🔍 1:1 Pixel Inspector' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setComparisonMode(tab.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: comparisonMode === tab.id ? '#6366f1' : 'transparent',
                    color: comparisonMode === tab.id ? '#fff' : '#94a3b8',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
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
                maxHeight: '650px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--glass-border)',
                background: '#0a0a0c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* After Image (Background) */}
              <img
                src={enhancedPreview}
                alt="Enhanced"
                style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '650px', objectFit: 'contain', pointerEvents: 'none' }}
                draggable={false}
              />

              {/* Before Image (Foreground with Clip) */}
              <img
                src={preview}
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

              {/* Interactive Range Input Overlay */}
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

              {/* Divider Line & Center Handle */}
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
                    width: '34px',
                    height: '34px',
                    background: '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    color: '#6366f1',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8l4 4-4 4M6 16l-4-4 4-4"></path>
                  </svg>
                </div>
              </div>

              {/* Corner Badges */}
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.7)', padding: '5px 12px', borderRadius: '4px', fontSize: '0.78rem', color: '#fff', pointerEvents: 'none', zIndex: 6, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Original ({origInfo.width}×{origInfo.height})
              </div>
              <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(34, 197, 94, 0.85)', padding: '5px 12px', borderRadius: '4px', fontSize: '0.78rem', color: '#fff', pointerEvents: 'none', zIndex: 6, backdropFilter: 'blur(4px)', fontWeight: 700 }}>
                Enhanced ({enhInfo.width}×{enhInfo.height})
              </div>
            </div>
          )}

          {/* VIEW 2: Side-by-Side Dual View */}
          {comparisonMode === 'side' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Left: Original */}
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0c' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Original</span>
                    <span style={{ color: '#94a3b8' }}>{origInfo.width} × {origInfo.height} px</span>
                  </div>
                  <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={preview} alt="Original" style={{ width: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '4px' }} />
                  </div>
                </div>

                {/* Right: Enhanced */}
                <div style={{ border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0c' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.12)', borderBottom: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 700, color: '#a5b4fc' }}>Ultra HD Enhanced ({scale})</span>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>{enhInfo.width} × {enhInfo.height} px</span>
                  </div>
                  <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={enhancedPreview} alt="Enhanced" style={{ width: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: 1:1 Pixel Inspector (Magnifier Loupe) */}
          {comparisonMode === 'loupe' && (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '10px' }}>
                💡 <strong>Hover your cursor over the image below</strong> to inspect raw uncompressed 1:1 pixel density without screen downsampling:
              </div>
              <div
                ref={containerRef}
                onMouseMove={handleLoupeMove}
                onMouseLeave={handleLoupeLeave}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxHeight: '550px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid var(--glass-border)',
                  background: '#0a0a0c',
                  cursor: 'crosshair',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={enhancedPreview}
                  alt="Enhanced overview"
                  style={{ width: '100%', height: 'auto', maxHeight: '550px', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                />

                {/* The Floating Loupe */}
                {loupePos.active && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `clamp(140px, ${loupePos.x}%, calc(100% - 140px))`,
                      top: `clamp(140px, ${loupePos.y}%, calc(100% - 140px))`,
                      transform: 'translate(-50%, -50%)',
                      width: '280px',
                      height: '280px',
                      borderRadius: '50%',
                      border: '3px solid #818cf8',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(99, 102, 241, 0.4)',
                      overflow: 'hidden',
                      pointerEvents: 'none',
                      background: '#000',
                      zIndex: 20,
                    }}
                  >
                    {/* Left half: Original zoom */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '50%',
                        height: '100%',
                        overflow: 'hidden',
                        borderRight: '1px solid #fff',
                      }}
                    >
                      <div
                        style={{
                          width: '280px',
                          height: '280px',
                          backgroundImage: `url(${preview})`,
                          backgroundPosition: `${loupePos.x}% ${loupePos.y}%`,
                          backgroundSize: '400%',
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                      <span style={{ position: 'absolute', bottom: '12px', left: '14px', background: 'rgba(0,0,0,0.8)', color: '#cbd5e1', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px' }}>
                        Original
                      </span>
                    </div>

                    {/* Right half: Enhanced zoom */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '50%',
                        height: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          width: '280px',
                          height: '280px',
                          backgroundImage: `url(${enhancedPreview})`,
                          backgroundPosition: `${loupePos.x}% ${loupePos.y}%`,
                          backgroundSize: '400%',
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                      <span style={{ position: 'absolute', bottom: '12px', right: '14px', background: 'rgba(34, 197, 94, 0.9)', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>
                        Enhanced
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metrics & File Size Comparison Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '20px',
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Original File</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                {origInfo.width} × {origInfo.height} px
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatSize(origInfo.bytes)} ({origInfo.type})</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Ultra HD Enhanced</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4ade80', marginTop: '2px' }}>
                {enhInfo.width} × {enhInfo.height} px
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>{formatSize(enhInfo.bytes)} ({enhInfo.type})</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pixel Increase</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#818cf8', marginTop: '2px' }}>
                {origInfo.width > 0 && ((enhInfo.width * enhInfo.height) / (origInfo.width * origInfo.height)).toFixed(1)}× Resolution
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {((enhInfo.width * enhInfo.height) / 1000000).toFixed(1)} Megapixels
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Storage Efficiency</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                Zero 150MB Bloat
              </div>
              <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                Optimized {enhInfo.type} Compression
              </div>
            </div>
          </div>

          {/* Download & File Renaming Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Filename:</label>
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
                  maxWidth: '380px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setEnhancedPreview(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={15} />
                Tweak & Re-enhance
              </button>

              <button
                className="btn-primary"
                onClick={handleDownload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
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
