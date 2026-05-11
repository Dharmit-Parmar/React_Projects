import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Sparkles, Download, ArrowRight, ImageIcon } from 'lucide-react';

export default function ImageEnhancer() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [enhancedPreview, setEnhancedPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [targetRes, setTargetRes] = useState('1x');
  const [mode, setMode] = useState('cpu');
  const [postProcess, setPostProcess] = useState(true);
  const [downscale, setDownscale] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const [error, setError] = useState(null);

  const [origInfo, setOrigInfo] = useState({ width: 0, height: 0, bytes: 0 });
  const [enhInfo, setEnhInfo] = useState({ width: 0, height: 0, bytes: 0 });

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      const selected = acceptedFiles[0];
      if (selected.type.startsWith('image/')) {
        setFile(selected);
        const objUrl = URL.createObjectURL(selected);
        setPreview(objUrl);
        
        const img = new Image();
        img.onload = () => {
          setOrigInfo({ width: img.width, height: img.height, bytes: selected.size });
        };
        img.src = objUrl;

        setEnhancedPreview(null);
        setEnhInfo({ width: 0, height: 0, bytes: 0 });
        setError(null);
      } else {
        setError('Please drop a valid image file.');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleEnhance = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setEnhancedPreview(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', targetRes);
    formData.append('mode', mode);
    formData.append('postProcess', postProcess.toString());
    formData.append('downscale', downscale.toString());

    // Simulate progress bar since the backend processes it in one shot
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        // Slow down the fake progress as it gets higher
        const increment = prev > 80 ? 1 : prev > 50 ? 3 : 8;
        return prev + increment;
      });
    }, 400);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/enhance-image`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Server error occurred');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setEnhancedPreview(objectUrl);
      
      const img = new Image();
      img.onload = () => {
        setEnhInfo({ width: img.width, height: img.height, bytes: blob.size });
      };
      img.src = objectUrl;

    } catch (err) {
      clearInterval(progressInterval);
      console.error(err);
      setError('Enhancement failed. ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedPreview) return;
    const a = document.createElement('a');
    a.href = enhancedPreview;
    a.download = `enhanced-${file?.name || 'image.png'}`;
    a.click();
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="fc-wrapper">
      <div className="fc-header-strip">
        <Sparkles size={16} className="warn-text" />
        <span>AI Image Enhancer (Super Resolution via Backend)</span>
      </div>

      {!preview && (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <ImageIcon size={48} className="dropzone-icon" />
          <div className="dropzone-text">
            {isDragActive ? 'Drop image here...' : 'Drag & drop an image'}
          </div>
          <div className="dropzone-subtext">JPEG, PNG, WebP supported</div>
          <div className="format-badges">
            <span className="fmt-tag fmt-image">IMAGE</span>
          </div>
        </div>
      )}

      {preview && (
        <div className="fc-file-card" style={{ flexWrap: 'wrap' }}>
          <div className="fc-file-icon">
            <ImageIcon size={24} color="#818cf8" />
          </div>
          <div className="fc-file-info">
            <div className="fc-file-name">{file?.name}</div>
            <div className="fc-file-size">
              {origInfo.width > 0 && `${origInfo.width}x${origInfo.height}px • `}
              {formatSize(origInfo.bytes)}
            </div>
          </div>
          <button 
            className="remove-btn" 
            onClick={() => {
              setFile(null); setPreview(null); setEnhancedPreview(null);
            }}
            disabled={isProcessing}
            title="Remove"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="fc-error">
          <span>{error}</span>
        </div>
      )}

      {preview && !enhancedPreview && !isProcessing && (
        <>
        <div className="preview-container" style={{ marginBottom: '20px' }}>
          <div className="preview-header">
            <span className="preview-title">Original Preview</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
            <img src={preview} alt="Original" style={{ width: '100%', maxWidth: '500px', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
            <span style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {origInfo.width}x{origInfo.height} pixels
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          {/* Resolution Panel */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={18} color="#818cf8" /> Enhancement Mode
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: targetRes === '1x' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.15)', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${targetRes === '1x' ? '#818cf8' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.2s' }}>
                <input type="radio" name="target" value="1x" checked={targetRes === '1x'} onChange={(e) => setTargetRes(e.target.value)} style={{ accentColor: '#818cf8', width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: targetRes === '1x' ? '#fff' : 'var(--text-secondary)' }}>1x Smart Enhance (Text Focus)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>No upscale. Optimal sharpness & clarity.</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: targetRes === '2x' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.15)', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${targetRes === '2x' ? '#818cf8' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.2s' }}>
                <input type="radio" name="target" value="2x" checked={targetRes === '2x'} onChange={(e) => setTargetRes(e.target.value)} style={{ accentColor: '#818cf8', width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: targetRes === '2x' ? '#fff' : 'var(--text-secondary)' }}>2x AI Upscale</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Fast & balanced detail upscaling.</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: targetRes === '4x' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.15)', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${targetRes === '4x' ? '#818cf8' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.2s' }}>
                <input type="radio" name="target" value="4x" checked={targetRes === '4x'} onChange={(e) => setTargetRes(e.target.value)} style={{ accentColor: '#818cf8', width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: targetRes === '4x' ? '#fff' : 'var(--text-secondary)' }}>4x Pro Upscale</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Maximum detail generation, slower processing.</div>
                </div>
              </label>
            </div>
          </div>

          {/* Hardware & Tweaks Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', flex: 1 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>Processing Engine</div>
              <div className="fc-select-wrap" style={{ position: 'relative' }}>
                <select className="fc-select" value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', appearance: 'none' }}>
                  <option value="cpu">CPU (Universal, Safe)</option>
                  <option value="gpu">GPU / Metal (Mac/Win, Faster)</option>
                </select>
                <div style={{ position: 'absolute', right: '14px', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <ArrowRight size={16} color="#94a3b8" />
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', flex: 1 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>Advanced Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {targetRes !== '1x' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setPostProcess(!postProcess)}>
                    <input type="checkbox" checked={postProcess} onChange={() => {}} style={{ accentColor: '#818cf8', width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Apply additional sharpness mask after upscale</label>
                  </div>
                )}
                {targetRes !== '1x' && Math.max(origInfo.width, origInfo.height) >= 2048 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }} onClick={() => setDownscale(!downscale)}>
                    <input type="checkbox" checked={downscale} onChange={() => {}} style={{ accentColor: '#818cf8', width: '16px', height: '16px', cursor: 'pointer', marginTop: '2px' }} />
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.4' }}>
                      Auto-downscale 2K+ image before processing (Recommended for RAM limit)
                    </label>
                  </div>
                )}
                {targetRes === '1x' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Smart Enhancement mode enabled. Edge-aware text filtering will be applied to the original full-resolution image without downscaling.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button className="btn-primary btn-convert" onClick={handleEnhance}>
            <Sparkles size={18} />
            Enhance Image
          </button>
        </div>
        </>
      )}

      {isProcessing && (
        <div className="fc-progress-wrap" style={{ marginTop: '20px' }}>
          <div className="fc-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Tiling & Processing (This may take a few minutes)...</span>
            <span>{progress}%</span>
          </div>
          <div className="fc-progress-track">
            <div className="fc-progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {preview && enhancedPreview && (
        <div className="preview-container">
          <div className="preview-header" style={{ marginBottom: '10px' }}>
            <span className="preview-title">Preview Comparison</span>
          </div>
          
          <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            
            {/* After Image (Background - Right Side) */}
            <img src={enhancedPreview} alt="Enhanced" style={{ width: '100%', display: 'block', pointerEvents: 'none' }} draggable={false} />
            
            {/* Before Image (Foreground - Left Side) */}
            <img src={preview} alt="Original" style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', 
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
              pointerEvents: 'none'
            }} draggable={false} />
            
            {/* Slider Input */}
            <input 
              type="range" 
              min="0" max="100" 
              value={sliderPos} 
              onChange={(e) => setSliderPos(e.target.value)}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'ew-resize', margin: 0, zIndex: 10
              }}
            />
            
            {/* Slider Line & Thumb */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: '2px', background: '#fff',
              pointerEvents: 'none', transform: 'translateX(-50%)',
              boxShadow: '0 0 5px rgba(0,0,0,0.5)', zIndex: 5
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '32px', height: '32px', background: '#fff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 8px rgba(0,0,0,0.3)', color: '#6366f1'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
              </div>
            </div>
            
            {/* Labels */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', color: '#fff', pointerEvents: 'none', zIndex: 5, backdropFilter: 'blur(4px)' }}>Before</div>
            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(16,185,129,0.8)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', color: '#fff', pointerEvents: 'none', zIndex: 5, backdropFilter: 'blur(4px)', fontWeight: 'bold' }}>After</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Original:</span> 
              <strong style={{ marginLeft: '6px' }}>{origInfo.width}x{origInfo.height}px ({formatSize(origInfo.bytes)})</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--success)' }}>Enhanced:</span> 
              <strong style={{ color: 'var(--success)', marginLeft: '6px' }}>{enhInfo.width}x{enhInfo.height}px ({formatSize(enhInfo.bytes)})</strong>
            </div>
          </div>

          <div className="actions" style={{ marginTop: '20px' }}>
            <button className="btn-primary" onClick={handleDownload}>
              <Download size={18} />
              Download Enhanced Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
