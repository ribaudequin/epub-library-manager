/**
 * Japanese Locale Visual Test — launches Electron with LANG=ja_JP.UTF-8
 * and verifies UI renders in Japanese
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const MAIN_JS = path.join(__dirname, '..', 'src', 'main.js');
const TEST_LIBRARY = path.join(__dirname, 'test-library');

async function run() {
  // Generate test library if not exists
  if (!fs.existsSync(TEST_LIBRARY)) {
    console.log('Generating test library...');
    require('child_process').execSync(`node ${path.join(__dirname, 'generate-test-library.js')} ${TEST_LIBRARY}`);
  }

  const ud = path.join(__dirname, 'ud-test-jp');
  if (fs.existsSync(ud)) fs.rmSync(ud, { recursive: true, force: true });
  fs.mkdirSync(ud, { recursive: true });

  // Launch Electron with Japanese locale via --lang flag
  const env = {
    ...process.env,
    TEST_USERDATA: ud,
    TEST_ROOT: TEST_LIBRARY
  };

  console.log('Launching Electron with --lang=ja...');
  const app = await electron.launch({ args: [MAIN_JS, '--lang=ja'], env });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('#series-grid .series-card', { timeout: 15000 });

  console.log('App launched. Checking Japanese locale...');

  // Check html lang attribute
  const htmlLang = await window.getAttribute('html', 'lang');
  console.log(`html lang: ${htmlLang}`);
  if (htmlLang !== 'ja') throw new Error(`Expected html lang="ja", got "${htmlLang}"`);

  // Check search placeholder (visible in header)
  const searchPlaceholder = await window.getAttribute('#search-input', 'placeholder');
  console.log(`Search placeholder: ${searchPlaceholder}`);
  if (!searchPlaceholder || !searchPlaceholder.includes('検索')) {
    throw new Error(`Expected Japanese placeholder with "検索", got "${searchPlaceholder}"`);
  }

  // Click on first series to open detail view
  await window.click('#series-grid .series-card');
  await window.waitForSelector('#series-detail:not(.hidden)', { timeout: 5000 });

  // Check detail view elements in Japanese
  const backBtn = await window.textContent('#btn-back');
  console.log(`Back button: ${backBtn}`);
  if (!backBtn || !backBtn.includes('戻る')) {
    throw new Error(`Expected Japanese back button with "戻る", got "${backBtn}"`);
  }

  const favoriteBtnAria = await window.getAttribute('#btn-favorite', 'aria-label');
  console.log(`Favorite button aria-label: ${favoriteBtnAria}`);
  if (!favoriteBtnAria || !favoriteBtnAria.includes('お気に入り')) {
    throw new Error(`Expected Japanese favorite aria-label with "お気に入り", got "${favoriteBtnAria}"`);
  }

  const excerptAria = await window.getAttribute('#detail-excerpt', 'aria-label');
  console.log(`Excerpt aria-label: ${excerptAria}`);
  if (!excerptAria || !excerptAria.includes('抜粋')) {
    throw new Error(`Expected Japanese excerpt aria-label with "抜粋", got "${excerptAria}"`);
  }

  // Open Statistics modal
  await window.click('#btn-stats');
  await window.waitForSelector('#stats-modal:not(.hidden)', { timeout: 5000 });

  const statsTitle = await window.textContent('#stats-title');
  console.log(`Stats title: ${statsTitle}`);
  if (!statsTitle || !statsTitle.includes('統計')) {
    throw new Error(`Expected Japanese stats title "統計", got "${statsTitle}"`);
  }

  const statsCloseAria = await window.getAttribute('#btn-stats-close', 'aria-label');
  console.log(`Stats close aria-label: ${statsCloseAria}`);
  if (!statsCloseAria || !statsCloseAria.includes('閉じる')) {
    throw new Error(`Expected Japanese stats close "閉じる", got "${statsCloseAria}"`);
  }

  // Close stats modal
  await window.click('#btn-stats-close');
  await window.waitForFunction(() => document.getElementById('stats-modal').classList.contains('hidden'), { timeout: 5000 });

  // Open About modal
  await window.click('#btn-about');
  await window.waitForSelector('#about-modal:not(.hidden)', { timeout: 5000 });

  const aboutTitle = await window.textContent('#about-title');
  console.log(`About title: ${aboutTitle}`);
  if (!aboutTitle || !aboutTitle.includes('このアプリについて')) {
    throw new Error(`Expected Japanese about title "このアプリについて", got "${aboutTitle}"`);
  }

  const aboutDesc = await window.textContent('#about-desc');
  console.log(`About desc: ${aboutDesc}`);
  if (!aboutDesc || !aboutDesc.includes('シリーズ別にEPUBライブラリ')) {
    throw new Error(`Expected Japanese about desc with "シリーズ別にEPUBライブラリ", got "${aboutDesc}"`);
  }

  const aboutCloseAria = await window.getAttribute('#btn-about-close', 'aria-label');
  console.log(`About close aria-label: ${aboutCloseAria}`);
  if (!aboutCloseAria || !aboutCloseAria.includes('閉じる')) {
    throw new Error(`Expected Japanese about close "閉じる", got "${aboutCloseAria}"`);
  }

  // Close about modal
  await window.click('#btn-about-close');
  await window.waitForFunction(() => document.getElementById('about-modal').classList.contains('hidden'), { timeout: 5000 });

  // Check theme toggle buttons
  const themeBtnAria = await window.getAttribute('#btn-theme-toggle', 'aria-label');
  console.log(`Theme toggle aria-label: ${themeBtnAria}`);
  if (!themeBtnAria || (!themeBtnAria.includes('ライト') && !themeBtnAria.includes('ダーク'))) {
    throw new Error(`Expected Japanese theme toggle aria-label, got "${themeBtnAria}"`);
  }

  const statsBtnAria = await window.getAttribute('#btn-stats', 'aria-label');
  console.log(`Stats button aria-label: ${statsBtnAria}`);
  if (!statsBtnAria || !statsBtnAria.includes('統計')) {
    throw new Error(`Expected Japanese stats button "統計", got "${statsBtnAria}"`);
  }

  const aboutBtnAria = await window.getAttribute('#btn-about', 'aria-label');
  console.log(`About button aria-label: ${aboutBtnAria}`);
  if (!aboutBtnAria || !aboutBtnAria.includes('このアプリについて')) {
    throw new Error(`Expected Japanese about button "このアプリについて", got "${aboutBtnAria}"`);
  }

  // Take screenshot for visual verification
  await window.screenshot({ path: '/tmp/epubshelf-jp.png', fullPage: true });
  console.log('Screenshot saved to /tmp/epubshelf-jp.png');

  console.log('\n✅ All Japanese locale checks passed!');
  console.log('UI is rendering correctly in Japanese.');

  await app.close();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});