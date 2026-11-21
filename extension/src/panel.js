// The side panel: the safety screen, choosing what to check, and Under the hood.
// Quick exit is wired first, so it works even if anything below fails.
import { initInfo, closeInfo, isInfoOpen, prepare } from './ui/info.js';
import { SERVICES, catalogue } from './scan/catalogue.js';

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------------------------------------------
// Quick exit: the button, Escape twice within one second, and Alt+Shift+X (handled by the service worker).
// No animation: the panel goes blank at once, then the service worker clears and closes everything.

let exiting = false;
async function quickExit() {
  if (exiting) return;
  exiting = true;
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
// Screens and tabs.

const screens = ['safety', 'choose', 'hood'];
function show(name) {
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  $('tabs').hidden = name === 'safety';
  $('tab-check').setAttribute('aria-selected', String(name === 'choose'));
  $('tab-hood').setAttribute('aria-selected', String(name === 'hood'));
  $('tab-check').tabIndex = name === 'hood' ? -1 : 0;
  $('tab-hood').tabIndex = name === 'hood' ? 0 : -1;
  closeInfo({ returnFocus: false });
  scrollTo(0, 0);
  if (name === 'hood') refreshHood();
}

let practice = false;
async function leaveSafety(asPractice) {
  practice = asPractice;
  $('practice-note').hidden = !practice;
  await chrome.storage.session.set({ safetySeen: true });
  show('choose');
  $('choose-title').focus?.();
}
$('continue').addEventListener('click', () => leaveSafety(false));
$('practice').addEventListener('click', () => leaveSafety(true));
$('tab-check').addEventListener('click', () => show('choose'));
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
    const group = document.createElement('div');
    group.className = 'group';
    const h = document.createElement('h2');
    h.id = `svc-${service.id}`;
    h.textContent = service.label;
    const rows = document.createElement('div');
    rows.className = 'rows';
    rows.setAttribute('role', 'group');
    rows.setAttribute('aria-labelledby', h.id);
    for (const c of mine) rows.append(checkRow({ id: c.id, label: c.label, info: `check-${c.id}`, checked: ticked ? ticked.includes(c.id) : true, name: 'check' }));
    group.append(h, rows);
    wrap.append(group);
  }
  const ex = $('extras');
  ex.replaceChildren(...EXTRAS.map(x => checkRow({ id: x.id, label: x.label, info: x.info, checked: !!extras[x.id], name: 'extra' })));
  for (const b of document.querySelectorAll('#checks button.info, #extras button.info')) prepare(b);
}

function checkRow({ id, label, info, checked, name }) {
  const row = document.createElement('div');
  row.className = 'row';
  const l = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.name = name;
  box.value = id;
  box.checked = checked;
  const text = document.createElement('span');
  text.textContent = label;
  l.append(box, text);
  const i = document.createElement('button');
  i.type = 'button';
  i.className = 'info';
  i.dataset.info = info;
  i.setAttribute('aria-label', `About ${label.charAt(0).toLowerCase()}${label.slice(1)}`);
  i.innerHTML = '<svg aria-hidden="true"><use href="#i-info"/></svg>';
  row.append(l, i);
  return row;
}

const tickedChecks = () => [...document.querySelectorAll('input[name="check"]:checked')].map(b => b.value);

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
async function showNano() {
  let status = 'absent';
  try {
    if ('LanguageModel' in self) status = await self.LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] });
  } catch { status = 'unavailable'; }
  const line = {
    available: 'Gemini Nano is ready on this computer.',
    downloading: 'Gemini Nano is downloading (about 22 GB of free disk is needed). You can check now with code only, or wait.',
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

// Start the check: Chrome is asked for exactly the ticked sites, inside this click.
$('start').addEventListener('click', async () => {
  const ids = tickedChecks();
  const services = new Set(catalogue().filter(c => ids.includes(c.id)).map(c => c.service));
  const origins = SERVICES.filter(s => services.has(s.id)).flatMap(s => s.origins);
  const status = $('start-status');
  status.hidden = false;
  if (!ids.length) { status.textContent = 'Tick at least one thing to check.'; return; }
  const granted = practice || !origins.length || await chrome.permissions.request({ origins }).catch(() => false);
  if (!granted) {
    status.textContent = 'Chrome did not give access, so nothing was opened. You can try again.';
    return;
  }
  const names = SERVICES.filter(s => services.has(s.id)).map(s => s.label);
  // The scan engine arrives on day 2 of the build (PLAN.md section 7).
  status.textContent = `${practice ? 'Practice check ready' : `Access is ready for ${names.join(', ')}`}. This test version does not open pages yet.`;
});

// ---------------------------------------------------------------------------------------------------------------
// Under the hood.

async function offscreen(type, options) {
  await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
  return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
}

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
  const list = $('sent-log');
  list.replaceChildren(...sentLog.slice().reverse().map(e => {
    const li = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'meta';
    const what = document.createElement('span');
    what.textContent = `${e.kind === 'function_answers' ? 'Answers to the cloud' : 'Request'}: ${e.purpose}, ${e.model}`;
    const when = document.createElement('time');
    when.dateTime = e.time;
    when.textContent = new Date(e.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    meta.append(what, when);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(e.body, null, 2);
    li.append(meta, pre);
    return li;
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
  $('exit-shortcut-keys').replaceChildren(...keys.map(k => Object.assign(document.createElement('kbd'), { textContent: k })));
}

// ---------------------------------------------------------------------------------------------------------------
// Start-up.

(async () => {
  initInfo(document);
  const { theme } = await chrome.storage.local.get('theme');
  applyTheme(theme);
  await Promise.all([renderChecks(), showNano(), showCloud(), showExitShortcut()]);
  // The safety screen shows first in every new browser session. After "I understand", this session goes straight on.
  const { safetySeen } = await chrome.storage.session.get('safetySeen');
  show(safetySeen ? 'choose' : 'safety');
})();
