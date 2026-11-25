// "In your own words" (shared/told.js): what any reader's answer may do to a plan, and what it may not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanTold, toldFindings, toldSituation, keywordTold, TOLD_CODES, TOLD_SCHEMA } from '../shared/told.js';
import { CODES } from '../shared/findings.js';
import { toCloud } from '../shared/cloud-safe.js';
import { libraryMap } from '../shared/steps-schema.js';

const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));

test('every code a person can tell is a known code with a library entry', () => {
  for (const c of TOLD_CODES) { assert.ok(CODES[c], c); assert.ok(library[c], c); }
  assert.deepEqual(TOLD_SCHEMA.properties.codes.items.enum, TOLD_CODES);
});

test('an answer is cleaned: unknown codes, repeats and odd answers are dropped', () => {
  const a = cleanTold({ codes: ['tracker.alert', 'tracker.alert', 'made.up', 'phone.app.control'], living: 'sometimes', children_shared: 'yes' });
  assert.deepEqual(a, { codes: ['tracker.alert', 'phone.app.control'], living: 'unclear', children_shared: 'yes' });
});

test('told findings only add: a code already found is not added again, and nothing is marked as the person\'s own', () => {
  const existing = [{ ref: 'f1', code: 'tracker.alert', ownership: 'mine' }];
  const told = toldFindings({ codes: ['tracker.alert', 'carrier.plan.holder_other'] }, { existing });
  assert.equal(told.length, 1);
  assert.equal(told[0].code, 'carrier.plan.holder_other');
  assert.equal(told[0].ownership, 'not_mine');
  assert.match(told[0].label, /from what you told/);
});

test('words never override an answer the person gave', () => {
  assert.deepEqual(toldSituation({ codes: [], living: 'together', children_shared: 'yes' }, { living: 'apart' }), { children_shared: 'yes' });
});

test('the cloud body holds the code, never the words', () => {
  const words = 'Marcus bought me this phone and pays for it on his plan.';
  const told = toldFindings(keywordTold(words), {});
  const text = JSON.stringify(toCloud(told, {}).body);
  assert.ok(told.length >= 1);
  assert.ok(!/Marcus|bought|pays/.test(text), text);
});

test('the keyword reader skips what the person says is over or only a guess', () => {
  assert.deepEqual(keywordTold('I turned off location sharing with him last week.').codes, []);
  assert.deepEqual(keywordTold('I think he forwards my email somehow.').codes, []);
  assert.deepEqual(keywordTold('He installed an app on my phone.').codes, ['phone.app.control']);
});

test('words only ever make the plan more careful: "apart" and "no children" are never filled in (judge round 10)', () => {
  assert.deepEqual(toldSituation({ codes: [], living: 'apart', children_shared: 'no' }, {}), {});
  assert.deepEqual(toldSituation({ codes: [], living: 'together', children_shared: 'yes' }, {}), { living: 'together', children_shared: 'yes' });
});

test('a misread "apart" cannot turn a noticed change into "change now"', async () => {
  const { buildPlan } = await import('../shared/plan/engine.js');
  const { applyInvariants } = await import('../shared/plan/invariants.js');
  // google.family.member notifies the other person; R11 keeps it waiting unless the person said they live apart.
  const findings = [{ ref: 'f1', code: 'google.family.member', ownership: 'not_mine' }];
  const plan = situation => { const ctx = { findings, situation, notChecked: [], library }; return applyInvariants(buildPlan(ctx), ctx).plan; };
  const misread = plan({ safe_to_change_now: 'yes', ...toldSituation({ codes: [], living: 'apart', children_shared: 'no' }, {}) });
  assert.deepEqual(misread, plan({ safe_to_change_now: 'yes' }), 'the plan is exactly as it would be with no words');
  const step = misread.actions.find(a => (a.refs || []).includes('f1') && !['document', 'talk_to_advocate'].includes(a.action));
  assert.equal(step.action, 'wait');
});

test('the keyword reader skips a sentence that says the way in is not there', () => {
  assert.deepEqual(keywordTold('I do not have an AirTag.').codes, []);
  assert.deepEqual(keywordTold('He never bought me a phone.').codes, []);
  assert.deepEqual(keywordTold('No, he is not on my Life360.').codes, []);
  assert.deepEqual(keywordTold("There is an app on my phone I didn't install.").codes, ['phone.app.control']);
  assert.deepEqual(keywordTold('He forwarded my mail to his Gmail and I never changed it.').codes, ['gmail.forwarding.external']);
});
