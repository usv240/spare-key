// "What would they see?": the notice the other person would get if the person removed one way in, written for this
// entry, with the other person's name. The name is why it can only be written on the device: Gemini Nano
// (ONLY_ON_DEVICE) in the extension, with no cloud fallback. On the website's practice check the names are made up, so
// the cloud may write it.
//
// Roles are fixed in code, not left to the model. The first measured run (November 26, docs/evidence/
// they-see-eval-v1-roles.json) gave Gemini Nano both names, and it swapped them in about 11 of 18 notices ("Jordan may
// notice that Sam disappears from their map", when Sam is the one who would see Jordan disappear). Now the person is
// always "you" and their name is never given; the other person's name is read from the entry by code, and the model
// is told only that one name. Code then checks the words against the steps library (what_they_see,
// notice_source.quote, who_can_notice): no reassurance, no "they won't find out" unless the library says a change is
// unlikely to be noticed, no contact details, the other person named when there is one, and "they are told" kept as
// "they are told". A notice that fails is never shown; the library's own words are shown instead.
import { cleanText } from './plan/invariants.js';

export const THEY_SEE_SYSTEM = `You write what the other person would see or be told if you removed one way into your account.
"You" is always the person making the change. "them" is the other person: use that name, or "the other person" when it is "the other person". Never use any other name, and never call the other person "you".
Use only the facts given: "help_page" (the company's own words), "what_they_see", "who_can_notice" and "entry" (what the settings page shows).
Write one or two short sentences, at a grade 5 reading level, about what them sees or is told. For example: "Sam's map stops showing you, and any arrival alerts Sam set for you stop."
If who_can_notice is "notifies", say that them is told. If it is "noticeable", say them may notice when it stops working. If it is "unknown", say the company's page does not say whether them is told.
Never say they will not find out, never promise anything, and never include an email address, a phone number or a link.`;

export const THEY_SEE_SCHEMA = {
  type: 'object',
  properties: { notice: { type: 'string', maxLength: 260 } },
  required: ['notice'],
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MASKED = /\S*•+\S*/g;
const NOT_NAMES = new Set(['link', 'matches', 'google', 'shared', 'forwards', 'you', 'adult', 'teen', 'member', 'verified', 'added']);

/** The other person's name as the entry shows it ("Sam Porter · Adult", "Sam's Echo Dot"), or '' when it shows none. */
export function otherName(label) {
  const first = String(label || '').split('·')[0].trim();
  const owned = first.match(/^([A-Z][a-z]{1,20})['’]s\b/);
  if (owned) return owned[1];
  const name = first.match(/^([A-Z][a-z]{1,20})(?: ([A-Z][a-z]{1,20}))?$/);
  return name && !NOT_NAMES.has(name[1].toLowerCase()) ? name[1] : '';
}

/** The model's input for one entry: the library's facts, the entry's words (no emails), and the other person's name. */
export function theySeeInput(entry, label) {
  return {
    code: entry.code,
    help_page: entry.notice_source?.quote || '',
    what_they_see: entry.what_they_see || '',
    who_can_notice: entry.who_can_notice || 'unknown',
    entry: String(label || '').replace(EMAIL, '').replace(MASKED, '').replace(/\s*·\s*(·\s*)*/g, ' · ').replace(/^\s*·\s*|\s*·\s*$/g, '').slice(0, 160),
    them: otherName(label) || 'the other person',
  };
}

// "They are told" cannot become "they may notice", and only "unlikely" may say they may not notice.
const DENIES_TOLD = /\b(not (be )?told|no (notice|alert|email|message)|won.t be told|will not be told|isn.t told|without being told|won.t (know|notice|find out)|will not (know|notice|find out)|never (know|notice|find out))\b/i;
const TOLD_WORDS = '(told|tells?|notif\\w*|alert\\w*|emails?|messages?|gets?|receives?)';

/**
 * Checks a written notice. `ownerName` is the person's own name, which the model is never given and must never use.
 * Returns { text, ok, why }: the model's words when they pass, the library's own words when they do not.
 */
export function checkTheySee(answer, input, ownerName = '') {
  const fallback = input.what_they_see || 'The company’s help page does not say what they would see.';
  const raw = String(answer?.notice || '').trim().slice(0, 260);
  const no = why => ({ text: fallback, ok: false, why });
  if (!raw) return no('empty');
  const allowed = [input.help_page, input.what_they_see, input.entry, input.them].join(' ');
  if (cleanText(raw, allowed).text !== raw.replace(/\s+/g, ' ').trim()) return no('safety_rules');
  if (EMAIL.test(raw) || /https?:|www\./i.test(raw)) return no('contact');
  const them = input.them && input.them !== 'the other person' ? input.them : '';
  // Roles: the other person is named when the page names them, and the person's own name never appears.
  if (them && !new RegExp(`\\b${them}\\b`).test(raw)) return no('other_person_not_named');
  for (const part of String(ownerName || '').split(/\s+/).filter(w => w.length > 1)) if (new RegExp(`\\b${part}\\b`, 'i').test(raw)) return no('uses_your_name');
  // Three more swaps read by hand in the second run (added after reading it, and applied to the same answers):
  // speaking to the other person ("Sam, your Echo Dot ..."), turning the person's own location into the other person's
  // ("the link stops showing where the other person is"), and an app or thing that "may notice" (only a person can).
  if (them && new RegExp(`^\\s*${them}\\s*,`).test(raw)) return no('speaks_to_them');
  if (/\b(where (the other person|they|he|she) (is|are)|(the other person|their|his|her)['’]?s? (own )?location)\b/i.test(raw) || (them && new RegExp(`\\b${them}['’]s location\\b|where ${them} is\\b`).test(raw))) return no('location_swapped');
  // The word just before "may notice" is the one doing the noticing: a name that is not the other person's (an app,
  // "TrailMate"), or a thing, is refused; "they", "the other person", "and will notice" and the rest are fine.
  const things = /^(app|apps|device|devices|phone|echo|dot|link|filter|it|google|gmail|amazon)$/i;
  for (const m of raw.matchAll(/\b([\w']+) (?:may|might|will|would|could|can)? ?(?:also |only |still )?notice\b/g)) {
    const w = m[1].replace(/['’]s$/, '');
    const isThem = them && w === them;
    if (!isThem && ((/^[A-Z]/.test(w) && !/^(They|The|Whoever|Anyone|Someone|And|But|So)$/.test(w)) || (things.test(w) && !/\bwhoever\b[^.]*$/i.test(raw.slice(0, m.index))))) return no('not_a_person_notices');
  }
  // The notice is about the other person: "you will get an email" or "your inbox stops" is the wrong side.
  if (new RegExp(`\\byou (will |would |may |might )?${TOLD_WORDS}\\b`, 'i').test(raw) || /\byou (may|might|will) notice\b/i.test(raw)) return no('wrong_side');
  const subject = them ? `(${them}|they|them)` : '(they|them|the other person|whoever|anyone)';
  const told = new RegExp(`\\b${subject}\\b[^.]{0,60}\\b${TOLD_WORDS}\\b|\\b${TOLD_WORDS}\\b[^.]{0,40}\\b${subject}\\b`, 'i');
  if (input.who_can_notice === 'notifies' && (DENIES_TOLD.test(raw) || !told.test(raw))) return no('drops_told');
  if (input.who_can_notice !== 'unlikely' && DENIES_TOLD.test(raw) && !/\b(does not|doesn.t) say\b/i.test(raw)) return no('denies_notice');
  return { text: raw, ok: true, why: '' };
}
