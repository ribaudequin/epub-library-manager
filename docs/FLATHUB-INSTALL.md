# Biblioteca de Epubs - Flatpak Installation

## Quick Start

### Option 1: Install from Flathub (Recommended)
```bash
flatpak install flathub io.github.ribaudequin.epub-library-manager
```

### Option 2: Install local bundle
```bash
flatpak install --user BibliotecaEpub-1.8.0.flatpak
```

## Usage

After installation, you can run the app from your application menu or terminal:
```bash
flatpak run io.github.ribaudequin.epub-library-manager
```

## Permissions

This app requires minimal permissions:
- Filesystem access: Read-only access to user documents (for scanning EPUB folders)
- Display: Wayland/X11 for UI rendering
- Network: Limited to Electron sandbox requirements (app itself is offline)

To manage permissions after installation:
```bash
# View current permissions
flatpak info --show-permissions io.github.ribaudequin.epub-library-manager

# Reset permissions to defaults
flatpak permission-reset io.github.ribaudequin.epub-library-manager
```

## Troubleshooting

### App doesn't see my EPUB collection
By default, the app can only access your Documents folder. To grant access to additional locations:
```bash
flatpak override io.github.ribaudequin.epub-library-manager --filesystem=~/Path/To/Your/Books
```

### Covers not loading
Ensure you're giving the app access to folders containing EPUB files. First-time scanning may take longer as covers are extracted from EPUBs.

### Theme not applying correctly
The app supports dark/light themes. If using under a dark GTK theme, it should adapt automatically.

## Uninstalling

```bash
flatpak uninstall io.github.ribaudequin.epub-library-manager
flatpak uninstall --delete-data io.github.ribaudequin.epub-library-manager
```

## Development

To build the Flatpak bundle locally:
```bash
npm install
npm run dist:flatpak
flatpak-builder --user --install --force-clean build-dir io.github.ribaudequin.epub-library-manager.yml
flatpak build-bundle repo BibliotecaEpub-1.8.0.flatpak io.github.ribaudequin.epub-library-manager
```

## Support

Report issues: [GitHub Issues](https://github.com/ribaudequin/epub-library-manager/issues)
