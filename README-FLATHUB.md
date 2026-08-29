# EPUB Shelf - Flathub Packaging

Flatpak packaging for [EPUB Shelf](https://github.com/ribaudequin/epub-library-manager) — an EPUB library manager organized by series with automatic metadata extraction, cover art, reading progress tracking, and intelligent search.

## Installation

Once published on Flathub:

```bash
flatpak install flathub io.github.ribaudequin.epub-library-manager
```

## Running

```bash
flatpak run io.github.ribaudequin.epub-library-manager
```

## Local Build (For Developers)

```bash
# Install flatpak-builder
flatpak install -y flathub org.flatpak.Builder

# Build and install locally
flatpak-builder --user --install --force-clean build-dir io.github.ribaudequin.epub-library-manager.yml
```

## Files

| File | Purpose |
|------|---------|
| `io.github.ribaudequin.epub-library-manager.yml` | Flatpak manifest |
| `io.github.ribaudequin.epub-library-manager.desktop` | Desktop entry |
| `io.github.ribaudequin.epub-library-manager.metainfo.xml` | AppStream metadata |
| `run.sh` | Application launcher (zypak-wrapper) |
| `generated-sources.json` | Pre-fetched NPM dependencies |

## Technical Info

- **App ID**: `io.github.ribaudequin.epub-library-manager`
- **Runtime**: `org.freedesktop.Platform` 24.08
- **BaseApp**: `org.electronjs.Electron2.BaseApp`
- **SDK Extension**: `org.freedesktop.Sdk.Extension.node24`
- **Build**: `npm run dist:flatpak` (electron-builder dir output)

## Submission Status

This branch contains all the files required for Flathub submission. The submission process:

1. Fork `flathub/flathub` repository
2. Create a branch with the naming convention: `io.github.ribaudequin.epub-library-manager`
3. Copy these files to a directory named after the app ID
4. Validate manifest: `flatpak-builder-lint clean`
5. Test build locally: `flatpak-builder --user --install --force-clean build-dir io.github.ribaudequin.epub-library-manager.yml`
6. Create PR against the upstream `new-pr` branch
7. Wait for review (typically 1-4 weeks)
8. Address reviewer feedback
9. Merge when approved

## Permissions

The manifest uses minimal permissions required for the app:
- `--socket=wayland` / `--socket=fallback-x11` (display)
- `--device=dri` (GPU acceleration)
- `--share=network` (Electron sandbox requirements, not app usage)
- `--filesystem=xdg-documents:ro` (read user documents)
- `--env=ELECTRON_TRASH=gio` (proper trash integration)
