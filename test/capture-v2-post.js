/**
 * Capture the v2.0.0 volume cover preview, for the post image.
 *
 * Hovering a 42x63 thumbnail floats the full-size cover above the list. That is
 * the whole feature, and it cannot be shown by a static screenshot of the app
 * at rest — so this drives the real app, parks the pointer on a cover, waits
 * for the 220 ms delay, and captures the window with the preview open.
 *
 * Written into the Bandua project (mockups/epub-shelf-v2-post/), never /tmp.
 *
 *   cd /home/marcelo/Documentos/opencode/biblioteca
 *   LANG=en_GB.UTF-8 node <this file> [outDir]
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, '..', 'test', 'test-library');
const OUT_DIR = process.argv[2] || '/home/marcelo/Hermes/Bandua Studio/mockups/epub-shelf-v2-post/raw';

// The preview show timer is 220 ms; give it margin plus the 140 ms animation.
const PREVIEW_SETTLE = 900;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // A FIXED path, deliberately reused: the scan cache lives here, so a later
  // capture loads in under a second — and the reading progress marked by
  // test/populate-v2-post-state.js is already in it.
  const userDataDir = process.env.TEST_USERDATA || '/tmp/epubshelf-v2-post-ud';
  fs.mkdirSync(userDataDir, { recursive: true });
  // All three variables: Electron's app.getLocale() does not follow LANG alone,
  // and a locale that is not installed is silently ignored. en_GB is installed
  // here; en_US.UTF-8 is not on this box.
  const env = {
    ...process.env,
    TEST_USERDATA: userDataDir,
    TEST_ROOT: TEST_LIBRARY,
    LANG: 'en_GB.UTF-8',
    LC_ALL: 'en_GB.UTF-8',
    LANGUAGE: 'en_GB',
  };

  const app = await electron.launch({ args: [MAIN_JS], env });
  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    // A 16:9 window: the default is 1200x776, which is an awkward shape for a
    // post image band.
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w && !w.isDestroyed()) w.setContentSize(1440, 900);
    });
    // Read the locale and a real UI string back out — the env var being set is
    // not evidence that the app took it.
    const loc = await app.evaluate(({ app }) => app.getLocale());
    console.log(`  app.getLocale() = ${loc}`);
    await window.waitForSelector('#series-grid .series-card', { timeout: 120000 });
    await sleep(3000);

    // Open a series that has enough volumes for the list to look like a list.
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

    // Pick a cover that can be brought into view: the preview must have room to
    // float beside it, and the rows above and below give the shot context.
    // A series with 16 volumes overflows the window, so a cover picked blindly
    // sits below the fold and the pointer lands outside the viewport.
    const target = await window.evaluate(async () => {
      const covers = Array.from(document.querySelectorAll('#volume-list .volume-cover'))
        .filter((c) => c.tagName === 'IMG' && c.dataset.src && !c.classList.contains('placeholder'));
      if (!covers.length) return null;
      const pick = covers[Math.floor(covers.length / 2)];
      pick.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 600));
      const r = pick.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        name: pick.getAttribute('aria-label'),
        count: covers.length,
        inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      };
    });
    if (!target) throw new Error('no non-placeholder covers in the volume list');
    if (!target.inViewport) {
      throw new Error(`target still off-screen at y=${target.y} in a ${target.viewport.h}px viewport`);
    }
    console.log(`  ${target.count} covers; hovering "${target.name}" at y=${Math.round(target.y)}`);

    // Park the pointer on the cover. Playwright's mouse.move dispatches the real
    // events, so the app's own mouseenter handler runs — nothing is faked.
    await window.mouse.move(target.x, target.y);
    await sleep(PREVIEW_SETTLE);

    const state = await window.evaluate(() => {
      const el = document.querySelector('.volume-preview');
      if (!el) return { exists: false };
      const r = el.getBoundingClientRect();
      const img = el.querySelector('img');
      return {
        exists: true,
        visible: el.classList.contains('visible'),
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        natural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
        loaded: !!(img && img.complete && img.naturalWidth > 0),
        language: document.documentElement.lang,
        firstRowLabel: (document.querySelector('#volume-list .volume-row .volume-name') || {}).textContent,
      };
    });
    console.log('  preview state:', JSON.stringify(state));

    // The language must be proved by real UI strings, not by the env var or by
    // document.lang (which is hard-coded to "en" in index.html and always reads
    // "en" even when the app renders Portuguese).
    const ui = await window.evaluate(() => ({
      docLang: document.documentElement.lang,
      back: (document.querySelector('.back-btn') || {}).textContent,
      search: (document.querySelector('#search-input') || {}).placeholder,
      statusButtons: Array.from(document.querySelectorAll('#volume-list .volume-row'))
        .slice(0, 1)
        .flatMap((r) => Array.from(r.querySelectorAll('button')).map((b) => b.textContent.trim())),
      bodyHasPt: /Lido|Não lido|Pendente|Voltar|Selecionar pasta/i.test(document.body.innerText),
    }));
    console.log('  UI strings:', JSON.stringify(ui));
    if (ui.bodyHasPt) throw new Error('UI is still in Portuguese — check LC_ALL/LANGUAGE');

    const shot = path.join(OUT_DIR, 'preview-hover.png');
    await window.screenshot({ path: shot });
    console.log(`  wrote ${shot}`);

    // Geometry, so the post image can crop to the content instead of guessing.
    // The list overflows the window; the last row's bottom tells us where the
    // content actually ends.
    const geo = await window.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) };
      };
      const rows = Array.from(document.querySelectorAll('#volume-list .volume-row'));
      const covers = Array.from(document.querySelectorAll('#volume-list .volume-cover'));
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        header: r('.app-header') || r('header'),
        detail: r('#series-detail'),
        list: r('#volume-list'),
        firstRow: rows.length ? (() => { const b = rows[0].getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom) }; })() : null,
        lastRow: rows.length ? (() => { const b = rows[rows.length - 1].getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom) }; })() : null,
        rowCount: rows.length,
        coverCount: covers.length,
        scrollTop: (document.querySelector('#volume-list') || {}).scrollTop,
        scrollHeight: (document.querySelector('#volume-list') || {}).scrollHeight,
        clientHeight: (document.querySelector('#volume-list') || {}).clientHeight,
      };
    });
    console.log('  geometry:', JSON.stringify(geo));

    // Second capture: keyboard focus instead of the pointer, so the post can
    // show that the preview is not mouse-only. Pointer is moved away first.
    // The filter must NOT require data-src: coverObserver removes that attribute
    // once a thumbnail lazy-loads, so a loaded cover has none and the list comes
    // back empty.
    await window.mouse.move(5, 5);
    await sleep(400);
    const focused = await window.evaluate(() => {
      const covers = Array.from(document.querySelectorAll('#volume-list .volume-cover'))
        .filter((c) => c.tagName === 'IMG' && c.getAttribute('src') && !c.classList.contains('placeholder'));
      if (!covers.length) return null;
      const pick = covers[Math.floor(covers.length / 2)];
      pick.scrollIntoView({ block: 'center' });
      pick.focus();
      return { count: covers.length, name: pick.getAttribute('aria-label') };
    });
    if (!focused) throw new Error('no loaded covers to focus');
    await sleep(PREVIEW_SETTLE);
    const kb = await window.evaluate(() => {
      const el = document.querySelector('.volume-preview');
      return {
        visible: !!el && el.classList.contains('visible'),
        focused: document.activeElement && document.activeElement.getAttribute('aria-label'),
      };
    });
    console.log('  keyboard focus state:', JSON.stringify(kb));
    const shot2 = path.join(OUT_DIR, 'preview-keyboard.png');
    await window.screenshot({ path: shot2 });
    console.log(`  wrote ${shot2}`);

    // And a control: the same view with the pointer parked off the list, so the
    // post can show the 42 px thumbnail it replaces.
    await window.evaluate(() => document.activeElement && document.activeElement.blur());
    await window.mouse.move(5, 5);
    await sleep(600);
    const shot3 = path.join(OUT_DIR, 'preview-none.png');
    await window.screenshot({ path: shot3 });
    console.log(`  wrote ${shot3}`);

    fs.writeFileSync(path.join(OUT_DIR, 'capture.json'),
      JSON.stringify({ opened, target, state, keyboard: kb }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
