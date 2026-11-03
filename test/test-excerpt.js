/**
 * Excerpt extraction regression test.
 *
 * Covers the bugs that made some volumes show a table of contents, the
 * afterword or chapter 10 instead of the first chapter:
 *  - `.html` files were never read (only `.xhtml`);
 *  - "chapter 1" matched "chapter 10"/"chapter 12" (missing word boundary);
 *  - the ZIP order was used instead of the OPF spine;
 *  - TOC pages named `contents.xhtml` were not recognised.
 *
 * The synthetic fixture always runs. The real `test/test-library` (local-only)
 * is also exercised when present, because that is where the regressions showed.
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractExcerpt } = require('../src/library.js');

const MIN = 80;
const MAX = 1502; // 1500 + "…" is possible
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${detail || ''}`}`);
}

function makeEpub(dir, fileName, docs) {
  const zip = new AdmZip();
  zip.addFile('mimetype', Buffer.from('application/epub+zip'));
  zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`));
  const manifest = docs
    .map((d, i) => `    <item id="d${i}" href="${d.name}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spine = docs.map((_, i) => `    <itemref idref="d${i}"/>`).join('\n');
  zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <manifest>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`));
  for (const d of docs) {
    zip.addFile(`OEBPS/${d.name}`, Buffer.from(d.html));
  }
  const full = path.join(dir, fileName);
  zip.writeZip(full);
  return full;
}

function doc(title, paragraphs, extra = '') {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body>
<h1>${title}</h1>
${paragraphs.map((p) => `<p>${p}</p>`).join('\n')}
${extra}
</body></html>`;
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-excerpt-'));
try {
  // 1. .html-only EPUB: the old code found zero entries and returned null.
  const htmlEpub = makeEpub(dir, 'html-only.epub', [
    { name: 'section-0005.html', html: doc('Prologue', ['A short prologue that should be skipped. '.repeat(4)]) },
    { name: 'section-0006.html', html: doc('Chapter 1: First Blood', ['REAL. This was actually real. '.repeat(10)]) },
  ]);
  const htmlExcerpt = extractExcerpt(htmlEpub);
  check(
    'reads .html documents (not only .xhtml)',
    htmlExcerpt && htmlExcerpt.includes('actually real'),
    JSON.stringify(htmlExcerpt && htmlExcerpt.slice(0, 100))
  );

  // 2. "Chapter 10" must not be mistaken for "Chapter 1". ZIP order is
  //    deliberately scrambled: chapter10 comes first in the archive.
  const boundaryEpub = makeEpub(dir, 'chapter-boundary.epub', [
    { name: 'toc.xhtml', html: doc('Contents', ['Contents', 'Chapter 1', 'Chapter 10']) },
    { name: 'chapter10.xhtml', html: doc('Chapter 10: Later', ['This is chapter ten prose. '.repeat(10)]) },
    { name: 'chapter1.xhtml', html: doc('Chapter 1: The Start', ['This is chapter one prose. '.repeat(10)]) },
  ]);
  const boundaryExcerpt = extractExcerpt(boundaryEpub);
  check(
    'does not match "Chapter 10" as "Chapter 1"',
    boundaryExcerpt && boundaryExcerpt.includes('chapter one') && !boundaryExcerpt.includes('chapter ten'),
    JSON.stringify(boundaryExcerpt && boundaryExcerpt.slice(0, 100))
  );

  // 3. A TOC named contents.xhtml (not toc/nav) must be skipped.
  const tocEpub = makeEpub(dir, 'toc.epub', [
    {
      name: 'contents.xhtml',
      html: `<html><head><title>Contents</title></head><body><p>Table of Contents</p>
<p><a href="c1.xhtml">Chapter 1</a></p><p><a href="c2.xhtml">Chapter 2</a></p>
<p><a href="c3.xhtml">Chapter 3</a></p><p><a href="c4.xhtml">Chapter 4</a></p>
<p><a href="c5.xhtml">Chapter 5</a></p></body></html>`,
    },
    { name: 'chapter1.xhtml', html: doc('Chapter 1: Real', ['Real chapter one text. '.repeat(12)]) },
  ]);
  const tocExcerpt = extractExcerpt(tocEpub);
  check(
    'skips a TOC named contents.xhtml',
    tocExcerpt && tocExcerpt.includes('Real chapter one') && !/table of contents/i.test(tocExcerpt),
    JSON.stringify(tocExcerpt && tocExcerpt.slice(0, 100))
  );

  // 3b. A TOC with a neutral filename (part0001.xhtml) must be caught by its
  //     content — this is the Berserk of Gluttony / Crest of the Stars shape.
  const neutralTocEpub = makeEpub(dir, 'neutral-toc.epub', [
    {
      name: 'part0001.xhtml',
      html: doc('part0001', [
        'Table of Contents',
        'Chapter 1: The Forsaken',
        'Chapter 2: From the Darkness Comes Gluttony',
        'Chapter 3: Skill Study',
      ]),
    },
    { name: 'part0008.xhtml', html: doc('part0008', ['Chapter 1: The Forsaken', 'IN THIS WORLD, there existed levels. '.repeat(10)]) },
  ]);
  const neutralTocExcerpt = extractExcerpt(neutralTocEpub);
  check(
    'skips a TOC inside a neutrally named file',
    neutralTocExcerpt &&
      neutralTocExcerpt.includes('there existed levels') &&
      !neutralTocExcerpt.includes('From the Darkness'),
    JSON.stringify(neutralTocExcerpt && neutralTocExcerpt.slice(0, 100))
  );

  // 4. No explicit chapter 1: prefer story text over the afterword, which the
  //    old ZIP-order fallback could return.
  const fallbackEpub = makeEpub(dir, 'afterword-first.epub', [
    { name: 'afterword.xhtml', html: doc('Afterword', ['Hello, everyone. Rocket Shokai here. '.repeat(8)]) },
    { name: 'section-0009.html', html: doc('Reincarnation', ['Where am I? I opened my eyes. '.repeat(10)]) },
  ]);
  const fallbackExcerpt = extractExcerpt(fallbackEpub);
  check(
    'does not return the afterword when story text exists',
    fallbackExcerpt && fallbackExcerpt.includes('Where am I?') && !fallbackExcerpt.includes('Rocket Shokai'),
    JSON.stringify(fallbackExcerpt && fallbackExcerpt.slice(0, 100))
  );

  // 5. Entities are decoded and the excerpt respects its bounds.
  const entityEpub = makeEpub(dir, 'entities.epub', [
    { name: 'chapter1.xhtml', html: doc('Chapter 1', ['This&#160;is&#160;a&#160;test&amp;more text that repeats. '.repeat(8)]) },
  ]);
  const entityExcerpt = extractExcerpt(entityEpub);
  check(
    'decodes HTML entities and respects 80..1500 bounds',
    entityExcerpt &&
      !/&#|&amp;|&nbsp;/.test(entityExcerpt) &&
      entityExcerpt.length >= MIN &&
      entityExcerpt.length <= MAX,
    JSON.stringify(entityExcerpt && entityExcerpt.slice(0, 100))
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Real local library: only when the known series are present (not the
// regenerated Portuguese fixture, which has no prose).
const REAL_LIBRARY = path.join(__dirname, 'test-library');
const EXPECTED = [
  ['GATE – Thus the JSDF Fought There', 'Youji Itami'],
  ['I Got A Cheat Ability In A Different World, And Become Extraordinary Even In The Real World', 'Having endured the hell'],
  ['Imperial Reincarnation', 'I was currently eating baby food'],
  ['Knight’s & Magic', 'This was a different, unknown world'],
  ["Legend of the Far East's Savior", 'So basically, a kid was forcibly implanted'],
  ['Reborn as a Space Mercenary', 'REAL. This was actually real'],
  ['Sentenced to Be a Hero', 'This is bad'],
  ['The Petty Villain Plays by the Rules', 'Where am I?'],
  ['The Reincarnated Mastermind', 'This young man loved worlds of sword and sorcery'],
];

if (fs.existsSync(REAL_LIBRARY) && EXPECTED.every(([name]) => fs.existsSync(path.join(REAL_LIBRARY, name)))) {
  for (const [series, expectedStart] of EXPECTED) {
    const seriesDir = path.join(REAL_LIBRARY, series);
    const v1 = fs
      .readdirSync(seriesDir)
      .filter((f) => /\.epub$/i.test(f) && /(?:volume|vol\.?|v)\s*0*1(?!\d)/i.test(f))
      .sort()[0];
    const full = v1 && path.join(seriesDir, v1);
    const excerpt = full ? extractExcerpt(full) : null;
    const cleaned = (excerpt || '').replace(/\s+/g, ' ');
    check(
      `real volume 01: ${series}`,
      !!cleaned &&
        cleaned.includes(expectedStart) &&
        !/^(?:table of contents|contents|sum[aá]rio)\b/i.test(cleaned) &&
        cleaned.length >= MIN &&
        cleaned.length <= MAX,
      JSON.stringify(cleaned.slice(0, 120))
    );
  }
} else {
  console.log('SKIP  real test-library not present (local-only) — synthetic fixture only');
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${results.length} excerpt checks failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} excerpt checks passed`);
