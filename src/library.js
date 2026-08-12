const path = require('path');
const fsp = require('fs/promises');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { DOMParser } = require('@xmldom/xmldom');

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

async function findOpfPath(zip) {
  try {
    const container = zip.readAsText('META-INF/container.xml');
    const doc = parseXml(container);
    const rf = doc.getElementsByTagName('rootfile');
    if (rf.length > 0) {
      return rf[0].getAttribute('full-path');
    }
  } catch {}
  const opf = zip.getEntries().find(
    (e) => !e.isDirectory && /\.opf$/i.test(e.entryName)
  );
  return opf ? opf.entryName : null;
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
  const items = getItems(doc);
  const coverHref = findCoverHref(doc, items, zip, opfPath);
  return { title, coverHref };
}

async function scanVolume(filePath, coverCacheDir) {
  const stat = await fsp.stat(filePath);
  const id = safeId(filePath);
  const name = path.basename(filePath, '.epub');
  const coverFile = path.join(coverCacheDir, id + '.img');

  let title = name;
  let coverSrc = null;

  try {
    const zip = new AdmZip(filePath);
    const opfPath = await findOpfPath(zip);
    let coverHref = null;
    if (opfPath) {
      try {
        const { title: t, coverHref: ch } = await parseOpf(zip, opfPath);
        if (t) title = t;
        coverHref = ch;
      } catch {}
    }
    let data = null;
    if (coverHref) {
      data = extractCover(zip, opfPath || '', coverHref);
    }
    if (!data) {
      const picked = pickCoverFromZip(zip);
      if (picked) {
        data = extractCoverFromName(zip, picked);
      }
    }
    if (data) {
      await fsp.writeFile(coverFile, data);
      coverSrc = coverFile;
    }
  } catch {
    // ficheiro epub invalido; usa apenas o nome do ficheiro
  }

  return {
    id,
    filePath,
    name,
    title,
    mtime: stat.mtimeMs,
    coverSrc,
  };
}

async function scanLibrary(rootPath, coverCacheDir) {
  const seriesDirs = (await fsp.readdir(rootPath, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(naturalSort);

  const seriesList = [];
  for (const dirName of seriesDirs) {
    const dirPath = path.join(rootPath, dirName);
    const epubFiles = (await fsp.readdir(dirPath, { withFileTypes: true }))
      .filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.epub'))
      .map((f) => path.join(dirPath, f.name))
      .sort(naturalSort);

    if (epubFiles.length === 0) continue;

    const volumes = [];
    for (const filePath of epubFiles) {
      volumes.push(await scanVolume(filePath, coverCacheDir));
    }
    volumes.sort((a, b) => extractNumber(a.name) - extractNumber(b.name));

    seriesList.push({
      id: safeId(dirPath),
      name: dirName,
      path: dirPath,
      volumeCount: volumes.length,
      cover: volumes[0].coverSrc,
      volumes,
    });
  }

  return seriesList;
}

module.exports = {
  safeId,
  naturalSort,
  extractNumber,
  scanLibrary,
  scanVolume,
};
