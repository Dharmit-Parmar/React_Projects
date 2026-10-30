import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileUpload({ onFilesParsed, onLoadingState }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState('');

  const validateAndSetFiles = (files) => {
    const fileArray = Array.from(files);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

    const validFiles = [];
    let rejectedType = 0;
    let rejectedSize = 0;

    fileArray.forEach(f => {
      const isHtml = f.type === 'text/html' || f.name.toLowerCase().endsWith('.html');
      const isUnderLimit = f.size <= MAX_FILE_SIZE;

      if (!isHtml) rejectedType++;
      else if (!isUnderLimit) rejectedSize++;
      else validFiles.push(f);
    });

    if (validFiles.length === 0) {
      if (rejectedSize > 0) {
        setError('Files exceed the 50MB limit.');
      } else {
        setError('Please upload valid HTML files exported from Instagram.');
      }
      return;
    }

    let errorMsg = '';
    if (rejectedType > 0) errorMsg += `${rejectedType} non-HTML file(s) ignored. `;
    if (rejectedSize > 0) errorMsg += `${rejectedSize} file(s) over 50MB ignored.`;
    
    setError(errorMsg.trim());
    validFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setSelectedFiles(validFiles);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = useCallback(() => {
    if (selectedFiles.length === 0) return;
    if (onLoadingState) {
      onLoadingState('Reading files from disk...');
    }
    setTimeout(() => {
      const results = [];
      let completed = 0;
      selectedFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          results[idx] = { html: e.target.result, fileIndex: idx };
          completed++;
          if (completed === selectedFiles.length) {
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

  const springConfig = { type: "spring", bounce: 0, duration: 0.25 };

  return (
    <div className="upload-container">
      <motion.div 
        className="upload-hero"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springConfig}
        style={{ willChange: "transform, opacity" }}
      >
        <h1 className="upload-title">InstaChat Viewer</h1>
        <p className="upload-subtitle">
          Turn your exported Instagram DMs into a beautiful, readable chat
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springConfig, delay: 0.1 }}
        style={{ willChange: "transform, opacity" }}
        className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <AnimatePresence mode="wait">
          {isDragging ? (
            <motion.div 
              key="dragging"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springConfig}
              style={{ willChange: "transform, opacity" }}
            >
              <FileText size={52} className="upload-icon active" />
              <h2>Drop your files!</h2>
              <p>You can drop multiple HTML files at once</p>
            </motion.div>
          ) : (
            <motion.div 
              key="idle"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={springConfig}
              style={{ willChange: "transform, opacity" }}
            >
              <Upload size={52} className="upload-icon" />
              <h2>Drag & drop your files here</h2>
              <p>Supports multiple files — message_1.html, message_2.html, etc.</p>
            </motion.div>
          )}
        </AnimatePresence>

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
      </motion.div>

      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={springConfig}
            style={{ willChange: "transform, opacity" }}
            className="file-list"
          >
            <div className="file-list-header">
              <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
              <button className="file-list-clear" onClick={() => setSelectedFiles([])}>Clear all</button>
            </div>
            <div className="file-list-items">
              <AnimatePresence>
                {selectedFiles.map((file, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={springConfig}
                    style={{ willChange: "transform, opacity" }}
                    key={file.name + idx} 
                    className="file-item"
                  >
                    <FileText size={16} className="file-item-icon" />
                    <span className="file-item-name">{file.name}</span>
                    <span className="file-item-size">{(file.size / 1024).toFixed(0)} KB</span>
                    <button className="file-item-remove" onClick={() => removeFile(idx)}>
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <button className="load-button" onClick={handleUpload}>
              <CheckCircle size={18} />
              Load Chat{selectedFiles.length > 1 ? 's' : ''}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
