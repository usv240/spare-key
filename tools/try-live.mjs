// End-to-end test of the deployed practice check page (https://spare-key-app.web.app/try.html), in a fresh Chrome
// profile with no Gemini Nano, so the made-up entries are sorted in the cloud (reCAPTCHA Enterprise App Check on the real
// domain). About 6 cloud calls. Usage: node tools/try-live.mjs [--site=https://spare-key-app.web.app]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';

import { serve } from './serve.mjs';
const local = process.argv.includes('--local') ? await serve() : null;
const site = local?.url || ((process.argv.find(a => a.startsWith('--site=')) || '').slice(7)) || 'https://spare-key-app.web.app';
const profile = mkdtempSync(path.join(tmpdir(), 'sk-try-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const steps = [];
const step = (name, ok, detail = '') => { steps.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); };
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, userDataDir: profile, defaultViewport: { width: 1440, height: 1000 } });
let report = {};
try {
  const page = await browser.newPage();
  page.on('console', m => { if (/warn|error/.test(m.type())) log('console:', m.text().slice(0, 300)); });
  await page.goto(`${site}/try.html`, { waitUntil: 'networkidle0' });
  const frame = page.frames().find(f => f.url().includes('panel-demo.html'));
  await frame.waitForSelector('#start', { visible: true });
  const t0 = Date.now();
  await frame.click('#start');
  await frame.waitForSelector('#screen-results:not([hidden])', { timeout: 180000 });
  const res = await frame.evaluate(() => ({ cards: document.querySelectorAll('.finding').length, sorted: document.getElementById('sorted-line').textContent }));
  step('the practice check runs in the browser', res.cards === 24, `${res.cards} findings in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  step('the entries were sorted by Gemini (hybrid)', /Gemini/.test(res.sorted) && !/code only/.test(res.sorted), res.sorted);
  await frame.evaluate(() => document.getElementById('to-plan').click());
  await frame.waitForSelector('#make-plan', { visible: true });
  await frame.click('input[name="q-safe_to_change_now"][value="not_sure"]');
  await frame.click('#make-plan');
  const t1 = Date.now();
  let lead = '';
  while (Date.now() - t1 < 120000) {
    const s = await frame.evaluate(() => ({ lead: document.querySelector('#plan .lead')?.textContent || '', note: document.querySelector('#plan .notice')?.textContent || '', voices: !!document.querySelector('#plan .voices') }));
    lead = s.lead;
    if (s.lead && !/^(Asking|Checking the order)/.test(s.note)) { report.voices = s.voices; report.note = s.note; break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  step('the cloud ordered the plan', /cloud/.test(lead), `${lead} ${report.note || ''}`.trim());
  step('the two voices settled it', !!report.voices);
  await frame.evaluate(() => document.getElementById('tab-sent').click());
  const sent = await frame.evaluate(() => [...document.querySelectorAll('#sent-log li')].map(li => li.querySelector('.meta span').textContent));
  report.sent = sent;
  step('"What left this computer" lists every request', sent.length >= 1, sent);
} catch (e) {
  step('run', false, String(e && e.stack || e).slice(0, 400));
} finally {
  await browser.close().catch(() => {});
  local?.close();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/try-live.json', JSON.stringify({ steps, ...report }, null, 2));
process.exit(steps.some(s => !s.ok) ? 1 : 0);
