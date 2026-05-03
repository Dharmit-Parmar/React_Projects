import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  UploadCloud, GripVertical, Trash2, FileText, Loader2,
  Image as ImageIcon, FileType, File, CheckCircle2, AlertCircle, RefreshCw, Presentation
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB guard — prevents OOM crash (BUG 6 FIX)
const STATUS = { PENDING: 'pending', CONVERTING: 'converting', DONE: 'done', ERROR: 'error' };

// ─── Backend Conversion (LibreOffice) ───────────────────────────────────────
// Used ONLY for .doc, .docx, .ppt, .pptx — NOT for txt (handled client-side)
async function backendConvert(file, toExt) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('toExt', toExt);

  const response = await fetch('/api/convert/libreoffice', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    // BUG 3 FIX: Extract specific error message from response body
    let reason = `HTTP ${response.status}`;
    try {
      const text = await response.text();
      if (text) reason = text;
    } catch (_) {}
    throw new Error(`Backend conversion failed: ${reason}`);
  }

  return response.blob();
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getFileCategory = (file) => {
  const name = file.name.toLowerCase();
  const type = file.type || '';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp)$/.test(name)) return 'image';
  if (name.endsWith('.docx') || name.endsWith('.doc') || type.includes('word')) return 'word';
  if (name.endsWith('.pptx') || name.endsWith('.ppt') || type.includes('presentation')) return 'presentation';
  if (name.endsWith('.txt') || type.includes('text/plain')) return 'text';
  if (name.endsWith('.html') || name.endsWith('.htm') || type.includes('html')) return 'html';
  return 'unknown';
};

// Fix drag offset caused by parent container transforms/backdrop-filters
function getDragStyle(style, snapshot) {
  if (!snapshot.isDragging) return style;
  if (!style?.transform) return style;
  
  const container = document.querySelector('.glass-container');
  if (!container) return style;

  const rect = container.getBoundingClientRect();
  const match = style.transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (!match) return style;
  
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  
  return { 
    ...style, 
    transform: `translate(${x - rect.left}px, ${y - rect.top}px)` 
  };
}

const getCategoryIcon = (category) => {
  switch (category) {
    case 'pdf':          return <FileText size={22} style={{ color: '#ef4444' }} />;
    case 'image':        return <ImageIcon size={22} style={{ color: '#22d3ee' }} />;
    case 'word':         return <FileType size={22} style={{ color: '#3b82f6' }} />;
    case 'presentation': return <Presentation size={22} style={{ color: '#ff6b35' }} />;
    case 'text':         return <File size={22} style={{ color: '#a3e635' }} />;
    case 'html':         return <File size={22} style={{ color: '#f97316' }} />;
    default:             return <File size={22} style={{ color: '#94a3b8' }} />;
  }
};

const getCategoryBadge = (category) => {
  const map = {
    pdf:          { label: 'PDF',   color: '#ef4444' },
    image:        { label: 'IMAGE', color: '#22d3ee' },
    word:         { label: 'WORD',  color: '#3b82f6' },
    presentation: { label: 'PPT',   color: '#ff6b35' },
    text:         { label: 'TXT',   color: '#a3e635' },
    html:         { label: 'HTML',  color: '#f97316' },
    unknown:      { label: '???',   color: '#94a3b8' },
  };
  const cfg = map[category] || map.unknown;
  return (
    <span className="file-badge" style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
      {cfg.label}
    </span>
  );
};

// ─── BUG 1 FIX: TXT → PDF handled client-side (no backend needed) ──────────
async function convertTextToPdf(file) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const text = await file.text();
  const lines = text.split('\n');

  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;
  const MARGIN = 50;
  const FONT_SIZE = 11;
  const LINE_HEIGHT = FONT_SIZE * 1.4;
  const MAX_LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT);

  // Chunk lines across pages
  for (let i = 0; i < lines.length; i += MAX_LINES_PER_PAGE) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const pageLines = lines.slice(i, i + MAX_LINES_PER_PAGE);
    pageLines.forEach((line, idx) => {
      page.drawText(line, {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN - idx * LINE_HEIGHT,
        size: FONT_SIZE,
        font,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: PAGE_WIDTH - MARGIN * 2,
      });
    });
  }

  // Handle empty files
  if (lines.length === 0) {
    pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  return pdfDoc.save();
}

// ─── BUG 4 FIX: Image → PDF with proper blob await & null check ───────────
async function convertImageToPdf(file) {
  const pdfDoc = await PDFDocument.create();
  const arrayBuffer = await file.arrayBuffer();

  let image;
  const mime = file.type.toLowerCase();

  if (mime === 'image/png') {
    image = await pdfDoc.embedPng(arrayBuffer);
  } else {
    // For JPG, GIF, WEBP, BMP — draw onto canvas and export as JPEG
    const blob = new Blob([arrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);

    const img = new window.Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error(`Failed to load image: ${file.name}`));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    // BUG 4 FIX: Properly await blob → arrayBuffer with null guard
    const jpgBlob = await new Promise((res, rej) => {
      canvas.toBlob(
        (b) => {
          if (!b) rej(new Error(`Canvas failed to export image: ${file.name}`));
          else res(b);
        },
        'image/jpeg',
        0.95
      );
    });
    const jpgBytes = await jpgBlob.arrayBuffer();
    image = await pdfDoc.embedJpg(jpgBytes);
  }

  const { width, height } = image.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return pdfDoc.save();
}

// ─── Master Conversion Router ────────────────────────────────────────────────
async function convertFileToPdfBytes(file, category) {
  switch (category) {
    case 'pdf':
      return file.arrayBuffer();

    case 'image':
      return convertImageToPdf(file);

    case 'text':
      // BUG 1 FIX: TXT is now client-side — no backend call
      return convertTextToPdf(file);

    case 'word':
    case 'presentation':
    case 'html': {
      // Word, PPT, and HTML go to LibreOffice backend
      const blob = await backendConvert(file, 'pdf');
      return blob.arrayBuffer();
    }

    default:
      throw new Error(`Unsupported file type: ${file.name}`);
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function ConvertAndMerge({ files, setFiles }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [toast, setToast] = useState(null); // BUG 3 FIX: error toast state

  // BUG 2 FIX: Track current blob URL in a ref so we can revoke it before creating a new one
  const blobUrlRef = useRef(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // BUG 6 FIX: Reject files over 50MB at drop time
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Clear old preview on new drop
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setPreviewUrl(null);
    }

    const oversized = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
    const valid = acceptedFiles.filter(f => f.size <= MAX_FILE_SIZE_BYTES);

    if (oversized.length > 0) {
      showToast(
        `${oversized.length} file(s) skipped — max size is 50MB: ${oversized.map(f => f.name).join(', ')}`,
        'warning'
      );
    }

    if (rejectedFiles.length > 0) {
      showToast(`${rejectedFiles.length} unsupported file(s) were rejected.`, 'warning');
    }

    const mapped = valid.map(f => ({
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: f,
      name: f.name,
      size: f.size,
      category: getFileCategory(f),
      status: STATUS.PENDING,
      error: null,
    }));

    setFiles(prev => [...prev, ...mapped]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'text/plain': ['.txt'],
      'text/html': ['.html', '.htm'],
    },
    multiple: true,
  });

  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    // BUG 2 FIX: Revoke old preview when list is reordered
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setPreviewUrl(null);
    }
    const reordered = Array.from(files);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    setFiles(reordered);
  };

  const removeFile = (id) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setPreviewUrl(null);
    }
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateStatus = (id, status, error = null) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, error } : f));
  };

  const convertAndMerge = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    // BUG 2 FIX: Always revoke the previous blob URL before creating a new one
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setPreviewUrl(null);
    }

    let anySuccess = false;
    let errorCount = 0;

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        if (item.category === 'unknown') continue;

        updateStatus(item.id, STATUS.CONVERTING);
        try {
          const pdfBytes = await convertFileToPdfBytes(item.file, item.category);
          const srcPdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
          updateStatus(item.id, STATUS.DONE);
          anySuccess = true;
        } catch (err) {
          // BUG 3 FIX: Store the specific error message per file
          updateStatus(item.id, STATUS.ERROR, err.message);
          console.error(`Failed to convert ${item.name}:`, err);
          errorCount++;
        }
      }

      if (!anySuccess) {
        showToast('All conversions failed. Check that your backend is running for DOCX/PPTX files.', 'error');
        return;
      }

      if (errorCount > 0) {
        showToast(`${errorCount} file(s) failed to convert and were skipped.`, 'warning');
      }

      const bytes = await mergedPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });

      // BUG 2 FIX: Store new URL in ref so it can be revoked later
      const newUrl = URL.createObjectURL(blob);
      blobUrlRef.current = newUrl;
      setPreviewUrl(newUrl);

    } catch (err) {
      console.error('Merge failed:', err);
      // BUG 3 FIX: Show specific error in toast instead of generic alert
      showToast(`Merge failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    // BUG 2 FIX: Clean up blob URL on clear
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setFiles([]);
    setPreviewUrl(null);
  };

  const supportedCount = files.filter(f => f.category !== 'unknown').length;
  const unsupportedCount = files.filter(f => f.category === 'unknown').length;

  return (
    <div>
      {/* Toast Notification — BUG 3 FIX */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            background: toast.type === 'error' ? '#ef444422' : '#f9731622',
            border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#f97316'}`,
            color: toast.type === 'error' ? '#ef4444' : '#f97316',
            padding: '12px 18px', borderRadius: '8px',
            fontSize: '13px', maxWidth: '400px',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 24px #0008',
          }}
        >
          <AlertCircle size={16} />
          {toast.message}
          <button
            onClick={() => setToast(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Drop Zone */}
      <div {...getRootProps()} className={`dropzone convert-dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        <UploadCloud className="dropzone-icon" />
        <h3 className="dropzone-text">
          {isDragActive ? 'Drop your files here' : 'Drag & drop any files here'}
        </h3>
        <p className="dropzone-subtext">Supports DOCX, PPTX, PDF, TXT, HTML, and Images · Max 50MB per file</p>
        <div className="format-badges">
          <span className="fmt-tag fmt-word">DOCX</span>
          <span className="fmt-tag fmt-word" style={{ background: '#ff6b3522', color: '#ff6b35', borderColor: '#ff6b3544' }}>PPTX</span>
          <span className="fmt-tag fmt-pdf">PDF</span>
          <span className="fmt-tag fmt-image">JPG/PNG</span>
          <span className="fmt-tag" style={{ background: '#a3e63522', color: '#a3e635', borderColor: '#a3e63544' }}>TXT</span>
          <span className="fmt-tag" style={{ background: '#f9731622', color: '#f97316', borderColor: '#f9731644' }}>HTML</span>
        </div>
      </div>

      {/* Stats bar */}
      {files.length > 0 && (
        <div className="convert-stats-bar">
          <span>{files.length} file{files.length !== 1 ? 's' : ''} queued</span>
          {unsupportedCount > 0 && (
            <span className="warn-text">⚠ {unsupportedCount} unsupported file{unsupportedCount > 1 ? 's' : ''} will be skipped</span>
          )}
          <button className="btn-ghost" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="convert-list">
            {(provided) => (
              <div className="pdf-list" {...provided.droppableProps} ref={provided.innerRef}>
                {files.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        // BUG 5 FIX: No more fragile offset hack — style passed through cleanly
                        style={getDragStyle(provided.draggableProps.style, snapshot)}
                        className={`pdf-item convert-item ${snapshot.isDragging ? 'pdf-item-dragging' : ''} status-${item.status}`}
                      >
                        {/* Drag Handle */}
                        <div {...provided.dragHandleProps} className="drag-handle">
                          <GripVertical size={20} />
                        </div>

                        {/* Order Badge */}
                        <span className="order-badge">{index + 1}</span>

                        {/* Icon */}
                        <div className="file-icon-wrap">{getCategoryIcon(item.category)}</div>

                        {/* Info */}
                        <div className="pdf-info">
                          <span className="pdf-name">{item.name}</span>
                          <div className="file-meta">
                            <span className="pdf-size">{formatBytes(item.size)}</span>
                            {getCategoryBadge(item.category)}
                            {item.status === STATUS.CONVERTING && (
                              <span className="convert-status converting">
                                <Loader2 size={12} className="spin" />
                                {item.category === 'text' ? 'Converting client-side…' : 'Converting via LibreOffice…'}
                              </span>
                            )}
                            {item.status === STATUS.DONE && (
                              <span className="convert-status done">
                                <CheckCircle2 size={12} /> Ready
                              </span>
                            )}
                            {item.status === STATUS.ERROR && (
                              // BUG 3 FIX: Show full error message in title tooltip
                              <span
                                className="convert-status error"
                                title={item.error}
                                style={{ cursor: 'help' }}
                              >
                                <AlertCircle size={12} /> Failed — hover for details
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeFile(item.id)}
                          className="remove-btn"
                          title="Remove"
                          disabled={isProcessing}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Action Button */}
      {files.length > 0 && !previewUrl && (
        <div className="actions">
          <button
            className="btn-primary btn-convert"
            onClick={convertAndMerge}
            disabled={isProcessing || supportedCount === 0}
          >
            {isProcessing ? (
              <><Loader2 className="spin" size={22} /> Converting & Merging…</>
            ) : (
              <><RefreshCw size={22} /> Convert & Merge {supportedCount} File{supportedCount !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="preview-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div className="preview-header">
            <h3 className="preview-title">✅ Merged PDF Ready</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  // BUG 2 FIX: Revoke URL on reset
                  if (blobUrlRef.current) {
                    URL.revokeObjectURL(blobUrlRef.current);
                    blobUrlRef.current = null;
                  }
                  setPreviewUrl(null);
                  setFiles(prev => prev.map(f => ({ ...f, status: STATUS.PENDING, error: null })));
                }}
              >
                <RefreshCw size={16} /> Reset
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewUrl;
                  a.download = `Converted_Merged_${Date.now()}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <FileText size={16} /> Download Merged PDF
              </button>
            </div>
          </div>
          <iframe
            src={`${previewUrl}#toolbar=0`}
            className="pdf-preview-frame"
            title="Merged PDF Preview"
          />
        </div>
      )}
    </div>
  );
}
