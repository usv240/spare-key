// A phone that may be rooted (shared/phone.js, from the signs PhoneScan.kt reads): its own finding, treated like an app
// that can watch the phone, and nothing about it but the code reaches the cloud body.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phoneFindings } from '../shared/phone.js';
import { toCloud } from '../shared/cloud-safe.js';
import { buildPlan, PHONE_WATCH, PHONE_NOTE } from '../shared/plan/engine.js';
import { applyInvariants } from '../shared/plan/invariants.js';
import { libraryMap, validateLibrary } from '../shared/steps-schema.js';

const lib = JSON.parse(readFileSync('data/steps.json', 'utf8'));
const library = libraryMap(lib);
const facts = signs => ({ apps: [{ pkg: 'com.example.weather', label: 'Weather Now', system: false, installer: 'play', powers: { location_always: true } }], device: { root_signs: signs } });

test('no sign, no finding: a phone is never called rooted without a sign', () => {
  assert.ok(!phoneFindings(facts([])).findings.some(f => f.code === 'phone.rooted'));
  assert.ok(!phoneFindings(facts(['made_up_sign'])).findings.some(f => f.code === 'phone.rooted'));
});

test('a root tool or a rooting app gives one "may be rooted" finding that names the signs', () => {
  const f = phoneFindings(facts(['su_binary', 'root_app'])).findings.filter(x => x.code === 'phone.rooted');
  assert.equal(f.length, 1);
  assert.match(f[0].label, /may be rooted/);
  assert.match(f[0].detail, /root tool/);
  assert.match(f[0].detail, /rooting app/);
});

test('the library has a valid entry for it, with a quoted source', () => {
  assert.deepEqual(validateLibrary(lib), []);
  assert.ok(library['phone.rooted'].sources.some(s => /techsafety\.org/.test(s.url) && s.quote));
});

test('the plan treats it like an app watching the phone: first, and every other step says to use another device', () => {
  assert.ok(PHONE_WATCH.has('phone.rooted'));
  const { findings } = phoneFindings(facts(['test_keys']));
  for (const f of findings) f.ownership = 'unsure';
  const plan = buildPlan({ findings, situation: { safe_to_change_now: 'yes', living: 'apart' }, notChecked: [], library });
  const steps = plan.actions.filter(a => !['document', 'talk_to_advocate', 'check_manually'].includes(a.action));
  assert.equal(steps[0].code, 'phone.rooted');
  assert.ok(steps.slice(1).every(a => a.linked === PHONE_NOTE), 'other steps carry the use-another-device note');
  const checked = applyInvariants(plan, { findings, situation: { safe_to_change_now: 'yes', living: 'apart' }, notChecked: [], library });
  assert.equal(checked.plan.actions.find(a => a.code === 'phone.rooted')?.action !== undefined, true);
});

test('living together, now a good time: it still waits (R11)', () => {
  const { findings } = phoneFindings(facts(['su_binary']));
  for (const f of findings) f.ownership = 'unsure';
  const plan = buildPlan({ findings, situation: { safe_to_change_now: 'yes', living: 'together' }, notChecked: [], library });
  assert.equal(plan.actions.find(a => a.code === 'phone.rooted').action, 'wait');
});

test('the cloud body has the code and nothing else about it', () => {
  const { findings } = phoneFindings(facts(['su_binary']));
  const text = JSON.stringify(toCloud(findings, {}).body);
  assert.match(text, /phone\.rooted/);
  assert.ok(!/root tool|su\b|Weather Now/.test(text.replace(/phone\.rooted/g, '')));
});
