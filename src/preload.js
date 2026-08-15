const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectLibrary: () => ipcRenderer.invoke('dialog:select-library'),
  scan: (rootPath) => ipcRenderer.invoke('library:scan', rootPath),
  setStatus: (seriesId, volumeId, status) =>
    ipcRenderer.invoke('library:set-status', { seriesId, volumeId, status }),
  bulkSetStatus: (seriesId, updates) =>
    ipcRenderer.invoke('library:bulk-status', { seriesId, updates }),
  setSeriesState: (seriesId, seriesState) =>
    ipcRenderer.invoke('library:set-series-state', { seriesId, seriesState }),
  getRoot: () => ipcRenderer.invoke('library:get-root'),
  readCover: (coverPath) => ipcRenderer.invoke('cover:read', coverPath),
  onProgress: (callback) => {
    ipcRenderer.on('library:progress', (_event, progress) => callback(progress));
  },
});
