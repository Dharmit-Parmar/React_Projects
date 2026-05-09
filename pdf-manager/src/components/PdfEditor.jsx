import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Upload, X, Plus, Minus, ChevronLeft, ChevronRight,
         Type, Pen, Square, Highlighter, Eraser, Download, Image, Undo, Redo } from 'lucide-react';

// ── PDF.js worker ────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ── Tool types ───────────────────────────────────────────────────────────────
const TOOLS = {
  SELECT:    'select',
  TEXT:      'text',
  DRAW:      'draw',
  HIGHLIGHT: 'highlight',
  RECT:      'rect',
  ERASER:    'eraser',
  IMAGE:     'image',
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
  // file & pdf state
  const [pdfFile, setPdfFile]           = useState(null);
  const [pdfDoc, setPdfDoc]             = useState(null);   // pdfjs document
  const [pdfBytes, setPdfBytes]         = useState(null);   // raw Uint8Array
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [scale, setScale]               = useState(2.0);
  const [isOpen, setIsOpen]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // editor state
  const [tool, setTool]                 = useState(TOOLS.SELECT);
  const [color, setColor]               = useState('#ff0000');
  const [fontSize, setFontSize]         = useState(18);
  const [fontFamily, setFontFamily]     = useState('Helvetica');
  const [isBold, setIsBold]             = useState(false);
  const [isItalic, setIsItalic]         = useState(false);
  const [textAlign, setTextAlign]       = useState('left'); // left, center, right
  const [opacity, setOpacity]           = useState(1.0);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight]     = useState(1.5);
  const [rotation, setRotation]         = useState(0); // degrees
  const [hasShadow, setHasShadow]       = useState(false);
  const [hasStroke, setHasStroke]       = useState(false);
  const [lineWidth, setLineWidth]       = useState(3);
  const [annotations, setAnnotations]   = useState([]);
  
  // History state
  const historyRef = useRef([[]]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // text-layer editing state
  const [textItems, setTextItems]       = useState([]);   // [{id,str,x,y,w,h,origStr,fontSize}]
  const [editingId, setEditingId]       = useState(null); // id of item being edited
  const [editedTexts, setEditedTexts]   = useState({});   // {id: newStr}
  const [textInput, setTextInput]       = useState({ visible: false, x: 0, y: 0, value: '', editingId: null });

  // drawing state (canvas)
  const [isDrawing, setIsDrawing]       = useState(false);
  const [drawPath, setDrawPath]         = useState([]);
  const [startPos, setStartPos]         = useState(null);

  // refs
  const drawPathRef    = useRef([]);
  const redrawRef      = useRef(null);
  const pdfCanvasRef   = useRef(null);
  const overlayRef     = useRef(null);
  const renderTaskRef  = useRef(null);
  const fileInputRef   = useRef(null);
  const imageInputRef  = useRef(null);
  const imageCache     = useRef({});
  const textCancelRef  = useRef(false);

  const updateAnnotations = useCallback((updater) => {
    setAnnotations(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      
      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(next);
      
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      setAnnotations(historyRef.current[historyIndexRef.current]);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      setAnnotations(historyRef.current[historyIndexRef.current]);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, []);

  const resetAnnotations = useCallback(() => {
    setAnnotations([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // ── Load PDF from file ──────────────────────────────────────────────────────
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
      resetAnnotations();
      setIsOpen(true);
    } catch (e) {
      setError('Failed to load PDF: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Render current page onto canvas ────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !isOpen) return;

    let cancelled = false;
    (async () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();

      const page     = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = pdfCanvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width  = viewport.width;
      canvas.height = viewport.height;

      const overlay = overlayRef.current;
      if (overlay) { overlay.width = viewport.width; overlay.height = viewport.height; }

      const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      renderTaskRef.current = task;
      try { await task.promise; }
      catch (e) { if (e?.name !== 'RenderingCancelledException') throw e; }

      if (!cancelled) {
        if (redrawRef.current) redrawRef.current();
        // ── Extract text layer for in-place editing ──
        const tc = await page.getTextContent();
        const items = tc.items.map((item, i) => {
          const tx = applyTransform(viewport.transform, item.transform);
          const w  = item.width  * scale;
          const h  = item.height > 0 ? item.height * scale : Math.abs(tx[3]);
          return {
            id: `${currentPage}-${i}`,
            str: item.str,
            origStr: item.str,
            x: tx[4],
            y: tx[5] - h,
            w: w || 60,
            h: h || 14,
            fontSize: Math.abs(tx[3]),
          };
        }).filter(it => it.str.trim().length > 0);
        if (!cancelled) setTextItems(items);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage, scale, isOpen]);

  // ── Redraw overlay annotations for current page ─────────────────────────────
  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

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
        ctx.fillStyle   = ann.color + '55';  // 33% opacity
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
        ctx.font        = `${style} ${weight} ${ann.fontSize}px ${family}`;

        if (ann.hasShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        ctx.translate(ann.x, ann.y);
        if (ann.rotation) ctx.rotate((ann.rotation * Math.PI) / 180);

        const lines = ann.text.split('\n');
        const lh = (ann.lineHeight || 1.5) * ann.fontSize;
        
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
  }, [annotations, currentPage]);

  useEffect(() => { redrawRef.current = redrawOverlay; }, [redrawOverlay]);

  // Re-draw when annotations or page changes
  useEffect(() => { redrawOverlay(); }, [annotations, currentPage, redrawOverlay]);

  // ── Canvas pointer events ───────────────────────────────────────────────────
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

    // Image tool: open file picker, place image at click position
    if (tool === TOOLS.IMAGE) {
      const pos = getPos(e);
      imageInputRef.current._pendingPos = pos;
      imageInputRef.current.value = '';
      imageInputRef.current.click();
      return;
    }
    const pos = getPos(e);

    if (tool === TOOLS.TEXT) {
      if (textInput.visible) return;
      e.preventDefault();
      // 检查是否点击了已有 TEXT 注解（可重编辑）
      const pageAnns = annotations.filter(a => a.page === currentPage && a.type === TOOLS.TEXT);
      const clicked = pageAnns.find(a => {
        const approxH = (a.lineHeight || 1.5) * a.fontSize * (a.text.split('\n').length || 1);
        return pos.x >= a.x - 4 && pos.x <= a.x + 200 && pos.y >= a.y - a.fontSize && pos.y <= a.y + approxH;
      });
      if (clicked) {
        // 删除已有注解，打开编辑框
        updateAnnotations(prev => prev.filter(a => a.id !== clicked.id));
        setTextInput({ visible: true, x: clicked.x, y: clicked.y, value: clicked.text, editingId: clicked.id });
      } else {
        setTextInput({ visible: true, x: pos.x, y: pos.y, value: '', editingId: null });
      }
      return;
    }

    if (tool === TOOLS.ERASER) {
      // Remove annotations whose bounding box contains the click
      updateAnnotations(prev => prev.filter(a => {
        if (a.page !== currentPage) return true;
        if (a.type === TOOLS.DRAW) {
          return !a.path.some(([px, py]) =>
            Math.hypot(px - pos.x, py - pos.y) < 15
          );
        }
        const { x = 0, y = 0, w = 0, h = 0 } = a;
        return !(pos.x >= x && pos.x <= x + w && pos.y >= y - (a.type === TOOLS.TEXT ? a.fontSize : 0) && pos.y <= y + h);
      }));
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    if (tool === TOOLS.DRAW) {
      drawPathRef.current = [[pos.x, pos.y]];
      setDrawPath(drawPathRef.current);
    }
  };

  const onPointerMove = (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);

    if (tool === TOOLS.DRAW) {
      drawPathRef.current = [...drawPathRef.current, [pos.x, pos.y]];
      setDrawPath(drawPathRef.current);
      // Live preview on overlay
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (redrawRef.current) redrawRef.current();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidth;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      drawPathRef.current.forEach(([x, y], i) =>
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      );
      ctx.stroke();
    } else if (tool === TOOLS.HIGHLIGHT || tool === TOOLS.RECT) {
      // Live rect preview
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
      setDrawPath([]);
    } else if (tool === TOOLS.HIGHLIGHT || tool === TOOLS.RECT) {
      const w = pos.x - startPos.x;
      const h = pos.y - startPos.y;
      if (startPos && w > 2 && h > 2) {
        updateAnnotations(prev => [...prev, {
          id: Date.now(), type: tool, page: currentPage,
          x: startPos.x, y: startPos.y, w, h, color, lineWidth,
        }]);
      }
    }
    setStartPos(null);
  };

  // ── Save / Download ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!pdfBytes) return;
    try {
      const pdfLibDoc = await PDFDocument.load(pdfBytes);
      const pages     = pdfLibDoc.getPages();
      const defaultFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

      // ── Apply edited text items (redact old, draw new) ──
      for (const [id, newStr] of Object.entries(editedTexts)) {
        const item = textItems.find(t => t.id === id);
        if (!item || newStr === item.origStr) continue;
        const pageIdx = parseInt(id.split('-')[0], 10) - 1;
        const pg = pages[pageIdx];
        if (!pg) continue;
        const { height } = pg.getSize();
        const ix = item.x / scale;
        const iy = height - (item.y + item.h) / scale;
        const iw = (item.w + 4) / scale;
        const ih = (item.h + 2) / scale;
        // White-out original text
        pg.drawRectangle({ x: ix - 1, y: iy - 1, width: iw, height: ih + 2, color: rgb(1,1,1) });
        // Draw replacement
        if (newStr.trim()) {
          pg.drawText(newStr, {
            x: ix, y: iy + 1,
            size: Math.max(4, item.fontSize / scale),
            font: defaultFont, color: rgb(0,0,0),
            maxWidth: iw,
          });
        }
      }

      // ── Apply canvas annotations ──
      const fontCache = {};
      for (const ann of annotations) {
        const page = pages[ann.page - 1];
        if (!page) continue;
        const { height } = page.getSize();
        const { r, g, b } = hexToRgb(ann.color);

        if (ann.type === TOOLS.TEXT) {
          const fontKey = `${ann.fontFamily}-${ann.isBold}-${ann.isItalic}`;
          if (!fontCache[fontKey]) {
            fontCache[fontKey] = await pdfLibDoc.embedFont(getStandardFontName(ann.fontFamily, ann.isBold, ann.isItalic));
          }
          const annFont = fontCache[fontKey];

          const fontSizeScaled = ann.fontSize / scale;
          const px = ann.x / scale;
          const py = height - (ann.y / scale);
          const textOpacity = ann.opacity ?? 1.0;
          const lhScaled = (ann.lineHeight || 1.5) * fontSizeScaled;
          const rotationAngle = ann.rotation ? degrees(-ann.rotation) : undefined;
          const lines = ann.text.split('\n');

          const drawTextLines = (xOff, yOff, drawColor, drawOpacity) => {
            lines.forEach((line, i) => {
              let textWidth = annFont.widthOfTextAtSize(line, fontSizeScaled);
              const lsScaled = (ann.letterSpacing || 0) / scale;
              if (lsScaled) textWidth += Math.max(0, line.length - 1) * lsScaled;

              let alignX = 0;
              if (ann.textAlign === 'center') alignX = -textWidth / 2;
              else if (ann.textAlign === 'right') alignX = -textWidth;

              // Baseline Y is adjusted by fontSize because Y is top-left
              const lineY = py + yOff - (i * lhScaled) - fontSizeScaled;

              if (lsScaled) {
                let cx = 0;
                for (let j = 0; j < line.length; j++) {
                  const char = line[j];
                  page.drawText(char, {
                    x: px + xOff + alignX + cx,
                    y: lineY,
                    size: fontSizeScaled,
                    font: annFont,
                    color: drawColor,
                    opacity: drawOpacity,
                    rotate: rotationAngle
                  });
                  cx += annFont.widthOfTextAtSize(char, fontSizeScaled) + lsScaled;
                }
              } else {
                page.drawText(line, {
                  x: px + xOff + alignX,
                  y: lineY,
                  size: fontSizeScaled,
                  font: annFont,
                  color: drawColor,
                  opacity: drawOpacity,
                  rotate: rotationAngle
                });
              }
            });
          };

          if (ann.hasShadow) drawTextLines(2/scale, -2/scale, rgb(0,0,0), 0.5 * textOpacity);
          if (ann.hasStroke) {
             const s = 1/scale;
             const c = rgb(r,g,b);
             drawTextLines(s, 0, c, textOpacity);
             drawTextLines(-s, 0, c, textOpacity);
             drawTextLines(0, s, c, textOpacity);
             drawTextLines(0, -s, c, textOpacity);
          }
          drawTextLines(0, 0, rgb(r,g,b), textOpacity);
        } else if (ann.type === TOOLS.DRAW) {
          for (let i = 1; i < ann.path.length; i++) {
            const [x1,y1]=ann.path[i-1], [x2,y2]=ann.path[i];
            page.drawLine({ start:{x:x1/scale,y:height-y1/scale}, end:{x:x2/scale,y:height-y2/scale}, thickness:ann.lineWidth/scale, color:rgb(r,g,b) });
          }
        } else if (ann.type === TOOLS.HIGHLIGHT) {
          page.drawRectangle({ x:ann.x/scale, y:height-(ann.y+ann.h)/scale, width:ann.w/scale, height:Math.abs(ann.h/scale), color:rgb(r,g,b), opacity:0.3 });
        } else if (ann.type === TOOLS.RECT) {
          page.drawRectangle({ x:ann.x/scale, y:height-(ann.y+ann.h)/scale, width:ann.w/scale, height:Math.abs(ann.h/scale), borderColor:rgb(r,g,b), borderWidth:ann.lineWidth/scale, color:rgb(1,1,1), opacity:0 });
        } else if (ann.type === TOOLS.IMAGE && ann.dataUrl) {
          try {
            const imgBuf = await (await fetch(ann.dataUrl)).arrayBuffer();
            const embedded = ann.mimeType==='image/png' ? await pdfLibDoc.embedPng(imgBuf) : await pdfLibDoc.embedJpg(imgBuf);
            page.drawImage(embedded, { x:ann.x/scale, y:height-(ann.y+ann.h)/scale, width:Math.abs(ann.w/scale), height:Math.abs(ann.h/scale) });
          } catch { /* skip */ }
        }
      }

      const savedBytes = await pdfLibDoc.save();
      const blob = new Blob([savedBytes], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `edited_${pdfFile.name}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { alert('Save failed: ' + e.message); }
  };

  // ── File input handlers ─────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') { setPdfFile(file); loadPdf(file); }
    else alert('Please drop a valid PDF file.');
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file?.type === 'application/pdf') { setPdfFile(file); loadPdf(file); }
  };

  // ── Image tool: handle image file selection ─────────────────────────────────
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
        // Default size: 200px wide, keep aspect ratio
        const w = 150;
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
    setIsOpen(false);
    setPdfDoc(null);
    setPdfFile(null);
    setPdfBytes(null);
    resetAnnotations();
    setTextItems([]);
    setEditedTexts({});
    setEditingId(null);
    setTextInput({ visible: false, x: 0, y: 0, value: '' });
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const toolBtnStyle = (t) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontSize: '11px', fontWeight: 600, transition: 'all 0.2s',
    background: tool === t ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)',
    color: tool === t ? '#a5b4fc' : '#94a3b8',
    outline: tool === t ? '1.5px solid rgba(99,102,241,0.6)' : 'none',
  });

  // ── Upload screen (fullscreen) ─────────────────────────────────────────────
  if (!isOpen) {
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at 60% 40%, #0d1129 0%, #080b18 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundImage: 'radial-gradient(ellipse at 60% 40%, #0d1129 0%, #080b18 100%), repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.02) 39px,rgba(255,255,255,0.02) 40px), repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.02) 39px,rgba(255,255,255,0.02) 40px)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)', padding: '8px 18px',
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '6px',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em' }}>PDF EDITOR</span>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px', padding: '10px 16px', color: '#fca5a5', marginBottom: '20px',
            maxWidth: '480px', width: '90%', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
            padding: '56px 48px', textAlign: 'center', cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)',
            transition: 'all 0.25s ease',
            maxWidth: '460px', width: '90%',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf"
            onChange={handleFileInput} style={{ display: 'none' }} />
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            {loading
              ? <div style={{ width: '28px', height: '28px', border: '2px solid rgba(99,102,241,0.3)', borderTop: '2px solid #818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
              : <Upload size={28} color="#818cf8" />}
          </div>
          <h3 style={{ color: '#f1f5f9', fontSize: '1.25rem', margin: '0 0 8px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {loading ? 'Loading PDF…' : 'Drop your PDF here'}
          </h3>
          <p style={{ color: '#475569', margin: '0 0 20px', fontSize: '0.875rem', lineHeight: 1.6 }}>
            or click to browse files
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Annotate', 'Draw', 'Highlight', 'Edit text'].map(f => (
              <span key={f} style={{
                fontSize: '11px', color: '#64748b', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px 8px',
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ── Editor UI ──────────────────────────────────────────────────────────────
  const TOOL_BTNS = [
    { id: TOOLS.SELECT,    icon: <ChevronRight size={18}/>, label: 'Select'    },
    { id: TOOLS.TEXT,      icon: <Type size={18}/>,         label: 'Text'      },
    { id: TOOLS.DRAW,      icon: <Pen size={18}/>,          label: 'Draw'      },
    { id: TOOLS.HIGHLIGHT, icon: <Highlighter size={18}/>,  label: 'Highlight' },
    { id: TOOLS.RECT,      icon: <Square size={18}/>,       label: 'Rectangle' },
    { id: TOOLS.IMAGE,     icon: <Image size={18}/>,        label: 'Image'     },
    { id: TOOLS.ERASER,    icon: <Eraser size={18}/>,       label: 'Eraser'    },
  ];

  // hidden image file input (used by IMAGE tool)
  const imageInputEl = (
    <input
      ref={imageInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      onChange={handleImageInput}
      style={{ display: 'none' }}
    />
  );

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0f172a', display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: '52px',
        background: 'rgba(10,12,22,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0, gap: '16px',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* 左：文件名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '7px',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          </div>
          <span style={{ color: '#e2e8f0', fontWeight: 500, fontSize: '0.875rem',
            maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {pdfFile?.name}
          </span>
        </div>

        {/* 中：翻页 + 缩放 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* 页码 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', color: currentPage === 1 ? '#475569' : '#94a3b8',
                padding: '5px 8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex', transition: 'all 0.15s' }}>
              <ChevronLeft size={14}/>
            </button>
            <span style={{ color: '#64748b', fontSize: '0.8rem', minWidth: '72px', textAlign: 'center',
              background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '5px 10px',
              border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{currentPage}</span>
              <span style={{ margin: '0 4px' }}>/</span>
              {pageCount}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', color: currentPage === pageCount ? '#475569' : '#94a3b8',
                padding: '5px 8px', cursor: currentPage === pageCount ? 'not-allowed' : 'pointer',
                display: 'flex', transition: 'all 0.15s' }}>
              <ChevronRight size={14}/>
            </button>
          </div>

          {/* 缩放 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', color: '#94a3b8', padding: '5px 8px', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}>
              <Minus size={13}/>
            </button>
            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', minWidth: '46px', textAlign: 'center',
              background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '5px 8px',
              border: '1px solid rgba(255,255,255,0.06)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px', color: '#94a3b8', padding: '5px 8px', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}>
              <Plus size={13}/>
            </button>
          </div>
        </div>

        {/* 右：动作 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px',
              background: 'linear-gradient(135deg,#10b981,#059669)',
              color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.01em',
              boxShadow: '0 2px 12px rgba(16,185,129,0.3)', transition: 'all 0.2s' }}>
            <Download size={14}/> Export PDF
          </button>
          <button onClick={closeEditor}
            style={{ display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 12px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 500, fontSize: '0.8rem', transition: 'all 0.2s' }}>
            <X size={14}/> Close
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Toolbar ── */}
        <div style={{
          width: '72px', background: 'rgba(10,12,22,0.88)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '12px 8px', gap: '4px', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ color: '#334155', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.12em', marginBottom: '6px', textTransform: 'uppercase' }}>Tools</div>
          {TOOL_BTNS.map(({ id, icon, label }) => (
            <button key={id} onClick={() => setTool(id)} title={label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              padding: '9px 6px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontSize: '9px', fontWeight: 600, width: '56px',
              transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
              background: tool === id ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: tool === id ? '#818cf8' : '#475569',
              outline: tool === id ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              letterSpacing: '0.02em',
            }}>
              {icon}
              <span>{label}</span>
            </button>
          ))}

          <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />

          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            padding: '9px 6px', borderRadius: '10px', border: 'none', width: '56px',
            fontSize: '9px', fontWeight: 600, letterSpacing: '0.02em',
            background: 'transparent', color: canUndo ? '#475569' : '#1e293b',
            cursor: canUndo ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
            outline: '1px solid transparent',
          }}>
            <Undo size={16}/>
            <span>Undo</span>
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            padding: '9px 6px', borderRadius: '10px', border: 'none', width: '56px',
            fontSize: '9px', fontWeight: 600, letterSpacing: '0.02em',
            background: 'transparent', color: canRedo ? '#475569' : '#1e293b',
            cursor: canRedo ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
            outline: '1px solid transparent',
          }}>
            <Redo size={16}/>
            <span>Redo</span>
          </button>

          {imageInputEl}
        </div>

        {/* ── PDF Canvas Area ── */}
        <div style={{
          flex: 1, overflow: 'auto', background: '#1e293b',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          padding: '24px',
        }}>
          <div style={{ position: 'relative', display: 'inline-block',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)', borderRadius: '4px', lineHeight: 0, overflow: 'visible' }}>
            {/* PDF render canvas */}
            <canvas ref={pdfCanvasRef} style={{ display: 'block', borderRadius: '4px' }} />
            {/* Annotation overlay canvas */}
            <canvas
              ref={overlayRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              style={{
                position: 'absolute', top: 0, left: 0, borderRadius: '4px',
                cursor: tool === TOOLS.TEXT   ? 'text'
                      : tool === TOOLS.ERASER ? 'cell'
                      : tool === TOOLS.SELECT ? 'default'
                      : 'crosshair',
                pointerEvents: textInput.visible ? 'none' : 'auto',
              }}
            />
            {/* ── Text Tool Input ── */}
            {textInput.visible && (
              <div
                style={{
                  position: 'absolute', left: textInput.x, top: textInput.y - fontSize,
                  zIndex: 20, cursor: 'move',
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'left top',
                  background: 'rgba(15,20,40,0.6)',
                  backdropFilter: 'blur(8px)',
                  minWidth: '180px',
                  border: '1px solid rgba(99,102,241,0.5)',
                  borderRadius: '8px',
                  overflow: 'visible',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.1)',
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
                    setTextInput(prev => ({ ...prev, 
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
                {/* Drag handle bar */}
                <div style={{
                  height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 8px',
                  background: 'rgba(99,102,241,0.15)',
                  borderBottom: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '7px 7px 0 0',
                  cursor: 'move', userSelect: 'none',
                }}>
                  <span style={{ color: 'rgba(165,180,252,0.6)', fontSize: '9px', letterSpacing: '0.05em', fontWeight: 600 }}>
                    TEXT {textInput.editingId ? '· Edit' : '· New'}
                  </span>
                  {/* × Cancel Button */}
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      textCancelRef.current = true;
                      const ta = e.currentTarget.closest('div').querySelector('textarea');
                      if (ta) ta.blur(); else setTextInput({ visible: false, x: 0, y: 0, value: '', editingId: null });
                    }}
                    style={{
                      width: '16px', height: '16px',
                      background: 'rgba(239,68,68,0.8)', color: 'white', border: 'none', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      zIndex: 40, fontSize: '10px', lineHeight: 1, fontWeight: 'bold', padding: 0,
                    }}
                    title="Cancel (Esc)"
                  >×</button>
                </div>
                <textarea
                  autoFocus
                  value={textInput.value}
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
                    fontFamily: fontFamily === 'TimesRoman' ? '"Times New Roman", serif' : fontFamily === 'Courier' ? '"Courier New", monospace' : 'Helvetica, Arial, sans-serif',
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    textAlign, opacity, letterSpacing: `${letterSpacing}px`, lineHeight,
                    textShadow: hasShadow ? `2px 2px 4px rgba(0,0,0,0.5)` : 'none',
                    WebkitTextStroke: hasStroke ? `1px ${color}` : 'none',
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: '8px', width: '100%', resize: 'none', overflow: 'hidden',
                    display: 'block', boxSizing: 'border-box', minHeight: '36px',
                  }}
                />
              </div>
            )}

            {/* ── Editable text layer (SELECT mode only) ── */}
            {tool === TOOLS.SELECT && textItems.map(item => {
              const isEditing = editingId === item.id;
              const displayStr = editedTexts[item.id] ?? item.str;
              return (
                <div
                  key={item.id}
                  title="Click to edit"
                  onClick={() => setEditingId(item.id)}
                  style={{
                    position: 'absolute',
                    left: item.x, top: item.y,
                    width: Math.max(item.w, 40),
                    height: Math.max(item.h, 18),
                    cursor: 'text',
                    border: isEditing ? '1.5px solid #6366f1' : '1px solid transparent',
                    borderRadius: '4px',
                    background: isEditing ? 'rgba(99,102,241,0.12)' : 'transparent',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!isEditing) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'; }}
                  onMouseLeave={e => { if (!isEditing) e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={displayStr}
                      onChange={e => setEditedTexts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null); }}
                      style={{
                        width: '100%', height: '100%', border: 'none', outline: 'none',
                        background: 'rgba(255,255,255,0.9)', color: 'rgba(0,0,0,0.85)', caretColor: '#6366f1',
                        fontSize: item.fontSize, fontFamily: 'sans-serif', padding: '0 4px',
                        position: 'absolute', inset: 0,
                        borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        lineHeight: 'normal',
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Properties Panel ── */}
        {[TOOLS.TEXT, TOOLS.DRAW, TOOLS.RECT, TOOLS.HIGHLIGHT].includes(tool) && (
          <div style={{
            width: '260px', background: 'rgba(15,23,42,0.95)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: '20px', overflowY: 'auto', flexShrink: 0,
          }}>
            <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Properties
            </div>

            {/* Color */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer', padding: '0' }} />
                <span style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace' }}>{color.toUpperCase()}</span>
              </div>
            </div>

            {/* Line width */}
            {(tool === TOOLS.DRAW || tool === TOOLS.RECT) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Stroke Width</div>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>{lineWidth}px</span>
                </div>
                <input type="range" min={1} max={20} value={lineWidth} onChange={e => setLineWidth(+e.target.value)}
                  style={{ width: '100%', accentColor: '#6366f1' }} />
              </div>
            )}

            {/* Text Settings */}
            {tool === TOOLS.TEXT && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Font Family</div>
                  <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', color: '#e2e8f0', padding: '10px', fontSize: '13px', outline: 'none', cursor: 'pointer', fontFamily: fontFamily === 'TimesRoman' ? '"Times New Roman", serif' : fontFamily === 'Courier' ? '"Courier New", monospace' : 'Helvetica, Arial, sans-serif' }}>
                    <option value="Helvetica" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Helvetica</option>
                    <option value="TimesRoman" style={{ fontFamily: '"Times New Roman", serif' }}>Times Roman</option>
                    <option value="Courier" style={{ fontFamily: '"Courier New", monospace' }}>Courier</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Size</div>
                    <input type="number" min={8} max={144} value={fontSize} onChange={e => setFontSize(+e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', padding: '10px', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Style</div>
                    <div style={{ display: 'flex', gap: '6px', height: '100%' }}>
                      <button onClick={() => setIsBold(!isBold)} style={{ flex: 1, background: isBold ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: isBold ? '#818cf8' : '#cbd5e1', border: isBold ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s' }}>B</button>
                      <button onClick={() => setIsItalic(!isItalic)} style={{ flex: 1, background: isItalic ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: isItalic ? '#818cf8' : '#cbd5e1', border: isItalic ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontStyle: 'italic', fontFamily: 'serif', fontSize: '14px', transition: 'all 0.2s' }}>I</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Alignment</div>
                  <div style={{ display: 'flex', gap: '6px', height: '36px' }}>
                    {['left', 'center', 'right'].map(align => (
                      <button key={align} onClick={() => setTextAlign(align)}
                        style={{ flex: 1, background: textAlign === align ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: textAlign === align ? '#818cf8' : '#cbd5e1', border: textAlign === align ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', textTransform: 'capitalize' }}>
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Opacity</div>
                    <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>{Math.round(opacity * 100)}%</span>
                  </div>
                  <input type="range" min={0.1} max={1.0} step={0.1} value={opacity} onChange={e => setOpacity(+e.target.value)} style={{ width: '100%', accentColor: '#6366f1' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Spacing</div>
                    <input type="number" min={-5} max={20} value={letterSpacing} onChange={e => setLetterSpacing(+e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', padding: '10px', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Line Height</div>
                    <input type="number" min={0.5} max={3} step={0.1} value={lineHeight} onChange={e => setLineHeight(+e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', padding: '10px', fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rotation</div>
                    <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>{rotation}°</span>
                  </div>
                  <input type="range" min={0} max={360} value={rotation} onChange={e => setRotation(+e.target.value)} style={{ width: '100%', accentColor: '#6366f1' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hasShadow} onChange={e => setHasShadow(e.target.checked)} style={{ accentColor: '#6366f1' }} /> Shadow
                  </label>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hasStroke} onChange={e => setHasStroke(e.target.checked)} style={{ accentColor: '#6366f1' }} /> Stroke
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Preview</div>
                  <div style={{
                    width: '100%', padding: '16px', background: 'rgba(255,255,255,0.95)', borderRadius: '8px',
                    color: color, fontSize: '20px', textAlign: textAlign, boxSizing: 'border-box',
                    fontFamily: fontFamily === 'TimesRoman' ? '"Times New Roman", serif' : fontFamily === 'Courier' ? '"Courier New", monospace' : 'Helvetica, Arial, sans-serif',
                    fontWeight: isBold ? 'bold' : 'normal', fontStyle: isItalic ? 'italic' : 'normal',
                    opacity: opacity, letterSpacing: `${letterSpacing}px`, lineHeight: lineHeight,
                    textShadow: hasShadow ? `2px 2px 4px rgba(0,0,0,0.5)` : 'none',
                    WebkitTextStroke: hasStroke ? `1px ${color}` : 'none',
                    transform: `rotate(${rotation}deg)`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                  }}>
                    AaBbCc
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
