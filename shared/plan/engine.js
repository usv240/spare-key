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
// The second half of R9. Google also sends its security alerts to the recovery email and phone. While one of those may
// belong to someone else, signing a device out or changing 2-Step Verification would tell them, so the recovery email
// and phone are dealt with first, and those changes do not happen now while the recovery ones wait.
export const ALERTS_TO = new Set(['google.recovery.email_other', 'google.recovery.phone_unconfirmed']);
export const ALERTED = new Set(['google.2sv.other_device', 'google.devices.other']);
export const ALERT_NOTE = 'Google sends security alerts to your recovery email and phone. Someone else may hold one of yours, so they could be told about this change. Deal with the recovery email and phone first.';
// An app that can watch the phone sees what is done on that phone, including changes to accounts (the phone check).
// A rooted phone counts too: an app on it can watch the phone and hide from this check.
export const PHONE_WATCH = new Set(['phone.app.control', 'phone.app.accessibility', 'phone.app.device_admin', 'phone.app.notifications', 'phone.app.messages', 'phone.rooted']);
export const PHONE_NOTE = 'An app on your phone may be able to see what you do on it. Make other changes from a phone or computer the other person has never had.';
export const PHONE_CALL_NOTE = 'An app on this phone may be able to see your calls and texts. Call or text from another phone if you can.';
// Rule R11 (added November 25, 2026, from a simulated advocate review). When the person lives with the other person, or
// did not say, a change the library says sends the other person a notice, and an app watching the phone, wait even when
// now is a good time: "now is a good time" is one quick answer, and the person may still be within reach.
export const TOGETHER_NOTE = 'They would be told about this change. You may still be within their reach, so leave it until you and an advocate have a plan for that day.';
// Changes that cut off access all at once (a sign-out, a new password, a new recovery address). Planned as one day.
export const CUTOFF = new Set(['google.devices.other', 'google.2sv.other_device', 'google.recovery.email_other', 'google.recovery.phone_unconfirmed']);
export const CUTOFF_NOTE = 'This cuts off their access all at once, and they may notice within hours. Plan the day with an advocate, and do these changes together.';
// Shared children: their devices can share where they are, and travel between homes.
export const KIDS_CHECK = 'kids_devices';
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
  const apart = s.living === 'apart';
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
  const rank = code => (PHONE_WATCH.has(code) ? -1 : MAIL_OUT.has(code) ? 0 : ALERTS_TO.has(code) ? 1 : TAKEOVER.has(code) ? 2 : 3);
  const codes = [...byCode.keys()].sort((a, b) => rank(a) - rank(b));
  const mailOut = codes.some(c => MAIL_OUT.has(c));
  const watched = codes.some(c => PHONE_WATCH.has(c));
  const alertsTo = codes.some(c => ALERTS_TO.has(c));
  for (const code of codes) {
    const refs = byCode.get(code);
    const notice = noticeOf(library, code);
    const linked = mailOut && EMAILS_ABOUT.has(code) ? { linked: LINKED_NOTE } : alertsTo && ALERTED.has(code) ? { linked: ALERT_NOTE } : watched && !PHONE_WATCH.has(code) ? { linked: PHONE_NOTE } : {};
    const cutoff = CUTOFF.has(code) ? { cutoff: CUTOFF_NOTE } : {};
    if (goodTime && !apart && (notice === 'notifies' || PHONE_WATCH.has(code))) {
      actions.push({ action: 'wait', refs, code, ...linked, why: TOGETHER_NOTE });
    } else if (notice === 'unlikely' && TAKEOVER.has(code) && goodTime) {
      actions.push({ action: 'change_now', refs, code, ...linked, why: 'This gives someone a quiet way into your account, and changing it is unlikely to be noticed.' });
    } else if (goodTime) {
      actions.push({ action: 'change_now', refs, code, ...linked, ...cutoff, why: 'You said now is a good time. Removing this may be noticed, so read the warning first.' });
    } else {
      actions.push({ action: 'wait', refs, code, ...linked, why: notice === 'unlikely'
        ? 'Changing this is unlikely to be noticed, but you said now may not be a good time. Keep your record of it from step 1, and come back to it.'
        : 'Removing this may be noticed. Leave it as it is until a better time, after talking to an advocate.' });
    }
  }

  // 5. Everything that was not checked: how to check it yourself. Shared children first: their devices.
  if (s.children_shared === 'yes') actions.push({ action: 'check_manually', refs: [], code: null, check: KIDS_CHECK, why: 'Devices that go with your children between homes can share where they are. Check them, or ask an advocate to help.' });
  for (const id of notChecked) actions.push({ action: 'check_manually', refs: [], code: null, check: id, why: 'Spare Key did not check this. A trusted guide shows how to check it yourself.' });

  return { actions };
}
