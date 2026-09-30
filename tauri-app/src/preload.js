window.api = {
  selectLibrary: () => window.__TAURI__?.invoke('plugin:dialog|open'),
  scan: (rootPath) => window.__TAURI__?.invoke('library_scan', { rootPath }),
  getRoot: async () => {
    try { const r = await window.__TAURI__?.invoke('library_get_root'); return r || null; } catch { return null; }
  },
  setStatus: (seriesId, volumeId, status) => window.__TAURI__?.invoke('library_set_status', { seriesId, volumeId, status }),
  bulkSetStatus: (seriesId, updates) => window.__TAURI__?.invoke('library_set_status', { seriesId, volumeId: updates ? updates[0]?.volumeId || 'bulk' : 'bulk', status: updates ? updates[0]?.status || 'pendente' : 'pendente' }),
  setSeriesState: (seriesId, seriesState) => window.__TAURI__?.invoke('library_set_series_state', { seriesId, seriesState }),
  getMtime: (rootPath) => window.__TAURI__?.invoke('library_mtime', { rootPath }),
  readCover: async (path) => {
    const bytes = await window.__TAURI__?.invoke('cover_read', { path });
    if (!bytes || !bytes.length) return null;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return `data:image/jpeg;base64,${base64}`;
  },
  watchLibrary: (rootPath) => window.__TAURI__?.invoke('library_watch', { rootPath }),
  unwatchLibrary: () => window.__TAURI__?.invoke('library_unwatch'),
  getLocale: async () => {
    try { const r = await window.__TAURI__?.invoke('app_get_locale'); return r || { locale: 'pt-PT', isPt: true }; } catch { return { locale: 'pt-PT', isPt: true }; }
  },
  openExternal: (url) => window.__TAURI__?.invoke('plugin:shell|open', { url }),
  onLibraryChanged: () => (callback) => window.__TAURI__?.event?.listen?.('library_changed', callback) || (() => {}),
  onProgress: () => (callback) => window.__TAURI__?.event?.listen?.('library_progress', callback) || (() => {}),
  onCoverLoaded: () => (callback) => window.__TAURI__?.event?.listen?.('cover_loaded', callback) || (() => {}),
};
console.log('[tauri preload] API conectada ao backend Rust (stubs)');
