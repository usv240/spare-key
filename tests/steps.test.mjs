// The steps library: every code has an entry with official sources and a check date, and its words follow the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLibrary, libraryMap } from '../shared/steps-schema.js';
import { buildPlan } from '../shared/plan/engine.js';
import { applyInvariants, planPasses } from '../shared/plan/invariants.js';
import { CODES } from '../shared/findings.js';

const LIB = JSON.parse(readFileSync('data/steps.json', 'utf8'));

test('data/steps.json is valid: every code, official sources, dates', () => {
  assert.deepEqual(validateLibrary(LIB), []);
});

test('library words: no em dash, emoji, exclamation mark, "safe", "secure", "abuser" or "victim"', () => {
  const EM_DASH = String.fromCharCode(0x2014);
  for (const e of LIB.entries) {
    const text = [e.title, e.what_it_means, e.notice_why, e.if_not_safe_yet, ...e.steps, ...e.evidence_first].join(' ');
    assert.ok(!text.includes(EM_DASH), `${e.code}: em dash`);
    assert.ok(!/!/.test(text), `${e.code}: exclamation mark`);
    assert.ok(!/\b(safe|safely|secure|all clear|abuser|victim)\b/i.test(text), `${e.code}: banned word in "${text.match(/\b(safe|safely|secure|all clear|abuser|victim)\b/i)?.[0]}"`);
  }
});

test('the code plan with the real library passes every measure, for every code at once', () => {
  const library = libraryMap(LIB);
  const findings = Object.keys(CODES).map((code, i) => ({ ref: `f${i + 1}`, code, ownership: 'not_mine' }));
  for (const safe_to_change_now of ['yes', 'no', 'not_sure']) {
    const ctx = { findings, situation: { safe_to_change_now }, notChecked: ['ring'], library };
    const { plan } = applyInvariants(buildPlan(ctx), ctx);
    assert.ok(Object.values(planPasses(plan, ctx)).every(Boolean), safe_to_change_now);
  }
});

test('the validator catches a bad entry', () => {
  const bad = structuredClone(LIB);
  bad.entries[0].who_can_notice = 'unlikely';
  bad.entries[1].sources = [{ title: 'Blog', url: 'https://example.com/tips' }];
  bad.entries.pop();
  const problems = validateLibrary(bad);
  assert.ok(problems.some(p => p.includes('"unlikely" needs')));
  assert.ok(problems.some(p => p.includes('not an official help page')));
  assert.ok(problems.some(p => p.includes('no library entry')));
});
