// Copies the steps library (data/steps.json) into Firestore: steps/{code} and meta/library. The extension refreshes its
// bundled copy when meta/library's version is newer, so a corrected step reaches every install without a store update.
// Uses the builder's gcloud login (server credentials, which bypass the security rules). Validates the library first.
// Usage: node tools/firestore-sync.mjs
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { validateLibrary } from '../shared/steps-schema.js';

const PROJECT = 'spare-key-app';
const lib = JSON.parse(readFileSync('data/steps.json', 'utf8'));
const problems = validateLibrary(lib);
if (problems.length) { console.error('The steps library is not valid:\n' + problems.join('\n')); process.exit(1); }

// A plain JSON value in Firestore's REST format.
const toValue = v => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
};

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
async function put(path, data) {
  const res = await fetch(`${base}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
}

for (const e of lib.entries) await put(`steps/${encodeURIComponent(e.code)}`, e);
await put('meta/library', { version: lib.version, updated_at: lib.updated_at, count: lib.entries.length });
console.log(`Firestore: ${lib.entries.length} steps entries and meta/library (version ${lib.version}, ${lib.updated_at})`);
