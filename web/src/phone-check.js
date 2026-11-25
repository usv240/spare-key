// The guided phone check (phone-check.html): for a person with only a phone, iPhone or Android. The person looks in a
// few places on their own phone and answers yes, no or not sure. Each "yes" or "not sure" becomes a finding code, and
// the plan is made here by the same code the extension and the Android app use (shared/plan/engine.js), then held to
// the same safety rules (shared/plan/invariants.js). Nothing is read from the phone and nothing is saved. The places
// and questions need no model, because the person already did the reading. Only the optional "Anything else you know?"
// box uses one: Gemini Nano on this device (Firebase AI Logic, ONLY_ON_DEVICE) where Chrome has it, Spare Key's keyword
// reader where it does not (most phones). Either way the words are read here and nothing is sent after the page loads.
import { initInfo, closeInfo, isInfoOpen } from '../../extension/src/ui/info.js';
import { h, put } from '../../extension/src/ui/results.js';
import { renderPlan, QUESTIONS, toldBox, readingWords, clearPlanProgress } from '../../extension/src/ui/plan.js';
import { toldFindings, toldSituation } from '../../shared/told.js';
import { CODE_TEXT } from '../../shared/findings.js';
import { readTold } from './told-device.js';
import { buildPlan } from '../../shared/plan/engine.js';
import { applyInvariants } from '../../shared/plan/invariants.js';
import { libraryMap } from '../../shared/steps-schema.js';
import { QUICK_EXIT_URL } from '../../shared/config.js';
import STEPS from '../../data/steps.json';

const $ = id => document.getElementById(id);
const LIBRARY = libraryMap(STEPS);

// The places to look. Each has the steps to get there, one question, and the finding code a "yes" means.
const BOTH = [
  { code: 'tracker.alert', title: 'Tracker alerts', where: 'Think back: has your phone shown an alert about an AirTag or another tracker moving with you?', ask: 'Has your phone warned you about a tracker?' },
  { code: 'life360.circle.member', title: 'Life360', where: 'If you have Life360, open it and look at each circle you are in.', ask: 'Is the other person, or someone they know, in one of your circles?' },
  { code: 'carrier.plan.holder_other', title: 'Your phone plan', where: 'Think about who pays for your phone, and whose name the plan is in.', ask: 'Is your phone plan in the other person’s name, or do they pay for it?' },
];
const PLACES = {
  iphone: [
    { code: 'apple.findmy.sharing', title: 'Find My', where: 'Open the Find My app and tap People.', ask: 'Is anyone listed that you did not choose, or no longer want to see where you are?' },
    { code: 'apple.account.device_other', title: 'Devices on your Apple Account', where: 'Open Settings, then Privacy and Security, then Safety Check. Choose Manage Sharing and Access and go on to the list of devices. Looking changes nothing.', ask: 'Is there a device you do not know?' },
    { code: 'apple.family.organizer_other', title: 'Family', where: 'Open Settings, then Family (below your name).', ask: 'Is the organizer the other person, or someone you do not trust?' },
    ...BOTH,
  ],
  android: [
    { code: 'maps.sharing.person', title: 'Google Maps location sharing', where: 'Open Google Maps, tap your picture, then Location sharing.', ask: 'Is anyone listed that you did not choose, or no longer want to see where you are?' },
    { code: 'phone.app.accessibility', title: 'Accessibility', where: 'Open Settings, then Accessibility. Look under downloaded apps or installed services.', ask: 'Is there an app you do not know?' },
    { code: 'phone.app.device_admin', title: 'Device admin apps', where: 'Open Settings and search for “device admin”.', ask: 'Is there an app you do not know?' },
    { code: 'phone.app.notifications', title: 'Notification access', where: 'Open Settings and search for “notification access”.', ask: 'Is there an app you do not know?' },
    { code: 'phone.app.location_always', title: 'Location all the time', where: 'Open Settings, then Location, then App location permissions. Look under “Allowed all the time”.', ask: 'Is there an app you do not know?' },
    ...BOTH,
  ],
};
const ANSWERS = [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure']];

let os = null;
const answers = {};
const situation = {};
// What the person typed under "Anything else you know?": in this page's memory only.
let toldText = '';

function choices(name, list, value, onPick) {
  return h('div', { class: 'choices' }, list.map(([v, word]) => {
    const input = h('input', { type: 'radio', name });
    input.value = v;
    input.checked = value === v;
    input.addEventListener('change', () => onPick(v));
    return h('label', { class: 'choice' }, input, h('span', { text: word }));
  }));
}

function drawPlaces() {
  const list = PLACES[os];
  put($('places'),
    h('h2', { text: `Look in these ${list.length} places` }),
    h('p', { class: 'muted', text: 'Looking changes nothing. Leave each setting as it is for now: the plan says when to change it.' }),
    ...list.map((p, i) => h('fieldset', { class: 'question place' },
      h('legend', { text: p.title }),
      h('p', { class: 'where', text: p.where }),
      h('p', { class: 'pc-ask', text: p.ask }),
      choices(`p-${i}`, ANSWERS, answers[p.code], v => { answers[p.code] = v; count(); }))));
  put($('situation'),
    h('h2', { text: 'A few questions about you' }),
    h('p', { class: 'muted', text: 'They change the order of the plan, and stay on this page. You can skip any of them.' }),
    ...QUESTIONS.map(q => h('fieldset', { class: 'question' },
      h('legend', { text: q.text }),
      choices(`q-${q.key}`, q.answers, situation[q.key], v => { situation[q.key] = v; }))),
    toldBox({ text: toldText, onTold: t => { toldText = t; }, where: 'this phone or computer' }));
  $('situation').hidden = false;
  $('ask-actions').hidden = false;
  count();
}

function findings() {
  return (PLACES[os] || []).filter(p => answers[p.code] === 'yes' || answers[p.code] === 'not_sure').map((p, i) => ({
    ref: `f${i + 1}`, code: p.code, ownership: answers[p.code] === 'yes' ? 'not_mine' : 'unsure', recency: 'unknown',
    label: `${p.title}: ${answers[p.code] === 'yes' ? 'you said yes' : 'you were not sure'}`, service: 'phone',
  }));
}

function count() {
  const n = findings().length;
  const left = (PLACES[os] || []).filter(p => !answers[p.code]).length;
  $('found-line').textContent = `${n} to look at so far${left ? `, ${left} ${left === 1 ? 'place' : 'places'} not answered yet` : ''}. You can make the plan at any time.`;
}

async function makePlan() {
  const found = findings();
  // "Anything else you know?": read here (Gemini Nano on this device, or the keyword reader). It can add a step and fill a
  // question left blank, never take a step away.
  let told = [], toldValues = {}, toldBy = null;
  if (toldText.trim()) {
    const done = readingWords();
    const r = await readTold(toldText).finally(done);
    const words = Object.fromEntries(Object.entries(CODE_TEXT).map(([c, t]) => [c, t[0]]));
    told = toldFindings(r.answer, { existing: found, howFound: r.how === 'nano' ? 'nano' : 'reader', words });
    toldValues = toldSituation(r.answer, situation);
    toldBy = r.how || 'reader';
  }
  const fs = [...found, ...told];
  const notChecked = ['other_services'];
  const ctx = { findings: fs, situation: { ...toldValues, ...situation }, notChecked, library: LIBRARY };
  const { plan, fired } = applyInvariants(buildPlan(ctx), ctx);
  const byRef = new Map(fs.map(f => [f.ref, f]));
  renderPlan($('plan'), { plan, fired, byRef, library: LIBRARY, source: 'page', toldBy, toldAdded: told.length + Object.keys(toldValues).length, onOpen: () => {} });
  initInfo($('plan'));
  if (!fs.length) $('plan').querySelector('.with-info')?.after(h('p', { class: 'notice', role: 'status', text: 'You did not mark anything in these places. That is useful to know, and it covers only these places: other apps, accounts and devices can still share. The guides at the end show where else to look.' }));
  $('screen-ask').hidden = true;
  $('screen-plan').hidden = false;
  $('plan-title')?.focus();
  scrollTo(0, 0);
}

function clearAll() {
  for (const k of Object.keys(answers)) delete answers[k];
  for (const k of Object.keys(situation)) delete situation[k];
  toldText = '';
  clearPlanProgress();
  os = null;
  for (const r of document.querySelectorAll('input[name="os"]')) r.checked = false;
  put($('places'));
  put($('situation'));
  put($('plan'));
  $('situation').hidden = true;
  $('ask-actions').hidden = true;
  $('screen-plan').hidden = true;
  $('screen-ask').hidden = false;
  $('ask-title').focus();
}

// Quick exit: clears this page's answers and shows an ordinary page in its place, with no way back.
function quickExit() {
  try { sessionStorage.clear(); } catch { /* blocked */ }
  location.replace(QUICK_EXIT_URL);
}
$('quick-exit').addEventListener('click', quickExit);
let lastEscape = 0;
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (performance.now() - lastEscape < 1000) quickExit();
  lastEscape = performance.now();
  if (isInfoOpen()) closeInfo();
});

for (const r of document.querySelectorAll('input[name="os"]')) r.addEventListener('change', () => { os = r.value; drawPlaces(); });
$('make-plan').addEventListener('click', makePlan);
$('print-plan').addEventListener('click', () => print());
$('back').addEventListener('click', () => { $('screen-plan').hidden = true; $('screen-ask').hidden = false; $('ask-title').focus(); });
$('clear').addEventListener('click', clearAll);
initInfo(document);
