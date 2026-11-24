// The phone check's rules (shared/phone.js), on made-up phone facts: which apps become findings, by which code, and
// that nothing about an app's name can reach the cloud body.
import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneCode, phoneFindings, phoneAnswer, appKindFrom } from '../shared/phone.js';
import { toCloud } from '../shared/cloud-safe.js';
import { buildPlan, PHONE_NOTE } from '../shared/plan/engine.js';
import { CODES } from '../shared/findings.js';
import { PRACTICE_PHONE, PRACTICE_PHONE_EXPECTED } from '../shared/phone-practice.js';

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
  assert.equal(phoneCode(app('Android System Intelligence', { notifications: true, accessibility: true }, { system: true, installer: 'unknown' })), null,
    'an app that came with the phone is counted, not listed (seen on a real emulator)');
});

test('apps that came with the phone are counted for the results', () => {
  assert.equal(phoneFindings(FACTS).builtIn, 1);
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

test('the practice phone finds exactly what it was made with', () => {
  const { findings } = phoneFindings(PRACTICE_PHONE);
  const got = findings.map(f => [f.label.split(' · ')[0] === 'USB debugging is on' ? null : f.label.split(' · ')[0], f.code]);
  assert.deepEqual(got.map(g => g.join('|')).sort(), PRACTICE_PHONE_EXPECTED.map(g => g.join('|')).sort());
});

test('a setting finding is worded by code, so the steps library may use the same words in a get_steps answer', async () => {
  const { checkAnswer } = await import('../shared/cloud-safe.js');
  const { libraryMap } = await import('../shared/steps-schema.js');
  const { readFileSync } = await import('node:fs');
  const library = libraryMap(JSON.parse(readFileSync(new URL('../data/steps.json', import.meta.url), 'utf8')));
  const { findings } = phoneFindings(FACTS);
  const privateStrings = findings.filter(f => f.pkg).flatMap(f => [f.label, f.detail, f.pkg]);
  const answer = { entries: { 'phone.usb_debugging': library['phone.usb_debugging'] } };
  assert.doesNotThrow(() => checkAnswer('get_steps', answer, { privateStrings, library }));
  assert.throws(() => checkAnswer('ask_device', { answer: 'System Service' }, { privateStrings, library }));
});

test('R10: a plan a model ordered still warns on every other step, and puts the watching app first', async () => {
  const { applyInvariants } = await import('../shared/plan/invariants.js');
  const { findings } = phoneFindings(FACTS);
  const all = [...findings, { ref: 'L1', code: 'google.devices.other', ownership: null }];
  const control = findings.find(f => f.code === 'phone.app.control');
  // What a model returns: steps in its own order, with no note (it sees codes only).
  const model = { summary: '', actions: [
    { action: 'document', refs: all.map(f => f.ref), why: 'x' },
    { action: 'talk_to_advocate', refs: [], why: 'x' },
    { action: 'wait', refs: ['L1'], why: 'x' },
    { action: 'wait', refs: [control.ref], why: 'x' },
  ] };
  const { plan, fired } = applyInvariants(model, { findings: all, situation: { safe_to_change_now: 'no' }, notChecked: [], library: {} });
  const steps = plan.actions.filter(a => ['change_now', 'wait'].includes(a.action));
  assert.equal(steps[0].code, 'phone.app.control', 'the watching app comes before other changes');
  const other = steps.find(a => a.code === 'google.devices.other');
  assert.equal(other.linked, PHONE_NOTE);
  assert.ok(fired.some(f => f.rule === 'R10'));
});

test('Gemini Nano on the phone can raise concern, never lower it', () => {
  const nano = { 'com.example.weathernow': { kind: 'everyday', about: 'A well-known weather app' }, 'com.example.systemservice': { kind: 'monitoring', about: 'Looks like a phone tracker' } };
  const { findings } = phoneFindings(FACTS, { nano });
  const weather = findings.find(f => f.name === 'Weather Now');
  assert.equal(weather.note, '', 'a reassuring note is not shown');
  assert.ok(!/well-known/.test(weather.detail));
  assert.equal(phoneAnswer(weather, 'app_looks_like_monitoring'), 'unknown', '"looks everyday" is not evidence');
  assert.equal(findings.find(f => f.name === 'System Service').note, 'Looks like a phone tracker');
});

test('one kind of access from the Play Store is listed under its own heading, never dropped', () => {
  const { findings } = phoneFindings(PRACTICE_PHONE);
  const group = name => findings.find(f => f.name === name)?.group;
  assert.equal(group('System Update Service'), 'phone', 'the app with several powers from outside the store stays on top');
  assert.equal(group('Password Keeper'), 'phone_one');
  assert.equal(group('Notify Mirror'), 'phone_one');
  assert.equal(findings.length, PRACTICE_PHONE_EXPECTED.length, 'every app is still listed');
  // Gemini Nano can raise an app out of the lower group, and a device admin app never goes there.
  const raised = phoneFindings(PRACTICE_PHONE, { nano: { 'com.example.notifymirror': { kind: 'monitoring', about: 'a notification mirroring app' } } }).findings;
  assert.equal(raised.find(f => f.name === 'Notify Mirror').group, 'phone');
  const admin = phoneFindings({ apps: [{ pkg: 'a.b', label: 'Admin', system: false, installer: 'play', powers: { device_admin: true } }], device: {} }).findings;
  assert.equal(admin[0].group, 'phone');
  const side = phoneFindings({ apps: [{ pkg: 'a.c', label: 'Side', system: false, installer: 'other', powers: { usage_access: true } }], device: {} }).findings;
  assert.equal(side[0].group, 'phone', 'an app from outside the Play Store is never in the lower group');
});
