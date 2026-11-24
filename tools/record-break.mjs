// Records "Break the pages first" on the site's practice check (the made-up person Jordan) with Gemini Nano: the pages
// changed all four ways, read once without the fix (the code reader fails on some, Gemini Nano reads them on this
// computer, the rest are listed as not checked), then again with the reader fix fetched from Remote Config.
// Frames and time marks go to <out>/break/ for tools/make-video.mjs.
//   node tools/record-break.mjs [--out=E:/spare-key-video-nano]     needs the Gemini Nano test profile
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CHROME, NANO_PROFILE, builtInModelArgs } from './chrome-args.mjs';

const OUT = ((process.argv.find(a => a.startsWith('--out=')) || '--out=E:/spare-key-video-nano').slice(6));
const dir = path.join(OUT, 'break');
mkdirSync(dir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const marks = {};
const mark = name => { marks[name] = +((Date.now() - t0) / 1000).toFixed(2); console.log(marks[name].toFixed(1).padStart(6), name); };
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, userDataDir: NANO_PROFILE, defaultViewport: null, protocolTimeout: 900000,
  ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: NANO_PROFILE }), '--window-size=560,1100', '--no-first-run', '--no-default-browser-check', '--hide-crash-restore-bubble'],
});
const frames = [];
try {
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.setViewport({ width: 520, height: 1000, deviceScaleFactor: 1.5 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  const s = await page.createCDPSession();
  s.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    const file = `${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: +(((metadata.timestamp ? metadata.timestamp * 1000 : Date.now()) - t0) / 1000).toFixed(3) });
    s.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await s.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });

  const run = async withFix => {
    await page.goto('https://spare-key-app.web.app/panel-demo.html?mode=live', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#screen-start:not([hidden]) #start', { visible: true, timeout: 60000 });
    // Wait for the page to find Gemini Nano (its status line says so).
    await page.waitForFunction(() => /Gemini Nano/i.test(document.getElementById('where-line')?.textContent || '') && !/Checking for/i.test(document.getElementById('where-line').textContent), { timeout: 120000 }).catch(() => {});
    mark(withFix ? 'fix start screen' : 'start screen');
    await sleep(1500);
    await page.evaluate(() => { document.getElementById('break-it').open = true; });
    await sleep(1200);
    await page.evaluate(() => { const r = document.querySelector('input[name="drift"][value="all"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(900);
    if (withFix) { await page.evaluate(() => { const c = document.getElementById('apply-fix'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(900); }
    mark(withFix ? 'fix chosen' : 'break chosen');
    await page.evaluate(() => document.getElementById('start').click());
    await page.waitForSelector('#screen-results:not([hidden])', { timeout: 900000 });
    mark(withFix ? 'fix results' : 'break results');
    await sleep(1200);
    await page.evaluate(() => document.getElementById('drift-line')?.scrollIntoView({ block: 'start' }));
    await sleep(5000);
    mark(withFix ? 'fix read' : 'break read');
    return page.evaluate(() => document.getElementById('drift-line')?.textContent || '');
  };
  const without = await run(false);
  const withFix = await run(true);
  marks.lines = { without, withFix };
  console.log('without fix:', without);
  console.log('with fix:', withFix);
  await s.send('Page.stopScreencast').catch(() => {});
} finally {
  writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames));
  const all = existsSync(path.join(OUT, 'marks.json')) ? JSON.parse(readFileSync(path.join(OUT, 'marks.json'), 'utf8')) : {};
  all.break = marks;
  writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(all, null, 1));
  await browser.close().catch(() => {});
}
