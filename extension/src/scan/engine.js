// The scan engine (TECHNICAL-DESIGN.md section 5). It opens one scan tab beside the side panel, visits each settings
// page, injects the reader, and turns what it read into findings. It only opens pages and reads them: it never clicks,
// scrolls, types or submits.
//
// It runs in the side panel page, not the service worker. Chrome can stop an idle service worker after 30 seconds, and
// one Gemini Nano call can take longer; the panel stays alive while it is open. Closing the panel (Quick exit does)
// ends the scan, which is what should happen.
import { readPage } from '../readers/read-page.js';
import { codeClassify, merge, toFinding } from './rules.js';
import { pageUrl, PRACTICE_ORIGIN } from './catalogue.js';
import { checkExtensions, checkSync } from './chrome-checks.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
export class ScanStopped extends Error { constructor() { super('stopped'); this.name = 'ScanStopped'; } }

/** Navigate the scan tab and wait until it has loaded (or left for a sign-in page). Returns the final URL. */
async function navigate(tabId, url, { timeoutMs = 30000, signal } = {}) {
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
 * Run a scan.
 *   checks     catalogue entries to run, in order (page checks and the two Chrome checks)
 *   mode       'real' or 'practice' (the made-up pages on the Spare Key site)
 *   u          which signed-in Google account (0 to 3)
 *   nano       true when Gemini Nano is ready; then it classifies entries and reads pages the readers could not
 *   offscreen  (type, options) => Promise: talks to the offscreen page, where Gemini Nano runs
 *   onProgress ({ index, total, check, state }) for the panel's progress line
 *   signal     an AbortSignal for Stop
 * Returns { findings, outcomes, account, visited, ms }. Everything in it stays on this computer.
 */
export async function runScan({ checks, mode = 'real', u = 0, windowId, nano = false, offscreen, onProgress = () => {}, signal, practiceOrigin = PRACTICE_ORIGIN }) {
  const t0 = Date.now();
  const findings = [];
  const outcomes = [];
  const visited = [];
  let account = null;
  let refN = 0;
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
      const outcome = { id: check.id, service: check.service, status: 'checked', how: nano ? 'both' : 'reader', entries: 0, findings: 0, partly: false, ms: 0, why: null };
      for (const page of check.pages) {
        const url = mode === 'practice' ? new URL(page.practiceUrl, practiceOrigin).href : pageUrl(page.url, u);
        const finalUrl = await navigate(tabId, url, { signal });
        visited.push(finalUrl);
        if (mode === 'real' && new RegExp(check.signedOutPattern).test(finalUrl)) { outcome.status = 'not_checked'; outcome.why = 'signed_out'; break; }
        if (mode === 'real' && new RegExp(check.reauthPattern).test(finalUrl)) { outcome.status = 'not_checked'; outcome.why = 'needs_password'; break; }

        let read;
        try {
          [{ result: read }] = await chrome.scripting.executeScript({ target: { tabId }, func: readPage, args: [page.reader] });
        } catch (e) {
          outcome.status = 'not_checked';
          outcome.why = /permission|cannot access/i.test(String(e)) ? 'no_permission' : 'did_not_load';
          break;
        }
        if (!read || read.errorPage || (read.timedOut && !read.entries?.length)) { outcome.status = 'not_checked'; outcome.why = 'did_not_load'; break; }
        account ||= read.account;
        outcome.partly ||= read.moreHidden;

        // The entries: from the reader, or, when it found none on a page that loaded, from Gemini Nano reading the page.
        let entries = read.entries || [];
        let howFound = 'reader';
        if (!entries.length && nano && read.mainText) {
          onProgress({ index, total, check, state: 'nano-reading' });
          const r = await offscreen('sk:read-page', { description: check.label, text: read.mainText });
          if (!r?.error && r?.entries?.length) { entries = r.entries; howFound = 'nano'; }
        }
        outcome.entries += entries.length;
        if (!entries.length) continue;

        // Classify: code always, Gemini Nano when it is ready.
        let nanoItems = null;
        if (nano) {
          onProgress({ index, total, check, state: 'classifying' });
          const r = await offscreen('sk:classify', { description: check.label, owner: account, entries });
          if (!r?.error) nanoItems = r.items;
          else outcome.nanoError = r.error;
        }
        for (const [k, entry] of entries.entries()) {
          const code = codeClassify(check.id, entry, account);
          const cls = nanoItems?.[k] ? merge(code, nanoItems[k], entry.text) : { ...code, source: 'reader' };
          const how = howFound === 'nano' ? 'nano' : nanoItems?.[k] ? 'both' : 'reader';
          const f = toFinding({ ref: `L${++refN}`, check, entry, cls, howFound: how, openUrl: mode === 'practice' ? url : pageUrl(check.pages[0].url, u), account });
          if (f) findings.push(f);
        }
      }
      if (!nano) outcome.how = 'reader';
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
  return { findings, outcomes, account, visited, ms: Date.now() - t0 };
}
