/**
 * Palette Screenshot Capture for Biblioteca Epub
 *
 * Launches the real app against the test library through Playwright and captures
 * the grid, the series detail view and the statistics modal in both themes, so a
 * colour palette can be judged side by side. Run it again after a CSS change with
 * a different tag to keep the before/after sets apart:
 *
 *   node test/screenshot-palette.js before
 *   node test/screenshot-palette.js after
 *
 * Everything is written to /tmp/opencode — the repo is never touched.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, 'test-library');

// /tmp/opencode is the approved scratch area for work outside the workspace.
const OUT_DIR = '/tmp/opencode';

const TAG = (process.argv[2] || 'current').replace(/[^a-zA-Z0-9_-]/g, '-');
const THEMES = ['dark', 'light'];

// The palette is judged at a desktop size; the app's own 1200x800 default is too
// cramped to show the layout differences between the two themes.
const WINDOW_SIZE = { width: 1440, height: 900 };

const CARD_TIMEOUT = 30000;
const IMAGE_TIMEOUT = 5000;
const SETTLE_MS = 700;

const issues = [];
const warnings = [];
const captures = [];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fail(scope, message) {
  issues.push(`[${scope}] ${message}`);
  console.error(`  ! ${scope}: ${message}`);
}

function warn(scope, message) {
  warnings.push(`[${scope}] ${message}`);
  console.warn(`  ~ ${scope}: ${message}`);
}

async function createApp(userDataDir) {
  const env = { ...process.env, TEST_USERDATA: userDataDir, TEST_ROOT: TEST_LIBRARY };
  const app = await electron.launch({ args: [MAIN_JS], env });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

// Electron pages have no setViewportSize; resize the BrowserWindow from the main
// process instead. Cosmetic only, so a failure here must not abort the capture.
async function resizeWindow(app) {
  try {
    await app.evaluate(({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) win.setContentSize(size.width, size.height);
    }, WINDOW_SIZE);
    return true;
  } catch (error) {
    warn('window', `resize to ${WINDOW_SIZE.width}x${WINDOW_SIZE.height} failed: ${error.message} — using the default window size`);
    return false;
  }
}

// Covers are lazy-loaded through an IntersectionObserver, so anything below the
// fold keeps its data-src until it scrolls into view. Walking the page first is
// what makes a full-page screenshot show real covers instead of empty boxes.
async function primeLazyImages(window, selector) {
  try {
    await window.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return;
      const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y <= root.scrollHeight + window.innerHeight; y += step) {
        window.scrollTo(0, y);
      }
      window.scrollTo(0, 0);
    }, selector);
  } catch (error) {
    warn('lazy', `scroll sweep on ${selector} failed: ${error.message}`);
  }
}

function pendingImageCount(window, selector) {
  return window.evaluate((sel) => {
    const imgs = Array.from(document.querySelectorAll(`${sel} img`));
    return {
      total: imgs.length,
      pending: imgs.filter((img) => img.naturalWidth === 0).length,
    };
  }, selector).catch(() => ({ total: -1, pending: -1 }));
}

async function waitForImages(window, selector) {
  return window.waitForFunction(
    (sel) => Array.from(document.querySelectorAll(`${sel} img`)).every((img) => img.naturalWidth > 0),
    selector,
    { timeout: IMAGE_TIMEOUT }
  ).then(() => true).catch(() => false);
}

// The cover cache is written as <hash>.img and the system MIME database maps
// that extension to application/vnd.efi.img, which Chromium refuses to decode.
// Re-read the files through the app's own cover:read IPC — the same call
// applyCoverTint uses — and swap in the data URL, so real covers still show.
async function hydrateCovers(window, selector) {
  return window.evaluate(async (sel) => {
    const imgs = Array.from(document.querySelectorAll(`${sel} img`)).filter((img) => img.naturalWidth === 0);
    let restored = 0;
    for (const img of imgs) {
      const url = img.currentSrc || img.src || '';
      if (!url.startsWith('file://')) continue;
      const filePath = decodeURIComponent(url.replace(/^file:\/\//, ''));
      // Keep the app's own behaviour: the tint is derived from the cover and
      // must be computed while src is still a file:// path.
      try {
        if (typeof window.applyCoverTint === 'function') {
          await window.applyCoverTint(img, img.id === 'detail-cover' ? document.getElementById('series-detail') : undefined);
        }
        const dataUrl = await window.api.readCover(filePath);
        if (!dataUrl) continue;
        img.src = dataUrl;
        img.removeAttribute('data-src');
        restored++;
      } catch { /* leave it broken, the count below reports it */ }
    }
    return restored;
  }, selector);
}

// Screenshots of a half-painted grid are useless for judging colour, so images
// get every chance to settle before the shutter opens.
async function prepareImages(window, selector, scope) {
  await primeLazyImages(window, selector);
  if (await waitForImages(window, selector)) return true;

  const restored = await hydrateCovers(window, selector);
  if (restored > 0 && await waitForImages(window, selector)) {
    warn(scope, `${restored} cover(s) would not load over file:// (.img is not a recognised image MIME) — restored via cover:read`);
    return true;
  }

  const { total, pending } = await pendingImageCount(window, selector);
  if (total === 0) return true;
  // Not a harness fault: the fixture's covers are a PNG signature followed by
  // raw pixels with no IHDR/IDAT chunks, so no decoder can ever render them.
  warn(scope, `${pending}/${total} covers cannot be decoded — test/generate-test-library.js writes a PNG signature with no IHDR/IDAT chunks`);
  return false;
}

async function waitForHidden(window, selector) {
  await window.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && el.classList.contains('hidden');
    },
    selector,
    { timeout: CARD_TIMEOUT }
  );
}

function readTheme(window) {
  return window.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

// The toggle button is the real mechanism, but looping until the attribute
// matches makes the run immune to a stale localStorage value left by an earlier
// launch; the direct apply only runs if the button is missing entirely.
async function setTheme(window, theme) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await readTheme(window)) === theme) return true;
    await window.click('#btn-theme-toggle');
    await sleep(120);
  }
  if ((await readTheme(window)) === theme) return true;
  await window.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
  }, theme);
  return (await readTheme(window)) === theme;
}

async function capture(window, { file, theme, selector, scope }) {
  const actual = await readTheme(window);
  if (actual !== theme) fail(scope, `data-theme is "${actual}", expected "${theme}"`);

  const out = path.join(OUT_DIR, file);
  try {
    if (selector) {
      // A fixed overlay is painted at the scroll position and is not expanded by
      // a full-page capture, so the stats panel is taken as an element shot.
      // Lifting max-height first exposes the charts that would otherwise stay
      // hidden behind the panel's own scrollbar.
      await window.evaluate(() => {
        const panel = document.querySelector('.stats-panel');
        if (panel) panel.style.maxHeight = 'none';
      });
      await window.locator(selector).screenshot({ path: out });
    } else {
      await window.screenshot({ path: out, fullPage: true });
    }
  } catch (error) {
    fail(scope, `screenshot failed: ${error.message}`);
  }

  const bytes = fs.existsSync(out) ? fs.statSync(out).size : 0;
  if (bytes === 0) fail(scope, 'screenshot is empty on disk');

  captures.push({ file, theme: actual || '(unset)', bytes });
  console.log(`  ✓ ${file}  [data-theme="${actual}"]  ${(bytes / 1024).toFixed(1)} kB`);
}

async function run() {
  if (!fs.existsSync(TEST_LIBRARY)) {
    console.log('Generating test library...');
    execSync(`node ${path.join(__dirname, 'generate-test-library.js')} ${TEST_LIBRARY}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Temp user-data dir outside the repo: the app writes biblioteca.json and the
  // cover cache there, and this run must neither inherit nor leave state behind.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-palette-'));
  let app, window;

  try {
    ({ app, window } = await createApp(userDataDir));
    await resizeWindow(app);

    await window.waitForSelector('#series-grid .series-card', { timeout: CARD_TIMEOUT });
    // The loading collage sits on top of the grid, so wait for the class flip
    // rather than for the element — a .hidden node is never "visible".
    await window.waitForFunction(
      () => document.getElementById('loading-state').classList.contains('hidden'),
      null,
      { timeout: CARD_TIMEOUT }
    );
    const cardCount = await window.evaluate(() => document.querySelectorAll('#series-grid .series-card').length);
    if (cardCount === 0) fail('grid', 'no series cards rendered — the shot would be an empty page');
    console.log(`\n  ${cardCount} series loaded from ${TEST_LIBRARY}\n`);

    await prepareImages(window, '#series-grid', 'grid');

    for (const theme of THEMES) {
      console.log(`── theme: ${theme} ──`);
      if (!await setTheme(window, theme)) fail('theme', `could not switch to "${theme}"`);
      await sleep(SETTLE_MS);

      await capture(window, {
        file: `palette-${TAG}-grid-${theme}.png`,
        theme,
        scope: `grid/${theme}`,
      });

      await window.click('#series-grid .series-card');
      await window.waitForSelector('#series-detail:not(.hidden)');
      await window.waitForSelector('#volume-list .volume-row');
      await prepareImages(window, '#series-detail', `detail/${theme}`);
      await sleep(SETTLE_MS);
      await capture(window, {
        file: `palette-${TAG}-detail-${theme}.png`,
        theme,
        scope: `detail/${theme}`,
      });

      await window.click('#btn-back');
      await window.waitForSelector('#series-view:not(.hidden)');
      await sleep(200);

      await window.click('#btn-stats');
      await window.waitForSelector('#stats-modal:not(.hidden)');
      await window.waitForSelector('#stats-summary .stat-card');
      await window.waitForSelector('#stats-charts .chart-section');
      await sleep(SETTLE_MS);
      await capture(window, {
        file: `palette-${TAG}-stats-${theme}.png`,
        theme,
        selector: '#stats-modal .stats-panel',
        scope: `stats/${theme}`,
      });

      await window.click('#btn-stats-close');
      await waitForHidden(window, '#stats-modal');
    }
  } catch (error) {
    fail('run', error.message);
  } finally {
    // Never leave an Electron process behind, whatever went wrong above.
    try { if (app) await app.close(); } catch { /* already gone */ }
    await sleep(300);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* temp dir stays, harmless */ }
  }

  console.log('\n' + '═'.repeat(72));
  console.log(`  PALETTE REPORT — tag "${TAG}"`);
  console.log('═'.repeat(72));
  console.log(`  ${'FILE'.padEnd(32)} ${'data-theme'.padEnd(12)} ${'SIZE'.padStart(10)}`);
  for (const c of captures) {
    console.log(`  ${c.file.padEnd(32)} ${String(c.theme).padEnd(12)} ${(c.bytes / 1024).toFixed(1).padStart(8)} kB`);
  }

  if (captures.length !== THEMES.length * 3) {
    fail('report', `expected ${THEMES.length * 3} screenshots, produced ${captures.length}`);
  }

  console.log('');
  if (issues.length) {
    console.log('  Assertion failures:');
    issues.forEach(i => console.log(`    - ${i}`));
  } else {
    console.log('  ✅ No assertion failures — every PNG exists, is non-empty and matches its theme');
  }
  if (warnings.length) {
    console.log('\n  Warnings:');
    [...new Set(warnings)].forEach(w => console.log(`    - ${w}`));
  }
  console.log('═'.repeat(72));

  process.exit(issues.length ? 1 : 0);
}

run();