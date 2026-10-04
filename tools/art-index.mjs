// Lists every image in art/ in art/index.json, so the service worker can cache them all for offline
// play. Run after adding or removing art:  node tools/art-index.mjs
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = fileURLToPath(new URL('../art', import.meta.url));
const files = [];
const walk = dir => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.png')) files.push(relative(ART, path).split(sep).join('/'));
  }
};
walk(ART);
writeFileSync(join(ART, 'index.json'), `${JSON.stringify({ about: 'Every image the game draws; the service worker caches them for offline play. Made by tools/art-index.mjs.', files }, null, 1)}\n`);
console.log(`art/index.json lists ${files.length} images`);
