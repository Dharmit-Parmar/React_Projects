import { useState, useCallback } from 'react';

export function useWorkspaceFiles(initialFiles = []) {
  const [files, setFiles] = useState(initialFiles);

  const addFiles = useCallback((newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    setFiles((prev) => {
      const existingNames = new Set(prev.map(f => `${f.name}-${f.size}`));
      const unique = newFiles.filter(f => !existingNames.has(`${f.name}-${f.size}`));
      return [...prev, ...unique];
    });
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const moveFile = useCallback((index, direction) => {
    setFiles((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }, []);

  const sortFilesAlphabetically = useCallback(() => {
    setFiles((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const reverseOrder = useCallback(() => {
    setFiles((prev) => [...prev].reverse());
  }, []);

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return {
    files,
    setFiles,
    addFiles,
    removeFile,
    clearFiles,
    moveFile,
    sortFilesAlphabetically,
    reverseOrder,
    totalBytes,
    totalFormatted: formatBytes(totalBytes),
    count: files.length,
  };
}
