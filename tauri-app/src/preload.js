window.api = {
  selectLibrary: () => window.__TAURI__?.invoke('plugin:dialog|open'),
  scan: (rootPath) => window.__TAURI__?.invoke('library_scan', { rootPath }),
  getRoot: () => window.__TAURI__?.invoke('library_get_root'),
  setStatus: (seriesId, volumeId, status) => window.__TAURI__?.invoke('library_set_status', { seriesId, volumeId, status }),
  bulkSetStatus: (seriesId, updates) => window.__TAURI__?.invoke('library_set_status', { seriesId, volumeId: "bulk", status: "pendente" }),
  setSeriesState: (seriesId, seriesState) => true,
  getMtime: () => ({ rootMtime: 0, cacheKey: '' }),
  readCover: () => null,
  watchLibrary: () => false,
  unwatchLibrary: () => true,
  getLocale: () => window.__TAURI__?.invoke('app_get_locale'),
  openExternal: (url) => window.__TAURI__?.invoke('plugin:shell|open', { url }),
  onLibraryChanged: () => {},
  onProgress: () => {},
  onCoverLoaded: () => {},
};
console.log('[tauri preload] API conectada ao backend Rust (stubs)');
