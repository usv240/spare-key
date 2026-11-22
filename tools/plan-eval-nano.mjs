// The plan safety evaluation for the plan made on this computer (extension/src/device-plan.js): the same 40 situations
// as the cloud run (tools/plan-scenarios.json, written before any run), each sent to Gemini Nano through the
// extension's own offscreen page. No cloud calls. tools/plan-eval-score.mjs scores the saved answers offline with the
// same measures as the cloud plan.
// Each situation's answer is saved as it comes, and --resume skips situations already answered. A situation that
// takes past the plan's own time limit (extension/src/device-plan.js) counts as a failure, as it would for a person.
// Usage: node build.mjs && node tools/plan-eval-nano.mjs [--limit=5] [--resume]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';
import { toCloud } from '../shared/cloud-safe.js';
import { libraryMap } from '../shared/steps-schema.js';

const limit = Number((process.argv.find(a => a.startsWith('--limit=')) || '').slice(8)) || Infinity;
const { scenarios } = JSON.parse(readFileSync('tools/plan-scenarios.json', 'utf8'));
const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

freshServiceWorkers(NANO_PROFILE);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: NANO_PROFILE, defaultViewport: null, protocolTimeout: 900000,
  ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: NANO_PROFILE }), '--window-size=900,700', '--no-first-run', '--no-default-browser-check'],
});
const OUT = 'tools/out/plan-eval-nano.json';
mkdirSync('tools/out', { recursive: true });
let runs = {};
if (process.argv.includes('--resume')) { try { runs = JSON.parse(readFileSync(OUT, 'utf8')).runs || {}; } catch { /* first run */ } }
const save = () => writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString().slice(0, 10), model: 'Gemini Nano (Chrome built-in)', runs }, null, 1));
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/build/BUILD.txt`);
  const ask = (type, options) => page.evaluate(async (type, options) => {
    await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
    return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
  }, type, options);
  const t0 = Date.now();
  while ((await ask('sk:nano-status', {}))?.status !== 'available') {
    if (Date.now() - t0 > 180000) throw new Error('Gemini Nano is not available');
    await new Promise(r => setTimeout(r, 3000));
  }
  await ask('sk:nano-warm', {});
  for (const s of scenarios.slice(0, limit)) {
    if (runs[s.id]?.N) continue;
    // Every situation answer is used: nothing leaves this computer.
    const shared = Object.fromEntries(Object.keys(s.situation).map(k => [k, true]));
    const findings = s.findings.map(f => ({ ref: f.ref, code: f.code, ownership: f.ownership, recency: f.recency, howFound: f.how_found }));
    const { body, refs } = toCloud(findings, { situation: s.situation, shared, notChecked: s.notChecked });
    const t = Date.now();
    const r = await ask('sk:device-plan', { body, library });
    const ms = Date.now() - t;
    if (r?.error || !r?.answer) { runs[s.id] = { error: String(r?.error || 'no answer').slice(0, 300), ms }; log(s.id, 'error', runs[s.id].error); save(); continue; }
    // Back to the scenario's own refs, as the panel does.
    const answer = { ...r.answer, actions: (r.answer.actions || []).map(a => ({ ...a, refs: (Array.isArray(a.refs) ? a.refs : []).map(x => refs[x]).filter(Boolean) })) };
    runs[s.id] = { N: answer, ms };
    log(s.id, `${(ms / 1000).toFixed(1)} s, ${answer.actions.length} steps`);
    save();
  }
} finally {
  await browser.close();
}
save();
log(`wrote tools/out/plan-eval-nano.json: ${Object.values(runs).filter(r => r.N).length} of ${Object.keys(runs).length} answered`);
