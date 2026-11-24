// The plan built by code (TECHNICAL-DESIGN.md section 8). No model: the same codes and answers always give the same
// plan, on this computer, with the cloud off. The cloud plan (extension/src/cloud/plan.js) may reorder and explain it,
// and every plan, from code or the cloud, then passes the safety rules in invariants.js.
//
// Input is the cloud-safe view of a scan (codes, refs, enums), so a hotline app can build the same plan from codes alone
// (the Steps API and the spare-key-plan package use this file).
import { SITUATION_DEFAULTS } from '../findings.js';

export const ACTIONS = ['document', 'talk_to_advocate', 'change_now', 'wait', 'check_manually'];

// Access paths that let someone take over the account or read mail quietly. Changing them is in "change now" only when
// the steps library says the other person is unlikely to notice and the person says now is a good time.
export const TAKEOVER = new Set(['gmail.delegate', 'gmail.filter.hides', 'google.apps.full_access', 'google.recovery.email_other']);

// Linked findings (rule R9). While the person's mail is copied to someone else, any email Google sends about a change to
// the account (a security alert, a code) would reach them too. So the mail copying is dealt with first, and an account
// change does not happen now while the mail copying waits.
export const MAIL_OUT = new Set(['gmail.forwarding.external', 'gmail.filter.forwards', 'gmail.delegate']);
export const EMAILS_ABOUT = new Set(['google.recovery.email_other', 'google.recovery.phone_unconfirmed', 'google.2sv.other_device', 'google.devices.other']);
// An app that can watch the phone sees what is done on that phone, including changes to accounts (the phone check).
export const PHONE_WATCH = new Set(['phone.app.control', 'phone.app.accessibility', 'phone.app.device_admin', 'phone.app.notifications', 'phone.app.messages']);
export const PHONE_NOTE = 'An app on your phone may be able to see what you do on it. Make other changes from a phone or computer the other person has never had.';
export const LINKED_NOTE = 'Your mail is copied to someone else. Any email Google sends you about this change, like a security alert or a code, would reach them too. Deal with the mail copying first.';

/** How likely a change is to be noticed, from the library. Unknown counts as noticeable. */
export const noticeOf = (library, code) => {
  const n = library?.[code]?.who_can_notice;
  return ['notifies', 'noticeable', 'unlikely', 'unknown'].includes(n) ? n : 'unknown';
};

/**
 * findings:   [{ ref, code, ownership: 'mine' | 'not_mine' | 'unsure' | null, recency }]
 * situation:  { living, safe_to_change_now, children_shared, has_advocate } (missing answers take the most cautious value)
 * notChecked: check or service ids that were not checked
 * library:    code -> steps library entry
 * Returns { actions: [{ action, refs, code, why }] }. Every finding that is not marked "Mine" is in it.
 */
export function buildPlan({ findings = [], situation = {}, notChecked = [], library = {} }) {
  const s = { ...SITUATION_DEFAULTS, ...situation };
  const goodTime = s.safe_to_change_now === 'yes';
  const open = findings.filter(f => f.ownership !== 'mine');
  const actions = [];

  // 1. Screenshot everything that is not yours, or not sure, before anything changes.
  if (open.length) actions.push({ action: 'document', refs: open.map(f => f.ref), code: null, why: 'A record of what is set up now helps you and an advocate, and it is gone once a setting changes.' });

  // 2. An advocate, always, before any change that may be noticed.
  actions.push({ action: 'talk_to_advocate', refs: [], code: null, why: s.has_advocate === 'yes'
    ? 'Go over this plan with your advocate before changing anything that may be noticed.'
    : 'An advocate can help you decide when and how to change things. The hotline is free and open all day, every day.' });

  // 3 and 4. One step per kind of finding (three signed-in devices are one step): change now, or wait.
  const byCode = new Map();
  for (const f of open) byCode.set(f.code, [...(byCode.get(f.code) || []), f.ref]);
  // Mail copied elsewhere first (R9), then quiet ways into the account, then the rest.
  // An app watching the phone comes before everything: whoever installed it sees every other change made on that phone.
  const rank = code => (PHONE_WATCH.has(code) ? -1 : MAIL_OUT.has(code) ? 0 : TAKEOVER.has(code) ? 1 : 2);
  const codes = [...byCode.keys()].sort((a, b) => rank(a) - rank(b));
  const mailOut = codes.some(c => MAIL_OUT.has(c));
  const watched = codes.some(c => PHONE_WATCH.has(c));
  for (const code of codes) {
    const refs = byCode.get(code);
    const notice = noticeOf(library, code);
    const linked = mailOut && EMAILS_ABOUT.has(code) ? { linked: LINKED_NOTE } : watched && !PHONE_WATCH.has(code) ? { linked: PHONE_NOTE } : {};
    if (notice === 'unlikely' && TAKEOVER.has(code) && goodTime) {
      actions.push({ action: 'change_now', refs, code, ...linked, why: 'This gives someone a quiet way into your account, and changing it is unlikely to be noticed.' });
    } else if (goodTime) {
      actions.push({ action: 'change_now', refs, code, ...linked, why: 'You said now is a good time. Removing this may be noticed, so read the warning first.' });
    } else {
      actions.push({ action: 'wait', refs, code, ...linked, why: notice === 'unlikely'
        ? 'Changing this is unlikely to be noticed, but you said now may not be a good time. Screenshot it and come back to it.'
        : 'Removing this may be noticed. Screenshot it and leave it until a better time, after talking to an advocate.' });
    }
  }

  // 5. Everything that was not checked: how to check it yourself.
  for (const id of notChecked) actions.push({ action: 'check_manually', refs: [], code: null, check: id, why: 'Spare Key did not check this. A trusted guide shows how to check it yourself.' });

  return { actions };
}
