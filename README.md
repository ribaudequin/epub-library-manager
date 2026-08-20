# Biblioteca de EPUBs

A desktop application for managing your EPUB library, organized by series — with automatic metadata extraction, cover art, reading progress tracking, and intelligent search.

**v1.6.0** · [Download AppImage](https://github.com/ribaudequin/epub-library-manager/releases) · `npm run dist`

---

## Features

- **📚 Recursive EPUB Scanner** — Index entire folder trees instantly with localStorage cache (scans that took 75s now run in <1s after first run)
- **🏷️ Metadata Extraction** — Title, author, series state (Ongoing/Acabada/Cancelada/Hiatus), and cover art pulled from inside each EPUB
- **🖼️ Series Grid** — Browse series as cards (100×140px covers) with dominant-tint coloring, reading progress bars, and skeleton shimmer loading
- **📖 Volume Detail View** — Per-series view with all volumes, states (lido / não lido / pendente), and bulk status actions
- **🔍 CTRL+K Search** — Fuzzy-match search across titles and authors with real-time result count
- **⬆️ Smart Sorting** — Sort by A→Z, Z→A, reading progress, or last-updated date (persisted in localStorage)
- **🌓 Dark & Light Themes** — WCAG-accessible themes with colored-tint backgrounds derived from cover art
- **♿ Accessibility First** — Focus-visible outlines, `prefers-reduced-motion`, ARIA live regions, keyboard navigation, and WCAG-compliant tooltips
- **💾 Persistent State** — Reading progress and series state saved in `userData` JSON
- **🔄 Automatic Backup** — Cover images cached and backed up automatically

---

## Screenshots

> Screenshots will be added here. Place them in `docs/assets/` or link to GitHub releases.

| Series Grid | Volume Detail |
|---|---|
| `docs/assets/grid-view.png` | `docs/assets/detail-view.png` |

---

## Quick Start

### Prerequisites

- **Operating System**: Linux (AppImage)
- **Node.js**: 18+
- **npm**: 9+

### Install & Run

#### Linux (AppImage)

```bash
git clone https://github.com/ribaudequin/epub-library-manager.git
cd epub-library-manager
npm install
npm start
```

#### Windows

**Option A: Installer (recommended)**
Download `BibliotecaEpub Setup 1.6.0.exe` from [GitHub Releases](https://github.com/ribaudequin/epub-library-manager/releases), double-click to install.

> **Windows SmartScreen note**: Since this app is unsigned, Windows may show a warning. Click **"More info"** → **"Run anyway"** to proceed. This is normal for unsigned open-source apps.

**Option B: Portable (no installation, no SmartScreen warning)**
Download `BibliotecaEpub 1.6.0.exe`, double-click to run directly. No installation required.

### Build AppImage

```bash
npm run dist
```

The built AppImage appears in `dist/BibliotecaEpub-1.6.0.AppImage`.

### Features Highlights v1.6.0

- **🌍 Multi-language (PT/EN)** — Automatic system language detection via `app.getLocale()`. Translation engine inline in `translations.js` (no `fetch()` failures on `file://`)
- **🔄 Auto-refresh** — File watcher (`fs.watch` + 2s debounce) automatically rescans when you add/remove/edit EPUBs
- **📅 Localized Dates** — Relative dates adapt to locale (e.g., "21 months ago" / "há 21 meses")
- **🔄 Refresh Button** — Clear cache and force a full rescan manually

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Electron 31 (Node.js + Chromium) |
| **Renderer** | Vanilla JavaScript |
| **UI** | HTML5, CSS Grid/Flex, CSS Custom Properties (themes) |
| **EPUB Parsing** | `adm-zip` (ZIP extraction), `@xmldom/xmldom` (XML metadata) |
| **Testing** | Vitest, Playwright |
| **Packaging** | electron-builder (AppImage) |

---

## Project Structure

```
biblioteca/
├── src/
│   ├── main.js          # Electron main: IPC, scanLibrary, filesystem
│   ├── preload.js       # Context bridge between main and renderer
│   ├── library.js       # EPUB scan logic, metadata extraction, cache
│   ├── renderer/
│   │   ├── index.html   # App shell
│   │   ├── renderer.js  # UI state, rendering, event handlers
│   │   └── styles.css   # Themes, grid layout, animations
├── test/
│   ├── validate-modules.js   # Module export validation
│   ├── test-cache.js          # Cache scan tests
│   ├── test-volume.js         # Volume metadata tests
│   └── generate-test-library.js
├── build/
│   └── icon.png          # App icon (256×256)
├── dist/                 # Built AppImages (gitignored artifacts)
├── docs/                 # Documentation assets (screenshots)
└── package.json
```

### Architecture Overview

- **`main.js`** — Electron main process: handles IPC, orchestrates library scans, manages filesystem operations
- **`renderer.js`** — Browser window UI: series grid, search, sorting, theme toggling, progress rendering
- **`preload.js`** — Secure context bridge exposing `window.api` for main↔renderer communication
- **`library.js`** — Pure library logic: EPUB ZIP parsing, XML metadata extraction, cache management (no Electron imports)

---

## Usage Guide

### Managing Your Library

1. **Point to your EPUB folder** — The app scans recursively for `.epub` files
2. **Series auto-detection** — Volumes are grouped automatically based on naming patterns
3. **Mark reading status** — Toggle individual volumes or use bulk actions in the series detail view
4. **Search & filter** — Press `Ctrl+K` and type to fuzzy-match titles or authors
5. **Sort** — Use the sort dropdown to reorder by name, progress, or last-updated date

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Focus search |
| `Esc` | Clear search |
| `Enter` / `Space` | Activate series card |

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork & clone** the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and **run tests**: `npm test`
4. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/)
5. Push and open a Pull Request

### Development Workflow

```bash
npm install      # Install dependencies
npm start        # Launch app in development mode
npm test         # Run test suite (validate-modules.js + Vitest)
npm run dist     # Build AppImage for Linux
```

> **Note**: The AppImage is built with `electron-builder` targeting Linux. Cross-platform support is not currently planned.

---

## License

[MIT](./LICENSE) — see the [LICENSE](LICENSE) file for details.

---

## Author

**Marcelo Salvador** — [@ribaudequin](https://github.com/ribaudequin)

Project home: [https://github.com/ribaudequin/epub-library-manager](https://github.com/ribaudequin/epub-library-manager)
