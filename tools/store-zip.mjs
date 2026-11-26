// The Chrome Web Store upload: the extension folder as the release build left it (RELEASE=1 node build.mjs), with the
// manifest at the zip's root and its "key" taken out, since the store assigns its own ID. The site's zip keeps the key,
// so a hand install keeps the developer build's ID. Writes tools/out/spare-key-store.zip.
//   RELEASE=1 node build.mjs && node tools/store-zip.mjs
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipDir } from './zip.mjs';

const OUT = path.resolve('tools/out/spare-key-store.zip');
const dir = mkdtempSync(path.join(tmpdir(), 'sk-store-'));
try {
  cpSync('extension', dir, { recursive: true, filter: src => !src.endsWith('appcheck-debug.local.js') });
  const mf = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(mf, 'utf8'));
  delete manifest.key;
  writeFileSync(mf, JSON.stringify(manifest, null, 2));
  // Nothing in the package may hold an App Check debug token.
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const leak = walk(dir).filter(f => /APPCHECK_DEBUG_TOKEN\s*=\s*'[0-9a-fA-F-]{20,}'/.test(readFileSync(f, 'latin1')));
  if (leak.length) throw new Error(`a debug token is in ${leak.join(', ')}`);
  rmSync(OUT, { force: true });
  const files = await zipDir(dir, OUT);
  console.log(`Wrote ${OUT}: ${files.length} files, manifest ${manifest.version}, no key, no debug token`);
} finally { rmSync(dir, { recursive: true, force: true }); }
