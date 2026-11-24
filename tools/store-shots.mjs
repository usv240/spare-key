// Chrome Web Store screenshots (1280 x 800) from the demo footage tools/record-demo.mjs saved (the real extension on the
// made-up practice pages): a headline on the left, the side panel on the right.
//   node tools/record-demo.mjs && node tools/store-shots.mjs [--from=E:/spare-key-video]     writes tools/out/store/
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from './chrome-args.mjs';

const FROM = (process.argv.find(a => a.startsWith('--from=')) || '--from=E:/spare-key-video').slice(7);
const OUT = path.resolve('tools/out/store');
mkdirSync(OUT, { recursive: true });
const M = JSON.parse(readFileSync(path.join(FROM, 'marks.json'), 'utf8'));
const frames = JSON.parse(readFileSync(path.join(FROM, 'panel', 'frames.json'), 'utf8'));
const at = t => pathToFileURL(path.join(FROM, 'panel', (frames.filter(f => f.t <= t).pop() || frames[0]).file)).href;
const font = pathToFileURL(path.resolve('extension/fonts/AtkinsonHyperlegibleNext-latin.woff2')).href;
const shots = [
  ['1-results', M.finding + 0.5, 'Who can still see your location, your mail or your account', 'Spare Key reads your own settings pages, read-only, and lists every person, device and app that can still get in.'],
  ['2-plan', M.plan + 0.5, 'A plan that follows the field\'s advice', 'Screenshots first, then an advocate, then changes at a time that is right for you. Code checks every plan against nine safety rules.'],
  ['3-safety', M.safety + 1, 'Quick exit on every screen', 'One click, Escape twice, or Alt+Shift+X clears the session and shows an ordinary page.'],
  ['4-hood', (M.ledger || M.hood) + 0.2, 'Names never leave your computer', 'Gemini Nano sorts entries on the device. The cloud sees finding types only, and every request is shown word for word.'],
];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  for (const [name, t, head, sub] of shots) {
    const f = path.join(OUT, `${name}.html`);
    writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: A; src: url("${font}"); font-weight: 200 800; }
html, body { margin: 0; width: 1280px; height: 800px; background: #F7F4EE; color: #1F2328; font-family: A, sans-serif; overflow: hidden; }
.t { position: absolute; left: 72px; top: 0; bottom: 0; width: 640px; display: flex; flex-direction: column; justify-content: center; }
.b { font-size: 22px; font-weight: 700; color: #2F5D50; }
h1 { font-size: 50px; line-height: 1.08; letter-spacing: -0.02em; margin: 18px 0 0; text-wrap: balance; }
p { font-size: 23px; line-height: 1.45; color: #4A5058; margin: 22px 0 0; }
.p { position: absolute; right: 72px; top: 28px; width: 336px; height: 744px; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 14px 40px rgba(31,35,40,.16); }
.p img { width: 336px; display: block; }
</style><div class="t"><div class="b">Spare Key</div><h1>${head}</h1><p>${sub}</p></div><div class="p"><img src="${at(t)}"></div>`);
    await page.goto(pathToFileURL(f).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('wrote', path.join(OUT, `${name}.png`));
  }
} finally {
  await browser.close();
}
