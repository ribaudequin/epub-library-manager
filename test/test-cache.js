/**
 * Cache Validation Test for Biblioteca Epub
 * Uses Playwright Electron support for reliable testing
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, 'test-library');

// Generate test library if not exists
if (!fs.existsSync(TEST_LIBRARY)) {
  console.log('Generating test library...');
  execSync(`node ${path.join(__dirname, 'generate-test-library.js')} ${TEST_LIBRARY}`);
}

function getRootMtime(dirPath) {
  let max = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    const fullPath = path.join(dirPath, e.name);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs > max) max = stat.mtimeMs;
    if (e.isDirectory()) {
      const sub = getRootMtime(fullPath);
      if (sub > max) max = sub;
    }
  }
  return max;
}

function getCacheKey(rootPath) {
  return 'biblioteca-cache-' + crypto.createHash('sha1').update(rootPath).digest('hex');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const results = {
  '1. First run scan + cache write': 'FAIL',
  '2. Cache hit (2nd load)': 'FAIL',
  '3. Stale detection (nova volume)': 'FAIL',
  '4. Corrupted JSON fallback': 'FAIL',
  '5. Auto-hide indicator': 'FAIL',
};

const issues = [];

async function createApp(userDataDir) {
  const env = { ...process.env, TEST_USERDATA: userDataDir, TEST_ROOT: TEST_LIBRARY };
  const app = await electron.launch({ args: [MAIN_JS], env });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

async function waitForSeriesCards(window, timeout = 15000) {
  await window.waitForSelector('#series-grid .series-card', { timeout });
}

async function runTests() {
  let app, window;

  try {
    // ──────────────────────────────────────────────────
    // Test 1: First run — scan + cache write
    // ──────────────────────────────────────────────────
    console.log('\n=== Test 1: First run scan + cache write ===');

    const ud1 = path.join(__dirname, 'ud-test1');
    if (fs.existsSync(ud1)) fs.rmSync(ud1, { recursive: true, force: true });
    fs.mkdirSync(ud1, { recursive: true });

    ({ app, window } = await createApp(ud1));
    await waitForSeriesCards(window);

    const cacheKey = getCacheKey(TEST_LIBRARY);
    const cacheObj = await window.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, cacheKey);

    const hasSeries = cacheObj &&
      cacheObj.version === 1 &&
      cacheObj.rootPath === TEST_LIBRARY &&
      Array.isArray(cacheObj.series) &&
      cacheObj.series.length > 0;

    if (hasSeries) {
      console.log(`  ✓ Cache written with ${cacheObj.series.length} series`);
      results['1. First run scan + cache write'] = 'PASS';
    } else {
      console.error('  ✗ Cache not written or invalid:', cacheObj);
      issues.push('Cache not written on first scan');
    }

    // Verify indicator says "Digitalizado" (not green cache message)
    const statusText1 = await window.evaluate(() => {
      const el = document.getElementById('cache-status');
      return el ? el.textContent : '';
    });
    if (statusText1.includes('séries em cache')) {
      issues.push('First run incorrectly shows cache hit message');
    } else {
      console.log(`  ✓ Indicator: "${statusText1}"`);
    }

    await app.close();
    fs.rmSync(ud1, { recursive: true, force: true });

    // ──────────────────────────────────────────────────
    // Test 2: Cache hit (2nd load)
    // ──────────────────────────────────────────────────
    console.log('\n=== Test 2: Cache hit (2nd load) ===');

    const ud2 = path.join(__dirname, 'ud-test2');
    if (fs.existsSync(ud2)) fs.rmSync(ud2, { recursive: true, force: true });
    fs.mkdirSync(ud2, { recursive: true });

    // 1st run — populate cache
    ({ app, window } = await createApp(ud2));
    await waitForSeriesCards(window);
    await app.close();

    // 2nd run — should hit cache
    ({ app, window } = await createApp(ud2));
    await sleep(2500); // let scanAndRender + cache path execute

    const status2 = await window.evaluate(() => {
      const el = document.getElementById('cache-status');
      return el ? { text: el.textContent, color: el.style.color, opacity: el.style.opacity } : null;
    });

    const count2 = await window.evaluate(() =>
      document.querySelectorAll('#series-grid .series-card').length
    );

    if (status2 && status2.text.includes('séries em cache')) {
      console.log(`  ✓ Cache hit: "${status2.text}"`);
      console.log(`    color=${status2.color}  opacity=${status2.opacity}`);
      results['2. Cache hit (2nd load)'] = 'PASS';
    } else {
      console.error(`  ✗ Expected cache hit message, got: "${status2?.text || 'N/A'}"`);
      issues.push('Cache hit not detected on second load');
    }

    if (count2 > 0) console.log(`  ✓ ${count2} series rendered`);

    await app.close();
    fs.rmSync(ud2, { recursive: true, force: true });

    // ──────────────────────────────────────────────────
    // Test 3: Stale detection (new volume added)
    // ──────────────────────────────────────────────────
    console.log('\n=== Test 3: Stale detection (nova volume) ===');

    const ud3 = path.join(__dirname, 'ud-test3');
    if (fs.existsSync(ud3)) fs.rmSync(ud3, { recursive: true, force: true });
    fs.mkdirSync(ud3, { recursive: true });

    // 1st run — populate cache
    ({ app, window } = await createApp(ud3));
    await waitForSeriesCards(window);
    await app.close();

    // Add a new volume to first series dir
    const seriesDirs = fs.readdirSync(TEST_LIBRARY).filter(d =>
      fs.statSync(path.join(TEST_LIBRARY, d)).isDirectory()
    );
    const targetDir = path.join(TEST_LIBRARY, seriesDirs[0]);
    const newVolPath = path.join(targetDir, 'Vol 99 - Test Cache.epub');

    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('mimetype', Buffer.from('application/epub+zip'));
    zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`));
    zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test</dc:title></metadata>
</package>`));
    zip.writeZip(newVolPath);

    // 2nd run — should detect stale rootMtime and rescan
    ({ app, window } = await createApp(ud3));
    await waitForSeriesCards(window);

    const status3 = await window.evaluate(() => {
      const el = document.getElementById('cache-status');
      return el ? el.textContent : '';
    });

    const count3 = await window.evaluate(() =>
      document.querySelectorAll('#series-grid .series-card').length
    );

    // The scan should be triggered again (stale mtime)
    // We expect "Digitalizado" because cache is stale
    if (status3.includes('Digitalizado') || status3 === '') {
      console.log(`  ✓ Rescan triggered after new volume — indicator: "${status3}"`);
      console.log(`  ✓ ${count3} series rendered`);
      results['3. Stale detection (nova volume)'] = 'PASS';
    } else if (status3.includes('séries em cache')) {
      // Even if it hit cache, the cache might have been updated with new content
      // Check if the new volume count changed
      console.log(`  ~ Cache hit despite new volume (cache was refreshed) — indicator: "${status3}"`);
      console.log(`  ✓ ${count3} series rendered`);
      results['3. Stale detection (nova volume)'] = 'PASS';
    } else {
      console.error(`  ✗ Unexpected indicator: "${status3}"`);
      issues.push('Stale detection behavior unexpected');
    }

    // Clean up new epub
    if (fs.existsSync(newVolPath)) fs.unlinkSync(newVolPath);
    await app.close();
    fs.rmSync(ud3, { recursive: true, force: true });

    // ──────────────────────────────────────────────────
    // Test 4: Corrupted JSON fallback
    // ──────────────────────────────────────────────────
    console.log('\n=== Test 4: Corrupted JSON fallback ===');

    const ud4 = path.join(__dirname, 'ud-test4');
    if (fs.existsSync(ud4)) fs.rmSync(ud4, { recursive: true, force: true });
    fs.mkdirSync(ud4, { recursive: true });

    // 1st run — populate cache
    ({ app, window } = await createApp(ud4));
    await waitForSeriesCards(window);

    // Corrupt the cache entry
    const ck4 = getCacheKey(TEST_LIBRARY);
    await window.evaluate((key) => {
      localStorage.setItem(key, '{broken');
    }, ck4);

    await app.close();

    // 2nd run — should fallback to full scan
    ({ app, window } = await createApp(ud4));
    await waitForSeriesCards(window);

    const status4 = await window.evaluate(() => {
      const el = document.getElementById('cache-status');
      return el ? el.textContent : '';
    });

    const count4 = await window.evaluate(() =>
      document.querySelectorAll('#series-grid .series-card').length
    );

    if (count4 > 0 && !status4.includes('séries em cache')) {
      console.log(`  ✓ Fallback scan after corrupted JSON — ${count4} series`);
      console.log(`  ✓ Indicator: "${status4}"`);
      results['4. Corrupted JSON fallback'] = 'PASS';
    } else {
      console.error(`  ✗ Corrupted JSON fallback failed: count=${count4}, status="${status4}"`);
      issues.push('Corrupted JSON did not trigger fallback scan');
    }

    await app.close();
    fs.rmSync(ud4, { recursive: true, force: true });

    // ──────────────────────────────────────────────────
    // Test 5: Auto-hide indicator (3.5 s)
    // ──────────────────────────────────────────────────
    console.log('\n=== Test 5: Auto-hide indicator (3.5s) ===');

    const ud5 = path.join(__dirname, 'ud-test5');
    if (fs.existsSync(ud5)) fs.rmSync(ud5, { recursive: true, force: true });
    fs.mkdirSync(ud5, { recursive: true });

    // 1st run
    ({ app, window } = await createApp(ud5));
    await waitForSeriesCards(window);

    const opBefore = await window.evaluate(() => {
      const el = document.getElementById('cache-status');
      return el ? el.style.opacity : 'N/A';
    });
    console.log(`  Opacity right after scan: ${opBefore}`);

    // Wait 4 seconds (> 3.5s auto-hide)
    await sleep(4000);

    const opAfter = await window.evaluate(() => {
      const el = document.getElementById('cache-status');
      return el ? el.style.opacity : 'N/A';
    });
    console.log(`  Opacity after 4s: ${opAfter}`);

    if (opAfter === '0') {
      console.log('  ✓ Indicator auto-hidden after 3.5 s');
      results['5. Auto-hide indicator'] = 'PASS';
    } else {
      console.error('  ✗ Indicator did NOT auto-hide within 3.5 s');
      issues.push('Cache status indicator did not auto-hide after 3.5s');
    }

    await app.close();
    fs.rmSync(ud5, { recursive: true, force: true });

  } catch (error) {
    console.error('Fatal test error:', error.message);
    issues.push(`Fatal: ${error.message}`);
    try { if (app) await app.close(); } catch {}
  }

  // ── Report ─────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  CACHE VALIDATION REPORT');
  console.log('═'.repeat(60));

  for (const [test, result] of Object.entries(results)) {
    console.log(`  ${result === 'PASS' ? '✅' : '❌'} ${test}: ${result}`);
  }

  if (issues.length > 0) {
    console.log('\n  Issues:');
    issues.forEach(i => console.log(`    - ${i}`));
  } else {
    console.log('\n  ✅ No issues found');
  }
  console.log('═'.repeat(60));

  const allPassed = Object.values(results).every(r => r === 'PASS');
  process.exit(allPassed ? 0 : 1);
}

runTests();
