# AppImage publication — packaging report

**App:** EPUBShelf
**Repository:** `ribaudequin/epub-library-manager`
**Goal:** publish the AppImage on **AppImageHub** (`appimage.github.io`), then on **Pling / OpenDesktop**
**Report date:** 2026-11-10
**Scope:** packaging only. No application-code changes are required.

---

## 1. Current state (verified 2026-11-10)

| Item | Value |
|---|---|
| Builder | electron-builder 24.13.3 (`package.json` → `build`) |
| Electron | `^31.0.0` |
| AppImage | `dist/EPUBShelf-2.2.2.AppImage` |
| License | MIT |
| Network calls | none — verified: no `fetch`, `axios`, `WebSocket` or `http(s)` anywhere in `src/` |

### What already passes

- `appdir-lint.sh` — **passes**. The only output is the `No appdata file present` warning.
- `.DirIcon` — present (symlink to `usr/share/icons/hicolor/0x0/apps/epub-shelf.png`).
- Exactly one `.desktop` file at the AppDir root.
- `desktop-file-validate` — passes (one hint, see §2.5).
- The AppStream metainfo **in the repository** is valid — `appstreamcli validate` succeeds.

---

## 2. Blocking problems

### 2.1 No AppStream metainfo inside the AppImage

`usr/share/` in the built AppImage contains **only `icons/`**. There is no
`usr/share/metainfo/`. The repository carries a valid
`io.github.ribaudequin.epub-library-manager.metainfo.xml`, but electron-builder
does not include it in the AppImage.

**Why it matters:** AppImageHub warns about it; software centres and the Pling
store read the description, screenshots and release notes from this file. Without
it the app is listed with no metadata at all.

### 2.2 The desktop file ID does not match the metainfo

| | AppImage (generated) | Repository (canonical) |
|---|---|---|
| File name | `epub-shelf.desktop` | `io.github.ribaudequin.epub-library-manager.desktop` |
| `Icon=` | `epub-shelf` | `io.github.ribaudequin.epub-library-manager` |
| `Categories=` | `Office;` | `Office;Utility;` |

The metainfo's `<launchable type="desktop-id">` points to
`io.github.ribaudequin.epub-library-manager.desktop`, which is **not** the file
electron-builder generates. The two disagree, so a store cannot link the desktop
entry to the metainfo and the icon will not resolve.

### 2.3 The desktop file is not in `usr/share/applications/`

It sits at the AppDir root. `appdir-lint.sh` accepts that (root is the AppImage
convention), but the canonical location is `usr/share/applications/`.

### 2.4 The metainfo icon is a remote URL

```xml
<icon type="remote">https://raw.githubusercontent.com/ribaudequin/epub-library-manager/master/build/icon-128.png</icon>
```

AppStream prefers a **cached** icon bundled under `usr/share/icons/hicolor/`. A
remote icon needs the network and renders blank in offline software centres.

### 2.5 `Categories` has more than one main category

`Office;Utility;` triggers a `desktop-file-validate` hint. Cosmetic, but the app
can then appear twice in the application menu.

### 2.6 No update metadata

No `.zsync` file and no `publish` configuration. AppImageUpdate cannot work.
Optional for AppImageHub, recommended for Pling — whose update transport is
`pling-v1-zsync`.

### 2.7 AppImage file name

`EPUBShelf-2.2.2.AppImage`. The AppImage specification recommends
`<name>-<version>-stable-<arch>.AppImage` for the Pling update transport.
Not a blocker for AppImageHub.

---

## 3. Recommendations (in order)

### R1 — Align the desktop file with the metainfo *(blocking)*

Add a `desktop` block to `build.linux` in `package.json`:

```json
"linux": {
  "target": ["AppImage", "dir", "deb"],
  "category": "Office",
  "icon": "build/icon.png",
  "desktop": {
    "Name": "EPUBShelf",
    "Comment": "EPUB library manager organized by series",
    "Icon": "io.github.ribaudequin.epub-library-manager",
    "Categories": "Office;",
    "MimeType": "application/epub+zip;",
    "StartupWMClass": "EPUBShelf"
  }
}
```

Then make the desktop file **name** match the canonical ID. electron-builder
names it after `executableName`; either set `linux.executableName` to
`io.github.ribaudequin.epub-library-manager` or rename the file in an
`afterPack` hook. Confirm which approach this builder version supports and use
that one.

### R2 — Ship the metainfo and the desktop file inside the AppImage *(blocking)*

Use `build.linux.extraFiles` to place both at their canonical paths:

```json
"extraFiles": [
  {
    "from": "io.github.ribaudequin.epub-library-manager.metainfo.xml",
    "to": "usr/share/metainfo"
  },
  {
    "from": "io.github.ribaudequin.epub-library-manager.desktop",
    "to": "usr/share/applications"
  }
]
```

Copy the icon set to
`usr/share/icons/hicolor/<size>x<size>/apps/io.github.ribaudequin.epub-library-manager.png`
for every size `build/` already produces (`icon-16/20/24/32/48/64/128/256/512.png`).

If `extraFiles` does not land the files in the AppDir in this builder version,
use an `afterPack` hook that copies them into the packaged directory before the
AppImage target runs.

**Verify after the build:** extract the AppImage and confirm `usr/share/metainfo/`,
`usr/share/applications/` and the icons are present.

### R3 — Use a cached icon in the metainfo

Replace `<icon type="remote">` with `<icon type="cached">`, and make sure the
matching PNG is at
`usr/share/icons/hicolor/<size>x<size>/apps/io.github.ribaudequin.epub-library-manager.png`.

### R4 — Fix the Categories

Use a single main category: `Office;`. `Utility` is an additional category, not a
main one — keep it out of the main slot.

### R5 — Add update metadata *(optional now, required for Pling)*

Generate a `.zsync` per release (e.g. `zsyncmake`) and publish it next to the
AppImage, or configure `linux.publish` so electron-builder emits its update
files. Needed for AppImageUpdate and for the Pling `pling-v1-zsync` transport.

### R6 — Rename the artifact

Set the Linux `artifactName` to
`${productName}-${version}-stable-x86_64.AppImage`, matching the specification.

---

## 4. Verification checklist (run before submitting)

```bash
npm run dist

./dist/EPUBShelf-<version>.AppImage --appimage-extract
appdir-lint.sh squashfs-root                          # expect: no fatal issues
desktop-file-validate squashfs-root/*.desktop
appstreamcli validate-tree squashfs-root

ls squashfs-root/usr/share/metainfo/                  # must exist
ls squashfs-root/usr/share/applications/              # must exist
ls squashfs-root/usr/share/icons/hicolor/*/apps/     # must exist

grep -h "^Icon=" squashfs-root/*.desktop
grep "<launchable" squashfs-root/usr/share/metainfo/*.xml   # IDs must agree

rm -rf squashfs-root
```

All of the above must pass before the submission is opened.

---

## 5. Submission steps

### AppImageHub

1. Open <https://github.com/AppImage/AppImageHub/new/master/data> and add a file
   named after the app.
2. The file contains **one line**: the URL of this repository's Releases page —
   `https://github.com/ribaudequin/epub-library-manager/releases`.
3. Send the pull request. Travis CI downloads the AppImage, runs it and validates
   it automatically.
4. A **red** build means a check failed — read the Travis log and fix it.
5. A **green** build merges, and the app appears at `appimage.github.io`.

AppImageHub does not track versions: re-submit only when the metadata inside the
AppImage changes.

### Pling / OpenDesktop (after AppImageHub)

1. Create an account at `opendesktop.org`.
2. Register the product at `opendesktop.org/product/add` — one product per
   artifact type, entered by hand.
3. Upload the AppImage and fill in the description, screenshots and source link.
4. Put the Ko-fi and Patreon links in the description. Pling no longer pays
   creators, so those links are the only revenue path.

---

## 6. Notes

- The app makes no network calls, which satisfies the AppImageHub rule
  "must run without an active Internet connection".
- The main binary's highest GLIBC symbol is `GLIBC_2.25`; AppImageHub re-checks
  this against the oldest supported Ubuntu LTS automatically.
- The Flatpak manifest already installs the metainfo and the desktop file
  correctly. This report covers the **AppImage** path only.
- The license is MIT, which both AppImageHub and Pling accept.
