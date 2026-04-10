import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import jsPDF from 'jspdf';
import {
  UploadCloud, GripVertical, Trash2, FileText, Layers, Loader2,
  Image as ImageIcon, FileType, File, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

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
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(name)) return 'image';
  if (name.endsWith('.docx') || name.endsWith('.doc') || type.includes('word')) return 'word';
  if (name.endsWith('.txt') || type.includes('text/plain')) return 'text';
  return 'unknown';
};

// Fix drag offset caused by body justify-content:center
function getDragStyle(style, snapshot) {
  if (!snapshot.isDragging) return style;
  if (!style?.transform) return style;
  const container = document.querySelector('.glass-container');
  const offsetX = container ? container.getBoundingClientRect().left : 0;
  const match = style.transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (!match) return style;
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  return { ...style, transform: `translate(${x - offsetX}px, ${y}px)` };
}

const getCategoryIcon = (category) => {
  switch (category) {
    case 'pdf':    return <FileText size={22} style={{ color: '#ef4444' }} />;
    case 'image':  return <ImageIcon size={22} style={{ color: '#22d3ee' }} />;
    case 'word':   return <FileType size={22} style={{ color: '#3b82f6' }} />;
    case 'text':   return <File size={22} style={{ color: '#a3e635' }} />;
    default:       return <File size={22} style={{ color: '#94a3b8' }} />;
  }
};

const getCategoryBadge = (category) => {
  const map = {
    pdf:     { label: 'PDF',   color: '#ef4444' },
    image:   { label: 'IMAGE', color: '#22d3ee' },
    word:    { label: 'WORD',  color: '#3b82f6' },
    text:    { label: 'TXT',   color: '#a3e635' },
    unknown: { label: '???',   color: '#94a3b8' },
  };
  const cfg = map[category] || map.unknown;
  return (
    <span className="file-badge" style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
      {cfg.label}
    </span>
  );
};

// ─── Converters ────────────────────────────────────────────────────────────────

async function convertImageToPdf(file) {
  const pdfDoc = await PDFDocument.create();
  const arrayBuffer = await file.arrayBuffer();

  let image;
  const mime = file.type.toLowerCase();
  if (mime === 'image/png') {
    image = await pdfDoc.embedPng(arrayBuffer);
  } else {
    // jpg / jpeg / gif / webp -> draw on canvas, then export as jpeg
    const blob = new Blob([arrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const jpgBytes = await new Promise(res => canvas.toBlob(b => b.arrayBuffer().then(res), 'image/jpeg', 0.95));
    image = await pdfDoc.embedJpg(jpgBytes);
  }

  const { width, height } = image.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  return pdfDoc.save();
}

async function convertTextToPdf(file) {
  const text = await file.text();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  const lines = doc.splitTextToSize(text, pageWidth);
  doc.text(lines, margin, margin + 14);
  return doc.output('arraybuffer');
}

async function convertWordToPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  // Render HTML to a temporary element so we can measure / layout
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 595px; padding: 40px;
    font-family: Arial, sans-serif; font-size: 12px;
    line-height: 1.5; color: #111; background: #fff;
  `;
  document.body.appendChild(container);

  // Use jsPDF html method (uses html2canvas internally)
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(container, { scale: 1.5, useCORS: true });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL('image/jpeg', 0.9);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ratio = canvas.height / canvas.width;
  const imgH = pageW * ratio;

  let heightLeft = imgH;
  let position = 0;
  doc.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
  heightLeft -= pageH;

  while (heightLeft > 0) {
    position -= pageH;
    doc.addPage();
    doc.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
    heightLeft -= pageH;
  }

  return doc.output('arraybuffer');
}

async function convertFileToPdfBytes(file, category) {
  switch (category) {
    case 'pdf':   return file.arrayBuffer();
    case 'image': return convertImageToPdf(file);
    case 'word':  return convertWordToPdf(file);
    case 'text':  return convertTextToPdf(file);
    default:      throw new Error(`Unsupported file type: ${file.name}`);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────
const STATUS = { PENDING: 'pending', CONVERTING: 'converting', DONE: 'done', ERROR: 'error' };

export default function ConvertAndMerge() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setPreviewUrl(null);
    const mapped = acceptedFiles.map(f => ({
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
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    setPreviewUrl(null);
    const reordered = Array.from(files);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    setFiles(reordered);
  };

  const removeFile = (id) => {
    setPreviewUrl(null);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateStatus = (id, status, error = null) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, error } : f));
  };

  const convertAndMerge = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setPreviewUrl(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        updateStatus(item.id, STATUS.CONVERTING);
        try {
          const pdfBytes = await convertFileToPdfBytes(item.file, item.category);
          const srcPdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
          updateStatus(item.id, STATUS.DONE);
        } catch (err) {
          updateStatus(item.id, STATUS.ERROR, err.message);
          console.error(`Failed to convert ${item.name}:`, err);
        }
      }

      const bytes = await mergedPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Merge failed:', err);
      alert('Failed to merge. Please check the console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setPreviewUrl(null);
  };

  const supportedCount = files.filter(f => f.category !== 'unknown').length;
  const unsupportedCount = files.filter(f => f.category === 'unknown').length;

  return (
    <div>
      {/* Drop Zone */}
      <div {...getRootProps()} className={`dropzone convert-dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        <UploadCloud className="dropzone-icon" />
        <h3 className="dropzone-text">
          {isDragActive ? 'Drop your files here' : 'Drag & drop any files here'}
        </h3>
        <p className="dropzone-subtext">Supports PDF, Word (.docx/.doc), Images (PNG, JPG, GIF, WEBP), Text (.txt)</p>
        <div className="format-badges">
          <span className="fmt-tag fmt-pdf">PDF</span>
          <span className="fmt-tag fmt-word">DOCX</span>
          <span className="fmt-tag fmt-image">JPG / PNG</span>
          <span className="fmt-tag fmt-text">TXT</span>
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
                                <Loader2 size={12} className="spin" /> Converting…
                              </span>
                            )}
                            {item.status === STATUS.DONE && (
                              <span className="convert-status done">
                                <CheckCircle2 size={12} /> Converted
                              </span>
                            )}
                            {item.status === STATUS.ERROR && (
                              <span className="convert-status error" title={item.error}>
                                <AlertCircle size={12} /> Failed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remove */}
                        <button onClick={() => removeFile(item.id)} className="remove-btn" title="Remove" disabled={isProcessing}>
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
                onClick={() => { setPreviewUrl(null); setFiles(prev => prev.map(f => ({ ...f, status: STATUS.PENDING }))); }}
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
                <FileText size={16} /> Download PDF
              </button>
            </div>
          </div>
          <iframe src={`${previewUrl}#toolbar=0`} className="pdf-preview-frame" title="Merged PDF Preview" />
        </div>
      )}
    </div>
  );
}
