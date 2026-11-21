// Prepares a separate, persistent Chrome test profile with Gemini Nano, so the tests can run the extension's
// on-device steps. Your own Chrome profile is not read or touched: Chrome downloads the model into this profile itself,
// the same way it does for anyone (about 4 GB, once). Adapted from the author's Still Recalled entry.
// Usage: node tools/nano-profile.mjs [--profile=E:/spare-key-test/nano-profile]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { CHROME, NANO_PROFILE, builtInModelArgs } from './chrome-args.mjs';

const profile = (process.argv.find(a => a.startsWith('--profile=')) || `--profile=${NANO_PROFILE}`).slice(10);
mkdirSync(profile, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, userDataDir: profile,
  ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: profile }), '--no-default-browser-check', '--no-first-run'],
});
try {
  const page = await browser.newPage();
  await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  // Text only is what Spare Key needs for reading pages; text and image is for the screenshot check.
  const OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
  const status = () => page.evaluate(o => ('LanguageModel' in self ? LanguageModel.availability(o) : 'absent'), OPTS);
  // Chrome decides whether this computer can run the model shortly after it starts; until then it may say unavailable.
  let s = await status();
  for (let i = 0; i < 24 && s === 'unavailable'; i++) { await new Promise(r => setTimeout(r, 5000)); s = await status(); }
  log('Gemini Nano:', s);
  if (s === 'downloadable' || s === 'downloading') {
    // create() needs a user gesture to start a download; a real click gives one.
    await page.evaluate(o => {
      const b = document.createElement('button');
      b.id = 'sk-nano';
      b.textContent = 'Download Gemini Nano';
      b.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;padding:12px';
      b.onclick = () => {
        window.__nano = { loaded: 0 };
        LanguageModel.create({ ...o, monitor(m) { m.addEventListener('downloadprogress', e => { window.__nano.loaded = e.loaded; }); } })
          .then(() => { window.__nano.done = true; }, e => { window.__nano.error = String(e); });
      };
      document.body.append(b);
    }, OPTS);
    await page.click('#sk-nano');
    for (let last = -1; ;) {
      await new Promise(r => setTimeout(r, 10000));
      const n = await page.evaluate(() => window.__nano);
      if (n.error) throw new Error(n.error);
      if (n.loaded !== last) { log(`downloading: ${Math.round(n.loaded * 100)}%`); last = n.loaded; }
      if (n.done) break;
    }
    s = await status();
    log('Gemini Nano:', s);
  }
  if (s !== 'available') process.exitCode = 1;
} finally {
  await browser.close();
}
