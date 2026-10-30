import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  UploadCloud, GripVertical, Trash2, FileText, Layers, Loader2,
  ArrowUp, ArrowDown, ArrowUpDown, Hash, Download, Check
} from 'lucide-react';

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

function getDragStyle(style, snapshot) {
  if (!snapshot.isDragging) return style;
  if (!style?.transform) return style;
  const container = document.querySelector('.glass-container');
  const offsetX = container ? container.getBoundingClientRect().left : 0;
  const match = style.transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (!match) return style;
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  return {
    ...style,
    transform: `translate(${x - offsetX}px, ${y}px)`,
  };
}

export default function PdfMerger({ files, setFiles }) {
  const [isMerging, setIsMerging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [customFilename, setCustomFilename] = useState('Merged_Document.pdf');

  // Page numbering settings
  const [enablePageNumbers, setEnablePageNumbers] = useState(true);
  const [pageNumberFormat, setPageNumberFormat] = useState('pageOfTotal'); // 'plain' | 'pageOfTotal' | 'slash' | 'hyphen'
  const [pageNumberPosition, setPageNumberPosition] = useState('center'); // 'center' | 'right'
  const [maskFooters, setMaskFooters] = useState(true);

  const previewUrlRef = useRef(null);

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const onDrop = useCallback(acceptedFiles => {
    clearPreviewUrl();
    const newFiles = acceptedFiles.map(file => ({
      id: `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      category: 'pdf',
      status: 'pending',
      error: null
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, [setFiles, clearPreviewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    }
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    clearPreviewUrl();

    const items = Array.from(files);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFiles(items);
  };

  const removeFile = (id) => {
    clearPreviewUrl();
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Reordering helpers for precise manual ordering
  const moveUp = (index) => {
    if (index === 0) return;
    clearPreviewUrl();
    const updated = Array.from(files);
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setFiles(updated);
  };

  const moveDown = (index) => {
    if (index >= files.length - 1) return;
    clearPreviewUrl();
    const updated = Array.from(files);
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setFiles(updated);
  };

  const sortByName = () => {
    clearPreviewUrl();
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(sorted);
  };

  const reverseOrder = () => {
    clearPreviewUrl();
    setFiles([...files].reverse());
  };

  const mergePdfs = async () => {
    if (files.length === 0) return;
    setIsMerging(true);
    clearPreviewUrl();

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        if (item.category !== 'pdf' && !item.name.toLowerCase().endsWith('.pdf')) continue;
        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      // Add consistent page numbering across the merged document
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

          // Mask existing footer numbers to prevent collisions
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

      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);

    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("Failed to merge PDFs. Please try again.");
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const finalName = customFilename.trim() || 'Merged_Document.pdf';
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = finalName.toLowerCase().endsWith('.pdf') ? finalName : `${finalName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        <UploadCloud className="dropzone-icon" />
        <h3 className="dropzone-text">
          {isDragActive ? "Drop your PDFs here" : "Drag & drop PDFs here"}
        </h3>
        <p className="dropzone-subtext">or click to browse from your computer (unlimited files supported)</p>
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {files.length} PDF{files.length !== 1 ? 's' : ''} queued — arrange in your desired merge order:
          </span>
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
              title="Reverse the current list order"
            >
              ⇄ Reverse
            </button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="pdf-list">
            {(provided) => (
              <div
                className="pdf-list"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {files.map((pdf, index) => {
                  const isNonPdf = pdf.category !== 'pdf' && !pdf.name.toLowerCase().endsWith('.pdf');
                  return (
                  <Draggable key={pdf.id} draggableId={pdf.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={getDragStyle(provided.draggableProps.style, snapshot)}
                        className={`pdf-item ${snapshot.isDragging ? 'pdf-item-dragging' : ''}`}
                      >
                        <div {...provided.dragHandleProps} className="drag-handle" title="Drag to reorder">
                          <GripVertical size={20} />
                        </div>

                        {/* Order Badge */}
                        <span className="order-badge" title={`Position #${index + 1}`}>{index + 1}</span>

                        <FileText size={24} style={{ color: isNonPdf ? '#ef4444' : '#818cf8', marginRight: '12px', flexShrink: 0 }} />

                        <div className="pdf-info" style={{ flex: 1, minWidth: 0 }}>
                          <span className="pdf-name" style={{ color: isNonPdf ? '#ef4444' : 'inherit' }}>
                            {pdf.name} {isNonPdf && '(Not a PDF)'}
                          </span>
                          <span className="pdf-size">{formatBytes(pdf.size)}</span>
                        </div>

                        {/* Move Up / Move Down buttons */}
                        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
                          <button
                            onClick={() => moveUp(index)}
                            disabled={index === 0}
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
                            disabled={index === files.length - 1}
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

                        <button
                          onClick={() => removeFile(pdf.id)}
                          className="remove-btn"
                          title="Remove File"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                )})}
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
              Choose whether to apply unified page numbers or keep files as-is
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
                Cleanly mask conflicting footer numbers
              </label>
            </div>
          )}
        </div>
      )}

      {files.length > 0 && !previewUrl && (() => {
        const nonPdfCount = files.filter(f => f.category !== 'pdf' && !f.name.toLowerCase().endsWith('.pdf')).length;
        const isMergeDisabled = isMerging || files.length < 2 || nonPdfCount > 0;
        return (
          <>
            {nonPdfCount > 0 && (
              <div className="fc-error" style={{ margin: '16px 0', padding: '12px' }}>
                ⚠ You have {nonPdfCount} non-PDF file(s) in your global list. Please remove them or switch to "Convert & Merge" to process them.
              </div>
            )}
            <div className="actions">
              <button
                className="btn-primary"
                onClick={mergePdfs}
                disabled={isMergeDisabled}
              >
                {isMerging ? (
                  <>
                    <Loader2 className="spin" size={24} />
                    Merging...
                  </>
                ) : (
                  <>
                    <Layers size={24} />
                    Merge {files.length} PDF{files.length !== 1 ? 's' : ''} in Exact Order
                  </>
                )}
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Preview & Download with Custom Renaming ── */}
      {previewUrl && (
        <div className="preview-container">
          <div className="preview-header" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <h3 className="preview-title">Merged PDF Preview</h3>

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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={clearPreviewUrl}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              >
                Re-order / Edit
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
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
}
