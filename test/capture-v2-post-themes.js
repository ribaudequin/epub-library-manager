/**
 * Capture the v2.0.0 volume cover preview in BOTH themes, for the design-variant
 * post images.
 *
 * The dark capture already existed; the paper-background variants
 * (editorial-minimal, brutalist-industrial, retro-print) need the app in its
 * light theme, or a screenshot of a near-black UI dropped onto warm paper reads
 * as a foreign object pasted on.
 *
 *   cd /home/marcelo/Documentos/opencode/biblioteca
 *   node test/capture-v2-post-themes.js [outDir]
 *
 * Writes <outDir>/preview-<theme>.png. Never writes to /tmp.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, '..', 'test', 'test-library');
const OUT_DIR = process.argv[2] ||
  '/home/marcelo/Hermes/Bandua Studio/mockups/epub-shelf-v2-post/raw';

const PREVIEW_SETTLE = 900;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // A FIXED path, deliberately reused: the scan cache lives here, so a later
  // capture loads in under a second instead of re-scanning — and the reading
  // progress marked by test/populate-v2-post-state.js is already in it.
  // A throwaway mkdtemp dir would discard both.
  const userDataDir = process.env.TEST_USERDATA || '/tmp/epubshelf-v2-post-ud';
  fs.mkdirSync(userDataDir, { recursive: true });
  // All three locale variables: Electron's app.getLocale() does not follow LANG
  // alone, and a locale that is not installed is silently ignored. en_GB is
  // installed here; en_US.UTF-8 is not on this box.
  const env = {
    ...process.env,
    TEST_USERDATA: userDataDir,
    TEST_ROOT: TEST_LIBRARY,
    LANG: 'en_GB.UTF-8',
    LC_ALL: 'en_GB.UTF-8',
    LANGUAGE: 'en_GB',
  };

  const app = await electron.launch({ args: [MAIN_JS], env });
  const report = {};
  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w && !w.isDestroyed()) w.setContentSize(1440, 900);
    });

    const loc = await app.evaluate(({ app }) => app.getLocale());
    console.log(`  app.getLocale() = ${loc}`);
    if (!String(loc).startsWith('en')) throw new Error(`locale is ${loc}, not English`);

    await window.waitForSelector('#series-grid .series-card', { timeout: 120000 });
    await sleep(3000);

    // Open the series with the most volumes.
    const opened = await window.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#series-grid .series-card'));
      let best = null;
      for (const card of cards) {
        const text = Array.from(card.querySelectorAll('.series-info p'))
          .map((p) => p.textContent || '')
          .find((t) => /\d+\s*volume/i.test(t));
        const n = Number((text || '').match(/(\d+)/)?.[1] || 0);
        if (!best || n > best.n) best = { card, n };
      }
      if (!best || best.n === 0) return 0;
      best.card.click();
      return best.n;
    });
    console.log(`  series opened with ${opened} volumes`);
    await window.waitForSelector('#series-detail:not(.hidden)');
    await window.waitForSelector('#volume-list .volume-cover');
    await sleep(2500);

    for (const theme of ['dark', 'light']) {
      // applyTheme() is a global in renderer.js (loaded via <script src>), so it
      // is reachable from evaluate. It also persists to localStorage.
      await window.evaluate((t) => {
        if (typeof applyTheme === 'function') applyTheme(t);
        else document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await sleep(700);

      const applied = await window.evaluate(() =>
        document.documentElement.getAttribute('data-theme'));
      if (applied !== theme) throw new Error(`theme is ${applied}, wanted ${theme}`);

      // Park the pointer away first so no row carries a stale :hover.
      await window.mouse.move(5, 5);
      await sleep(300);

      const target = await window.evaluate(async () => {
        // Filter on src OR data-src: coverObserver removes data-src once a
        // thumbnail lazy-loads, so after the theme switch rebuilds the list a
        // loaded cover has none and a data-src-only filter comes back empty.
        const covers = Array.from(document.querySelectorAll('#volume-list .volume-cover'))
          .filter((c) => c.tagName === 'IMG'
            && (c.getAttribute('src') || c.dataset.src)
            && !c.classList.contains('placeholder'));
        if (!covers.length) return null;
        const pick = covers[Math.floor(covers.length / 2)];
        pick.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 600));
        const r = pick.getBoundingClientRect();
        return {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
          viewport: { w: window.innerWidth, h: window.innerHeight },
        };
      });
      if (!target) throw new Error('no covers');
      if (!target.inViewport) {
        throw new Error(`cover off-screen at y=${target.y} in ${target.viewport.h}px`);
      }

      await window.mouse.move(target.x, target.y);
      await sleep(PREVIEW_SETTLE);

      const state = await window.evaluate(() => {
        const el = document.querySelector('.volume-preview');
        if (!el || !el.classList.contains('visible')) return { visible: false };
        const img = el.querySelector('img');
        const r = el.getBoundingClientRect();
        return {
          visible: true,
          loaded: !!(img && img.complete && img.naturalWidth > 0),
          w: Math.round(r.width), h: Math.round(r.height),
          natural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
        };
      });
      if (!state.visible || !state.loaded) {
        throw new Error(`${theme}: preview not open/loaded — ${JSON.stringify(state)}`);
      }

      const ui = await window.evaluate(() => ({
        search: (document.querySelector('#search-input') || {}).placeholder,
        statusButtons: Array.from(document.querySelectorAll('#volume-list .volume-row'))
          .slice(0, 1)
          .flatMap((r) => Array.from(r.querySelectorAll('button')).map((b) => b.textContent.trim())),
        bodyHasPt: /Lido|Não lido|Pendente|Voltar|Selecionar pasta/i.test(document.body.innerText),
      }));
      if (ui.bodyHasPt) throw new Error(`${theme}: UI is in Portuguese`);

      const out = path.join(OUT_DIR, `preview-${theme}.png`);
      await window.screenshot({ path: out });
      report[theme] = { state, ui, out };
      console.log(`  ${theme}: preview ${state.w}x${state.h} from natural `
        + `${state.natural.w}x${state.natural.h}; wrote ${out}`);
    }

    fs.writeFileSync(path.join(OUT_DIR, 'capture-themes.json'),
      JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
