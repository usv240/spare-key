// Draws the practice check's made-up phone screenshot (a location-sharing screen for Jordan, in no real app's look) to
// web/practice/phone-sharing.png, and writes its SHA-256 to web/practice/phone-sharing.json. The website's practice
// check sends a picture to Gemini only when its hash is that one (extension/src/ai.js hybridImageJson), so it cannot
// carry anyone's own screenshot.
// Usage: node tools/make-practice-shot.mjs
import puppeteer from 'puppeteer-core';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { CHROME } from './chrome-args.mjs';

export const PEOPLE = [
  ['Sam Porter', 'Can see your location', 'Sharing since March'],
  ['Riley', 'Can see your location', 'Sharing since 2024'],
  ['Me', 'This phone', ''],
];
const SCREEN = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:390px;font:17px system-ui,sans-serif;background:#f4f4f2;color:#1f2328">
<div style="padding:8px 16px;background:#fbf1e1;color:#6f4300;font-size:14px">Practice screenshot. Made-up data for Jordan.</div>
<div style="padding:18px 20px 6px;font-weight:700;font-size:22px">Location sharing</div>
<div style="padding:0 20px 10px;color:#555">People who can see where you are</div>
${PEOPLE.map(([n, a, b]) => `<div style="margin:8px 16px;padding:14px;background:#fff;border-radius:14px"><div style="font-weight:600">${n}</div><div style="color:#555">${a}</div>${b ? `<div style="color:#555">${b}</div>` : ''}</div>`).join('')}
<div style="margin:16px;padding:12px;text-align:center;border-radius:12px;background:#1f2328;color:#fff">Share with someone new</div></body>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 470, deviceScaleFactor: 2 });
  await page.setContent(SCREEN);
  const png = await page.screenshot({ type: 'png' });
  writeFileSync('web/practice/phone-sharing.png', png);
  const sha256 = createHash('sha256').update(png).digest('hex');
  // The words on the picture: the practice check's guard accepts entries made of these words only.
  const words = PEOPLE.flat().filter(Boolean);
  writeFileSync('web/practice/phone-sharing.json', JSON.stringify({ sha256, mimeType: 'image/png', words }, null, 1) + '\n');
  console.log('wrote web/practice/phone-sharing.png', png.length, 'bytes, sha256', sha256);
} finally {
  await browser.close();
}
