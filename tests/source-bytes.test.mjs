// No source file holds a control character. A shell heredoc once turned "\b" into a backspace byte inside two regexes
// (shared/phone.js: "kids" never matched an app name; AppModel.kt: an error code never matched), and the code still ran.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['shared', 'extension/src', 'web/src', 'tools', 'tests', 'data', 'android/app/src/main/java', 'android/app/src/main/res'];
const KEEP = /\.(m?js|kt|kts|json|css|html|xml|md)$/;
const files = [];
const walk = d => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) { if (n !== 'out' && n !== 'node_modules') walk(p); } else if (KEEP.test(n)) files.push(p); } };
for (const r of ROOTS) { try { walk(r); } catch { /* a root that is not there */ } }

test('no source file holds a control character (tab, newline and carriage return aside)', () => {
  assert.ok(files.length > 50, `${files.length} files`);
  const bad = files.filter(f => /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});

test('the app-name check catches "kids" again', async () => {
  const src = readFileSync('shared/phone.js', 'utf8');
  const re = new RegExp(src.match(/const TELLING = \/(.+)\/i;/)[1], 'i');
  assert.ok(re.test('Kids Place com.kids.place'));
  assert.ok(re.test('Kid Tracker'));
});
