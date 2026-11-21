// The results (EXPERIENCE.md section 3.4): findings grouped by what the other person could do, each a fact with a next
// step, and "Not checked" always shown. The words "safe", "secure" and "all clear" never appear, and an empty result
// never reads as an all-clear.
import { GROUPS, GROUP_LABELS, CODE_TEXT } from '../../../shared/findings.js';
import { RECENCY_WORDS } from '../../../shared/text.js';
import { sortFindings } from '../scan/rules.js';
import { registerInfo, clearDynamicInfo, prepare } from './info.js';
import { SERVICES } from '../scan/catalogue.js';

/** A tiny element builder: h('p', { class: 'x' }, 'text', child). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const infoButton = (id, label) => {
  const b = h('button', { class: 'info', type: 'button', 'data-info': id, 'aria-label': label });
  b.innerHTML = '<svg aria-hidden="true"><use href="#i-info"/></svg>';
  prepare(b);
  return b;
};

const serviceName = id => SERVICES.find(s => s.id === id)?.label || id;

const HOW = {
  reader: 'Read by code',
  both: 'Read by code and Gemini Nano on this computer',
  nano: 'Found by Gemini Nano reading the page',
};

// Not checked: why, in plain words, with what to do next.
const WHY = {
  signed_out: s => `You are not signed in to ${s} in this browser. Sign in, then check again.`,
  needs_password: s => `${s} asked you to confirm your password first. Open the page, confirm it, then check again.`,
  did_not_load: () => 'The page did not load. You can check it again, or open it yourself.',
  no_permission: () => 'Chrome did not give Spare Key access to this page.',
  practice: () => 'This runs only when you check your own browser, not in the practice check.',
  nothing_to_compare: () => 'This needs a Google account check to compare with.',
  stopped: () => 'You stopped the check before it got here.',
};

// Services Spare Key does not check, with trusted guides for checking them by hand (links checked November 21, 2026).
export const UNCHECKED = {
  services: 'Ring, Life360, your phone carrier, Apple, Facebook, Snapchat, and your phone itself',
  guides: [
    { title: 'Safety Net (NNEDV): guides for survivors, app by app', url: 'https://www.techsafety.org/resources-survivors' },
    { title: 'Apple: Personal Safety User Guide, including Safety Check', url: 'https://support.apple.com/guide/personal-safety/welcome/web' },
    { title: 'Cornell Clinic to End Tech Abuse: resources', url: 'https://ceta.tech.cornell.edu/resources' },
  ],
};

/**
 * Render the results into `root`.
 *   scan       { findings, outcomes, mode }
 *   catalogue  the checks, for labels
 *   onAnswer(ref, ownership), onOpen(url): actions, handled by the panel
 */
export function renderResults(root, { scan, catalogue, reveal = new Set(), onAnswer, onOpen, onToggleReveal }) {
  clearDynamicInfo();
  const label = id => catalogue.find(c => c.id === id)?.label || id;
  const checked = scan.outcomes.filter(o => o.status === 'checked');
  const skipped = scan.outcomes.filter(o => o.status !== 'checked');
  const findings = sortFindings(scan.findings);

  registerInfo('results-summary', {
    title: 'What these results cover',
    what: `Spare Key read ${checked.length} of your settings pages and listed every person, device and app they show.`,
    why: 'It only knows what these pages say. Anything under Not checked, and any service it does not cover, could still give someone access.',
    tech: 'Pages are read by code in the scan tab. When Gemini Nano is on this computer, it sorts each entry, and reads a page itself when the code finds nothing. Nothing from these pages leaves this computer.',
  });

  const summary = findings.length
    ? `${checked.length} ${checked.length === 1 ? 'check' : 'checks'} done${skipped.length ? `, ${skipped.length} not checked` : ''}. Here is what they show.`
    : `These ${checked.length} checks found no other person, device or app. Spare Key did not check everything: see Not checked below.`;

  const groups = GROUPS.map(g => ({ g, items: findings.filter(f => f.group === g) })).filter(x => x.items.length);

  root.replaceChildren(
    h('h1', { id: 'results-title', tabindex: '-1', text: scan.mode === 'practice' ? 'What we found for Jordan' : 'What we found' }),
    scan.mode === 'practice' ? h('p', { class: 'notice', text: 'Practice check. These are made-up pages for a person called Jordan.' }) : null,
    h('div', { class: 'with-info' }, h('p', { class: 'lead', text: summary }), infoButton('results-summary', 'About these results')),
    ...groups.map(({ g, items }) => h('section', { class: 'group', 'aria-labelledby': `g-${g}` },
      h('h2', { id: `g-${g}` }, `${GROUP_LABELS[g]} `, h('span', { class: 'count', text: `(${items.length})` })),
      h('ul', { class: 'findings' }, items.map(f => findingCard(f, { reveal: reveal.has(f.ref), onAnswer, onOpen, onToggleReveal }))),
    )),
    checkedList(scan.outcomes, label),
    notChecked(skipped, label),
  );
}

function findingCard(f, { reveal, onAnswer, onOpen, onToggleReveal }) {
  const [title, means] = CODE_TEXT[f.code] || [f.code, ''];
  const infoId = `finding-${f.ref}`;
  registerInfo(infoId, {
    title,
    what: means,
    whatLabel: 'What this means',
    why: `${HOW[f.howFound] || 'Read by code'}${f.howFound === 'nano' ? '. Check it in the setting itself.' : '.'} Removing it may alert the other person, because whatever this gave them stops. If now is not a good time, screenshot it and leave it.`,
    whyLabel: 'How Spare Key found it',
    tech: `Finding type: ${f.code}. Only this type, and your answer below, can ever be sent to the cloud, and only if plan help is on.`,
  });
  const meta = [serviceName(f.service), RECENCY_WORDS[f.recency]].filter(Boolean).join(' · ');
  const answers = [['mine', 'Mine'], ['not_mine', 'Not mine'], ['unsure', 'Not sure']];
  const text = reveal ? f.detail : f.label;
  return h('li', { class: 'finding', 'data-ref': f.ref, 'data-code': f.code },
    h('div', { class: 'finding-head' },
      h('div', { class: 'finding-text' },
        h('p', { class: 'finding-title', text: title }),
        h('p', { class: 'finding-label', text }),
        meta ? h('p', { class: 'finding-meta', text: meta }) : null),
      infoButton(infoId, `About ${title.charAt(0).toLowerCase()}${title.slice(1)}`)),
    f.confidence === 'check_it' ? h('p', { class: 'finding-note', text: 'Found by reading the page. Check it in the setting.' }) : null,
    f.disagree ? h('p', { class: 'finding-note', text: 'Spare Key is not sure whose this is. Your answer below decides.' }) : null,
    h('p', { class: 'caution-line' }, cautionIcon(), h('span', { text: 'Removing it may alert them.' })),
    h('div', { class: 'answer', role: 'group', 'aria-label': `Is this yours: ${title}` },
      answers.map(([value, word]) => h('button', {
        type: 'button', 'aria-pressed': String(f.ownership === value), 'data-answer': value,
        onclick: () => onAnswer(f.ref, f.ownership === value ? null : value),
      }, word))),
    h('div', { class: 'finding-actions' },
      h('button', { type: 'button', class: 'link-button', onclick: () => onOpen(f.openUrl) }, 'Open this setting'),
      /@|\d{3}/.test(f.detail) || f.detail !== f.label
        ? h('button', { type: 'button', class: 'link-button', 'aria-pressed': String(reveal), onclick: () => onToggleReveal(f.ref) }, reveal ? 'Hide details' : 'Show details')
        : null),
  );
}

function cautionIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('viewBox', '0 0 16 16');
  s.innerHTML = '<path d="M8 2.2 14.3 13H1.7L8 2.2Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.4v3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.3" r=".85" fill="currentColor"/>';
  return s;
}

function checkedList(outcomes, label) {
  const done = outcomes.filter(o => o.status === 'checked');
  if (!done.length) return null;
  return h('details', { class: 'checked-list' },
    h('summary', { text: `What was checked (${done.length})` }),
    h('ul', {}, done.map(o => h('li', {},
      h('span', { text: label(o.id) }),
      h('span', { class: 'muted', text: o.findings
        ? `${o.findings} found${o.partly ? ', more may be hidden: open the setting to see the full list' : ''}`
        : o.how === 'reader' && o.entries === 0 ? 'Checked by code only: nothing listed' : o.partly ? 'Nothing listed in what was shown. More may be hidden.' : 'Nothing listed' })))));
}

function notChecked(skipped, label) {
  registerInfo('not-checked', {
    title: 'Not checked',
    what: 'These are the places Spare Key did not read this time, and the services it does not cover yet.',
    why: 'Someone could still have access through any of them. The guides below show how to check each one yourself.',
  });
  return h('section', { class: 'group not-checked', 'aria-labelledby': 'g-not-checked' },
    h('div', { class: 'with-info' }, h('h2', { id: 'g-not-checked', text: `Not checked (${skipped.length + 1})` }), infoButton('not-checked', 'About Not checked')),
    h('ul', { class: 'plain-list' },
      skipped.map(o => h('li', {}, h('strong', { text: label(o.id) }), h('span', { text: (WHY[o.why] || WHY.did_not_load)(serviceName(o.service)) }))),
      h('li', {}, h('strong', { text: 'Not covered yet' }), h('span', { text: `${UNCHECKED.services}. How to check each one yourself:` }),
        h('ul', { class: 'guides' }, UNCHECKED.guides.map(g => h('li', {}, h('a', { href: g.url, target: '_blank', rel: 'noopener noreferrer', text: g.title })))))));
}
