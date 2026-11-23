// Quick exit through the real extension (EXPERIENCE.md: on every screen, button, Escape twice, Alt+Shift+X).
// Checks, for the button in the middle of a practice scan and for Escape twice on the results:
//   the side panel closes, the scan tab closes, the active tab shows an ordinary page, and this session's storage
//   (findings, answers, plan, ledger) is empty. Also: one Escape alone does not exit.
// The keyboard shortcut runs the same quickExit() in the service worker; Chrome does not let a test press it.
//   node build.mjs && node tools/e2e-quick-exit.mjs
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME, freshServiceWorkers } from './chrome-args.mjs';
import { QUICK_EXIT_URL } from '../shared/config.js';

const profile = mkdtempSync(path.join(tmpdir(), 'sk-exit-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const steps = [];
const step = (name, ok, detail = '') => { steps.push({ name, ok, detail }); log(ok ? 'PASS' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exitHost = new URL(QUICK_EXIT_URL).host;

freshServiceWorkers('');
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, defaultViewport: null,
  args: ['--window-size=1400,950', '--no-first-run', '--no-default-browser-check'],
});
try {
  const id = await browser.installExtension(path.resolve('extension'));
  const panelUrl = `chrome-extension://${id}/src/panel.html`;
  const page = (await browser.pages())[0] || await browser.newPage();

  // Opens the side panel with a user gesture from an extension page, and returns it.
  async function openPanel() {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const helper = await browser.newPage();
    await helper.goto(`chrome-extension://${id}/build/BUILD.txt`);
    await page.bringToFront();
    const cdp = await helper.createCDPSession();
    await cdp.send('Runtime.evaluate', { expression: 'chrome.windows.getLastFocused().then(w => chrome.sidePanel.open({ windowId: w.id }))', userGesture: true, awaitPromise: true });
    await cdp.detach();
    await helper.close();
    const panel = await (await browser.waitForTarget(t => t.url() === panelUrl, { timeout: 15000 })).asPage();
    await panel.waitForSelector('body[data-ready="1"] #practice', { visible: true, timeout: 60000 });
    return panel;
  }

  // What is left after an exit, read from a fresh extension page: this session's storage and the open tabs.
  async function afterExit() {
    await sleep(1500);
    const panelOpen = browser.targets().some(t => t.url() === panelUrl);
    const probe = await browser.newPage();
    await probe.goto(`chrome-extension://${id}/build/BUILD.txt`);
    const state = await probe.evaluate(async () => ({
      session: Object.keys(await chrome.storage.session.get(null)),
      local: Object.keys(await chrome.storage.local.get(null)).filter(k => /scan|finding|plan|sent|situation/i.test(k)),
      tabs: (await chrome.tabs.query({})).map(t => t.url || t.pendingUrl || ''),
    }));
    await probe.close();
    // The extension cannot see the address of a site it has no access to, so read the tabs from the browser side.
    state.tabs = (await browser.pages()).map(p => p.url());
    return { panelOpen, ...state };
  }

  // 1. The button, in the middle of a practice scan.
  let panel = await openPanel();
  await panel.click('#practice');
  await panel.waitForSelector('#start', { visible: true });
  await panel.click('#start');
  await panel.waitForSelector('#screen-scanning:not([hidden])', { timeout: 30000 });
  await sleep(2500);
  const scanTabs = (await browser.pages()).filter(p => /\/practice\//.test(p.url())).length;
  log('scan tabs open before exit:', scanTabs);
  await panel.click('#quick-exit');
  let s = await afterExit();
  step('button during a scan: the side panel closes', !s.panelOpen);
  step('button during a scan: the scan tab closes', !s.tabs.some(u => /\/practice\//.test(u)), s.tabs.map(u => new URL(u || 'about:blank').host));
  step('button during a scan: the page shows an ordinary site', s.tabs.some(u => u.includes(exitHost)), exitHost);
  step('button during a scan: nothing from this session is kept', !s.session.length && !s.local.length, { session: s.session, local: s.local });

  // 2. One Escape does not exit; Escape twice does, on the results screen.
  panel = await openPanel();
  await panel.click('#practice');
  await panel.waitForSelector('#start', { visible: true });
  await panel.click('#start');
  await panel.waitForSelector('#screen-results:not([hidden])', { timeout: 120000 });
  await panel.keyboard.press('Escape');
  await sleep(1500);
  step('one Escape alone does not exit', browser.targets().some(t => t.url() === panelUrl) && await panel.evaluate(() => !!document.querySelector('#results')));
  await panel.keyboard.press('Escape');
  await sleep(200);
  await panel.keyboard.press('Escape');
  s = await afterExit();
  step('Escape twice on the results: the side panel closes', !s.panelOpen);
  step('Escape twice on the results: the page shows an ordinary site', s.tabs.some(u => u.includes(exitHost)));
  step('Escape twice on the results: nothing from this session is kept', !s.session.length && !s.local.length, { session: s.session, local: s.local });
} catch (e) {
  step('ran without errors', false, String(e).slice(0, 300));
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file */ }
}
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/e2e-quick-exit.json', JSON.stringify({ at: new Date().toISOString(), steps }, null, 1));
const failed = steps.filter(x => !x.ok).length;
log(failed ? `${failed} FAILED` : `ALL PASSED (${steps.length} steps)`);
process.exit(failed ? 1 : 0);
