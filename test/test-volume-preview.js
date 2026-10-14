/**
 * Volume Cover Preview Test
 *
 * The volume rows only fit a 42px thumbnail, so hovering one must float the
 * full-size cover above the list. This drives the real app through Playwright
 * and checks the behaviour that is easy to get wrong and impossible to see in a
 * static screenshot: that the popup appears, is anchored and on-screen, swaps
 * to the next volume, and clears on every exit path (mouse, keyboard, scroll).
 *
 *   node test/test-volume-preview.js
 *
 * Screenshots are written to /tmp/opencode — the repo is never touched.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, 'test-library');
const OUT_DIR = '/tmp/opencode';
const WINDOW_SIZE = { width: 1440, height: 900 };
const CARD_TIMEOUT = 30000;

const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// openSeries() rebuilds every row, so both a cover and the preview must survive
// a re-render triggered by a status-button click.
async function openFirstSeriesWithVolumes(window) {
  await window.waitForSelector('#series-grid .series-card', { timeout: CARD_TIMEOUT });
  const opened = await window.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#series-grid .series-card'));
    for (const card of cards) {
      // The volume count is the "N volume(s)" paragraph — not the first <p>,
      // which is the author.
      const text = Array.from(card.querySelectorAll('.series-info p'))
        .map(p => p.textContent || '')
        .find(t => /\d+\s*volume/i.test(t));
      const n = Number(text?.match(/(\d+)/)?.[1] || 0);
      if (n > 0) {
        card.click();
        return n;
      }
    }
    return 0;
  });
  if (!opened) throw new Error('no series with volumes in the test library');
  await window.waitForSelector('#series-detail:not(.hidden)');
  await window.waitForSelector('#volume-list .volume-cover');
  return opened;
}

async function previewState(window) {
  return window.evaluate(() => {
    const el = document.querySelector('.volume-preview');
    if (!el) return { exists: false };
    const rect = el.getBoundingClientRect();
    const img = el.querySelector('img');
    return {
      exists: true,
      visible: el.classList.contains('visible'),
      src: img ? img.getAttribute('src') : null,
      loaded: img ? img.naturalWidth > 0 : false,
      naturalWidth: img ? img.naturalWidth : 0,
      naturalHeight: img ? img.naturalHeight : 0,
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

async function hoverCover(window, index) {
  const covers = window.locator('#volume-list img.volume-cover');
  await covers.nth(index).hover();
  await sleep(450); // past the 220ms intent delay
}

(async () => {
  const userDataDir = path.join(os.tmpdir(), 'epubshelf-preview-test-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const app = await electron.launch({
    args: [MAIN_JS],
    env: { ...process.env, TEST_USERDATA: userDataDir, TEST_ROOT: TEST_LIBRARY },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.setContentSize(size.width, size.height);
  }, WINDOW_SIZE);

  try {
    const volumeCount = await openFirstSeriesWithVolumes(window);
    console.log(`\nSeries opened with ${volumeCount} volume(s)\n`);

    const thumbBox = await window.locator('#volume-list img.volume-cover').first().boundingBox();
    check(
      'thumbnail is the small size the preview exists for',
      thumbBox && thumbBox.width <= 64,
      thumbBox ? `${Math.round(thumbBox.width)}x${Math.round(thumbBox.height)}` : 'no box'
    );

    await hoverCover(window, 0);
    let st = await previewState(window);
    check('popup appears on hover', st.exists && st.visible);
    check('preview decodes a real cover', st.loaded && st.naturalWidth > thumbBox.width,
      st.loaded ? `${st.naturalWidth}x${st.naturalHeight}` : 'not loaded');
    check('preview is much larger than the thumbnail',
      st.width > thumbBox.width * 3, `${st.width}px vs ${Math.round(thumbBox.width)}px thumb`);
    check('preview keeps the cover aspect ratio',
      Math.abs((st.width / st.height) - (st.naturalWidth / st.naturalHeight)) < 0.02,
      `rendered ${(st.width / st.height).toFixed(3)} vs natural ${(st.naturalWidth / st.naturalHeight).toFixed(3)}`);

    const onScreen =
      st.left >= 0 && st.top >= 0 &&
      st.left + st.width <= st.viewport.w && st.top + st.height <= st.viewport.h;
    check('preview sits fully inside the window', onScreen,
      `x ${st.left}..${st.left + st.width} / ${st.viewport.w}, y ${st.top}..${st.top + st.height} / ${st.viewport.h}`);

    await window.screenshot({ path: path.join(OUT_DIR, 'preview-hover.png') });

    // Anchored to its own row: a different volume must show a different cover.
    if (volumeCount > 1) {
      await hoverCover(window, 1);
      const second = await previewState(window);
      check('moving to the next volume swaps the cover',
        second.visible && second.src !== st.src,
        `${st.src?.slice(-18)} -> ${second.src?.slice(-18)}`);
      check('only ever one popup in the DOM',
        (await window.locator('.volume-preview').count()) === 1);
    }

    await window.mouse.move(700, 20);
    await sleep(350);
    check('popup clears when the mouse leaves', !(await previewState(window)).visible);

    await window.locator('#volume-list img.volume-cover').first().focus();
    await sleep(250);
    check('popup appears on keyboard focus', (await previewState(window)).visible);
    await window.keyboard.press('Escape');
    await sleep(400);
    check('Escape dismisses the popup', !(await previewState(window)).visible);
    // Escape is an explicit dismissal: it must not spring back while focus is
    // still parked on the cover. Moving focus away and back is the reopen path.
    check('Escape dismissal sticks while focus stays put', !(await previewState(window)).visible);
    await window.locator('#volume-list .status-btn').first().focus();
    await sleep(150);
    await window.locator('#volume-list img.volume-cover').first().focus();
    await sleep(250);
    check('popup reappears when the cover is refocused', (await previewState(window)).visible);

    await window.evaluate(() => window.scrollBy(0, 400));
    await sleep(200);
    check('scrolling clears the popup', !(await previewState(window)).visible);
    await sleep(500);
    check('popup returns once scrolling stops and the cover is still focused',
      (await previewState(window)).visible);

    // No sticky header above, no modal clipping: the preview must outrank the
    // z-index:10 header but stay under the z-index:100 modals.
    const zIndex = await window.evaluate(() => {
      const el = document.querySelector('.volume-preview');
      return el ? parseInt(getComputedStyle(el).zIndex, 10) : null;
    });
    check('popup stacks above sticky chrome, below modals',
      zIndex !== null && zIndex > 10 && zIndex < 100, `z-index ${zIndex}`);

    const a11y = await window.evaluate(() => {
      const img = document.querySelector('#volume-list img.volume-cover');
      return {
        tabIndex: img.tabIndex,
        role: img.getAttribute('role'),
        label: img.getAttribute('aria-label'),
        hidden: document.querySelector('.volume-preview').getAttribute('aria-hidden'),
      };
    });
    check('cover is reachable and labelled for keyboard users',
      a11y.tabIndex === 0 && a11y.role === 'img' && !!a11y.label,
      `tabindex=${a11y.tabIndex} role=${a11y.role} label="${a11y.label}"`);
    check('popup is hidden from assistive tech', a11y.hidden === 'true');

    // Covers with no image fall back to a placeholder div — they must not
    // create an empty popup.
    const placeholderState = await window.evaluate(async () => {
      const ph = document.querySelector('#volume-list .volume-cover.placeholder');
      if (!ph) return 'skipped';
      ph.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      await new Promise(r => setTimeout(r, 400));
      const el = document.querySelector('.volume-preview');
      const visible = el ? el.classList.contains('visible') : false;
      ph.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
      return visible;
    });
    check('placeholder covers do not open a popup', placeholderState !== true,
      placeholderState === 'skipped' ? 'no placeholder in this fixture' : 'popup opened for a coverless volume');

    await hoverCover(window, 0);
    check('popup is usable again at the end of the run', (await previewState(window)).visible);

    // --shadow is 0.35 alpha in dark but only 0.10 in light, so the popup's
    // separation from the background has to be judged per theme rather than
    // assumed from the dark one.
    for (const theme of ['dark', 'light']) {
      await window.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      }, theme);
      await sleep(200);
      await hoverCover(window, 0);
      const s = await previewState(window);
      const themeOk = await window.evaluate(() => document.documentElement.getAttribute('data-theme'));
      check(`preview renders in the ${theme} theme`,
        s.visible && s.loaded && s.width > 0 && themeOk === theme,
        `${s.width}x${s.height}, data-theme="${themeOk}"`);
      await window.screenshot({ path: path.join(OUT_DIR, `preview-${theme}.png`) });
    }
  } catch (error) {
    check('harness ran to completion', false, error.message);
  } finally {
    await app.close().catch(() => {});
  }

  const failed = results.filter(r => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error('\nFailed:');
    failed.forEach(f => console.error(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`));
    process.exitCode = 1;
  }
})();