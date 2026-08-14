const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Lint check...');

// Check for forbidden modules
const forbidden = ['xml2js'];
const files = [
  path.join(__dirname, '..', 'src', 'library.js'),
  path.join(__dirname, '..', 'src', 'main.js'),
  path.join(__dirname, '..', 'src', 'renderer', 'renderer.js')
];

let passed = true;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const mod of forbidden) {
    if (content.includes(`require('${mod}')`) || content.includes(`require("${mod}")`)) {
      console.error(`❌ Forbidden module '${mod}' found in ${file}`);
      passed = false;
    }
  }
}

if (passed) {
  console.log('All module checks passed');
} else {
  console.error('Some checks failed');
  process.exit(1);
}