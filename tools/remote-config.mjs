// Writes remoteconfig.template.json from shared/config.js, and with --publish sends it to the project's Remote Config.
// Usage: node tools/remote-config.mjs [--publish]
// Publishing uses the gcloud login (gcloud auth print-access-token); nothing secret is stored in the repo.
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { REMOTE_DEFAULTS } from '../shared/config.js';

const PROJECT = 'spare-key-app';
const template = {
  parameters: Object.fromEntries(Object.entries(REMOTE_DEFAULTS).map(([key, p]) => [key, {
    defaultValue: { value: p.value },
    description: p.about.slice(0, 256),
    valueType: p.type,
  }])),
};
writeFileSync('remoteconfig.template.json', JSON.stringify(template, null, 2) + '\n');
console.log(`remoteconfig.template.json: ${Object.keys(template.parameters).length} keys`);

if (process.argv.includes('--publish')) {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${PROJECT}/remoteConfig`;
  // Merge into the live template, so keys published by other tools (practice_fixes) are kept, and publish against its
  // ETag, so a change made meanwhile in the console is not overwritten.
  const live = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT } });
  const etag = live.headers.get('etag');
  const current = await live.json();
  const merged = { ...current, parameters: { ...(current.parameters || {}), ...template.parameters } };
  delete merged.version;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-user-project': PROJECT,
      'Content-Type': 'application/json; UTF-8',
      'If-Match': etag || '*',
    },
    body: JSON.stringify(merged),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`Publish failed: HTTP ${res.status} ${text.slice(0, 400)}`); process.exit(1); }
  const version = JSON.parse(text).version || {};
  console.log(`Published Remote Config version ${version.versionNumber} at ${version.updateTime}`);
}
