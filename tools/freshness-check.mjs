// Runs the steps freshness check (URL context tool) for one or more library entries through the real extension.
// One cloud call per code. Usage: node build.mjs && node tools/freshness-check.mjs [code ...]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';
import { libraryMap } from '../shared/steps-schema.js';

const codes = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!codes.length) codes.push('gmail.forwarding.external');
const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));
// --suffix=?hl=en tries another form of each help page address (a test copy of the library; the file is unchanged).
const suffix = (process.argv.find(a => a.startsWith('--suffix=')) || '').slice(9);
if (suffix) for (const e of Object.values(library)) e.sources = e.sources.map(s => ({ ...s, url: s.url + suffix }));
const profile = mkdtempSync(path.join(tmpdir(), 'sk-fresh-'));
// A test copy of the extension with the help-page hosts granted at install, since a test cannot click Chrome's
// permission prompt. The real extension asks for them when the person clicks "Check these steps are still current".
const copy = path.join(profile, 'ext');
cpSync(path.resolve('extension'), copy, { recursive: true });
const manifest = JSON.parse(readFileSync(path.join(copy, 'manifest.json'), 'utf8'));
manifest.host_permissions.push('https://support.google.com/*', 'https://www.amazon.com/*');
writeFileSync(path.join(copy, 'manifest.json'), JSON.stringify(manifest));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile });
let failed = 0;
try {
  const id = await browser.installExtension(copy);
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/build/BUILD.txt`);
  for (const code of codes) {
    const r = await page.evaluate(async (code, library) => {
      await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
      return chrome.runtime.sendMessage({ target: 'offscreen', type: 'sk:freshness', options: { code, library } });
    }, code, library);
    console.log(code, JSON.stringify(r, null, 1));
    if (!r || r.error || r.off) failed++;
  }
  const sent = await page.evaluate(() => chrome.storage.session.get('sentLog').then(r => r.sentLog || []));
  console.log('sent log:', sent.map(e => `${e.purpose} ${e.model} ${String(e.text).slice(0, 160)}`).join('\n'));
} finally {
  await browser.close();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
process.exit(failed ? 1 : 0);
