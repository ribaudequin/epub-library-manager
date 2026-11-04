# Japanese (JP) Language Support

* **Author:** Marcelo Salvador
* **Date:** 2026-11-03

## Overview

Add Japanese (JP) language support to EPUBShelf via system-locale auto-detection only. The feature bundles a self-hosted Noto Sans JP subset for offline CJK rendering, provides machine-translated placeholders for all ~75 translation keys, creates a `ja.json` locale file while fixing existing `en.json`/`pt.json` drift, implements standard `ja-JP` date/number formatting, makes the HTML `lang` attribute dynamic, adds CSS `word-break: keep-all` and `@font-face` for the bundled font, and updates the main/renderer locale detection and formatting logic. Testing uses Playwright with locale override.

Target: Japanese users on Japanese-configured systems. No manual language selector.

## Analysis

### Design & UX (egm-design)
**Blockers:**
1. **Auto-detect-only is unusable for bilingual/expats** — Japanese users on English-OS machines get English UI with no override. Electron's `app.getLocale()` returns the *app's* locale (set via `--lang`), not necessarily OS locale. A hidden dev-menu toggle or `localStorage` override is needed at minimum.
2. **Machine-translation placeholders will ship broken UX** — 75 keys × 3 locales = 225 strings. Japanese grammar (honorifics, counters) cannot be handled by simple interpolation. The `t()` function assumes same word order as PT/EN (`date_ago: "{count} {unit} ago"`), but Japanese requires `"{count}{unit}前"`. No i18n validation exists in CI.
3. **No CJK font stack = broken glyphs** — Space Grotesk and JetBrains Mono have zero CJK coverage. System fallbacks (Meiryo/Yu Gothic on Windows, Hiragino on macOS, Noto CJK on Linux) produce inconsistent weight/baseline. Self-hosted Noto Sans JP subset needs `@font-face` with `font-display: swap` and proper font stack: `'Space Grotesk', 'Noto Sans JP', 'Noto Sans CJK JP', system-ui, sans-serif`.

**Major:**
4. **Japanese text density breaks card grid & progress bars** — Card titles (`white-space: nowrap`), volume names, progress labels (`"100%" → "100％"`), and status buttons (`"未読"` vs `"Unread"`) will clip or shrink touch targets below 44px. Requires `overflow-wrap: anywhere`, `:lang(ja)` font-size adjustments, and layout testing at 320/768/1200px.
5. **`word-break: keep-all` + CSS Grid conflict** — Long unbroken Japanese strings prevent column compression below content width, breaking `auto-fill` density and causing horizontal overflow. Use `overflow-wrap: anywhere` on headings instead.
6. **Date formatting hardcoded to binary ternary** — `localeTag = currentLang === 'pt' ? 'pt-PT' : 'en-GB'` needs a lookup map for `ja-JP`. `toLocaleDateString('ja-JP')` may use Japanese calendar era (Reiwa) unless `calendar: 'gregory'` is forced.
7. **HTML `lang` attribute static** — Screen readers announce JP content as English. Must set `document.documentElement.lang` in `initI18n()` and add `:lang(ja)` CSS selectors.
8. **Accessibility gaps** — Static `aria-label`/`placeholder`/`title` in HTML (search, theme toggle, about links) not translated. Dynamic ones in renderer use `t()` correctly. Focus ring contrast with JP text colors unverified.

### Codebase Details (egm-codebase-details)
**Required file changes:**
| File | Lines | Change |
|------|-------|--------|
| `src/renderer/translations.js` | 1-154, 169 | Add `ja` object (76 keys), fix fallback chain to `ja → en → pt` |
| `src/renderer/locales/en.json` | 1-72 | **Add 10 missing keys** (sync with translations.js) |
| `src/renderer/locales/pt.json` | 1-72 | **Add 10 missing keys** (sync with translations.js) |
| `src/renderer/locales/ja.json` | NEW | Create with 76 keys |
| `src/main.js` | 231-234 | Add `isJa: locale.startsWith('ja')` to `app:getLocale` return |
| `src/renderer/renderer.js` | 17-26, 89-98 | `initI18n()` handle `isJa`; `formatRelativeDate()` add `ja-JP` branch |
| `src/renderer/index.html` | 2 | Remove hardcoded `lang="en"` |
| `src/renderer/styles.css` | ~76 | Add `@font-face` for Noto Sans JP; `[lang="ja"] { word-break: keep-all; font-family: 'Noto Sans JP', ... }` |
| `src/renderer/renderer.js` | 688, 694, 1140 | Move 4 hardcoded PT strings (excerpt, favorite button) to translations.js |
| `src/main.js` | 104 | Dialog title hardcoded PT — move to translations or accept PT-only |

**Critical finding:** `locales/en.json` and `locales/pt.json` are **dead code** — not imported, not loaded, missing 10 keys vs `translations.js`. The feature concept assumes they exist and need "fixing," but they don't exist in the current repo state.

### Strategic Fit (egm-zoom-out)
**Why this feature likely shouldn't exist:**
1. **Zero evidence of demand** — No telemetry, no issues, no community requests for Japanese. YAGNI violation.
2. **Two sources of truth already broken** — `translations.js` (75 keys) ≠ `locales/*.json` (72 keys). Adding a third (`ja.json`) compounds debt. Fix duplication first.
3. **Auto-detect-only is user-hostile** — Japanese users on non-JP systems get nothing. Portuguese users already have `pt-BR` vs `pt-PT` ambiguity.
4. **Bundling Noto Sans JP subset is premature** — 200-500KB for 0% current users. System fonts exist on all platforms. CSS fallback handles this free.
5. **Machine translations = permanent technical debt** — 75 strings a Japanese speaker will flag as wrong. "Fix later" never happens (see incomplete pt.json/en.json).
6. **Custom i18n vs standard libraries** — `i18next`/`formatjs` handle plurals, ICU messages, lazy loading. Custom `t()` doesn't handle plurals correctly (`unit_day`/`unit_days` duplication).
7. **CJK scope creep cascade** — Japanese → Korean → Chinese (Simplified/Traditional). Each adds font, translations, line-breaking rules, vertical text. No end in sight.
8. **Date/number formatting already fragile** — Hardcoded binary choice; adding `ja-JP` requires touching logic again.

**Pragmatic alternative:** Fix i18n architecture first (single source of truth, dynamic loading, ICU plurals, locale registry, manual selector in Settings). Then add `ja.json` in 10 minutes when a real user appears.

### Comprehension & Clarity (egm-comprehension)
**Three architectural ambiguities blocking implementation:**
1. **Which translation store wins?** `translations.js` (runtime) vs `locales/*.json` (dead). No sync mechanism exists. "Synced JSON" is meaningless without declaring the single source of truth.
2. **No documented process for adding a language** — A developer adding French would need to touch 8+ files across main/renderer/CSS/build with no checklist. The concept assumes the implementer knows the full surface.
3. **Font subsetting build story missing** — No bundler (vite/webpack). How does `pyftsubset` run? Where does output live? How is it referenced in CSS? The concept says "self-hosted" but the toolchain gap is unaddressed.

**Additional confusion points:**
- Fallback chain is Portuguese-only (`ja → pt → key`) — should it be `ja → en → pt`?
- Binary locale detection in main (`isPt` boolean) not extensible — needs canonical locale code return.
- Machine translation process undefined — what tool, API, review markers, repeatability?
- Playwright locale override vs Electron runtime behavior — does `--lang=ja` propagate to `app.getLocale()` reliably in CI?
- Japanese calendar era risk — `toLocaleDateString('ja-JP')` may render Reiwa era years unless `calendar: 'gregory'` passed.
- No user override for auto-detection — no escape hatch for misconfigured systems.

### Implementation Readiness (egm-implementation-readiness)
**Feasible but not trivial. ~3.5 engineering days.**

**Blockers:**
1. `locales/` folder doesn't exist — "fix en.json/pt.json" is net-new creation, not a fix.
2. Noto Sans JP subset generation — requires `pyftsubset`/`glyphhanger`, ~3,000 glyphs (Jōyō + kana + punctuation), ~150-300KB WOFF2.
3. Machine translation of 76 keys — needs script + API (DeepL free tier), native review before shipping.
4. Layout breakage risk — CJK text 30-50% shorter/longer; fixed-width containers (`.bar-label min-width: 100px`, `#detail-excerpt width: 380px`) may clip.

**Sequencing:**
1. Sync step (separate PR): Create `src/renderer/locales/{en,pt}.json` from `translations.js`, add build sync script.
2. Font step: Generate subset, add to `src/renderer/fonts/`, update `styles.css` with `@font-face` and `word-break: keep-all`.
3. Locale step: Add `ja.json`, update `translations.js`, `main.js`, `renderer.js` detection/formatting, dynamic `lang`.
4. Test step: Playwright config + CI font install + snapshot tests.

**CI/CD:** Font asset (~200KB) auto-bundled via `files: ["src/**/*"]`. Playwright CI needs `language-pack-ja` + `fonts-noto-cjk` in Dockerfile.

### Structural / Architecture (egm-structural)
**Three structural blockers that multiply debt per language:**
1. **Dual translation source** — `translations.js` (runtime, complete) vs `locales/*.json` (dead, incomplete). Three artifacts to sync for Japanese. Pick one source of truth.
2. **Hardcoded binary locale logic in `main.js`** — `isPt: locale.startsWith('pt')` returned as boolean. Cannot scale to N languages. Renderer maps boolean → `'pt' | 'en'`. Every new language touches both processes.
3. **Google Fonts dependency + no CJK coverage** — External CDN violates offline-first/privacy. Space Grotesk/JetBrains Mono lack CJK. Must self-host all fonts via `@font-face`.

**Other structural risks:**
- Hardcoded `html lang="en"` — WCAG 3.1.1 failure for JP.
- `word-break: keep-all` globally breaks Latin wrapping — scope to `:lang(ja)`.
- Machine translations need metadata (`_meta: { source: 'machine', reviewed: false }`) for auditability.
- Current pattern is O(n) maintenance per language — should be O(1) via locale registry (supported codes, fallback chain, format tags, font mappings).

**Migration priority:**
1. Locale registry in `translations.js` (single source of truth for locale metadata)
2. Refactor `main.js` to return canonical locale code + supported check
3. Self-host all fonts; remove Google Fonts
4. Dynamic `html lang` in `initI18n()`
5. Add `ja` with `_meta` tracking
6. Scope `word-break` to `:lang(ja)`
7. Deprecate `locales/*.json`
8. Playwright test matrix for `ja`, `ko`, `zh`
9. Consider `Intl.RelativeTimeFormat` for relative dates

## Goals vs. Non-Goals

### In-Scope Goals
- Add Japanese locale detection via `main.js` (`ja` prefix)
- Add `ja` translation object to `translations.js` (76 keys, machine placeholders)
- Create `src/renderer/locales/ja.json` mirroring `translations.js` `ja` object
- Sync `en.json`/`pt.json` to match `translations.js` (add 10 missing keys)
- Bundle Noto Sans JP subset (Jōyō + kana + punctuation) via `@font-face`
- Dynamic `html lang` attribute based on current locale
- `ja-JP` date formatting with `calendar: 'gregory'`
- `word-break: keep-all` scoped to `:lang(ja)`
- Playwright test with `locale: 'ja-JP'` override

### Out-of-Scope Non-Goals
- Manual language selector UI (Settings dropdown)
- Human-reviewed Japanese translations (machine placeholders only)
- Korean/Chinese/other CJK languages
- ICU MessageFormat / pluralization refactor
- Migration to JSON-as-source-of-truth
- Right-to-left (RTL) language support
- Vertical text layout

## Alternatives Weighed

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **i18next / formatjs library** | Adds dependency; current `TRANSLATIONS` object works for 75 keys. Revisit when >5 languages. |
| **Google Fonts Noto Sans JP (CDN)** | Violates offline-first; privacy leak; no guarantee of font availability in air-gapped environments. |
| **Manual language selector in header** | Scope creep; no user demand; auto-detect serves primary use case (native JP users). |
| **Human translations before ship** | Blocks delivery; machine placeholders allow layout validation now, native review can follow. |
| **JSON files as source of truth** | Requires runtime loader, build step, or dynamic import — adds complexity for marginal benefit at current scale. |
| **Full glyph coverage (Jōyō + Jinmeiyō)** | +863 name kanji = ~30KB extra. Defer to v2 if name-heavy content appears. |
| **`Intl.RelativeTimeFormat` for dates** | Increases bundle size; current custom logic works for 3 locales. Revisit when plural complexity grows. |

## Key Decisions & Staging for Next Steps

1. **Single source of truth = `translations.js`** — JSON files are generated artifacts (or deprecated). Do not maintain both by hand.
2. **Fallback chain = `ja → en → pt`** — English is better intermediary than Portuguese for missing JP keys.
3. **Font strategy = Self-hosted Noto Sans JP subset (Jōyō only) + system fallback** — No Google Fonts. `@font-face` in `styles.css` with `font-display: swap`.
4. **Locale detection = Canonical code from main (`'ja'`) → renderer maps via registry** — Replace binary `isPt` with `supportedLocales = ['pt', 'en', 'ja']` and `fallbackChain = { ja: ['en', 'pt'], ... }`.
5. **Staging: Two PRs** — (1) Locale infrastructure + font + sync script, (2) JP translations + detection + tests. Isolates risk.
6. **Validation gate: Layout smoke test** — Before merge, verify all modals, grids, tooltips, badges at 320/768/1200px with JP content. No tofu glyphs, no clipped text, touch targets ≥44px.
7. **CI gate: Playwright `ja-JP` + font install** — Add `language-pack-ja` `fonts-noto-cjk` to CI image.

## Open Questions for Author

1. **Translation quality bar:** Ship machine placeholders as-is, or gate behind native review? (Affects whether `ja.json` lands in same PR or follow-up.)
2. **Glyph coverage:** Jōyō (2,136) only, or include Jinmeiyō (863) for names? (+30KB)
3. **Staging confirmation:** Two PRs (infrastructure → translations) or single PR?
4. **Locale override for testing:** Add `localStorage` debug flag (`i18n_override=ja`) for manual dev testing, or Playwright-only?