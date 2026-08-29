# EPUB Shelf

A desktop application for managing your EPUB library, organized by series — with automatic metadata extraction, cover art, reading progress tracking, and intelligent search.

**v1.8.2** · [Download](https://github.com/ribaudequin/epub-library-manager/releases/tag/v1.8.2) · Linux (AppImage) · Windows (Installer + Portable) · Flatpak (build files)

---

## Features

- **📚 Recursive EPUB Scanner** — Index entire folder trees instantly with localStorage cache (scans that took 75s now run in <1s after first run)
- **🏷️ Metadata Extraction** — Title, author, series state (Ongoing/Acabada/Cancelada/Hiatus), and cover art pulled from inside each EPUB
- **🖼️ Series Grid** — Browse series as cards (100×140px covers) with dominant-tint coloring, reading progress bars, and skeleton shimmer loading
- **📖 Volume Detail View** — Per-series view with all volumes, states (lido / não lido / pendente), and bulk status actions
- **🔍 CTRL+K Search** — Fuzzy-match search across titles and authors with real-time result count
- **⬆️ Smart Sorting** — Sort by A→Z, Z→A, reading progress, or last-updated date (persisted in localStorage)
- **🌓 Dark & Light Themes** — Toggle between themes with persistent localStorage. WCAG-accessible with colored-tint backgrounds derived from cover art
- **📊 Statistics Dashboard** — Modal with library overview: total series/volumes, read count, progress %, state breakdown chart, largest series, and 30-day activity timeline (pure CSS/SVG)
- **♿ Accessibility First** — Focus-visible outlines, `prefers-reduced-motion`, ARIA live regions, keyboard navigation, WCAG-compliant tooltips and contrast ratios
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

- **Operating System**: Linux (AppImage) or Windows (NSIS installer / portable)
- **Node.js**: 18+ (for building from source)
- **npm**: 9+

### Install & Run

#### Linux (AppImage)

#### Linux (Flatpak)

**Build files for Flatpak submission**:
Download `BibliotecaEpub-1.8.1-flatpak.tar.gz` from [GitHub Releases](https://github.com/ribaudequin/epub-library-manager/releases/tag/v1.8.1).

```bash
# Extract the build archive
tar -xzf BibliotecaEpub-1.8.1-flatpak.tar.gz
cd flathub/

# Build and install via Flatpak
flatpak-builder --user --install --force-clean build-dir io.github.ribaudequin.epub-library-manager.yml

# Run the app
flatpak run io.github.ribaudequin.epub-library-manager
```

Once the app is approved on Flathub, you can install directly:
```bash
flatpak install flathub io.github.ribaudequin.epub-library-manager
```

#### Linux (AppImage)

```bash
git clone https://github.com/ribaudequin/epub-library-manager.git
cd epub-library-manager
npm install
npm start
```

#### Windows

**Option A: Installer (recommended)**
Download `BibliotecaEpub Setup 1.8.0.exe` from [GitHub Releases](https://github.com/ribaudequin/epub-library-manager/releases/tag/v1.8.0), double-click to install.

> **Windows SmartScreen note**: Since this app is unsigned, Windows may show a warning. Click **"More info"** → **"Run anyway"** to proceed. This is normal for unsigned open-source apps.

**Option B: Portable (no installation, no SmartScreen warning)**
Download `BibliotecaEpub 1.8.0.exe`, double-click to run directly. No installation required.

### Build AppImage

```bash
npm run dist
```

The built AppImage appears in `dist/BibliotecaEpub-1.8.0.AppImage`.

### Build for Windows

```bash
npm run dist:win              # NSIS installer
npm run dist:win:portable     # Portable .exe (no SmartScreen)
```

### Build All Platforms

```bash
npm run dist:all              # AppImage + NSIS + portable
npm run dist:flatpak          # Flatpak dir build
```

### Features Highlights v1.8.0

- **🌍 Multi-language (PT/EN)** — Automatic system language detection via `app.getLocale()`. Translation engine inline in `translations.js` (no `fetch()` failures on `file://`)
- **🔄 Auto-refresh** — File watcher (`fs.watch` + 2s debounce) automatically rescans when you add/remove/edit EPUBs
- **📅 Localized Dates** — Relative dates adapt to locale (e.g., "21 months ago" / "há 21 meses")
- **🌓 Light Theme** — Toggle with persistent localStorage. Anti-flash script in `<head>`. Ghost-style toolbar buttons
- **📊 Statistics Dashboard** — 4 summary cards + state breakdown (CSS bars) + largest series + 30-day activity (SVG). All computed client-side
- **♿ WCAG AA** — All buttons pass 4.5:1 contrast. Modal with focus management and Escape to close

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Electron 31 (Node.js + Chromium) |
| **Renderer** | Vanilla JavaScript |
| **UI** | HTML5, CSS Grid/Flex, CSS Custom Properties (themes) |
| **EPUB Parsing** | `adm-zip` (ZIP extraction), `@xmldom/xmldom` (XML metadata) |
| **Testing** | Vitest, Playwright |
| **Packaging** | electron-builder (AppImage, NSIS, Portable) |
| **Flatpak** | Flatpak manifest + build files (Flathub submission ready) |

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
npm install          # Install dependencies
npm start            # Launch app in development mode
npm test             # Run test suite (validate-modules.js + Vitest)
npm run dist         # Build AppImage for Linux
npm run dist:win     # Build NSIS installer for Windows
npm run dist:all     # Build all platforms
```

> **Note**: Windows builds are cross-compiled from Linux using Wine. No code changes needed for cross-platform support.

---

## License

[MIT](./LICENSE) — see the [LICENSE](LICENSE) file for details.

---

## Author

**Marcelo Salvador** — [@ribaudequin](https://github.com/ribaudequin)

Project home: [https://github.com/ribaudequin/epub-library-manager](https://github.com/ribaudequin/epub-library-manager)
