// Runs the website's practice check on the local development build and makes the plan with Gemini in the cloud, then
// reads "What left this computer" to see whether the plan went through the server prompt template or the direct call.
// About 3 to 6 cloud calls (the plan, its function calls, and the two voices). Needs a development build (node build.mjs)
// with the gitignored App Check debug token, because App Check refuses automated browsers otherwise.
//   node build.mjs && node tools/template-check.mjs
import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome-args.mjs';
import { serve } from './serve.mjs';
const srv = await serve(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run'], protocolTimeout: 600000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let code = 1;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', e => console.log('page error:', String(e).slice(0, 200)));
  await page.goto(`${srv.url}/try.html`, { waitUntil: 'networkidle2' });
  const f = page.frames().find(x => x.url().includes('panel-demo.html'));
  await f.waitForSelector('#start', { visible: true, timeout: 60000 });
  await sleep(2500);
  await f.evaluate(() => document.getElementById('start').click());
  await f.waitForSelector('#screen-results:not([hidden])', { timeout: 600000 });
  await f.evaluate(() => document.getElementById('to-plan').click());
  await f.waitForSelector('#make-plan', { visible: true });
  const t0 = Date.now();
  await f.click('#make-plan');
  // Wait until the plan's note says who ordered it, or that the cloud did not.
  await f.waitForFunction(() => /Ordered by|ordered by|did not answer|was busy|was not asked|two voices/i.test(document.getElementById('plan')?.innerText || ''), { timeout: 240000 }).catch(() => {});
  await sleep(1500);
  const seconds = Math.round((Date.now() - t0) / 100) / 10;
  const plan = await f.evaluate(() => (document.getElementById('plan')?.innerText || '').split('\n').filter(Boolean).slice(0, 6));
  await f.evaluate(() => document.getElementById('tab-sent')?.click());
  await sleep(800);
  const sent = await f.evaluate(() => [...document.querySelectorAll('#sent-log li')].map(li => li.querySelector('.meta')?.innerText.replace(/\s+/g, ' ').trim()));
  console.log(`plan after ${seconds} s:`);
  for (const l of plan) console.log('  ', l.slice(0, 200));
  console.log('sent (newest first):');
  for (const s of sent) console.log('  ', s);
  code = sent.some(s => /template spare-key-plan/.test(s)) ? 0 : 1;
  console.log(code === 0 ? 'THE PLAN WENT THROUGH THE SERVER PROMPT TEMPLATE' : 'No template request was logged');
} finally { await browser.close(); srv.close(); }
process.exit(code);
