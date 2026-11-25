// The install page's picture: Chrome's own extensions page with Developer mode on, "Load unpacked" and Spare Key
// loaded, in a throwaway profile. A real screenshot of what the person will see, not a drawing. No cloud calls.
//   node build.mjs && node tools/install-shot.mjs     writes web/public/img/install-extensions.png
import puppeteer from 'puppeteer-core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';

const profile = mkdtempSync(path.join(tmpdir(), 'sk-install-'));
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: [path.resolve('extension')], userDataDir: profile,
  defaultViewport: { width: 1000, height: 420, deviceScaleFactor: 2 }, args: ['--no-first-run', '--window-size=1120,700', '--lang=en-US'],
});
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto('chrome://extensions', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500));
  // Developer mode, as step 2 asks.
  const on = await page.evaluate(() => {
    const t = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-toolbar')?.shadowRoot?.querySelector('#devMode');
    if (t && !t.checked) t.click();
    return !!t;
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.evaluate(() => { const a = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-toolbar')?.shadowRoot?.querySelector('cr-toolbar')?.shadowRoot?.querySelector('cr-toolbar-search-field'); a?.blur?.(); });
  await page.mouse.click(990, 410);
  await new Promise(r => setTimeout(r, 300));
  const out = path.resolve('web/public/img/install-extensions.png');
  await page.screenshot({ path: out });
  console.log('developer mode toggle found:', on, '->', out);
} finally {
  await browser.close();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
