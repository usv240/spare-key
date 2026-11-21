// Day 1 check (PLAN.md section 7): the side panel opens, a device-only prompt and a cloud prompt both answer, and
// Quick exit clears the session. Runs the real extension in a separate Chrome profile; your own Chrome is not touched.
//
//   node build.mjs && node tools/day1-check.mjs                 fresh throwaway profile: no Gemini Nano, cloud probe only
//   node tools/day1-check.mjs --nano                           the kept profile with Gemini Nano (tools/nano-profile.mjs);
//                                                              Spare Key is removed from it after the run
//   --profile=<dir>   another kept profile    --headful   show the window    --no-cloud   skip the cloud probe
//
// Cloud calls: one per run (a fixed {"probe":"ready"}). The report goes to tools/out/day1-report.json (gitignored).
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHROME, NANO_PROFILE, builtInModelArgs as modelArgs, freshServiceWorkers } from './chrome-args.mjs';

const EXPECTED_ID = 'opmpimgddnahhbmhioookicpekibjahl';
const args = process.argv.slice(2);
const nano = args.includes('--nano');
const keptProfile = (args.find(a => a.startsWith('--profile=')) || '').slice(10) || (nano ? NANO_PROFILE : '');
const headful = args.includes('--headful') || !!keptProfile;
const cloud = !args.includes('--no-cloud');
const profile = keptProfile || mkdtempSync(path.join(tmpdir(), 'sk-day1-'));
const out = path.resolve('tools/out');
mkdirSync(out, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const report = { when: new Date().toISOString(), profile: keptProfile ? 'kept' : 'fresh', steps: [] };
const step = (name, ok, detail = '') => {
  report.steps.push({ name, ok, detail });
  log(ok ? 'PASS' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail));
};

freshServiceWorkers(keptProfile);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: !headful, pipe: true, enableExtensions: true, userDataDir: profile,
  defaultViewport: null,
  ...(keptProfile ? { ignoreDefaultArgs: true } : {}),
  args: [...(keptProfile ? modelArgs({ headless: !headful, userDataDir: profile }) : []), '--window-size=1280,900', '--no-first-run', '--no-default-browser-check'],
});
let id = '';
try {
  id = await browser.installExtension(path.resolve('extension'));
  step('extension loads with its fixed id', id === EXPECTED_ID, id);
  // On a kept profile the first worker context can be torn down while the extension registers; take a live one.
  let sw = null;
  for (let attempt = 0; attempt < 10 && !sw; attempt++) {
    const target = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(`chrome-extension://${id}/`), { timeout: 15000 });
    const w = await target.worker();
    if (await w.evaluate(() => typeof chrome !== 'undefined' && !!chrome.runtime?.id).catch(() => false)) sw = w;
    else await new Promise(r => setTimeout(r, 500));
  }
  step('service worker starts', !!sw);
  report.capabilities = await sw.evaluate(() => ({
    sidePanelClose: typeof chrome.sidePanel.close === 'function',
    chrome: (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [])[1],
    commands: null,
  }));
  report.capabilities.commands = await sw.evaluate(() => chrome.commands.getAll().then(c => c.map(x => ({ name: x.name, shortcut: x.shortcut }))));
  step('Quick exit command is declared', report.capabilities.commands.some(c => c.name === 'quick-exit'), report.capabilities.commands);
  // Chrome may leave the suggested shortcut unassigned; the panel then names Escape only. Recorded, not judged.
  log('INFO Quick exit shortcut assigned by Chrome:', JSON.stringify(report.capabilities.commands.find(c => c.name === 'quick-exit')?.shortcut || '(none)'));
  log('Chrome', report.capabilities.chrome, 'sidePanel.close:', report.capabilities.sidePanelClose);

  // An ordinary tab to stand in for whatever the person was looking at.
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Open the side panel the way a click does: a call with a user gesture, from an extension page.
  const helper = await browser.newPage();
  await helper.goto(`chrome-extension://${id}/build/BUILD.txt`);
  await page.bringToFront();
  const cdp = await helper.createCDPSession();
  const opened = await cdp.send('Runtime.evaluate', {
    expression: `chrome.windows.getLastFocused().then(w => chrome.sidePanel.open({ windowId: w.id })).then(() => 'opened', e => 'error: ' + e.message)`,
    userGesture: true, awaitPromise: true, returnByValue: true,
  });
  await cdp.detach();
  await helper.close();
  const panelTarget = await browser.waitForTarget(t => t.url() === `chrome-extension://${id}/src/panel.html`, { timeout: 10000 }).catch(() => null);
  step('side panel opens', !!panelTarget, opened.result?.value);
  if (!panelTarget) throw new Error('no side panel');
  const panel = await panelTarget.asPage();
  await panel.waitForSelector('[data-screen="safety"]', { timeout: 10000 });
  const safety = await panel.evaluate(() => ({
    heading: document.querySelector('h1, h2')?.textContent.trim(),
    hotline: document.body.innerText.includes('1-800-799-7233') && document.body.innerText.includes('88788'),
    quickExitFirst: document.querySelector('button, a')?.textContent.trim(),
  }));
  step('safety screen shows first, with the hotline', safety.hotline, safety);
  step('Quick exit is the first control', /quick exit/i.test(safety.quickExitFirst || ''), safety.quickExitFirst);

  // Chrome registers an installed model a little after it starts, and says "downloading" until then.
  if (nano) {
    const w0 = Date.now();
    let s = '';
    while (Date.now() - w0 < 90000) {
      s = await panel.evaluate(() => LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })).catch(e => String(e));
      if (s === 'available') break;
      await new Promise(r => setTimeout(r, 3000));
    }
    log(`INFO Gemini Nano status "${s}" after ${Math.round((Date.now() - w0) / 1000)} s`);
  }

  // The setup check: Remote Config, Gemini Nano, and one cloud probe, all from the offscreen page.
  const t0 = Date.now();
  const setup = await panel.evaluate(async withCloud => {
    await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
    return chrome.runtime.sendMessage({ target: 'offscreen', type: 'sk:setup-check', options: { cloud: withCloud } });
  }, cloud);
  report.setup = setup;
  log('setup check took', Date.now() - t0, 'ms');
  step('Remote Config answers', setup.settings?.from === 'remote', setup.settings);
  if (nano) step('device-only prompt answers (Gemini Nano, ONLY_ON_DEVICE)', setup.nano?.answer?.status === 'ready', setup.nano);
  else log('INFO Gemini Nano in this profile:', JSON.stringify(setup.nano));
  if (cloud) step('cloud prompt answers (ONLY_IN_CLOUD, GoogleAIBackend)', setup.cloud?.answer?.status === 'ready', setup.cloud);

  // "What left this computer" holds exactly the probe, word for word.
  const sent = await panel.evaluate(() => chrome.storage.session.get('sentLog').then(r => r.sentLog || []));
  report.sentLog = sent;
  if (cloud) step('every cloud request is in the sent log', sent.length >= 1 && sent.every(e => JSON.stringify(e.body) === '{"probe":"ready"}'), sent.map(e => `${e.purpose} ${e.model} ${JSON.stringify(e.body)}`));

  // Quick exit with Escape twice in the panel.
  await panel.evaluate(() => chrome.storage.session.set({ marker: 'present' }));
  await panel.focus('body').catch(() => {});
  await panel.keyboard.press('Escape');
  await panel.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 2500));
  const afterUrl = page.url();
  const panelGone = !(await browser.targets()).some(t => t.url() === `chrome-extension://${id}/src/panel.html`);
  const session = await sw.evaluate(() => chrome.storage.session.get(null));
  step('Quick exit: session cleared', Object.keys(session).length === 0, Object.keys(session));
  // Google may answer an automated browser with its "unusual traffic" page, which still carries the weather search.
  const leftFor = decodeURIComponent(afterUrl);
  step('Quick exit: the tab leaves for an ordinary page', /google\.com\/(search\?q=weather|sorry\/index\?continue=https:\/\/www\.google\.com\/search\?q=weather)/.test(leftFor), afterUrl.slice(0, 80));
  step('Quick exit: the side panel closes', panelGone);
} catch (e) {
  step('run', false, String(e && e.stack || e).slice(0, 600));
} finally {
  // A kept profile belongs to another project: leave it as it was.
  if (keptProfile && id) await browser.uninstallExtension(id).catch(() => {});
  await browser.close().catch(() => {});
  if (!keptProfile) rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
const failed = report.steps.filter(s => !s.ok).length;
writeFileSync(path.join(out, `day1-report${nano ? '-nano' : ''}.json`), JSON.stringify(report, null, 2));
log(failed ? `${failed} FAILED` : 'ALL PASSED', `(${report.steps.length} steps)`);
process.exit(failed ? 1 : 0);
