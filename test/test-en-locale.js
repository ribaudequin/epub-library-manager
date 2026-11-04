/**
 * English Locale Visual Test — launches Electron with FORCE_LOCALE=en-GB
 * and verifies UI renders in English
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

  const ud = path.join(__dirname, 'ud-test-en');
  if (fs.existsSync(ud)) fs.rmSync(ud, { recursive: true, force: true });
  fs.mkdirSync(ud, { recursive: true });

  // Launch Electron with English locale via --lang flag
  const env = {
    ...process.env,
    TEST_USERDATA: ud,
    TEST_ROOT: TEST_LIBRARY
  };

  console.log('Launching Electron with --lang=en-GB...');
  const app = await electron.launch({ args: [MAIN_JS, '--lang=en-GB'], env });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForSelector('#series-grid .series-card', { timeout: 15000 });

  console.log('App launched. Checking English locale...');

  // Check html lang attribute
  const htmlLang = await window.getAttribute('html', 'lang');
  console.log(`html lang: ${htmlLang}`);
  if (htmlLang !== 'en') throw new Error(`Expected html lang="en", got "${htmlLang}"`);

  // Check search placeholder (visible in header)
  const searchPlaceholder = await window.getAttribute('#search-input', 'placeholder');
  console.log(`Search placeholder: ${searchPlaceholder}`);
  if (!searchPlaceholder || !searchPlaceholder.includes('Search')) {
    throw new Error(`Expected English placeholder with "Search", got "${searchPlaceholder}"`);
  }

  // Click on first series to open detail view
  await window.click('#series-grid .series-card');
  await window.waitForSelector('#series-detail:not(.hidden)', { timeout: 5000 });

  // Check detail view elements in English
  const backBtn = await window.textContent('#btn-back');
  console.log(`Back button: ${backBtn}`);
  if (!backBtn || !backBtn.includes('Back to series')) {
    throw new Error(`Expected English back button with "Back to series", got "${backBtn}"`);
  }

  const favoriteBtnAria = await window.getAttribute('#btn-favorite', 'aria-label');
  console.log(`Favorite button aria-label: ${favoriteBtnAria}`);
  if (!favoriteBtnAria || !favoriteBtnAria.includes('Favorite')) {
    throw new Error(`Expected English favorite aria-label with "Favorite", got "${favoriteBtnAria}"`);
  }

  const excerptAria = await window.getAttribute('#detail-excerpt', 'aria-label');
  console.log(`Excerpt aria-label: ${excerptAria}`);
  if (!excerptAria || !excerptAria.includes('First chapter excerpt')) {
    throw new Error(`Expected English excerpt aria-label with "First chapter excerpt", got "${excerptAria}"`);
  }

  // Open Statistics modal
  await window.click('#btn-stats');
  await window.waitForSelector('#stats-modal:not(.hidden)', { timeout: 5000 });

  const statsTitle = await window.textContent('#stats-title');
  console.log(`Stats title: ${statsTitle}`);
  if (!statsTitle || !statsTitle.includes('Statistics')) {
    throw new Error(`Expected English stats title "Statistics", got "${statsTitle}"`);
  }

  const statsCloseAria = await window.getAttribute('#btn-stats-close', 'aria-label');
  console.log(`Stats close aria-label: ${statsCloseAria}`);
  if (!statsCloseAria || !statsCloseAria.includes('Close')) {
    throw new Error(`Expected English stats close "Close", got "${statsCloseAria}"`);
  }

  // Close stats modal
  await window.click('#btn-stats-close');
  await window.waitForFunction(() => document.getElementById('stats-modal').classList.contains('hidden'), { timeout: 5000 });

  // Open About modal
  await window.click('#btn-about');
  await window.waitForSelector('#about-modal:not(.hidden)', { timeout: 5000 });

  const aboutTitle = await window.textContent('#about-title');
  console.log(`About title: ${aboutTitle}`);
  if (!aboutTitle || !aboutTitle.includes('About')) {
    throw new Error(`Expected English about title "About", got "${aboutTitle}"`);
  }

  const aboutDesc = await window.textContent('#about-desc');
  console.log(`About desc: ${aboutDesc}`);
  if (!aboutDesc || !aboutDesc.includes('EPUB library manager')) {
    throw new Error(`Expected English about desc with "EPUB library manager", got "${aboutDesc}"`);
  }

  const aboutCloseAria = await window.getAttribute('#btn-about-close', 'aria-label');
  console.log(`About close aria-label: ${aboutCloseAria}`);
  if (!aboutCloseAria || !aboutCloseAria.includes('Close')) {
    throw new Error(`Expected English about close "Close", got "${aboutCloseAria}"`);
  }

  // Close about modal
  await window.click('#btn-about-close');
  await window.waitForFunction(() => document.getElementById('about-modal').classList.contains('hidden'), { timeout: 5000 });

  // Check theme toggle buttons
  const themeBtnAria = await window.getAttribute('#btn-theme-toggle', 'aria-label');
  console.log(`Theme toggle aria-label: ${themeBtnAria}`);
  if (!themeBtnAria || (!themeBtnAria.includes('light') && !themeBtnAria.includes('dark'))) {
    throw new Error(`Expected English theme toggle aria-label, got "${themeBtnAria}"`);
  }

  const statsBtnAria = await window.getAttribute('#btn-stats', 'aria-label');
  console.log(`Stats button aria-label: ${statsBtnAria}`);
  if (!statsBtnAria || !statsBtnAria.includes('Statistics')) {
    throw new Error(`Expected English stats button "Statistics", got "${statsBtnAria}"`);
  }

  const aboutBtnAria = await window.getAttribute('#btn-about', 'aria-label');
  console.log(`About button aria-label: ${aboutBtnAria}`);
  if (!aboutBtnAria || !aboutBtnAria.includes('About')) {
    throw new Error(`Expected English about button "About", got "${aboutBtnAria}"`);
  }

  // Take screenshot for visual verification
  await window.screenshot({ path: '/tmp/epubshelf-en.png', fullPage: true });
  console.log('Screenshot saved to /tmp/epubshelf-en.png');

  console.log('\n✅ All English locale checks passed!');
  console.log('UI is rendering correctly in English.');

  await app.close();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});