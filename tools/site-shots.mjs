// Two jobs, both on the locally served site (web/dist):
//   --product   makes the landing page's pictures from the real interface (web/public/img/*.png): the scan view beside
//               the panel, a finding, and the plan. Made-up practice data only.
//   (default)   screenshots every site page at 375, 768 and 1440 px in light and dark, for the design review
//               (.impeccable/review/site/).
// Usage: node build.mjs && node tools/site-shots.mjs [--product] [--pages=index,try]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';
import { serve } from './serve.mjs';

const args = process.argv.slice(2);
const { url, close } = await serve();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('page error:', String(e).slice(0, 200)));
  if (args.includes('--product')) {
    const out = path.resolve('web/public/img');
    mkdirSync(out, { recursive: true });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

    // 1. The scan view beside the panel, mid-check, from the practice page (try.html).
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    await page.goto(`${url}/try.html`, { waitUntil: 'networkidle0' });
    const panel = page.frames().find(f => f.url().includes('panel-demo.html'));
    await panel.waitForSelector('#start', { visible: true });
    await panel.click('#start');
    await panel.waitForFunction(() => /devices|apps/.test(document.getElementById('scan-line').textContent), { timeout: 20000 });
    await sleep(900);
    const scanBox = await page.$eval('#scan-view', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; });
    const panelBox = await page.$eval('#panel-demo iframe', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; });
    await page.screenshot({ path: path.join(out, 'step-check.png'), clip: { x: scanBox.x, y: Math.min(scanBox.y, panelBox.y), width: panelBox.x + panelBox.w - scanBox.x, height: 600 } });
    console.log('step-check.png');

    // 2 and 3: the panel in demo mode, at the side panel's width, twice the pixels.
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 360, height: 900, deviceScaleFactor: 2 });
    await p2.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await p2.goto(`${url}/panel-demo.html`, { waitUntil: 'networkidle0' });
    await p2.evaluate(() => document.fonts.ready);
    // A finding with an answer chosen.
    await p2.evaluate(() => document.querySelectorAll('.finding [data-answer="not_mine"]')[0].click());
    await sleep(300);
    await p2.evaluate(() => document.activeElement?.blur());
    const first = await p2.$eval('#results .group h2', el => el.getBoundingClientRect().top + scrollY);
    await p2.screenshot({ path: path.join(out, 'step-understand.png'), clip: { x: 0, y: Math.max(0, first - 16), width: 360, height: 400 } });
    console.log('step-understand.png');
    // The plan built by code, with now not a good time.
    await p2.evaluate(() => document.getElementById('to-plan').click());
    await p2.waitForSelector('#make-plan');
    await p2.click('input[name="q-safe_to_change_now"][value="no"]');
    await p2.click('#make-plan');
    await sleep(500);
    const planTop = await p2.$eval('#plan .plan', el => el.getBoundingClientRect().top + scrollY);
    await p2.evaluate(() => document.activeElement?.blur());
    await p2.screenshot({ path: path.join(out, 'step-plan.png'), clip: { x: 0, y: Math.max(0, planTop - 12), width: 360, height: 400 } });
    console.log('step-plan.png');
  } else {
    const only = (args.find(a => a.startsWith('--pages=')) || '').slice(8);
    const names = only ? only.split(',') : ['index', 'try', 'how-it-works', 'built-with', 'privacy', 'accuracy', 'api', 'plant', 'safety', 'install'];
    const out = path.resolve('.impeccable/review/site');
    mkdirSync(out, { recursive: true });
    for (const scheme of ['light', 'dark']) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      for (const width of [375, 768, 1440]) {
        await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        for (const name of names) {
          await page.goto(`${url}/${name}.html`, { waitUntil: 'networkidle0' });
          await page.evaluate(async () => {
            for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
            await Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
            await document.fonts.ready;
          });
          await sleep(300);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          if (overflow > 1) console.log(`OVERFLOW ${name} ${width} ${scheme}: ${overflow}px`);
          await page.screenshot({ path: path.join(out, `${name}-${width}-${scheme}.png`), fullPage: true });
        }
      }
    }
    console.log(`screenshots in ${out}`);
  }
} finally {
  await browser.close();
  close();
}
