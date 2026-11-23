// The results (EXPERIENCE.md section 3.4): findings grouped by what the other person could do, each a fact with a next
// step, and "Not checked" always shown. The words "safe", "secure" and "all clear" never appear, and an empty result
// never reads as an all-clear.
import { GROUPS, GROUP_LABELS, CODE_TEXT } from '../../../shared/findings.js';
import { RECENCY_WORDS, maskEmail } from '../../../shared/text.js';
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

/** Replace an element's children, skipping empty ones (replaceChildren would print "null"). */
export const put = (root, ...kids) => root.replaceChildren(...kids.flat().filter(k => k !== null && k !== undefined && k !== false));

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
  cloud: 'Found by Gemini in the cloud reading the made-up practice page',
};

// Not checked: why, in plain words, with what to do next.
const WHY = {
  signed_out: s => `You are not signed in to ${s} in this browser. Sign in, then check again.`,
  needs_password: s => `${s} asked you to confirm it is you, and that was skipped. Check it again below: Spare Key waits while you confirm it in the page beside this panel.`,
  did_not_load: () => 'The page did not load. You can check it again, or open it yourself.',
  looked_different: () => 'The page looked different from what Spare Key knows, so it could not tell what is listed. Open it and check it yourself.',
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
export function renderResults(root, { scan, catalogue, library = {}, reveal = new Set(), onAnswer, onOpen, onToggleReveal, onReport = null, onRecheck = null, reportState = '' }) {
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

  put(root,
    h('h1', { id: 'results-title', tabindex: '-1', text: scan.mode === 'practice' ? 'What we found for Jordan' : 'What we found' }),
    scan.mode === 'practice' ? h('p', { class: 'notice', text: 'Practice check. These are made-up pages for a person called Jordan.' }) : null,
    h('div', { class: 'with-info' }, h('p', { class: 'lead', text: summary }), infoButton('results-summary', 'About these results')),
    // Which account the pages belonged to, masked, so a check of the wrong account is easy to spot.
    scan.account?.email ? h('p', { class: 'muted account-line', text: `Account checked: ${scan.mode === 'practice' ? scan.account.email : maskEmail(scan.account.email)}. If that is not yours, choose another account and check again.` }) : null,
    ...groups.map(({ g, items }) => h('section', { class: 'group', 'aria-labelledby': `g-${g}` },
      h('h2', { id: `g-${g}` }, `${GROUP_LABELS[g]} `, h('span', { class: 'count', text: `(${items.length})` })),
      h('ul', { class: 'findings' }, items.map(f => findingCard(f, { reveal: reveal.has(f.ref), library, onAnswer, onOpen, onToggleReveal }))),
    )),
    checkedList(scan.outcomes, label),
    notChecked(skipped, label, checked.filter(o => o.partly && o.id !== 'screenshot'), scan.mode !== 'practice' ? onRecheck : null),
    pageRecord(scan.pages, label),
    scan.mode !== 'practice' && onReport ? reportBox(skipped.filter(o => ['looked_different', 'did_not_load'].includes(o.why)), label, { onReport, reportState }) : null,
  );
}

// What removing it does for the other person, from the steps library and its quoted official source.
export function noticeLine(entry) {
  const n = entry?.who_can_notice || 'unknown';
  return n === 'notifies' ? 'If you remove it, they are told.' : n === 'unlikely' ? 'Removing it is unlikely to be noticed.' : n === 'noticeable' ? 'If you remove it, they may notice.' : 'Removing it may alert them.';
}

function findingCard(f, { reveal, library, onAnswer, onOpen, onToggleReveal }) {
  const [title, means] = CODE_TEXT[f.code] || [f.code, ''];
  const entry = library[f.code];
  const infoId = `finding-${f.ref}`;
  registerInfo(infoId, {
    title,
    what: means,
    whatLabel: 'What this means',
    why: `${entry?.what_they_see || 'Removing it may alert the other person, because whatever this gave them stops.'} If now is not a good time, screenshot it and leave it.`,
    whyLabel: 'If you remove it',
    tech: `${HOW[f.howFound] || 'Read by code'}. Finding type: ${f.code}. Only this type, and your answer below, can ever be sent to the cloud, and only if plan help is on.${entry?.notice_source ? ` Source: ${entry.notice_source.title}: “${entry.notice_source.quote}”` : ''}`,
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
    h('p', { class: 'caution-line' }, cautionIcon(), h('span', { text: noticeLine(entry) })),
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

// The words on each page Spare Key read, with the date and time: a record for the person and an advocate. It is kept
// only in this browser session and in a locked copy the person saves. Folded, because it shows names in full.
function pageRecord(pages, label) {
  if (!pages?.length) return null;
  const when = iso => new Date(iso).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return h('details', { class: 'checked-list page-record' },
    h('summary', { text: `The words on each page, as read (${pages.length})` }),
    h('p', { class: 'muted', text: 'A dated record of what each settings page said when Spare Key read it. It shows names in full. Save a locked copy to keep it; screenshots are still the stronger record, because they show the page itself.' }),
    ...pages.map(p => h('details', { class: 'later' },
      h('summary', { text: `${label(p.check)}, ${when(p.at)}` }),
      h('pre', { class: 'page-text', text: [p.url, p.title, '', p.text, p.cut ? '\n(The page had more text than Spare Key keeps.)' : ''].join('\n') }))));
}

// Opt-in: tell the builder, anonymously, that some pages looked different, so the readers can be fixed for everyone
// through Remote Config. Nothing is sent unless the person presses the button, and the box says exactly what goes.
function reportBox(broken, label, { onReport, reportState }) {
  if (!broken.length) return null;
  registerInfo('layout-report', {
    title: 'Telling Spare Key a page looked different',
    what: 'Sites change their pages. When a page looks different, Spare Key can be fixed for everyone without an update, once the builder knows which page.',
    why: 'Only the check’s name, the reason, Spare Key’s version and today’s date are sent. No page text, no address, no account. Nothing is sent unless you press the button.',
    tech: 'One document per page in Cloud Firestore’s layout_reports, which its rules make create-only: no one can read them from a browser. It is shown under What left this computer.',
  });
  return h('section', { class: 'report-box', 'aria-labelledby': 'report-title' },
    h('div', { class: 'with-info' }, h('h2', { id: 'report-title', text: 'Help fix these pages' }), infoButton('layout-report', 'About telling Spare Key')),
    h('p', { text: `${broken.length === 1 ? 'One page' : `${broken.length} pages`} looked different: ${broken.map(o => label(o.id)).join(', ')}. You can tell Spare Key, anonymously, so it can be fixed for everyone.` }),
    reportState === 'sent' ? h('p', { class: 'muted', role: 'status', text: 'Sent. Thank you.' })
      : reportState === 'failed' ? h('p', { class: 'muted', role: 'status', text: 'It could not be sent just now. Nothing was sent.' })
        : h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: () => onReport(broken) }, 'Tell Spare Key (anonymous)'));
}

// Reasons a second try can fix: the person signs in or confirms it is them, or the page loads this time.
const RETRY = ['signed_out', 'needs_password', 'did_not_load', 'stopped'];

function notChecked(skipped, label, partial = [], onRecheck = null) {
  const again = skipped.filter(o => RETRY.includes(o.why) && o.service !== 'chrome');
  registerInfo('not-checked', {
    title: 'Not checked',
    what: 'These are the places Spare Key did not read this time, and the services it does not cover yet.',
    why: 'Someone could still have access through any of them. The guides below show how to check each one yourself.',
  });
  return h('section', { class: 'group not-checked', 'aria-labelledby': 'g-not-checked' },
    h('div', { class: 'with-info' }, h('h2', { id: 'g-not-checked', text: `Not checked (${skipped.length + partial.length + 1})` }), infoButton('not-checked', 'About Not checked')),
    h('ul', { class: 'plain-list' },
      skipped.map(o => h('li', {}, h('strong', { text: label(o.id) }), h('span', { text: (WHY[o.why] || WHY.did_not_load)(serviceName(o.service)) }))),
      // Checked only in part: what was read is in the list above, but some may be missing.
      partial.map(o => h('li', {}, h('strong', { text: `${label(o.id)}, in part` }), h('span', { text: 'Spare Key read some of this page but may have missed some. Open it and look for anyone or anything you do not know. It is in your plan too.' }))),
      h('li', {}, h('strong', { text: 'Not covered yet' }), h('span', { text: `${UNCHECKED.services}. How to check each one yourself:` }),
        h('ul', { class: 'guides' }, UNCHECKED.guides.map(g => h('li', {}, h('a', { href: g.url, target: '_blank', rel: 'noopener noreferrer', text: g.title })))))),
    onRecheck && again.length
      ? h('button', { type: 'button', class: 'btn btn-secondary btn-block', 'data-recheck': '', onclick: () => onRecheck(again.map(o => o.id)) },
        again.length === 1 ? `Check ${label(again[0].id).charAt(0).toLowerCase()}${label(again[0].id).slice(1)} again` : `Check just these ${again.length} again`)
      : null);
}
