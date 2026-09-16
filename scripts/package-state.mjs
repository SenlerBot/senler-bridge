import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
function fingerprint(entries, skip = new Set()) {
  const hash = createHash('sha256');
  const visit = (relative) => {
    if (skip.has(relative)) return;
    const absolute = path.join(root, relative);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Package sources must not contain symlinks: ${relative}`);
    hash.update(`${stat.isDirectory() ? 'D' : 'F'}:${relative}\0`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute).sort()) visit(`${relative}/${entry}`);
    } else hash.update(readFileSync(absolute));
  };
  for (const entry of [...entries].sort()) visit(entry);
  return hash.digest('hex');
}
const state = {
  source: fingerprint(['src', 'scripts', 'test', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'LICENSE']),
  dist: fingerprint(['dist'], new Set(['dist/.source-hash'])),
};
const file = path.join(root, 'dist/.source-hash');
if (process.argv.includes('--write')) {
  writeFileSync(file, `${JSON.stringify(state)}\n`);
} else {
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  if (saved.source !== state.source || saved.dist !== state.dist) {
    throw new Error('Package sources or dist changed after verification. Run npm run build before publication.');
  }
  console.log('Verified package sources and dist match the tested build.');
}
