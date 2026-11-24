// The phone check's rules (shared/phone.js), on made-up phone facts: which apps become findings, by which code, and
// that nothing about an app's name can reach the cloud body.
import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneCode, phoneFindings, phoneAnswer, appKindFrom } from '../shared/phone.js';
import { toCloud } from '../shared/cloud-safe.js';
import { buildPlan, PHONE_NOTE } from '../shared/plan/engine.js';
import { CODES } from '../shared/findings.js';

const app = (label, powers, extra = {}) => ({ pkg: `com.example.${label.toLowerCase().replace(/\W/g, '')}`, label, system: false, installer: 'play', powers, ...extra });
const FACTS = {
  apps: [
    app('System Service', { accessibility: true, device_admin: true, notifications: true }, { installer: 'other' }),
    app('Weather Now', { location_always: true }),
    app('Screen Reader Plus', { accessibility: true }),
    app('Android Keyboard', { notifications: false, usage_access: true }, { system: true }),
    app('Family Finder', { location_always: true, notifications: true }, { installer: 'play' }),
  ],
  device: { usb_debugging: true },
};

test('each app becomes one finding, by its strongest kind of control', () => {
  assert.equal(phoneCode(FACTS.apps[0]), 'phone.app.control');
  assert.equal(phoneCode(FACTS.apps[1]), 'phone.app.location_always');
  assert.equal(phoneCode(FACTS.apps[2]), 'phone.app.accessibility');
  assert.equal(phoneCode(FACTS.apps[3]), null, 'a system app without a strong power is left out');
  assert.equal(phoneCode(FACTS.apps[4]), 'phone.app.notifications');
  assert.equal(phoneCode(app('Sideloaded', { notifications: true }, { installer: 'other' })), 'phone.app.control');
});

test('every phone code is a known code, and USB debugging is its own finding', () => {
  const { findings } = phoneFindings(FACTS);
  for (const f of findings) assert.ok(CODES[f.code], f.code);
  assert.ok(findings.some(f => f.code === 'phone.usb_debugging'));
  assert.equal(findings[0].code, 'phone.app.control');
});

test('the cloud body holds codes only: no app name or package', () => {
  const { findings } = phoneFindings(FACTS, { nano: { 'com.example.systemservice': { kind: 'monitoring', about: 'Looks like a phone tracker' } } });
  const { body } = toCloud(findings, {});
  const text = JSON.stringify(body);
  for (const a of FACTS.apps) { assert.ok(!text.includes(a.label), a.label); assert.ok(!text.includes(a.pkg), a.pkg); }
  assert.ok(!/tracker/i.test(text));
});

test('ask_device on the phone answers from what was read', () => {
  const { findings } = phoneFindings(FACTS, { nano: { 'com.example.systemservice': { kind: 'monitoring', about: '' } } });
  const control = findings.find(f => f.code === 'phone.app.control');
  assert.equal(phoneAnswer(control, 'app_outside_store'), 'yes');
  assert.equal(phoneAnswer(control, 'app_looks_like_monitoring'), 'yes');
  assert.equal(phoneAnswer(findings.find(f => f.code === 'phone.app.location_always'), 'app_outside_store'), 'no');
});

test('the code plan puts an app watching the phone first and warns on every other change', () => {
  const { findings } = phoneFindings(FACTS);
  const plan = buildPlan({ findings: [...findings, { ref: 'L1', code: 'google.devices.other', ownership: null }], situation: { safe_to_change_now: 'yes' } });
  const steps = plan.actions.filter(a => a.code);
  assert.equal(steps[0].code, 'phone.app.control');
  assert.ok(steps.filter(a => !a.code.startsWith('phone.app.control') && !['phone.app.accessibility', 'phone.app.notifications', 'phone.app.device_admin'].includes(a.code)).every(a => a.linked === PHONE_NOTE));
});

test('Gemini Nano can add a kind and a note, never a reassurance', () => {
  assert.deepEqual(appKindFrom({ kind: 'everyday', about: 'A safe weather app' }), { kind: 'everyday', about: 'A weather app' });
  assert.equal(appKindFrom({ kind: 'harmless' }).kind, 'unknown');
});
