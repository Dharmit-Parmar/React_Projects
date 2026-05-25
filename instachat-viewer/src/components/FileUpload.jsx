import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';

export default function FileUpload({ onFilesParsed, onLoadingState }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState('');

  const validateAndSetFiles = (files) => {
    const fileArray = Array.from(files);
    const htmlFiles = fileArray.filter(f => f.name.endsWith('.html'));
    const rejected = fileArray.length - htmlFiles.length;

    if (htmlFiles.length === 0) {
      setError('Please upload HTML files exported from Instagram.');
      return;
    }
    if (rejected > 0) {
      setError(`${rejected} non-HTML file(s) were ignored.`);
    } else {
      setError('');
    }

    // Sort by filename so message_1 < message_2 < message_3 etc.
    htmlFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setSelectedFiles(htmlFiles);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = useCallback(() => {
    if (selectedFiles.length === 0) return;

    if (onLoadingState) {
      onLoadingState('Reading files from disk...');
    }

    // Use a small timeout to let the UI paint the loading state
    setTimeout(() => {
      const results = [];
      let completed = 0;

      selectedFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          results[idx] = { html: e.target.result, fileIndex: idx };
          completed++;
          if (completed === selectedFiles.length) {
            // All files read — pass in order
            onFilesParsed(results);
          }
        };
        reader.readAsText(file);
      });
    }, 50);
  }, [selectedFiles, onFilesParsed, onLoadingState]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSetFiles(e.dataTransfer.files);
  }, []);

  const onDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);

  return (
    <div className="upload-container">
      <div className="upload-hero">
        <div className="upload-logo-glow" />
        <h1 className="upload-title">InstaChat Viewer</h1>
        <p className="upload-subtitle">
          Turn your exported Instagram DMs into a beautiful, readable chat
        </p>
      </div>

      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {isDragging ? (
          <>
            <FileText size={52} className="upload-icon active" />
            <h2>Drop your files!</h2>
            <p>You can drop multiple HTML files at once</p>
          </>
        ) : (
          <>
            <Upload size={52} className="upload-icon" />
            <h2>Drag & drop your files here</h2>
            <p>Supports multiple files — message_1.html, message_2.html, etc.</p>
          </>
        )}

        <label className="upload-button">
          <input
            type="file"
            accept=".html"
            multiple
            onChange={(e) => validateAndSetFiles(e.target.files)}
            className="hidden-input"
          />
          Select HTML File(s)
        </label>

        {error && <p className="upload-error">{error}</p>}

        <p className="upload-hint">
          Find your files at: Instagram → Settings → Download your information → Messages → HTML format
        </p>
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
            <button className="file-list-clear" onClick={() => setSelectedFiles([])}>Clear all</button>
          </div>
          <div className="file-list-items">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="file-item">
                <FileText size={16} className="file-item-icon" />
                <span className="file-item-name">{file.name}</span>
                <span className="file-item-size">{(file.size / 1024).toFixed(0)} KB</span>
                <button className="file-item-remove" onClick={() => removeFile(idx)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="load-button" onClick={handleUpload}>
            <CheckCircle size={18} />
            Load Chat{selectedFiles.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
