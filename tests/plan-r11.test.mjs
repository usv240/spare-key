// Rule R11 (live together or did not say), the cut-off note, and the children's devices step. Added November 25, 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, KIDS_CHECK, CUTOFF_NOTE } from '../shared/plan/engine.js';
import { applyInvariants, planPasses } from '../shared/plan/invariants.js';

const LIB = {
  'google.family.member': { who_can_notice: 'notifies', notice_why: 'Google emails them.' },
  'phone.app.control': { who_can_notice: 'noticeable', notice_why: 'Their app stops reporting.' },
  'google.devices.other': { who_can_notice: 'noticeable', notice_why: 'The device is signed out.' },
  'gmail.delegate': { who_can_notice: 'unlikely', notice_why: 'They are not told.' },
};
const findings = [
  { ref: 'f1', code: 'google.family.member', ownership: 'not_mine' },
  { ref: 'f2', code: 'phone.app.control', ownership: 'not_mine' },
  { ref: 'f3', code: 'google.devices.other', ownership: 'unsure' },
  { ref: 'f4', code: 'gmail.delegate', ownership: 'not_mine' },
];
const stepOf = (plan, code) => plan.actions.find(a => a.code === code);

for (const living of ['together', 'prefer_not_to_say']) {
  test(`code plan: living ${living}, now a good time: a change that notifies, and the watching app, wait`, () => {
    const ctx = { findings, situation: { living, safe_to_change_now: 'yes' }, library: LIB };
    const plan = buildPlan(ctx);
    assert.equal(stepOf(plan, 'google.family.member').action, 'wait');
    assert.equal(stepOf(plan, 'phone.app.control').action, 'wait');
    assert.equal(stepOf(plan, 'gmail.delegate').action, 'change_now');
    assert.ok(planPasses(applyInvariants(plan, ctx).plan, ctx).together);
  });
}

test('code plan: living apart, now a good time: the person chooses', () => {
  const ctx = { findings, situation: { living: 'apart', safe_to_change_now: 'yes' }, library: LIB };
  const plan = buildPlan(ctx);
  assert.equal(stepOf(plan, 'google.family.member').action, 'change_now');
  assert.equal(stepOf(plan, 'google.devices.other').cutoff, CUTOFF_NOTE);
});

test('a model plan that changes a notifying setting now, while they may live together, is moved to wait (R11)', () => {
  const ctx = { findings, situation: { living: 'together', safe_to_change_now: 'yes' }, library: LIB };
  const model = { actions: findings.map(f => ({ action: 'change_now', refs: [f.ref], code: f.code, why: 'Do it now.' })) };
  const before = planPasses({ actions: model.actions.map(a => ({ ...a, warning: 'x' })) }, ctx);
  assert.equal(before.together, false);
  const { plan, fired } = applyInvariants(model, ctx);
  assert.equal(stepOf(plan, 'google.family.member').action, 'wait');
  assert.equal(stepOf(plan, 'phone.app.control').action, 'wait');
  assert.ok(fired.some(f => f.rule === 'R11'));
  assert.equal(stepOf(plan, 'google.devices.other').cutoff, CUTOFF_NOTE);
  assert.ok(planPasses(plan, ctx).together);
});

test('shared children: a step for their devices, from code and after a model plan', () => {
  const ctx = { findings, situation: { children_shared: 'yes' }, library: LIB };
  assert.ok(buildPlan(ctx).actions.some(a => a.check === KIDS_CHECK));
  const { plan } = applyInvariants({ actions: [] }, ctx);
  assert.ok(plan.actions.some(a => a.check === KIDS_CHECK));
  const none = applyInvariants({ actions: [] }, { ...ctx, situation: { children_shared: 'no' } });
  assert.ok(!none.plan.actions.some(a => a.check === KIDS_CHECK));
});
