import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  UploadCloud, GripVertical, Trash2, FileText, Loader2,
  Image as ImageIcon, FileType, File, CheckCircle2, AlertCircle, RefreshCw, Presentation,
  ArrowUp, ArrowDown, ArrowUpDown, Hash, Download
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB guard — prevents OOM crash
const STATUS = { PENDING: 'pending', CONVERTING: 'converting', DONE: 'done', ERROR: 'error' };

// ─── Backend Conversion (LibreOffice) ───────────────────────────────────────
async function backendConvert(file, toExt) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('toExt', toExt);

  const response = await fetch('/api/convert/libreoffice', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
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

// Client-side TXT → PDF conversion
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

  if (lines.length === 0) {
    pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  return pdfDoc.save();
}

async function convertImageToPdf(file) {
  const pdfDoc = await PDFDocument.create();
  const arrayBuffer = await file.arrayBuffer();

  let image;
  const mime = file.type.toLowerCase();

  if (mime === 'image/png') {
    image = await pdfDoc.embedPng(arrayBuffer);
  } else {
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
    // Immediately free canvas memory buffer
    canvas.width = 0;
    canvas.height = 0;

    const jpgBytes = await jpgBlob.arrayBuffer();
    image = await pdfDoc.embedJpg(jpgBytes);
  }

  const { width, height } = image.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return pdfDoc.save();
}

async function convertFileToPdfBytes(file, category) {
  switch (category) {
    case 'pdf':
      return file.arrayBuffer();

    case 'image':
      return convertImageToPdf(file);

    case 'text':
      return convertTextToPdf(file);

    case 'word':
    case 'presentation':
    case 'html': {
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
  const [toast, setToast] = useState(null);
  const [customFilename, setCustomFilename] = useState('Merged_Document.pdf');

  // Page numbering settings
  const [enablePageNumbers, setEnablePageNumbers] = useState(true);
  const [pageNumberFormat, setPageNumberFormat] = useState('pageOfTotal'); // 'plain' | 'pageOfTotal' | 'slash' | 'hyphen'
  const [pageNumberPosition, setPageNumberPosition] = useState('center'); // 'center' | 'right'
  const [maskFooters, setMaskFooters] = useState(true);

  const blobUrlRef = useRef(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const clearPreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    clearPreview();

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
  }, [clearPreview, setFiles]);

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
    clearPreview();
    const reordered = Array.from(files);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    setFiles(reordered);
  };

  const removeFile = (id) => {
    clearPreview();
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const moveUp = (index) => {
    if (index === 0) return;
    clearPreview();
    const updated = Array.from(files);
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setFiles(updated);
  };

  const moveDown = (index) => {
    if (index >= files.length - 1) return;
    clearPreview();
    const updated = Array.from(files);
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setFiles(updated);
  };

  const sortByName = () => {
    clearPreview();
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(sorted);
  };

  const reverseOrder = () => {
    clearPreview();
    setFiles([...files].reverse());
  };

  const updateStatus = (id, status, error = null) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, error } : f));
  };

  const convertAndMerge = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    clearPreview();

    let anySuccess = false;
    let errorCount = 0;

    try {
      const mergedPdf = await PDFDocument.create();

      // Process strictly in the user's defined order
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

      // Add cohesive continuous page numbering across the merged document
      if (enablePageNumbers) {
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const pages = mergedPdf.getPages();
        const totalPages = pages.length;

        pages.forEach((page, idx) => {
          const { width } = page.getSize();
          const pageNum = idx + 1;
          let text = `${pageNum}`;
          if (pageNumberFormat === 'pageOfTotal') {
            text = `Page ${pageNum} of ${totalPages}`;
          } else if (pageNumberFormat === 'slash') {
            text = `${pageNum} / ${totalPages}`;
          } else if (pageNumberFormat === 'hyphen') {
            text = `- ${pageNum} -`;
          }

          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(text, fontSize);

          // Mask existing footer page numbers (from individual doc files) with solid white
          if (maskFooters) {
            if (pageNumberPosition === 'center') {
              page.drawRectangle({
                x: width / 2 - Math.max(textWidth / 2 + 25, 80),
                y: 10,
                width: Math.max(textWidth + 50, 160),
                height: 22,
                color: rgb(1, 1, 1),
                opacity: 1.0,
              });
            } else {
              page.drawRectangle({
                x: width - Math.max(textWidth + 40, 140) - 20,
                y: 10,
                width: Math.max(textWidth + 40, 140),
                height: 22,
                color: rgb(1, 1, 1),
                opacity: 1.0,
              });
            }
          }

          const textX = pageNumberPosition === 'center'
            ? width / 2 - textWidth / 2
            : width - textWidth - 36;
          const textY = 16;

          page.drawText(text, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
        });
      }

      const bytes = await mergedPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });

      const newUrl = URL.createObjectURL(blob);
      blobUrlRef.current = newUrl;
      setPreviewUrl(newUrl);

    } catch (err) {
      console.error('Merge failed:', err);
      showToast(`Merge failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const finalName = customFilename.trim() || 'Merged_Document.pdf';
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = finalName.toLowerCase().endsWith('.pdf') ? finalName : `${finalName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const clearAll = () => {
    clearPreview();
    setFiles([]);
  };

  const supportedCount = files.filter(f => f.category !== 'unknown').length;
  const unsupportedCount = files.filter(f => f.category === 'unknown').length;

  return (
    <div>
      {/* Toast Notification */}
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
        <p className="dropzone-subtext">Supports DOCX, DOC, PPTX, PDF, TXT, HTML, and Images · Max 50MB per file</p>
        <div className="format-badges">
          <span className="fmt-tag fmt-word">DOCX/DOC</span>
          <span className="fmt-tag fmt-word" style={{ background: '#ff6b3522', color: '#ff6b35', borderColor: '#ff6b3544' }}>PPTX</span>
          <span className="fmt-tag fmt-pdf">PDF</span>
          <span className="fmt-tag fmt-image">JPG/PNG</span>
          <span className="fmt-tag" style={{ background: '#a3e63522', color: '#a3e635', borderColor: '#a3e63544' }}>TXT</span>
          <span className="fmt-tag" style={{ background: '#f9731622', color: '#f97316', borderColor: '#f9731644' }}>HTML</span>
        </div>
      </div>

      {/* Stats and Reordering Bar */}
      {files.length > 0 && (
        <div className="convert-stats-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span>{files.length} file{files.length !== 1 ? 's' : ''} queued in merge order</span>
            {unsupportedCount > 0 && (
              <span className="warn-text" style={{ marginLeft: '12px' }}>⚠ {unsupportedCount} unsupported file{unsupportedCount > 1 ? 's' : ''} will be skipped</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={sortByName}
              className="btn-ghost"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
              title="Sort files alphabetically A to Z"
            >
              <ArrowUpDown size={14} /> Sort A-Z
            </button>
            <button
              onClick={reverseOrder}
              className="btn-ghost"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
              title="Reverse file sequence"
            >
              ⇄ Reverse
            </button>
            <button className="btn-ghost" onClick={clearAll}>Clear all</button>
          </div>
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
                        style={getDragStyle(provided.draggableProps.style, snapshot)}
                        className={`pdf-item convert-item ${snapshot.isDragging ? 'pdf-item-dragging' : ''} status-${item.status}`}
                      >
                        {/* Drag Handle */}
                        <div {...provided.dragHandleProps} className="drag-handle" title="Drag to reorder">
                          <GripVertical size={20} />
                        </div>

                        {/* Order Badge */}
                        <span className="order-badge" title={`Merge sequence #${index + 1}`}>{index + 1}</span>

                        {/* Icon */}
                        <div className="file-icon-wrap">{getCategoryIcon(item.category)}</div>

                        {/* Info */}
                        <div className="pdf-info" style={{ flex: 1, minWidth: 0 }}>
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

                        {/* Move Up / Move Down buttons */}
                        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
                          <button
                            onClick={() => moveUp(index)}
                            disabled={index === 0 || isProcessing}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: 'none',
                              borderRadius: '4px',
                              color: index === 0 ? '#475569' : '#cbd5e1',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              padding: '5px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Move Up"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            onClick={() => moveDown(index)}
                            disabled={index === files.length - 1 || isProcessing}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: 'none',
                              borderRadius: '4px',
                              color: index === files.length - 1 ? '#475569' : '#cbd5e1',
                              cursor: index === files.length - 1 ? 'not-allowed' : 'pointer',
                              padding: '5px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Move Down"
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeFile(item.id)}
                          className="remove-btn"
                          title="Remove"
                          disabled={isProcessing}
                        >
                          <Trash2 size={18} />
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

      {/* ── Page Numbering Choice at Merge Time ── */}
      {files.length > 0 && !previewUrl && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '14px',
          padding: '16px 20px',
          margin: '18px 0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Hash size={16} color="#818cf8" />
              Page Numbering at Merge Time
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Harmonize multi-doc pages or preserve original page numbering
            </span>
          </div>

          {/* Segmented Button Selection */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: enablePageNumbers ? '14px' : '4px'
          }}>
            <button
              type="button"
              onClick={() => setEnablePageNumbers(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                fontSize: '0.84rem', fontWeight: 600, transition: 'all 0.2s ease',
                background: !enablePageNumbers ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                border: !enablePageNumbers ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: !enablePageNumbers ? '#fca5a5' : '#94a3b8',
              }}
            >
              <span style={{ fontSize: '15px' }}>🚫</span>
              No Page Numbers (Keep Original)
            </button>

            <button
              type="button"
              onClick={() => setEnablePageNumbers(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                fontSize: '0.84rem', fontWeight: 600, transition: 'all 0.2s ease',
                background: enablePageNumbers ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                border: enablePageNumbers ? '1.5px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                color: enablePageNumbers ? '#a5b4fc' : '#94a3b8',
              }}
            >
              <span style={{ fontSize: '15px' }}>🔢</span>
              Continuous Page Numbers (1 to N)
            </button>
          </div>

          {!enablePageNumbers ? (
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '4px' }}>
              ✓ Original pages and existing footers will be merged without adding any new page numbers.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Format:</span>
                <select
                  value={pageNumberFormat}
                  onChange={e => setPageNumberFormat(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    padding: '4px 8px',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                >
                  <option value="pageOfTotal">Page 1 of 25</option>
                  <option value="slash">1 / 25</option>
                  <option value="plain">1, 2, 3...</option>
                  <option value="hyphen">- 1 -</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Position:</span>
                <select
                  value={pageNumberPosition}
                  onChange={e => setPageNumberPosition(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    padding: '4px 8px',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                >
                  <option value="center">Bottom Center</option>
                  <option value="right">Bottom Right</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={maskFooters}
                  onChange={e => setMaskFooters(e.target.checked)}
                  style={{ accentColor: '#818cf8' }}
                />
                Cleanly mask conflicting original footer numbers
              </label>
            </div>
          )}
        </div>
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
              <><Loader2 className="spin" size={22} /> Converting & Merging in Exact Order…</>
            ) : (
              <><RefreshCw size={22} /> Convert & Merge {supportedCount} File{supportedCount !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      )}

      {/* Preview with Custom Renaming */}
      {previewUrl && (
        <div className="preview-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div className="preview-header" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <h3 className="preview-title">✅ Merged PDF Ready</h3>

            {/* Custom Filename Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Rename file:</label>
              <input
                type="text"
                value={customFilename}
                onChange={e => setCustomFilename(e.target.value)}
                placeholder="Merged_Document.pdf"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  width: '100%',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  clearPreview();
                  setFiles(prev => prev.map(f => ({ ...f, status: STATUS.PENDING, error: null })));
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              >
                <RefreshCw size={16} /> Re-order / Edit
              </button>
              <button
                className="btn-primary"
                onClick={handleDownload}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
              >
                <Download size={18} />
                Download Merged PDF
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
