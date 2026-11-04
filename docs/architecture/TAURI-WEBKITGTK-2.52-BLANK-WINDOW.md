# Tauri / WebKitGTK 2.52 — Blank Window on Linux (Root Cause)

**Status:** Root cause identified and confirmed. The Tauri app code is correct;
the blank window is an upstream **WebKitGTK 2.52.6** bug on specific
Linux + Intel graphics configurations.

## Symptom

- The application window opens with the correct title bar, but the web content
  area is **completely blank** (no UI).
- Reproduces with the Tauri build (AppImage, deb, rpm and `cargo build`) and with
  native WebKitGTK apps such as `yelp` (GNOME Help) and `MiniBrowser`.
- The **Electron build renders correctly** on the same machine.

## Environment where it reproduces

| Item | Value |
|---|---|
| OS | Zorin OS 18.1 (noble) / Zorin OS 17.3 (jammy) |
| Kernel | 7.0.0-34 / 6.8.0-138 |
| GPU | Intel integrated (UHD 620 / Alder Lake-P `46a8`) |
| Mesa | 25.2.8 (noble-updates) |
| libglvnd | 1.7.0 |
| WebKitGTK | 2.52.6 |

Machines that **work**: Arch-based, Linux Mint, an older Zorin release with
Intel iGPU, a Zorin machine with AMD CPU + NVIDIA GPU, and Windows 11 (WebView2).

Pattern: **recent Zorin + Intel integrated GPU**.

## Diagnostic evidence

Tests performed on the affected machine:

| Test | Result |
|---|---|
| Electron app (Chromium) | renders correctly |
| Tauri app | blank |
| `yelp` (system WebKitGTK) | blank |
| `MiniBrowser` (WebKitGTK reference browser) | blank |
| Minimal Tauri app (green test page) | blank |
| Real Tauri app + **WebKitGTK 2.44.0** (overlaid via `bwrap`) | **renders correctly** |
| Control (real Tauri app + system WebKitGTK 2.52.6) | blank |

Additional findings:

- `WebKitGPUProcess` never spawns under 2.52.6.
- The environment variables below **reach** the sandboxed web process (verified
  via `/proc/<pid>/environ`) and do **not** fix the issue:
  - `WEBKIT_DISABLE_DMABUF_RENDERER=1`
  - `WEBKIT_DISABLE_COMPOSITING_MODE=1`
  - `LIBGL_ALWAYS_SOFTWARE=1`
  - `GDK_BACKEND=x11`
  - `WEBKIT_SKIA_ENABLE_CPU_RENDERING=1`
  - `EGL_PLATFORM=x11`

## Root cause

**WebKitGTK 2.52.6 fails to render web content** on this Zorin + Intel graphics
stack. **WebKitGTK 2.44.0 renders correctly.**

This is the same class of upstream bug reported by other Tauri/WebKitGTK
applications in 2025–2026 (blank window, `WebKitWebProcess` abort, or
`Could not create default EGL display: EGL_BAD_PARAMETER`).

## Impact on build artifacts

- **Local AppImage** (built on the affected Zorin): bundles WebKitGTK **2.52.6**
  → blank.
- **CI (GitHub Actions)** uses `ubuntu-latest` (= Ubuntu 24.04) and installs
  `libwebkit2gtk-4.1-dev` (= **2.52.6**) → the AppImage bundles 2.52.6 → blank
  on affected machines.
- **deb / rpm** use the **system** WebKitGTK (2.52.6) → blank on affected
  machines.
- On healthy machines (Arch, Mint, older Zorin) the same artifacts work.

## Fixes

### Fix A — Downgrade WebKitGTK on the affected machine (reversible)

```bash
sudo apt-get install -y --allow-downgrades \
  libwebkit2gtk-4.1-0=2.44.0-2 \
  libjavascriptcoregtk-4.1-0=2.44.0-2 \
  libwebkit2gtk-4.1-dev=2.44.0-2 \
  gir1.2-webkit2-4.1=2.44.0-2 \
  gir1.2-javascriptcoregtk-4.1=2.44.0-2

# Prevent apt from upgrading back to 2.52.6
sudo apt-mark hold libwebkit2gtk-4.1-0 libjavascriptcoregtk-4.1-0 \
  libwebkit2gtk-4.1-dev gir1.2-webkit2-4.1 gir1.2-javascriptcoregtk-4.1
```

Rollback:

```bash
sudo apt-mark unhold libwebkit2gtk-4.1-0 libjavascriptcoregtk-4.1-0 \
  libwebkit2gtk-4.1-dev gir1.2-webkit2-4.1 gir1.2-javascriptcoregtk-4.1
sudo apt-get install -y --allow-downgrades \
  libwebkit2gtk-4.1-0=2.52.6-0ubuntu0.24.04.1 \
  libjavascriptcoregtk-4.1-0=2.52.6-0ubuntu0.24.04.1
```

### Fix B — Bundle a working WebKitGTK in the AppImage (distribution)

The AppImage bundles its own WebKitGTK. If it bundles **2.44.0**, it renders
correctly even on affected machines. Two options:

1. Build the Linux artifacts on a runner with WebKitGTK 2.44
   (e.g. `ubuntu-22.04`), **or**
2. On `ubuntu-24.04`, pin WebKitGTK to 2.44 right after installing dependencies
   and **before** `tauri build`, so the bundler copies 2.44:

```yaml
      - name: Pin WebKitGTK 2.44 (AppImage)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get install -y --allow-downgrades \
            libwebkit2gtk-4.1-0=2.44.0-2 \
            libjavascriptcoregtk-4.1-0=2.44.0-2 \
            libwebkit2gtk-4.1-dev=2.44.0-2 \
            gir1.2-webkit2-4.1=2.44.0-2 \
            gir1.2-javascriptcoregtk-4.1=2.44.0-2
```

> Note: `deb` / `rpm` still use the host WebKitGTK, so affected machines need
> Fix A (or a Flatpak runtime that ships a working WebKitGTK).

### Fix C — Wait for upstream

WebKitGTK 2.52.6 is the broken version here. A later release (2.52.7+ / 2.54)
should fix it. Report to Zorin / Ubuntu with the evidence above.

## References

- `tauri-apps/tauri#15936` — Blank window until `WEBKIT_DISABLE_COMPOSITING_MODE=1`
- `tauri-apps/tauri#9304` — app window fails under Linux with NVIDIA GPU
- `tauri-apps/wry#1827` — hint at compositing env vars when software rendering is detected
- `block/buzz#6339` — blank window, WebKitWebProcess SIGABRT on webkit2gtk 2.52
- `Psysonic/psysonic#1347` — blank window, bundled WebKit aborts with `EGL_BAD_PARAMETER`
- `spieglt/FlyingCarpet#145` — AppImage blank window on Fedora KDE
- `aayushch/laya#17` — blank window, `EGL_BAD_PARAMETER` (Mesa 26 / Intel Arc)

## Verification commands used

```bash
# Is the system WebKitGTK broken? (should render; blank = broken)
GDK_BACKEND=x11 yelp
/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser about:blank

# Which WebKitGTK version is bundled in the AppImage?
APP="tauri-app/src-tauri/target/release/bundle/appimage/EPUB Shelf.AppDir/usr/lib"
readlink -f "$APP/libwebkit2gtk-4.1.so.0"
```
