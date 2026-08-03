const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLISH = path.join(ROOT, 'publish');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log('Building Next.js...');
execSync('npx next build --webpack', { cwd: ROOT, stdio: 'inherit' });

if (fs.existsSync(PUBLISH)) {
  console.log('Cleaning publish/...');
  fs.rmSync(PUBLISH, { recursive: true, force: true });
}

console.log('Creating publish/...');
fs.mkdirSync(PUBLISH, { recursive: true });

console.log('Copying start files...');
fs.copyFileSync(path.join(ROOT, 'start.js'), path.join(PUBLISH, 'start.js'));
fs.copyFileSync(path.join(ROOT, 'start.bat'), path.join(PUBLISH, 'start.bat'));

console.log('Copying .next/...');
copyDir(path.join(ROOT, '.next'), path.join(PUBLISH, '.next'));

if (fs.existsSync(path.join(ROOT, 'public'))) {
  console.log('Copying public/...');
  copyDir(path.join(ROOT, 'public'), path.join(PUBLISH, 'public'));
}

if (fs.existsSync(path.join(ROOT, '.env.local'))) {
  fs.copyFileSync(path.join(ROOT, '.env.local'), path.join(PUBLISH, '.env.local'));
}

fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(PUBLISH, 'package.json'));

console.log('Copying node_modules/...');
execSync(`xcopy "${path.join(ROOT, 'node_modules')}" "${path.join(PUBLISH, 'node_modules')}" /E /I /Q /Y`, { stdio: 'inherit' });

console.log('\nDone! publish/start.bat');
