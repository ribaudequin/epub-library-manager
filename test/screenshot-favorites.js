/**
 * Verifies that the favorite star stays visible when the series title is long
 * enough to be ellipsised. The card's h3 is a single line with
 * `text-overflow: ellipsis`, so a star appended to the name is the first thing a
 * long title clips away. The star now lives on the cover, as a sibling of
 * .series-info, and this script proves it: it favorites three series (the
 * longest title included), then checks the grid DOM and captures both themes.
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
const OUT_DIR = '/tmp/opencode';
const FAVORITES = 3;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let failures = 0;

function check(ok, message) {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures++;
}

async function main() {
  if (!fs.existsSync(TEST_LIBRARY)) {
    console.log('Generating test library...');
    execSync(`node ${path.join(__dirname, 'generate-test-library.js')} ${TEST_LIBRARY}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const userDataDir = path.join(os.tmpdir(), `favorites-ud-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const env = { ...process.env, TEST_USERDATA: userDataDir, TEST_ROOT: TEST_LIBRARY };
  const app = await electron.launch({ args: [MAIN_JS], env });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForSelector('#series-grid .series-card', { timeout: 120000 });
    await sleep(3000);

    // The star no longer sits in the h3, so its textContent is the plain title.
    const titles = await window.evaluate(() =>
      [...document.querySelectorAll('#series-grid .series-card')].map((el) => {
        const h3 = el.querySelector('.series-info h3');
        return h3 ? h3.textContent.trim() : '';
      })
    );
    console.log(`\n  ${titles.length} series loaded`);

    // Longest title first guarantees the ellipsis case is covered.
    const picked = titles
      .map((title, i) => ({ title, i, len: title.length }))
      .sort((a, b) => b.len - a.len)
      .slice(0, FAVORITES)
      .sort((a, b) => a.i - b.i);

    if (picked.length < FAVORITES) {
      check(false, `need ${FAVORITES} series to favorite, found ${picked.length}`);
    }

    for (const { title, i } of picked) {
      await window.evaluate((idx) => {
        document.querySelectorAll('#series-grid .series-card')[idx].click();
      }, i);
      await sleep(800);

      const toggled = await window.evaluate(() => {
        const btn = document.getElementById('btn-favorite');
        if (!btn) return false;
        btn.click();
        return true;
      });
      await sleep(600);

      const back = await window.evaluate(() => {
        const b = document.getElementById('btn-back');
        if (b) {
          b.click();
          return true;
        }
        return false;
      });
      await sleep(600);

      check(toggled && back, `series ${i} "${title}" favorited and returned to the grid`);
    }

    await window.waitForSelector('#series-grid .series-card');
    await sleep(800);

    // Read the grid back: count, containment, and where the star actually sits.
    const state = await window.evaluate(() => {
      const stars = [...document.querySelectorAll('.fav-star')];
      const details = stars.map((star) => {
        const card = star.closest('.series-card');
        const titleEl = card ? card.querySelector('h3') : null;
        const sr = star.getBoundingClientRect();
        const cr = card ? card.getBoundingClientRect() : null;
        const style = getComputedStyle(star);
        return {
          title: titleEl ? titleEl.textContent.trim() : '(no card)',
          hasCard: !!card,
          visible:
            sr.width > 0 &&
            sr.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity) > 0,
          insideCard:
            !!cr &&
            sr.left >= cr.left &&
            sr.top >= cr.top &&
            sr.right <= cr.right &&
            sr.bottom <= cr.bottom,
          pointerEvents: style.pointerEvents,
          rect: { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height) },
        };
      });

      return {
        count: stars.length,
        noStarInHeading: document.querySelector('h3 .fav-star') === null,
        details,
      };
    });

    console.log('\n  Grid star checks:');
    check(state.count === FAVORITES, `${state.count} .fav-star in the grid (expected ${FAVORITES})`);
    check(state.noStarInHeading, 'no .fav-star inside an h3');

    for (const d of state.details) {
      check(d.hasCard && d.visible, `"${d.title}" star visible at ${d.rect.x},${d.rect.y} (${d.rect.w}x${d.rect.h})`);
      check(d.insideCard, `"${d.title}" star inside its card box`);
    }

    const pe = state.details.map((d) => d.pointerEvents);
    console.log(`  pointer-events on the stars: ${pe.join(', ') || '(none)'}`);
    check(pe.every((v) => v === 'none'), 'stars do not capture the card click');

    for (const theme of ['dark', 'light']) {
      const current = await window.evaluate(() => document.documentElement.dataset.theme || 'dark');
      if (current !== theme) {
        await window.click('#btn-theme-toggle');
        await window.waitForFunction(
          (t) => (document.documentElement.dataset.theme || 'dark') === t,
          theme,
          { timeout: 10000 }
        );
        await sleep(1200);
      }
      const attr = await window.evaluate(() => document.documentElement.dataset.theme || 'dark');
      const shot = path.join(OUT_DIR, `favorites-${theme}.png`);
      await window.screenshot({ path: shot, fullPage: true });
      console.log(`  ✓ ${shot}  [data-theme="${attr}"]`);
    }
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.log(`\n  ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\n  All checks passed');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
