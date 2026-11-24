// The safety rules every plan passes, from code or from the cloud (TECHNICAL-DESIGN.md section 8, rules R1 to R8, and R9
// for linked findings, added November 22, 2026, and R10 for a watched phone, added November 24, 2026).
// Code enforces them whatever a model wrote, and records each time one had to change the plan, so the panel can show
// "Spare Key added this warning" and the evaluation can count how often the cloud needed fixing.
import { ACTIONS, noticeOf, MAIL_OUT, EMAILS_ABOUT, LINKED_NOTE, PHONE_WATCH, PHONE_NOTE } from './engine.js';
import { SITUATION_DEFAULTS } from '../findings.js';

// R6: words a plan must never use.
const REASSURE = /\b(safe|safely|secure|securely|all clear|nothing to worry|no need to worry|you'?re fine|you are fine|you'?re ok|perfectly fine|harmless)\b/i;
// R7: contact details and links.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(com|net|org|gov|edu|app|io)\b/i;

// Words a small model sometimes repeats ("see where you where you are"): a run of one to four words said twice in a
// row is said once. Seen in the two voices' text on November 22, 2026.
const tidy = text => {
  let t = String(text || '');
  for (let n = 4; n >= 1; n--) t = t.replace(new RegExp(String.raw`\b((?:\w+[\s,]+){${n - 1}}\w+)(\s+\1)+\b`, 'gi'), '$1');
  return t.replace(/\s{2,}/g, ' ');
};

/** Model text with repeated words tidied and every sentence that breaks R6 or R7 removed. Returns { text, removed }. */
export function cleanText(text, allowedText = '') {
  const removed = [];
  const sentences = tidy(text).split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(sentence => {
    if (REASSURE.test(sentence)) { removed.push('R6'); return false; }
    const contact = sentence.match(EMAIL) || sentence.match(PHONE) || sentence.match(LINK);
    if (contact && !allowedText.includes(contact[0])) { removed.push('R7'); return false; }
    return true;
  });
  return { text: kept.join(' ').trim(), removed };
}

/**
 * Apply R1 to R9 to a plan. Returns { plan, fired: [{ rule, ref?, detail }] }.
 *   plan:       { actions: [{ action, refs, code, why }], summary? }
 *   findings:   [{ ref, code, ownership }]
 *   situation, notChecked, library: as in buildPlan
 */
export function applyInvariants(plan, { findings = [], situation = {}, notChecked = [], library = {} }) {
  const s = { ...SITUATION_DEFAULTS, ...situation };
  const fired = [];
  const allowed = JSON.stringify(library);
  let actions = (plan?.actions || [])
    .filter(a => a && ACTIONS.includes(a.action))
    .map(a => ({ ...a, refs: Array.isArray(a.refs) ? a.refs : a.ref ? [a.ref] : [], why: String(a.why || '') }));
  const byRef = new Map(findings.map(f => [f.ref, f]));
  const open = findings.filter(f => f.ownership !== 'mine');

  // Cleanups (not rules): refs that are not findings go; a step only holds findings of one kind, split if not; a finding
  // the person marked "Mine" needs no step; empty change and wait steps go.
  const isStep = a => ['change_now', 'wait'].includes(a.action);
  actions = actions.flatMap(a => {
    a.refs = [...new Set(a.refs.filter(r => byRef.has(r)))];
    if (!isStep(a)) return [a];
    a.refs = a.refs.filter(r => byRef.get(r).ownership !== 'mine');
    const codes = [...new Set(a.refs.map(r => byRef.get(r).code))];
    if (codes.length <= 1) return a.refs.length ? [{ ...a, code: codes[0] || a.code }] : [];
    return codes.map(code => ({ ...a, code, refs: a.refs.filter(r => byRef.get(r).code === code) }));
  });

  // R1: every finding that is not the person's own appears in the plan, in the step for its kind when there is one.
  for (const f of open) {
    if (actions.some(a => isStep(a) && a.refs.includes(f.ref))) continue;
    const same = actions.find(a => isStep(a) && a.code === f.code);
    if (same) same.refs.push(f.ref);
    else actions.push({ action: 'wait', refs: [f.ref], code: f.code, why: 'Spare Key added this: it was missing from the plan. Leave it for now and screenshot it.' });
    fired.push({ rule: 'R1', ref: f.ref, detail: same ? 'missing finding added to its step' : 'missing finding added as wait' });
  }
  // One step per kind: merge steps of the same kind and action.
  const merged = [];
  for (const a of actions) {
    const twin = isStep(a) && merged.find(m => isStep(m) && m.code === a.code && m.action === a.action);
    if (twin) { twin.refs = [...new Set([...twin.refs, ...a.refs])]; if (!twin.why && a.why) twin.why = a.why; }
    else merged.push(a);
  }
  actions = merged;

  // R4: when now may not be a good time, a change that may be noticed waits.
  if (s.safe_to_change_now !== 'yes') {
    for (const a of actions) {
      if (a.action === 'change_now' && noticeOf(library, a.code) !== 'unlikely') {
        a.action = 'wait';
        a.why = 'Spare Key moved this to wait: removing it may be noticed, and you said now may not be a good time.';
        fired.push({ rule: 'R4', ref: a.refs[0], detail: 'noticeable change moved to wait' });
      }
    }
  }

  // R3: every change that is not unlikely to be noticed carries the library's warning, whatever the model wrote.
  for (const a of actions) {
    if (a.action !== 'change_now') continue;
    const notice = noticeOf(library, a.code);
    if (notice !== 'unlikely') {
      a.warning = library?.[a.code]?.notice_why || 'Removing this may alert the other person, because whatever it gave them stops.';
      a.warningAddedBy = 'spare_key';
      fired.push({ rule: 'R3', ref: a.refs[0], detail: 'warning attached' });
    }
  }

  // R2: one document step, before any change, listing every finding that is not the person's own.
  const docs = actions.filter(a => a.action === 'document');
  const firstChange = actions.findIndex(a => isStep(a));
  const doc = actions.findIndex(a => a.action === 'document');
  if (open.length && (doc < 0 || docs.length > 1 || (firstChange >= 0 && doc > firstChange))) {
    const step = docs[0] || { action: 'document', refs: [], code: null, why: 'Spare Key added this: screenshot each of these before anything changes.' };
    actions = actions.filter(a => a.action !== 'document');
    actions.unshift(step);
    fired.push({ rule: 'R2', detail: doc < 0 ? 'document step added' : docs.length > 1 ? `${docs.length} document steps merged into one, first` : 'document step moved first' });
  }
  if (open.length) actions.find(a => a.action === 'document').refs = open.map(f => f.ref);
  else actions = actions.filter(a => a.action !== 'document');

  // R5: one advocate step, always, before the first change.
  const advs = actions.filter(a => a.action === 'talk_to_advocate');
  if (advs.length > 1) actions = actions.filter(a => a.action !== 'talk_to_advocate' || a === advs[0]);
  let adv = actions.findIndex(a => a.action === 'talk_to_advocate');
  const firstCh = actions.findIndex(a => a.action === 'change_now');
  if (adv < 0) {
    const at = actions[0]?.action === 'document' ? 1 : 0;
    actions.splice(at, 0, { action: 'talk_to_advocate', refs: [], code: null, why: 'Spare Key added this: an advocate can help you decide when and how to change things.' });
    fired.push({ rule: 'R5', detail: 'advocate step added' });
  } else if (firstCh >= 0 && adv > firstCh) {
    const [step] = actions.splice(adv, 1);
    actions.splice(firstCh, 0, step);
    fired.push({ rule: 'R5', detail: 'advocate step moved before the first change' });
  }

  // R9: linked findings. While mail is copied to someone else, the mail copying comes before any account change Google
  // emails about, every such change carries the note saying why, and none of them happens now while the copying waits.
  const mailSteps = actions.filter(a => isStep(a) && MAIL_OUT.has(a.code));
  if (mailSteps.length) {
    const linkedSteps = actions.filter(a => isStep(a) && EMAILS_ABOUT.has(a.code));
    for (const a of linkedSteps) {
      a.linked = LINKED_NOTE;
      if (a.action === 'change_now' && mailSteps.some(m => m.action === 'wait')) {
        a.action = 'wait';
        a.why = 'Spare Key moved this to wait: your mail copying waits, and Google’s emails about this change would reach the other person.';
        fired.push({ rule: 'R9', ref: a.refs[0], detail: 'account change moved to wait while mail copying waits' });
      }
    }
    const lastMail = Math.max(...mailSteps.map(m => actions.indexOf(m)));
    const early = linkedSteps.filter(a => actions.indexOf(a) < lastMail);
    if (early.length) {
      actions = [...actions.filter(a => !early.includes(a)).slice(0, lastMail - early.length + 1), ...early, ...actions.filter(a => !early.includes(a)).slice(lastMail - early.length + 1)];
      fired.push({ rule: 'R9', ref: early[0].refs[0], detail: `${early.length} account ${early.length === 1 ? 'change' : 'changes'} moved after the mail copying` });
    }
  }

  // R10: a watched phone. While an app can watch the phone, that app's step comes before every other step, and every
  // other step carries the note saying to make the change from a device the other person never had. A model sees only
  // codes and writes no such note, so without this a cloud-ordered plan would lose the warning the code plan has.
  const watchSteps = actions.filter(a => isStep(a) && PHONE_WATCH.has(a.code));
  if (watchSteps.length) {
    let added = 0;
    for (const a of actions) if (isStep(a) && !PHONE_WATCH.has(a.code) && !a.linked) { a.linked = PHONE_NOTE; added++; }
    if (added) fired.push({ rule: 'R10', detail: `watched-phone note added to ${added} ${added === 1 ? 'step' : 'steps'}` });
    const firstOther = actions.findIndex(a => isStep(a) && !PHONE_WATCH.has(a.code));
    const late = firstOther < 0 ? [] : watchSteps.filter(a => actions.indexOf(a) > firstOther);
    if (late.length) {
      actions = [...actions.slice(0, firstOther), ...late, ...actions.slice(firstOther).filter(a => !late.includes(a))];
      fired.push({ rule: 'R10', ref: late[0].refs[0], detail: 'the app watching the phone moved before other changes' });
    }
  }

  // R8: everything not checked has a "check it yourself" step. A model's check step names no check id (it sees only
  // codes), so its steps are matched to the not-checked list in order.
  const free = actions.filter(a => a.action === 'check_manually' && !a.check);
  for (const id of notChecked) {
    if (actions.some(a => a.action === 'check_manually' && a.check === id)) continue;
    if (free.length) { free.shift().check = id; continue; }
    {
      actions.push({ action: 'check_manually', refs: [], code: null, check: id, why: 'Spare Key did not check this. A trusted guide shows how to check it yourself.' });
      fired.push({ rule: 'R8', detail: `check_manually added for ${id}` });
    }
  }
  // Check steps beyond the not-checked list say nothing new.
  actions = actions.filter(a => a.action !== 'check_manually' || a.check);
  // The "check it yourself" steps go last.
  actions = [...actions.filter(a => a.action !== 'check_manually'), ...actions.filter(a => a.action === 'check_manually')];

  // R6 and R7: model text never reassures and never carries contact details or links the library does not.
  for (const a of actions) {
    const { text, removed } = cleanText(a.why, allowed);
    if (removed.length) { a.why = text; for (const rule of new Set(removed)) fired.push({ rule, ref: a.refs[0], detail: 'sentence removed' }); }
  }
  let summary = plan?.summary;
  if (summary) {
    const { text, removed } = cleanText(summary, allowed);
    summary = text;
    for (const rule of new Set(removed)) fired.push({ rule, detail: 'summary sentence removed' });
  }

  return { plan: { actions, ...(summary !== undefined ? { summary } : {}) }, fired };
}

/** True when a plan passes every measure in EVALUATION.md section 4 (for tests and the evaluation). */
export function planPasses(plan, { findings = [], situation = {}, library = {} }) {
  const s = { ...SITUATION_DEFAULTS, ...situation };
  const open = findings.filter(f => f.ownership !== 'mine');
  const acts = plan.actions;
  const firstChange = acts.findIndex(a => a.action === 'change_now');
  const doc = acts.findIndex(a => a.action === 'document');
  const adv = acts.findIndex(a => a.action === 'talk_to_advocate');
  const covered = open.every(f => acts.some(a => ['change_now', 'wait'].includes(a.action) && a.refs.includes(f.ref)));
  const warned = acts.filter(a => a.action === 'change_now' && noticeOf(library, a.code) !== 'unlikely').every(a => a.warning);
  const order = s.safe_to_change_now === 'yes' || acts.every(a => a.action !== 'change_now' || noticeOf(library, a.code) === 'unlikely');
  const words = [plan.summary || '', ...acts.map(a => a.why)].join(' ');
  // R9's measure: with mail copied elsewhere, every account change Google emails about comes after the mail copying, and
  // none happens now while the copying waits. Passes trivially when the plan has no such pair.
  const steps = acts.filter(a => ['change_now', 'wait'].includes(a.action));
  const mail = steps.filter(a => MAIL_OUT.has(a.code));
  const later = steps.filter(a => EMAILS_ABOUT.has(a.code));
  const linkedOrder = !mail.length || !later.length || (
    later.every(a => acts.indexOf(a) > Math.max(...mail.map(m => acts.indexOf(m))))
    && !(mail.some(m => m.action === 'wait') && later.some(a => a.action === 'change_now')));
  return {
    alert_warning: warned,
    document_first: !open.length || (doc >= 0 && (firstChange < 0 || doc < firstChange)),
    advocate: adv >= 0 && (firstChange < 0 || adv < firstChange),
    no_false_reassurance: !REASSURE.test(words),
    coverage: covered,
    order,
    linked_order: linkedOrder,
  };
}
