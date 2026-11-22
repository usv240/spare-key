// The Spare Key panel on the website (panel-demo.html), in two modes:
//   ?mode=demo  (the landing page's hero) shows a stored practice check at once: real output, made-up data
//   ?mode=live  (try.html) runs the practice check in this browser: reads each practice page in the parent page's scan
//               frame with the extension's own reader, sorts the entries with hybrid inference (Gemini Nano when this
//               browser has it, Gemini in the cloud when it does not; the data is made up, so the cloud is acceptable
//               here), then builds the plan by code, asks the cloud to order it from finding types, and runs the two voices.
// Everything uses the extension's modules: the reader, the rules, the results and plan views, the cloud gate.
import { initInfo, closeInfo, isInfoOpen } from '../../extension/src/ui/info.js';
import { renderResults, h } from '../../extension/src/ui/results.js';
import { renderQuestions, renderPlan } from '../../extension/src/ui/plan.js';
import { readPage } from '../../extension/src/readers/read-page.js';
import { catalogue } from '../../extension/src/scan/catalogue.js';
import { codeClassify, merge, toFinding } from '../../extension/src/scan/rules.js';
import { hybridJson, deviceStatus } from '../../extension/src/ai.js';
import { CLASSIFY_SYSTEM, CLASSIFY_SCHEMA } from '../../extension/src/classify.js';
import { cloudPlan } from '../../extension/src/cloud/plan.js';
import { twoVoices } from '../../extension/src/cloud/voices.js';
import { toCloud } from '../../shared/cloud-safe.js';
import { buildPlan } from '../../shared/plan/engine.js';
import { applyInvariants, cleanText } from '../../shared/plan/invariants.js';
import { libraryMap } from '../../shared/steps-schema.js';
import { SITUATION, SITUATION_DEFAULTS } from '../../shared/findings.js';
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
function renderSent() {
  $('sent-log').replaceChildren(...sent.slice().reverse().map(e => {
    let pretty = e.text;
    try { pretty = JSON.stringify(JSON.parse(e.text), null, 2); } catch { /* as sent */ }
    return h('li', {}, h('div', { class: 'meta' }, h('span', { text: `${e.kind === 'function_answers' ? 'Answers to the cloud' : 'Request'}: ${e.purpose}, ${e.model}` }),
      h('time', { text: new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) })), h('pre', { text: pretty }));
  }));
  $('sent-empty').hidden = sent.length > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Results.
function showResults() {
  renderResults($('results'), { library: LIBRARY,
    scan, catalogue: catalogue({}), reveal,
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
  if (checkScreen !== 'results') show('results');
}

// ---------------------------------------------------------------------------------------------------------------
// The live practice check.
const PRACTICE_CORPUS = (() => {
  const parser = new DOMParser();
  return Object.values(PAGES).map(html => {
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
async function loadPage(url) {
  const frame = scanFrame();
  if (frame) {
    await new Promise(resolve => { frame.onload = resolve; frame.src = url; setTimeout(resolve, 10000); });
    return frame.contentDocument;
  }
  // No scan view beside this panel: read the page without showing it.
  const html = await (await fetch(url)).text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function setProgress(done, total, words) {
  $('scan-line').textContent = words;
  $('scan-count').textContent = `${Math.min(done + 1, total)} of ${total}`;
  $('scan-bar').setAttribute('aria-valuenow', String(done / total));
  $('scan-fill').style.transform = `scaleX(${done / total})`;
}

async function runPractice() {
  show('scanning', 'scan-title');
  sent.length = 0;
  const checks = catalogue({}).filter(c => c.pages.length);
  const raw = [];
  const outcomes = [];
  for (const [k, check] of checks.entries()) {
    setProgress(k, checks.length, check.progress);
    let entries = 0;
    for (const p of check.pages) {
      const doc = await loadPage(new URL(p.practiceUrl, location.origin).href);
      const read = await readPage({ ...p.reader, settleMs: 200 }, doc);
      for (const entry of read.entries) raw.push({ check, entry, url: new URL(p.practiceUrl, location.origin).href });
      entries += read.entries.length;
      await sleep(250);
    }
    outcomes.push({ id: check.id, service: check.service, status: 'checked', how: 'reader', entries, findings: 0, partly: false });
  }
  setProgress(checks.length - 1, checks.length, 'Sorting what was found with Gemini');

  // One hybrid call sorts every entry: Gemini Nano if this browser has it, the cloud if not.
  let sorted = null;
  let where = '';
  try {
    const body = { task: 'classify', owner: { name: PRACTICE_OWNER.name, email: PRACTICE_OWNER.email }, entries: raw.map((r, i) => ({ i, check: r.check.id, text: r.entry.text })) };
    const r = await hybridJson({ purpose: 'practice', body, system: `${CLASSIFY_SYSTEM}\nEach entry names the check it came from.`, schema: CLASSIFY_SCHEMA, guard: { practiceCorpus: PRACTICE_CORPUS, practiceOwner: PRACTICE_OWNER }, onSend });
    sorted = r.answer.items || [];
    where = r.source === 'on_device' ? 'Sorted by Gemini Nano, on this device.' : `Sorted by Gemini in the cloud (${r.model}). The practice data is made up, so this is the one place Spare Key lets the cloud read entries.`;
  } catch (e) {
    console.warn('Spare Key practice sorting:', String(e && e.message || e).slice(0, 300));
    lastSortError = String(e && e.message || e);
    const norm = s => String(s).replace(/\s+/g, ' ').trim();
    const missing = raw.filter(r => !norm(PRACTICE_CORPUS).includes(norm(r.entry.text)));
    if (missing.length) console.warn('Not found on the practice pages:', JSON.stringify(missing.slice(0, 3).map(r => r.entry.text)));
    where = /appCheck|app-check|403|throttle|attestation/i.test(lastSortError)
      ? 'Sorted by code only. Google’s check that this is a real browser (App Check) refused it just now, so Gemini was not asked. This happens in automated or very private browsers.'
      : /429|RESOURCE_EXHAUSTED|quota|503|500|overloaded|timed? ?out|abort/i.test(lastSortError)
        ? 'Sorted by code only. Gemini in the cloud was busy just now.'
        : 'Sorted by code only: Gemini did not answer.';
  }
  const findings = [];
  for (const [i, r] of raw.entries()) {
    const code = codeClassify(r.check.id, r.entry, PRACTICE_OWNER);
    const nano = sorted?.find(x => x.i === i);
    const cls = nano ? merge(code, nano, r.entry.text) : code;
    const f = toFinding({ ref: `L${i + 1}`, check: r.check, entry: r.entry, cls, howFound: nano ? 'both' : 'reader', openUrl: r.url, account: PRACTICE_OWNER });
    if (f) findings.push(f);
  }
  for (const o of outcomes) o.findings = findings.filter(f => f.check === o.id).length;
  scan = { mode: 'practice', findings, outcomes, account: PRACTICE_OWNER };
  $('sorted-line').replaceChildren(where);
  if (/code only/.test(where)) $('sorted-line').append(' ', h('button', { type: 'button', class: 'link-button', onclick: () => runPractice() }, 'Try again'));
  $('sorted-line').hidden = false;
  showResults();
  $('results-title')?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------------------------------------------
// The plan: by code at once, then ordered by the cloud from finding types, then the two voices.
let situation = { values: {}, share: true };
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
$('back-results').addEventListener('click', () => show('results'));

async function makePlan() {
  const values = { ...SITUATION_DEFAULTS, ...situation.values };
  const byRef = new Map(scan.findings.map(f => [f.ref, f]));
  const ctx = { findings: scan.findings.map(f => ({ ref: f.ref, code: f.code, ownership: f.ownership })), situation: values, notChecked: ['other_services'], library: LIBRARY };
  const draw = (result, source, extra = {}) => renderPlan($('plan'), { plan: result.plan, fired: result.fired, byRef, library: LIBRARY, source, onOpen: url => window.open(url, '_blank', 'noopener'), ...extra });
  const codeResult = applyInvariants(buildPlan(ctx), ctx);
  $('plan-questions').hidden = true;
  $('plan-actions').hidden = false;
  draw(codeResult, 'code', { cloudNote: 'Asking Gemini in the cloud to order this. It sees finding types only.' });
  $('plan-title')?.focus({ preventScroll: true });
  if (mode !== 'live') { draw(codeResult, 'code', { cloudNote: 'This is the plan built by code. Run the full practice check to see the cloud order it.' }); return; }
  const shared = situation.share ? Object.fromEntries(Object.keys(SITUATION).map(k => [k, !!situation.values[k]])) : {};
  const { body, refs } = toCloud(scan.findings, { situation: situation.values, shared, notChecked: ['other_services'] });
  try {
    const r = await cloudPlan({ body, library: LIBRARY, privateStrings: [], ask: async kind => (kind === 'user' ? 'skipped' : 'unknown'), onSend });
    const local = a => (Array.isArray(a.refs) ? a.refs : []).map(x => refs[x]).filter(Boolean);
    const cloud = applyInvariants({ actions: r.answer.actions.map(a => ({ action: a.action, refs: local(a), why: a.why })), summary: r.answer.summary }, ctx);
    draw(cloud, 'cloud', { model: r.model, cloudNote: 'Checking the order with two voices.' });
    try {
      const v = await twoVoices({ scan: body, draft: r.answer, privateStrings: [], library: LIBRARY, onSend });
      const settled = applyInvariants({ actions: v.answer.actions.map(a => ({ action: a.action, refs: local(a), why: a.why })), summary: v.answer.summary }, ctx);
      draw(settled, 'cloud', { model: v.model, voices: { close_the_doors: cleanText(v.lines?.close_the_doors || '').text, stay_hidden: cleanText(v.lines?.stay_hidden || '').text, arguments: v.arguments } });
    } catch {
      draw(cloud, 'cloud', { model: r.model });
    }
  } catch (e) {
    const busy = /429|RESOURCE_EXHAUSTED|quota|503/i.test(String(e));
    draw(codeResult, 'code', { cloudNote: busy ? 'The cloud was busy, so this plan was made in this browser from Spare Key’s steps library. You can try again in a minute.' : 'This plan was made in this browser from Spare Key’s steps library.' });
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
  $('start').addEventListener('click', runPractice);
  show('start');
})();
