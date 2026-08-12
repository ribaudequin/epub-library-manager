const fs = require('fs');

const checks = [
  { file: 'src/library.js', mustNotContain: ['xml2js', 'parseStringPromise'] },
  { file: 'src/main.js', mustNotContain: ['xml2js', 'AdmZip', 'parseStringPromise'] },
];

let failures = 0;
for (const c of checks) {
  if (!fs.existsSync(c.file)) {
    console.error('MISSING:', c.file);
    failures++;
    continue;
  }
  const content = fs.readFileSync(c.file, 'utf8');
  for (const bad of c.mustNotContain || []) {
    if (content.includes(bad)) {
      console.error(`ERROR: ${c.file} contains forbidden "${bad}"`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('All module checks passed');
