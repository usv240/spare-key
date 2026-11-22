// Verifies the phone screenshot reader (TECHNICAL-DESIGN.md section 6.3) on this computer: draws a made-up phone app
// sharing screen, sends the picture to the extension's offscreen page, and prints what Gemini Nano read from it. The
// people on it are made up (example.net, 555-01xx). No cloud calls.
// Usage: node build.mjs && node tools/screenshot-check.mjs
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } from './chrome-args.mjs';

// A phone-sized sharing screen in no real app's look: three people and the person themselves.
const SCREEN = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:390px;font:17px system-ui;background:#f4f4f2;color:#1f2328">
<div style="padding:18px 20px 8px;font-weight:700;font-size:22px">Location sharing</div>
<div style="padding:0 20px 12px;color:#555">People who can see where you are</div>
${[['Sam Porter', 'Can see your location', 'Sharing since March'], ['Riley', 'Can see your location', 'Sharing since 2024'], ['Dana (Work)', 'Can see your location until 6:00 PM', ''], ['Me', 'This phone', '']]
    .map(([n, a, b]) => `<div style="margin:8px 16px;padding:14px;background:#fff;border-radius:14px"><div style="font-weight:600">${n}</div><div style="color:#555">${a}</div>${b ? `<div style="color:#555">${b}</div>` : ''}</div>`).join('')}
<div style="margin:16px;padding:12px;text-align:center;border-radius:12px;background:#1f2328;color:#fff">Share with someone new</div></body>`;

freshServiceWorkers(NANO_PROFILE);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: NANO_PROFILE, defaultViewport: null, protocolTimeout: 900000,
  ignoreDefaultArgs: true, args: [...builtInModelArgs({ userDataDir: NANO_PROFILE }), '--window-size=900,800', '--no-first-run', '--no-default-browser-check'],
});
let result = {};
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const shot = await browser.newPage();
  await shot.setViewport({ width: 390, height: 560, deviceScaleFactor: 2 });
  await shot.setContent(SCREEN);
  const data = await shot.screenshot({ type: 'png', encoding: 'base64' });
  mkdirSync('tools/out', { recursive: true });
  writeFileSync('tools/out/screenshot-check.png', Buffer.from(data, 'base64'));
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/build/BUILD.txt`);
  const ask = (type, options) => page.evaluate(async (type, options) => {
    await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
    return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
  }, type, options);
  const t0 = Date.now();
  let status = '';
  while (Date.now() - t0 < 180000) {
    status = (await ask('sk:image-status', {}))?.status;
    if (status === 'available') break;
    await new Promise(r => setTimeout(r, 3000));
  }
  result.imageStatus = status;
  if (status === 'available') {
    const t = Date.now();
    result.read = await ask('sk:read-screenshot', { mimeType: 'image/png', data });
    result.seconds = Math.round((Date.now() - t) / 100) / 10;
  }
} finally {
  await browser.close();
}
writeFileSync('tools/out/screenshot-check.json', JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
const people = (result.read?.entries || []).filter(e => e.is_owner !== 'yes').map(e => e.text);
const ok = people.length === 3 && ['Sam Porter', 'Riley', 'Dana'].every(n => people.some(t => t.startsWith(n))) && !people.some(t => /^Me\b/.test(t));
console.log(ok ? 'PASS: exactly the three made-up people were read, one entry each, and "Me" was not listed' : 'FAIL: see the answer above');
process.exit(ok ? 0 : 1);
