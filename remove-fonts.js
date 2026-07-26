const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let c = fs.readFileSync(p, 'utf8');
      const origin = c;
      // remove font-mono
      c = c.replace(/\bfont-mono\b\s*/g, '');
      // remove font-sans
      c = c.replace(/\bfont-sans\b\s*/g, '');
      if (c !== origin) fs.writeFileSync(p, c, 'utf8');
    }
  }
}

walk('app');
walk('components');
console.log('Removed font-mono and font-sans classes');