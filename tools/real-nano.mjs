// Gemini Nano on a real account's pages: the pages tools/record-pages.mjs saved from the builder's own account
// (private/pages/*.raw.json, gitignored), run through the scan's own rules (readToEntries, toFinding) three ways:
//   code       the reader's entries, sorted by code only
//   both       the same entries, sorted by code and Gemini Nano (what the extension does when Nano is ready)
//   nano-alone the reader's entries thrown away, as if the site had changed its page: Gemini Nano reads the page text
// Gemini Nano runs in the extension's own offscreen page, on this computer; the page text never leaves it. Prints and
// saves only check names, statuses, finding codes and counts (docs/evidence/real-nano.json).
//   node build.mjs && node tools/real-nano.mjs         needs the Gemini Nano test profile and about 4 GB free memory
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';
import { catalogue } from '../extension/src/scan/catalogue.js';
import { readToEntries } from '../extension/src/scan/engine.js';
import { toFinding } from '../extension/src/scan/rules.js';

const DIR = 'private/pages';
if (!existsSync(DIR)) throw new Error('No recorded pages: run tools/record-pages.mjs first');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

freshServiceWorkers(NANO_PROFILE);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: NANO_PROFILE, defaultViewport: null, protocolTimeout: 900000,
  ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: NANO_PROFILE }), '--window-size=900,700', '--no-first-run', '--no-default-browser-check'],
});
const rows = [];
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/build/BUILD.txt`);
  const t0 = Date.now();
  let s = '';
  while (Date.now() - t0 < 180000) {
    s = await page.evaluate(() => LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })).catch(e => String(e));
    if (s === 'available') break;
    await new Promise(r => setTimeout(r, 3000));
  }
  if (s !== 'available') throw new Error(`Gemini Nano is not available: ${s}`);
  const nano = (type, options) => page.evaluate(async (type, options) => {
    await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
    return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
  }, type, options);
  log('Gemini Nano: warming up');
  await nano('sk:nano-warm', {}).catch(() => {});

  const checks = catalogue({});
  const files = readdirSync(DIR).filter(f => f.endsWith('.raw.json')).sort();
  for (const f of files) {
    const rec = JSON.parse(readFileSync(path.join(DIR, f), 'utf8'));
    const check = checks.find(c => c.id === rec.check);
    if (!check) continue;
    if (rec.signedOut || rec.reauth || !rec.reader) { rows.push({ page: rec.id, skipped: rec.signedOut ? 'signed_out' : rec.reauth ? 'needs_password' : 'no_reader' }); continue; }
    // The recording keeps the page's visible main text in `text`; the reader's own copy is left out of the file.
    const k = Number((rec.id.match(/\.(\d+)$/) || [])[1] || 0);
    const read = { ...rec.reader, mainText: String(rec.text || '').slice(0, 20000) };
    const account = rec.reader.account;
    const score = async (r, ask) => {
      const t = Date.now();
      const p = await readToEntries({ check, read: r, account, ask, reader: check.pages[k]?.reader });
      const ms = Date.now() - t;
      if (p.why) return { status: 'not_checked', why: p.why, ms };
      const codes = {};
      p.entries.forEach((entry, i) => {
        const fd = toFinding({ ref: `R${i}`, check, entry, cls: p.classes[i], howFound: p.hows[i], openUrl: '', account });
        if (fd) codes[fd.code] = (codes[fd.code] || 0) + 1;
      });
      return { status: 'checked', entries: p.entries.length, how: p.howFound, nanoSorted: !!p.items, nanoError: p.nanoError ? String(p.nanoError).slice(0, 80) : undefined, partly: p.partly, codes, ms };
    };
    const row = { page: rec.id, check: check.id };
    row.code = await score(read, null);
    row.both = await score(read, nano);
    // As if the site had changed the page: the reader found nothing and never saw the words it waits for.
    // The page's own "nothing here" words are page text, so they still count; only the reader's entries and section are gone.
    row.nanoAlone = await score({ ...read, entries: [], via: 'none', withinFound: false }, nano);
    rows.push(row);
    const fmt = r => r.status === 'checked' ? `${r.entries} entries ${JSON.stringify(r.codes)}${r.nanoError ? ' nano error' : ''}` : `not checked (${r.why})`;
    log(row.page.padEnd(18), '| code', fmt(row.code), '| both', fmt(row.both), '| nano alone', fmt(row.nanoAlone), `${(row.nanoAlone.ms / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close().catch(() => {});
}
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/real-nano.json', JSON.stringify({
  at: new Date().toISOString(),
  what: 'Gemini Nano on the builder\'s own account\'s recorded pages (read-only recording, November 22, 2026): code only, code and Nano, and Nano alone as if the page reader had broken. Check names, statuses, codes and counts only.',
  rows,
}, null, 1));
log('wrote tools/out/real-nano.json');
