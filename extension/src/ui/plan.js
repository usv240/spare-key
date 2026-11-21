// The plan screen (EXPERIENCE.md section 3.5): optional situation questions, then the plan as numbered steps.
// Each step shows the steps library's own words; a model's words appear only in "why" and the summary, after the safety
// rules have run on them.
import { h, infoButton, UNCHECKED } from './results.js';
import { registerInfo } from './info.js';
import { HOTLINE } from '../../../shared/config.js';
import { SITUATION, CODE_TEXT } from '../../../shared/findings.js';
import { noticeOf } from '../../../shared/plan/engine.js';

export const QUESTIONS = [
  { key: 'living', text: 'Do you live with the other person?', answers: [['together', 'Yes'], ['apart', 'No'], ['prefer_not_to_say', 'Prefer not to say']] },
  { key: 'safe_to_change_now', text: 'Is now a good time to change things they may notice?', answers: [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure']] },
  { key: 'children_shared', text: 'Do you share children?', answers: [['yes', 'Yes'], ['no', 'No'], ['prefer_not_to_say', 'Prefer not to say']] },
  { key: 'has_advocate', text: 'Do you have an advocate?', answers: [['yes', 'Yes'], ['no', 'No'], ['prefer_not_to_say', 'Prefer not to say']] },
];

const LABELS = {
  document: 'Screenshot first',
  talk_to_advocate: 'Talk to an advocate',
  change_now: 'Change now',
  wait: 'Wait for a better time',
  check_manually: 'Check it yourself',
};

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
  root.replaceChildren(
    h('div', { class: 'with-info' }, h('h2', { class: 'plan-q-title', text: 'Want the plan ordered for your situation? These answers are optional.' }), infoButton('situation', 'About these questions')),
    ...fieldsets,
    h('label', { class: 'share-line' }, shareBox, h('span', { text: cloudOn ? 'Let plan help in the cloud see my choices' : 'Plan help from the cloud is off, so your choices stay here' })),
    h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary btn-block', type: 'button', id: 'make-plan', onclick: onMake }, 'Make my plan')),
  );
}

/**
 * The plan. `plan` uses local refs. `byRef` maps a local ref to its finding; `library` maps code to entry.
 * `source` is 'code' or 'cloud'; `fired` lists the safety rules that changed it; `onOpen(url)` opens a setting.
 */
export function renderPlan(root, { plan, byRef, library, source, model, fired = [], cloudNote = '', onOpen, onOverride }) {
  const steps = plan.actions.map((a, i) => stepCard(a, i, { byRef, library, onOpen, onOverride }));
  registerInfo('why-order', {
    title: 'Why this order',
    what: 'Screenshot first, because the record is gone once a setting changes. Talk to an advocate before changing anything that may be noticed. Quiet ways into your account come before the rest when now is a good time.',
    why: 'Changing a setting can alert the other person, and that can be most dangerous right after you leave. This order comes from the advice of tech abuse clinics and the Safety Net project.',
    tech: source === 'cloud'
      ? `Ordered by Gemini in the cloud (${model}) from finding types only, then checked by Spare Key's safety rules on this computer.`
      : 'Made on this computer from Spare Key\'s steps library, with no AI.',
  });
  const added = fired.filter(f => f.rule !== 'R3');
  root.replaceChildren(
    h('h1', { id: 'plan-title', tabindex: '-1', text: 'Your plan' }),
    h('div', { class: 'with-info' },
      h('p', { class: 'lead', text: source === 'cloud' ? 'Ordered with help from Gemini in the cloud, which saw finding types only.' : 'Made on this computer from Spare Key\'s steps library.' }),
      infoButton('why-order', 'About why this order')),
    cloudNote ? h('p', { class: 'notice', text: cloudNote }) : null,
    plan.summary ? h('p', { class: 'plan-summary', text: plan.summary }) : null,
    h('ol', { class: 'plan' }, steps),
    added.length ? h('details', { class: 'checked-list' },
      h('summary', { text: `Spare Key's safety rules changed this plan (${added.length})` }),
      h('ul', {}, added.map(f => h('li', { text: ruleWords(f) })))) : null,
  );
}

function ruleWords(f) {
  return {
    R1: 'Spare Key added a step for a finding the plan left out.',
    R2: 'Spare Key put "Screenshot first" before any change.',
    R4: 'Spare Key moved a change that may be noticed to "Wait", because now may not be a good time.',
    R5: 'Spare Key added the advocate step before any change.',
    R6: 'Spare Key removed a sentence that promised more than anyone can know.',
    R7: 'Spare Key removed a sentence with contact details or a link.',
    R8: 'Spare Key added a "Check it yourself" step for something not checked.',
  }[f.rule] || 'Spare Key adjusted this plan.';
}

function stepCard(a, i, { byRef, library, onOpen, onOverride }) {
  const kind = h('p', { class: `step-kind kind-${a.action}`, text: LABELS[a.action] || a.action });
  const body = [];
  if (a.action === 'document') {
    const items = a.refs.map(r => byRef.get(r)).filter(Boolean);
    body.push(h('p', { text: 'Take a screenshot of each of these settings before anything changes. Keep the screenshots somewhere the other person cannot see, like an email to an account only you use.' }));
    body.push(h('ul', { class: 'step-list' }, items.map(f => h('li', {}, h('strong', { text: (CODE_TEXT[f.code] || [f.code])[0] }), h('span', { class: 'muted', text: f.label })))));
  } else if (a.action === 'talk_to_advocate') {
    body.push(h('p', { text: a.why }));
    body.push(h('div', { class: 'hotline compact' },
      h('a', { href: HOTLINE.tel }, h('span', {}, 'Call ', h('strong', { text: HOTLINE.call }))),
      h('a', { href: HOTLINE.sms }, h('span', {}, 'Text ', h('strong', { text: 'START' }), ' to ', h('strong', { text: '88788' }))),
      h('a', { href: HOTLINE.web, target: '_blank', rel: 'noopener noreferrer' }, h('span', { text: 'Chat at thehotline.org' }))));
  } else if (a.action === 'change_now' || a.action === 'wait') {
    const items = a.refs.map(r => byRef.get(r)).filter(Boolean);
    const f = items[0];
    const e = library[a.code || f?.code] || {};
    body.push(h('p', { class: 'step-title', text: `${e.title || (CODE_TEXT[f?.code] || [''])[0]}${items.length > 1 ? ` (${items.length})` : ''}` }));
    if (items.length === 1) body.push(h('p', { class: 'muted', text: f.label }));
    else if (items.length > 1) body.push(h('ul', { class: 'step-list' }, items.map(x => h('li', { class: 'muted', text: x.label }))));
    if (a.why) body.push(h('p', { text: a.why }));
    if (a.action === 'change_now') {
      if (a.warning || noticeOf(library, a.code) !== 'unlikely') body.push(h('p', { class: 'caution-line' }, h('span', { text: `${a.warning || e.notice_why || 'Removing this may alert the other person.'} If now is not a good time, leave it and screenshot it.` })));
      body.push(h('ol', { class: 'how' }, (e.steps || []).map(s => h('li', { text: s }))));
    } else {
      if (e.if_not_safe_yet) body.push(h('p', { text: e.if_not_safe_yet }));
      body.push(h('details', { class: 'later' },
        h('summary', { text: 'When it is a better time' }),
        h('p', { class: 'caution-line' }, h('span', { text: e.notice_why || 'Removing this may alert the other person.' })),
        h('ol', { class: 'how' }, (e.steps || []).map(s => h('li', { text: s })))));
    }
    if (f?.openUrl) body.push(h('div', { class: 'finding-actions' }, h('button', { type: 'button', class: 'link-button', onclick: () => onOpen(f.openUrl) }, 'Open this setting')));
    if (e.sources?.length) body.push(h('p', { class: 'source muted' }, 'Source: ', ...e.sources.flatMap((s, k) => [k ? '; ' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title })])));
  } else if (a.action === 'check_manually') {
    body.push(h('p', { text: a.why }));
    body.push(h('ul', { class: 'guides' }, UNCHECKED.guides.map(g => h('li', {}, h('a', { href: g.url, target: '_blank', rel: 'noopener noreferrer', text: g.title })))));
  }
  return h('li', { class: 'step', 'data-action': a.action }, h('div', { class: 'step-head' }, h('span', { class: 'step-n num', text: String(i + 1) }), kind), ...body);
}
