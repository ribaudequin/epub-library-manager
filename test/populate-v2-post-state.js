/**
 * Populate the capture profile with realistic reading progress, by clicking the
 * app's own status buttons.
 *
 * A list where every row reads "Unread" reads as a fixture, not as a product in
 * use — and a post image that is meant to be persuasive fails on exactly that.
 * This marks a plausible spread: early volumes read, the current one in
 * progress, the rest unread, across several series.
 *
 * It never writes state itself and never derives an id. Volume ids are
 * sha1(filePath).slice(0,12) and are absent from the DOM, so reconstructing them
 * from outside would be guesswork; clicking the real button lets the app resolve
 * its own ids. Each click re-renders the whole list (openSeries rebuilds every
 * row), so every click re-queries the DOM.
 *
 * The profile is a fixed path, NOT a throwaway: the capture run reuses it, and
 * so does a later re-capture. The owner's real profile is never touched.
 *
 *   cd /home/marcelo/Documentos/opencode/biblioteca
 *   node test/populate-v2-post-state.js
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, 'test-library');

// Fixed, deliberately reused — see the header.
const USER_DATA = '/tmp/epubshelf-v2-post-ud';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// How far into each series the reader is. Keyed by a fragment of the series
// title as the card renders it.
const PROGRESS = [
  { match: /GATE/i, read: 2, pending: 1 },
  { match: /Space Mercenary/i, read: 8, pending: 2 },
  { match: /Cheat Ability/i, read: 4, pending: 1 },
  { match: /Knight/i, read: 3, pending: 0 },
  { match: /Petty Villain/i, read: 1, pending: 1 },
  { match: /Sentenced to Be a Hero/i, read: 5, pending: 2 },
  { match: /Reincarnated Mastermind/i, read: 0, pending: 1 },
];

async function openSeries(window, title) {
  const ok = await window.evaluate((t) => {
    const card = Array.from(document.querySelectorAll('#series-grid .series-card'))
      .find((c) => (c.querySelector('h3') || {}).textContent === t);
    if (!card) return false;
    card.click();
    return true;
  }, title);
  if (!ok) return false;
  await window.waitForSelector('#series-detail:not(.hidden)');
  await sleep(700);
  return true;
}

async function backToGrid(window) {
  await window.evaluate(() => {
    const back = document.getElementById('btn-back');
    if (back) back.click();
  });
  await window.waitForSelector('#series-view:not(.hidden)');
  await sleep(500);
}

// Click the status button on the Nth volume row. Re-queries the DOM every time,
// because the click rebuilds the list.
async function markRow(window, index, status) {
  const done = await window.evaluate(({ i, s }) => {
    const rows = Array.from(document.querySelectorAll('#volume-list .volume-row'));
    if (i >= rows.length) return false;
    const btn = rows[i].querySelector(`.status-btn[data-status="${s}"]`);
    if (!btn) return false;
    btn.click();
    return true;
  }, { i: index, s: status });
  await sleep(260);
  return done;
}

async function main() {
  fs.mkdirSync(USER_DATA, { recursive: true });

  const env = {
    ...process.env,
    TEST_USERDATA: USER_DATA,
    TEST_ROOT: TEST_LIBRARY,
    LANG: 'en_GB.UTF-8',
    LC_ALL: 'en_GB.UTF-8',
    LANGUAGE: 'en_GB',
  };

  const app = await electron.launch({ args: [MAIN_JS], env });
  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForSelector('#series-grid .series-card', { timeout: 120000 });
    await sleep(3000);

    const titles = await window.evaluate(() =>
      Array.from(document.querySelectorAll('#series-grid .series-card'))
        .map((c) => (c.querySelector('h3') || {}).textContent || ''));
    console.log(`  ${titles.length} series in the library`);

    let clicks = 0;
    for (const title of titles) {
      const plan = PROGRESS.find((p) => p.match.test(title));
      if (!plan) continue;
      if (!await openSeries(window, title)) continue;

      const n = await window.evaluate(() =>
        document.querySelectorAll('#volume-list .volume-row').length);

      for (let i = 0; i < Math.min(plan.read, n); i++) {
        if (await markRow(window, i, 'lido')) clicks++;
      }
      for (let i = plan.read; i < Math.min(plan.read + plan.pending, n); i++) {
        if (await markRow(window, i, 'pendente')) clicks++;
      }

      // Read the result back out of the DOM, not from what we intended.
      const actual = await window.evaluate(() =>
        Array.from(document.querySelectorAll('#volume-list .volume-row')).map((r) => {
          const active = r.querySelector('.status-btn.active');
          return active ? active.dataset.status : null;
        }));
      const tally = actual.reduce((acc, s) => {
        acc[s || 'none'] = (acc[s || 'none'] || 0) + 1;
        return acc;
      }, {});
      console.log(`  ${title.slice(0, 40).padEnd(40)} ${JSON.stringify(tally)}`);

      await backToGrid(window);
    }

    console.log(`  ${clicks} status clicks`);

    // Confirm against the app's own state file, reading the real shape.
    await sleep(900);
    const statePath = path.join(USER_DATA, 'biblioteca.json');
    if (!fs.existsSync(statePath)) throw new Error(`no state file at ${statePath}`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const counts = {};
    for (const vols of Object.values(state.series || {})) {
      for (const [key, val] of Object.entries(vols)) {
        if (key === 'seriesState') continue;   // reserved key, not a volume
        counts[val] = (counts[val] || 0) + 1;
      }
    }
    console.log('  state file holds:', JSON.stringify(counts));
    if (!counts.lido) throw new Error('no volume ended up read — the markup did not land');
    console.log(`  profile: ${USER_DATA}`);
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
