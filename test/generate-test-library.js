const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const root = process.argv[2] || path.join(__dirname, 'test-library');

const series = [
  { name: 'A Guerra dos Tronos', volumes: 3 },
  { name: 'Fundação', volumes: 5 },
  { name: 'Duna', volumes: 2 },
];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Node < 20.12 has no zlib.crc32; the PNG spec needs CRC-32 of the chunk body.
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// A real PNG: signature + IHDR + IDAT (zlib-compressed scanlines, filter byte 0
// per row) + IEND. Writing the signature followed by raw pixels produces a file
// no decoder will read, which is what this fixture used to do.
function makePng(width, height, label) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 4;
      raw[i] = (x * 3) % 256;
      raw[i + 1] = (y * 5) % 256;
      raw[i + 2] = ((x + y) * 7) % 256;
      raw[i + 3] = 255;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
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
