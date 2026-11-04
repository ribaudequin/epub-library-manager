# I18n Status Report — Supported Languages

**Project:** EPUBShelf
**Date:** 2026-11-03
**Scope:** Current state of language/translation support in the codebase

---

## Supported Languages

| Language | Code | Runtime Source | JSON File | Status |
|----------|------|----------------|-----------|--------|
| Portuguese (PT-PT) | `pt` | `translations.js` | `locales/pt.json` | Supported (auto-detect) |
| English (EN-GB) | `en` | `translations.js` | `locales/en.json` | Supported (auto-detect fallback) |

**Total: 2 languages.** No Japanese, Korean, Chinese, or any other language is implemented.

---

## Translation Source of Truth

### Runtime: `src/renderer/translations.js`

The `TRANSLATIONS` object holds both locales inline:

| Locale | Key Count | Lines |
|--------|-----------|-------|
| `pt` | ~78 | 2–78 |
| `en` | ~76 | 80–154 |

**Fallback chain (hardcoded):**
```javascript
TRANSLATIONS[currentLocale][key] || TRANSLATIONS.pt[key] || key
```
If a key is missing in the current locale, it falls back to **Portuguese**, not English.

### Locale JSON files: `src/renderer/locales/`

| File | Key Count | Used at runtime? |
|------|-----------|------------------|
| `en.json` | 71 | **No** (dead code) |
| `pt.json` | 71 | **No** (dead code) |

These JSON files exist but are **not imported or loaded anywhere** in the renderer or main process. They are already out of sync with `translations.js` — missing 6 keys:

- `btn_favorite`
- `btn_unfavorite`
- `filter_favorites`
- `crypto_support_title`
- `crypto_eth`
- `crypto_sol`

---

## Locale Detection Logic

### Main process: `src/main.js:231-234`

```javascript
ipcMain.handle('app:getLocale', () => {
  const locale = app.getLocale();
  return { locale, isPt: locale.startsWith('pt') };
});
```

- Uses Electron's `app.getLocale()` (app locale, not necessarily OS locale)
- Binary check: only distinguishes Portuguese vs. everything-else
- No support for `ja`, `ko`, `zh`, or any other language code
- Returns a boolean `isPt`, not a canonical locale code

### Renderer: `src/renderer/renderer.js:89-98`

```javascript
async function initI18n() {
  try {
    const { locale, isPt } = await window.api.getLocale();
    window.i18n.setLocale(isPt ? 'pt' : 'en');
  } catch {
    window.i18n.setLocale('pt');
  }
  ...
}
```

- Maps boolean `isPt` → `'pt'` or `'en'`
- Defaults to `'pt'` on error
- No third (or Nth) locale branch possible without changing both files

---

## Date / Number Formatting

`src/renderer/renderer.js:25-26`:

```javascript
const localeTag = currentLang === 'pt' ? 'pt-PT' : 'en-GB';
```

- Hardcoded binary ternary
- Adding any third language requires editing this line
- No `calendar: 'gregory'` override — `toLocaleDateString('ja-JP')` could render Japanese era years (Reiwa) if a third locale were added

---

## HTML `lang` Attribute

`src/renderer/index.html:2`:

```html
<html lang="en">
```

- **Hardcoded to English**, never updated at runtime
- Screen readers announce all content as English even when UI is Portuguese
- `:lang(ja)` / `:lang(pt)` CSS pseudo-classes cannot match
- No code exists to set `document.documentElement.lang` dynamically

---

## Hardcoded Strings Outside `translations.js`

These strings bypass i18n entirely and will never be translated:

| File | Line | String | Language |
|------|------|--------|----------|
| `src/main.js` | 104 | `'Selecionar pasta raiz da biblioteca'` | PT only |
| `src/renderer/renderer.js` | 674 | `'A extrair…'` | PT only |
| `src/renderer/renderer.js` | 694 | `'★ Remover'` / `'★ Favorito'` | PT only |
| `src/renderer/renderer.js` | 1140 | `'★ Remover'` / `'★ Favorito'` | PT only |

---

## Fonts & CJK Support

- Fonts loaded from **Google Fonts CDN** (`index.html:8-10`): JetBrains Mono + Space Grotesk
- **Neither font has CJK coverage** — Japanese/Korean/Chinese text renders as tofu (□) via system fallback
- No self-hosted fonts, no `@font-face` for CJK, no `font-display` strategy
- External CDN violates offline-first principle and leaks user IP on launch

---

## Language Selector UI

**None exists.** Auto-detection only:
- No Settings dropdown
- No header button
- No `localStorage` override
- No dev-menu toggle
- A Japanese user on an English-OS machine gets English UI with no escape hatch

---

## Testing & Validation

- `npm test` → `test/validate-modules.js` — checks forbidden modules only, **no i18n validation**
- `node test/lint.js` — checks forbidden modules (`xml2js`), **no i18n validation**
- No Playwright test specs exist for locale override
- No key-parity check between `translations.js` and `locales/*.json`
- No missing-key detection in CI

---

## Architecture Problems (Why Adding a 3rd Language Is Currently Hard)

1. **Dual translation sources** — `translations.js` (runtime, complete) vs `locales/*.json` (dead, incomplete). Adding a 3rd locale means maintaining 3 drifting artifacts with no sync mechanism.
2. **Binary locale logic** — `main.js` returns `isPt` boolean; renderer maps boolean → `'pt' | 'en'`. Cannot scale to N languages without refactoring both processes.
3. **Hardcoded date ternary** — `pt-PT | en-GB` only.
4. **Static `html lang`** — no runtime update mechanism.
5. **Portuguese-only fallback** — missing keys fall back to PT, not EN.
6. **No locale registry** — no single place listing supported codes, fallback chains, format tags, or font mappings.

---

## Summary

- **Languages supported:** 2 (Portuguese PT-PT, English EN-GB)
- **Auto-detection:** Yes, but binary (PT vs non-PT)
- **Manual selector:** No
- **JSON locale files:** Exist but are dead code, out of sync
- **Hardcoded strings:** 4 locations bypass i18n (all Portuguese-only)
- **CJK font support:** None
- **i18n testing:** None
- **Ready for a 3rd language:** No — requires architectural refactor first
