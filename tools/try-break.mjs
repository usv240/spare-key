// End-to-end test of try.html's "Break the pages first" and "Jordan's phone", on the deployed site (or --local), in a
// fresh Chrome profile with no Gemini Nano, so Gemini in the cloud reads what the code cannot (made-up data only).
// Runs the pages changed all four ways, without and then with the Remote Config fix, then reads Jordan's made-up
// screenshot. About 12 cloud calls. Usage: node tools/try-break.mjs [--local] [--kind=all]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';
import { serve } from './serve.mjs';

const local = process.argv.includes('--local') ? await serve() : null;
const site = local?.url || 'https://spare-key-app.web.app';
const kind = (process.argv.find(a => a.startsWith('--kind=')) || '--kind=all').slice(7);
const profile = mkdtempSync(path.join(tmpdir(), 'sk-break-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const steps = [];
const step = (name, ok, detail = '') => { steps.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, detail); };
const out = path.resolve('tools/out/try-break');
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, userDataDir: profile, defaultViewport: { width: 1440, height: 1000 }, protocolTimeout: 600000 });
try {
  const page = await browser.newPage();
  page.on('console', m => { if (/warn|error/.test(m.type())) log('console:', m.text().slice(0, 200)); });
  const run = async fix => {
    await page.goto(`${site}/try.html`, { waitUntil: 'networkidle0' });
    const frame = page.frames().find(f => f.url().includes('panel-demo.html'));
    await frame.waitForSelector('#start', { visible: true });
    await frame.evaluate(() => { document.getElementById('break-it').open = true; });
    await frame.click(`input[name="drift"][value="${kind}"]`);
    if (fix) await frame.click('#apply-fix');
    const t0 = Date.now();
    await frame.click('#start');
    await frame.waitForSelector('#screen-results:not([hidden])', { timeout: 300000 });
    const r = await frame.evaluate(() => ({
      drift: document.getElementById('drift-line').textContent,
      cards: document.querySelectorAll('.finding').length,
      notChecked: [...document.querySelectorAll('.not-checked li, .skipped li')].map(li => li.textContent.slice(0, 80)),
      sorted: document.getElementById('sorted-line').textContent,
    }));
    r.seconds = Math.round((Date.now() - t0) / 1000);
    return { frame, r };
  };

  const broken = await run(false);
  log('broken:', JSON.stringify(broken.r).slice(0, 700));
  step('changed pages: the result says what happened', /code reader read/.test(broken.r.drift), broken.r.drift);
  step('changed pages: pages that could not be read are listed, not shown as empty', broken.r.notChecked.length > 0 || /read \d+ more/.test(broken.r.drift), `${broken.r.notChecked.length} listed`);
  await page.screenshot({ path: path.join(out, `broken-${kind}.png`) });

  const fixed = await run(true);
  log('fixed:', JSON.stringify(fixed.r).slice(0, 400));
  step('with the Remote Config fix, the code reader reads every page', /read 12 of 12/.test(fixed.r.drift) && fixed.r.cards === 24, `${fixed.r.cards} findings; ${fixed.r.drift}`);

  // Jordan's phone, after the fixed run's results.
  const f = fixed.frame;
  await f.waitForSelector('#read-shot', { visible: true });
  await f.click('#read-shot');
  await f.waitForFunction(() => /added|could not|refused/.test(document.getElementById('shot-status').textContent), { timeout: 300000 });
  const shot = await f.evaluate(() => ({ status: document.getElementById('shot-status').textContent, cards: document.querySelectorAll('.finding').length }));
  step('Jordan\'s screenshot is read and its people are added', /2 added/.test(shot.status) && shot.cards === 26, `${shot.cards} findings; ${shot.status}`);
  const sent = await f.evaluate(() => { document.getElementById('tab-sent').click(); return { ledger: document.getElementById('ledger').innerText, log: document.getElementById('sent-log').innerText.slice(0, 600) }; });
  step('the ledger lists where requests went', /Sent to/.test(sent.ledger), sent.ledger.replace(/\s+/g, ' ').slice(0, 200));
  step('the screenshot request is logged by its hash, not its pixels', /read_screenshot/.test(sent.log) && /sha256/.test(sent.log), '');
  await page.screenshot({ path: path.join(out, `fixed-${kind}-shot.png`) });
} catch (e) {
  step('run', false, String(e && e.stack || e).slice(0, 400));
} finally {
  await browser.close();
  local?.close();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
writeFileSync(path.join(out, 'report.json'), JSON.stringify(steps, null, 1));
const failed = steps.filter(s => !s.ok).length;
log(failed ? `${failed} FAILED` : `ALL PASSED (${steps.length} steps)`);
process.exit(failed ? 1 : 0);
