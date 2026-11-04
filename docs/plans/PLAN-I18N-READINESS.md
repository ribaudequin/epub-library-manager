# I18n Readiness Plan — Prepare for 3rd Language (Japanese)

**Project:** EPUBShelf  
**Date:** 2026-11-03  
**Status:** Draft  
**Scope:** Fix the i18n architecture so a 3rd language (Japanese) can be added as a configuration change, not a code refactor.  
**Language:** English (technical documentation per AGENTS.md)

---

## 1. Current State

Two languages are supported: Portuguese (`pt`) and English (`en`).

| Component | File | Problem |
|-----------|------|---------|
| Translation strings | `src/renderer/translations.js` | Runtime source of truth; 76 keys per locale |
| Locale JSON files | `src/renderer/locales/en.json`, `pt.json` | Dead code; not loaded; missing 6 keys vs `translations.js` |
| Locale detection | `src/main.js:231-234` | Binary `isPt: locale.startsWith('pt')`; returns boolean, not canonical code |
| Renderer init | `src/renderer/renderer.js:89-98` | `isPt ? 'pt' : 'en'`; cannot express a 3rd locale |
| Date formatting | `src/renderer/renderer.js:26` | Hardcoded ternary `pt-PT | en-GB` |
| HTML lang | `src/renderer/index.html:2` | Static `<html lang="en">`; never updated at runtime |
| Hardcoded strings | `main.js:104`, `renderer.js:674,694,1140` | Portuguese-only strings bypass i18n |
| Fonts | `index.html:8-10` | Google Fonts CDN; no CJK coverage |
| Testing | `npm test`, `lint.js` | No i18n validation, no key-parity check, no Playwright locale tests |

**Blocker for adding Japanese:** The architecture assumes exactly two languages. Every new language requires touching `main.js`, `renderer.js`, date formatting, and HTML lang with no central registry.

---

## 2. Goals

1. **Single source of truth** for translation strings — one canonical store, JSON files generated from it (or deprecated).
2. **Locale registry** — one place listing supported codes, fallback chains, date/number format tags, and font fallbacks.
3. **Extensible locale detection** — `main.js` returns a canonical locale code; renderer maps via registry, not booleans.
4. **Self-hosted fonts** — all fonts bundled via `@font-face`, including a Noto Sans JP subset for future CJK.
5. **Dynamic `html lang`** — set at runtime from resolved locale; WCAG 3.1.1 compliant.
6. **No hardcoded UI strings** — all user-facing text in the translation store.
7. **i18n validation in CI** — key parity, missing-key detection, placeholder syntax.
8. **Japanese addable as config** — after phases 1-5, adding `ja` requires only a translation file and registry entry, no code changes in `main.js`/`renderer.js`.

---

## 3. Non-Goals

- Shipping Japanese translations in this plan (that is a separate feature).
- Manual language selector UI (Settings dropdown).
- ICU MessageFormat / pluralization refactor (defer until >3 languages).
- Right-to-left language support.
- Migration to JSON-as-source-of-truth at runtime (keep `translations.js` module pattern).

---

## 4. Phase 1 — Single Source of Truth & Locale Registry (Days 1-2)

### 4.1 Make `translations.js` the canonical source

`translations.js` already holds the complete key set (~76 per locale). The JSON files are dead code.

**Decision:** `translations.js` is source of truth. JSON files are generated artifacts (or removed if unused).

**Actions:**
1. Add a `SUPPORTED_LOCALES` registry at the top of `translations.js`:
   ```javascript
   const SUPPORTED_LOCALES = {
     pt: { name: 'Portuguese', fallback: ['en'], dateTag: 'pt-PT' },
     en: { name: 'English', fallback: ['pt'], dateTag: 'en-GB' },
   };
   ```
2. Add a `resolveLocale(requested)` function that walks the fallback chain:
   ```javascript
   function resolveLocale(requested) {
     if (SUPPORTED_LOCALES[requested]) return requested;
     const chain = SUPPORTED_LOCALES[requested]?.fallback || [];
     for (const fb of chain) {
       if (SUPPORTED_LOCALES[fb]) return fb;
     }
     return 'pt'; // ultimate default
   }
   ```
3. Fix the fallback chain in `t()`: `current → en → pt` (English is a better intermediary than Portuguese).

### 4.2 Refactor `main.js` locale detection

Replace boolean `isPt` with canonical locale code.

**File:** `src/main.js:231-234`

```javascript
ipcMain.handle('app:getLocale', () => {
  const locale = app.getLocale();
  const code = locale.split('-')[0].toLowerCase(); // 'pt', 'en', 'ja', ...
  return { locale, code };
});
```

### 4.3 Refactor `renderer.js` init & date formatting

**File:** `src/renderer/renderer.js:89-98`

```javascript
async function initI18n() {
  try {
    const { code } = await window.api.getLocale();
    const resolved = resolveLocale(code);
    window.i18n.setLocale(resolved);
    document.documentElement.lang = resolved;
  } catch {
    window.i18n.setLocale('pt');
    document.documentElement.lang = 'pt';
  }
  updateUI();
  updateI18nLabels();
}
```

**File:** `src/renderer/renderer.js:25-26`

Replace ternary with registry lookup:
```javascript
const localeTag = SUPPORTED_LOCALES[currentLang]?.dateTag || 'en-GB';
const dateStr = date.toLocaleDateString(localeTag, {
  day: '2-digit', month: '2-digit', year: 'numeric',
  calendar: 'gregory',
});
```

### 4.4 Sync or deprecate JSON files

Option A (recommended): Delete `locales/en.json` and `locales/pt.json`. Add a build script `scripts/sync-locales.js` that regenerates them from `translations.js` if external tooling needs them.

Option B: Keep JSON files, add `npm run i18n:sync` to regenerate from `translations.js`.

---

## 5. Phase 2 — Self-Hosted Fonts & CJK Support (Days 2-3)

### 5.1 Bundle Noto Sans JP subset

**Tool:** `pyftsubset` (from `fonttools`) or `glyphhanger`.

**Glyph set:** Jōyō kanji (2,136) + hiragana + katakana + punctuation + ASCII (~3,000 glyphs).

**Output:** `src/renderer/fonts/NotoSansJP-Regular.woff2`, `Medium.woff2`, `Bold.woff2` (~150–300 KB total).

**Command (example):**
```bash
pyftsubset NotoSansJP-Regular.ttf \
  --text-file=src/renderer/fonts/japanese-glyphs.txt \
  --flavor=woff2 \
  --output-file=src/renderer/fonts/NotoSansJP-Regular.woff2
```

### 5.2 Update `styles.css`

Add `@font-face` rules and CJK font stack:
```css
@font-face {
  font-family: 'Noto Sans JP';
  src: url('./fonts/NotoSansJP-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

:root {
  --font-sans: 'Space Grotesk', 'Noto Sans JP', 'Noto Sans CJK JP', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Noto Sans Mono CJK JP', ui-monospace, monospace;
}

:lang(ja) {
  word-break: keep-all;
  font-family: var(--font-sans);
}
```

### 5.3 Remove Google Fonts CDN

Delete the `<link rel="preconnect">` and `<link href="fonts.googleapis.com...">` from `index.html`.

---

## 6. Phase 3 — Accessibility & Hardcoded Strings (Day 3)

### 6.1 Dynamic `html lang`

Already handled in Phase 1 (`document.documentElement.lang = resolved`).

### 6.2 Move hardcoded Portuguese strings to `translations.js`

| File | Line | String | Action |
|------|------|--------|--------|
| `src/main.js` | 104 | `'Selecionar pasta raiz da biblioteca'` | Move to translations (or keep PT-only if native dialog cannot be localized) |
| `src/renderer/renderer.js` | 674 | `'A extrair…'` | Add `excerpt_loading` key |
| `src/renderer/renderer.js` | 694, 1140 | `'★ Remover'` / `'★ Favorito'` | Add `btn_favorite` / `btn_unfavorite` keys (already exist in `translations.js` but unused here) |

### 6.3 Translate static HTML attributes

Move `aria-label`, `placeholder`, `title` from `index.html` to runtime translation in `updateUI()`:
- Search label, placeholder, aria-labels
- Theme toggle aria-labels
- About modal links

---

## 7. Phase 4 — i18n Validation & Testing (Day 4)

### 7.1 Add `npm run i18n:validate`

Script that:
- Checks key parity across all locales in `translations.js`
- Flags missing translations
- Validates placeholder syntax (`{count}`, `{pct}`, etc.)
- Marks machine-translated strings with `_meta.reviewed: false`

### 7.2 Add Playwright locale test

New test file `test/i18n.spec.js`:
- Launch Electron with `--lang=ja` or `LANG=ja_JP.UTF-8`
- Verify `app:getLocale` returns `code: 'ja'`
- Verify renderer sets `html lang="ja"`
- Verify no tofu glyphs (visual smoke test of key UI strings)

### 7.3 CI dependencies

Add to CI Dockerfile / GitHub Actions:
```
apt-get install -y language-pack-ja fonts-noto-cjk
```

---

## 8. Phase 5 — Add Japanese (Separate Feature, After Phases 1-4)

Once the foundation is in place, adding Japanese is:

1. Add `ja` to `SUPPORTED_LOCALES` in `translations.js`:
   ```javascript
   ja: { name: 'Japanese', fallback: ['en'], dateTag: 'ja-JP' }
   ```
2. Add `ja: { ... }` translation object (76 keys, machine or human translated).
3. No changes to `main.js`, `renderer.js`, date formatting, or CSS needed.

---

## 9. Rollback Plan

| Phase | Rollback |
|-------|----------|
| 1 (Registry) | Revert `translations.js`, `main.js`, `renderer.js` to binary logic |
| 2 (Fonts) | Revert `@font-face`, restore Google Fonts link |
| 3 (Accessibility) | Revert `html lang` to static `en`, restore hardcoded strings |
| 4 (Validation) | Remove `i18n:validate` script and Playwright test |

Rollback trigger: Japanese renders as tofu, layout breaks unacceptably in stats modal / volume list / about modal.

---

## 10. Effort Estimate

| Phase | Days | Notes |
|-------|------|-------|
| 1 — Registry + detection refactor | 2.0 | Touches `translations.js`, `main.js`, `renderer.js` |
| 2 — Self-hosted fonts + CJK | 1.0 | `pyftsubset` setup, CSS changes, remove CDN |
| 3 — Accessibility + hardcoded strings | 1.0 | Mechanical string extraction |
| 4 — Validation + Playwright | 1.0 | Script + test + CI deps |
| **Total** | **5.0** | Before Japanese can be added |

---

## 11. Open Questions for Author

1. **Delete JSON files or keep as generated artifacts?** (Recommendation: delete; add sync script if tooling needs them.)
2. **Noto Sans JP subset glyph coverage:** Jōyō only (~2,136 kanji) or include Jinmeiyō (+863 name kanji, +30 KB)?
3. **main.js dialog title:** Keep Portuguese-only for native file dialog, or attempt localization via Electron's `showOpenDialog` title?
4. **Staging:** One PR for all phases, or split into Phase 1-2 then Phase 3-4?

---

## Next Step

If you approve this plan, I will update `PLAN.md` with the decision log and create `TODO.md` items for Phase 1.
