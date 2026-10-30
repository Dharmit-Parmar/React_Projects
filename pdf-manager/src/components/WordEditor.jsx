import React, { useState, useRef, useEffect, useCallback } from 'react';
import mammoth from 'mammoth';
import jsPDF from 'jspdf';
import {
  FileText, Download, Undo, Redo, Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  Heading1, Heading2, Heading3, Highlighter, Palette, Upload, Trash2,
  Sparkles, Check, FileDown, Copy
} from 'lucide-react';

export default function WordEditor() {
  const [docTitle, setDocTitle] = useState('Report_2');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [selectedFontSize, setSelectedFontSize] = useState('16px');
  const [textColor, setTextColor] = useState('#0f172a');
  const [highlightColor, setHighlightColor] = useState('#ffffff');
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Update word and character counts on content change
  const updateCounts = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(text.length);
  }, []);

  // Format execution wrapper (using document.execCommand for seamless native undo/redo & styling)
  const format = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      updateCounts();
    }
  };

  // Initial template document content
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML.trim()) {
      editorRef.current.innerHTML = `
        <h1 style="color: #1e293b; font-size: 28px; margin-bottom: 8px;">Report 2: Project Assessment & Summary</h1>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;"><em>Prepared by Research & Engineering Team · Updated October 2026</em></p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
        <h2 style="color: #334155; font-size: 20px; margin-bottom: 12px;">1. Executive Summary</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #1e293b; margin-bottom: 16px;">
          This document can be edited directly like Microsoft Word or Google Docs. You can modify headings, erase sections, change typography, or type new paragraphs with zero white-tape patches or awkward cut-offs.
        </p>
        <h2 style="color: #334155; font-size: 20px; margin-bottom: 12px;">2. Key Highlights</h2>
        <ul style="font-size: 16px; line-height: 1.6; color: #1e293b; margin-bottom: 16px;">
          <li>Full document-level formatting with bold, italics, alignment, and custom font sizes.</li>
          <li>Accurate conversion and export to both Word (.docx) and PDF (.pdf).</li>
          <li>Preserves page flow, layout structure, and document typography seamlessly.</li>
        </ul>
      `;
      updateCounts();
    }
  }, [updateCounts]);

  // Load Word (.docx) or Text/HTML file into the editor
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const baseName = file.name.replace(/\.[^.]+$/, '');
    setDocTitle(baseName);

    try {
      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          updateCounts();
        }
        showToast(`Loaded ${file.name} successfully!`);
      } else if (ext === 'txt') {
        const text = await file.text();
        const html = text.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          updateCounts();
        }
        showToast(`Loaded ${file.name}`);
      } else if (ext === 'html' || ext === 'htm') {
        const html = await file.text();
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          updateCounts();
        }
        showToast(`Loaded ${file.name}`);
      } else {
        showToast('Please upload a .docx, .txt, or .html document.');
      }
    } catch (err) {
      showToast('Error reading file: ' + err.message);
    }
  };

  // Export as Word (.docx)
  const exportDocx = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${docTitle}</title>
      <style>
        body { font-family: ${selectedFont}, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
        h1 { font-size: 20pt; color: #0f172a; margin-bottom: 8pt; }
        h2 { font-size: 15pt; color: #1e293b; margin-bottom: 6pt; }
        h3 { font-size: 13pt; color: #334155; margin-bottom: 4pt; }
        p { margin-bottom: 10pt; }
      </style></head><body>
    `;
    const postHtml = "</body></html>";
    const fullHtml = preHtml + content + postHtml;

    const blob = new Blob(['\ufeff', fullHtml], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.trim() || 'document'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported Word document (.docx)');
  };

  // Export as PDF
  const exportPdf = async () => {
    if (!editorRef.current) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 40;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;

      await doc.html(editorRef.current, {
        callback: function (pdf) {
          const safeName = `${docTitle.trim() || 'document'}.pdf`;
          pdf.save(safeName);
          setIsExporting(false);
          showToast(`Exported ${safeName}`);
        },
        x: margin,
        y: margin,
        width: contentWidth,
        windowWidth: 794 // Standard A4 pixel width at 96 DPI
      });
    } catch (err) {
      setIsExporting(false);
      showToast('PDF Export error: ' + err.message);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: '820px',
      background: 'rgba(15,23,42,0.6)', borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)',
      overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.4)'
    }}>
      {/* Toast notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.5)',
          color: '#e2e8f0', padding: '10px 20px', borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 99999,
          fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Check size={16} color="#818cf8" /> {toastMessage}
        </div>
      )}

      {/* ── Top Header / Document Title Bar ── */}
      <div style={{
        height: '60px', background: 'rgba(10,14,26,0.85)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', gap: '16px', flexWrap: 'wrap'
      }}>
        {/* Title input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
          }}>
            <FileText size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input
              type="text"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="Document Title"
              title="Click to rename document"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: '#f8fafc', fontSize: '1rem', fontWeight: 600,
                padding: '2px 4px', borderRadius: '4px', maxWidth: '280px'
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748b', paddingLeft: '4px' }}>
              Word Document Format · Flowing Text & Real Headings
            </span>
          </div>
        </div>

        {/* Actions: Open & Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.txt,.html,.htm"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s ease'
            }}
          >
            <Upload size={14} /> Open DOCX
          </button>

          <button
            onClick={exportDocx}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              color: '#93c5fd', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s ease'
            }}
          >
            <FileDown size={14} /> Save as Word (.docx)
          </button>

          <button
            onClick={exportPdf}
            disabled={isExporting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none',
              color: 'white', fontSize: '0.82rem', fontWeight: 600,
              boxShadow: '0 2px 10px rgba(16,185,129,0.3)', transition: 'all 0.15s ease'
            }}
          >
            <Download size={14} /> {isExporting ? 'Exporting PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Word-Style Formatting Ribbon ── */}
      <div style={{
        background: 'rgba(15,23,42,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '8px 16px', display: 'flex', alignItems: 'center',
        gap: '8px', flexWrap: 'wrap'
      }}>
        {/* Undo / Redo */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={() => format('undo')} title="Undo (Ctrl+Z)" style={ribbonBtnStyle}><Undo size={15} /></button>
          <button onClick={() => format('redo')} title="Redo (Ctrl+Y)" style={ribbonBtnStyle}><Redo size={15} /></button>
        </div>

        <div style={ribbonDividerStyle} />

        {/* Headings / Style dropdown */}
        <select
          onChange={e => format('formatBlock', e.target.value)}
          defaultValue="p"
          style={ribbonSelectStyle}
        >
          <option value="p">Normal Text</option>
          <option value="h1">Heading 1 (Title)</option>
          <option value="h2">Heading 2 (Section)</option>
          <option value="h3">Heading 3 (Subsection)</option>
          <option value="blockquote">Quote Block</option>
        </select>

        {/* Font Family dropdown */}
        <select
          value={selectedFont}
          onChange={e => {
            setSelectedFont(e.target.value);
            format('fontName', e.target.value);
          }}
          style={ribbonSelectStyle}
        >
          <option value="Arial">Arial (Sans)</option>
          <option value="Times New Roman">Times New Roman (Serif)</option>
          <option value="Courier New">Courier New (Mono)</option>
          <option value="Georgia">Georgia (Classic)</option>
          <option value="Verdana">Verdana</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
        </select>

        {/* Font Size dropdown */}
        <select
          value={selectedFontSize}
          onChange={e => {
            setSelectedFontSize(e.target.value);
            // execCommand fontSize uses 1 to 7
            const map = { '12px': '2', '14px': '3', '16px': '4', '18px': '5', '24px': '6', '32px': '7' };
            format('fontSize', map[e.target.value] || '3');
          }}
          style={{ ...ribbonSelectStyle, width: '70px' }}
        >
          <option value="12px">12pt</option>
          <option value="14px">14pt</option>
          <option value="16px">16pt</option>
          <option value="18px">18pt</option>
          <option value="24px">24pt</option>
          <option value="32px">32pt</option>
        </select>

        <div style={ribbonDividerStyle} />

        {/* Basic Styles: B / I / U / S */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={() => format('bold')} title="Bold (Ctrl+B)" style={ribbonBtnStyle}><Bold size={15} /></button>
          <button onClick={() => format('italic')} title="Italic (Ctrl+I)" style={ribbonBtnStyle}><Italic size={15} /></button>
          <button onClick={() => format('underline')} title="Underline (Ctrl+U)" style={ribbonBtnStyle}><Underline size={15} /></button>
          <button onClick={() => format('strikeThrough')} title="Strikethrough" style={ribbonBtnStyle}><Strikethrough size={15} /></button>
        </div>

        <div style={ribbonDividerStyle} />

        {/* Colors: Text & Highlight */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label title="Text Color" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
            <Palette size={14} color="#94a3b8" />
            <input
              type="color"
              value={textColor}
              onChange={e => {
                setTextColor(e.target.value);
                format('foreColor', e.target.value);
              }}
              style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
          </label>

          <label title="Highlight Color" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '2px' }}>
            <Highlighter size={14} color="#94a3b8" />
            <input
              type="color"
              value={highlightColor}
              onChange={e => {
                setHighlightColor(e.target.value);
                format('hiliteColor', e.target.value);
              }}
              style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
          </label>
        </div>

        <div style={ribbonDividerStyle} />

        {/* Alignment */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={() => format('justifyLeft')} title="Align Left" style={ribbonBtnStyle}><AlignLeft size={15} /></button>
          <button onClick={() => format('justifyCenter')} title="Center" style={ribbonBtnStyle}><AlignCenter size={15} /></button>
          <button onClick={() => format('justifyRight')} title="Align Right" style={ribbonBtnStyle}><AlignRight size={15} /></button>
          <button onClick={() => format('justifyFull')} title="Justify" style={ribbonBtnStyle}><AlignJustify size={15} /></button>
        </div>

        <div style={ribbonDividerStyle} />

        {/* Lists */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={() => format('insertUnorderedList')} title="Bullet List" style={ribbonBtnStyle}><List size={15} /></button>
          <button onClick={() => format('insertOrderedList')} title="Numbered List" style={ribbonBtnStyle}><ListOrdered size={15} /></button>
          <button onClick={() => format('insertHorizontalRule')} title="Divider Line" style={ribbonBtnStyle}>—</button>
        </div>

        <div style={ribbonDividerStyle} />

        {/* Clear formatting */}
        <button
          onClick={() => format('removeFormat')}
          title="Clear Formatting"
          style={{ ...ribbonBtnStyle, fontSize: '11px', width: 'auto', padding: '0 8px' }}
        >
          Clear Style
        </button>
      </div>

      {/* ── Document Page Canvas (A4 Paper View) ── */}
      <div style={{
        flex: 1, overflowY: 'auto', background: '#090d16',
        display: 'flex', justifyContent: 'center', padding: '40px 20px',
      }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={updateCounts}
          style={{
            width: '800px', minHeight: '1050px', background: '#ffffff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', borderRadius: '4px',
            padding: '60px 70px', outline: 'none', boxSizing: 'border-box',
            color: '#1e293b', fontSize: '16px', lineHeight: '1.6',
            fontFamily: `${selectedFont}, Arial, sans-serif`,
            cursor: 'text'
          }}
        />
      </div>

      {/* ── Bottom Status Bar ── */}
      <div style={{
        height: '32px', background: 'rgba(10,14,26,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', fontSize: '11px', color: '#64748b'
      }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span><strong>Words:</strong> {wordCount}</span>
          <span><strong>Characters:</strong> {charCount}</span>
          <span><strong>Estimated Read Time:</strong> {Math.max(1, Math.ceil(wordCount / 200))} min</span>
        </div>
        <div>
          <span>Press <strong>Tab</strong> to indent · <strong>Ctrl+B</strong> for Bold · <strong>Ctrl+Z</strong> for Undo</span>
        </div>
      </div>
    </div>
  );
}

const ribbonBtnStyle = {
  width: '30px', height: '30px', borderRadius: '6px', border: 'none',
  background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s ease'
};

const ribbonSelectStyle = {
  height: '30px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
  color: '#e2e8f0', padding: '0 8px', fontSize: '12px', outline: 'none',
  cursor: 'pointer'
};

const ribbonDividerStyle = {
  width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 4px'
};
