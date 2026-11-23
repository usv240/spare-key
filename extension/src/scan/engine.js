// The scan engine (TECHNICAL-DESIGN.md section 5). It opens one scan tab beside the side panel, visits each settings
// page, injects the reader, and turns what it read into findings. It only opens pages and reads them: it never clicks,
// scrolls, types or submits.
//
// It runs in the side panel page, not the service worker. Chrome can stop an idle service worker after 30 seconds, and
// one Gemini Nano call can take longer; the panel stays alive while it is open. Closing the panel (Quick exit does)
// ends the scan, which is what should happen.
import { readPage } from '../readers/read-page.js';
import { codeClassify, codeFor, merge, toFinding } from './rules.js';
import { pageUrl, PRACTICE_ORIGIN } from './catalogue.js';
import { checkExtensions, checkSync } from './chrome-checks.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
export class ScanStopped extends Error { constructor() { super('stopped'); this.name = 'ScanStopped'; } }

/** Navigate the scan tab and wait until it has loaded (or left for a sign-in page). Returns the final URL. */
async function navigate(tabId, url, { timeoutMs = 30000, signal } = {}) {
  // Gmail's settings tabs differ only after the "#". Moving between them by hash would keep the previous tab's content
  // on screen while the tab already reports "complete", and Gmail's tab bar holds every tab's name, so the reader's wait
  // could match the wrong tab. Loading about:blank first makes every settings page a fresh load.
  const now = await chrome.tabs.get(tabId).catch(() => null);
  const same = u => { try { const a = new URL(u); const b = new URL(url); return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search; } catch { return false; } };
  if (now?.url && new URL(url).hash && same(now.url)) {
    await chrome.tabs.update(tabId, { url: 'about:blank' });
    for (let i = 0; i < 20; i++) { await sleep(100); if ((await chrome.tabs.get(tabId)).url === 'about:blank') break; }
  }
  await chrome.tabs.update(tabId, { url });
  const target = new URL(url);
  const t0 = Date.now();
  let tab = null;
  while (Date.now() - t0 < timeoutMs) {
    if (signal?.aborted) throw new ScanStopped();
    await sleep(250);
    tab = await chrome.tabs.get(tabId);
    const at = tab.pendingUrl || tab.url || '';
    // Loaded: complete, and either on the page asked for or redirected elsewhere (a sign-in page).
    if (tab.status === 'complete' && at && at !== 'about:blank' && (at.startsWith(target.origin) || !at.startsWith('about:'))) return at;
  }
  return tab?.url || url;
}

/**
 * Google or Amazon asked "Verify it's you". The person can do that in the scan tab, in the site's own page: Spare Key
 * cannot read that page (it has no access to accounts.google.com) and only watches the tab's address until the site sends
 * it back. Returns that address, or null when the person skips or five minutes pass.
 */
export async function waitForVerify(tabId, url, reauthRe, { signal, skip, minutes = 5 } = {}) {
  const target = new URL(url);
  const t0 = Date.now();
  let clear = 0;
  while (Date.now() - t0 < minutes * 60000) {
    if (signal?.aborted) throw new ScanStopped();
    if (skip?.aborted) return null;
    await sleep(1000);
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return null;
    const at = tab.pendingUrl || tab.url || '';
    // Back on the settings site and staying there: its page first shows a frame, then may move on to verify again.
    clear = tab.status === 'complete' && at.startsWith(target.origin) && !reauthRe.test(at) ? clear + 1 : 0;
    if (clear >= 3) return at;
  }
  return null;
}

/**
 * One page the reader has read, turned into classified entries: the scan's rules in one place, so the layout drift
 * test (tools/drift-test.mjs) runs exactly what the extension runs.
 *   ask      (type, options) => Promise, Gemini Nano through the offscreen page; null when Nano is not ready
 *   onState  ('nano-reading' | 'classifying') for the progress line
 * Returns { why } when the check cannot say what is listed, else { entries, classes, hows, howFound, items, partly }.
 */
export async function readToEntries({ check, read, account, ask = null, onState = () => {} }) {
  let partly = !!read.moreHidden;
  // The entries: from the reader, or, when it found none, from Gemini Nano reading the page's text. Nano also reads a
  // page that never showed the words the reader waits for: a reworded heading is the commonest change.
  let entries = read.entries || [];
  let howFound = 'reader';
  if (!entries.length && ask && read.mainText) {
    onState('nano-reading');
    const r = await ask('sk:read-page', { description: check.label, text: read.mainText });
    if (!r?.error && r?.entries?.length) { entries = r.entries; howFound = 'nano'; if (r.partial || read.mainTextCut) partly = true; }
  }
  // A page that never showed the words the reader waits for, with nothing read from it: if it has text, it loaded and
  // looks different; trying again would not help.
  if (read.timedOut && !entries.length) return { why: String(read.mainText || '').trim() ? 'looked_different' : 'did_not_load' };
  // The page never showed what the reader waits for, so it may not all be there.
  if (read.timedOut) partly = true;
  // Nothing listed counts as nothing found only when the page says so or the setting's own section is there.
  // Otherwise the page looks different from what Spare Key knows, and "nothing found" could hide someone.
  if (!entries.length && !read.emptyConfirmed && !read.withinFound) return { why: 'looked_different' };

  // Classify: code always, Gemini Nano when it is ready.
  let items = null;
  let nanoError = null;
  if (entries.length && ask) {
    onState('classifying');
    const r = await ask('sk:classify', { description: check.label, owner: account, entries });
    if (!r?.error) items = r.items; else nanoError = r.error;
  }
  const classes = entries.map((entry, k) => {
    const code = codeClassify(check.id, entry, account, check.words);
    return items?.[k] ? merge(code, items[k], entry.text) : { ...code, source: 'reader' };
  });
  // Nano read a page the reader could not, so the page has changed; if the code rules then make nothing of what it
  // read, their words have probably changed too ("Send a copy" for "Forward a copy"). That is not "nothing found".
  if (howFound === 'nano' && entries.length && entries.every((e, k) => !codeFor(check.id, e, classes[k], check.words))) return { why: 'looked_different' };
  const hows = entries.map((e, k) => (howFound === 'nano' ? 'nano' : items?.[k] ? 'both' : 'reader'));
  return { entries, classes, hows, howFound, items, partly, nanoError };
}

/**
 * Run a scan.
 *   checks     catalogue entries to run, in order (page checks and the two Chrome checks)
 *   mode       'real' or 'practice' (the made-up pages on the Spare Key site)
 *   u          which signed-in Google account (0 to 3)
 *   nano       true when Gemini Nano is ready; then it classifies entries and reads pages the readers could not
 *   offscreen  (type, options) => Promise: talks to the offscreen page, where Gemini Nano runs
 *   onProgress ({ index, total, check, state }) for the panel's progress line
 *   onVerify   (check) => AbortSignal: a site asked "Verify it's you"; the panel tells the person they can do it in the
 *              scan tab, and aborts the signal when they choose Skip. Without it, such a check is "needs_password".
 *   signal     an AbortSignal for Stop
 * Returns { findings, outcomes, account, visited, pages, ms }. Everything in it stays on this computer. `pages` is a
 * dated record of the words on each page read (for the locked copy), since an extension cannot take screenshots of them
 * without asking to read every site.
 */
export async function runScan({ checks, mode = 'real', u = 0, windowId, nano = false, offscreen, onProgress = () => {}, onVerify = null, signal, practiceOrigin = PRACTICE_ORIGIN, refStart = 0 }) {
  const t0 = Date.now();
  const findings = [];
  const outcomes = [];
  const visited = [];
  const pages = [];
  let account = null;
  // A check of only some pages again continues the numbering, so its findings join the earlier ones without a clash.
  let refN = refStart;
  const pageChecks = checks.filter(c => c.pages?.length);
  const chromeChecks = checks.filter(c => c.service === 'chrome');
  const total = pageChecks.length + chromeChecks.length;
  let index = 0;

  let tabId = null;
  if (pageChecks.length) {
    const tab = await chrome.tabs.create({ windowId, url: 'about:blank', active: true });
    tabId = tab.id;
    await chrome.storage.session.set({ scanTabId: tabId });
  }

  try {
    for (const check of pageChecks) {
      if (signal?.aborted) throw new ScanStopped();
      index++;
      onProgress({ index, total, check, state: 'reading' });
      const c0 = Date.now();
      const outcome = { id: check.id, service: check.service, status: 'checked', how: 'reader', entries: 0, findings: 0, partly: false, ms: 0, why: null };
      for (const page of check.pages) {
        const url = mode === 'practice' ? new URL(page.practiceUrl, practiceOrigin).href : pageUrl(page.url, u);
        const reauthRe = new RegExp(check.reauthPattern);
        const asks = u => mode === 'real' && reauthRe.test(u || '');
        let finalUrl = await navigate(tabId, url, { signal });
        let read = null;
        let why = null;
        let verified = false;
        for (let tries = 0; tries < 3; tries++) {
          why = null;
          if (mode === 'real' && new RegExp(check.signedOutPattern).test(finalUrl)) { why = 'signed_out'; break; }
          if (asks(finalUrl)) {
            // One wait per check: the person verifies in the scan tab, or skips.
            const skip = !verified && onVerify ? onVerify(check) : null;
            if (skip) await chrome.tabs.update(tabId, { active: true }).catch(() => {});
            const back = skip ? await waitForVerify(tabId, url, reauthRe, { signal, skip }) : null;
            if (skip) onProgress({ index, total, check, state: 'reading' });
            verified = true;
            if (!back) { why = 'needs_password'; break; }
            finalUrl = new URL(back).pathname === new URL(url).pathname ? back : await navigate(tabId, url, { signal });
            continue;
          }
          let failed = null;
          try {
            [{ result: read }] = await chrome.scripting.executeScript({ target: { tabId }, func: readPage, args: [page.reader] });
          } catch (e) { read = null; failed = e; }
          // A settings page can show its frame first and only then move on to "Verify it's you": what was read then
          // was the frame, so look at where the tab is now before trusting it.
          const now = await chrome.tabs.get(tabId).then(t => t.pendingUrl || t.url || '').catch(() => '');
          if (asks(now)) { finalUrl = now; read = null; continue; }
          if (failed) why = /permission|cannot access/i.test(String(failed)) ? 'no_permission' : 'did_not_load';
          break;
        }
        if (!why && asks(finalUrl)) why = 'needs_password';
        visited.push(finalUrl);
        if (why) { outcome.status = 'not_checked'; outcome.why = why; break; }
        if (!read || read.errorPage) { outcome.status = 'not_checked'; outcome.why = 'did_not_load'; break; }
        account ||= read.account;
        if (read.mainText) pages.push({ check: check.id, url: finalUrl, at: new Date().toISOString(), title: read.title || '', text: read.mainText.slice(0, 20000), cut: !!read.mainTextCut });
        const p = await readToEntries({ check, read, account, ask: nano ? offscreen : null,
          onState: state => onProgress({ index, total, check, state }) });
        if (p.why) { outcome.status = 'not_checked'; outcome.why = p.why; break; }
        outcome.partly ||= p.partly;
        if (p.howFound === 'nano') outcome.how = 'nano';
        else if (p.items && outcome.how === 'reader') outcome.how = 'both';
        if (p.nanoError) outcome.nanoError = p.nanoError;
        outcome.entries += p.entries.length;
        for (const [k, entry] of p.entries.entries()) {
          const f = toFinding({ ref: `L${++refN}`, check, entry, cls: p.classes[k], howFound: p.hows[k], openUrl: mode === 'practice' ? url : pageUrl(check.pages[0].url, u), account });
          if (f) findings.push(f);
        }
      }
      outcome.findings = findings.filter(f => f.check === check.id).length;
      outcome.ms = Date.now() - c0;
      outcomes.push(outcome);
      onProgress({ index, total, check, state: 'done', outcome });
    }

    // The two Chrome checks read the browser itself, not a page. They never run in the practice check.
    for (const check of chromeChecks) {
      if (signal?.aborted) throw new ScanStopped();
      index++;
      onProgress({ index, total, check, state: 'reading' });
      const c0 = Date.now();
      let r;
      if (mode === 'practice') r = { status: 'not_checked', why: 'practice', findings: [] };
      else if (check.id === 'chrome.extensions') r = await checkExtensions(() => `L${++refN}`);
      else r = await checkSync(() => `L${++refN}`, account);
      findings.push(...r.findings);
      const outcome = { id: check.id, service: 'chrome', status: r.status, why: r.why || null, how: 'code', entries: r.entries ?? r.findings.length, findings: r.findings.length, partly: false, ms: Date.now() - c0 };
      outcomes.push(outcome);
      onProgress({ index, total, check, state: 'done', outcome });
    }
  } finally {
    if (tabId !== null) {
      await chrome.tabs.remove(tabId).catch(() => {});
      await chrome.storage.session.remove('scanTabId').catch(() => {});
    }
  }
  return { findings, outcomes, account, visited, pages, ms: Date.now() - t0 };
}
