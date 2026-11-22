// The plan screen (EXPERIENCE.md section 3.5): optional situation questions, then the plan in numbered sections:
//   1. Screenshot these first   2. Talk to an advocate   3. Change these now (only when the person said it is a good time)
//   4. Leave these for a better time, grouped by service and folded   5. Check the rest yourself
// Each block shows the steps library's own words, including what the other person would see (from a quoted official
// page where one exists). A model's words appear only in "why" and the summary, after the safety rules have run.
import { h, put, infoButton, UNCHECKED } from './results.js';
import { registerInfo } from './info.js';
import { HOTLINE } from '../../../shared/config.js';
import { CODE_TEXT } from '../../../shared/findings.js';

export const QUESTIONS = [
  { key: 'living', text: 'Do you live with the other person?', answers: [['together', 'Yes'], ['apart', 'No'], ['prefer_not_to_say', 'Prefer not to say']] },
  { key: 'safe_to_change_now', text: 'Is now a good time to change things they may notice?', answers: [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure']] },
  { key: 'children_shared', text: 'Do you share children?', answers: [['yes', 'Yes'], ['no', 'No'], ['prefer_not_to_say', 'Prefer not to say']] },
  { key: 'has_advocate', text: 'Do you have an advocate?', answers: [['yes', 'Yes'], ['no', 'No'], ['prefer_not_to_say', 'Prefer not to say']] },
];

/** The optional questions. `values` are the current answers; `onChange(values, share)` saves them. */
export function renderQuestions(root, { values, share, cloudOn, onChange, onMake }) {
  registerInfo('situation', {
    title: 'Why these questions',
    what: 'Your answers change the order of the plan. For example, if now is not a good time, changes that may be noticed wait.',
    why: cloudOn
      ? 'They stay on this computer unless you tick the box. If you tick it, Gemini in the cloud sees only your choices, like "not sure", never anything about you.'
      : 'They stay on this computer. Plan help from the cloud is off.',
  });
  const fieldsets = QUESTIONS.map(q => h('fieldset', { class: 'question' },
    h('legend', { text: q.text }),
    h('div', { class: 'choices' }, q.answers.map(([value, word]) => {
      const input = h('input', { type: 'radio', name: `q-${q.key}`, value });
      input.checked = (values[q.key] || '') === value;
      input.addEventListener('change', () => onChange({ ...values, [q.key]: value }, share));
      return h('label', { class: 'choice' }, input, h('span', { text: word }));
    }))));
  const shareBox = h('input', { type: 'checkbox', id: 'share-situation' });
  shareBox.checked = !!share;
  shareBox.disabled = !cloudOn;
  shareBox.addEventListener('change', () => onChange(values, shareBox.checked));
  put(root,
    h('div', { class: 'with-info' }, h('h2', { class: 'plan-q-title', text: 'Want the plan ordered for your situation? These answers are optional.' }), infoButton('situation', 'About these questions')),
    ...fieldsets,
    h('label', { class: 'share-line' }, shareBox, h('span', { text: cloudOn ? 'Let plan help in the cloud see my choices' : 'Plan help from the cloud is off, so your choices stay here' })),
    h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary btn-block', type: 'button', id: 'make-plan', onclick: onMake }, 'Make my plan')),
  );
}

const WHERE = {
  cloud: model => [`Ordered with help from Gemini in the cloud, which saw finding types only.`, `Ordered by Gemini in the cloud (${model}) from finding types only, then checked by Spare Key’s safety rules on this computer.`],
  device: model => [`Ordered by Gemini Nano on this computer. Nothing was sent anywhere.`, `Ordered by Gemini Nano on this computer (${model}), then checked by Spare Key’s safety rules. Nothing was sent anywhere.`],
  code: () => [`Made on this computer from Spare Key’s steps library.`, `Made on this computer from Spare Key’s steps library, with no AI.`],
};

/**
 * The plan. `plan` uses local refs. `byRef` maps a local ref to its finding; `library` maps code to entry.
 * `source` is 'code', 'device' or 'cloud'; `fired` lists the safety rules that changed it; `onOpen(url)` opens a setting.
 */
export function renderPlan(root, { plan, byRef, library, source, model, calls = null, fired = [], cloudNote = '', voices = null, freshDays = 45, freshness = {}, onCheckFresh = null, simpler = {}, onSimpler = null, onOpenCheck = null, checkLabels = {}, onOpen }) {
  const ctx = { byRef, library, onOpen, freshDays, freshness, onCheckFresh, simpler, onSimpler, onOpenCheck, checkLabels };
  const acts = plan.actions;
  const docs = acts.filter(a => a.action === 'document');
  const adv = acts.find(a => a.action === 'talk_to_advocate');
  const nows = acts.filter(a => a.action === 'change_now');
  const waits = acts.filter(a => a.action === 'wait');
  const checks = acts.filter(a => a.action === 'check_manually');
  const [lead, base] = (WHERE[source] || WHERE.code)(model);
  const times = n => (n === 1 ? 'once' : `${n} times`);
  const tech = source === 'cloud' && calls
    ? `${base} While ordering it, Gemini read the steps library ${times(calls.get_steps)}, asked this computer ${calls.ask_device} ${calls.ask_device === 1 ? 'question' : 'questions'} and asked you ${calls.ask_user}. Each answer was yes, no or not sure.`
    : base;
  registerInfo('why-order', {
    title: 'Why this order',
    what: 'Screenshot first, because the record is gone once a setting changes. Talk to an advocate before changing anything that may be noticed. Quiet ways into your account come before the rest when now is a good time.',
    why: 'Changing a setting can alert the other person. That can be most dangerous right after you leave. This order follows advice from tech abuse clinics and the Safety Net project.',
    tech,
  });
  const added = fired.filter(f => f.rule !== 'R3');
  const sections = [];
  if (docs.length) sections.push(screenshotSection(docs, ctx));
  if (adv) sections.push(advocateSection(adv));
  if (nows.length) sections.push(nowSection(nows, ctx));
  if (waits.length) sections.push(waitSection(waits, ctx));
  if (checks.length) sections.push(checkSection(checks, ctx));
  sections.forEach((el, i) => { el.querySelector('.step-n').textContent = String(i + 1); });
  put(root,
    h('h1', { id: 'plan-title', tabindex: '-1', text: 'Your plan' }),
    h('div', { class: 'with-info' }, h('p', { class: 'lead', text: lead }), infoButton('why-order', 'About why this order')),
    cloudNote ? h('p', { class: 'notice', text: cloudNote }) : null,
    // A model's own summary when it wrote one; the code plan's summary is what "Start here" already says.
    plan.summary ? h('p', { class: 'plan-summary', text: plan.summary }) : null,
    startHere({ docs, adv, nows, waits }, ctx),
    h('ol', { class: 'plan' }, sections),
    voices ? h('details', { class: 'voices' },
      h('summary', { text: 'Why this order: two voices' }),
      h('p', { class: 'muted', text: 'Before you saw this plan, two AI voices argued over it, and a third settled it. Spare Key’s own rules then made sure every warning is there.' }),
      h('h3', { text: 'Close the doors' }),
      h('p', { text: voices.close_the_doors || voices.arguments?.close_the_doors || '' }),
      h('h3', { text: 'Stay hidden' }),
      h('p', { text: voices.stay_hidden || voices.arguments?.stay_hidden || '' }),
      voices.table?.length ? voiceTable(voices.table, ctx) : null,
      voices.arguments ? h('details', { class: 'later' },
        h('summary', { text: 'Read both arguments in full' }),
        h('p', {}, h('strong', { text: 'Close the doors: ' }), voices.arguments.close_the_doors || ''),
        h('p', {}, h('strong', { text: 'Stay hidden: ' }), voices.arguments.stay_hidden || '')) : null) : null,
    added.length ? h('details', { class: 'checked-list' },
      h('summary', { text: `Spare Key’s safety rules changed this plan (${added.length})` }),
      h('ul', {}, added.map(f => h('li', { text: ruleWords(f) })))) : null,
  );
}

// Where the two voices disagreed, kind by kind, and what the plan did with it.
function voiceTable(rows, { library }) {
  return h('div', { class: 'voice-table' },
    h('h3', { text: 'Kind by kind' }),
    ...rows.map(r => h('div', { class: 'voice-row' },
      h('p', { class: 'step-title', text: library[r.code]?.title || (CODE_TEXT[r.code] || [r.code])[0] }),
      h('p', {}, h('strong', { text: 'Close the doors: ' }), r.close_the_doors),
      h('p', {}, h('strong', { text: 'Stay hidden: ' }), r.stay_hidden))));
}

function ruleWords(f) {
  return {
    R1: 'Spare Key added a step for a finding the plan left out.',
    R2: 'Spare Key put "Screenshot first" before any change.',
    R4: 'Spare Key moved a change that may be noticed to "Leave for a better time", because now may not be a good time.',
    R5: 'Spare Key added the advocate step before any change.',
    R6: 'Spare Key removed a sentence that promised more than anyone can know.',
    R7: 'Spare Key removed a sentence with contact details or a link.',
    R8: 'Spare Key added a "Check it yourself" step for something not checked.',
    R9: 'Spare Key put the mail copying first. Google’s emails about the other changes would reach them.',
  }[f.rule] || 'Spare Key adjusted this plan.';
}

const SERVICE_NAMES = { google: 'Google account', gmail: 'Gmail', photos: 'Google Photos', amazon: 'Amazon', chrome: 'This Chrome browser', phone: 'Your phone', other: 'Other' };
const groupBy = (list, key) => list.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) || []), x]), new Map());

const section = (kind, title, ...body) => h('li', { class: `step step-${kind}`, 'data-action': kind },
  h('div', { class: 'step-head' }, h('span', { class: 'step-n num' }), h('h2', { class: `step-kind kind-${kind}`, text: title })), ...body);

function screenshotSection(docs, { byRef }) {
  const items = [...new Set(docs.flatMap(a => a.refs))].map(r => byRef.get(r)).filter(Boolean);
  const byCode = groupBy(items, f => f.code);
  const list = h('ul', { class: 'step-list' }, [...byCode].map(([code, fs]) => h('li', {},
    h('strong', { text: `${(CODE_TEXT[code] || [code])[0]}${fs.length > 1 ? ` (${fs.length})` : ''}` }),
    ...fs.map(f => h('span', { class: 'muted', text: f.label })))));
  return section('document', `Screenshot these first (${items.length})`,
    h('p', { text: 'A record of what is set up now helps you and an advocate, and it is gone once a setting changes. Keep the screenshots where the other person cannot see them, like an email to an account only you use.' }),
    h('p', { class: 'muted', text: 'Spare Key also kept the words on each page it read, with the date and time. They are under "What we found", and in a locked copy if you save one. Screenshots are still the stronger record.' }),
    // A short list stays open; a long one folds, so the plan's next steps stay in view.
    byCode.size > 4 ? h('details', { class: 'later shot-list' }, h('summary', { text: `See all ${items.length}, in ${byCode.size} kinds` }), list) : list);
}

// The first three things to do, before the full plan: screenshot, an advocate, and the most urgent kind.
function startHere({ docs, adv, nows, waits }, { library }) {
  const first = [...nows, ...waits][0];
  const kind = first ? (library[first.code]?.title || (CODE_TEXT[first.code] || [first.code])[0]) : '';
  const lines = [
    docs.length ? `Screenshot the ${docs[0].refs.length} ${docs[0].refs.length === 1 ? 'setting' : 'settings'} in step 1, and keep the pictures where the other person cannot see them.` : '',
    adv ? `Call or text an advocate: ${HOTLINE.call.replace(/-/g, '‑')}, or text START to 88788. It is free and open all day, every day.` : '',
    first ? `Then the most urgent kind: ${kind.charAt(0).toLowerCase()}${kind.slice(1)}. ${first.action === 'change_now' ? 'You said now is a good time.' : 'Leave it for a better time, and ask the advocate when.'}` : '',
  ].filter(Boolean);
  return lines.length ? h('div', { class: 'start-here' }, h('h2', { text: 'Start here' }), h('ol', {}, lines.map(t => h('li', { text: t })))) : null;
}

function advocateSection(a) {
  return section('talk_to_advocate', 'Talk to an advocate',
    h('p', { text: a.why }),
    h('div', { class: 'hotline compact' },
      h('a', { href: HOTLINE.tel }, h('span', {}, 'Call ', h('strong', { text: HOTLINE.call }))),
      h('a', { href: HOTLINE.sms }, h('span', {}, 'Text ', h('strong', { text: 'START' }), ' to ', h('strong', { text: '88788' }))),
      h('a', { href: HOTLINE.web, target: '_blank', rel: 'noopener noreferrer' }, h('span', { text: 'Chat at thehotline.org' }))));
}

// One folded block per kind of finding, grouped under the service it belongs to.
function byService(acts, ctx) {
  const service = a => ctx.byRef.get(a.refs[0])?.service || 'other';
  return [...groupBy(acts, service)].map(([svc, list]) => h('div', { class: 'wait-group' },
    h('h3', { text: SERVICE_NAMES[svc] || svc }),
    ...list.map(a => codeBlock(a, ctx, { open: false }))));
}

const countOf = acts => acts.reduce((n, a) => n + a.refs.length, 0);

function nowSection(nows, ctx) {
  const total = countOf(nows);
  return section('change_now', total === 1 ? 'Change this now' : `Change these now (${total})`,
    h('p', { text: 'You said now is a good time. Open each one to read what the other person would see, then follow the steps. If anything changes, stop and leave the rest for later.' }),
    ...byService(nows, ctx));
}

function waitSection(waits, ctx) {
  return section('wait', `Leave these for a better time (${countOf(waits)})`,
    h('p', { text: 'Removing these may be noticed. For now, screenshot them and talk to an advocate about when to change each one. Open one to see what the other person would see, and the steps for later.' }),
    ...byService(waits, ctx));
}

// The checks Spare Key could not read, or read only in part, by name, each with a way to open it; then the guides for
// everything it does not cover.
function checkSection(checks, { checkLabels = {}, onOpenCheck = null }) {
  const named = [...new Set(checks.map(a => a.check).filter(id => id && id !== 'other_services'))];
  return section('check_manually', 'Check the rest yourself',
    named.length ? h('p', { text: 'Spare Key could not read all of these. Open each one and look for anyone or anything you do not know.' }) : null,
    named.length ? h('ul', { class: 'step-list' }, named.map(id => h('li', {},
      h('strong', { text: checkLabels[id] || id }),
      onOpenCheck ? h('button', { type: 'button', class: 'link-button', onclick: () => onOpenCheck(id) }, 'Open it') : null))) : null,
    h('p', { text: 'Spare Key does not check other apps or your phone. These guides show how to check them yourself.' }),
    h('ul', { class: 'guides' }, UNCHECKED.guides.map(g => h('li', {}, h('a', { href: g.url, target: '_blank', rel: 'noopener noreferrer', text: g.title })))));
}

// A "why" a model wrote for this step, unless it is one of the code plan's stock sentences.
const STOCK = /^(Removing this may be noticed|You said now is a good time|Changing this is unlikely|This gives someone a quiet way|Spare Key added this)/;

// One kind of finding: its items, what the other person would see, what to do now or later, and the steps.
// "Say it more simply": the library's steps put in simpler words by Gemini (Nano when the computer has it), on request.
// The library's own steps stay shown above them, and they are the ones to follow.
function simplerBlock(code, { simpler = {}, onSimpler = null }) {
  if (!onSimpler) return [];
  const r = simpler[code];
  if (!r) return [h('button', { type: 'button', class: 'link-button simpler-button', onclick: () => onSimpler(code) }, 'Say it more simply')];
  if (r.pending) return [h('p', { class: 'muted', role: 'status', text: 'Putting these steps in simpler words.' })];
  if (r.off) return [h('p', { class: 'muted', role: 'status', text: 'This needs Gemini Nano on this computer, or plan help from the cloud.' })];
  if (!r.steps) return [h('p', { class: 'muted', role: 'status', text: 'Spare Key could not put these in simpler words just now.' })];
  return [h('div', { class: 'simpler', role: 'status' },
    h('p', {}, h('strong', { text: 'In simpler words' })),
    h('ol', { class: 'how' }, r.steps.map(s => h('li', { text: s }))),
    h('p', { class: 'muted', text: `${r.source === 'on_device' ? 'By Gemini Nano on this computer' : 'By Gemini in the cloud, which saw only these public steps'}. If anything here differs from the steps above, follow the steps above.` }))];
}

function codeBlock(a, { byRef, library, onOpen, freshDays, freshness, onCheckFresh, simpler, onSimpler }, { open }) {
  const items = a.refs.map(r => byRef.get(r)).filter(Boolean);
  const f = items[0];
  const code = a.code || f?.code;
  const e = library[code] || {};
  const title = `${e.title || (CODE_TEXT[code] || [''])[0]}${items.length > 1 ? ` (${items.length})` : ''}`;
  const see = e.what_they_see || a.warning || 'Removing this may alert the other person.';
  const steps = [h('ol', { class: 'how' }, (e.steps || []).map(s => h('li', { text: s }))), ...simplerBlock(code, { simpler, onSimpler })];
  const inner = [
    items.length ? h('ul', { class: 'step-list items' }, items.map(x => h('li', { class: 'muted', text: x.label }))) : null,
    h('p', { class: 'caution-line' }, h('span', { text: a.action === 'change_now' ? `${see} If now is not a good time, leave it and screenshot it.` : see })),
    a.linked ? h('p', { class: 'caution-line linked-line' }, h('span', { text: a.linked })) : null,
    a.why && !STOCK.test(a.why) ? h('p', { text: a.why }) : null,
    a.action === 'wait' && e.if_not_safe_yet ? h('p', {}, h('strong', { text: 'For now: ' }), e.if_not_safe_yet) : null,
    a.action === 'change_now'
      ? h('div', { class: 'steps-now' }, ...steps)
      : h('details', { class: 'later' }, h('summary', { text: 'Steps for when it is a better time' }), ...steps),
    f?.openUrl ? h('div', { class: 'finding-actions' }, h('button', { type: 'button', class: 'link-button', onclick: () => onOpen(f.openUrl) }, 'Open this setting')) : null,
    e.sources?.length ? h('p', { class: 'source muted' }, 'Source: ', ...e.sources.flatMap((s, k) => [k ? '; ' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title })])) : null,
    ...(freshnessBlock(code, e, { freshDays, freshness, onCheckFresh }) || []),
  ];
  return open
    ? h('div', { class: 'code-block', 'data-code': code }, h('p', { class: 'step-title', text: title }), ...inner)
    : h('details', { class: 'code-block', 'data-code': code }, h('summary', { class: 'step-title', text: title }), ...inner);
}

const longDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const ageDays = iso => Math.floor((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86400000);

// When the steps were checked, and, once they are older than fresh_days, a check that they still match the help page.
function freshnessBlock(code, e, { freshDays, freshness, onCheckFresh }) {
  if (!e?.verified_at) return null;
  const r = freshness[code];
  const stale = ageDays(e.verified_at) > freshDays;
  const lines = [h('p', { class: 'source muted', text: `Checked against the official help page on ${longDate(e.verified_at)}.` })];
  if (r?.pending) lines.push(h('p', { class: 'muted', role: 'status', text: 'Checking the help page now.' }));
  else if (r) {
    const title = e.sources?.[0]?.title || 'the help page';
    lines.push(h('p', { class: 'fresh-result', role: 'status', text: r.still_matches === 'yes' ? `Still matches ${title} today.`
      : r.still_matches === 'no' ? `The help page may have changed. Here is what it says today: ${r.what_changed || 'the steps there are different.'} Follow the help page if the steps below do not work.`
      : r.cloudOff ? 'Plan help from the cloud is off, so Spare Key did not check the help page. Open it to check the steps yourself.'
      : 'Spare Key could not compare these steps with the help page today. Open the help page to check.' }));
  } else if (stale && onCheckFresh) {
    lines.push(h('button', { type: 'button', class: 'link-button', onclick: () => onCheckFresh(code) }, 'Check these steps are still current'));
  }
  return lines;
}
