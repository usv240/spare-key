// Records the demo video's footage through the real extension, on the practice pages only (a made-up person called
// Jordan): the side panel and the scan tab, each as its own screencast, with a time mark for every moment the video
// cuts to. No real account is opened. tools/make-video.mjs turns this into the video.
//   node build.mjs && node tools/record-demo.mjs [--nano] [--out=E:/spare-key-video]
//   --nano  uses the Gemini Nano test profile (needs about 4 GB of free memory)
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';

const args = process.argv.slice(2);
const nano = args.includes('--nano');
const OUT = (args.find(a => a.startsWith('--out=')) || '--out=E:/spare-key-video').slice(6);
mkdirSync(OUT, { recursive: true });
const profile = nano ? NANO_PROFILE : mkdtempSync(path.join(tmpdir(), 'sk-demo-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const marks = {};
const mark = name => { marks[name] = +((Date.now() - t0) / 1000).toFixed(2); console.log(marks[name].toFixed(1).padStart(6), name); };

if (nano) freshServiceWorkers(profile);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, defaultViewport: null, protocolTimeout: 900000,
  ...(nano ? { ignoreDefaultArgs: true } : {}),
  args: [...(nano ? builtInModelArgs({ userDataDir: profile }) : []), '--window-size=1500,1000', '--window-position=0,0', '--no-first-run', '--no-default-browser-check', '--hide-crash-restore-bubble'],
});
// Chrome's own screencast, frame by frame: each frame is saved as a JPEG with its time, and tools/make-video.mjs
// rebuilds the video from them. (Puppeteer's screencast() detached the side panel's frame here.)
const recorders = [];
async function record(page, name) {
  const dir = path.join(OUT, name);
  mkdirSync(dir, { recursive: true });
  const frames = [];
  const s = await page.createCDPSession();
  s.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    const n = frames.length;
    const file = `${String(n).padStart(5, '0')}.jpg`;
    writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: +(((metadata.timestamp ? metadata.timestamp * 1000 : Date.now()) - t0) / 1000).toFixed(3) });
    s.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await s.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  const rec = { name, stop: async () => { await s.send('Page.stopScreencast').catch(() => {}); writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames)); } };
  recorders.push(rec);
  return rec;
}
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto('https://spare-key-app.web.app/', { waitUntil: 'networkidle2' }).catch(() => {});
  const helper = await browser.newPage();
  await helper.goto(`chrome-extension://${id}/build/BUILD.txt`);
  await page.bringToFront();
  const cdp = await helper.createCDPSession();
  await cdp.send('Runtime.evaluate', { expression: 'chrome.windows.getLastFocused().then(w => chrome.sidePanel.open({ windowId: w.id }))', userGesture: true, awaitPromise: true });
  await helper.close();
  const panel = await (await browser.waitForTarget(t => t.url() === `chrome-extension://${id}/src/panel.html`, { timeout: 15000 })).asPage();
  await panel.waitForSelector('body[data-ready="1"] #practice', { visible: true, timeout: 60000 });
  await panel.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  // Every page the scan tab shows, recorded as it appears.
  browser.on('targetcreated', async t => {
    if (t.type() !== 'page' || !marks['start']) return;
    const p = await t.page().catch(() => null);
    if (!p) return;
    const name = `tab-${recorders.length}`;
    if (await record(p, name).catch(() => null)) marks[name] = +((Date.now() - t0) / 1000).toFixed(2);
  });
  await record(panel, 'panel');
  browser.on('targetdestroyed', t => { if (/panel\.html|^https?:/.test(t.url())) console.log('   closed:', t.type(), t.url().slice(0, 70)); });
  panel.on('framenavigated', f => { if (f === panel.mainFrame()) console.log('   panel navigated:', f.url().slice(0, 90)); });
  mark('panel recording');
  await sleep(1500);
  mark('safety');
  // Quick exit and the hotline are on this screen; let it be read.
  await sleep(6000);
  await panel.click('#practice');
  await panel.waitForSelector('#start', { visible: true });
  mark('choose');
  await sleep(4000);
  await panel.evaluate(() => { for (const b of document.querySelectorAll('input[name="check"]')) b.checked = true; });
  mark('start');
  await panel.click('#start');
  await panel.waitForSelector('#screen-scanning:not([hidden])', { timeout: 30000 });
  mark('scanning');
  await panel.waitForSelector('#screen-results:not([hidden])', { timeout: nano ? 900000 : 180000 });
  mark('results');
  await sleep(3000);
  // Scroll to the first finding card, then open its "i" sheet (what removing it would do).
  await panel.evaluate(() => document.querySelector('#results .finding')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(2500);
  mark('finding');
  await panel.evaluate(() => document.querySelector('#results .finding .info').click());
  await sleep(4500);
  mark('sheet');
  await panel.evaluate(() => document.getElementById('sheet-close').click());
  await sleep(800);
  await panel.evaluate(() => document.querySelector('#results .finding [data-answer="not_mine"]').click());
  await sleep(2000);
  mark('answered');
  // The "Not checked" list.
  await panel.evaluate(() => document.querySelector('#results .not-checked')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(3500);
  mark('not checked');
  // The plan, made on this computer (cloud help stays off in this recording).
  await panel.evaluate(() => document.getElementById('to-plan').click());
  await panel.waitForSelector('#make-plan', { visible: true });
  mark('questions');
  await sleep(2000);
  await panel.evaluate(s => document.querySelector(s).click(), 'input[name="q-safe_to_change_now"][value="no"]');
  await sleep(700);
  await panel.evaluate(s => document.querySelector(s).click(), 'input[name="q-has_advocate"][value="no"]');
  await sleep(1200);
  await panel.evaluate(s => document.querySelector(s).click(), '#make-plan');
  mark('make plan');
  await panel.waitForFunction(() => document.querySelectorAll('#plan .step-card, #plan li, #plan section').length > 2, { timeout: nano ? 300000 : 60000 });
  await sleep(1500);
  mark('plan');
  for (let y = 0; y < 6; y++) { await panel.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' })); await sleep(1600); }
  mark('plan end');
  // "What would they see?": Gemini Nano writes the other person's notice on this computer (only with --nano).
  if (nano) {
    const found = await panel.evaluate(() => {
      const all = [...document.querySelectorAll('#plan .they-see-button')];
      const items = b => b.parentElement?.querySelector('.items')?.textContent || '';
      const b = all.find(b => /Sam Porter/.test(items(b)) && /sharing|location/i.test(items(b))) || all.find(b => /Sam/.test(items(b))) || all[0];
      if (!b) return false;
      b.dataset.demo = '1';
      for (let d = b.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
      b.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    });
    if (found) {
      await sleep(2500);
      mark('they see');
      await panel.evaluate(() => document.querySelector('#plan .they-see-button[data-demo]').click());
      const shown = await panel.waitForSelector('#plan .they-see', { timeout: 120000 }).then(() => true, () => false);
      if (shown) {
        await panel.evaluate(() => document.querySelector('#plan .they-see').scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await sleep(5000);
        mark('they seen');
        console.log('   they see:', await panel.evaluate(() => document.querySelector('#plan .they-see').textContent.trim().slice(0, 300)));
      } else delete marks['they see'];
    }
  }
  // Under the hood: where each part runs, and the ledger.
  await panel.evaluate(() => { window.scrollTo({ top: 0 }); document.getElementById('tab-hood').click(); });
  await sleep(300);
  mark('hood');
  await sleep(4500);
  await panel.evaluate(() => document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(3500);
  mark('ledger');
  await panel.evaluate(() => document.getElementById('tab-check').click());
  await sleep(1000);
  mark('end');
} finally {
  for (const r of recorders) await r.stop().catch(() => {});
  await sleep(1500);
  writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ nano, ...marks }, null, 1));
  await browser.close().catch(() => {});
}
console.log('footage in', OUT);
