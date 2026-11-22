// Sends one opt-in layout report through the extension's own path (gate, sent log, Firestore with App Check), marked
// reader_version "selftest", and reads back what was logged. One Firestore write; no model calls.
// Usage: node build.mjs && node tools/layout-report-check.mjs   (a development build: it uses the App Check debug token)
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CHROME } from './chrome-args.mjs';

const profile = mkdtempSync(path.join(tmpdir(), 'sk-report-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, args: ['--no-first-run', '--window-size=800,600'] });
let out = {};
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/build/BUILD.txt`);
  out = await page.evaluate(async () => {
    const ask = async (type, options) => { await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' }); return chrome.runtime.sendMessage({ target: 'offscreen', type, options }); };
    const body = { check: 'google.devices', reader_version: 'selftest', reason: 'unexpected_layout', ext_version: chrome.runtime.getManifest().version, day: new Date().toISOString().slice(0, 10) };
    const r = await ask('sk:layout-report', { body });
    await new Promise(res => setTimeout(res, 500));
    const { sentLog = [] } = await chrome.storage.session.get('sentLog');
    // A refused shape never leaves: a report with a page address in it.
    const refused = await ask('sk:layout-report', { body: { ...body, url: 'https://myaccount.google.com/device-activity' } });
    return { result: r, logged: sentLog.filter(e => e.purpose === 'layout').map(e => e.text), refused };
  });
} finally {
  await browser.close();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
console.log(JSON.stringify(out, null, 1));
const ok = out.result?.sent === true && out.logged?.length === 1 && /error/.test(JSON.stringify(out.refused));
console.log(ok ? 'PASS: one report sent and logged; a report with an address was refused before sending' : 'FAIL');
process.exit(ok ? 0 : 1);
