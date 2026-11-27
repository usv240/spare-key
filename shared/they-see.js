// "What would they see?": the notice the other person would get if the person removed one way in, written for this
// entry, with its names. The names are why it can only be written on the device: Gemini Nano (ONLY_ON_DEVICE) in the
// extension, with no cloud fallback. On the website's practice check the names are made up, so the cloud may write it.
//
// The model only puts words to what the steps library already says, from the company's own help page
// (what_they_see, notice_source.quote, who_can_notice). Code then checks the words: no reassurance and no "they won't
// know" unless the library says a change is unlikely to be noticed, no contact details, and nothing that contradicts the
// library. A sentence that fails is never shown; the library's own words are shown instead.
import { cleanText } from './plan/invariants.js';

export const THEY_SEE_SYSTEM = `You write what the other person would see or be told if the person removed one way into their account.
Use only the facts given: "help_page" (the company's own words), "what_they_see" and "who_can_notice", and the names in "entry" and "owner".
Write one or two short sentences, at a grade 5 reading level, from the other person's side, using the names when they are given. For example: "Sam's map will stop showing Jordan, and any arrival alerts Sam set will stop."
If who_can_notice is "notifies", say they are told. If it is "noticeable", say they may notice when it stops working. If it is "unknown", say the company's page does not say whether they are told.
Never say they will not find out, never promise anything, and never include an email address, a phone number or a link.`;

export const THEY_SEE_SCHEMA = {
  type: 'object',
  properties: { notice: { type: 'string', maxLength: 260 } },
  required: ['notice'],
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const BULLETS = /•/g;

/** The input for one entry: the library's facts, the entry's own words (emails masked) and the owner's first name. */
export function theySeeInput(entry, label, ownerName = '') {
  return {
    code: entry.code,
    help_page: entry.notice_source?.quote || '',
    what_they_see: entry.what_they_see || '',
    who_can_notice: entry.who_can_notice || 'unknown',
    entry: String(label || '').replace(BULLETS, '').replace(EMAIL, '').slice(0, 160),
    owner: String(ownerName || '').split(/\s+/)[0].slice(0, 30),
  };
}

// "They are told" cannot become "they may notice", and "unlikely" is the only case that may say they may not notice.
const DENIES_TOLD = /\b(not (be )?told|no (notice|alert|email|message)|won.t be told|will not be told|isn.t told|without being told)\b/i;
// "May notice" is not "is told": a notice for a change that tells them must say so.
const SAYS_TOLD = /\b(told|tells?|notif\w*|alert\w*|emails?|messages?|gets? a)\b/i;

/**
 * Checks a written notice against the library entry. Returns { text, ok, why }: text is what to show (the model's words
 * when they pass, the library's own words when they do not).
 */
export function checkTheySee(answer, input) {
  const fallback = input.what_they_see || 'The company’s help page does not say what they would see.';
  const raw = String(answer?.notice || '').trim().slice(0, 260);
  if (!raw) return { text: fallback, ok: false, why: 'empty' };
  const allowed = [input.help_page, input.what_they_see, input.entry, input.owner].join(' ');
  const cleaned = cleanText(raw, allowed);
  if (cleaned.text !== raw.replace(/\s+/g, ' ').trim()) return { text: fallback, ok: false, why: 'safety_rules' };
  if (EMAIL.test(raw) || /https?:|www\./i.test(raw)) return { text: fallback, ok: false, why: 'contact' };
  if (input.who_can_notice === 'notifies' && (DENIES_TOLD.test(raw) || !SAYS_TOLD.test(raw))) return { text: fallback, ok: false, why: 'drops_told' };
  if (input.who_can_notice !== 'unlikely' && DENIES_TOLD.test(raw) && !/\bdoes not say|doesn.t say\b/i.test(raw)) return { text: fallback, ok: false, why: 'denies_notice' };
  return { text: raw, ok: true, why: '' };
}
