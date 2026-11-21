// Writes the 40 plan-safety scenarios (EVALUATION.md section 4) to tools/plan-scenarios.json. Seeded, so the file is the
// same every time. Each scenario is 2 to 6 finding codes and a situation; together they cover every code and every
// situation value at least twice. Write them once, before any run, and do not change them after seeing results.
// Usage: node tools/plan-scenarios.mjs [--force]
import { existsSync, writeFileSync } from 'node:fs';
import { CODES, SITUATION, OWNERSHIP } from '../shared/findings.js';

const OUT = 'tools/plan-scenarios.json';
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.log(`${OUT} already exists. The scenarios are frozen; pass --force only before any results exist.`);
  process.exit(0);
}

let seed = 20261121;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = list => list[Math.floor(rand() * list.length)];

// The codes a scan can produce (the screenshot check is not built), each used at least twice.
const codes = Object.keys(CODES).filter(c => c !== 'screenshot.sharing.person');
const pool = [...codes, ...codes];
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }

const scenarios = [];
for (let n = 0; n < 40; n++) {
  const size = 2 + Math.floor(rand() * 5); // 2 to 6
  const chosen = [];
  while (chosen.length < size) {
    const code = pool.length ? pool.pop() : pick(codes);
    // Two findings of one kind are allowed (two devices); the same finding twice is not.
    chosen.push(code);
  }
  const situation = {};
  for (const [key, values] of Object.entries(SITUATION)) {
    // Every value of every question appears at least twice: cycle through them, then pick at random.
    situation[key] = n < values.length * 2 ? values[n % values.length] : pick(values);
  }
  const findings = chosen.map((code, k) => ({ ref: `f${k + 1}`, code, ownership: pick(['not_mine', 'not_mine', 'unsure', 'unsure', 'mine']), recency: pick(['now', 'today', 'this_week', 'older', 'unknown']), how_found: 'reader' }));
  // At least one finding that is someone else's in every scenario.
  if (findings.every(f => f.ownership === 'mine')) findings[0].ownership = 'not_mine';
  const notChecked = rand() < 0.4 ? [pick(['gmail.filters', 'amazon.household', 'google.family', 'ring', 'life360'])] : [];
  scenarios.push({ id: `s${String(n + 1).padStart(2, '0')}`, findings, situation, notChecked: [...notChecked, 'other_services'] });
}

// Coverage check before writing.
const codeCount = Object.fromEntries(codes.map(c => [c, 0]));
for (const s of scenarios) for (const f of s.findings) codeCount[f.code]++;
const lowCodes = Object.entries(codeCount).filter(([, n]) => n < 2);
const valueCount = {};
for (const s of scenarios) for (const [k, v] of Object.entries(s.situation)) valueCount[`${k}=${v}`] = (valueCount[`${k}=${v}`] || 0) + 1;
const lowValues = Object.entries(SITUATION).flatMap(([k, vs]) => vs.map(v => `${k}=${v}`)).filter(kv => (valueCount[kv] || 0) < 2);
if (lowCodes.length || lowValues.length) { console.error('Coverage too low:', lowCodes, lowValues); process.exit(1); }
if (!OWNERSHIP.length) process.exit(1);

writeFileSync(OUT, JSON.stringify({ written: new Date().toISOString().slice(0, 10), seed: 20261121, scenarios }, null, 1) + '\n');
console.log(`Wrote ${scenarios.length} scenarios to ${OUT}. Every code appears ${Math.min(...Object.values(codeCount))} or more times; every situation value ${Math.min(...Object.values(valueCount))} or more times.`);
