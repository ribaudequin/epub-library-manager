const path = require('path');
const fsp = require('fs/promises');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { DOMParser } = require('@xmldom/xmldom');
const { Jimp } = require('jimp');

const coverCache = new Map();
const COVER_CACHE_MAX = 50;

function cacheCoverGet(key) {
  if (coverCache.has(key)) {
    const value = coverCache.get(key);
    coverCache.delete(key);
    coverCache.set(key, value);
    return value;
  }
  return undefined;
}

function cacheCoverSet(key, value) {
  if (coverCache.has(key)) coverCache.delete(key);
  coverCache.set(key, value);
  if (coverCache.size > COVER_CACHE_MAX) {
    const oldest = coverCache.keys().next().value;
    coverCache.delete(oldest);
  }
}

function safeId(name) {
  return crypto.createHash('sha1').update(name).digest('hex').slice(0, 12);
}

function extractNumber(name) {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function safeDecode(href) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function resolveInOpf(opfPath, href) {
  const opfDir = path.posix.dirname(opfPath || '');
  return path.posix.normalize(path.posix.join(opfDir, href)).replace(/^\/+/, '');
}

function parseXml(xml) {
  if (/^\uFEFF/.test(xml)) xml = xml.slice(1);
  return new DOMParser().parseFromString(xml, 'text/xml');
}

function getMetadataText(doc, selector) {
  const nodes = doc.getElementsByTagName(selector);
  if (nodes.length > 0) return nodes[0].textContent.trim();
  return '';
}

function getCoverFromMeta(doc) {
  const metas = doc.getElementsByTagName('meta');
  for (let i = 0; i < metas.length; i++) {
    const name = (metas[i].getAttribute('name') || '').toLowerCase();
    const prop = (metas[i].getAttribute('property') || '').toLowerCase();
    if (name === 'cover') {
      return metas[i].getAttribute('content');
    }
    if (prop === 'cover') {
      return metas[i].getAttribute('content') || metas[i].getAttribute('id');
    }
  }
  return null;
}

function getItems(doc) {
  return Array.from(doc.getElementsByTagName('item')).map((it) => ({
    id: it.getAttribute('id'),
    href: it.getAttribute('href'),
    mediaType: it.getAttribute('media-type'),
    properties: it.getAttribute('properties'),
  }));
}

function findCoverHref(doc, items, zip, opfPath) {
  let coverId = getCoverFromMeta(doc);
  if (coverId) {
    let item = items.find((i) => i.id === coverId);
    if (!item) {
      item = items.find(
        (i) => i.href && (i.href.includes(coverId) || coverId.includes(i.id || ''))
      );
    }
    if (item && item.href) return item.href;
  }

  const propItem = items.find((i) =>
    (i.properties || '').toLowerCase().includes('cover-image')
  );
  if (propItem && propItem.href) return propItem.href;

  const named = items.find((i) => {
    if (!(i.mediaType || '').toLowerCase().startsWith('image/')) return false;
    const id = (i.id || '').toLowerCase();
    const href = safeDecode(i.href || '').toLowerCase();
    return id.includes('cover') || href.includes('cover') || href.includes('front');
  });
  if (named && named.href) return named.href;

  const spine = doc.getElementsByTagName('itemref');
  for (let i = 0; i < spine.length; i++) {
    const idref = spine[i].getAttribute('idref') || '';
    if (/cover|title/i.test(idref)) {
      const item = items.find((i) => i.id === idref);
      if (item && item.href) {
        const src = findImageSrcInXhtml(zip, opfPath, item.href);
        if (src) return src;
      }
    }
  }

  const imgItems = items
    .filter((i) => (i.mediaType || '').toLowerCase().startsWith('image/'))
    .map((i) => ({ href: safeDecode(i.href || ''), item: i }));
  if (imgItems.length > 0) {
    let best = null;
    let bestSize = -1;
    for (const { href } of imgItems) {
      const resolved = resolveInOpf(opfPath, href);
      const entry = zip.getEntry(resolved);
      if (entry && entry.header && entry.header.size > bestSize) {
        bestSize = entry.header.size;
        best = href;
      }
    }
    if (best) return best;
  }

  return null;
}

function findImageSrcInXhtml(zip, opfPath, xhtmlHref) {
  let content;
  try {
    content = zip.readAsText(resolveInOpf(opfPath, xhtmlHref));
  } catch {
    return null;
  }
  const imgMatches = content.match(/<img[^>]*src\s*=\s*["']([^"']+)["']/gi) || [];
  for (const m of imgMatches) {
    const src = (m.match(/src\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!src) continue;
    const resolved = safeDecode(src);
    const entry = zip.getEntry(resolved) ||
      zip.getEntries().find((e) => !e.isDirectory && e.entryName === resolved);
    if (entry) return resolved;
  }
  return null;
}

function pickCoverFromZip(zip) {
  const imageEntries = zip.getEntries().filter(
    (e) => !e.isDirectory && /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(e.entryName)
  );
  if (imageEntries.length === 0) return null;
  const priority = (name) => {
    const n = name.toLowerCase();
    if (/cover|front/.test(n)) return 0;
    if (/^\/?978|isbn/.test(n)) return 1;
    return 2;
  };
  imageEntries.sort((a, b) => {
    const pa = priority(a.entryName);
    const pb = priority(b.entryName);
    if (pa !== pb) return pa - pb;
    return (b.header?.size || 0) - (a.header?.size || 0);
  });
  return imageEntries[0].entryName;
}

function extractCover(zip, opfPath, coverHref) {
  if (!coverHref) return null;
  const fullPath = resolveInOpf(opfPath, safeDecode(coverHref));
  const entry = zip.getEntry(fullPath) || zip.getEntries().find(
    (e) => !e.isDirectory && e.entryName.replace(/^\/+/, '') === fullPath
  );
  if (!entry) return null;
  const data = entry.getData();
  if (!data || data.length === 0) return null;
  return data;
}

function extractCoverFromName(zip, href) {
  const fullPath = href.replace(/^\/+/, '');
  const entry = zip.getEntry(fullPath) || zip.getEntries().find(
    (e) => !e.isDirectory && e.entryName.replace(/^\/+/, '') === fullPath
  );
  if (!entry) return null;
  const data = entry.getData();
  if (!data || data.length === 0) return null;
  return data;
}

async function parseOpf(zip, opfPath) {
  const xml = zip.readAsText(opfPath);
  const doc = parseXml(xml);
  const title = getMetadataText(doc, 'dc:title') || getMetadataText(doc, 'title');
  const author = getMetadataText(doc, 'dc:creator') || getMetadataText(doc, 'creator');
  const items = getItems(doc);
  const coverHref = findCoverHref(doc, items, zip, opfPath);
  return { title, author, coverHref };
}

async function scanVolume(filePath, coverCacheDir) {
  const stat = await fsp.stat(filePath);
  const id = safeId(filePath);
  const name = path.basename(filePath, '.epub');
  const coverFile = path.join(coverCacheDir, id + '.jpg');

  let title = name;
  let author = null;
  let coverSrc = null;

  try {
    // Disk cache: reuse existing cover if newer than the epub AND valid image
    try {
      const coverStat = await fsp.stat(coverFile);
      if (coverStat.mtimeMs >= stat.mtimeMs) {
        const cached = await fsp.readFile(coverFile);
        if (IMAGE_MIME_RE.test(getMimeType(cached))) {
          coverSrc = coverFile;
        }
      }
    } catch {}

    if (!coverSrc) {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      const zipObj = {
        getEntries: () => entries,
        getEntry: (name) => entries.find(e => e.entryName === name),
        readAsText: (name) => zip.readAsText(name),
      };
      const opfEntry = entries.find(e => !e.isDirectory && /\.opf$/i.test(e.entryName));
      const opfPath = opfEntry ? opfEntry.entryName : null;
      if (opfPath) {
        try {
          const { title: t, author: a } = await parseOpf(zip, opfPath);
          if (t) title = t;
          if (a) author = a;
        } catch {}
      }
      const data = extractCoverData(zip, entries, zipObj, opfPath);
      if (data) {
        const img = await Jimp.read(data);
        img.resize({ w: 600 });
        const compressed = await img.getBuffer('image/jpeg', { quality: 80 });
        await fsp.writeFile(coverFile, compressed);
        coverSrc = coverFile;
      }
    }
  } catch {
    // ficheiro epub invalido; usa apenas o nome do ficheiro
  }

  return {
    id,
    filePath,
    name,
    title,
    author,
    mtime: stat.mtimeMs,
    coverSrc,
  };
}

async function scanLibrary(rootPath, coverCacheDir, onProgress) {
  const seriesDirs = (await fsp.readdir(rootPath, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(naturalSort);

  const allSeries = [];
  let totalVolumes = 0;
  for (const dirName of seriesDirs) {
    const dirPath = path.join(rootPath, dirName);
    const epubFiles = (await fsp.readdir(dirPath, { withFileTypes: true }))
      .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.epub'))
      .map((f) => path.join(dirPath, f.name))
      .sort(naturalSort);
    if (epubFiles.length === 0) continue;
    allSeries.push({ dirPath, dirName, epubFiles });
    totalVolumes += epubFiles.length;
  }

  if (onProgress) onProgress({ done: 0, total: totalVolumes });

  const seriesList = [];
  let processed = 0;
  for (const { dirPath, dirName, epubFiles } of allSeries) {
    const volumes = [];
    for (const filePath of epubFiles) {
      const volume = await scanVolume(filePath, coverCacheDir);
      volumes.push(volume);
      processed++;
      if (volume.coverSrc) {
        if (onProgress) onProgress({ done: processed, total: totalVolumes, coverSrc: volume.coverSrc });
      } else if (onProgress && processed % 5 === 0) {
        onProgress({ done: processed, total: totalVolumes });
      }
      if (volumes.length % 20 === 0) {
        await new Promise((r) => setImmediate(r));
      }
    }
    volumes.sort((a, b) => extractNumber(a.name) - extractNumber(b.name));

    seriesList.push({
      id: safeId(dirPath),
      name: dirName,
      path: dirPath,
      volumeCount: volumes.length,
      author: volumes[0]?.author || null,
      lastModified: Math.max(...volumes
        .map((v) => v.mtime)
        .filter((t) => t <= Date.now())),
      cover: volumes[0].coverSrc,
      volumes,
    });
  }

  if (onProgress) onProgress({ done: totalVolumes, total: totalVolumes });

  return seriesList;
}

module.exports = {
  safeId,
  naturalSort,
  extractNumber,
  scanLibrary,
  scanVolume,
  getVolumeCoverSync,
  getVolumeCoverPath,
  extractVolumeCover,
  getMimeType,
  extractExcerpt,
};


// Synchronous EPUB cover extraction
async function getVolumeCoverSync(volumePath) {
  const coverPath = getVolumeCoverPath(volumePath);
  try {
    await fsp.access(coverPath);
    return coverPath;
  } catch {}
  const cover = await extractVolumeCover(volumePath);
  if (cover) return cover;
  return null;
}

function getVolumeCoverPath(volumePath) {
  const dir = path.dirname(volumePath);
  const base = path.basename(volumePath, '.epub');
  return path.join(dir, base + '.cover.jpg');
}

const IMAGE_MIME_RE = /^image\/(jpeg|png|gif|webp|svg\+xml|avif)/i;

function extractCoverData(zip, entries, zipObj, opfPath) {
  let coverData = null;
  if (opfPath) {
    const opfStr = zip.readAsText(opfPath);
    const doc = parseXml(opfStr);
    const items = getItems(doc);
    const coverHref = findCoverHref(doc, items, zipObj, opfPath);
    if (coverHref) {
      coverData = extractCover(zip, opfPath, coverHref);
      if (coverData && !IMAGE_MIME_RE.test(getMimeType(coverData))) {
        coverData = null;
      }
    }
  }
  // Fallback 1: Try extracting <img> src from XHTML cover
  if (!coverData) {
    const xhtmlEntry = entries.find(e => !e.isDirectory && /\.xhtml?$/i.test(e.entryName) && /cover/i.test(e.entryName));
    const xhtmlPath = xhtmlEntry ? xhtmlEntry.entryName : null;
    if (xhtmlPath) {
      const imgSrc = findImageSrcInXhtml(zipObj, opfPath, xhtmlPath);
      if (imgSrc) {
        coverData = extractCoverFromName(zipObj, imgSrc);
      }
    }
  }
  // Fallback 2: Pick largest image from zip
  if (!coverData) {
    const picked = pickCoverFromZip(zipObj);
    if (picked) coverData = extractCoverFromName(zipObj, picked);
  }
  // Final validation
  if (coverData && !IMAGE_MIME_RE.test(getMimeType(coverData))) {
    return null;
  }
  return coverData;
}

async function extractVolumeCover(volumePath) {
  const cacheKey = 'cover:' + volumePath;
  const cached = cacheCoverGet(cacheKey);
  if (cached) return cached;
  const dataBuf = await fsp.readFile(volumePath);
  const zip = new AdmZip(dataBuf);
  const entries = zip.getEntries();
  const zipObj = {
    getEntries: () => entries,
    getEntry: (name) => entries.find(e => e.entryName === name),
    readAsText: (name) => zip.readAsText(name),
  };
  const opfEntry = entries.find(e => !e.isDirectory && /\.opf$/i.test(e.entryName));
  const opfPath = opfEntry ? opfEntry.entryName : null;
  const coverData = extractCoverData(zip, entries, zipObj, opfPath);
  if (!coverData) {
    cacheCoverSet(cacheKey, null);
    return null;
  }
  const coverPath = getVolumeCoverPath(volumePath);
  await fsp.writeFile(coverPath, coverData);
  cacheCoverSet(cacheKey, coverPath);
  return coverPath;
};

const TEXT_DOC_RE = /\.(?:xhtml|html|xht|htm)$/i;
// Nomes de front/back matter que nunca são capítulo 1. "afterword" fica de
// fora de propósito: é o último recurso quando o volume não tem prosa de
// abertura (as notas do autor são aceitáveis como excerto).
const FRONT_MATTER_RE = /cover|toc|nav|contents|title[ _-]?page|copyright|colophon|newsletter|signup|sign-up|jnovels|about[ _-]?the[ _-]?author|back[ _-]?matter|front[ _-]?matter|footnotes?|acknowledg/i;
const AFTERWORD_RE = /afterword|author'?s?[ _-]?note|nota[s]?[ _-]?do[ _-]?autor/i;
const PROLOGUE_RE = /\bprologue\b|\bpr[oó]logo\b/i;
// O `(?!\d)` é essencial: sem ele "chapter 1" casa com "chapter 12" e "chapter 10".
const CHAPTER_ONE_RE = /(?:^|[^a-z0-9])(?:chapter|cap[ií]tulo|cap\.|c\.)\s*0*1(?!\d)/i;
const CHAPTER_ONE_PREFIX_RE = /^(?:part\s*\d+\s*[:\-–—]?\s*)?(?:chapter|cap[ií]tulo|cap\.|c\.)\s*0*1\b[\s:–—-]*/i;

function decodeHtmlEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rdquo;/gi, '”')
    .replace(/&ldquo;/gi, '“')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

// Tags inline são removidas sem espaço (senão os drop-caps partem-se: "Y ouji").
function stripTags(html) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function getTitleText(xml) {
  const m = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

function getHeadingText(xml) {
  const m = xml.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i);
  return m ? stripTags(m[1]) : '';
}

function getParagraphChunks(xml) {
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const pMatches = body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
  let chunks = pMatches
    .map((m) => stripTags(m.replace(/<br\s*\/?>/gi, ' ')))
    .filter((t) => t.length > 0);
  if (chunks.length === 0) {
    const whole = stripTags(
      body
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|h[1-6]|li|tr|section|blockquote|figure|table)>/gi, ' ')
    );
    if (whole) chunks = [whole];
  }
  return chunks;
}

// TOC disfarçado de capítulo: nav semântico, título "Contents" ou uma página
// curta feita sobretudo de links.
function isTocDocument(xml, title, text, linkCount) {
  if (/^\s*(?:table\s+of\s+contents|contents|sum[aá]rio)\b/i.test(title)) return true;
  if (/^\s*(?:table\s+of\s+contents|contents|sum[aá]rio)\b/i.test(text)) return true;
  if (/epub:type\s*=\s*["'][^"']*\btoc\b/i.test(xml)) return true;
  if (/role\s*=\s*["']doc-toc["']/i.test(xml)) return true;
  if (linkCount >= 5 && linkCount * 25 > text.length) return true;
  return false;
}

// Ordem de leitura da spine do OPF. Sem isto, a ordem é a do ZIP, que pode
// começar pelo afterword ou pelo capítulo 10.
function getReadingOrder(zip, entries) {
  const byPath = new Map();
  for (const e of entries) {
    if (!e.isDirectory) byPath.set(e.entryName.replace(/^\/+/, ''), e);
  }
  const opfEntry = entries.find((e) => !e.isDirectory && /\.opf$/i.test(e.entryName));
  const ordered = [];
  if (opfEntry) {
    try {
      const doc = parseXml(zip.readAsText(opfEntry.entryName));
      const hrefById = new Map(getItems(doc).map((i) => [i.id, i.href]));
      const refs = doc.getElementsByTagName('itemref');
      for (let i = 0; i < refs.length; i++) {
        const href = hrefById.get(refs[i].getAttribute('idref'));
        if (!href) continue;
        const full = resolveInOpf(opfEntry.entryName, safeDecode(href)).replace(/^\/+/, '');
        const entry = byPath.get(full);
        if (entry && !ordered.some((e) => e.entryName === entry.entryName)) {
          ordered.push(entry);
        }
      }
    } catch {}
  }
  if (ordered.length === 0) {
    entries
      .filter((e) => !e.isDirectory && TEXT_DOC_RE.test(e.entryName))
      .sort((a, b) => naturalSort(a.entryName, b.entryName))
      .forEach((e) => ordered.push(e));
  }
  return ordered;
}

function extractExcerpt(filePath) {
  const maxLen = 1500;
  const minChars = 80;
  try {
    const zip = new AdmZip(fs.readFileSync(filePath));
    const entries = zip.getEntries();
    const readEntry = (name) => {
      const tries = [name, name.replace(/^\/+/, ''), '/' + name];
      for (const n of tries) {
        try {
          const xml = zip.readAsText(n);
          if (xml) return xml;
        } catch {}
      }
      return null;
    };

    const candidates = [];
    const seen = new Set();
    for (const entry of getReadingOrder(zip, entries)) {
      const entryName = entry.entryName.replace(/^\/+/, '');
      if (seen.has(entryName)) continue;
      seen.add(entryName);
      if (entry.isDirectory || !TEXT_DOC_RE.test(entryName)) continue;
      const xml = readEntry(entryName);
      if (!xml) continue;
      const base = entryName.toLowerCase();
      if (FRONT_MATTER_RE.test(base)) continue;

      const title = getTitleText(xml);
      const heading = getHeadingText(xml);
      const chunks = getParagraphChunks(xml);
      if (chunks.length === 0) continue;
      const text = chunks.join(' ').replace(/\s+/g, ' ').trim();
      if (text.length < minChars) continue;
      const linkCount = (xml.match(/<a\b/gi) || []).length;
      if (isTocDocument(xml, title, text, linkCount)) continue;

      const probe = [base, title, heading, text.slice(0, 200)].join('\n');
      candidates.push({
        chunks,
        afterword: AFTERWORD_RE.test(base) || AFTERWORD_RE.test(title),
        prologue: PROLOGUE_RE.test(base) || PROLOGUE_RE.test(title),
        // Um cabeçalho explícito ("Chapter 1") vale mais do que o nome do
        // ficheiro: há volumes com "chapter1.xhtml" a conter a introdução e
        // o capítulo 1 real em "chapter3.xhtml".
        titleChapterOne: CHAPTER_ONE_RE.test([title, heading, text.slice(0, 200)].join('\n')),
        fileChapterOne: CHAPTER_ONE_RE.test(base),
      });
    }

    const content = candidates.filter((c) => !c.afterword);
    const chosen =
      content.find((c) => c.titleChapterOne) ||
      content.find((c) => c.fileChapterOne) ||
      content.find((c) => !c.prologue) ||
      content.find((c) => c.prologue) ||
      candidates.find((c) => c.afterword) ||
      null;
    if (!chosen) return null;

    const chunks = chosen.chunks.slice();
    const isChapterOne = chosen.titleChapterOne || chosen.fileChapterOne;
    if (
      chunks.length > 1 &&
      chunks[0].length <= 120 &&
      (CHAPTER_ONE_RE.test(chunks[0]) || /^(?:part|chapter|cap[ií]tulo)\b/i.test(chunks[0]))
    ) {
      chunks.shift();
    }

    let text = chunks.join(' ').replace(/\s+/g, ' ').trim();
    if (isChapterOne) {
      text = text.replace(CHAPTER_ONE_PREFIX_RE, '').trim();
    }
    if (!text || /^(?:table\s+of\s+contents|contents|sum[aá]rio)\b/i.test(text)) return null;

    if (text.length > maxLen) {
      text = text.slice(0, maxLen).trim();
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace > maxLen * 0.7) text = text.slice(0, lastSpace) + '…';
      else text = text + '…';
    }
    return text.length >= minChars ? text : null;
  } catch {
    return null;
  }
}

function getMimeType(buffer) {
  if (!buffer || buffer.length < 4) return '';
  const head = buffer.slice(0, 12);
  const hex = head.toString('hex');
  if (hex.startsWith('ffd8')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('89415745')) return 'image/webp';
  if (hex.startsWith('3031')) return 'image/svg+xml';
  if (hex.startsWith('000001')) return 'image/avif';
  return '';
}
