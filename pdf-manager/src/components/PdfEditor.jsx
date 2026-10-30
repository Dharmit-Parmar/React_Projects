import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import {
  Upload, X, Plus, Minus, ChevronLeft, ChevronRight,
  Type, Pen, Square, Highlighter, Eraser, Download, Image as ImageIcon,
  Undo, Redo, MousePointer, RotateCcw, Check, Sparkles, Move
} from 'lucide-react';

// ── PDF.js worker ────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ── Tool types ───────────────────────────────────────────────────────────────
const TOOLS = {
  SELECT:    'select',    // In-place text edit & erase
  TEXT:      'text',      // Add new text box
  DRAW:      'draw',      // Freehand pen
  HIGHLIGHT: 'highlight', // Highlighter
  RECT:      'rect',      // Shape / redact box
  IMAGE:     'image',     // Insert image
  ERASER:    'eraser',    // Erase annotations
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function applyTransform(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function getStandardFontName(family, isBold, isItalic) {
  if (family === 'TimesRoman') {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  } else if (family === 'Courier') {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  } else {
    if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
    if (isBold) return StandardFonts.HelveticaBold;
    if (isItalic) return StandardFonts.HelveticaOblique;
    return StandardFonts.Helvetica;
  }
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PdfEditor() {
  // File & PDF state
  const [pdfFile, setPdfFile]           = useState(null);
  const [pdfDoc, setPdfDoc]             = useState(null);
  const [pdfBytes, setPdfBytes]         = useState(null);
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [scale, setScale]               = useState(1.6);
  const [isOpen, setIsOpen]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError]               = useState(null);
  const [exportFilename, setExportFilename] = useState('');

  // Active Tool state
  const [tool, setTool]                 = useState(TOOLS.SELECT);
  const [color, setColor]               = useState('#1e293b');
  const [fontSize, setFontSize]         = useState(16);
  const [fontFamily, setFontFamily]     = useState('Helvetica');
  const [isBold, setIsBold]             = useState(false);
  const [isItalic, setIsItalic]         = useState(false);
  const [textAlign, setTextAlign]       = useState('left');
  const [opacity, setOpacity]           = useState(1.0);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight]     = useState(1.4);
  const [rotation, setRotation]         = useState(0);
  const [hasShadow, setHasShadow]       = useState(false);
  const [hasStroke, setHasStroke]       = useState(false);
  const [lineWidth, setLineWidth]       = useState(3);

  // Annotations & Text Edits
  const [annotations, setAnnotations]   = useState([]);
  const [textEdits, setTextEdits]       = useState({}); // { [id]: { id, page, origStr, newStr, x, y, w, h, fontSize, fontFamily, color, isBold, isItalic, textAlign } }
  
  // History state: stores snapshots of { annotations, textEdits }
  const historyRef = useRef([{ annotations: [], textEdits: {} }]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // In-place text-layer items extracted from PDF.js
  const [textItems, setTextItems]       = useState([]);
  const [editingId, setEditingId]       = useState(null);
  const [inlineEditText, setInlineEditText] = useState('');

  // New text box placement
  const [textInput, setTextInput]       = useState({ visible: false, x: 0, y: 0, value: '', editingId: null });

  // Drawing state
  const [isDrawing, setIsDrawing]       = useState(false);
  const [startPos, setStartPos]         = useState(null);

  // Refs
  const drawPathRef    = useRef([]);
  const redrawRef      = useRef(null);
  const pdfCanvasRef   = useRef(null);
  const overlayRef     = useRef(null);
  const renderTaskRef  = useRef(null);
  const fileInputRef   = useRef(null);
  const imageInputRef  = useRef(null);
  const imageCache     = useRef({});
  const textCancelRef  = useRef(false);

  // ── History Push Helper ────────────────────────────────────────────────────
  const pushState = useCallback((newAnnotations, newTextEdits) => {
    const cur = historyRef.current.slice(0, historyIndexRef.current + 1);
    cur.push({
      annotations: newAnnotations !== undefined ? newAnnotations : annotations,
      textEdits: newTextEdits !== undefined ? newTextEdits : textEdits,
    });
    historyRef.current = cur;
    historyIndexRef.current = cur.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [annotations, textEdits]);

  const updateAnnotations = useCallback((updater) => {
    setAnnotations(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pushState(next, undefined);
      return next;
    });
  }, [pushState]);

  const updateTextEdits = useCallback((updater) => {
    setTextEdits(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pushState(undefined, next);
      return next;
    });
  }, [pushState]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const snap = historyRef.current[historyIndexRef.current];
      setAnnotations(snap.annotations);
      setTextEdits(snap.textEdits);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const snap = historyRef.current[historyIndexRef.current];
      setAnnotations(snap.annotations);
      setTextEdits(snap.textEdits);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, []);

  const resetAllState = useCallback(() => {
    setAnnotations([]);
    setTextEdits({});
    historyRef.current = [{ annotations: [], textEdits: {} }];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    setTextItems([]);
    setEditingId(null);
    setTextInput({ visible: false, x: 0, y: 0, value: '', editingId: null });
  }, []);

  // ── Load PDF from File ──────────────────────────────────────────────────────
  const loadPdf = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      setPdfBytes(bytes);

      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setCurrentPage(1);
      resetAllState();
      setExportFilename(`edited_${file.name.replace(/\.[^.]+$/, '')}.pdf`);
      setIsOpen(true);
    } catch (e) {
      setError('Failed to load PDF: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [resetAllState]);

  // ── Page Change Handler (Fixes Page Navigation Glitch) ──────────────────────
  const changePage = useCallback((newPage) => {
    if (newPage < 1 || newPage > pageCount || newPage === currentPage) return;
    
    // 1. Immediately cancel active rendering task
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch (_) {}
      renderTaskRef.current = null;
    }

    // 2. Clear canvas immediately to prevent stale visual bleed
    const canvas = pdfCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }

    // 3. Clear transient interactive state
    setTextItems([]);
    setEditingId(null);
    setTextInput({ visible: false, x: 0, y: 0, value: '', editingId: null });
    setIsDrawing(false);

    // 4. Update page number and signal loading
    setIsPageLoading(true);
    setCurrentPage(newPage);
  }, [pageCount, currentPage]);

  // ── Render Current Page Onto Canvas ─────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !isOpen) return;

    let cancelled = false;
    (async () => {
      try {
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        const overlay = overlayRef.current;

        if (!canvas || !overlay || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        overlay.width = Math.floor(viewport.width);
        overlay.height = Math.floor(viewport.height);

        const ctx = canvas.getContext('2d');
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;

        await task.promise;
        if (cancelled) return;

        setIsPageLoading(false);

        // Extract text layer items for live in-place editing
        const tc = await page.getTextContent();
        if (cancelled) return;

        const items = tc.items.map((item, i) => {
          const tx = applyTransform(viewport.transform, item.transform);
          const w  = item.width * scale;
          const h  = item.height > 0 ? item.height * scale : Math.abs(tx[3]);

          const fontNameLower = (item.fontName || '').toLowerCase();
          const isBold = fontNameLower.includes('bold') || fontNameLower.includes('black') || fontNameLower.includes('heavy');
          const isItalic = fontNameLower.includes('italic') || fontNameLower.includes('oblique');
          let detectedFamily = 'Helvetica';
          if (fontNameLower.includes('times') || fontNameLower.includes('serif') || fontNameLower.includes('roman') || fontNameLower.includes('georgia')) {
            detectedFamily = 'TimesRoman';
          } else if (fontNameLower.includes('courier') || fontNameLower.includes('mono') || fontNameLower.includes('code')) {
            detectedFamily = 'Courier';
          }

          // Sample canvas background color behind text to avoid "white tape" effect
          let bgColor = '#ffffff';
          try {
            const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.floor(tx[4] - 2)));
            const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.floor(tx[5] - h / 2)));
            const p = ctx.getImageData(sampleX, sampleY, 1, 1).data;
            if (p[3] > 0) {
              bgColor = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
            }
          } catch (_) {}

          return {
            id: `${currentPage}-${i}`,
            str: item.str,
            origStr: item.str,
            x: tx[4],
            y: tx[5] - h,
            w: Math.max(w, 20),
            h: Math.max(h, 12),
            fontSize: Math.abs(tx[3]) || 14,
            isBold,
            isItalic,
            fontFamily: detectedFamily,
            bgColor,
          };
        }).filter(it => it.str.trim().length > 0);

        if (!cancelled) {
          setTextItems(items);
          if (redrawRef.current) redrawRef.current();
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('PDF page render error:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, scale, isOpen]);

  // ── Redraw Overlay: In-Place Text Edits + Annotations ────────────────────────
  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // 1. Draw In-Place Text Edits (Seamless background color matching)
    const pageEdits = Object.values(textEdits).filter(e => e.page === currentPage);
    for (const edit of pageEdits) {
      ctx.save();
      const weight = edit.isBold ? 'bold' : 'normal';
      const style  = edit.isItalic ? 'italic' : 'normal';
      const family = edit.fontFamily === 'TimesRoman' ? '"Times New Roman", serif' :
                     edit.fontFamily === 'Courier' ? '"Courier New", monospace' :
                     'Helvetica, Arial, sans-serif';
      ctx.font = `${style} ${weight} ${edit.fontSize}px ${family}`;

      // Measure replacement text width so background patch fits naturally
      const measuredW = edit.newStr ? ctx.measureText(edit.newStr).width : 0;
      const patchW = Math.max(edit.w, measuredW) + 6;
      const patchH = Math.max(edit.h, edit.fontSize * 0.9) + 4;

      // Sampled background color ensures seamless blending without "white tape" effect
      ctx.fillStyle = edit.bgColor || '#ffffff';
      ctx.fillRect(edit.x - 2, edit.y - 2, patchW, patchH);

      // Draw replacement text if not erased
      if (edit.newStr && edit.newStr.trim().length > 0) {
        ctx.fillStyle = edit.color || '#1e293b';
        ctx.textBaseline = 'top';
        ctx.fillText(edit.newStr, edit.x, edit.y);
      }
      ctx.restore();
    }

    // 2. Draw Custom Annotations for Current Page
    const pageAnnotations = annotations.filter(a => a.page === currentPage);
    for (const ann of pageAnnotations) {
      ctx.save();
      if (ann.type === TOOLS.DRAW) {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth   = ann.lineWidth;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ann.path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      } else if (ann.type === TOOLS.HIGHLIGHT) {
        ctx.fillStyle = ann.color + '55'; // Translucent
        ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
      } else if (ann.type === TOOLS.RECT) {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth   = ann.lineWidth;
        ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
      } else if (ann.type === TOOLS.TEXT) {
        ctx.fillStyle   = ann.color;
        ctx.globalAlpha = ann.opacity ?? 1.0;
        ctx.textAlign   = ann.textAlign || 'left';
        if (ann.letterSpacing) ctx.letterSpacing = `${ann.letterSpacing}px`;

        const weight = ann.isBold ? 'bold' : 'normal';
        const style  = ann.isItalic ? 'italic' : 'normal';
        const family = ann.fontFamily === 'TimesRoman' ? '"Times New Roman", serif' :
                       ann.fontFamily === 'Courier' ? '"Courier New", monospace' :
                       'Helvetica, Arial, sans-serif';
        ctx.font = `${style} ${weight} ${ann.fontSize}px ${family}`;

        if (ann.hasShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        ctx.translate(ann.x, ann.y);
        if (ann.rotation) ctx.rotate((ann.rotation * Math.PI) / 180);

        const lines = (ann.text || '').split('\n');
        const lh = (ann.lineHeight || 1.4) * ann.fontSize;
        
        lines.forEach((line, i) => {
          ctx.fillText(line, 0, i * lh);
          if (ann.hasStroke) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = ann.color;
            ctx.strokeText(line, 0, i * lh);
          }
        });
      } else if (ann.type === TOOLS.IMAGE && ann.dataUrl) {
        if (imageCache.current[ann.id]) {
          ctx.drawImage(imageCache.current[ann.id], ann.x, ann.y, ann.w, ann.h);
        } else {
          const img = new Image();
          img.onload = () => {
            imageCache.current[ann.id] = img;
            if (redrawRef.current) redrawRef.current();
          };
          img.src = ann.dataUrl;
        }
      }
      ctx.restore();
    }
  }, [annotations, textEdits, currentPage]);

  useEffect(() => { redrawRef.current = redrawOverlay; }, [redrawOverlay]);
  useEffect(() => { redrawOverlay(); }, [annotations, textEdits, currentPage, redrawOverlay]);

  // ── Canvas Pointer Event Coordinates ────────────────────────────────────────
  const getPos = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (overlayRef.current.width  / rect.width),
      y: (e.clientY - rect.top)  * (overlayRef.current.height / rect.height),
    };
  };

  const onPointerDown = (e) => {
    if (tool === TOOLS.SELECT) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const pos = getPos(e);

    // Insert Image
    if (tool === TOOLS.IMAGE) {
      imageInputRef.current._pendingPos = pos;
      imageInputRef.current.value = '';
      imageInputRef.current.click();
      return;
    }

    // Add New Text Box
    if (tool === TOOLS.TEXT) {
      if (textInput.visible) return;
      e.preventDefault();
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: '', editingId: null });
      return;
    }

    // Eraser Tool
    if (tool === TOOLS.ERASER) {
      updateAnnotations(prev => prev.filter(a => {
        if (a.page !== currentPage) return true;
        if (a.type === TOOLS.DRAW) {
          return !a.path.some(([px, py]) => Math.hypot(px - pos.x, py - pos.y) < 15);
        }
        const { x = 0, y = 0, w = 0, h = 0 } = a;
        return !(pos.x >= x && pos.x <= x + w && pos.y >= y - (a.type === TOOLS.TEXT ? a.fontSize : 0) && pos.y <= y + h);
      }));
      return;
    }

    // Draw / Highlight / Rect
    setIsDrawing(true);
    setStartPos(pos);
    if (tool === TOOLS.DRAW) {
      drawPathRef.current = [[pos.x, pos.y]];
    }
  };

  const onPointerMove = (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);

    if (tool === TOOLS.DRAW) {
      drawPathRef.current = [...drawPathRef.current, [pos.x, pos.y]];
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (redrawRef.current) redrawRef.current();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidth;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      drawPathRef.current.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    } else if (tool === TOOLS.HIGHLIGHT || tool === TOOLS.RECT) {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (redrawRef.current) redrawRef.current();
      const w = pos.x - startPos.x;
      const h = pos.y - startPos.y;
      if (tool === TOOLS.HIGHLIGHT) {
        ctx.fillStyle = color + '55';
        ctx.fillRect(startPos.x, startPos.y, w, h);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.strokeRect(startPos.x, startPos.y, w, h);
      }
    }
  };

  const onPointerUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const pos = getPos(e);

    if (tool === TOOLS.DRAW) {
      if (startPos && drawPathRef.current.length > 1) {
        updateAnnotations(prev => [...prev, {
          id: Date.now(), type: tool, page: currentPage,
          path: drawPathRef.current, color, lineWidth,
        }]);
      }
      drawPathRef.current = [];
    } else if (tool === TOOLS.HIGHLIGHT || tool === TOOLS.RECT) {
      const w = pos.x - startPos.x;
      const h = pos.y - startPos.y;
      if (startPos && Math.abs(w) > 2 && Math.abs(h) > 2) {
        updateAnnotations(prev => [...prev, {
          id: Date.now(), type: tool, page: currentPage,
          x: Math.min(startPos.x, pos.x),
          y: Math.min(startPos.y, pos.y),
          w: Math.abs(w),
          h: Math.abs(h),
          color, lineWidth,
        }]);
      }
    }
    setStartPos(null);
  };

  // ── Commit In-Place Text Edit / Deletion ────────────────────────────────────
  const commitInPlaceEdit = (item, newString) => {
    const trimmed = newString;
    updateTextEdits(prev => ({
      ...prev,
      [item.id]: {
        id: item.id,
        page: currentPage,
        origStr: item.origStr,
        newStr: trimmed,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        fontSize: fontSize || item.fontSize,
        fontFamily: fontFamily || item.fontFamily,
        color: color || '#1e293b',
        bgColor: item.bgColor || '#ffffff',
        isBold: isBold !== undefined ? isBold : item.isBold,
        isItalic: isItalic !== undefined ? isItalic : item.isItalic,
        textAlign,
      }
    }));
    setEditingId(null);
  };

  const eraseInPlaceText = (item) => {
    commitInPlaceEdit(item, '');
  };

  const resetInPlaceText = (item) => {
    updateTextEdits(prev => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });
    setEditingId(null);
  };

  // ── Save / Export Modified PDF ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!pdfBytes) return;
    try {
      const pdfLibDoc = await PDFDocument.load(pdfBytes);
      const pages     = pdfLibDoc.getPages();
      const fontCache = {};

      const getCachedFont = async (fFamily, fBold, fItalic) => {
        const key = `${fFamily}-${fBold}-${fItalic}`;
        if (!fontCache[key]) {
          fontCache[key] = await pdfLibDoc.embedFont(getStandardFontName(fFamily, fBold, fItalic));
        }
        return fontCache[key];
      };

      // 1. Apply All In-Place Text Edits & Deletions
      for (const edit of Object.values(textEdits)) {
        const pageIdx = edit.page - 1;
        const pg = pages[pageIdx];
        if (!pg) continue;

        const { height } = pg.getSize();
        const ix = edit.x / scale;
        const iy = height - (edit.y + edit.h) / scale;
        const iw = (edit.w + 4) / scale;
        const ih = (edit.h + 4) / scale;

        const font = await getCachedFont(edit.fontFamily, edit.isBold, edit.isItalic);
        const { r, g, b } = hexToRgb(edit.color || '#1e293b');
        const editSize = Math.max(6, (edit.fontSize || 14) / scale);

        // Measure text width for accurate coverage
        let textWidth = 0;
        try {
          textWidth = font.widthOfTextAtSize(edit.newStr || '', editSize);
        } catch (_) {}

        const patchW = Math.max(iw + 4, textWidth + 8);

        // Match background color of page (avoiding harsh white tape)
        let bgR = 1, bgG = 1, bgB = 1;
        if (edit.bgColor && edit.bgColor.startsWith('rgb')) {
          const match = edit.bgColor.match(/\d+/g);
          if (match && match.length >= 3) {
            bgR = parseInt(match[0]) / 255;
            bgG = parseInt(match[1]) / 255;
            bgB = parseInt(match[2]) / 255;
          }
        }

        pg.drawRectangle({
          x: ix - 2,
          y: iy - 2,
          width: patchW,
          height: ih + 4,
          color: rgb(bgR, bgG, bgB),
        });

        // Draw new replacement text if not erased
        if (edit.newStr && edit.newStr.trim().length > 0) {
          pg.drawText(edit.newStr, {
            x: ix,
            y: iy + 2,
            size: editSize,
            font,
            color: rgb(r, g, b),
            maxWidth: Math.max(patchW * 1.5, 300),
          });
        }
      }

      // 2. Apply Custom Annotations
      for (const ann of annotations) {
        const page = pages[ann.page - 1];
        if (!page) continue;
        const { height } = page.getSize();
        const { r, g, b } = hexToRgb(ann.color || '#ff0000');

        if (ann.type === TOOLS.TEXT) {
          const font = await getCachedFont(ann.fontFamily, ann.isBold, ann.isItalic);
          const fontSizeScaled = ann.fontSize / scale;
          const px = ann.x / scale;
          const py = height - (ann.y / scale);
          const textOpacity = ann.opacity ?? 1.0;
          const lhScaled = (ann.lineHeight || 1.4) * fontSizeScaled;
          const rotationAngle = ann.rotation ? degrees(-ann.rotation) : undefined;
          const lines = (ann.text || '').split('\n');

          lines.forEach((line, i) => {
            const lineY = py - (i * lhScaled) - fontSizeScaled;
            page.drawText(line, {
              x: px,
              y: lineY,
              size: fontSizeScaled,
              font,
              color: rgb(r, g, b),
              opacity: textOpacity,
              rotate: rotationAngle
            });
          });
        } else if (ann.type === TOOLS.DRAW) {
          for (let i = 1; i < ann.path.length; i++) {
            const [x1, y1] = ann.path[i - 1];
            const [x2, y2] = ann.path[i];
            page.drawLine({
              start: { x: x1 / scale, y: height - y1 / scale },
              end:   { x: x2 / scale, y: height - y2 / scale },
              thickness: ann.lineWidth / scale,
              color: rgb(r, g, b)
            });
          }
        } else if (ann.type === TOOLS.HIGHLIGHT) {
          page.drawRectangle({
            x: ann.x / scale,
            y: height - (ann.y + ann.h) / scale,
            width: ann.w / scale,
            height: Math.abs(ann.h / scale),
            color: rgb(r, g, b),
            opacity: 0.35
          });
        } else if (ann.type === TOOLS.RECT) {
          page.drawRectangle({
            x: ann.x / scale,
            y: height - (ann.y + ann.h) / scale,
            width: ann.w / scale,
            height: Math.abs(ann.h / scale),
            borderColor: rgb(r, g, b),
            borderWidth: ann.lineWidth / scale,
            color: rgb(1, 1, 1),
            opacity: 0
          });
        } else if (ann.type === TOOLS.IMAGE && ann.dataUrl) {
          try {
            const imgBuf = await (await fetch(ann.dataUrl)).arrayBuffer();
            const embedded = ann.mimeType === 'image/png'
              ? await pdfLibDoc.embedPng(imgBuf)
              : await pdfLibDoc.embedJpg(imgBuf);
            page.drawImage(embedded, {
              x: ann.x / scale,
              y: height - (ann.y + ann.h) / scale,
              width: Math.abs(ann.w / scale),
              height: Math.abs(ann.h / scale)
            });
          } catch (_) {}
        }
      }

      // Download file with user's customized name
      const safeName = (exportFilename.trim() || 'edited_document.pdf').replace(/\.pdf$/i, '') + '.pdf';
      const savedBytes = await pdfLibDoc.save();
      const blob = new Blob([savedBytes], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  };

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') {
      setPdfFile(file);
      loadPdf(file);
    } else {
      alert('Please select a valid PDF file.');
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file?.type === 'application/pdf') {
      setPdfFile(file);
      loadPdf(file);
    }
  };

  const handleImageInput = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const pos = imageInputRef.current._pendingPos || { x: 40, y: 40 };
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const imgEl   = document.createElement('img');
      imgEl.src     = dataUrl;
      imgEl.onload  = () => {
        const w = 160;
        const h = Math.round((imgEl.naturalHeight / imgEl.naturalWidth) * w);
        updateAnnotations(prev => [...prev, {
          id: Date.now(), type: TOOLS.IMAGE, page: currentPage,
          x: pos.x, y: pos.y, w, h,
          dataUrl, mimeType: file.type,
        }]);
      };
    };
    reader.readAsDataURL(file);
  };

  const closeEditor = () => {
    if (pdfDoc) {
      try { pdfDoc.cleanup(); pdfDoc.destroy(); } catch (_) {}
    }
    setIsOpen(false);
    setPdfDoc(null);
    setPdfFile(null);
    setPdfBytes(null);
    resetAllState();
  };

  // ── Upload Screen ──────────────────────────────────────────────────────────
  if (!isOpen) {
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #090d16 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.05)', borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px',
            color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.04em'
          }}>
            <Sparkles size={14} /> PDF STUDIO & LIVE EDITOR
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px', padding: '12px 18px', color: '#fca5a5', marginBottom: '24px',
            maxWidth: '480px', width: '100%', fontSize: '0.9rem', textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed rgba(99,102,241,0.4)', borderRadius: '24px',
            padding: '56px 40px', textAlign: 'center', cursor: 'pointer',
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)',
            transition: 'all 0.25s ease', maxWidth: '480px', width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <div style={{
            width: '80px', height: '80px', borderRadius: '22px',
            background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.25))',
            border: '1px solid rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            {loading ? (
              <div style={{
                width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.3)',
                borderTop: '3px solid #818cf8', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            ) : (
              <Upload size={36} color="#a5b4fc" />
            )}
          </div>
          <h3 style={{ color: '#f8fafc', fontSize: '1.4rem', margin: '0 0 10px', fontWeight: 600 }}>
            {loading ? 'Opening PDF Document...' : 'Select or Drop PDF to Edit'}
          </h3>
          <p style={{ color: '#94a3b8', margin: '0 0 24px', fontSize: '0.9rem' }}>
            Directly edit headings, erase text, annotate, draw, and export
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['In-Place Text Editing', 'Text Deletion / Whiteout', 'Sign & Draw', 'Highlight', 'Undo/Redo'].map(pill => (
              <span key={pill} style={{
                fontSize: '11px', color: '#cbd5e1', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 10px'
              }}>{pill}</span>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ── Toolbar Button Definitions ─────────────────────────────────────────────
  const TOOL_GROUPS = [
    {
      title: 'Text',
      items: [
        { id: TOOLS.SELECT,    icon: <MousePointer size={18}/>, label: 'Edit Text',  hint: 'Click existing PDF text to edit or erase' },
        { id: TOOLS.TEXT,      icon: <Type size={18}/>,         label: 'Add Text',   hint: 'Place new text box anywhere' },
      ]
    },
    {
      title: 'Annotate',
      items: [
        { id: TOOLS.DRAW,      icon: <Pen size={18}/>,          label: 'Pen',        hint: 'Freehand drawing' },
        { id: TOOLS.HIGHLIGHT, icon: <Highlighter size={18}/>,  label: 'Highlight',  hint: 'Translucent text marker' },
        { id: TOOLS.RECT,      icon: <Square size={18}/>,       label: 'Rectangle',  hint: 'Solid frame or redaction box' },
      ]
    },
    {
      title: 'Media',
      items: [
        { id: TOOLS.IMAGE,     icon: <ImageIcon size={18}/>,    label: 'Image',      hint: 'Insert logo, stamp, or photo' },
        { id: TOOLS.ERASER,    icon: <Eraser size={18}/>,       label: 'Eraser',     hint: 'Click annotation to erase' },
      ]
    }
  ];

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0b0f19', display: 'flex', flexDirection: 'column',
      userSelect: 'none', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif'
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        height: '56px', background: 'rgba(15,23,42,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0, gap: '16px', backdropFilter: 'blur(16px)'
      }}>
        {/* Left: Document Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #4f46e5, #9333ea)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(79,70,229,0.3)'
          }}>
            <Type size={16} color="white" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc',
              maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {pdfFile?.name}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {pageCount} page{pageCount > 1 ? 's' : ''} · In-Place Editing Ready
            </span>
          </div>
        </div>

        {/* Center: Pagination & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Pagination Controls */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage <= 1 || isPageLoading}
              title="Previous Page"
              style={{
                background: 'transparent', border: 'none', borderRadius: '6px',
                color: currentPage <= 1 ? '#475569' : '#cbd5e1', padding: '6px 8px',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', display: 'flex'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{
              fontSize: '12px', fontWeight: 600, color: '#e2e8f0', minWidth: '80px',
              textAlign: 'center', fontVariantNumeric: 'tabular-nums'
            }}>
              {isPageLoading ? 'Loading…' : `Page ${currentPage} / ${pageCount}`}
            </span>

            <button
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage >= pageCount || isPageLoading}
              title="Next Page"
              style={{
                background: 'transparent', border: 'none', borderRadius: '6px',
                color: currentPage >= pageCount ? '#475569' : '#cbd5e1', padding: '6px 8px',
                cursor: currentPage >= pageCount ? 'not-allowed' : 'pointer', display: 'flex'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              onClick={() => setScale(s => Math.max(0.6, +(s - 0.2).toFixed(1)))}
              title="Zoom Out"
              style={{
                background: 'transparent', border: 'none', borderRadius: '6px',
                color: '#cbd5e1', padding: '6px 8px', cursor: 'pointer', display: 'flex'
              }}
            >
              <Minus size={14} />
            </button>

            <span style={{
              fontSize: '12px', fontWeight: 600, color: '#e2e8f0', minWidth: '50px',
              textAlign: 'center', fontVariantNumeric: 'tabular-nums'
            }}>
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={() => setScale(s => Math.min(3.0, +(s + 0.2).toFixed(1)))}
              title="Zoom In"
              style={{
                background: 'transparent', border: 'none', borderRadius: '6px',
                color: '#cbd5e1', padding: '6px 8px', cursor: 'pointer', display: 'flex'
              }}
            >
              <Plus size={14} />
            </button>

            <button
              onClick={() => setScale(1.4)}
              title="Reset Zoom (Fit)"
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '5px',
                color: '#94a3b8', fontSize: '11px', padding: '3px 8px', cursor: 'pointer'
              }}
            >
              Fit
            </button>
          </div>
        </div>

        {/* Right: Export & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Filename Rename Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              value={exportFilename}
              onChange={e => setExportFilename(e.target.value)}
              placeholder="Filename.pdf"
              title="Set name for downloaded PDF"
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', color: '#f8fafc', padding: '6px 10px', fontSize: '12px',
                width: '160px', outline: 'none'
              }}
            />
          </div>

          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem', boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={15} /> Export PDF
          </button>

          <button
            onClick={closeEditor}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: 500, transition: 'all 0.15s ease'
            }}
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Tools Dock ── */}
        <div style={{
          width: '76px', background: 'rgba(15,23,42,0.92)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '16px 8px', gap: '16px', overflowY: 'auto', flexShrink: 0
        }}>
          {TOOL_GROUPS.map((group, gIdx) => (
            <div key={group.title} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                color: '#475569', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px'
              }}>
                {group.title}
              </div>
              {group.items.map(t => {
                const isActive = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTool(t.id);
                      setEditingId(null);
                    }}
                    title={`${t.label} - ${t.hint}`}
                    style={{
                      width: '60px', height: '54px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '4px',
                      borderRadius: '10px', border: 'none', cursor: 'pointer',
                      fontSize: '10px', fontWeight: 600, transition: 'all 0.15s ease',
                      background: isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                      color: isActive ? '#a5b4fc' : '#94a3b8',
                      boxShadow: isActive ? '0 0 0 1.5px rgba(99,102,241,0.6), 0 2px 8px rgba(99,102,241,0.2)' : 'none',
                    }}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
              {gIdx < TOOL_GROUPS.length - 1 && (
                <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              )}
            </div>
          ))}

          {/* Undo / Redo / Reset Page */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: 'auto' }}>
            <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
            
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              style={{
                width: '60px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '4px', borderRadius: '8px', border: 'none', cursor: canUndo ? 'pointer' : 'not-allowed',
                background: canUndo ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: canUndo ? '#cbd5e1' : '#334155', fontSize: '11px', fontWeight: 500
              }}
            >
              <Undo size={14} /> Undo
            </button>

            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              style={{
                width: '60px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '4px', borderRadius: '8px', border: 'none', cursor: canRedo ? 'pointer' : 'not-allowed',
                background: canRedo ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: canRedo ? '#cbd5e1' : '#334155', fontSize: '11px', fontWeight: 500
              }}
            >
              <Redo size={14} /> Redo
            </button>

            <button
              onClick={() => {
                if (window.confirm('Clear all annotations and edits on this page?')) {
                  updateAnnotations(prev => prev.filter(a => a.page !== currentPage));
                  updateTextEdits(prev => {
                    const copy = { ...prev };
                    Object.keys(copy).forEach(k => {
                      if (copy[k].page === currentPage) delete copy[k];
                    });
                    return copy;
                  });
                }
              }}
              title="Clear all modifications on current page"
              style={{
                width: '60px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: '10px', fontWeight: 600
              }}
            >
              <RotateCcw size={13} /> Clear
            </button>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageInput}
            style={{ display: 'none' }}
          />
        </div>

        {/* ── Document Canvas Area ── */}
        <div style={{
          flex: 1, overflow: 'auto', background: '#090d16',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          padding: '32px', position: 'relative'
        }}>
          <div style={{
            position: 'relative', display: 'inline-block',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
            borderRadius: '6px', lineHeight: 0, overflow: 'visible',
            background: 'white'
          }}>
            {/* Underlying PDF Page Canvas */}
            <canvas ref={pdfCanvasRef} style={{ display: 'block', borderRadius: '6px' }} />

            {/* Interactive Drawing & Overlay Canvas */}
            <canvas
              ref={overlayRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              style={{
                position: 'absolute', top: 0, left: 0, borderRadius: '6px',
                cursor: tool === TOOLS.TEXT   ? 'text'
                      : tool === TOOLS.ERASER ? 'cell'
                      : tool === TOOLS.SELECT ? 'default'
                      : 'crosshair',
                pointerEvents: textInput.visible ? 'none' : 'auto',
              }}
            />

            {/* ── In-Place Text Editing Layer (SELECT Mode) ── */}
            {tool === TOOLS.SELECT && textItems.map(item => {
              const isBeingEdited = editingId === item.id;
              const currentEdit = textEdits[item.id];
              const displayStr = currentEdit !== undefined ? currentEdit.newStr : item.str;
              const isErased = currentEdit !== undefined && currentEdit.newStr === '';

              return (
                <div
                  key={item.id}
                  title="Click to edit, rewrite, or delete this text"
                  onClick={() => {
                    setEditingId(item.id);
                    setInlineEditText(displayStr);
                    // Inherit exact font formatting from original PDF text
                    if (item.fontSize) setFontSize(Math.round(item.fontSize));
                    if (item.fontFamily) setFontFamily(item.fontFamily);
                    if (item.isBold !== undefined) setIsBold(item.isBold);
                    if (item.isItalic !== undefined) setIsItalic(item.isItalic);
                  }}
                  style={{
                    position: 'absolute',
                    left: item.x - 2,
                    top: item.y - 2,
                    width: item.w + 4,
                    height: item.h + 4,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    borderRadius: '4px',
                    border: isBeingEdited
                      ? '2px solid #6366f1'
                      : isErased
                      ? '1px dashed rgba(239,68,68,0.4)'
                      : '1px solid transparent',
                    background: isBeingEdited
                      ? 'rgba(99,102,241,0.1)'
                      : 'transparent',
                    zIndex: isBeingEdited ? 50 : 10,
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isBeingEdited) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)';
                  }}
                  onMouseLeave={e => {
                    if (!isBeingEdited && !isErased) e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  {isBeingEdited && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', left: 0, top: 0,
                        minWidth: Math.max(item.w + 60, 220),
                        background: '#ffffff',
                        border: '1.5px solid #6366f1',
                        borderRadius: '6px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                        padding: '4px 6px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        zIndex: 100
                      }}
                    >
                      <input
                        autoFocus
                        value={inlineEditText}
                        onChange={e => setInlineEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            commitInPlaceEdit(item, inlineEditText);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        placeholder="Type replacement text or click × to clear..."
                        style={{
                          flex: 1, border: 'none', outline: 'none', background: 'transparent',
                          color: '#0f172a', fontSize: `${Math.max(12, item.fontSize * 0.9)}px`,
                          fontFamily: fontFamily === 'TimesRoman' ? '"Times New Roman", serif' :
                                      fontFamily === 'Courier' ? '"Courier New", monospace' :
                                      'Helvetica, Arial, sans-serif',
                          padding: '2px 4px',
                        }}
                      />

                      {/* Clear / Erase Button */}
                      <button
                        onClick={() => eraseInPlaceText(item)}
                        title="Erase / Whiteout this text"
                        style={{
                          background: 'rgba(239,68,68,0.1)', border: 'none',
                          borderRadius: '4px', color: '#ef4444', padding: '3px 6px',
                          cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px'
                        }}
                      >
                        <X size={12} /> Clear
                      </button>

                      {/* Reset to Original Button */}
                      {currentEdit && (
                        <button
                          onClick={() => resetInPlaceText(item)}
                          title="Reset to original PDF text"
                          style={{
                            background: 'rgba(100,116,139,0.1)', border: 'none',
                            borderRadius: '4px', color: '#64748b', padding: '3px 6px',
                            cursor: 'pointer', fontSize: '11px', fontWeight: 500
                          }}
                        >
                          Reset
                        </button>
                      )}

                      {/* Apply Button */}
                      <button
                        onClick={() => commitInPlaceEdit(item, inlineEditText)}
                        title="Apply (Enter)"
                        style={{
                          background: '#4f46e5', border: 'none',
                          borderRadius: '4px', color: 'white', padding: '3px 8px',
                          cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center'
                        }}
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Add New Text Box (TEXT Mode) ── */}
            {textInput.visible && (
              <div
                style={{
                  position: 'absolute', left: textInput.x, top: textInput.y - fontSize,
                  zIndex: 60, cursor: 'move',
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'left top',
                  background: 'rgba(15,23,42,0.92)',
                  backdropFilter: 'blur(12px)',
                  minWidth: '220px',
                  border: '1px solid rgba(99,102,241,0.6)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
                onPointerDown={e => {
                  if (e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'button') return;
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = overlayRef.current.getBoundingClientRect();
                  const px = (e.clientX - rect.left) * (overlayRef.current.width  / rect.width);
                  const py = (e.clientY - rect.top)  * (overlayRef.current.height / rect.height);
                  e.currentTarget.dataset.dragging = 'true';
                  e.currentTarget.dataset.offsetX = px - textInput.x;
                  e.currentTarget.dataset.offsetY = py - (textInput.y - fontSize);
                }}
                onPointerMove={e => {
                  if (e.currentTarget.dataset.dragging === 'true') {
                    const rect = overlayRef.current.getBoundingClientRect();
                    const px = (e.clientX - rect.left) * (overlayRef.current.width  / rect.width);
                    const py = (e.clientY - rect.top)  * (overlayRef.current.height / rect.height);
                    setTextInput(prev => ({
                      ...prev,
                      x: px - parseFloat(e.currentTarget.dataset.offsetX),
                      y: py - parseFloat(e.currentTarget.dataset.offsetY) + fontSize
                    }));
                  }
                }}
                onPointerUp={e => {
                  e.currentTarget.dataset.dragging = 'false';
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const ta = e.currentTarget.querySelector('textarea');
                  if (ta) ta.focus();
                }}
              >
                {/* Drag handle header */}
                <div style={{
                  height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 8px', background: 'rgba(99,102,241,0.2)',
                  borderBottom: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '9px 9px 0 0', cursor: 'move'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a5b4fc', fontSize: '10px', fontWeight: 600 }}>
                    <Move size={10} /> Text Box
                  </div>
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      textCancelRef.current = true;
                      setTextInput({ visible: false, x: 0, y: 0, value: '', editingId: null });
                    }}
                    style={{
                      width: '16px', height: '16px', background: 'rgba(239,68,68,0.8)',
                      color: 'white', border: 'none', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '10px', fontWeight: 'bold'
                    }}
                    title="Cancel (Esc)"
                  >
                    ×
                  </button>
                </div>

                <textarea
                  autoFocus
                  value={textInput.value}
                  placeholder="Type text here..."
                  onChange={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                    setTextInput(prev => ({ ...prev, value: e.target.value }));
                  }}
                  onBlur={() => {
                    if (textCancelRef.current) {
                      textCancelRef.current = false;
                      setTextInput({ visible: false, x: 0, y: 0, value: '', editingId: null });
                      return;
                    }
                    if (textInput.value.trim()) {
                      const annData = {
                        id: textInput.editingId ?? Date.now(),
                        type: TOOLS.TEXT, page: currentPage,
                        x: textInput.x, y: textInput.y, text: textInput.value,
                        color, fontSize, fontFamily, isBold, isItalic,
                        textAlign, opacity, letterSpacing, lineHeight, rotation, hasShadow, hasStroke
                      };
                      if (textInput.editingId) {
                        updateAnnotations(prev => prev.map(a => a.id === textInput.editingId ? annData : a));
                      } else {
                        updateAnnotations(prev => [...prev, annData]);
                      }
                    }
                    setTextInput({ visible: false, x: 0, y: 0, value: '', editingId: null });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      textCancelRef.current = true;
                      e.target.blur();
                    }
                  }}
                  style={{
                    color, fontSize: `${fontSize}px`,
                    fontFamily: fontFamily === 'TimesRoman' ? '"Times New Roman", serif' :
                                fontFamily === 'Courier' ? '"Courier New", monospace' :
                                'Helvetica, Arial, sans-serif',
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    textAlign, opacity, letterSpacing: `${letterSpacing}px`, lineHeight,
                    textShadow: hasShadow ? `2px 2px 4px rgba(0,0,0,0.5)` : 'none',
                    WebkitTextStroke: hasStroke ? `1px ${color}` : 'none',
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: '8px', width: '100%', resize: 'none', overflow: 'hidden',
                    display: 'block', boxSizing: 'border-box', minHeight: '40px',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Right Properties Panel ── */}
        <div style={{
          width: '280px', background: 'rgba(15,23,42,0.95)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', padding: '20px',
          gap: '18px', overflowY: 'auto', flexShrink: 0
        }}>
          <div style={{
            color: '#cbd5e1', fontSize: '11px', fontWeight: 700,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase'
          }}>
            {tool === TOOLS.SELECT ? 'Text Selection & Eraser' :
             tool === TOOLS.TEXT ? 'Text Tool Settings' :
             tool === TOOLS.DRAW ? 'Pen Properties' :
             tool === TOOLS.HIGHLIGHT ? 'Highlighter Properties' :
             tool === TOOLS.RECT ? 'Rectangle Properties' : 'Tool Settings'}
          </div>

          {/* Color Picker with Quick Swatches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
              Color
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['#0f172a', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ffffff'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: '26px', height: '26px', borderRadius: '6px',
                    background: c, border: color === c ? '2px solid #818cf8' : '1px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer', boxShadow: color === c ? '0 0 0 1px #818cf8' : 'none'
                  }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{
                  width: '26px', height: '26px', borderRadius: '6px',
                  border: 'none', background: 'none', cursor: 'pointer', padding: 0
                }}
                title="Custom color"
              />
            </div>
          </div>

          {/* Stroke Width (for Draw & Rect) */}
          {(tool === TOOLS.DRAW || tool === TOOLS.RECT) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Thickness
                </span>
                <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>{lineWidth}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                value={lineWidth}
                onChange={e => setLineWidth(+e.target.value)}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
            </div>
          )}

          {/* Text Controls (for SELECT & TEXT tools) */}
          {(tool === TOOLS.SELECT || tool === TOOLS.TEXT) && (
            <>
              {/* Font Family */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Font Family
                </div>
                <select
                  value={fontFamily}
                  onChange={e => setFontFamily(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                    color: '#f8fafc', padding: '8px 10px', fontSize: '12px', outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Helvetica" style={{ background: '#1e293b' }}>Helvetica (Clean Sans)</option>
                  <option value="TimesRoman" style={{ background: '#1e293b' }}>Times Roman (Classic Serif)</option>
                  <option value="Courier" style={{ background: '#1e293b' }}>Courier (Monospace)</option>
                </select>
              </div>

              {/* Font Size & Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                    Font Size
                  </span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>{fontSize}px</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[12, 14, 18, 24, 32, 48].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setFontSize(sz)}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: '6px', border: 'none',
                        background: fontSize === sz ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                        color: fontSize === sz ? '#818cf8' : '#94a3b8',
                        fontSize: '11px', cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={8}
                  max={72}
                  value={fontSize}
                  onChange={e => setFontSize(+e.target.value)}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>

              {/* Styles: Bold, Italic, Alignment */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setIsBold(!isBold)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: '8px',
                      background: isBold ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                      border: isBold ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                      color: isBold ? '#818cf8' : '#cbd5e1', cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    B
                  </button>
                  <button
                    onClick={() => setIsItalic(!isItalic)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: '8px',
                      background: isItalic ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                      border: isItalic ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                      color: isItalic ? '#818cf8' : '#cbd5e1', cursor: 'pointer', fontStyle: 'italic', fontFamily: 'serif'
                    }}
                  >
                    I
                  </button>
                </div>

                <div style={{ flex: 1.2, display: 'flex', gap: '4px' }}>
                  {['left', 'center', 'right'].map(align => (
                    <button
                      key={align}
                      onClick={() => setTextAlign(align)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: '8px',
                        background: textAlign === align ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                        border: textAlign === align ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                        color: textAlign === align ? '#818cf8' : '#cbd5e1',
                        cursor: 'pointer', fontSize: '11px', textTransform: 'capitalize'
                      }}
                    >
                      {align[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                    Opacity
                  </span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={opacity}
                  onChange={e => setOpacity(+e.target.value)}
                  style={{ width: '100%', accentColor: '#6366f1' }}
                />
              </div>

              {/* Selected Item Editor (when clicking existing text) */}
              {tool === TOOLS.SELECT && editingId && (() => {
                const item = textItems.find(t => t.id === editingId);
                if (!item) return null;
                const currentEdit = textEdits[editingId];
                return (
                  <div style={{
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    <div style={{ color: '#a5b4fc', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                      Selected Text Box
                    </div>
                    <textarea
                      value={inlineEditText}
                      onChange={e => setInlineEditText(e.target.value)}
                      placeholder="Type replacement text..."
                      rows={2}
                      style={{
                        width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                        color: '#f8fafc', padding: '6px 8px', fontSize: '12px', outline: 'none', resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => commitInPlaceEdit(item, inlineEditText)}
                        style={{
                          flex: 1, padding: '6px 0', background: '#4f46e5', color: 'white',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                        }}
                      >
                        Apply (Enter)
                      </button>
                      <button
                        onClick={() => eraseInPlaceText(item)}
                        style={{
                          flex: 1, padding: '6px 0', background: 'rgba(239,68,68,0.15)', color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                        }}
                      >
                        Erase / Whiteout
                      </button>
                    </div>
                    {currentEdit && (
                      <button
                        onClick={() => resetInPlaceText(item)}
                        style={{
                          width: '100%', padding: '5px 0', background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '10px'
                        }}
                      >
                        Reset to Original
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Help Callout for SELECT Mode */}
              {tool === TOOLS.SELECT && (
                <div style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '10px', padding: '12px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5
                }}>
                  <strong style={{ color: '#a5b4fc', display: 'block', marginBottom: '4px' }}>
                    💡 In-Place Editing Guide:
                  </strong>
                  • Click any text/heading to edit or erase it.<br/>
                  • The original text is seamlessly whited out.<br/>
                  • Click <strong>Clear</strong> to remove words completely.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
