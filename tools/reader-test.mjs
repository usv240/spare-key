// Runs every page reader on the practice pages in headless Chrome, with code only (no Gemini Nano, no cloud), and checks
// the findings against web/practice/pages.mjs EXPECTED. Fast, and needs no extension.
// Usage: node build.mjs && node tools/reader-test.mjs [--verbose]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from './chrome-args.mjs';
import { catalogue } from '../extension/src/scan/catalogue.js';
import { readPage } from '../extension/src/readers/read-page.js';
import { codeClassify, toFinding } from '../extension/src/scan/rules.js';
import { EXPECTED } from '../web/practice/pages.mjs';

const verbose = process.argv.includes('--verbose');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true });
const got = [];
let failed = 0;
try {
  const page = await browser.newPage();
  for (const check of catalogue({}).filter(c => c.pages.length)) {
    let account = null;
    for (const p of check.pages) {
      const file = path.resolve('web/dist', p.practiceUrl.replace(/^\//, ''));
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      const read = await page.evaluate(readPage, { ...p.reader, settleMs: 0 });
      account ||= read.account;
      if (verbose || !read.ready) console.log(check.id, { ready: read.ready, via: read.via, entries: read.entries.map(e => e.text.replace(/\n/g, ' | ')), state: read.entries.map(e => e.state), account: read.account });
      if (!read.ready) { console.log('FAIL', check.id, 'page never became ready'); failed++; }
      for (const entry of read.entries) {
        const cls = codeClassify(check.id, entry, account);
        const f = toFinding({ ref: 'x', check, entry, cls, howFound: 'reader', openUrl: '', account });
        if (f) got.push([check.id, f.code, f.label]);
      }
    }
  }
} finally {
  await browser.close();
}

// Compare as multisets of [check, code].
const key = ([c, code]) => `${c} ${code}`;
const want = EXPECTED.map(key).sort();
const have = got.map(key).sort();
const missing = [...want];
const extra = [];
for (const k of have) {
  const i = missing.indexOf(k);
  if (i >= 0) missing.splice(i, 1); else extra.push(k);
}
for (const [c, code, label] of got) console.log('found', c.padEnd(18), code.padEnd(36), label);
if (missing.length) console.log('MISSING', missing);
if (extra.length) console.log('EXTRA (false alarms)', extra);
const ok = !missing.length && !extra.length && !failed;
console.log(ok ? `PASS: ${got.length} of ${EXPECTED.length} expected findings, no false alarms` : `FAIL: ${missing.length} missing, ${extra.length} extra`);
process.exit(ok ? 0 : 1);
