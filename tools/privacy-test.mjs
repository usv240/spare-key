// The privacy test (EVALUATION.md section 3): nothing that names a person leaves the computer.
//
// Runs the practice check end to end with every cloud step on (plan, two voices, the setup probe), captures every
// network request made by the extension's own contexts (service worker, offscreen page, side panel) through the Chrome
// DevTools Protocol, and searches each request's URL, headers and body for the practice pages' made-up names, emails,
// phone numbers, device names, places and filter words, in plain text, URL-encoded, base64 and JSON-escaped forms.
// The scan tab's own requests are the practice site's, not Spare Key's, and are excluded by context.
// It also checks that every request to Firebase AI Logic matches an entry in "What left this computer".
//
// Cloud calls: about 7. Usage: node build.mjs && node tools/privacy-test.mjs
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';

// Every private string on the practice pages (web/practice/pages.mjs).
export const CANARIES = [
  'Jordan Lee', 'jordan.lee', 'jordan.lee@example.com', 'Sam Porter', 'sam.porter', 'sam.porter@example.net', 'example.net',
  '(937) 555-0177', '937 555 0177', '9375550177', '555-0177', 'Riley', 'Pixel 8', 'iPhone 15', 'Windows computer', 'Mac',
  'Columbus', 'Dayton', 'InboxPilot', 'TrailMate', 'Recipe Box', 'alerts@examplebank.com', 'examplebank', 'appointment',
  'receipts@example.org', "Sam's Echo Dot", 'Echo Dot', 'Kindle Paperwhite', 'Fire TV Stick', 'Living room',
];

const out = path.resolve('tools/out');
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'sk-privacy-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const requests = [];
const sessions = new Set();

const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, pipe: true, enableExtensions: true, userDataDir: profile, defaultViewport: null, args: ['--window-size=1400,950', '--no-first-run'] });
let id = '';
let report = {};
try {
  id = await browser.installExtension(path.resolve('extension'));
  const origin = `chrome-extension://${id}/`;

  // Watch every extension context, now and as it appears.
  const watch = async target => {
    if (!target.url().startsWith(origin) || sessions.has(target)) return;
    sessions.add(target);
    const s = await target.createCDPSession().catch(() => null);
    if (!s) return;
    await s.send('Network.enable', { maxPostDataSize: 1 << 20 }).catch(() => {});
    s.on('Network.requestWillBeSent', async e => {
      const r = { context: `${target.type()} ${target.url().replace(origin, '')}`, url: e.request.url, method: e.request.method, headers: JSON.stringify(e.request.headers || {}), body: e.request.postData || '' };
      if (!r.body && e.request.hasPostData) r.body = (await s.send('Network.getRequestPostData', { requestId: e.requestId }).catch(() => ({}))).postData || '';
      requests.push(r);
    });
  };
  // A new target can appear before its address is set (the offscreen page did), so watch again when it changes, and
  // sweep every half second as well.
  browser.on('targetcreated', watch);
  browser.on('targetchanged', watch);
  for (const t of browser.targets()) await watch(t);
  const sweep = setInterval(() => { for (const t of browser.targets()) watch(t); }, 500);
  process.on('exit', () => clearInterval(sweep));

  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const helper = await browser.newPage();
  await helper.goto(`${origin}build/BUILD.txt`);
  await page.bringToFront();
  const cdp = await helper.createCDPSession();
  await cdp.send('Runtime.evaluate', { expression: 'chrome.windows.getLastFocused().then(w => chrome.sidePanel.open({ windowId: w.id }))', userGesture: true, awaitPromise: true });
  await cdp.detach();
  await helper.close();
  const panelTarget = await browser.waitForTarget(t => t.url() === `${origin}src/panel.html`, { timeout: 15000 });
  await watch(panelTarget);
  const panel = await panelTarget.asPage();
  await panel.waitForSelector('body[data-ready="1"] #practice', { visible: true, timeout: 60000 });

  // The practice check, every check ticked.
  await panel.click('#practice');
  await panel.waitForSelector('#start', { visible: true });
  await panel.evaluate(() => { for (const b of document.querySelectorAll('input[name="check"]')) b.checked = true; });
  await panel.click('#start');
  await panel.waitForSelector('#screen-results:not([hidden])', { timeout: 300000 });
  log('scan done');
  // Answer two findings, so ownership answers travel too.
  await panel.evaluate(() => document.querySelectorAll('#results .finding [data-answer="not_mine"]')[0]?.click());
  await new Promise(r => setTimeout(r, 400));
  await panel.evaluate(() => document.querySelectorAll('#results .finding [data-answer="unsure"]')[1]?.click());
  await new Promise(r => setTimeout(r, 400));

  // The plan with every cloud step on, and every situation answer shared.
  await panel.evaluate(() => document.getElementById('to-plan').click());
  await panel.waitForSelector('#make-plan', { visible: true });
  for (const [q, v] of [['living', 'apart'], ['safe_to_change_now', 'not_sure'], ['children_shared', 'yes'], ['has_advocate', 'no']]) await panel.click(`input[name="q-${q}"][value="${v}"]`);
  await panel.click('#share-situation');
  await panel.click('#make-plan');
  const t1 = Date.now();
  while (Date.now() - t1 < 240000) {
    const state = await panel.evaluate(() => ({ note: document.querySelector('#plan .notice')?.textContent || '', asking: !document.querySelector('#ask-user').hidden, lead: document.querySelector('#plan .lead')?.textContent || '' }));
    if (state.asking) { await panel.click('#ask-user .answer button:nth-child(3)'); continue; }
    if (state.lead && !/^(Asking|Checking the order)/.test(state.note)) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  log('plan done');

  // The setup probe in Under the hood.
  await panel.evaluate(() => document.getElementById('tab-hood').click());
  await panel.evaluate(() => document.getElementById('run-setup').click());
  await panel.waitForFunction(() => /answered|did not answer|switched off|not on this computer/.test(document.getElementById('setup-status').textContent) && !document.getElementById('run-setup').disabled, { timeout: 120000 });
  await new Promise(r => setTimeout(r, 1500));

  const sent = await panel.evaluate(() => chrome.storage.session.get('sentLog').then(r => r.sentLog || []));
  clearInterval(sweep);
  report.contexts = [...sessions].map(t => `${t.type()} ${t.url().replace(origin, '')}`);

  // Search every request for every canary, in every encoding.
  const forms = c => [c, encodeURIComponent(c), encodeURIComponent(c).replace(/%20/g, '+'), Buffer.from(c).toString('base64'), JSON.stringify(c).slice(1, -1), JSON.stringify(JSON.stringify(c)).slice(1, -1)];
  const hits = [];
  for (const r of requests) {
    const hay = `${r.url}\n${r.headers}\n${r.body}`;
    const lower = hay.toLowerCase();
    for (const c of CANARIES) {
      if (forms(c).some(f => f && lower.includes(f.toLowerCase()))) hits.push({ canary: c, context: r.context, url: r.url.slice(0, 120) });
    }
  }

  // Every request to the model API matches a logged entry, word for word.
  const modelCalls = requests.filter(r => /firebasevertexai\.googleapis\.com|generativelanguage\.googleapis\.com/.test(r.url) && r.method === 'POST');
  // A request entry's text travels as the prompt (a JSON string inside the request); a function round's answers travel
  // as objects. Each model request must hold at least one logged entry whole, and each entry must be in some request.
  const pieces = e => e.kind === 'function_answers'
    ? JSON.parse(e.text).map(a => JSON.stringify(a.response))
    : [JSON.stringify(e.text).slice(1, -1)];
  const holds = (r, e) => pieces(e).every(p => r.body.includes(p));
  const unmatched = modelCalls.filter(r => !sent.some(e => holds(r, e)));
  report.unloggedEntries = sent.filter(e => !modelCalls.some(r => holds(r, e))).map(e => `${e.kind} ${e.purpose}`);
  const byHost = {};
  for (const r of requests) { const host = (() => { try { return new URL(r.url).host; } catch { return r.url.slice(0, 40); } })(); byHost[host] = (byHost[host] || 0) + 1; }

  report = {
    ...report,
    date: new Date().toISOString(),
    chrome: (await browser.version()),
    extensionRequests: requests.length,
    modelRequests: modelCalls.length,
    sentLogEntries: sent.length,
    requestsWithCanary: [...new Set(hits.map(h => `${h.context} ${h.url}`))].length,
    hits,
    unmatchedModelRequests: unmatched.map(r => ({ context: r.context, url: r.url.slice(0, 120), body: r.body.slice(0, 300) })),
    hosts: byHost,
    modelBodies: modelCalls.map(r => r.body),
    sentTexts: sent.map(e => ({ kind: e.kind, purpose: e.purpose, text: e.text })),
    canaries: CANARIES.length,
  };
  log(`contexts watched: ${report.contexts.join(', ')}`);
  log(`extension requests: ${requests.length}, to the model: ${modelCalls.length}, sent log entries: ${sent.length}`);
  log('hosts:', JSON.stringify(byHost));
  log(hits.length ? `FAIL: ${report.requestsWithCanary} requests held a canary: ${JSON.stringify(hits.slice(0, 10))}` : `PASS: 0 of ${requests.length} extension requests held a name, email, phone number, device name or place`);
  log(unmatched.length ? `FAIL: ${unmatched.length} model requests do not match the sent log` : `PASS: all ${modelCalls.length} model requests match "What left this computer", word for word`);
  log(report.unloggedEntries.length ? `FAIL: logged but not found in any request: ${report.unloggedEntries}` : `PASS: all ${sent.length} logged entries were found in the requests`);
} catch (e) {
  log('FAIL run', String(e && e.stack || e).slice(0, 500));
  report.error = String(e);
} finally {
  await browser.close().catch(() => {});
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* temp */ }
}
writeFileSync(path.join(out, 'privacy-report.json'), JSON.stringify(report, null, 2));
process.exit(report.error || report.hits?.length || report.unmatchedModelRequests?.length || report.unloggedEntries?.length ? 1 : 0);
