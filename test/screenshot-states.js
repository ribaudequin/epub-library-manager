/**
 * Puts series into different states and captures the grid, so the four state
 * badges can be compared side by side. With a single-state library the
 * confusion between two badges cannot be judged from a screenshot at all.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, 'test-library');
const OUT_DIR = '/tmp/opencode';

// Cycle the states so the badges are all visible at once. The order puts the
// two the user reads as similar — ongoing and completed — next to each other.
const STATES = ['ongoing', 'completed', 'cancelled', 'hiatus', 'ongoing', 'completed', 'cancelled', 'ongoing', 'completed'];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(TEST_LIBRARY)) {
    console.log('Generating test library...');
    execSync(`node ${path.join(__dirname, 'generate-test-library.js')} ${TEST_LIBRARY}`);
  }

  const userDataDir = path.join(os.tmpdir(), `states-ud-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const env = { ...process.env, TEST_USERDATA: userDataDir, TEST_ROOT: TEST_LIBRARY };
  const app = await electron.launch({ args: [MAIN_JS], env });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForSelector('#series-grid .series-card', { timeout: 120000 });
    await sleep(3000);

    const series = await window.evaluate(() =>
      [...document.querySelectorAll('#series-grid .series-card')].map((el, i) => ({
        i,
        id: el.dataset.seriesId || el.dataset.id || null,
        title: (el.querySelector('.series-title') || {}).textContent || `card ${i}`,
      }))
    );
    console.log(`\n  ${series.length} series loaded`);

    // Open each series and click the state button that gives it a distinct state.
    for (let i = 0; i < series.length; i++) {
      const want = STATES[i % STATES.length];
      await window.evaluate((idx) => {
        document.querySelectorAll('#series-grid .series-card')[idx].click();
      }, i);
      await sleep(700);

      const ok = await window.evaluate((state) => {
        const btn = document.querySelector(`.state-btn[data-state="${state}"]`);
        if (!btn) return false;
        btn.click();
        return true;
      }, want);
      await sleep(400);

      // Back to the grid for the next one.
      const back = await window.evaluate(() => {
        const b = document.getElementById('btn-back');
        if (b) { b.click(); return true; }
        return false;
      });
      await sleep(500);

      console.log(`  ${ok ? '✓' : '✗'} series ${i} -> ${want}${back ? '' : ' (no back button!)'}`);
    }

    // Verify what the grid actually shows.
    const shown = await window.evaluate(() =>
      [...document.querySelectorAll('#series-grid .series-card')].map((el) => {
        const badge = el.querySelector('.series-state-badge');
        return {
          title: (el.querySelector('.series-title') || {}).textContent || '',
          state: badge ? badge.dataset.state : 'NONE',
        };
      })
    );
    console.log('\n  State distribution in the grid:');
    const counts = {};
    for (const s of shown) {
      counts[s.state] = (counts[s.state] || 0) + 1;
      console.log(`    ${s.state.padEnd(10)} ${s.title.slice(0, 40)}`);
    }
    console.log(`\n  ${JSON.stringify(counts)}`);

    await window.waitForSelector('#series-grid .series-card');
    await sleep(2500);

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
      const path2 = path.join(OUT_DIR, `states-${theme}.png`);
      await window.screenshot({ path: path2, fullPage: true });
      console.log(`  ✓ ${path2}  [data-theme="${attr}"]`);
    }
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});