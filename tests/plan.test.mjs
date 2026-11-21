// The plan built by code, and the safety rules R1 to R8 (TECHNICAL-DESIGN.md section 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../shared/plan/engine.js';
import { applyInvariants, planPasses, cleanText } from '../shared/plan/invariants.js';
import { SITUATION, CODES } from '../shared/findings.js';

const LIB = {
  'gmail.delegate': { who_can_notice: 'unlikely', notice_why: 'They are not told when you remove them.' },
  'gmail.forwarding.external': { who_can_notice: 'noticeable', notice_why: 'Their copies stop arriving. They may notice within a day.' },
  'maps.sharing.person': { who_can_notice: 'notifies', notice_why: 'Google may tell them you stopped sharing.' },
};
const FINDINGS = [
  { ref: 'f1', code: 'maps.sharing.person', ownership: 'not_mine', recency: 'unknown' },
  { ref: 'f2', code: 'gmail.forwarding.external', ownership: 'unsure', recency: 'unknown' },
  { ref: 'f3', code: 'gmail.delegate', ownership: null, recency: 'unknown' },
  { ref: 'f4', code: 'google.devices.other', ownership: 'mine', recency: 'now' },
  { ref: 'f5', code: 'google.apps.read_mail', ownership: 'not_mine', recency: 'older' },
];

// Every combination of the four situation answers, plus "not answered".
function* situations() {
  const keys = Object.keys(SITUATION);
  const values = keys.map(k => [...SITUATION[k], undefined]);
  const rec = function* (i, acc) {
    if (i === keys.length) { yield acc; return; }
    for (const v of values[i]) yield* rec(i + 1, v === undefined ? acc : { ...acc, [keys[i]]: v });
  };
  yield* rec(0, {});
}

test('the code plan passes every measure, needs no fixing, in all 256 situations', () => {
  let n = 0;
  for (const situation of situations()) {
    const ctx = { findings: FINDINGS, situation, notChecked: ['ring', 'gmail.filters'], library: LIB };
    const { plan, fired } = applyInvariants(buildPlan(ctx), ctx);
    // R3 attaches warnings by design (the code plan leaves warnings to the rules); nothing else may fire.
    assert.deepEqual(fired.filter(f => f.rule !== 'R3'), [], JSON.stringify(situation));
    const passes = planPasses(plan, ctx);
    assert.ok(Object.values(passes).every(Boolean), `${JSON.stringify(situation)} ${JSON.stringify(passes)}`);
    n++;
  }
  assert.equal(n, 256);
});

test('"Mine" findings get no step; everything else does', () => {
  const plan = buildPlan({ findings: FINDINGS, library: LIB });
  const refs = plan.actions.filter(a => ['change_now', 'wait'].includes(a.action)).flatMap(a => a.refs);
  assert.deepEqual(refs.sort(), ['f1', 'f2', 'f3', 'f5']);
  assert.ok(!plan.actions.find(a => a.action === 'document').refs.includes('f4'));
});

test('when now is not a good time, nothing that may be noticed is changed', () => {
  const plan = buildPlan({ findings: FINDINGS, situation: { safe_to_change_now: 'not_sure' }, library: LIB });
  assert.ok(plan.actions.every(a => a.action !== 'change_now'));
});

test('a quiet takeover path is changed now when the person says it is a good time', () => {
  const plan = buildPlan({ findings: FINDINGS, situation: { safe_to_change_now: 'yes' }, library: LIB });
  const delegate = plan.actions.find(a => ['change_now', 'wait'].includes(a.action) && a.refs.includes('f3'));
  assert.equal(delegate.action, 'change_now');
  const firstChange = plan.actions.findIndex(a => a.action === 'change_now');
  assert.ok(plan.actions.findIndex(a => a.action === 'talk_to_advocate') < firstChange);
  assert.equal(plan.actions[0].action, 'document');
});

test('R1 to R8 repair a bad plan, the way the cloud might write one', () => {
  const ctx = { findings: FINDINGS, situation: { safe_to_change_now: 'no' }, notChecked: ['ring'], library: LIB };
  const bad = {
    summary: 'You are safe now. Write to help@example.com for more.',
    actions: [
      { action: 'change_now', ref: 'f1', why: 'Turn it off right away. It is all clear after that.' },
      { action: 'change_now', ref: 'f2', why: 'Disable forwarding. Then call (312) 555-0188.' },
      { action: 'not_an_action', ref: 'f3', why: 'x' },
    ],
  };
  const { plan, fired } = applyInvariants(bad, ctx);
  const rules = new Set(fired.map(f => f.rule));
  for (const r of ['R1', 'R2', 'R4', 'R5', 'R6', 'R7', 'R8']) assert.ok(rules.has(r), `expected ${r} to fire, got ${[...rules]}`);
  assert.ok(Object.values(planPasses(plan, ctx)).every(Boolean), JSON.stringify(planPasses(plan, ctx)));
  assert.ok(!/safe|all clear|555-0188|example\.com/i.test(JSON.stringify(plan)));
});

test('R3 attaches the library warning to a noticeable change, whatever the model wrote', () => {
  const ctx = { findings: FINDINGS, situation: { safe_to_change_now: 'yes' }, library: LIB };
  const { plan } = applyInvariants({ actions: [{ action: 'document', refs: [] }, { action: 'talk_to_advocate', refs: [] }, { action: 'change_now', refs: ['f2'], why: 'Turn off forwarding.' }] }, ctx);
  const step = plan.actions.find(a => a.action === 'change_now' && a.refs.includes('f2'));
  assert.equal(step.warning, LIB['gmail.forwarding.external'].notice_why);
});

test('cleanText removes reassurance and contact details, and keeps the rest', () => {
  const { text, removed } = cleanText('Screenshot it first. You are safe. Email sam@example.net. Talk to an advocate.');
  assert.equal(text, 'Screenshot it first. Talk to an advocate.');
  assert.deepEqual(removed, ['R6', 'R7']);
});

test('every finding code can be planned', () => {
  const findings = Object.keys(CODES).map((code, i) => ({ ref: `f${i + 1}`, code, ownership: 'unsure' }));
  const ctx = { findings, library: {} };
  const { plan } = applyInvariants(buildPlan(ctx), ctx);
  assert.ok(Object.values(planPasses(plan, ctx)).every(Boolean));
});
