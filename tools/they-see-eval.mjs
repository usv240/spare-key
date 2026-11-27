// "What would they see?" (shared/they-see.js), measured with Gemini Nano on this computer: for each of the 18 kinds of
// finding on the practice check, the extension's own offscreen page writes the notice with the made-up names, and
// Spare Key's check decides whether it is shown or replaced by the library's words. No cloud calls.
//   node build.mjs && node tools/they-see-eval.mjs [--runs=3]      writes docs/evidence/they-see-eval.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { libraryMap } from '../shared/steps-schema.js';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';

const RUNS = Number((process.argv.find(a => a.startsWith('--runs=')) || '--runs=3').slice(7));
const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));
const scan = JSON.parse(readFileSync('web/src/data/practice-scan.json', 'utf8'));
const owner = scan.account?.name || 'Jordan Lee';
const cases = [];
for (const f of scan.findings) if (!cases.some(c => c.code === f.code) && library[f.code]) cases.push({ code: f.code, label: f.label });

freshServiceWorkers(NANO_PROFILE);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: [path.resolve('extension')], userDataDir: NANO_PROFILE,
  ignoreDefaultArgs: true, protocolTimeout: 900000, args: [...builtInModelArgs({ userDataDir: NANO_PROFILE }), '--no-first-run', '--window-size=900,700'],
});
const rows = [];
try {
  const sw = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 60000 });
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${new URL(sw.url()).host}/src/panel.html`);
  const ask = (type, options) => page.evaluate(async (type, options) => {
    await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
    return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
  }, type, options);
  console.log('Gemini Nano:', (await ask('sk:nano-status', {}))?.status);
  await ask('sk:nano-warm', {});
  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      const r = await ask('sk:they-see', { entry: library[c.code], label: c.label, owner });
      rows.push({ run, code: c.code, who: library[c.code].who_can_notice, ok: !!r?.ok, why: r?.why || r?.error || (r?.off ? 'no_nano' : ''), ms: r?.ms ?? null, text: r?.text || '' });
      process.stdout.write(`${run}/${RUNS} ${c.code} ${r?.ok ? 'shown' : r?.why || r?.error || 'off'}            \r`);
    }
  }
} finally { await browser.close(); }
console.log();
const answered = rows.filter(r => r.ms !== null);
const ms = answered.map(r => r.ms).sort((a, b) => a - b);
const why = {};
for (const r of rows.filter(x => !x.ok)) why[r.why] = (why[r.why] || 0) + 1;
const summary = { kinds: cases.length, runs: RUNS, answers: rows.length, answeredOnNano: answered.length, shown: rows.filter(r => r.ok).length, replacedByLibrary: why, medianMs: ms[Math.floor(ms.length / 2)] ?? null };
console.log(JSON.stringify(summary));
// Only a run where Gemini Nano answered every time is evidence; anything else (too little free memory, for one) goes to
// tools/out, so a failed run never stands in for a result.
const dir = answered.length === rows.length ? 'docs/evidence' : 'tools/out';
if (dir === 'tools/out') console.log(`Gemini Nano answered ${answered.length} of ${rows.length}: not evidence, written to tools/out.`);
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/they-see-eval.json`, JSON.stringify({ at: new Date().toISOString(), tool: 'node tools/they-see-eval.mjs', owner: 'the made-up practice person', summary, rows }, null, 1));
