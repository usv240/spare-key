// Layout drift test (EVALUATION.md section 2). Every page reader runs on the 13 practice pages changed 5 ways
// (web/practice/drift.mjs), the way the scan engine runs it (extension/src/scan/engine.js), and is compared with
// web/practice/pages.mjs EXPECTED:
//   code       code only: the reader, then the code rules
//   fixed      code only, after the Remote Config fix for that kind of change (web/practice/drift-fixes.mjs), passed
//              through the same catalogue() function the extension runs on Remote Config's value
//   nano       (--nano) code and Gemini Nano, as the extension does: Nano reads the page when the reader finds nothing,
//              and sorts every entry; runs in the extension's own offscreen page, on this computer
// The measure that matters most is a silent miss: a way in that is not found on a check that says it was checked.
// A check that says "Not checked" is honest; one that says "checked" and misses a way in is not.
//
// Usage: node build.mjs && node tools/drift-test.mjs [--nano] [--kinds=reworded,all]
// Writes tools/out/drift.json and, for the site, web/src/data/drift.json. Made-up data only; no cloud calls.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';
import { serve } from './serve.mjs';
import { catalogue } from '../extension/src/scan/catalogue.js';
import { readPage } from '../extension/src/readers/read-page.js';
import { toFinding } from '../extension/src/scan/rules.js';
import { readToEntries } from '../extension/src/scan/engine.js';
import { EXPECTED, PRACTICE_OWNER } from '../web/practice/pages.mjs';
import { DRIFT, driftUrl } from '../web/practice/drift.mjs';
import { FIXES } from '../web/practice/drift-fixes.mjs';

const args = process.argv.slice(2);
const useNano = args.includes('--nano');
const only = (args.find(a => a.startsWith('--kinds=')) || '').slice(8).split(',').filter(Boolean);
const KINDS = [{ id: 'none', label: 'As made (no change)' }, ...DRIFT].filter(k => !only.length || only.includes(k.id));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const srv = await serve(0);
const profile = useNano ? NANO_PROFILE : undefined;
if (useNano) freshServiceWorkers(profile);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: !useNano, pipe: true, enableExtensions: useNano, userDataDir: profile, defaultViewport: null, protocolTimeout: 900000,
  ...(useNano ? { ignoreDefaultArgs: true } : {}),
  args: [...(useNano ? builtInModelArgs({ userDataDir: profile }) : []), '--window-size=1200,900', '--no-first-run', '--no-default-browser-check'],
});

// Gemini Nano through the extension's offscreen page, the same handlers the scan uses.
let nano = null;
async function setUpNano() {
  const id = await browser.installExtension(path.resolve('extension'));
  const panel = await browser.newPage();
  await panel.goto(`chrome-extension://${id}/build/BUILD.txt`);
  const t0 = Date.now();
  let s = '';
  while (Date.now() - t0 < 180000) {
    s = await panel.evaluate(() => LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })).catch(e => String(e));
    if (s === 'available') break;
    await new Promise(r => setTimeout(r, 3000));
  }
  if (s !== 'available') throw new Error(`Gemini Nano is not available: ${s}`);
  const ask = (type, options) => panel.evaluate(async (type, options) => {
    await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
    return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
  }, type, options);
  log('Gemini Nano: warming up');
  await ask('sk:nano-warm', {}).catch(() => {});
  return ask;
}

const key = (c, code) => `${c} ${code}`;
function compare(checkId, got) {
  const want = EXPECTED.filter(([c]) => c === checkId).map(([c, code]) => key(c, code));
  const missing = [...want];
  const extra = [];
  for (const k of got.map(f => key(checkId, f.code))) {
    const i = missing.indexOf(k);
    if (i >= 0) missing.splice(i, 1); else extra.push(k);
  }
  return { want: want.length, found: want.length - missing.length, missing, extra };
}

// One check, through the scan engine's own readToEntries. `reads` are the reader's results for the check's pages.
async function runCheck(check, reads, withNano) {
  const findings = [];
  let status = 'checked';
  let why = null;
  let how = 'reader';
  let partly = false;
  let nanoMs = 0;
  const ask = withNano ? async (type, options) => { const t0 = Date.now(); try { return await nano(type, options); } finally { nanoMs += Date.now() - t0; } } : null;
  for (const [k, read] of reads.entries()) {
    if (!read || read.errorPage) { status = 'not_checked'; why = 'did_not_load'; break; }
    const p = await readToEntries({ check, read, account: PRACTICE_OWNER, ask, reader: check.pages[k]?.reader });
    if (p.why) { status = 'not_checked'; why = p.why; break; }
    partly ||= p.partly;
    if (p.howFound === 'nano') how = 'nano'; else if (p.items && how === 'reader') how = 'both';
    for (const [i, entry] of p.entries.entries()) {
      const f = toFinding({ ref: `L${findings.length + 1}`, check, entry, cls: p.classes[i], howFound: p.hows[i], openUrl: check.pages[k].practiceUrl, account: PRACTICE_OWNER });
      if (f) findings.push(f);
    }
  }
  const listed = status === 'checked' ? findings : [];
  const cmp = compare(check.id, listed);
  // Shown: listed at all, perhaps as a more general kind (a teen listed as an adult, an app whose access the page did
  // not say listed as "can use your Google account"). Found: listed as exactly the planted kind.
  const shown = Math.min(listed.length, cmp.want);
  // A silent miss: a way in not shown on a check that says it was fully checked. "Not checked" and "checked in part"
  // both tell the person to look for themselves.
  return {
    id: check.id, status, why, how, partly, ...cmp, shown, extraCount: Math.max(0, listed.length - cmp.want),
    silent: status === 'checked' && !partly ? cmp.want - shown : 0, toldToLook: status !== 'checked' || partly ? cmp.want - shown : 0, nanoMs,
  };
}

const results = [];
try {
  if (useNano) nano = await setUpNano();
  const page = await browser.newPage();
  for (const kind of KINDS) {
    const modes = [['code', catalogue({}), false]];
    if (kind.id !== 'none') modes.push(['fixed', catalogue(FIXES[kind.id] || {}), false]);
    if (useNano) modes.push(['nano', catalogue({}), true]);
    for (const [mode, checks, withNano] of modes) {
      const t0 = Date.now();
      const rows = [];
      for (const check of checks.filter(c => c.pages.length)) {
        const reads = [];
        for (const p of check.pages) {
          const url = kind.id === 'none' ? p.practiceUrl : (p.practiceUrl.includes('/drift/') ? p.practiceUrl : driftUrl(p.practiceUrl, kind.id));
          await page.goto(`${srv.url}${url}`, { waitUntil: 'load' });
          reads.push(await page.evaluate(readPage, { ...p.reader, settleMs: 0, timeoutMs: 1500 }));
        }
        rows.push(await runCheck(check, reads, withNano));
      }
      const sum = f => rows.reduce((n, r) => n + f(r), 0);
      const row = {
        kind: kind.id, label: kind.label, mode,
        found: sum(r => r.found), shown: sum(r => r.shown), of: EXPECTED.length,
        silentMisses: sum(r => r.silent), toldToLook: sum(r => r.toldToLook), falseAlarms: sum(r => r.extraCount),
        notChecked: rows.filter(r => r.status === 'not_checked').length, checks: rows.length,
        nanoRead: rows.filter(r => r.how === 'nano').length,
        seconds: Math.round((Date.now() - t0) / 100) / 10, rows,
      };
      results.push(row);
      log(`${kind.id.padEnd(9)} ${mode.padEnd(6)} shown ${String(row.shown).padStart(2)} of ${row.of} (${row.found} as the right kind), silent misses ${row.silentMisses}, told to look ${row.toldToLook}, false alarms ${row.falseAlarms}, not checked ${row.notChecked} of ${row.checks}${useNano && mode === 'nano' ? `, Nano read ${row.nanoRead} pages, ${row.seconds} s` : ''}`);
      for (const r of rows) if (r.missing.length || r.extra.length || r.status !== 'checked') log(`    ${r.id.padEnd(18)} ${(r.status + (r.why ? ` (${r.why})` : r.partly ? " (in part)" : "")).padEnd(30)} ${r.how.padEnd(6)} missing ${JSON.stringify(r.missing.map(m => m.split(' ')[1]))} extra ${JSON.stringify(r.extra.map(m => m.split(' ')[1]))}`);
    }
  }
} finally {
  await browser.close();
  srv.close();
}

mkdirSync('tools/out', { recursive: true });
const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
writeFileSync(`tools/out/drift${useNano ? '-nano' : ''}.json`, JSON.stringify({ date, results }, null, 1));
// The site's copy keeps the totals; a --nano run adds its rows to the last code-only run's.
const sitePath = 'web/src/data/drift.json';
let site = {};
try { site = JSON.parse(readFileSync(sitePath, 'utf8')); } catch { /* first run */ }
const totals = results.map(({ rows, ...t }) => t);
const keep = (site.rows || []).filter(r => !totals.some(t => t.kind === r.kind && t.mode === r.mode));
// A fixed row order, so a run with the same results leaves the tracked file unchanged.
const KIND_ORDER = ['none', ...DRIFT.map(d => d.id)];
const MODE_ORDER = ['code', 'fixed', 'nano'];
const rowsOut = [...keep, ...totals].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode));
// The date is the day of a run that changed a number; a run that only confirms them keeps the file as it was.
const same = JSON.stringify(rowsOut.map(({ seconds, ...r }) => r)) === JSON.stringify((site.rows || []).map(({ seconds, ...r }) => r).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode)));
if (!same) writeFileSync(sitePath, JSON.stringify({ ...site, [useNano ? 'nanoDate' : 'date']: date, rows: rowsOut }, null, 1) + '\n');
log(`wrote tools/out/drift${useNano ? '-nano' : ''}.json and ${sitePath}`);
