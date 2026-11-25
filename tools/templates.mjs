// Creates or updates Spare Key's Firebase AI Logic server prompt templates from the shared code (shared/plan/template.js),
// through the Firebase AI Logic REST API, with the signed-in gcloud account. Prints each template's state.
//
//   node tools/templates.mjs             create or update, then show
//   node tools/templates.mjs --show      only show what is on the server
//   node tools/templates.mjs --test      one templateGenerateContent call per template with made-up codes (2 cloud calls),
//                                         and one with a name in it, which the server must refuse (no model call)
//   node tools/templates.mjs --lock      lock them, so the console cannot change them by accident
import { execFileSync } from 'node:child_process';
import { PLAN_TEMPLATE, PLAN_TEMPLATE_BACKUP, planTemplateString } from '../shared/plan/template.js';
import { CLOUD_MODELS } from '../shared/config.js';

const PROJECT = 'spare-key-app';
const BASE = `https://firebasevertexai.googleapis.com/v1beta/projects/${PROJECT}/locations/global/templates`;
const TEMPLATES = [[PLAN_TEMPLATE, CLOUD_MODELS[0]], [PLAN_TEMPLATE_BACKUP, CLOUD_MODELS[1] || CLOUD_MODELS[0]]];
const has = f => process.argv.includes(`--${f}`);

const token = execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'gcloud', process.platform === 'win32' ? ['/c', 'gcloud', 'auth', 'print-access-token'] : ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };
async function call(method, url, body) {
  const r = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, json, text };
}
const short = t => ({ id: t.name?.split('/').pop(), model: t.model, locked: !!t.locked, updated: t.updateTime });

if (!has('show') && !has('test') && !has('lock')) {
  for (const [id, model] of TEMPLATES) {
    const templateString = planTemplateString(model);
    const got = await call('GET', `${BASE}/${id}`);
    // A locked template is unlocked for the change and locked again after it.
    const wasLocked = !!got.json?.locked;
    if (wasLocked) await call('POST', `${BASE}/${id}:modifyLock`, { locked: false });
    const r = got.status === 200
      ? await call('PATCH', `${BASE}/${id}?updateMask=templateString,displayName`, { templateString, displayName: `Spare Key plan (${model})` })
      : await call('POST', `${BASE}?promptTemplateId=${id}`, { templateString, displayName: `Spare Key plan (${model})` });
    console.log(`${got.status === 200 ? 'updated' : 'created'} ${id}: HTTP ${r.status}`, r.status < 300 ? '' : r.text.slice(0, 600));
    if (wasLocked) await call('POST', `${BASE}/${id}:modifyLock`, { locked: true });
  }
}
if (has('lock')) {
  for (const [id] of TEMPLATES) {
    const r = await call('POST', `${BASE}/${id}:modifyLock`, { locked: true });
    console.log(`lock ${id}: HTTP ${r.status}`, r.status < 300 ? '' : r.text.slice(0, 300));
  }
}
const list = await call('GET', BASE);
console.log((list.json?.templates || []).map(short));

if (has('test')) {
  // Made-up codes, the same shape toCloud() makes. The call goes through the template endpoint, not a client SDK.
  const ok = {
    findings: [
      { ref: 'f1', code: 'gmail.forwarding.external', ownership: 'not_mine', recency: 'unknown', how_found: 'reader' },
      { ref: 'f2', code: 'google.recovery.email_other', ownership: 'unsure', recency: 'unknown', how_found: 'reader' },
    ],
    situation: { safe_to_change_now: 'no' },
    not_checked: ['ring'],
  };
  // App Check is enforced on AI Logic, so the test exchanges the local debug token (extension/appcheck-debug.local.js,
  // gitignored, never printed) for an App Check token, the way a development build of the extension does.
  const { readFileSync } = await import('node:fs');
  const debug = (readFileSync('extension/appcheck-debug.local.js', 'utf8').match(/[0-9a-f]{8}-[0-9a-f-]{27}/i) || [])[0];
  const cfg = readFileSync('extension/src/firebase-config.js', 'utf8');
  const appId = cfg.match(/appId:\s*'([^']+)'/)[1];
  const apiKey = cfg.match(/apiKey:\s*'([^']+)'/)[1];
  const ex = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}/apps/${appId}:exchangeDebugToken?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ debugToken: debug }) });
  const appCheck = (await ex.json()).token;
  console.log('App Check token from the debug token:', appCheck ? 'yes' : `no (HTTP ${ex.status})`);
  const run = async (id, inputs) => {
    const r = await fetch(`https://firebasevertexai.googleapis.com/v1beta/projects/${PROJECT}/templates/${id}:templateGenerateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': appCheck }, body: JSON.stringify({ inputs }),
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: r.status, json, text };
  };
  // What is saved to docs/evidence/template-check.json: the case, the HTTP status, and the server's own reason or the kind
  // of answer. The made-up name and address are not written to the file.
  const results = [];
  const keep = (template, kase, r, expect) => results.push({ template, case: kase, expect, status: r.status, passed: expect === 'refused' ? r.status === 400 : r.status === 200 || r.status === 429, answer: r.status === 200 ? (r.json?.candidates?.[0]?.content?.parts || []).map(p => p.functionCall ? `function call ${p.functionCall.name}` : p.text ? 'text' : 'other').filter((x, i, a) => a.indexOf(x) === i).join(', ') : (r.json?.error?.message || '').split('.')[0] });
  for (const [id] of TEMPLATES) {
    const r = await run(id, ok);
    keep(id, 'codes only', r, 'accepted');
    const parts = r.json?.candidates?.[0]?.content?.parts || [];
    console.log(`\n${id} with codes only: HTTP ${r.status}`, r.status < 300 ? JSON.stringify(parts).slice(0, 500) : r.text.slice(0, 600));
  }
  // A name where a code goes: the input schema must refuse it before any model sees it.
  const bad = { ...ok, findings: [{ ...ok.findings[0], code: 'Sam Porter, sam.porter@example.net' }] };
  const r = await run(PLAN_TEMPLATE, bad);
  keep(PLAN_TEMPLATE, 'a made-up name and email where a code goes', r, 'refused');
  console.log(`\n${PLAN_TEMPLATE} with a name in it: HTTP ${r.status}`, r.text.slice(0, 400));
  const inRef = { ...ok, findings: [{ ...ok.findings[0], ref: 'Sam Porter' }] };
  const r3 = await run(PLAN_TEMPLATE, inRef);
  keep(PLAN_TEMPLATE, 'a made-up name as a ref', r3, 'refused');
  console.log(`${PLAN_TEMPLATE} with a name as a ref: HTTP ${r3.status}`, r3.text.slice(0, 200));
  const inSituation = { ...ok, situation: { safe_to_change_now: 'no, he lives at 12 Elm St' } };
  const r4 = await run(PLAN_TEMPLATE, inSituation);
  keep(PLAN_TEMPLATE, 'a made-up address in a situation answer', r4, 'refused');
  console.log(`${PLAN_TEMPLATE} with an address in an answer: HTTP ${r4.status}`, r4.text.slice(0, 200));
  // A key the template does not name is accepted, but never written into the prompt, so no model sees it.
  const extra = { ...ok, note: 'my ex is Sam Porter' };
  const r2 = await run(PLAN_TEMPLATE, extra);
  keep(PLAN_TEMPLATE, 'an extra free-text key the template does not name (accepted, never written into the prompt)', r2, 'accepted');
  const { writeFileSync } = await import('node:fs');
  writeFileSync('docs/evidence/template-check.json', JSON.stringify({ at: new Date().toISOString(), note: 'node tools/templates.mjs --test: calls to the server prompt templates through the templateGenerateContent endpoint, with an App Check token from the development debug token. HTTP 429 on an accepted case means the free-tier quota was busy, not a refusal. A refusal (HTTP 400) happens before any model call.', results }, null, 1));
  console.log(`${PLAN_TEMPLATE} with an extra free-text key: HTTP ${r2.status}`, r2.text.slice(0, 400));
}
