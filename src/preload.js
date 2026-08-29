const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectLibrary: () => ipcRenderer.invoke('dialog:select-library'),
  scan: (rootPath) => ipcRenderer.invoke('library:scan', rootPath),
  getMtime: (rootPath) => ipcRenderer.invoke('library:mtime', rootPath),
  setStatus: (seriesId, volumeId, status) =>
    ipcRenderer.invoke('library:set-status', { seriesId, volumeId, status }),
  bulkSetStatus: (seriesId, updates) =>
    ipcRenderer.invoke('library:bulk-status', { seriesId, updates }),
  setSeriesState: (seriesId, seriesState) =>
    ipcRenderer.invoke('library:set-series-state', { seriesId, seriesState }),
  getRoot: () => ipcRenderer.invoke('library:get-root'),
  readCover: (coverPath) => ipcRenderer.invoke('cover:read', coverPath),
  watchLibrary: (rootPath) => ipcRenderer.invoke('library:watch', rootPath),
  unwatchLibrary: () => ipcRenderer.invoke('library:unwatch'),
  getLocale: () => ipcRenderer.invoke('app:getLocale'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  onLibraryChanged: (callback) => {
    ipcRenderer.on('library:changed', (_event, data) => callback(data));
  },
  onProgress: (callback) => {
    ipcRenderer.on('library:progress', (_event, data) => callback(data));
  },
  onCoverLoaded: (callback) => {
    ipcRenderer.on('library:cover-loaded', (_event, coverPath) => callback(coverPath));
  },
});
