// Screenshots of the plan screen from the demo panel (the code plan, no cloud calls), light and dark, 360 and 500 px.
// Usage: node build.mjs && node tools/plan-shots.mjs [out-dir] [--sample]
//   --sample also writes web/public/sample-plan.pdf: the made-up person's plan as the panel prints it.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { CHROME } from './chrome-args.mjs';
import { serve } from './serve.mjs';

const out = process.argv.slice(2).find(a => !a.startsWith('--')) || 'shots';
mkdirSync(out, { recursive: true });
const srv = await serve(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run'] });
try {
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
  page.on('pageerror', e => console.log('page error:', e.message));
  page.on('response', r => { if (r.status() >= 400) console.log('missing:', r.status(), r.url()); });
  for (const [scheme, now, width] of [['light', 'no', 360], ['dark', 'yes', 360], ['light', 'yes', 500]]) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.setViewport({ width, height: 900 });
    await page.goto(`${srv.url}/panel-demo.html?mode=demo`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#to-plan', { visible: true });
    await page.click('#to-plan');
    await page.waitForSelector('#make-plan', { visible: true });
    await page.click(`input[name="q-safe_to_change_now"][value="${now}"]`);
    await page.click('#make-plan');
    await page.waitForSelector('#plan ol.plan');
    // Open the first folded block so the shot shows what is inside.
    await page.evaluate(() => { const d = document.querySelector('#plan details.code-block'); if (d) d.open = true; });
    const info = await page.evaluate(() => ({
      sections: [...document.querySelectorAll('#plan .step-kind')].map(e => e.textContent),
      blocks: document.querySelectorAll('#plan .code-block').length,
      summary: document.querySelector('#plan .plan-summary')?.textContent,
      nulls: document.querySelector('#plan').textContent.includes('null') || document.querySelector('#plan').textContent.includes('undefined'),
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    console.log(scheme, now, width, JSON.stringify(info));
    await page.screenshot({ path: path.join(out, `plan-${now}-${width}-${scheme}.png`), fullPage: true });
  }
  // The plan as it prints, for the advocates page: the made-up person's plan, every folded block open, on paper sizes.
  // It is the panel's own print layout (panel.css, @media print), not a drawing of it.
  if (process.argv.includes('--sample')) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.setViewport({ width: 500, height: 900 });
    await page.goto(`${srv.url}/panel-demo.html?mode=demo`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#to-plan', { visible: true });
    await page.click('#to-plan');
    await page.waitForSelector('#make-plan', { visible: true });
    await page.click('input[name="q-safe_to_change_now"][value="no"]');
    await page.click('#make-plan');
    await page.waitForSelector('#plan ol.plan');
    await page.evaluate(() => { for (const d of document.querySelectorAll('#plan details')) d.open = true; });
    await page.pdf({ path: 'web/public/sample-plan.pdf', format: 'Letter', printBackground: false, margin: { top: '0.6in', bottom: '0.6in', left: '0.7in', right: '0.7in' } });
    console.log('wrote web/public/sample-plan.pdf');
  }
} finally {
  await browser.close();
  srv.close();
}
