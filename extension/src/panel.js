// The side panel: the safety screen, choosing what to check, the scan, the results, and Under the hood.
// Quick exit is wired first, so it works even if anything below fails.
import { initInfo, closeInfo, isInfoOpen, prepare } from './ui/info.js';
import { SERVICES, catalogue } from './scan/catalogue.js';
import { setRemoteOverrides } from './scan/overrides.js';
import { runScan, ScanStopped } from './scan/engine.js';
import { renderResults, h } from './ui/results.js';

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
});

// ---------------------------------------------------------------------------------------------------------------
// Screens and tabs. "Your check" shows whichever of choose, scanning or results is current.

const screens = ['safety', 'choose', 'scanning', 'results', 'hood'];
let checkScreen = 'choose';
function show(name, { focus = null } = {}) {
  if (['choose', 'scanning', 'results'].includes(name)) checkScreen = name;
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

async function startScan(checks) {
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
      checks, mode: practice ? 'practice' : 'real', u: 0, windowId: win.id, nano, offscreen, signal: scanAbort.signal,
      onProgress: ({ index, total, check, state, outcome }) => {
        if (state === 'done') {
          setProgress(index, total, check.progress);
          $('scan-done').append(h('li', {}, h('span', { text: check.label }), h('span', { class: 'muted', text: outcomeWords(outcome) })));
        } else {
          const words = state === 'nano-reading' ? `${check.progress}. Gemini Nano is reading the page on this computer.` : state === 'classifying' ? `${check.progress}. Sorting what was found, on this computer.` : check.progress;
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
  const record = { mode: practice ? 'practice' : 'real', at: new Date().toISOString(), findings: scan.findings, outcomes: scan.outcomes, account: scan.account || null, visited: scan.visited || [], nano };
  await chrome.storage.session.set({ scan: record });
  if (extras['history-cleanup'] && !practice) await cleanHistory(record.visited);
  scanAbort = null;
  showResults(record);
}

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
function showResults(record) {
  renderResults($('results'), {
    scan: record,
    catalogue: catalogue(),
    reveal,
    onAnswer: async (ref, ownership) => {
      const { scan } = await chrome.storage.session.get('scan');
      const f = scan?.findings.find(x => x.ref === ref);
      if (!f) return;
      f.ownership = ownership;
      await chrome.storage.session.set({ scan });
      showResults(scan);
      document.querySelector(`[data-ref="${ref}"] [data-answer="${ownership || 'mine'}"]`)?.focus({ preventScroll: true });
    },
    onOpen: url => chrome.tabs.create({ url }),
    onToggleReveal: async ref => {
      if (reveal.has(ref)) reveal.delete(ref); else reveal.add(ref);
      const { scan } = await chrome.storage.session.get('scan');
      if (scan) showResults(scan);
      document.querySelector(`[data-ref="${ref}"] .finding-actions button:last-child`)?.focus({ preventScroll: true });
    },
  });
  if (checkScreen !== 'results' || $('screen-results').hidden) show('results', { focus: 'results-title' });
}

$('check-again').addEventListener('click', () => show('choose', { focus: 'choose-title' }));
$('clear-all').addEventListener('click', async () => {
  reveal.clear();
  await chrome.storage.session.remove(['scan', 'sentLog']);
  announce('Everything from this check was cleared from this computer.');
  show('choose', { focus: 'choose-title' });
});

// ---------------------------------------------------------------------------------------------------------------
// Under the hood.

async function refreshHood() {
  const nano = await showNano();
  $('where-read-sub').textContent = nano === 'available' ? 'Ready. What it reads stays here.' : 'Not on this computer. Pages are read by code only.';
  renderSentLog();
  try {
    const s = await offscreen('sk:settings');
    $('where-plan').textContent = s.cloudOn ? 'Gemini in the cloud' : 'This computer only';
    const sub = $('where-plan-sub');
    if (s.cloudOn) {
      // Each model name on one line: they break badly at their hyphens.
      sub.replaceChildren('Finding types only. Models: ', ...s.models.flatMap((m, i) => [
        ...(i ? [', '] : []), Object.assign(document.createElement('span'), { textContent: m, style: 'white-space:nowrap' }),
      ]));
    } else sub.textContent = 'The cloud is switched off for every copy of Spare Key.';
    $('where-rc-sub').textContent = { remote: 'Fetched from Firebase Remote Config.', cached: 'From the last fetch of Firebase Remote Config.', defaults: 'Built-in defaults. Remote Config was not reached.' }[s.from] || '';
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

async function renderSentLog() {
  const { sentLog = [] } = await chrome.storage.session.get('sentLog');
  $('sent-log').replaceChildren(...sentLog.slice().reverse().map(e => {
    const when = h('time', { datetime: e.time, text: new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) });
    return h('li', {},
      h('div', { class: 'meta' }, h('span', { text: `${e.kind === 'function_answers' ? 'Answers to the cloud' : 'Request'}: ${e.purpose}, ${e.model}` }), when),
      h('pre', { text: JSON.stringify(e.body, null, 2) }));
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
  await Promise.all([renderChecks(), showNano(), showCloud(), showExitShortcut()]);
  // Load Gemini Nano in the background while the person reads the first screens.
  if (nanoStatus === 'available') offscreen('sk:nano-warm').catch(() => {});
  // The safety screen shows first in every new browser session. After "I understand", this session goes straight on,
  // to the results if a check already ran.
  const { safetySeen, scan } = await chrome.storage.session.get(['safetySeen', 'scan']);
  if (!safetySeen) show('safety');
  else if (scan) { practice = scan.mode === 'practice'; showResults(scan); }
  else show('choose');
})();
