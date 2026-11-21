// Screenshots of the side panel's screens at the widths Chrome's side panel takes (320, 360, 500 px), light and dark,
// for the design review (EXPERIENCE.md section 8). Opens the panel page in a tab of a throwaway profile; no cloud calls.
// Usage: node build.mjs && node tools/panel-shots.mjs [--widths=320,360,500] [--out=.impeccable/review/panel]
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';

const args = process.argv.slice(2);
const widths = ((args.find(a => a.startsWith('--widths=')) || '--widths=320,360,500').slice(9)).split(',').map(Number);
const out = path.resolve((args.find(a => a.startsWith('--out=')) || '--out=.impeccable/review/panel').slice(6));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'sk-shots-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, enableExtensions: true, userDataDir: profile });
const shots = [];
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const page = await browser.newPage();
  for (const scheme of ['light', 'dark']) {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    for (const width of widths) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      await page.goto(`chrome-extension://${id}/src/panel.html`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => chrome.storage.session.clear());
      await page.reload({ waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      const shot = async name => {
        const file = path.join(out, `${name}-${width}-${scheme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        shots.push(file);
      };
      await shot('safety');
      // An open "i" sheet over the safety screen.
      await page.click('button.info[data-info="shared-computer"]');
      await new Promise(r => setTimeout(r, 400));
      if (width === 360) await shot('safety-info');
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 1200));
      await page.click('#continue');
      await new Promise(r => setTimeout(r, 300));
      await shot('choose');
      await page.click('#tab-hood');
      await new Promise(r => setTimeout(r, 800));
      await shot('hood');
    }
  }
  // Fonts really loaded, and tabular figures really change digit widths.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family);
    const probe = (variant) => { const s = document.createElement('span'); s.style.cssText = `font: 16px "Atkinson Hyperlegible Next"; font-variant-numeric: ${variant}; position:absolute; visibility:hidden`; s.textContent = '1111'; document.body.append(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
    return { loaded: [...new Set(loaded)], tabular1111: probe('tabular-nums'), proportional1111: probe('proportional-nums') };
  });
  console.log(JSON.stringify(fonts));
} finally {
  await browser.close();
  // Windows can hold the profile a moment after Chrome exits; a leftover temp folder is harmless.
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* left in %TEMP% */ }
}
console.log(shots.map(f => path.relative(process.cwd(), f)).join('\n'));
