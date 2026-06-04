const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectMedia: () => ipcRenderer.invoke('select-media'),
  getPhotos: () => ipcRenderer.invoke('get-photos'),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  onPhotoScanned: (callback) => {
    ipcRenderer.removeAllListeners('photo-scanned');
    ipcRenderer.on('photo-scanned', (_event, value) => callback(value));
  },
  onScanProgress: (callback) => {
    ipcRenderer.removeAllListeners('scan-progress');
    ipcRenderer.on('scan-progress', (_event, value) => callback(value));
  },
  onScanComplete: (callback) => {
    ipcRenderer.removeAllListeners('scan-complete');
    ipcRenderer.on('scan-complete', () => callback());
  }
});
