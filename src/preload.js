const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectLibrary: () => ipcRenderer.invoke('dialog:select-library'),
  scan: (rootPath) => ipcRenderer.invoke('library:scan', rootPath),
  setStatus: (seriesId, volumeId, status) =>
    ipcRenderer.invoke('library:set-status', { seriesId, volumeId, status }),
  getRoot: () => ipcRenderer.invoke('library:get-root'),
  onProgress: (callback) => {
    ipcRenderer.on('library:progress', (_event, progress) => callback(progress));
  },
});
