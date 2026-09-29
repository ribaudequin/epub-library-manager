// Tauri preload básico — substitui electron contextBridge
// Mantém a API exposta em window.api para compatibilidade com renderer.js

if (typeof window !== 'undefined') {
  window.__TAURI__ = window.__TAURI__ || {};
}

// Expor invoke básico (no Tauri, window.__TAURI__.invoke é nativo)
// Para este protótipo, simulamos a interface existente
window.api = {
  selectLibrary: () => window.__TAURI__?.invoke('dialog:select-library'),
  scan: (rootPath) => window.__TAURI__?.invoke('library:scan', { rootPath }),
  getMtime: (rootPath) => window.__TAURI__?.invoke('library:mtime', { rootPath }),
  setStatus: (seriesId, volumeId, status) => window.__TAURI__?.invoke('library:set-status', { seriesId, volumeId, status }),
  bulkSetStatus: (seriesId, updates) => window.__TAURI__?.invoke('library:bulk-status', { seriesId, updates }),
  setSeriesState: (seriesId, seriesState) => window.__TAURI__?.invoke('library:set-series-state', { seriesId, seriesState }),
  getRoot: () => window.__TAURI__?.invoke('library:get-root'),
  readCover: (coverPath) => window.__TAURI__?.invoke('cover:read', { coverPath }),
  watchLibrary: (rootPath) => window.__TAURI__?.invoke('library:watch', { rootPath }),
  unwatchLibrary: () => window.__TAURI__?.invoke('library:unwatch'),
  getLocale: () => window.__TAURI__?.invoke('app:getLocale'),
  openExternal: (url) => window.__TAURI__?.invoke('shell:openExternal', { url }),
  onLibraryChanged: (callback) => {
    // Em Tauri real: window.__TAURI__.event.listen('library:changed', (e) => callback(e.payload))
    console.log('[preload] onLibraryChanged (stub)');
  },
  onProgress: (callback) => {
    console.log('[preload] onProgress (stub)');
  },
  onCoverLoaded: (callback) => {
    console.log('[preload] onCoverLoaded (stub)');
  },
};

console.log('[tauri preload] API exposta em window.api');
