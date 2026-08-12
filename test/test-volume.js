const fs = require('fs');
const { scanVolume } = require('../src/library');
const dir = '/tmp/opencode/ccZ' + Math.random().toString(36).slice(2);
fs.mkdirSync(dir, { recursive: true });
const f = process.argv[2];
(async () => {
  try {
    const v = await scanVolume(f, dir);
    console.log('file:', f.split('/').slice(-2).join('/'));
    console.log('result:', v.title, '| cover:', v.coverSrc ? 'OK (' + fs.statSync(v.coverSrc).size + ' bytes)' : 'SEM');
  } catch(e) { console.log('ERRO:', e.message); }
})();
