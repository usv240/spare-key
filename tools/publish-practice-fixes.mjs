// Publishes the practice pages' reader fixes (web/practice/drift-fixes.mjs) to Remote Config as `practice_fixes`, so
// "Break the pages first" on try.html really fetches its fix from Remote Config, the way an install gets a `catalogue`
// fix. It reads the live template first and changes only this one value; everything else is sent back as it was.
// Uses the gcloud login (gcloud auth print-access-token); nothing secret is stored in the repo.
//   node tools/publish-practice-fixes.mjs [--dry-run]
import { execSync } from 'node:child_process';
import { FIXES } from '../web/practice/drift-fixes.mjs';

const PROJECT = 'spare-key-app';
const URL_RC = `https://firebaseremoteconfig.googleapis.com/v1/projects/${PROJECT}/remoteConfig`;
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT };
const got = await fetch(URL_RC, { headers });
if (!got.ok) throw new Error(`Reading Remote Config failed: HTTP ${got.status} ${(await got.text()).slice(0, 300)}`);
const etag = got.headers.get('etag');
const template = await got.json();
const value = JSON.stringify(FIXES);
console.log(`live template: ${Object.keys(template.parameters || {}).length} parameters, version ${template.version?.versionNumber}; practice_fixes ${value.length} bytes`);
template.parameters ||= {};
template.parameters.practice_fixes = {
  defaultValue: { value },
  description: 'Reader fixes for the changed copies of the practice pages (try.html, "Break the pages first"), keyed by kind of change.',
  valueType: 'JSON',
};
delete template.version;
if (process.argv.includes('--dry-run')) console.log('dry run: not published');
else await publish();
async function publish() {
const put = await fetch(URL_RC, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json; UTF-8', 'If-Match': etag }, body: JSON.stringify(template) });
const text = await put.text();
if (!put.ok) { console.error(`Publish failed: HTTP ${put.status} ${text.slice(0, 400)}`); process.exitCode = 1; return; }
const v = JSON.parse(text).version || {};
console.log(`Published Remote Config version ${v.versionNumber} at ${v.updateTime}`);
}
