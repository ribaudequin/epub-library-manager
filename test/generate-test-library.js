const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const root = process.argv[2] || path.join(__dirname, 'test-library');

const series = [
  { name: 'A Guerra dos Tronos', volumes: 3 },
  { name: 'Fundação', volumes: 5 },
  { name: 'Duna', volumes: 2 },
];

function makePng(width, height, label) {
  const buf = Buffer.alloc(width * height * 4 + 8);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.write('PNG\r\n\x1a\n', 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = 8 + (y * width + x) * 4;
      buf[i] = (x * 3) % 256;
      buf[i + 1] = (y * 5) % 256;
      buf[i + 2] = ((x + y) * 7) % 256;
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function makeEpub(seriesName, volume, filePath) {
  const zip = new AdmZip();
  zip.addFile('mimetype', Buffer.from('application/epub+zip'));
  zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`));
  const coverName = `cover-${volume}.png`;
  zip.addFile(`OEBPS/${coverName}`, makePng(600, 900, `${seriesName} v${volume}`));
  zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${seriesName} — Volume ${volume}</dc:title>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="${coverName}" media-type="image/png"/>
    <item id="chap1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chap1"/>
  </spine>
</package>`));
  zip.addFile('OEBPS/chap1.xhtml', Buffer.from(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cap 1</title></head><body><h1>${seriesName} — Volume ${volume}</h1></body></html>`
  ));
  zip.writeZip(filePath);
}

fs.rmSync(root, { recursive: true, force: true });
for (const s of series) {
  const dir = path.join(root, s.name);
  fs.mkdirSync(dir, { recursive: true });
  for (let v = 1; v <= s.volumes; v++) {
    makeEpub(s.name, v, path.join(dir, `Vol ${v} - ${s.name}.epub`));
  }
}
console.log(`Biblioteca de teste criada em ${root}`);
