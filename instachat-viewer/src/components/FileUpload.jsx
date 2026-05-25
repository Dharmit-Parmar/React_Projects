import React, { useCallback, useState } from 'react';
import { Upload, FileText } from 'lucide-react';

export default function FileUpload({ onFileParsed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.html')) {
      setError('Please upload an HTML file from Instagram\'s "Download Your Data" export.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => onFileParsed(e.target.result);
    reader.readAsText(file);
  }, [onFileParsed]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files[0]);
  }, [handleFileUpload]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="upload-container">
      <div className="upload-hero">
        <div className="upload-logo-glow" />
        <h1 className="upload-title">InstaChat Viewer</h1>
        <p className="upload-subtitle">Turn your exported Instagram DMs into a beautiful, readable chat</p>
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
            <h2>Drop it!</h2>
            <p>Release to upload your chat file</p>
          </>
        ) : (
          <>
            <Upload size={52} className="upload-icon" />
            <h2>Drag & drop your file here</h2>
            <p>or click below to browse</p>
          </>
        )}

        <label className="upload-button">
          <input
            type="file"
            accept=".html"
            onChange={(e) => handleFileUpload(e.target.files[0])}
            className="hidden-input"
          />
          Select HTML File
        </label>

        {error && <p className="upload-error">{error}</p>}

        <p className="upload-hint">
          Export from Instagram → Settings → Your activity → Download your information → Messages
        </p>
      </div>
    </div>
  );
}
