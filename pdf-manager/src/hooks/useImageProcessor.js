import { useState, useRef, useEffect, useCallback } from 'react';

export function useImageProcessor() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const [origInfo, setOrigInfo] = useState({ width: 0, height: 0, bytes: 0 });
  const [enhInfo, setEnhInfo] = useState({ width: 0, height: 0, bytes: 0 });

  const previewRef = useRef(null);
  const enhancedRef = useRef(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      if (enhancedRef.current) URL.revokeObjectURL(enhancedRef.current);
    };
  }, []);

  const loadFile = useCallback((selectedFile) => {
    if (!selectedFile) return;

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    if (enhancedRef.current) URL.revokeObjectURL(enhancedRef.current);

    setFile(selectedFile);
    const objUrl = URL.createObjectURL(selectedFile);
    previewRef.current = objUrl;
    setPreviewUrl(objUrl);

    const img = new Image();
    img.onload = () => {
      setOrigInfo({
        width: img.width,
        height: img.height,
        bytes: selectedFile.size,
      });
    };
    img.src = objUrl;

    setEnhancedUrl(null);
    enhancedRef.current = null;
    setEnhInfo({ width: 0, height: 0, bytes: 0 });
    setError(null);
  }, []);

  const reset = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    if (enhancedRef.current) URL.revokeObjectURL(enhancedRef.current);
    previewRef.current = null;
    enhancedRef.current = null;
    setFile(null);
    setPreviewUrl(null);
    setEnhancedUrl(null);
    setError(null);
  }, []);

  return {
    file,
    previewUrl,
    enhancedUrl,
    setEnhancedUrl,
    enhancedRef,
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    error,
    setError,
    origInfo,
    enhInfo,
    setEnhInfo,
    loadFile,
    reset,
  };
}
