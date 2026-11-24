// The side panel: the safety screen, choosing what to check, the scan, the results, and Under the hood.
// Quick exit is wired first, so it works even if anything below fails.
import { initInfo, closeInfo, isInfoOpen, prepare, registerInfo } from './ui/info.js';
import { compareChecks } from './scan/compare.js';
import { SERVICES, catalogue, pageUrl, PRACTICE_ORIGIN, readerVersion } from './scan/catalogue.js';

// Whether the person sent the anonymous layout report for a scan (by scan time), for this panel's life only.
const reportStates = {};
import { setRemoteOverrides } from './scan/overrides.js';
import { runScan, ScanStopped } from './scan/engine.js';
import { codeClassify, toFinding } from './scan/rules.js';

// The phone screenshot check (below): not a page the scan opens, so not in the catalogue.
const SHOT_CHECK = { id: 'screenshot', service: 'phone', label: 'A location app on your phone, from a screenshot', pages: [] };
import { renderResults, h, put, infoButton } from './ui/results.js';
import { renderQuestions, renderPlan } from './ui/plan.js';
import { privateStringsFrom } from './scan/private.js';
import { toCloud } from '../../shared/cloud-safe.js';
import { buildPlan } from '../../shared/plan/engine.js';
import { applyInvariants, cleanText } from '../../shared/plan/invariants.js';
import { libraryMap } from '../../shared/steps-schema.js';
import { CODES, CODE_TEXT, SITUATION, SITUATION_DEFAULTS, OWNERSHIP, RECENCY, HOW_FOUND } from '../../shared/findings.js';
import STEPS from '../../data/steps.json';
import { lock, unlock } from '../../shared/lockedfile.js';

// The steps library: the bundled copy, replaced for this session by a newer one from Firestore if there is one.
let LIBRARY = libraryMap(STEPS);
let libraryInfo = { version: STEPS.version, updated_at: STEPS.updated_at, from: 'bundled' };
async function refreshLibrary() {
  const { library: cached } = await chrome.storage.session.get('library');
  if (cached?.entries) { LIBRARY = libraryMap(cached); libraryInfo = { version: cached.version, updated_at: cached.updated_at, from: 'firestore' }; return; }
  const r = await offscreen('sk:library', { version: STEPS.version }).catch(() => null);
  if (r?.library) {
    LIBRARY = libraryMap(r.library);
    libraryInfo = { version: r.library.version, updated_at: r.library.updated_at, from: 'firestore' };
    await chrome.storage.session.set({ library: r.library });
  } else if (r?.same) libraryInfo = { ...libraryInfo, from: 'bundled, same as Firestore' };
}

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------------------------------------------
// Quick exit: the button, Escape twice within one second, and the keyboard shortcut (handled by the service worker).
// No animation: the panel goes blank at once, then the service worker clears and closes everything.

let exiting = false;
let scanAbort = null;
async function quickExit() {
  if (exiting) return;
  exiting = true;
  scanAbort?.abort();
  document.body.replaceChildren();
  document.documentElement.style.background = '#fff';
  try {
    const win = await chrome.windows.getCurrent();
    chrome.runtime.sendMessage({ type: 'sk:quick-exit', windowId: win.id });
  } catch {
    chrome.runtime.sendMessage({ type: 'sk:quick-exit' }).catch(() => {});
  }
  // If Chrome cannot close the panel from the service worker, close it from here.
  setTimeout(() => window.close(), 400);
}
$('quick-exit').addEventListener('click', quickExit);

let lastEscape = 0;
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const now = performance.now();
  if (now - lastEscape < 1000) { quickExit(); return; }
  lastEscape = now;
  if (isInfoOpen()) closeInfo();
  else closeLockSheet();
});

// ---------------------------------------------------------------------------------------------------------------
// Screens and tabs. "Your check" shows whichever of choose, scanning or results is current.

const screens = ['safety', 'choose', 'scanning', 'results', 'plan', 'hood'];
let checkScreen = 'choose';
function show(name, { focus = null } = {}) {
  if (['choose', 'scanning', 'results', 'plan'].includes(name)) checkScreen = name;
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  $('tabs').hidden = name === 'safety';
  const onHood = name === 'hood';
  $('tab-check').setAttribute('aria-selected', String(!onHood));
  $('tab-hood').setAttribute('aria-selected', String(onHood));
  $('tab-check').tabIndex = onHood ? -1 : 0;
  $('tab-hood').tabIndex = onHood ? 0 : -1;
  $('tab-check').setAttribute('aria-controls', `screen-${checkScreen}`);
  closeInfo({ returnFocus: false });
  scrollTo(0, 0);
  if (onHood) refreshHood();
  if (focus) $(focus)?.focus({ preventScroll: true });
}

let practice = false;
async function leaveSafety(asPractice) {
  practice = asPractice;
  $('practice-note').hidden = !practice;
  $('account-choice').hidden = practice;
  $('start').textContent = practice ? 'Start the practice check' : 'Start the check';
  await chrome.storage.session.set({ safetySeen: true });
  show('choose', { focus: 'choose-title' });
  // Chrome can finish getting Gemini Nano ready after the panel opened: read the status again, and load it if ready.
  const before = nanoStatus;
  if ((await showNano()) === 'available' && before !== 'available') offscreen('sk:nano-warm').catch(() => {});
}
$('continue').addEventListener('click', () => leaveSafety(false));
$('practice').addEventListener('click', () => leaveSafety(true));
$('tab-check').addEventListener('click', () => show(checkScreen));
$('tab-hood').addEventListener('click', () => show('hood'));
$('tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const next = $('tab-hood').getAttribute('aria-selected') === 'true' ? 'tab-check' : 'tab-hood';
  $(next).click();
  $(next).focus();
});

// ---------------------------------------------------------------------------------------------------------------
// Choose what to check.

const EXTRAS = [
  { id: 'chrome.extensions', label: 'Extensions in this browser that can read every page', info: 'check-chrome.extensions', permissions: ['management'] },
  { id: 'chrome.sync', label: 'The account this browser syncs to', info: 'check-chrome.sync', permissions: ['identity', 'identity.email'] },
  { id: 'history-cleanup', label: 'Remove the pages Spare Key opened from history', info: 'history-cleanup', permissions: ['history'] },
];

async function renderChecks() {
  const { ticked = null, extras = {} } = await chrome.storage.local.get(['ticked', 'extras']);
  const checks = catalogue().filter(c => c.enabled && c.service !== 'chrome');
  const wrap = $('checks');
  wrap.replaceChildren();
  for (const service of SERVICES.filter(s => s.id !== 'chrome')) {
    const mine = checks.filter(c => c.service === service.id);
    if (!mine.length) continue;
    const head = h('h2', { id: `svc-${service.id}`, text: service.label });
    const rows = h('div', { class: 'rows', role: 'group', 'aria-labelledby': head.id },
      mine.map(c => checkRow({ id: c.id, label: c.label, info: `check-${c.id}`, checked: ticked ? ticked.includes(c.id) : true, name: 'check' })));
    wrap.append(h('div', { class: 'group' }, head, rows));
  }
  $('extras').replaceChildren(...EXTRAS.map(x => checkRow({ id: x.id, label: x.label, info: x.info, checked: !!extras[x.id], name: 'extra' })));
  for (const b of document.querySelectorAll('#checks button.info, #extras button.info')) prepare(b);
}

function checkRow({ id, label, info, checked, name }) {
  const box = h('input', { type: 'checkbox', name, value: id });
  box.checked = checked;
  const i = h('button', { type: 'button', class: 'info', 'data-info': info, 'aria-label': `About ${label.charAt(0).toLowerCase()}${label.slice(1)}` });
  i.innerHTML = '<svg aria-hidden="true"><use href="#i-info"/></svg>';
  return h('div', { class: 'row' }, h('label', {}, box, h('span', { text: label })), i);
}

const tickedChecks = () => [...document.querySelectorAll('input[name="check"]:checked')].map(b => b.value);
const tickedExtras = () => [...document.querySelectorAll('input[name="extra"]:checked')].map(b => b.value);

$('checks').addEventListener('change', () => chrome.storage.local.set({ ticked: tickedChecks() }));

// An extra that needs a Chrome permission asks for it inside the click that turns it on.
$('extras').addEventListener('change', async e => {
  const box = e.target.closest('input[name="extra"]');
  if (!box) return;
  const extra = EXTRAS.find(x => x.id === box.value);
  if (box.checked) {
    const granted = await chrome.permissions.request({ permissions: extra.permissions }).catch(() => false);
    if (!granted) {
      box.checked = false;
      announce('Chrome did not give that permission, so this extra stays off.');
    }
  }
  const { extras = {} } = await chrome.storage.local.get('extras');
  extras[extra.id] = box.checked;
  await chrome.storage.local.set({ extras });
});

// Gemini Nano status, in the words of EXPERIENCE.md section 7.
let nanoStatus = 'absent';
async function showNano() {
  let status = 'absent';
  try {
    if ('LanguageModel' in self) status = await self.LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
  } catch { status = 'unavailable'; }
  // Gemini Nano runs in the hidden offscreen page. After a long run there, the panel's own check can stop saying
  // "available" (seen November 23, 2026, after a 7-minute practice check), so ask the page that runs it.
  if (status !== 'available' && 'LanguageModel' in self) {
    const s = await offscreen('sk:nano-status').catch(() => null);
    if (s?.status === 'available') status = 'available';
  }
  nanoStatus = status;
  const line = {
    available: 'Gemini Nano is ready on this computer.',
    downloading: 'Gemini Nano is getting ready on this computer (it needs about 22 GB of free disk). You can check now with code only, or wait.',
    downloadable: 'Gemini Nano is not on this computer yet. Spare Key will read pages with code only, and will say where that is less complete.',
  }[status] || "This computer can't run Gemini Nano. Spare Key will read pages with code only, and will say where that is less complete.";
  $('nano-line').textContent = line;
  $('nano-dot').classList.toggle('on', status === 'available');
  return status;
}

// Plan help from the cloud: a setting kept on this computer.
async function showCloud() {
  const { cloudOn = true } = await chrome.storage.local.get('cloudOn');
  $('cloud-switch').setAttribute('aria-checked', String(cloudOn));
  $('cloud-dot').classList.toggle('on', cloudOn);
  $('cloud-line').textContent = cloudOn
    ? 'Plan help from Gemini in the cloud: on. It sees finding types only, never names.'
    : 'Plan help from Gemini in the cloud: off. Your plan is made on this computer.';
}
$('cloud-switch').addEventListener('click', async () => {
  const on = $('cloud-switch').getAttribute('aria-checked') !== 'true';
  await chrome.storage.local.set({ cloudOn: on });
  await showCloud();
});

// ---------------------------------------------------------------------------------------------------------------
// The scan.

async function offscreen(type, options) {
  await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
  return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
}

// Start: Chrome is asked for exactly the ticked sites, inside this click (nothing may be awaited before the request).
$('start').addEventListener('click', () => {
  const ids = tickedChecks();
  const extras = tickedExtras().filter(id => id.startsWith('chrome.'));
  const all = catalogue();
  const chosen = all.filter(c => ids.includes(c.id) || extras.includes(c.id));
  const services = new Set(chosen.map(c => c.service));
  const origins = SERVICES.filter(s => services.has(s.id)).flatMap(s => s.origins);
  const status = $('start-status');
  status.hidden = false;
  if (!chosen.length) { status.textContent = 'Tick at least one thing to check.'; return; }
  const ask = practice || !origins.length ? Promise.resolve(true) : chrome.permissions.request({ origins }).catch(() => false);
  ask.then(granted => {
    if (!granted) { status.textContent = 'Chrome did not give access, so nothing was opened. You can try again.'; return; }
    status.hidden = true;
    startScan(chosen);
  });
});

// "Check just these again": runs only the checks that were skipped and puts their results in place of the old ones.
function recheck(ids) {
  const chosen = catalogue().filter(c => ids.includes(c.id));
  const services = new Set(chosen.map(c => c.service));
  const origins = SERVICES.filter(s => services.has(s.id)).flatMap(s => s.origins);
  // Asked inside the click, before anything is awaited, as Chrome requires.
  const ask = practice || !origins.length ? Promise.resolve(true) : chrome.permissions.request({ origins }).catch(() => false);
  ask.then(async granted => {
    if (!granted || !chosen.length) return;
    const { scan: prev } = await chrome.storage.session.get('scan');
    startScan(chosen, prev);
  });
}

function mergeScan(prev, next, ids) {
  const keep = x => !ids.includes(x.check ?? x.id);
  const outcomes = prev.outcomes.map(o => next.outcomes.find(n => n.id === o.id) || o);
  return { ...next, findings: [...prev.findings.filter(keep), ...next.findings], outcomes,
    account: prev.account || next.account, visited: [...prev.visited, ...next.visited], pages: [...(prev.pages || []).filter(keep), ...next.pages] };
}

async function startScan(checks, prev = null) {
  const nano = nanoStatus === 'available' && (await offscreen('sk:nano-status').catch(() => ({})))?.status === 'available';
  const win = await chrome.windows.getCurrent();
  const { extras = {} } = await chrome.storage.local.get('extras');
  scanAbort = new AbortController();
  $('scan-title').textContent = practice ? 'Checking Jordan’s practice pages' : 'Checking your accounts';
  $('scan-done').replaceChildren();
  setProgress(0, checks.length, 'Opening the first page');
  show('scanning', { focus: 'scan-title' });
  const label = id => checks.find(c => c.id === id)?.label || id;
  let scan;
  try {
    scan = await runScan({
      checks, mode: practice ? 'practice' : 'real', u: practice ? 0 : Math.max(0, Math.min(3, Number($('account-u').value) || 0)), windowId: win.id, nano, offscreen, signal: scanAbort.signal,
      onVerify: check => showVerify(check),
      refStart: prev ? Math.max(0, ...prev.findings.map(f => Number(String(f.ref).replace(/\D/g, '')) || 0)) : 0,
      onProgress: ({ index, total, check, state, outcome }) => {
        hideVerify();
        if (state === 'done') {
          setProgress(index, total, check.progress);
          $('scan-done').append(h('li', {}, h('span', { text: check.label }), h('span', { class: 'muted', text: outcomeWords(outcome) })));
        } else {
          const words = state === 'nano-reading' ? `${check.progress}. Gemini Nano is reading the page on this computer.` : state === 'classifying' ? `${check.progress}. Gemini Nano is sorting what was found, on this computer.` : check.progress;
          setProgress(index - 1, total, words);
        }
      },
    });
  } catch (e) {
    if (!(e instanceof ScanStopped)) console.error('Spare Key scan:', e);
    scan = scan || { findings: [], outcomes: [], visited: [] };
  }
  if (exiting) return;
  // Checks not reached (Stop, or an error) are listed as not checked.
  const reached = new Set(scan.outcomes.map(o => o.id));
  for (const c of checks) if (!reached.has(c.id)) scan.outcomes.push({ id: c.id, service: c.service, status: 'not_checked', why: 'stopped', findings: 0, entries: 0 });
  let record = { mode: practice ? 'practice' : 'real', at: new Date().toISOString(), findings: scan.findings, outcomes: scan.outcomes, account: scan.account || null, visited: scan.visited || [], pages: scan.pages || [], nano };
  if (prev && prev.mode === record.mode) record = mergeScan(prev, record, checks.map(c => c.id));
  await chrome.storage.session.set({ scan: record });
  if (extras['history-cleanup'] && !practice) await cleanHistory(record.visited);
  scanAbort = null;
  showResults(record);
}

// "Verify it's you": the site wants the person to confirm it is them before it shows this setting. They can do that in
// the scan tab while Spare Key waits (it only watches the tab's address), or skip the check. Returns the Skip signal.
let verifySkip = null;
let verifyTimer = null;
function showVerify(check) {
  hideVerify();
  verifySkip = new AbortController();
  const site = SERVICES.find(s => s.id === check.service)?.label.replace(/ account$/, '') || 'The site';
  $('verify-title').textContent = `${site} wants you to confirm it is you before it shows ${check.label.charAt(0).toLowerCase()}${check.label.slice(1)}.`;
  $('verify-how').textContent = `You can do that in the page beside this panel, the same way you always do. Spare Key does not read that page and never sees your password. When ${site} shows the setting again, Spare Key reads it and goes on.`;
  const until = Date.now() + 5 * 60000;
  const tick = () => { $('verify-time').textContent = `Spare Key waits up to ${Math.max(1, Math.ceil((until - Date.now()) / 60000))} more minutes, then skips it.`; };
  tick();
  verifyTimer = setInterval(tick, 15000);
  $('verify-box').hidden = false;
  $('scan-line').textContent = `Waiting for you to confirm it is you on ${site}`;
  return verifySkip.signal;
}
function hideVerify() {
  clearInterval(verifyTimer);
  verifyTimer = null;
  $('verify-box').hidden = true;
}
$('verify-skip').addEventListener('click', () => { verifySkip?.abort(); hideVerify(); });

function setProgress(done, total, words) {
  $('scan-line').textContent = words;
  $('scan-count').textContent = `${Math.min(done + 1, total)} of ${total}`;
  $('scan-bar').setAttribute('aria-valuenow', String(total ? done / total : 0));
  $('scan-fill').style.transform = `scaleX(${total ? done / total : 0})`;
}

function outcomeWords(o) {
  if (!o) return '';
  if (o.status !== 'checked') return { signed_out: 'Skipped: not signed in', needs_password: 'Skipped: asks for your password', practice: 'Skipped in practice', nothing_to_compare: 'Skipped' }[o.why] || 'Not checked';
  return o.findings ? `${o.findings} found` : 'Nothing listed';
}

$('stop').addEventListener('click', () => {
  scanAbort?.abort();
  $('scan-line').textContent = 'Stopping. Keeping what was found so far.';
});

// Removes exactly the pages the scan tab opened from Chrome's history, when the person turned that extra on.
async function cleanHistory(urls) {
  if (!chrome.history?.deleteUrl) return;
  for (const url of new Set(urls)) await chrome.history.deleteUrl({ url }).catch(() => {});
}

// ---------------------------------------------------------------------------------------------------------------
// Results.

const reveal = new Set();
// switchTo: false re-draws the results in place (after an answer) without taking the person away from another screen.
function showResults(record, { switchTo = true } = {}) {
  renderResults($('results'), { library: LIBRARY,
    scan: record,
    catalogue: [...catalogue(), SHOT_CHECK],
    reveal,
    onAnswer: async (ref, ownership) => {
      const { scan } = await chrome.storage.session.get('scan');
      const f = scan?.findings.find(x => x.ref === ref);
      if (!f) return;
      f.ownership = ownership;
      await chrome.storage.session.set({ scan });
      showResults(scan, { switchTo: false });
      document.querySelector(`[data-ref="${ref}"] [data-answer="${ownership || 'mine'}"]`)?.focus({ preventScroll: true });
    },
    onOpen: url => chrome.tabs.create({ url }),
    onRecheck: ids => recheck(ids),
    reportState: reportStates[record.at] || '',
    onReport: async broken => {
      const manifest = chrome.runtime.getManifest();
      const day = new Date().toISOString().slice(0, 10);
      const reason = o => (o.why === 'did_not_load' ? 'timeout' : 'unexpected_layout');
      const results = [];
      for (const o of broken) {
        const r = await offscreen('sk:layout-report', { body: { check: o.id, reader_version: readerVersion(), reason: reason(o), ext_version: manifest.version, day } }).catch(e => ({ error: String(e) }));
        results.push(!r?.error);
      }
      reportStates[record.at] = results.every(Boolean) ? 'sent' : 'failed';
      showResults(record, { switchTo: false });
    },
    onToggleReveal: async ref => {
      if (reveal.has(ref)) reveal.delete(ref); else reveal.add(ref);
      const { scan } = await chrome.storage.session.get('scan');
      if (scan) showResults(scan, { switchTo: false });
      document.querySelector(`[data-ref="${ref}"] .finding-actions button:last-child`)?.focus({ preventScroll: true });
    },
  });
  renderSince(record);
  if (switchTo && (checkScreen !== 'results' || $('screen-results').hidden)) show('results', { focus: 'results-title' });
}

// "Since your last check": this check compared with the one in a locked copy the person opened, on this computer only.
async function renderSince(record) {
  const el = $('since');
  const { baseline } = await chrome.storage.session.get('baseline');
  if (!baseline?.scan || !record || baseline.scan.at === record.at || baseline.scan.mode !== record.mode) { el.replaceChildren(); el.hidden = true; return; }
  const r = compareChecks(baseline.scan, record);
  const byRef = new Map(record.findings.map(f => [f.ref, f]));
  const when = new Date(baseline.savedAt || baseline.scan.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  registerInfo('since', {
    title: 'Since your last check',
    what: 'Spare Key compared this check with the one in your locked copy. Something new can mean someone was given access again, or got back in after you changed something.',
    why: 'Only the places checked both times are compared. The locked copy stays on this computer, and nothing about the comparison is sent anywhere.',
  });
  put(el,
    h('div', { class: 'with-info' }, h('h2', { text: `Since your check on ${when}` }), infoButton('since', 'About this comparison')),
    r.added.length
      ? h('div', { class: 'caution-line since-new' },
        h('p', { text: `${r.added.length} new since then. Someone may have been given access again, or got back in.` }),
        h('ul', { class: 'step-list' }, r.added.map(ref => h('li', { text: byRef.get(ref)?.label || '' }))))
      : h('p', { text: 'Nothing new since then, on the pages checked both times.' }),
    h('p', { class: 'muted', text: [r.removed.length ? `${r.removed.length} gone since then.` : '', `${r.same} still there.`].filter(Boolean).join(' ') }));
  el.hidden = false;
}

$('check-again').addEventListener('click', () => show('choose', { focus: 'choose-title' }));
async function clearAll() {
  reveal.clear();
  await chrome.storage.session.remove(['scan', 'sentLog', 'situation', 'plan']);
  announce('Everything from this check was cleared from this computer.');
  show('choose', { focus: 'choose-title' });
}
$('clear-all').addEventListener('click', clearAll);
$('clear-all-2').addEventListener('click', clearAll);

// ---------------------------------------------------------------------------------------------------------------
// The plan: built by code at once, then, when plan help is on, ordered by the cloud from codes only. Either way it
// passes the safety rules before it is shown.

// Not checked, and checked only in part: both become "check it yourself" steps in the plan.
const notCheckedIds = scan => [...scan.outcomes.filter(o => o.status !== 'checked' || o.partly).map(o => o.id).filter(id => id !== 'screenshot'), 'other_services'];

async function showQuestions() {
  const { situation = { values: {}, share: false } } = await chrome.storage.session.get('situation');
  const { cloudOn = true } = await chrome.storage.local.get('cloudOn');
  const draw = (values, share) => renderQuestions($('plan-questions'), {
    values, share, cloudOn,
    onChange: async (v, s) => { await chrome.storage.session.set({ situation: { values: v, share: s } }); draw(v, s); },
    onMake: () => makePlan(),
  });
  draw(situation.values, situation.share);
  $('plan').replaceChildren();
  $('plan-actions').hidden = true;
  $('plan-questions').hidden = false;
}

$('to-plan').addEventListener('click', async () => {
  await showQuestions();
  show('plan');
  $('plan-questions').querySelector('h2')?.focus?.();
});
$('back-results').addEventListener('click', async () => {
  const { scan } = await chrome.storage.session.get('scan');
  if (scan) showResults(scan);
});
$('print-plan').addEventListener('click', () => print());

async function makePlan() {
  const { scan } = await chrome.storage.session.get('scan');
  if (!scan) return;
  const { situation = { values: {}, share: false } } = await chrome.storage.session.get('situation');
  const { cloudOn = true } = await chrome.storage.local.get('cloudOn');
  const values = { ...SITUATION_DEFAULTS, ...situation.values };
  const findings = scan.findings;
  const byRef = new Map(findings.map(f => [f.ref, f]));
  const ctx = { findings: findings.map(f => ({ ref: f.ref, code: f.code, ownership: f.ownership })), situation: values, notChecked: notCheckedIds(scan), library: LIBRARY };

  // 1. The plan built by code, shown at once.
  const codeResult = applyInvariants(buildPlan(ctx), ctx);
  $('plan-questions').hidden = true;
  $('plan-actions').hidden = false;
  const freshDays = (await offscreen('sk:fresh-days').catch(() => ({})))?.freshDays ?? 45;
  const draw = (result, source, extra = {}) => {
    lastDraw = { result, source, extra, byRef, freshDays, scan };
    return renderPlan($('plan'), { plan: result.plan, fired: result.fired, byRef, library: LIBRARY, source, freshDays, freshness, onCheckFresh, ...planHelpers(scan), onOpen: url => chrome.tabs.create({ url }), ...extra });
  };
  draw(codeResult, 'code', { cloudNote: cloudOn ? 'Asking Gemini in the cloud to order this for your situation. It sees finding types only.' : '' });
  $('plan-title')?.focus({ preventScroll: true });
  await chrome.storage.session.set({ plan: { source: 'code', result: codeResult } });
  if (!findings.some(f => f.ownership !== 'mine')) { draw(codeResult, 'code'); return; }

  // 2a. Plan help from the cloud is off: Gemini Nano orders the plan on this computer when it is ready, from the same
  // codes plus every situation answer (nothing leaves, so nothing needs the person's permission to share). When plan
  // help is on, the cloud orders it instead. Measured on the 40 frozen situations (November 22, 2026): before the safety
  // rules, Nano's plans needed 103 fixes on 35, the cloud's 43 on 30 (18 after the two voices), and the code plan none;
  // 5 of Nano's 40 ran past the time limit. After the rules, every plan passes every measure.
  const nanoStatus = cloudOn ? null : (await offscreen('sk:nano-status').catch(() => ({})))?.status;
  if (nanoStatus === 'available') {
    const all = Object.fromEntries(Object.keys(SITUATION).map(k => [k, true]));
    const local = toCloud(findings, { situation: situation.values, shared: all, notChecked: notCheckedIds(scan) });
    draw(codeResult, 'code', { cloudNote: 'Asking Gemini Nano on this computer to order this. Nothing is sent anywhere.' });
    const d = await offscreen('sk:device-plan', { body: local.body, library: LIBRARY }).catch(e => ({ error: String(e) }));
    if (d?.answer) {
      const deviceActions = (d.answer.actions || []).map(a => ({ action: a.action, refs: (Array.isArray(a.refs) ? a.refs : []).map(ref => local.refs[ref]).filter(Boolean), why: a.why }));
      const deviceResult = applyInvariants({ actions: deviceActions, summary: d.answer.summary }, ctx);
      draw(deviceResult, 'device', { model: d.model });
      await chrome.storage.session.set({ plan: { source: 'device', model: d.model, result: deviceResult } });
      return;
    }
  }
  if (!cloudOn) { draw(codeResult, 'code'); return; }

  // 2. The cloud plan, from codes and the answers the person chose to share.
  const shared = situation.share ? Object.fromEntries(Object.keys(SITUATION).map(k => [k, !!situation.values[k]])) : {};
  const { body, refs } = toCloud(findings, { situation: situation.values, shared, notChecked: notCheckedIds(scan) });
  const vocabulary = JSON.stringify([STEPS, Object.keys(CODES), SITUATION, OWNERSHIP, RECENCY, HOW_FOUND, CODE_TEXT]);
  const privateStrings = privateStringsFrom({ findings, account: scan.account, vocabulary });
  pendingAsk = { scan, refs };
  // The per-scan cloud budget starts once per scan, not on every press of "Make my plan".
  const newScan = budgetScanAt !== scan.at;
  budgetScanAt = scan.at;
  const asked = pendingAsk;
  const r = await offscreen('sk:cloud-plan', { body, privateStrings, library: LIBRARY, newScan }).catch(e => ({ error: String(e) }));
  // How many of this computer's answers Gemini Nano gave (the code rules could not tell): shown with the plan.
  if (r?.calls && asked?.nanoAnswered) r.calls.nano_answered = asked.nanoAnswered;
  pendingAsk = null;
  hideAsk();
  if (r?.error || !r?.answer) {
    const busy = /429|RESOURCE_EXHAUSTED|quota|503|UNAVAILABLE|overloaded|timed? ?out|abort/i.test(r?.error || '');
    draw(codeResult, 'code', { cloudNote: busy
      ? 'Your plan was made on this computer from Spare Key\'s steps library. The cloud was busy. You can try again in a minute.'
      : 'Your plan was made on this computer from Spare Key\'s steps library.' });
    return;
  }
  // Map the cloud's refs back to this computer's findings, then apply the safety rules.
  const actions = (r.answer.actions || []).map(a => ({
    action: a.action,
    refs: (Array.isArray(a.refs) ? a.refs : a.ref ? [a.ref] : []).map(ref => refs[ref]).filter(Boolean),
    why: a.why,
  }));
  const cloudResult = applyInvariants({ actions, summary: r.answer.summary }, ctx);
  draw(cloudResult, 'cloud', { model: r.model, calls: r.calls, cloudNote: 'Checking the order with two voices: one for closing doors soon, one for staying hidden.' });
  await chrome.storage.session.set({ plan: { source: 'cloud', model: r.model, calls: r.calls, result: cloudResult } });

  // 3. The two-voice check, then the safety rules again on the settled plan.
  const v = await offscreen('sk:two-voices', { body, draft: r.answer, privateStrings, library: LIBRARY }).catch(e => ({ error: String(e) }));
  if (!v || v.off || v.error || !v.answer) {
    draw(cloudResult, 'cloud', { model: r.model, calls: r.calls });
    return;
  }
  const settledActions = (v.answer.actions || []).map(a => ({
    action: a.action,
    refs: (Array.isArray(a.refs) ? a.refs : []).map(ref => refs[ref]).filter(Boolean),
    why: a.why,
  }));
  const settled = applyInvariants({ actions: settledActions, summary: v.answer.summary }, ctx);
  const voices = {
    close_the_doors: cleanText(v.lines?.close_the_doors || '').text,
    stay_hidden: cleanText(v.lines?.stay_hidden || '').text,
    arguments: { close_the_doors: cleanText(v.arguments?.close_the_doors || '').text, stay_hidden: cleanText(v.arguments?.stay_hidden || '').text },
    table: Array.isArray(v.table) ? v.table : [],
  };
  draw(settled, 'cloud', { model: v.model, calls: r.calls, voices });
  await chrome.storage.session.set({ plan: { source: 'cloud', model: v.model, calls: r.calls, result: settled, voices, draftFired: cloudResult.fired } });
}

// Steps freshness: the help page's host is asked for inside the click, then the cloud compares the library's steps with it.
let lastDraw = null;

// A saved plan drawn again (the panel reopened, or a locked copy opened), with everything a new plan has: the check
// names and "Open it" links, "Say it more simply", and the steps freshness check.
async function restorePlan(scan, plan) {
  const byRef = new Map(scan.findings.map(f => [f.ref, f]));
  const freshDays = (await offscreen('sk:fresh-days').catch(() => ({})))?.freshDays ?? 45;
  const extra = { model: plan.model, calls: plan.calls, voices: plan.voices };
  lastDraw = { result: plan.result, source: plan.source, extra, byRef, freshDays, scan };
  redrawPlan();
}
const freshness = {};
function redrawPlan(openCode = null) {
  if (!lastDraw) return;
  // Keep the block the person is reading open after the redraw.
  if (openCode) queueMicrotask(() => { const b = document.querySelector(`#plan [data-code="${openCode}"]`); if (b?.tagName === 'DETAILS') b.open = true; b?.querySelector('details.later')?.setAttribute('open', ''); });
  const { result, source, extra, byRef, freshDays } = lastDraw;
  renderPlan($('plan'), { plan: result.plan, fired: result.fired, byRef, library: LIBRARY, source, freshDays, freshness, onCheckFresh, ...planHelpers(lastDraw.scan), onOpen: url => chrome.tabs.create({ url }), ...extra });
}

// "Say it more simply" and the "check it yourself" links, for every drawing of the plan.
const simpler = {};
function planHelpers(scan) {
  const cat = catalogue();
  return {
    simpler,
    onSimpler,
    checkLabels: Object.fromEntries(cat.map(c => [c.id, c.label])),
    onOpenCheck: id => {
      const c = cat.find(x => x.id === id);
      const page = c?.pages?.[0];
      if (!page) return;
      chrome.tabs.create({ url: scan?.mode === 'practice' ? new URL(page.practiceUrl, PRACTICE_ORIGIN).href : pageUrl(page.url, 0) });
    },
  };
}
async function onSimpler(code) {
  simpler[code] = { pending: true };
  redrawPlan(code);
  // The person's own "plan help from the cloud" switch holds here too: off means Gemini Nano on this computer or nothing.
  const { cloudOn = true } = await chrome.storage.local.get('cloudOn');
  const r = await offscreen('sk:simpler', { code, library: LIBRARY, personCloudOn: cloudOn }).catch(e => ({ error: String(e) }));
  simpler[code] = r?.steps ? { steps: r.steps, source: r.source } : r?.off ? { off: true } : { error: true };
  redrawPlan(code);
}
let budgetScanAt = null;
function onCheckFresh(code) {
  const url = LIBRARY[code]?.sources?.[0]?.url;
  if (!url) return;
  // The person's own "plan help from the cloud: off" switch stops this too.
  chrome.storage.local.get('cloudOn').then(({ cloudOn = true }) => {
    if (!cloudOn) { freshness[code] = { still_matches: 'not_sure', cloudOff: true }; redrawPlan(); }
  });
  const origin = `${new URL(url).origin}/*`;
  chrome.permissions.request({ origins: [origin] }).catch(() => false).then(async () => {
    const { cloudOn = true } = await chrome.storage.local.get('cloudOn');
    if (!cloudOn) return;
    freshness[code] = { pending: true };
    redrawPlan();
    const { scan } = await chrome.storage.session.get('scan');
    const vocabulary = JSON.stringify([STEPS, Object.keys(CODES), SITUATION, OWNERSHIP, RECENCY, HOW_FOUND, CODE_TEXT]);
    const privateStrings = scan ? privateStringsFrom({ findings: scan.findings, account: scan.account, vocabulary }) : [];
    const r = await offscreen('sk:freshness', { code, library: LIBRARY, privateStrings }).catch(e => ({ error: String(e) }));
    freshness[code] = r && !r.error && !r.off ? r : { still_matches: 'not_sure' };
    redrawPlan();
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The locked copy: saved and opened on this computer only. The file name does not mention Spare Key.

let lockMode = 'save';
let lockReturn = null;
function openLockSheet(mode, from) {
  lockMode = mode;
  lockReturn = from;
  const save = mode === 'save';
  $('lock-title').textContent = save ? 'Save a locked copy' : 'Open a locked copy';
  $('lock-intro').textContent = save
    ? 'This saves what Spare Key found and your plan in a file that only this password opens. The file name does not mention Spare Key.'
    : 'Choose the locked file, then type its password. It opens here, on this computer.';
  $('lock-file-field').hidden = save;
  $('lock-confirm-field').hidden = !save;
  $('lock-confirm').required = save;
  $('lock-submit').textContent = save ? 'Save the locked copy' : 'Open it';
  $('lock-password').autocomplete = save ? 'new-password' : 'current-password';
  $('lock-form').reset();
  $('lock-error').hidden = true;
  const sheet = $('lock-sheet');
  sheet.hidden = false;
  $('scrim').hidden = false;
  sheet.dataset.state = 'closed';
  void sheet.offsetHeight;
  sheet.dataset.state = 'open';
  (save ? $('lock-password') : $('lock-file')).focus();
}
function closeLockSheet() {
  const sheet = $('lock-sheet');
  if (sheet.hidden) return;
  sheet.dataset.state = 'closed';
  $('scrim').hidden = true;
  $('lock-form').reset();
  setTimeout(() => { sheet.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170);
  lockReturn?.focus({ preventScroll: true });
}
function lockError(text) { $('lock-error').textContent = text; $('lock-error').hidden = false; }
$('save-locked').addEventListener('click', e => openLockSheet('save', e.currentTarget));
$('open-locked').addEventListener('click', e => openLockSheet('open', e.currentTarget));
$('lock-close').addEventListener('click', closeLockSheet);
$('scrim').addEventListener('click', closeLockSheet);
$('lock-form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('lock-password').value;
  if (password.length < 8) return lockError('Use a password of at least 8 characters.');
  $('lock-submit').disabled = true;
  try {
    if (lockMode === 'save') {
      if (password !== $('lock-confirm').value) return lockError('The two passwords are not the same.');
      const { scan, plan } = await chrome.storage.session.get(['scan', 'plan']);
      if (!scan) return lockError('There is nothing to save yet.');
      const text = await lock({ scan, plan: plan || null, savedAt: new Date().toISOString() }, password);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
      const a = h('a', { href: url, download: `notes-${new Date().toISOString().slice(0, 10)}.locked` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      closeLockSheet();
      announce('The locked copy was saved to your downloads.');
    } else {
      const file = $('lock-file').files[0];
      if (!file) return lockError('Choose the locked file first.');
      const value = await unlock(await file.text(), password);
      if (!value?.scan?.findings) return lockError('This file does not hold a Spare Key check.');
      // Kept as the baseline: this check, and any check run after it, shows what changed since then.
      await chrome.storage.session.set({ baseline: { scan: value.scan, savedAt: value.savedAt || value.scan.at } });
      const { scan: current } = await chrome.storage.session.get('scan');
      if (current && current.at !== value.scan.at && current.mode === value.scan.mode) {
        closeLockSheet();
        showResults(current);
        announce('Your check now is compared with the locked copy.');
        return;
      }
      await chrome.storage.session.set({ scan: value.scan, plan: value.plan || null, safetySeen: true });
      closeLockSheet();
      practice = value.scan.mode === 'practice';
      if (value.plan) {
        $('plan-questions').hidden = true;
        $('plan-actions').hidden = false;
        await restorePlan(value.scan, value.plan);
      }
      showResults(value.scan);
      announce('The locked copy is open.');
    }
  } catch (err) {
    lockError(err?.name === 'WrongPassword' ? err.message : String(err?.message || 'That did not work.'));
  } finally {
    $('lock-submit').disabled = false;
  }
});

// Questions from the cloud, answered here: yes, no or unknown from the findings (ask_device), or by the person (ask_user).
let pendingAsk = null;
const USER_QUESTION_WORDS = {
  recognise_this: 'Do you recognise this?',
  set_up_by_you: 'Did you set this up yourself?',
  still_need_this: 'Do you still need this?',
  they_know_you_use_this: 'Does the other person know you use this?',
};

function answerDevice(f, question, scan) {
  if (!f) return 'unknown';
  const t = `${f.detail || ''}`.toLowerCase();
  switch (question) {
    case 'filter_also_deletes': return f.check !== 'gmail.filters' ? 'unknown' : /\bdelete it\b/.test(t) ? 'yes' : 'no';
    case 'forwarding_is_only_copy': return f.check !== 'gmail.forwarding' ? 'unknown' : /(delete|archive) gmail.s copy/.test(t) ? 'yes' : /keep gmail.s copy/.test(t) ? 'no' : 'unknown';
    case 'device_active_this_week': return ['now', 'today', 'this_week'].includes(f.recency) ? 'yes' : f.recency === 'unknown' ? 'unknown' : 'no';
    case 'app_can_read_mail': return f.check !== 'google.apps' ? 'unknown' : f.access?.includes('mail') ? 'yes' : 'no';
    case 'app_can_see_location': return f.check !== 'google.apps' ? 'unknown' : f.access?.includes('location') ? 'yes' : 'no';
    case 'more_items_hidden': return scan.outcomes.find(o => o.id === f.check)?.partly ? 'yes' : 'no';
    case 'shared_with_link': return f.check !== 'maps.sharing' ? 'unknown' : f.code === 'maps.sharing.link' ? 'yes' : 'no';
    default: return 'unknown';
  }
}

function askPerson(f, question) {
  return new Promise(resolve => {
    const box = $('ask-user');
    const done = answer => { clearTimeout(timer); hideAsk(); resolve(answer); };
    const timer = setTimeout(() => done('skipped'), 180000);
    const title = f ? (CODE_TEXT[f.code] || [f.code])[0] : '';
    box.replaceChildren(
      h('p', { text: USER_QUESTION_WORDS[question] || 'Can you tell Spare Key more about this?' }),
      f ? h('p', { class: 'muted' }, h('span', { text: `${title}: ${f.label}` })) : null,
      h('div', { class: 'answer', role: 'group', 'aria-label': USER_QUESTION_WORDS[question] },
        [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure'], ['skipped', 'Skip']].map(([v, w]) => h('button', { type: 'button', onclick: () => done(v) }, w))),
      h('p', { class: 'muted', text: 'Only your answer (yes, no or not sure) is sent, never what this is.' }));
    box.hidden = false;
    box.querySelector('button')?.focus({ preventScroll: false });
  });
}
function hideAsk() { $('ask-user').hidden = true; $('ask-user').replaceChildren(); }

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== 'sk:ask' || sender.id !== chrome.runtime.id || !pendingAsk) return false;
  const f = pendingAsk.scan.findings.find(x => x.ref === pendingAsk.refs[msg.ref]);
  if (msg.kind === 'device') {
    const byCode = answerDevice(f, msg.question, pendingAsk.scan);
    // The cloud reasons; when the code rules cannot tell, Gemini Nano reads the entry here. One word goes back.
    if (byCode !== 'unknown' || !f || nanoStatus !== 'available') { reply({ answer: byCode }); return false; }
    offscreen('sk:nano-ask', { question: msg.question, text: f.detail || f.label || '' })
      .then(r => {
        const answer = ['yes', 'no', 'unknown'].includes(r?.answer) ? r.answer : 'unknown';
        if (answer !== 'unknown') pendingAsk.nanoAnswered = (pendingAsk.nanoAnswered || 0) + 1;
        reply({ answer });
      })
      .catch(() => reply({ answer: 'unknown' }));
    return true;
  }
  askPerson(f, msg.question).then(answer => reply({ answer }));
  return true;
});

// ---------------------------------------------------------------------------------------------------------------
// Under the hood.

async function refreshHood() {
  const nano = await showNano();
  $('where-read-sub').textContent = nano === 'available' ? 'Ready. What it reads stays here.' : 'Not on this computer. Pages are read by code only.';
  renderSentLog();
  try {
    const s = await offscreen('sk:settings');
    // The person's own switch first, then the one for every copy (Remote Config).
    const { cloudOn: personOn = true } = await chrome.storage.local.get('cloudOn');
    const on = s.cloudOn && personOn;
    $('where-plan').textContent = on ? 'Gemini in the cloud' : 'This computer only';
    const sub = $('where-plan-sub');
    if (!personOn) sub.textContent = 'You switched plan help from the cloud off. Your plan is made on this computer.';
    else if (on) {
      // Each model name on one line: they break badly at their hyphens.
      sub.replaceChildren('Finding types only. Models: ', ...s.models.flatMap((m, i) => [
        ...(i ? [', '] : []), Object.assign(document.createElement('span'), { textContent: m, style: 'white-space:nowrap' }),
      ]));
    } else sub.textContent = 'The cloud is switched off for every copy of Spare Key.';
    $('where-rc-sub').textContent = { remote: 'Fetched from Firebase Remote Config.', cached: 'From the last fetch of Firebase Remote Config.', defaults: 'Built-in defaults. Remote Config was not reached.' }[s.from] || '';
    const updated = libraryInfo.updated_at ? new Date(`${libraryInfo.updated_at}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    $('where-lib-sub').textContent = libraryInfo.from === 'firestore'
      ? `Version ${libraryInfo.version}, updated ${updated}, from Cloud Firestore.`
      : `Version ${libraryInfo.version}, updated ${updated}. ${libraryInfo.from === 'bundled' ? 'Firestore was not reached; this is the copy inside the extension.' : 'The copy inside the extension matches Firestore.'}`;
  } catch {
    $('where-rc-sub').textContent = 'Built-in defaults. Remote Config was not reached.';
  }
}

$('run-setup').addEventListener('click', async () => {
  const b = $('run-setup');
  const status = $('setup-status');
  b.disabled = true;
  status.hidden = false;
  status.textContent = 'Checking Gemini Nano and the cloud. This sends one fixed test message, shown below.';
  try {
    const r = await offscreen('sk:setup-check', { cloud: true });
    const nano = r.nano?.answer?.status === 'ready' ? `Gemini Nano answered in ${(r.nano.ms / 1000).toFixed(1)} s.`
      : r.nano?.text === 'available' ? 'Gemini Nano is here but did not answer.' : 'Gemini Nano is not on this computer.';
    const cloud = r.cloud?.answer?.status === 'ready' ? `The cloud answered in ${(r.cloud.ms / 1000).toFixed(1)} s with ${r.cloud.model}.`
      : r.cloud?.error === 'Error: cloud_off' ? 'The cloud is switched off.' : 'The cloud did not answer. Your plan would be made on this computer.';
    status.textContent = `${nano} ${cloud}`;
  } catch {
    status.textContent = 'The check could not run. Close and reopen the panel, then try again.';
  } finally {
    b.disabled = false;
    refreshHood();
  }
});

// The logged text exactly as sent, indented for reading. JSON.parse keeps the key order, so nothing is reordered.
const prettyText = e => { try { return JSON.stringify(JSON.parse(e.text ?? JSON.stringify(e.body)), null, 2); } catch { return String(e.text || ''); } };

// The ledger: every request the offscreen page made this session, by destination, counted by wrapping fetch
// (extension/src/ledger.js), and how many of them hold anything from this check.
async function renderLedger() {
  const { scan } = await chrome.storage.session.get('scan');
  const vocabulary = JSON.stringify([STEPS, Object.keys(CODES), SITUATION, OWNERSHIP, RECENCY, HOW_FOUND, CODE_TEXT]);
  const privateStrings = scan ? privateStringsFrom({ findings: scan.findings, account: scan.account, vocabulary }) : [];
  const r = await offscreen('sk:ledger', { privateStrings }).catch(() => null);
  if (!r?.rows?.length) { $('ledger').replaceChildren(); return; }
  const size = n => (n < 1024 ? `${n} bytes` : `${(n / 1024).toFixed(1)} KB`);
  put($('ledger'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'ledger' },
      h('caption', { class: 'visually-hidden', text: 'Requests this session, by where they went' }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Sent to' }), h('th', { scope: 'col', class: 'num', text: 'Requests' }), h('th', { scope: 'col', class: 'num', text: 'Size' }))),
      h('tbody', {}, r.rows.map(x => h('tr', {}, h('td', { text: x.who }), h('td', { class: 'num', text: String(x.requests) }), h('td', { class: 'num', text: size(x.bytes) })))))),
    h('p', { class: 'ledger-line', text: r.holdingPrivate === null
      ? 'After a check, Spare Key also tests these requests against what it found.'
      : `Requests holding a name, email, phone number, device or page word from your check: ${r.holdingPrivate} of ${r.requests}.` }));
}

async function renderSentLog() {
  renderLedger();
  const { sentLog = [] } = await chrome.storage.session.get('sentLog');
  $('sent-log').replaceChildren(...sentLog.slice().reverse().map(e => {
    const when = h('time', { datetime: e.time, text: new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) });
    return h('li', {},
      h('div', { class: 'meta' }, h('span', { text: `${e.kind === 'function_answers' ? 'Answers to the cloud' : 'Request'}: ${e.purpose}, ${e.model}` }), when),
      h('pre', { text: prettyText(e) }),
      e.fixed ? h('details', { class: 'fixed' }, h('summary', { text: 'The fixed instructions sent with it' }),
        h('pre', { text: [e.fixed.instructions, e.fixed.tools?.length ? `Functions offered: ${e.fixed.tools.join(', ')}` : '', e.fixed.format ? `Answer format: ${e.fixed.format}` : ''].filter(Boolean).join('\n\n') })) : null);
  }));
  $('sent-empty').hidden = sentLog.length > 0;
}
chrome.storage.session.onChanged.addListener(changes => { if (changes.sentLog && !$('screen-hood').hidden) renderSentLog(); });

// Theme: System, Light or Dark. The choice is a setting on this computer.
function applyTheme(choice) {
  if (choice === 'light' || choice === 'dark') document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  for (const b of document.querySelectorAll('[data-theme-choice]')) b.setAttribute('aria-pressed', String(b.dataset.themeChoice === (choice || 'system')));
  try { if (choice === 'light' || choice === 'dark') localStorage.setItem('sk-theme', choice); else localStorage.removeItem('sk-theme'); } catch { /* blocked */ }
}
$('theme').addEventListener('click', async e => {
  const b = e.target.closest('[data-theme-choice]');
  if (!b) return;
  applyTheme(b.dataset.themeChoice);
  await chrome.storage.local.set({ theme: b.dataset.themeChoice });
});

function announce(text) { $('announce').textContent = text; }

// The Quick exit shortcut Chrome really assigned. Chrome can leave a suggested shortcut unassigned (for example when
// another extension already uses it), so the panel names only a shortcut that works.
async function showExitShortcut() {
  const commands = await chrome.commands.getAll().catch(() => []);
  const shortcut = commands.find(c => c.name === 'quick-exit')?.shortcut || '';
  const keys = shortcut.split('+').map(k => k.trim()).filter(Boolean);
  $('exit-shortcut').hidden = !keys.length;
  $('exit-shortcut-keys').replaceChildren(...keys.map(k => h('kbd', { text: k })));
}

// Remote Config's catalogue overrides (fixed page readers), fetched by the offscreen page.
async function loadOverrides() {
  try {
    const r = await offscreen('sk:catalogue-overrides');
    setRemoteOverrides(r?.catalogue || {});
  } catch { setRemoteOverrides({}); }
}

// ---------------------------------------------------------------------------------------------------------------
// Start-up.

(async () => {
  initInfo(document);
  const { theme } = await chrome.storage.local.get('theme');
  applyTheme(theme);
  await loadOverrides();
  await refreshLibrary().catch(() => {});
  await Promise.all([renderChecks(), showNano(), showCloud(), showExitShortcut(), setUpPhoneShot()]);
  // Load Gemini Nano in the background while the person reads the first screens.
  if (nanoStatus === 'available') offscreen('sk:nano-warm').catch(() => {});
  // The safety screen shows first in every new browser session. After "I understand", this session goes straight on,
  // to the results if a check already ran.
  const { safetySeen, scan, plan } = await chrome.storage.session.get(['safetySeen', 'scan', 'plan']);
  if (!safetySeen) show('safety');
  else if (scan && plan) {
    practice = scan.mode === 'practice';
    $('plan-questions').hidden = true;
    $('plan-actions').hidden = false;
    await restorePlan(scan, plan);
    show('plan');
  } else if (scan) { practice = scan.mode === 'practice'; showResults(scan); }
  else show('choose');
  // Start-up is done; the end-to-end tests wait for this before they click.
  document.body.dataset.ready = '1';
})();

// Print shows every folded block.
addEventListener('beforeprint', () => { for (const d of document.querySelectorAll('#plan details')) d.open = true; });

// ---------------------------------------------------------------------------------------------------------------
// A location app on the phone, from a screenshot (TECHNICAL-DESIGN.md section 6.3). Gemini Nano reads the picture on
// this computer, with image input and no cloud fallback: a screenshot shows names. The picture is not kept.

async function setUpPhoneShot() {
  const status = (await offscreen('sk:image-status').catch(() => ({})))?.status;
  const ready = status === 'available';
  $('phone-shot-file').disabled = !ready;
  $('phone-shot-label').classList.toggle('is-disabled', !ready);
  if (!ready) $('phone-shot-status').textContent = 'This needs Gemini Nano on this computer, because a screenshot can show names. Without it, this stays off.';
}

// The picture, made at most 1280 pixels on its longest side, as base64 PNG.
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL('image/png').split(',')[1];
  canvas.width = canvas.height = 0;
  return { mimeType: 'image/png', data };
}

$('phone-shot-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const status = $('phone-shot-status');
  status.textContent = 'Reading the screenshot on this computer.';
  try {
    const r = await offscreen('sk:read-screenshot', await shrink(file));
    if (!r || r.error) throw new Error(r?.error || 'no answer');
    const { scan } = await chrome.storage.session.get('scan');
    if (!scan) return;
    const stamp = Date.now().toString(36);
    const found = (r.entries || []).map((entry, k) => toFinding({
      ref: `S${stamp}${k}`, check: SHOT_CHECK, entry: { ...entry, href: '', state: [] },
      cls: { ...codeClassify('screenshot', entry, scan.account), source: 'both' }, howFound: 'nano', openUrl: '', account: scan.account,
    })).filter(Boolean);
    scan.findings.push(...found);
    const o = scan.outcomes.find(x => x.id === 'screenshot');
    if (o) { o.entries += r.entries.length; o.findings += found.length; }
    else scan.outcomes.push({ id: 'screenshot', service: 'phone', status: 'checked', how: 'nano', entries: r.entries.length, findings: found.length, partly: false, why: null });
    await chrome.storage.session.set({ scan });
    showResults(scan, { switchTo: false });
    status.textContent = found.length
      ? `${found.length} added from ${r.app || 'the screenshot'}. Check each one in the list above.`
      : 'Gemini Nano found no one on this screenshot who can see where you are. If that looks wrong, check the app yourself.';
  } catch {
    status.textContent = 'Gemini Nano could not read this screenshot. Try a clearer one, or check the app yourself.';
  }
});
