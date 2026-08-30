# Memory Archive — Biblioteca de Epubs

Versões anteriores a v1.7.0. Detalhes completos preservados para referência.

---

## 🚀 Releases Arquivadas

### v1.6.0 (2026-08-20)
- Feature: i18n multi-language (PT/EN) with automatic system locale detection
- Implementation: `translations.js` inline engine (setLocale/getLocale/t); `locales/pt.json` + `locales/en.json`; `main.js` exposes `app:getLocale` IPC; `renderer.js` loads system language and translates UI dynamically
- Auto-refresh: File watcher (`fs.watch`) + 2s debounce → auto rescan on add/remove/edit
- Critical bugfix: Removed `contextBridge.exposeInMainWorld('i18n', placeholder)` from `preload.js` that was overriding `translations.js` and causing all keys to show instead of translations
- Critical bugfix: `formatRelativeDate` had hardcoded PT strings (hoje, há, mês) — now uses `window.i18n.t()` with new `date_*` and `unit_*` keys
- Cleanup: Removed duplicate `updateUI`/`updateI18nLabels`/`initLocale` functions; replaced all hardcoded strings with `t()`
- Build: `dist/BibliotecaEpub-1.6.0.AppImage` (103MB) ✓
- Backup: `~/backups/biblioteca/BibliotecaEpub-1.6.0.AppImage` ✓
- GitHub: Release v1.6.0 created with AppImage attached ✓

### v1.5.0 (2026-08-19)
- Feature: localStorage scan cache (75s→instant on subsequent opens)
- Build: `dist/BibliotecaEpub-1.5.0.AppImage` (107MB) ✓

### v1.4.0 (2026-08-16)
- Search Ctrl+K, dropdown sort, skeleton grid, WCAG tooltips, relative date fix, fix future timestamps in getRecursiveMtime.

### v1.3.0 (2026-08-15/16)
- Metadata (Author), relative date mtime, series states (4 badge states), card tint from dominant cover color, UI/UX audit.

### v1.2.0 (2026-08-14)
- Memory cache LRU, lazy-load IntersectionObserver, throttling, progress scan, MIME-validated disk cache.

### v1.2.1 (2026-08-15)
- Loading bar, read progress bar in grid, bulk read/unread button (IPC library:bulk-status).

---

## 🪵 Update Log Arquivado

- 2026-08-12: Project created. Scan: 247 series / 2417 volumes in ~12s. Covers: 0/2417 missing.
- 2026-08-12: xml2js → @xmldom/xmldom. AppImage regenerated. `npm test` + `git init`.
- 2026-08-13: v1.1.0 — lazy-load.
- 2026-08-14: v1.2.0 — memory cache, lazy-load, throttling.
- 2026-08-15: v1.2.1 — progress bar, read progress, bulk status.
- 2026-08-15: v1.3.0 — metadata, dates, series states.
- 2026-08-15: UI audit (Vercel guidelines).
- 2026-08-16: v1.4.0 — search Ctrl+K, sort, skeleton, tooltips, date fix.
- 2026-08-19: v1.5.0 — localStorage cache.
- 2026-08-20: v1.6.0 — i18n, file watcher, English README.
- 2026-08-20: GitHub Releases created for all tags (v1.0.0-base → v1.6.0).
- 2026-08-20: README.md all English; GitHub Releases for all tags; Windows cross-build (NSIS .exe) validated via Wine.
- 2026-08-20: Feasibility study for Windows port — result: M (~8-10h), no code changes needed, Wine build works. Planning v1.7.0.
- 2026-08-20: Synced locales/*.json with translations.js (added date_*, unit_* keys for localized relative dates).
- 2026-08-20: Removed deprecated `spectron` devDep from package.json; added `build.win`/`build.nsis` config + `dist:win` script.
- 2026-08-20: Windows 11 validation — SmartScreen one-time warning, covers load, file watcher, state persistence all working.
- 2026-08-20: Windows release assets uploaded (NSIS installer + portable .exe). Release v1.6.0 public with both Linux + Windows builds.
