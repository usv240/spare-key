// End-to-end practice check through the real extension: open the side panel, choose the practice check, start it, and
// compare the findings with web/practice/pages.mjs EXPECTED. The practice pages are read from the deployed site
// (https://spare-key-app.web.app/practice/), the same path a judge's copy takes. No cloud calls.
//
//   node build.mjs && node tools/e2e-practice.mjs            fresh profile, no Gemini Nano (code only)
//   node tools/e2e-practice.mjs --nano                       the Gemini Nano test profile (code plus Nano)
//   --screens   also save screenshots of the scan and the results to tools/out/e2e/
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';
import { EXPECTED } from '../web/practice/pages.mjs';

const args = process.argv.slice(2);
const nano = args.includes('--nano');
const screens = args.includes('--screens');
const kept = nano ? NANO_PROFILE : '';
const profile = kept || mkdtempSync(path.join(tmpdir(), 'sk-e2e-'));
const out = path.resolve('tools/out/e2e');
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const steps = [];
const step = (name, ok, detail = '') => { steps.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); };

freshServiceWorkers(kept);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, defaultViewport: null,
  ...(kept ? { ignoreDefaultArgs: true } : {}),
  args: [...(kept ? builtInModelArgs({ userDataDir: profile }) : []), '--window-size=1400,950', '--no-first-run', '--no-default-browser-check'],
});
let id = '';
let report = {};
try {
  id = await browser.installExtension(path.resolve('extension'));
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Open the side panel with a user gesture, from an extension page.
  const helper = await browser.newPage();
  await helper.goto(`chrome-extension://${id}/build/BUILD.txt`);
  await page.bringToFront();
  const cdp = await helper.createCDPSession();
  await cdp.send('Runtime.evaluate', { expression: 'chrome.windows.getLastFocused().then(w => chrome.sidePanel.open({ windowId: w.id }))', userGesture: true, awaitPromise: true });
  await cdp.detach();
  await helper.close();
  const panel = await (await browser.waitForTarget(t => t.url() === `chrome-extension://${id}/src/panel.html`, { timeout: 15000 })).asPage();
  panel.on('console', m => { if (/error|warn/i.test(m.type())) log('panel console:', m.type(), m.text().slice(0, 300)); });
  panel.on('pageerror', e => log('panel error:', String(e).slice(0, 300)));
  await panel.waitForSelector('#practice', { visible: true });

  if (nano) {
    const t0 = Date.now();
    let s = '';
    while (Date.now() - t0 < 120000) {
      s = await panel.evaluate(() => LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })).catch(e => String(e));
      if (s === 'available') break;
      await new Promise(r => setTimeout(r, 3000));
    }
    step('Gemini Nano is available', s === 'available', s);
    // A person reads the safety screen first; the panel loads Gemini Nano meanwhile. Wait for that, and time it.
    const w0 = Date.now();
    const warm = await panel.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
      return chrome.runtime.sendMessage({ target: 'offscreen', type: 'sk:nano-warm' });
    });
    step('Gemini Nano loads while the first screens show', !!warm?.ok, `${((Date.now() - w0) / 1000).toFixed(1)} s`);
    report.warmMs = Date.now() - w0;
  }

  await panel.click('#practice');
  await panel.waitForSelector('#start', { visible: true });
  // Tick every check (a previous run in a kept profile may have unticked some).
  await panel.evaluate(() => { for (const b of document.querySelectorAll('input[name="check"]')) b.checked = true; });
  const t0 = Date.now();
  await panel.click('#start');
  await panel.waitForSelector('#screen-scanning:not([hidden]), #screen-results:not([hidden])', { timeout: 30000 });
  step('scan starts and shows progress', true);
  if (screens) { await new Promise(r => setTimeout(r, 2500)); await panel.screenshot({ path: path.join(out, `scanning${nano ? '-nano' : ''}.png`), fullPage: true }); }
  await panel.waitForSelector('#screen-results:not([hidden])', { timeout: nano ? 600000 : 180000 });
  const ms = Date.now() - t0;
  step('results appear', true, `${(ms / 1000).toFixed(1)} s`);

  const scan = await panel.evaluate(() => chrome.storage.session.get('scan').then(r => r.scan));
  report = { ...report, ms, nano, outcomes: scan.outcomes, findings: scan.findings.map(f => ({ check: f.check, code: f.code, howFound: f.howFound, recency: f.recency, label: f.label, disagree: f.disagree })) };
  const key = ([c, code]) => `${c} ${code}`;
  const missing = EXPECTED.map(key);
  const extra = [];
  for (const f of scan.findings) {
    const i = missing.indexOf(key([f.check, f.code]));
    if (i >= 0) missing.splice(i, 1); else extra.push(key([f.check, f.code]));
  }
  step('every planted path is found', !missing.length, missing.length ? missing : `${EXPECTED.length} of ${EXPECTED.length}`);
  step('no false alarms', !extra.length, extra);
  const notChecked = scan.outcomes.filter(o => o.status !== 'checked').map(o => `${o.id}:${o.why}`);
  step('every page check was read', scan.outcomes.length > 0 && !notChecked.length, notChecked.length ? notChecked : `${scan.outcomes.length} checks`);
  if (nano) step('Gemini Nano classified the entries', scan.findings.some(f => f.howFound === 'both'), scan.findings.map(f => f.howFound).join(','));
  const ui = await panel.evaluate(() => ({
    groups: [...document.querySelectorAll('#results h2')].map(h => h.textContent.trim()),
    cards: document.querySelectorAll('#results .finding').length,
    notChecked: !!document.querySelector('#results .not-checked'),
    rawEmail: /sam\.porter@example\.net/.test(document.querySelector('#results').innerText),
  }));
  step('the results list every finding', ui.cards === scan.findings.length, `${ui.cards} cards`);
  step('"Not checked" is shown', ui.notChecked);
  step('addresses are masked until "Show details"', !ui.rawEmail);

  // Answer one finding and confirm it is kept for this session only.
  await panel.click('#results .finding [data-answer="not_mine"]');
  await new Promise(r => setTimeout(r, 400));
  const answered = await panel.evaluate(() => chrome.storage.session.get('scan').then(r => r.scan.findings.filter(f => f.ownership === 'not_mine').length));
  step('"Not mine" is saved for this session', answered === 1);
  const local = await panel.evaluate(() => chrome.storage.local.get(null));
  step('nothing from the scan is in local storage', !JSON.stringify(local).includes('example.net'), Object.keys(local));
  if (screens) await panel.screenshot({ path: path.join(out, `results${nano ? '-nano' : ''}.png`), fullPage: true });
} catch (e) {
  step('run', false, String(e && e.stack || e).slice(0, 600));
} finally {
  if (kept && id) await browser.uninstallExtension(id).catch(() => {});
  await browser.close().catch(() => {});
  if (!kept) try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
writeFileSync(path.join(out, `e2e-practice${nano ? '-nano' : ''}.json`), JSON.stringify({ steps, ...report }, null, 2));
const failed = steps.filter(s => !s.ok).length;
log(failed ? `${failed} FAILED` : 'ALL PASSED', `(${steps.length} steps)`);
process.exit(failed ? 1 : 0);
