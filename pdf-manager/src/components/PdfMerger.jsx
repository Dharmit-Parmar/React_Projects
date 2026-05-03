import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument } from 'pdf-lib';
import { UploadCloud, GripVertical, Trash2, FileText, Layers, Loader2 } from 'lucide-react';

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Fix: @hello-pangea/dnd uses position:fixed for dragging but calculates
// offset relative to the document origin (x=0). Because body has
// justify-content:center the glass-container starts at a positive x offset,
// so items fly to the right. We correct by offsetting the transform's X.
function getDragStyle(style, snapshot) {
  if (!snapshot.isDragging) return style;
  if (!style?.transform) return style;
  // The library sets transform: translate(Xpx, Ypx).
  // We need to subtract the body's left offset caused by flex centering.
  // The simplest reliable fix: override left to match the actual element,
  // and reset any extra horizontal shift in the transform.
  const container = document.querySelector('.glass-container');
  const offsetX = container ? container.getBoundingClientRect().left : 0;
  // Parse existing translate values
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

  const onDrop = useCallback(acceptedFiles => {
    setPreviewUrl(null);
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
  }, [setFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    }
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    setPreviewUrl(null);

    const items = Array.from(files);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFiles(items);
  };

  const removeFile = (id) => {
    setPreviewUrl(null);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const mergePdfs = async () => {
    if (files.length === 0) return;
    setIsMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        if (item.category !== 'pdf' && !item.name.toLowerCase().endsWith('.pdf')) continue;
        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfFile = await mergedPdf.save();

      // Set preview URL instead of downloading immediately
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("Failed to merge PDFs. Please try again.");
    } finally {
      setIsMerging(false);
    }
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
                        <div {...provided.dragHandleProps} className="drag-handle">
                          <GripVertical size={20} />
                        </div>

                        <FileText size={24} style={{ color: isNonPdf ? '#ef4444' : '#818cf8', marginRight: '16px' }} />

                        <div className="pdf-info">
                          <span className="pdf-name" style={{ color: isNonPdf ? '#ef4444' : 'inherit' }}>
                            {pdf.name} {isNonPdf && '(Not a PDF)'}
                          </span>
                          <span className="pdf-size">{formatBytes(pdf.size)}</span>
                        </div>

                        <button
                          onClick={() => removeFile(pdf.id)}
                          className="remove-btn"
                          title="Remove File"
                        >
                          <Trash2 size={20} />
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
                    Merge {files.length} PDF{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </>
        );
      })()}

      {previewUrl && (
        <div className="preview-container">
          <div className="preview-header">
            <h3 className="preview-title">Merged PDF Preview</h3>
            <button
              className="btn-primary"
              onClick={() => {
                const link = document.createElement('a');
                link.href = previewUrl;
                link.download = `Merged_PDF_${new Date().getTime()}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <FileText size={20} />
              Download Merged PDF
            </button>
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
