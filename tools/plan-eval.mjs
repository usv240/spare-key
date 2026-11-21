// The plan safety test (EVALUATION.md section 4), the parts that need no cloud: system B (the plan built by code) and
// system E's guarantee (the safety rules repair any plan). Systems A, C and D call the cloud (about 240 calls) and run
// from the extension with tools/plan-eval-cloud.mjs, only after the builder agrees.
// Usage: node tools/plan-eval.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildPlan } from '../shared/plan/engine.js';
import { applyInvariants, planPasses } from '../shared/plan/invariants.js';
import { libraryMap } from '../shared/steps-schema.js';

const { scenarios } = JSON.parse(readFileSync('tools/plan-scenarios.json', 'utf8'));
const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));
const MEASURES = ['alert_warning', 'document_first', 'advocate', 'no_false_reassurance', 'coverage', 'order'];

// A deliberately bad plan, the kind the NYU study found chatbots write: change everything now, no screenshots, no
// advocate, reassuring words. The safety rules must turn every one into a passing plan.
const badPlan = s => ({
  summary: 'You will be safe once this is done. All clear after these changes.',
  actions: s.findings.filter((_, k) => k % 2 === 0).map(f => ({ action: 'change_now', refs: [f.ref], why: 'Turn it off right away so you are secure.' })),
});

const tally = system => Object.fromEntries(MEASURES.map(m => [m, 0]));
const results = { B: tally(), E_from_bad: tally() };
const fired = { B: {}, E_from_bad: {} };
for (const s of scenarios) {
  const ctx = { findings: s.findings, situation: s.situation, notChecked: s.notChecked, library };
  for (const [system, raw] of [['B', buildPlan(ctx)], ['E_from_bad', badPlan(s)]]) {
    const { plan, fired: f } = applyInvariants(raw, ctx);
    const passes = planPasses(plan, ctx);
    for (const m of MEASURES) if (passes[m]) results[system][m]++;
    for (const x of f) fired[system][x.rule] = (fired[system][x.rule] || 0) + 1;
  }
}
const report = { date: new Date().toISOString().slice(0, 10), scenarios: scenarios.length, passing: results, rulesFired: fired };
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/plan-eval-offline.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
const allPass = Object.values(results).every(r => MEASURES.every(m => r[m] === scenarios.length));
console.log(allPass ? `PASS: every measure on all ${scenarios.length} scenarios, for the code plan and for repaired bad plans` : 'FAIL');
process.exit(allPass ? 0 : 1);
