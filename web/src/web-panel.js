// The Spare Key panel on the website (panel-demo.html), in two modes:
//   ?mode=demo  (the landing page's hero) shows a stored practice check at once: real output, made-up data
//   ?mode=live  (try.html) runs the practice check in this browser: reads each practice page in the parent page's scan
//               frame with the extension's own reader, sorts the entries with hybrid inference (Gemini Nano when this
//               browser has it, Gemini in the cloud when it does not; the data is made up, so the cloud is acceptable
//               here), then builds the plan by code, asks the cloud to order it from finding types, and runs the two voices.
// Everything uses the extension's modules: the reader, the rules, the results and plan views, the cloud gate.
// The network ledger loads first, so it counts every request the Firebase code makes from this page.
import { ledgerSummary } from '../../extension/src/ledger.js';
import { initInfo, closeInfo, isInfoOpen } from '../../extension/src/ui/info.js';
import { renderResults, h } from '../../extension/src/ui/results.js';
import { renderQuestions, renderPlan } from '../../extension/src/ui/plan.js';
import { readPage } from '../../extension/src/readers/read-page.js';
import { catalogue } from '../../extension/src/scan/catalogue.js';
import { codeClassify, codeFor, merge, toFinding } from '../../extension/src/scan/rules.js';
import { compareChecks } from '../../extension/src/scan/compare.js';
import { hybridJson, hybridImageJson, deviceStatus, liveSettings } from '../../extension/src/ai.js';
// Where the reader fix came from on the last "Break the pages first" run (Remote Config, or the copy in this page).
let fixFrom = '';
import { CLASSIFY_SYSTEM, CLASSIFY_SCHEMA, READ_PAGE_SYSTEM, READ_PAGE_SCHEMA, pageItemText, READ_SHOT_SYSTEM, READ_SHOT_SCHEMA, shotEntries } from '../../extension/src/classify.js';
import SHOT from '../practice/phone-sharing.json';
import { DRIFT, driftPage, driftUrl } from '../practice/drift.mjs';
import { FIXES } from '../practice/drift-fixes.mjs';
import { cloudPlan } from '../../extension/src/cloud/plan.js';
import { twoVoices } from '../../extension/src/cloud/voices.js';
import { toCloud } from '../../shared/cloud-safe.js';
import { buildPlan } from '../../shared/plan/engine.js';
import { applyInvariants, cleanText } from '../../shared/plan/invariants.js';
import { libraryMap } from '../../shared/steps-schema.js';
import { SITUATION, SITUATION_DEFAULTS, CODE_TEXT } from '../../shared/findings.js';
import { QUICK_EXIT_URL } from '../../shared/config.js';
import { PAGES, PRACTICE_OWNER } from '../practice/pages.mjs';
import STEPS from '../../data/steps.json';
import STORED from './data/practice-scan.json';

const $ = id => document.getElementById(id);
const LIBRARY = libraryMap(STEPS);
const mode = new URLSearchParams(location.search).get('mode') === 'live' ? 'live' : 'demo';
const sent = [];
let scan = null;
const reveal = new Set();

// ---------------------------------------------------------------------------------------------------------------
// Quick exit leaves the whole page, not just this frame.
function quickExit() {
  try { sessionStorage.clear(); } catch { /* blocked */ }
  if (window.top !== window && window.top.spareKeyQuickExit) window.top.spareKeyQuickExit();
  else (window.top || window).location.replace(QUICK_EXIT_URL);
}
$('quick-exit').addEventListener('click', quickExit);
let lastEscape = 0;
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (performance.now() - lastEscape < 1000) quickExit();
  lastEscape = performance.now();
  if (isInfoOpen()) closeInfo();
});
addEventListener('message', e => {
  if (e.origin !== location.origin || e.data?.type !== 'sk-theme') return;
  if (e.data.value === 'light' || e.data.value === 'dark') document.documentElement.dataset.theme = e.data.value;
  else delete document.documentElement.dataset.theme;
});

// ---------------------------------------------------------------------------------------------------------------
// Screens and tabs.
const SCREENS = ['start', 'scanning', 'results', 'plan', 'sent'];
let checkScreen = 'start';
function show(name, focus) {
  if (name !== 'sent') checkScreen = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $('tab-check').setAttribute('aria-selected', String(name !== 'sent'));
  $('tab-sent').setAttribute('aria-selected', String(name === 'sent'));
  $('tab-check').tabIndex = name === 'sent' ? -1 : 0;
  $('tab-sent').tabIndex = name === 'sent' ? 0 : -1;
  closeInfo({ returnFocus: false });
  scrollTo(0, 0);
  if (focus) $(focus)?.focus({ preventScroll: true });
}
$('tab-check').addEventListener('click', () => show(checkScreen));
$('tab-sent').addEventListener('click', () => { renderSent(); show('sent'); });

const onSend = async entry => { sent.push(entry); renderSent(); };
function renderLedger() {
  const r = ledgerSummary();
  const size = n => (n < 1024 ? `${n} bytes` : `${(n / 1024).toFixed(1)} KB`);
  $('ledger').replaceChildren(...(r.rows.length ? [h('div', { class: 'table-scroll' }, h('table', { class: 'ledger' },
    h('caption', { class: 'visually-hidden', text: 'Requests from this page, by where they went' }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Sent to' }), h('th', { scope: 'col', class: 'num', text: 'Requests' }), h('th', { scope: 'col', class: 'num', text: 'Size' }))),
    h('tbody', {}, r.rows.map(x => h('tr', {}, h('td', { text: x.who }), h('td', { class: 'num', text: String(x.requests) }), h('td', { class: 'num', text: size(x.bytes) }))))))] : []));
}
function renderSent() {
  renderLedger();
  $('sent-log').replaceChildren(...sent.slice().reverse().map(e => {
    let pretty = e.text;
    try { pretty = JSON.stringify(JSON.parse(e.text), null, 2); } catch { /* as sent */ }
    return h('li', {}, e.purpose === 'practice' ? h('p', { class: 'notice', text: 'Practice only. This holds made-up names because the practice data is invented. The extension never sends names, addresses or page text.' }) : null,
      h('div', { class: 'meta' }, h('span', { text: `${e.kind === 'function_answers' ? 'Answers to the cloud' : 'Request'}: ${e.purpose}, ${e.model}` }),
      h('time', { text: new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) })), h('pre', { text: pretty }),
      // The fixed parts sent with every request, as in the extension: the instructions, the answer format, the functions.
      e.fixed ? h('details', { class: 'fixed' }, h('summary', { text: 'The fixed instructions sent with it' }),
        h('pre', { text: [e.fixed.instructions, e.fixed.tools?.length ? `Functions offered: ${e.fixed.tools.join(', ')}` : '', e.fixed.format ? `Answer format: ${e.fixed.format}` : ''].filter(Boolean).join('\n\n') })) : null);
  }));
  $('sent-empty').hidden = sent.length > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// "Since your last check": this check next to the one before it, with the extension's own comparison.
function showSince() {
  const el = $('since');
  if (!before || !afterChange) { el.replaceChildren(); el.hidden = true; return; }
  const r = compareChecks(before, scan);
  const gone = r.removed.map(x => `${(CODE_TEXT[x.code] || [x.code])[0]} (${String(x.label).split('\n')[0]})`);
  el.replaceChildren(
    h('h2', { text: 'Since your last check' }),
    h('p', { text: gone.length ? `${gone.length === 1 ? '1 thing is' : `${gone.length} things are`} gone: ${gone.join('; ')}.` : 'Nothing is gone.' }),
    h('p', { text: `${r.added.length ? `${r.added.length} new.` : 'Nothing new.'} ${r.same} still there.` }),
    h('p', { class: 'muted', text: 'In the extension, a check is compared with a locked copy you saved. Something new can mean someone was given access again, or got back in.' }),
  );
  el.hidden = false;
}

// ---------------------------------------------------------------------------------------------------------------
// Results.
function showResults() {
  renderResults($('results'), { library: LIBRARY,
    scan, catalogue: [...catalogue({}), SHOT_CHECK], reveal,
    onAnswer: (ref, ownership) => {
      const f = scan.findings.find(x => x.ref === ref);
      if (f) f.ownership = ownership;
      showResults();
      document.querySelector(`[data-ref="${ref}"] [data-answer="${ownership || 'mine'}"]`)?.focus({ preventScroll: true });
    },
    onOpen: url => window.open(url, '_blank', 'noopener'),
    onToggleReveal: ref => { if (reveal.has(ref)) reveal.delete(ref); else reveal.add(ref); showResults(); },
  });
  $('full-check').hidden = mode === 'live';
  $('phone-shot').hidden = mode !== 'live';
  // "After a change" is offered once, on a full check of the pages as made that found the share it turns off.
  $('after-box').hidden = mode !== 'live' || afterChange || driftKind !== 'none' || !scan.findings.some(f => String(f.detail || f.label).includes(CHANGED.gone) && f.check === 'maps.sharing');
  showSince();
  if (checkScreen !== 'results') show('results');
}

// ---------------------------------------------------------------------------------------------------------------
// Jordan's phone: the made-up screenshot, read with hybrid inference and image input (Gemini Nano when this browser has
// it, the cloud when not). Only this picture can be sent: hybridImageJson checks its SHA-256 first.
const SHOT_CHECK = { id: 'screenshot', service: 'phone', label: 'A location app on Jordan’s phone, from a screenshot', pages: [] };
const toBase64 = buf => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
$('read-shot').addEventListener('click', async () => {
  const button = $('read-shot');
  const status = $('shot-status');
  button.disabled = true;
  status.textContent = 'Reading the screenshot.';
  try {
    const data = toBase64(await (await fetch('/practice/phone-sharing.png')).arrayBuffer());
    const r = await hybridImageJson({ image: { mimeType: SHOT.mimeType, data }, prompt: 'Read this screenshot.', system: READ_SHOT_SYSTEM, schema: READ_SHOT_SCHEMA, allowed: [SHOT.sha256], onSend });
    const { entries } = shotEntries(r.answer);
    const how = r.source === 'on_device' ? 'nano' : 'cloud';
    const found = entries.map((entry, k) => toFinding({
      ref: `S${k + 1}`, check: SHOT_CHECK, entry: { ...entry, href: '', state: [] },
      cls: { ...codeClassify('screenshot', entry, PRACTICE_OWNER), source: 'both' }, howFound: how, openUrl: '', account: PRACTICE_OWNER,
    })).filter(Boolean);
    scan.findings = scan.findings.filter(f => f.check !== 'screenshot').concat(found);
    scan.outcomes = scan.outcomes.filter(o => o.id !== 'screenshot').concat({ id: 'screenshot', service: 'phone', status: 'checked', why: null, how, entries: entries.length, findings: found.length, partly: false });
    showResults();
    $('shot-status').textContent = how === 'nano'
      ? `${found.length} added to the list above. Gemini Nano read it on this device.`
      : `${found.length} added to the list above. Gemini in the cloud read it, because this browser has no Gemini Nano. The picture is made up, so that is allowed here. The extension reads your own screenshots only on your computer.`;
  } catch (e) {
    status.textContent = /app ?check|app-check|40[13]|throttle|attestation/i.test(String(e)) ? 'Google’s check that this is a real browser refused it just now, so the screenshot was not read.' : 'Gemini could not read the screenshot just now. You can try again.';
  } finally {
    button.disabled = false;
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The live practice check.
const PRACTICE_CORPUS = (() => {
  const parser = new DOMParser();
  // The practice pages and their changed copies ("Break the pages first"): every word the practice check may send.
  const all = Object.entries(PAGES).flatMap(([file, html]) => [html, ...DRIFT.map(d => driftPage(html, file, d.id))]);
  return all.map(html => {
    const doc = parser.parseFromString(html, 'text/html');
    const parts = [];
    const walker = doc.createTreeWalker(doc.body, 4);
    // The same text the reader sees: it skips option, script and style text (read-page.js textOf).
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TITLE)$/.test(n.parentElement?.tagName || '')) continue;
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  }).join(' ');
})();

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastSortError = '';
function scanFrame() {
  try { return window.parent !== window ? window.parent.document.getElementById('scan-view') : null; } catch { return null; }
}
// "After a change": the made-up person turns off one location share. The entry is taken off the practice page itself
// once it has loaded, so the page beside the panel shows the change and the reader reads what is there.
let afterChange = false;
let before = null;
const CHANGED = { page: 'locationsharing.html', gone: 'Sam Porter' };
function applyChange(doc, url) {
  if (!afterChange || !doc || !url.includes(CHANGED.page)) return doc;
  for (const li of doc.querySelectorAll('li, [role="listitem"], tr')) if (li.textContent.includes(CHANGED.gone)) li.remove();
  return doc;
}
async function loadPage(url) {
  const frame = scanFrame();
  if (frame) {
    await new Promise(resolve => { frame.onload = resolve; frame.src = url; setTimeout(resolve, 10000); });
    return applyChange(frame.contentDocument, url);
  }
  // No scan view beside this panel: read the page in a frame of our own, placed off the screen. It has to be a real,
  // laid-out page: the reader skips anything that is not visible, and a page that was only parsed has nothing visible.
  let own = document.getElementById('own-scan-view');
  if (!own) {
    own = Object.assign(document.createElement('iframe'), { id: 'own-scan-view', title: 'The practice settings page being read', tabIndex: -1 });
    own.setAttribute('aria-hidden', 'true');
    Object.assign(own.style, { position: 'fixed', left: '-10000px', top: '0', width: '1024px', height: '768px', border: '0' });
    document.body.append(own);
  }
  await new Promise(resolve => { own.onload = resolve; own.src = url; setTimeout(resolve, 10000); });
  return applyChange(own.contentDocument, url);
}

function setProgress(done, total, words) {
  $('scan-line').textContent = words;
  $('scan-count').textContent = `${Math.min(done + 1, total)} of ${total}`;
  $('scan-bar').setAttribute('aria-valuenow', String(done / total));
  $('scan-fill').style.transform = `scaleX(${done / total})`;
}

// "Break the pages first": which changed copy of the practice pages to read, and whether the Remote Config fix is on.
let driftKind = 'none';
function drawDriftChoices() {
  const choices = [['none', 'As made'], ...DRIFT.map(d => [d.id, d.label])];
  $('drift-choices').replaceChildren(...choices.map(([id, words]) => {
    const input = h('input', { type: 'radio', name: 'drift', value: id });
    input.checked = id === driftKind;
    input.addEventListener('change', () => { driftKind = id; $('apply-fix').disabled = id === 'none'; });
    return h('label', { class: 'choice' }, input, h('span', { text: words }));
  }));
  $('apply-fix').disabled = driftKind === 'none';
}

// A page the code reader found nothing on: Gemini reads its text (on this device when it can, else in the cloud; the
// pages are made up). Only words that are on the page are kept. Returns { entries, where } or null.
async function aiReadPage(check, read) {
  try {
    const r = await hybridJson({
      purpose: 'practice',
      body: { task: 'read_page', owner: { name: PRACTICE_OWNER.name, email: PRACTICE_OWNER.email }, check: check.id, page_text: read.mainText.slice(0, 6000) },
      system: `${READ_PAGE_SYSTEM}\nFind: ${check.label}.`, schema: READ_PAGE_SCHEMA,
      guard: { practiceCorpus: PRACTICE_CORPUS, practiceOwner: PRACTICE_OWNER }, onSend,
    });
    const flat = s => String(s).replace(/\s+/g, ' ').trim();
    const page = flat(read.mainText);
    const entries = (r.answer.entries || []).map(pageItemText)
      .filter((t, i, all) => t && page.includes(flat(t)) && all.findIndex(x => flat(x) === flat(t)) === i)
      .map((text, i) => ({ i, text, href: '', state: [] }));
    return { entries, where: r.source === 'on_device' ? 'nano' : 'cloud' };
  } catch (e) {
    lastSortError = String(e && e.message || e);
    return null;
  }
}

// What happened on the changed pages, in one or two sentences above the results.
function driftSummary(kind, fix, outcomes) {
  const total = outcomes.length;
  const byCode = outcomes.filter(o => o.status === 'checked' && o.how === 'reader').length;
  const byAi = outcomes.filter(o => o.status === 'checked' && (o.how === 'nano' || o.how === 'cloud'));
  const notRead = outcomes.filter(o => o.status !== 'checked').length;
  const ai = byAi.some(o => o.how === 'nano') ? 'Gemini Nano, on this device,' : 'Gemini in the cloud';
  return [
    `Pages changed: ${DRIFT.find(d => d.id === kind).label.toLowerCase()}${fix ? `, with the fix ${fixFrom}` : ''}.`,
    `The code reader read ${byCode} of ${total} checks.`,
    byAi.length ? `${ai} read ${byAi.length} more that the code could not.` : '',
    notRead ? `${notRead} could not be read, so ${notRead === 1 ? 'it is' : 'they are'} listed under “Not checked” rather than shown as empty.` : '',
  ].filter(Boolean).join(' ');
}

async function runPractice() {
  show('scanning', 'scan-title');
  sent.length = 0;
  const kind = driftKind;
  const fix = kind !== 'none' && $('apply-fix').checked;
  // The fix comes from Remote Config, as it would for an install. If Remote Config cannot be reached, the copy inside
  // this page is used, and the result says so.
  let fixes = {};
  fixFrom = '';
  if (fix) {
    const s = await liveSettings().catch(() => null);
    const live = s && s.from !== 'defaults' && s.practiceFixes?.[kind];
    fixes = live && Object.keys(live).length ? live : FIXES[kind];
    fixFrom = live && Object.keys(live).length ? (s.from === 'remote' ? 'fetched from Remote Config' : 'from Remote Config, as fetched earlier') : 'from the copy in this page, because Remote Config was not reached';
  }
  const checks = catalogue(fixes).filter(c => c.pages.length);
  const raw = [];
  const outcomes = [];
  for (const [k, check] of checks.entries()) {
    setProgress(k, checks.length, check.progress);
    const outcome = { id: check.id, service: check.service, status: 'checked', why: null, how: 'reader', entries: 0, findings: 0, partly: false };
    for (const p of check.pages) {
      const path = kind === 'none' || p.practiceUrl.includes('/drift/') ? p.practiceUrl : driftUrl(p.practiceUrl, kind);
      const url = new URL(path, location.origin).href;
      const doc = await loadPage(url);
      // The changed pages are static, so a short wait is enough to know the words the reader waits for are missing.
      const read = await readPage({ ...p.reader, settleMs: 200, ...(kind === 'none' ? {} : { timeoutMs: 2500 }) }, doc);
      let entries = read.entries;
      let how = 'reader';
      // The same rules as the extension's scan (extension/src/scan/engine.js readToEntries).
      if (!entries.length && read.mainText) {
        setProgress(k, checks.length, 'The code reader found nothing on this page, so Gemini is reading it');
        const ai = await aiReadPage(check, read);
        if (ai?.entries.length) { entries = ai.entries; how = ai.where; outcome.how = ai.where; }
        // If the code rules make nothing of what Gemini read, the page's words changed too: not "nothing found".
        if (how !== 'reader' && entries.every(e => !codeFor(check.id, e, codeClassify(check.id, e, PRACTICE_OWNER, check.words), check.words))) {
          outcome.status = 'not_checked'; outcome.why = 'looked_different'; break;
        }
      }
      if (read.timedOut && !entries.length) { outcome.status = 'not_checked'; outcome.why = String(read.mainText || '').trim() ? 'looked_different' : 'did_not_load'; break; }
      outcome.partly ||= read.timedOut || read.moreHidden;
      if (!entries.length && !read.emptyConfirmed && !read.withinFound) { outcome.status = 'not_checked'; outcome.why = 'looked_different'; break; }
      for (const entry of entries) raw.push({ check, entry, url, how });
      outcome.entries += entries.length;
      await sleep(250);
    }
    outcomes.push(outcome);
  }
  const driftWords = kind === 'none' ? '' : driftSummary(kind, fix, outcomes);
  setProgress(checks.length - 1, checks.length, 'Sorting what was found with Gemini');
  // Gemini Nano sorting 24 entries took about 3 minutes in the builder's Chrome (November 22, 2026), so the line counts up.
  const sortStart = Date.now();
  const onDevice = (await deviceStatus()) === 'available';
  const tick = setInterval(() => {
    const secs = Math.round((Date.now() - sortStart) / 1000);
    $('scan-line').textContent = onDevice
      ? `Gemini Nano is sorting ${raw.length} entries on this device (${secs} s). It can take a few minutes.`
      : `Gemini is sorting ${raw.length} made-up entries (${secs} s).`;
  }, 1000);

  // One hybrid call sorts every entry: Gemini Nano if this browser has it, the cloud if not.
  let sorted = null;
  let where = '';
  if (!raw.length) where = 'Nothing could be read, so there was nothing to sort.';
  else try {
    const body = { task: 'classify', owner: { name: PRACTICE_OWNER.name, email: PRACTICE_OWNER.email }, entries: raw.map((r, i) => ({ i, check: r.check.id, text: r.entry.text })) };
    // Every entry is already read by code. Gemini only sorts them, which can take minutes on the device, so the person
    // can stop waiting and see the results as code alone sorted them.
    const skipped = new Promise(resolve => { $('skip-sort').onclick = () => resolve(null); });
    $('skip-sort').hidden = !onDevice;
    const r = await Promise.race([hybridJson({ purpose: 'practice', body, system: `${CLASSIFY_SYSTEM}\nEach entry names the check it came from.`, schema: CLASSIFY_SCHEMA, guard: { practiceCorpus: PRACTICE_CORPUS, practiceOwner: PRACTICE_OWNER }, onSend }), skipped]);
    sorted = r ? r.answer.items || [] : null;
    where = !r ? 'Sorted by code only: you chose not to wait for Gemini Nano. Start again to let it sort the entries on this device.' : r.source === 'on_device' ? 'Sorted by Gemini Nano, on this device.' : `Sorted by Gemini in the cloud (${r.model}). The practice data is made up, so this is the one place Spare Key lets the cloud read entries.`;
  } catch (e) {
    console.warn('Spare Key practice sorting:', String(e && e.message || e).slice(0, 300));
    lastSortError = String(e && e.message || e);
    const norm = s => String(s).replace(/\s+/g, ' ').trim();
    const missing = raw.filter(r => !norm(PRACTICE_CORPUS).includes(norm(r.entry.text)));
    if (missing.length) console.warn('Not found on the practice pages:', JSON.stringify(missing.slice(0, 3).map(r => r.entry.text)));
    where = /app ?check|app-check|40[13]|throttle|attestation/i.test(lastSortError)
      ? 'Sorted by code only. Google’s check that this is a real browser (App Check) refused it just now, so Gemini was not asked. This happens in automated or very private browsers.'
      : /429|RESOURCE_EXHAUSTED|quota|503|500|overloaded|timed? ?out|abort/i.test(lastSortError)
        ? 'Sorted by code only. Gemini in the cloud was busy just now.'
        : 'Sorted by code only: Gemini did not answer.';
  }
  clearInterval(tick);
  $('skip-sort').hidden = true;
  const findings = [];
  for (const [i, r] of raw.entries()) {
    const code = codeClassify(r.check.id, r.entry, PRACTICE_OWNER, r.check.words);
    const nano = sorted?.find(x => x.i === i);
    const cls = nano ? merge(code, nano, r.entry.text) : code;
    const f = toFinding({ ref: `L${i + 1}`, check: r.check, entry: r.entry, cls, howFound: r.how !== 'reader' ? r.how : nano ? 'both' : 'reader', openUrl: r.url, account: PRACTICE_OWNER });
    if (f) findings.push(f);
  }
  for (const o of outcomes) o.findings = findings.filter(f => f.check === o.id).length;
  scan = { mode: 'practice', findings, outcomes, account: PRACTICE_OWNER };
  $('drift-line').textContent = driftWords;
  $('drift-line').hidden = !driftWords;
  $('sorted-line').replaceChildren(where);
  // After an App Check refusal the SDK will not ask again in this page load, so the button reloads the panel instead.
  const refused = /refused/.test(where);
  if (/code only/.test(where) && !/chose not to wait/.test(where)) $('sorted-line').append(' ', h('button', { type: 'button', class: 'link-button', onclick: () => (refused ? location.reload() : runPractice()) }, refused ? 'Reload and try again' : 'Try again'));
  $('sorted-line').hidden = false;
  showResults();
  $('results-title')?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------------------------------------------
const simpler = {};
const SIMPLER_SYSTEM = `Rewrite these steps for changing one setting in very simple words, at a grade 4 reading level.
Keep the same order, and the same number of steps or one more. Keep every button and menu name exactly as written.
Keep every warning. Do not add names, numbers, links or advice that are not in the steps. Never say safe or secure.`;
const SIMPLER_SCHEMA = { type: 'object', properties: { steps: { type: 'array', items: { type: 'string', maxLength: 200 } } }, required: ['steps'] };

// The plan: by code at once, then ordered by the cloud from finding types, then the two voices.
let situation = { values: {}, share: false };
function showQuestions() {
  const draw = () => renderQuestions($('plan-questions'), {
    values: situation.values, share: situation.share, cloudOn: true,
    onChange: (v, s) => { situation = { values: v, share: s }; draw(); },
    onMake: makePlan,
  });
  draw();
  $('plan').replaceChildren();
  $('plan-actions').hidden = true;
  $('plan-questions').hidden = false;
  show('plan');
}
$('to-plan').addEventListener('click', showQuestions);
$('after-go').addEventListener('click', () => { before = scan; afterChange = true; runPractice(); });
$('back-results').addEventListener('click', () => show('results'));

async function makePlan() {
  const values = { ...SITUATION_DEFAULTS, ...situation.values };
  const byRef = new Map(scan.findings.map(f => [f.ref, f]));
  // Not checked, and checked only in part: both become "check it yourself" steps, as in the extension.
  const notChecked = [...scan.outcomes.filter(o => (o.status !== 'checked' || o.partly) && o.id !== 'screenshot').map(o => o.id), 'other_services'];
  const ctx = { findings: scan.findings.map(f => ({ ref: f.ref, code: f.code, ownership: f.ownership })), situation: values, notChecked, library: LIBRARY };
  const cat = catalogue({});
  const helpers = {
    simpler, checkLabels: Object.fromEntries(cat.map(c => [c.id, c.label])),
    onOpenCheck: id => { const p = cat.find(c => c.id === id)?.pages?.[0]; if (p) window.open(p.practiceUrl, '_blank', 'noopener'); },
  };
  let last = null;
  const draw = (result, source, extra = {}) => { last = { result, source, extra }; return renderPlan($('plan'), { plan: result.plan, fired: result.fired, byRef, library: LIBRARY, source, ...helpers, onSimpler, onOpen: url => window.open(url, '_blank', 'noopener'), ...extra }); };
  // "Say it more simply": hybrid inference on one library entry's public steps (Gemini Nano here if the browser has it).
  async function onSimpler(code) {
    const redraw = () => { draw(last.result, last.source, last.extra); const b = document.querySelector(`#plan [data-code="${code}"]`); if (b?.tagName === 'DETAILS') b.open = true; b?.querySelector('details.later')?.setAttribute('open', ''); };
    simpler[code] = { pending: true };
    redraw();
    try {
      const r = await hybridJson({ purpose: 'simpler', body: { code, steps: LIBRARY[code].steps }, guard: { library: LIBRARY }, onSend, system: SIMPLER_SYSTEM, schema: SIMPLER_SCHEMA });
      const allowed = JSON.stringify(LIBRARY[code]);
      const steps = (r.answer.steps || []).slice(0, LIBRARY[code].steps.length + 1).map(x => cleanText(String(x).slice(0, 200), allowed).text).filter(Boolean);
      simpler[code] = steps.length ? { steps, source: r.source } : { error: true };
    } catch { simpler[code] = { error: true }; }
    redraw();
  }
  const codeResult = applyInvariants(buildPlan(ctx), ctx);
  $('plan-questions').hidden = true;
  $('plan-actions').hidden = false;
  draw(codeResult, 'code', { cloudNote: 'Asking Gemini in the cloud to order this. It sees finding types only.' });
  $('plan-title')?.focus({ preventScroll: true });
  if (mode !== 'live') { draw(codeResult, 'code', { cloudNote: 'This is the plan built by code. Run the full practice check to see the cloud order it.' }); return; }
  const shared = situation.share ? Object.fromEntries(Object.keys(SITUATION).map(k => [k, !!situation.values[k]])) : {};
  const { body, refs } = toCloud(scan.findings, { situation: situation.values, shared, notChecked });
  try {
    const r = await cloudPlan({ body, library: LIBRARY, privateStrings: [], ask: async kind => (kind === 'user' ? 'skipped' : 'unknown'), onSend });
    const local = a => (Array.isArray(a.refs) ? a.refs : []).map(x => refs[x]).filter(Boolean);
    const cloud = applyInvariants({ actions: r.answer.actions.map(a => ({ action: a.action, refs: local(a), why: a.why })), summary: r.answer.summary }, ctx);
    draw(cloud, 'cloud', { model: r.model, cloudNote: 'Checking the order with two voices.' });
    try {
      const v = await twoVoices({ scan: body, draft: r.answer, privateStrings: [], library: LIBRARY, onSend });
      const settled = applyInvariants({ actions: v.answer.actions.map(a => ({ action: a.action, refs: local(a), why: a.why })), summary: v.answer.summary }, ctx);
      draw(settled, 'cloud', { model: v.model, voices: { close_the_doors: cleanText(v.lines?.close_the_doors || '').text, stay_hidden: cleanText(v.lines?.stay_hidden || '').text, arguments: v.arguments, table: v.table || [] } });
    } catch {
      draw(cloud, 'cloud', { model: r.model });
    }
  } catch (e) {
    // The lead line already says the plan was made from the steps library; this says why the cloud did not order it.
    const why = String(e && e.message || e);
    const note = /app ?check|app-check|40[13]|throttle|attestation/i.test(why)
      ? 'Gemini in the cloud was not asked: Google’s check that this is a real browser (App Check) refused it. This happens in automated or very private browsers.'
      : /429|RESOURCE_EXHAUSTED|quota|503|500|overloaded|timed? ?out|abort/i.test(why)
        ? 'Gemini in the cloud was busy just now. You can try again in a minute.'
        : 'Gemini in the cloud did not answer.';
    draw(codeResult, 'code', { cloudNote: note });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Start-up.
(async () => {
  initInfo(document);
  if (mode === 'demo') {
    scan = structuredClone(STORED);
    showResults();
    return;
  }
  const status = await deviceStatus();
  $('where-line').textContent = status === 'available'
    ? 'Gemini Nano is ready in this browser, so the practice entries are sorted on this device.'
    : 'Gemini Nano is not in this browser, so the practice entries are sorted by Gemini in the cloud. That is acceptable here because the data is made up.';
  $('where-dot').classList.toggle('on', status === 'available');
  drawDriftChoices();
  $('start').addEventListener('click', () => { afterChange = false; before = null; runPractice(); });
  show('start');
})();
