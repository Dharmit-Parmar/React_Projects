import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
} from 'docx';
import {
  UploadCloud, ArrowRight, Download, RefreshCw,
  Loader2, CheckCircle2, X, FileText, Image as Img,
  File, Zap, Presentation,
} from 'lucide-react';

// ── PDF.js worker (bundled via Vite, no CDN needed) ───────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ── Format catalogue ──────────────────────────────────────────────────────────
const FORMAT_INFO = {
  pdf:  { label: 'PDF',   color: '#ef4444', bg: '#ef444418', icon: '📄' },
  png:  { label: 'PNG',   color: '#22d3ee', bg: '#22d3ee18', icon: '🖼️' },
  jpg:  { label: 'JPG',   color: '#f59e0b', bg: '#f59e0b18', icon: '🖼️' },
  jpeg: { label: 'JPG',   color: '#f59e0b', bg: '#f59e0b18', icon: '🖼️' },
  webp: { label: 'WEBP',  color: '#a78bfa', bg: '#a78bfa18', icon: '🖼️' },
  gif:  { label: 'GIF',   color: '#34d399', bg: '#34d39918', icon: '🎞️' },
  bmp:  { label: 'BMP',   color: '#94a3b8', bg: '#94a3b818', icon: '🖼️' },
  docx: { label: 'DOCX',  color: '#3b82f6', bg: '#3b82f618', icon: '📝' },
  doc:  { label: 'DOC',   color: '#3b82f6', bg: '#3b82f618', icon: '📝' },
  txt:  { label: 'TXT',   color: '#a3e635', bg: '#a3e63518', icon: '📃' },
  html: { label: 'HTML',  color: '#f97316', bg: '#f9731618', icon: '🌐' },
  pptx: { label: 'PPTX',  color: '#ff6b35', bg: '#ff6b3518', icon: '📊' },
  ppt:  { label: 'PPT',   color: '#ff6b35', bg: '#ff6b3518', icon: '📊' },
};

// ── Conversion matrix — what each format can be converted TO ──────────────────
const CONVERSION_MAP = {
  pdf:  ['docx', 'txt', 'png', 'jpg', 'html'],
  png:  ['pdf', 'jpg', 'webp', 'bmp'],
  jpg:  ['pdf', 'png', 'webp', 'bmp'],
  jpeg: ['pdf', 'png', 'webp', 'bmp'],
  webp: ['pdf', 'png', 'jpg', 'bmp'],
  gif:  ['pdf', 'png', 'jpg'],
  bmp:  ['pdf', 'png', 'jpg', 'webp'],
  docx: ['pdf', 'txt', 'html'],
  doc:  ['pdf', 'txt', 'html'],
  txt:  ['pdf', 'docx', 'html'],
  html: ['pdf', 'txt'],
  pptx: ['pdf', 'txt', 'html'],
  ppt:  ['pdf', 'txt'],
};

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
const DOC_EXTS   = ['docx', 'doc'];
const PPT_EXTS   = ['pptx', 'ppt'];

const getExt = (filename) =>
  filename.split('.').pop()?.toLowerCase() || '';

// ── Utilities ─────────────────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function downloadImageBlobs(blobs, baseName) {
  if (blobs.length === 1) {
    triggerDownload(blobs[0].blob, blobs[0].name);
  } else {
    const zip = new JSZip();
    blobs.forEach(({ blob, name }) => zip.file(name, blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `${baseName}_pages.zip`);
  }
}

// ── Image converters ──────────────────────────────────────────────────────────
async function imageToImage(file, targetMime) {
  const url = URL.createObjectURL(file);
  const img = new window.Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return new Promise(res => canvas.toBlob(res, targetMime, 0.95));
}

async function imageToPdf(file) {
  const pdfDoc = await PDFDocument.create();
  const ab = await file.arrayBuffer();
  let image;
  if (file.type === 'image/png') {
    image = await pdfDoc.embedPng(ab);
  } else {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    URL.revokeObjectURL(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const jpgBuf = await new Promise(res => canvas.toBlob(b => b.arrayBuffer().then(res), 'image/jpeg', 0.95));
    image = await pdfDoc.embedJpg(jpgBuf);
  }
  const { width, height } = image.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ── PDF converters ─────────────────────────────────────────────────────────────
async function pdfToImages(file, targetExt, onProgress) {
  const ab = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
  const numPages = pdfDoc.numPages;
  const blobs = [];
  for (let i = 1; i <= numPages; i++) {
    onProgress?.(i, numPages);
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const mime = targetExt === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(res => canvas.toBlob(res, mime, 0.92));
    blobs.push({ blob, name: `page_${i}.${targetExt}` });
  }
  return blobs;
}

async function pdfToText(file, onProgress) {
  const ab = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
  const numPages = pdfDoc.numPages;
  let fullText = '';
  for (let i = 1; i <= numPages; i++) {
    onProgress?.(i, numPages);
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n\n';
  }
  return fullText;
}

async function pdfToTxtBlob(file, onProgress) {
  const text = await pdfToText(file, onProgress);
  return new Blob([text], { type: 'text/plain' });
}

async function pdfToHtml(file, onProgress) {
  const text = await pdfToText(file, onProgress);
  const paragraphs = text.split('\n\n').filter(Boolean)
    .map(p => `  <p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('\n');
  const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Converted Document</title>\n  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.7;color:#222;}p{margin-bottom:1em;}</style>\n</head>\n<body>\n${paragraphs}\n</body>\n</html>`;
  return new Blob([html], { type: 'text/html' });
}

async function pdfToDocx(file, onProgress) {
  const text = await pdfToText(file, onProgress);
  const paragraphs = text.split('\n\n').filter(Boolean).map(p =>
    new Paragraph({ children: [new TextRun(p.trim())] })
  );
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buf = await Packer.toBlob(doc);
  return buf;
}

// ── TXT converters ─────────────────────────────────────────────────────────────
async function txtToPdf(file) {
  const text = await file.text();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth() - margin * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, pageW);
  let y = margin + 14;
  lines.forEach(line => {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage(); y = margin + 14;
    }
    doc.text(line, margin, y);
    y += 14;
  });
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

async function txtToDocx(file) {
  const text = await file.text();
  const paragraphs = text.split('\n').map(line =>
    new Paragraph({ children: [new TextRun(line)] })
  );
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}

async function txtToHtml(file) {
  const text = await file.text();
  const paragraphs = text.split('\n').filter(Boolean)
    .map(l => `  <p>${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('\n');
  const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.7;}</style>\n</head>\n<body>\n${paragraphs}\n</body>\n</html>`;
  return new Blob([html], { type: 'text/html' });
}

// ── DOCX converters ────────────────────────────────────────────────────────────
async function docxToPdf(file) {
  const ab = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab });
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:595px;padding:40px;' +
    'font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#111;background:#fff;';
  document.body.appendChild(container);
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(container, { scale: 1.5, useCORS: true });
  document.body.removeChild(container);
  const imgData = canvas.toDataURL('image/jpeg', 0.9);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgH = pageW * (canvas.height / canvas.width);
  let heightLeft = imgH;
  let pos = 0;
  doc.addImage(imgData, 'JPEG', 0, pos, pageW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    pos -= pageH; doc.addPage();
    doc.addImage(imgData, 'JPEG', 0, pos, pageW, imgH);
    heightLeft -= pageH;
  }
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

async function docxToTxt(file) {
  const ab = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
  return new Blob([value], { type: 'text/plain' });
}

async function docxToHtml(file) {
  const ab = await file.arrayBuffer();
  const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer: ab });
  const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.7;}h1,h2,h3{color:#1a1a2e;}</style>\n</head>\n<body>\n${htmlContent}\n</body>\n</html>`;
  return new Blob([html], { type: 'text/html' });
}

// ── PPTX converters (browser-side via JSZip parsing) ──────────────────────────
async function extractPptxText(file, onProgress) {
  const ab = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  let fullText = '';
  for (let i = 0; i < slideFiles.length; i++) {
    onProgress?.(i + 1, slideFiles.length);
    const xmlStr = await zip.files[slideFiles[i]].async('string');
    // Extract text from XML <a:t> tags
    const matches = [...xmlStr.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)];
    const slideText = matches.map(m => m[1]).join(' ').trim();
    if (slideText) fullText += `\n--- Slide ${i + 1} ---\n${slideText}\n`;
  }
  return fullText;
}

async function pptxToTxt(file, onProgress) {
  const text = await extractPptxText(file, onProgress);
  return new Blob([text || 'No text content found in presentation.'], { type: 'text/plain' });
}

async function pptxToPdf(file, onProgress) {
  const text = await extractPptxText(file, onProgress);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth() - margin * 2;
  const pageH = doc.internal.pageSize.getHeight();

  // Split by slide markers
  const slides = text.split(/--- Slide \d+ ---/).filter(s => s.trim());
  let slideNum = 1;
  slides.forEach((slideText, idx) => {
    if (idx > 0) doc.addPage();

    // Slide header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 200);
    doc.text(`Slide ${slideNum++}`, margin, margin + 14);

    // Content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(slideText.trim(), pageW);
    let y = margin + 36;
    lines.forEach(line => {
      if (y > pageH - margin) { doc.addPage(); y = margin + 14; }
      doc.text(line, margin, y);
      y += 14;
    });
  });

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

async function pptxToHtml(file, onProgress) {
  const text = await extractPptxText(file, onProgress);
  const slides = text.split(/--- Slide \d+ ---/).filter(s => s.trim());
  const slideHtml = slides.map((s, i) =>
    `<section class="slide">\n  <h2>Slide ${i + 1}</h2>\n  <p>${s.trim().replace(/\n/g, '<br>')}</p>\n</section>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Presentation</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;background:#f5f5f5;}
    .slide{background:#fff;border-radius:12px;padding:32px 40px;margin-bottom:24px;
           box-shadow:0 2px 12px rgba(0,0,0,.08);}
    h2{color:#4f46e5;margin-top:0;font-size:1.3rem;}
    p{color:#333;line-height:1.7;}
  </style>
</head>
<body>
${slideHtml}
</body>
</html>`;
  return new Blob([html], { type: 'text/html' });
}

// ── HTML converters ────────────────────────────────────────────────────────────
async function htmlToPdf(file) {
  const html = await file.text();
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText =
    'position:fixed;left:-9999px;top:0;width:595px;padding:40px;' +
    'font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#111;background:#fff;';
  document.body.appendChild(container);
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(container, { scale: 1.5, useCORS: true });
  document.body.removeChild(container);
  const imgData = canvas.toDataURL('image/jpeg', 0.9);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgH = pageW * (canvas.height / canvas.width);
  let heightLeft = imgH, pos = 0;
  doc.addImage(imgData, 'JPEG', 0, pos, pageW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    pos -= pageH; doc.addPage();
    doc.addImage(imgData, 'JPEG', 0, pos, pageW, imgH);
    heightLeft -= pageH;
  }
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

async function htmlToTxt(file) {
  const html = await file.text();
  const div = document.createElement('div');
  div.innerHTML = html;
  return new Blob([div.innerText || div.textContent || ''], { type: 'text/plain' });
}

// ── Master conversion dispatcher ───────────────────────────────────────────────
async function convertFile(file, fromExt, toExt, onProgress) {
  const base = file.name.replace(/\.[^.]+$/, '');
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' };

  // PDF →
  if (fromExt === 'pdf') {
    if (toExt === 'png' || toExt === 'jpg') {
      const list = await pdfToImages(file, toExt, onProgress);
      return { type: 'images', blobs: list, base };
    }
    if (toExt === 'txt')  { const b = await pdfToTxtBlob(file, onProgress); return { type: 'single', blob: b, filename: `${base}.txt` }; }
    if (toExt === 'html') { const b = await pdfToHtml(file, onProgress); return { type: 'single', blob: b, filename: `${base}.html` }; }
    if (toExt === 'docx') { const b = await pdfToDocx(file, onProgress); return { type: 'single', blob: b, filename: `${base}.docx` }; }
  }

  // IMAGE →
  if (IMAGE_EXTS.includes(fromExt)) {
    if (toExt === 'pdf') { const b = await imageToPdf(file); return { type: 'single', blob: b, filename: `${base}.pdf` }; }
    if (mimeMap[toExt])  { const b = await imageToImage(file, mimeMap[toExt]); return { type: 'single', blob: b, filename: `${base}.${toExt}` }; }
  }

  // DOCX/DOC →
  if (DOC_EXTS.includes(fromExt)) {
    if (toExt === 'pdf')  { const b = await docxToPdf(file); return { type: 'single', blob: b, filename: `${base}.pdf` }; }
    if (toExt === 'txt')  { const b = await docxToTxt(file); return { type: 'single', blob: b, filename: `${base}.txt` }; }
    if (toExt === 'html') { const b = await docxToHtml(file); return { type: 'single', blob: b, filename: `${base}.html` }; }
  }

  // TXT →
  if (fromExt === 'txt') {
    if (toExt === 'pdf')  { const b = await txtToPdf(file); return { type: 'single', blob: b, filename: `${base}.pdf` }; }
    if (toExt === 'docx') { const b = await txtToDocx(file); return { type: 'single', blob: b, filename: `${base}.docx` }; }
    if (toExt === 'html') { const b = await txtToHtml(file); return { type: 'single', blob: b, filename: `${base}.html` }; }
  }

  // PPTX/PPT →
  if (PPT_EXTS.includes(fromExt)) {
    if (toExt === 'pdf')  { const b = await pptxToPdf(file, onProgress); return { type: 'single', blob: b, filename: `${base}.pdf` }; }
    if (toExt === 'txt')  { const b = await pptxToTxt(file, onProgress); return { type: 'single', blob: b, filename: `${base}.txt` }; }
    if (toExt === 'html') { const b = await pptxToHtml(file, onProgress); return { type: 'single', blob: b, filename: `${base}.html` }; }
  }

  // HTML →
  if (fromExt === 'html') {
    if (toExt === 'pdf') { const b = await htmlToPdf(file); return { type: 'single', blob: b, filename: `${base}.pdf` }; }
    if (toExt === 'txt') { const b = await htmlToTxt(file); return { type: 'single', blob: b, filename: `${base}.txt` }; }
  }

  throw new Error(`Conversion from ${fromExt.toUpperCase()} to ${toExt.toUpperCase()} is not supported`);
}

// ── Format Badge ───────────────────────────────────────────────────────────────
function FmtBadge({ ext, large }) {
  const info = FORMAT_INFO[ext] || { label: ext?.toUpperCase(), color: '#94a3b8', bg: '#94a3b818' };
  return (
    <span
      className={`fmt-badge${large ? ' fmt-badge-lg' : ''}`}
      style={{ color: info.color, background: info.bg, borderColor: `${info.color}44` }}
    >
      {info.label}
    </span>
  );
}

// ── Supported targets grid ─────────────────────────────────────────────────────
function ConversionMatrix() {
  const entries = Object.entries(CONVERSION_MAP);
  return (
    <div className="fc-matrix">
      <p className="fc-matrix-title">Supported Conversions</p>
      <div className="fc-matrix-grid">
        {entries.map(([from, tos]) => (
          <div key={from} className="fc-matrix-row">
            <FmtBadge ext={from} />
            <span className="fc-matrix-arrow">→</span>
            <div className="fc-matrix-targets">
              {tos.map(t => <FmtBadge key={t} ext={t} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
const STATE = { IDLE: 'idle', CONVERTING: 'converting', DONE: 'done', ERROR: 'error' };

export default function FileConverter() {
  const [file, setFile] = useState(null);
  const [fromExt, setFromExt] = useState('');
  const [toExt, setToExt] = useState('');
  const [state, setState] = useState(STATE.IDLE);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [resultBlobs, setResultBlobs] = useState(null);
  const [error, setError] = useState('');
  const [showMatrix, setShowMatrix] = useState(false);

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    const f = accepted[0];
    const ext = getExt(f.name);
    setFile(f);
    setFromExt(ext);
    setToExt(CONVERSION_MAP[ext]?.[0] || '');
    setState(STATE.IDLE);
    setResultBlobs(null);
    setError('');
    setProgress({ current: 0, total: 0 });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'text/plain': ['.txt'],
      'text/html': ['.html'],
    },
  });

  const availableTargets = CONVERSION_MAP[fromExt] || [];

  const convert = async () => {
    if (!file || !fromExt || !toExt) return;
    setState(STATE.CONVERTING);
    setResultBlobs(null);
    setError('');
    setProgress({ current: 0, total: 0 });
    try {
      const result = await convertFile(file, fromExt, toExt,
        (cur, tot) => setProgress({ current: cur, total: tot }));
      setResultBlobs(result);
      setState(STATE.DONE);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Conversion failed');
      setState(STATE.ERROR);
    }
  };

  const handleDownload = async () => {
    if (!resultBlobs) return;
    if (resultBlobs.type === 'images') {
      await downloadImageBlobs(resultBlobs.blobs, resultBlobs.base);
    } else {
      triggerDownload(resultBlobs.blob, resultBlobs.filename);
    }
  };

  const reset = () => {
    setFile(null); setFromExt(''); setToExt('');
    setState(STATE.IDLE); setResultBlobs(null);
    setError(''); setProgress({ current: 0, total: 0 });
  };

  const isConverting = state === STATE.CONVERTING;

  const getFileIcon = () => {
    if (IMAGE_EXTS.includes(fromExt)) return <Img size={28} style={{ color: '#22d3ee' }} />;
    if (fromExt === 'pdf') return <FileText size={28} style={{ color: '#ef4444' }} />;
    if (PPT_EXTS.includes(fromExt)) return <Presentation size={28} style={{ color: '#ff6b35' }} />;
    return <File size={28} style={{ color: '#818cf8' }} />;
  };

  return (
    <div className="fc-wrapper">

      {/* ── Header strip ─────────────────────────────────────── */}
      <div className="fc-header-strip">
        <Zap size={18} style={{ color: '#a78bfa' }} />
        <span>Universal converter — PDF, DOCX, PPTX, TXT, HTML, Images and more</span>
        <button
          className="fc-matrix-toggle"
          onClick={() => setShowMatrix(v => !v)}
          title="Show all supported conversions"
        >
          {showMatrix ? 'Hide' : 'View'} all formats
        </button>
      </div>

      {showMatrix && <ConversionMatrix />}

      {/* ── Drop Zone ─────────────────────────────────────────── */}
      {!file ? (
        <div {...getRootProps()} className={`dropzone fc-drop ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <UploadCloud className="dropzone-icon" />
          <h3 className="dropzone-text">{isDragActive ? 'Drop your file' : 'Drop any file to convert'}</h3>
          <p className="dropzone-subtext">PDF · DOCX · PPTX · TXT · HTML · PNG · JPG · WEBP · GIF · BMP</p>
          <div className="format-badges fc-fmt-row">
            {['pdf','docx','pptx','txt','html','png','jpg'].map(f => <FmtBadge key={f} ext={f} />)}
          </div>
        </div>
      ) : (
        <div className="fc-file-card">
          <div className="fc-file-icon">{getFileIcon()}</div>
          <div className="fc-file-info">
            <span className="fc-file-name">{file.name}</span>
            <span className="fc-file-size">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
          <button className="remove-btn" onClick={reset} title="Remove">
            <X size={18} />
          </button>
        </div>
      )}

      {/* ── Format Selectors ──────────────────────────────────── */}
      {file && (
        <div className="fc-selectors">
          {/* FROM — auto-detected, read-only */}
          <div className="fc-selector-group">
            <label className="fc-label">Detected Format</label>
            <div className="fc-detected-badge">
              {fromExt
                ? <>
                    <span className="fc-detected-icon">
                      {FORMAT_INFO[fromExt]?.icon || '📄'}
                    </span>
                    <FmtBadge ext={fromExt} large />
                    <span className="fc-detected-label">
                      {FORMAT_INFO[fromExt]?.label || fromExt.toUpperCase()}
                    </span>
                  </>
                : <span className="fc-detected-unknown">Unknown</span>
              }
            </div>
          </div>

          {/* Arrow */}
          <div className="fc-arrow">
            <ArrowRight size={24} style={{ color: '#818cf8' }} />
          </div>

          {/* TO */}
          <div className="fc-selector-group">
            <label className="fc-label">Convert To</label>
            <div className="fc-select-wrap">
              <select
                className="fc-select"
                value={toExt}
                onChange={e => { setToExt(e.target.value); setResultBlobs(null); setState(STATE.IDLE); }}
                disabled={isConverting || availableTargets.length === 0}
              >
                {availableTargets.length === 0
                  ? <option>No options</option>
                  : availableTargets.map(ext => (
                    <option key={ext} value={ext}>{FORMAT_INFO[ext]?.label || ext.toUpperCase()}</option>
                  ))
                }
              </select>
              {toExt && <FmtBadge ext={toExt} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Progress ──────────────────────────────────────────── */}
      {isConverting && progress.total > 0 && (
        <div className="fc-progress-wrap">
          <div className="fc-progress-track">
            <div
              className="fc-progress-bar"
              style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
            />
          </div>
          <span className="fc-progress-label">
            {PPT_EXTS.includes(fromExt) ? 'Slide' : 'Page'} {progress.current} of {progress.total}
          </span>
        </div>
      )}

      {/* ── Spinner (no page count) */}
      {isConverting && progress.total === 0 && (
        <div className="fc-progress-wrap">
          <div className="fc-progress-track">
            <div className="fc-progress-bar fc-progress-indeterminate" />
          </div>
          <span className="fc-progress-label">Converting…</span>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {state === STATE.ERROR && (
        <div className="fc-error">
          <X size={16} /> {error}
        </div>
      )}

      {/* ── Result card ───────────────────────────────────────── */}
      {state === STATE.DONE && resultBlobs && (
        <div className="fc-result-card">
          <CheckCircle2 size={22} style={{ color: '#10b981', flexShrink: 0 }} />
          <div className="fc-result-info">
            <span className="fc-result-title">Conversion complete!</span>
            {resultBlobs.type === 'images' && (
              <span className="fc-result-sub">
                {resultBlobs.blobs.length} page image{resultBlobs.blobs.length > 1 ? 's' : ''}
                {resultBlobs.blobs.length > 1 ? ' — downloaded as ZIP' : ''}
              </span>
            )}
            {resultBlobs.type === 'single' && (
              <span className="fc-result-sub">{resultBlobs.filename}</span>
            )}
          </div>
          <button className="btn-primary fc-download-btn" onClick={handleDownload}>
            <Download size={18} />
            <span>Download</span>
          </button>
        </div>
      )}

      {/* ── Convert Button ────────────────────────────────────── */}
      {file && state !== STATE.DONE && (
        <div className="actions">
          <button
            className="btn-primary btn-convert"
            onClick={convert}
            disabled={isConverting || !fromExt || !toExt}
          >
            {isConverting ? (
              <><Loader2 className="spin" size={20} /> Converting…</>
            ) : (
              <><RefreshCw size={20} /> Convert {fromExt?.toUpperCase()} → {toExt?.toUpperCase()}</>
            )}
          </button>
        </div>
      )}

      {/* ── Convert another ───────────────────────────────────── */}
      {state === STATE.DONE && (
        <div className="actions">
          <button className="btn-secondary" onClick={reset}>
            <RefreshCw size={16} /> Convert Another File
          </button>
        </div>
      )}

    </div>
  );
}
