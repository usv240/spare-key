// toCloud() and checkOutgoing(): nothing that names a person can reach a cloud request body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCloud, checkOutgoing, checkAnswer, leaksAny, CloudSafetyError } from '../shared/cloud-safe.js';
import { CODES, OWNERSHIP, RECENCY, HOW_FOUND, CHECK_IDS } from '../shared/findings.js';

// Canary strings that appear nowhere else (EVALUATION.md section 3).
const CANARIES = ['Quillon Varnadoe', 'quillon.varnadoe@example.com', 'q.varnadoe+fwd@gmail.com', '(312) 555-0188', '+1 773 555 0142',
  "Quillon's Pixel 9", 'DESKTOP-QV7781', '1742 Wexford Lane', 'canary-7Q2X', 'Varnadoe Family'];

// A small seeded random generator, so a failure can be reproduced.
function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

function findingStuffedWithCanaries(r, n) {
  const canary = () => pick(r, CANARIES);
  return {
    ref: `local-${n}-${canary()}`,
    code: pick(r, Object.keys(CODES)),
    check: canary(),
    group: canary(),
    label: `Forwards all mail to ${canary()}`,
    detail: `${canary()} on ${canary()}, ${canary()}`,
    howFound: pick(r, HOW_FOUND),
    confidence: 'high',
    recency: pick(r, RECENCY),
    ownership: pick(r, [...OWNERSHIP, null, undefined]),
    openUrl: `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(canary())}`,
    email: canary(),
    phone: canary(),
    deviceName: canary(),
    address: canary(),
    pageText: CANARIES.join(' '),
    [canary()]: canary(),
  };
}

test('toCloud output never contains a canary, over 500 random scans', () => {
  const r = rng(20261121);
  for (let scan = 0; scan < 500; scan++) {
    const findings = Array.from({ length: 1 + Math.floor(r() * 12) }, (_, n) => findingStuffedWithCanaries(r, n));
    const { body } = toCloud(findings, {
      situation: { living: 'apart', safe_to_change_now: 'no', children_shared: 'yes', has_advocate: 'no', name: CANARIES[0] },
      shared: { living: true, safe_to_change_now: r() > 0.5, children_shared: r() > 0.5, has_advocate: true },
      notChecked: ['ring', 'google.family'],
    });
    const text = JSON.stringify(body);
    for (const c of CANARIES) {
      assert.ok(!leaksAny(text, [c]), `scan ${scan} leaked ${c}`);
    }
    // And the projection passes the outgoing check, with the canaries as this session's private strings.
    assert.doesNotThrow(() => checkOutgoing('plan', body, { privateStrings: CANARIES }));
  }
});

test('toCloud copies only the allowed keys', () => {
  const { body, refs } = toCloud([{ ref: 'abc', code: 'gmail.forwarding.external', howFound: 'reader', label: CANARIES[1], ownership: 'not_mine', recency: 'today' }]);
  assert.deepEqual(body, {
    findings: [{ ref: 'f1', code: 'gmail.forwarding.external', ownership: 'not_mine', recency: 'today', how_found: 'reader' }],
    situation: {},
    not_checked: [],
  });
  assert.deepEqual(refs, { f1: 'abc' });
});

test('situation answers leave only when the person chose to share them, and default to the most cautious value', () => {
  const { body } = toCloud([], { situation: {}, shared: { safe_to_change_now: true, living: false } });
  assert.deepEqual(body.situation, { safe_to_change_now: 'not_sure' });
});

test('toCloud throws on anything it does not recognise', () => {
  const base = { ref: 'x', code: 'gmail.delegate', howFound: 'nano' };
  assert.throws(() => toCloud([{ ...base, code: 'gmail.forwarding.to:' + CANARIES[1] }]), CloudSafetyError);
  assert.throws(() => toCloud([{ ...base, ownership: 'mine, it is ' + CANARIES[0] }]), CloudSafetyError);
  assert.throws(() => toCloud([{ ...base, recency: 'since ' + CANARIES[7] }]), CloudSafetyError);
  assert.throws(() => toCloud([{ ...base, howFound: undefined }]), CloudSafetyError);
  assert.throws(() => toCloud([base], { situation: { living: CANARIES[7] }, shared: { living: true } }), CloudSafetyError);
  assert.throws(() => toCloud([base], { notChecked: ['Signed out as ' + CANARIES[1]] }), CloudSafetyError);
});

test('every check id is accepted as not checked', () => {
  const { body } = toCloud([], { notChecked: CHECK_IDS });
  assert.equal(body.not_checked.length, CHECK_IDS.length);
});

test('checkOutgoing refuses unknown purposes, extra keys and private strings', () => {
  assert.throws(() => checkOutgoing('debug', { probe: 'ready' }), CloudSafetyError);
  assert.throws(() => checkOutgoing('check', { probe: 'ready', note: CANARIES[0] }), CloudSafetyError);
  assert.throws(() => checkOutgoing('check', { probe: CANARIES[0] }), CloudSafetyError);
  assert.equal(checkOutgoing('check', { probe: 'ready' }), '{"probe":"ready"}');
  const { body } = toCloud([{ ref: 'a', code: 'maps.sharing.person', howFound: 'both' }]);
  // A body that somehow picked up a private string is refused even when its shape is fine.
  const tampered = JSON.parse(JSON.stringify(body));
  tampered.findings[0].ref = 'f1';
  assert.doesNotThrow(() => checkOutgoing('plan', tampered, { privateStrings: CANARIES }));
  tampered.findings[0].code = 'maps.sharing.person';
  tampered.extra = CANARIES[2];
  assert.throws(() => checkOutgoing('plan', tampered, { privateStrings: CANARIES }), CloudSafetyError);
});

test('the two-voice body refuses model text that holds an address, a number or a link', () => {
  const scan = toCloud([{ ref: 'a', code: 'gmail.forwarding.external', howFound: 'reader' }]).body;
  const ok = { scan, voice: 'stay_hidden', draft: { actions: [{ ref: 'f1', action: 'wait', why: 'They may notice their copies stop.' }], summary: 'Screenshot first.' } };
  assert.doesNotThrow(() => checkOutgoing('voices', ok));
  for (const bad of ['Mail goes to ' + CANARIES[1], 'Call (312) 555-0188', 'See https://example.com/x']) {
    const body = structuredClone(ok);
    body.draft.actions[0].why = bad;
    assert.throws(() => checkOutgoing('voices', body), CloudSafetyError, bad);
  }
});

test('freshness may send only a help page the steps library cites', () => {
  const library = { 'gmail.forwarding.external': { sources: [{ title: 'Gmail Help: Automatically forward Gmail messages', url: 'https://support.google.com/mail/answer/10957' }] } };
  assert.doesNotThrow(() => checkOutgoing('freshness', { code: 'gmail.forwarding.external', help_title: 'Gmail Help: Automatically forward Gmail messages', help_url: 'https://support.google.com/mail/answer/10957' }, { library }));
  assert.throws(() => checkOutgoing('freshness', { code: 'gmail.forwarding.external', help_title: 'x', help_url: 'https://mail.google.com/mail/u/0/' }, { library }), CloudSafetyError);
});

test('function answers are enums only, or a steps library entry', () => {
  const library = { 'gmail.delegate': { code: 'gmail.delegate', title: 'Someone else can open your Gmail' } };
  assert.doesNotThrow(() => checkAnswer('ask_device', { answer: 'yes' }));
  assert.doesNotThrow(() => checkAnswer('ask_user', { answer: 'skipped' }));
  assert.doesNotThrow(() => checkAnswer('get_steps', library['gmail.delegate'], { library }));
  assert.throws(() => checkAnswer('ask_device', { answer: 'yes', name: CANARIES[0] }), CloudSafetyError);
  assert.throws(() => checkAnswer('ask_user', { answer: CANARIES[0] }), CloudSafetyError);
  assert.throws(() => checkAnswer('get_steps', { code: 'gmail.delegate', title: CANARIES[0] }, { library }), CloudSafetyError);
  assert.throws(() => checkAnswer('read_page', { text: 'x' }), CloudSafetyError);
});

test('leaksAny finds plain, URL-encoded and base64 forms', () => {
  const s = 'quillon.varnadoe@example.com';
  assert.ok(leaksAny(`x ${s} y`, [s]));
  assert.ok(leaksAny(`x ${encodeURIComponent(s)} y`, [s]));
  assert.ok(leaksAny(`x ${Buffer.from(s).toString('base64')} y`, [s]));
  assert.ok(leaksAny('QUILLON VARNADOE', ['Quillon Varnadoe']));
  assert.ok(!leaksAny('{"code":"gmail.delegate"}', [s, 'Quillon Varnadoe']));
});
