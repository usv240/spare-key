// Accessibility check: axe-core (WCAG 2.0 and 2.1 A and AA, plus best practices) on every built site page at 375 and
// 1280 px in light and dark, and on the real extension panel's screens (safety, choose, scanning with the
// "confirm it is you" box, results) in light and dark. Also reports any page that scrolls sideways.
//   node build.mjs && node tools/a11y-check.mjs        writes tools/out/a11y.json
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';

const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const RULES = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];
const root = path.resolve('web/dist');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && !path.extname(p)) p = path.join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(47813);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const runAxe = page => page.evaluate(async (src, rules) => {
  if (typeof window.axe === 'undefined') (0, eval)(src);
  return (await window.axe.run(document, { runOnly: rules })).violations.map(v => ({ id: v.id, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(' ') }));
}, axe, RULES);
const results = [];
const record = (where, width, scheme, violations, overflow = 0) => {
  results.push({ where, width, scheme, violations, overflow });
  if (violations.length || overflow > 0) console.log('ISSUE', where, width, scheme, JSON.stringify(violations), overflow > 0 ? `scrolls sideways ${overflow}px` : '');
};

// 1. The site.
const site = await puppeteer.launch({ executablePath: CHROME, headless: true });
const pages = readdirSync(root).filter(f => f.endsWith('.html') && f !== 'appcheck-bridge.html');
for (const f of pages) for (const width of [375, 1280]) for (const scheme of ['light', 'dark']) {
  const page = await site.newPage();
  await page.setViewport({ width, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(`http://127.0.0.1:47813/${f}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  record(f, width, scheme, await runAxe(page), await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await page.close();
}
await site.close();
server.close();

// 2. The extension panel, through the real extension (a practice check, no cloud calls).
const profile = mkdtempSync(path.join(tmpdir(), 'sk-a11y-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, defaultViewport: null, args: ['--window-size=1400,950', '--no-first-run', '--no-default-browser-check'] });
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const tab = (await browser.pages())[0];
  await tab.goto('https://example.com/').catch(() => {});
  const helper = await browser.newPage();
  await helper.goto(`chrome-extension://${id}/build/BUILD.txt`);
  await tab.bringToFront();
  const cdp = await helper.createCDPSession();
  await cdp.send('Runtime.evaluate', { expression: 'chrome.windows.getLastFocused().then(w => chrome.sidePanel.open({ windowId: w.id }))', userGesture: true, awaitPromise: true });
  await helper.close();
  const panel = await (await browser.waitForTarget(t => t.url() === `chrome-extension://${id}/src/panel.html`, { timeout: 15000 })).asPage();
  await panel.waitForSelector('body[data-ready="1"] #practice', { visible: true, timeout: 60000 });
  const audit = async (screen, before = async () => {}) => {
    for (const scheme of ['light', 'dark']) {
      await panel.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await sleep(1200); // colours fade between themes; measure after the fade
      await before();
      record(`panel: ${screen}`, 'side panel', scheme, await runAxe(panel));
    }
  };
  await audit('safety');
  await panel.click('#practice');
  await panel.waitForSelector('#start', { visible: true });
  await audit('choose');
  await panel.click('#start');
  await panel.waitForSelector('#screen-scanning:not([hidden])', { timeout: 30000 });
  // The "confirm it is you" box, with the words the panel shows (showVerify in panel.js).
  await audit('scanning, with the confirm-it-is-you box', () => panel.evaluate(() => {
    document.getElementById('verify-title').textContent = 'Google wants you to confirm it is you before it shows devices signed in to your Google account.';
    document.getElementById('verify-how').textContent = 'You can do that in the page beside this panel, the same way you always do. Spare Key does not read that page and never sees your password. When Google shows the setting again, Spare Key reads it and goes on.';
    document.getElementById('verify-time').textContent = 'Spare Key waits up to 5 more minutes, then skips it.';
    document.getElementById('verify-box').hidden = false;
  }));
  await panel.evaluate(() => { document.getElementById('verify-box').hidden = true; });
  await panel.waitForSelector('#screen-results:not([hidden])', { timeout: 120000 });
  await audit('results');
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file */ }
}

const issues = results.filter(r => r.violations.length || r.overflow > 0);
const nodes = results.reduce((n, r) => n + r.violations.reduce((m, v) => m + v.nodes, 0), 0);
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/a11y.json', JSON.stringify({ at: new Date().toISOString(), axe: JSON.parse(readFileSync(createRequire(import.meta.url).resolve('axe-core/package.json'), 'utf8')).version, rules: RULES, sitePages: pages.length, runs: results.length, violationNodes: nodes, results }, null, 1));
console.log(`${pages.length} site pages x 4 and 4 panel screens x 2: ${results.length} runs, ${nodes} violations, ${issues.length} runs with an issue`);
process.exit(issues.length ? 1 : 0);
