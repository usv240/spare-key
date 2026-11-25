// "In your own words": what a person types about their own situation, turned into finding codes and answers on the
// device. The words name people, so they never leave the device: Gemini Nano reads them where it can (ONLY_ON_DEVICE),
// and this file's keyword reader where it cannot. Only the codes go on, like any other finding, and only as codes.
//
// A told finding can add a step, never take one away, and never mark anything as the person's own: whatever it reads,
// the plan made from the settings pages stays as it was.
import { CODES } from './findings.js';

// The ways in a person's words can name. Each is a code Spare Key already has a library entry for.
export const TOLD_CODES = [
  'device.given_by_other', 'carrier.plan.holder_other', 'phone.app.control', 'tracker.alert',
  'apple.findmy.sharing', 'apple.family.organizer_other', 'apple.account.device_other', 'life360.circle.member',
  'maps.sharing.person', 'gmail.forwarding.external', 'google.recovery.email_other', 'google.recovery.phone_unconfirmed',
  'google.family.manager_other', 'google.family.member', 'google.devices.other', 'amazon.household.adult', 'amazon.device.other',
];
export const TOLD_LIVING = ['together', 'apart', 'unclear'];
export const TOLD_CHILDREN = ['yes', 'no', 'unclear'];
export const TOLD_MAX_CHARS = 1500;

export const TOLD_SYSTEM = `You read what a person wrote about their own situation as they leave an abusive partner, and list the ways the other person can still get in.
Answer only with codes from the list, and only when the words clearly say that way in is there now. Leave out anything the person says is over, turned off or deleted, and anything that is only a worry or a guess ("I think", "somehow").
device.given_by_other: the other person bought, gave or set up a phone, tablet or computer the person or a child uses.
carrier.plan.holder_other: the phone plan is in the other person's name, or they pay for it.
phone.app.control: an app on the phone that the person did not install, or that the other person put there.
tracker.alert: the phone has warned about an AirTag or another tracker moving with the person.
apple.findmy.sharing: the other person can see the person's location in Find My.
apple.family.organizer_other: the other person runs (organizes) the person's Apple family.
apple.account.device_other: a device the other person has is signed in to the person's Apple account or iCloud.
life360.circle.member: the other person, or someone close to them, is in a Life360 circle with the person.
maps.sharing.person: the person shares their location with the other person in Google Maps.
gmail.forwarding.external: the person's mail is forwarded to the other person.
google.recovery.email_other: the other person's email is the recovery email on the person's Google account.
google.recovery.phone_unconfirmed: the other person's number is the recovery phone on the person's Google account.
google.family.manager_other: the other person manages the person's Google family group.
google.family.member: the other person, or someone close to them, is a member of the person's Google family group.
google.devices.other: a computer or phone the other person has is still signed in to the person's Google account.
amazon.household.adult: the other person is in the person's Amazon household.
amazon.device.other: an Echo or other Amazon device is set up on the other person's account, or the person's account is on a device the other person has.
Most messages name one way in, some name none. If the words do not clearly name a way in, return an empty list: never list codes just because they might apply.
Also say whether the words tell you they live together ("together") or apart ("apart"), and whether they share children ("yes" or "no"). Use "unclear" when the words do not say.`;

export const TOLD_SCHEMA = {
  type: 'object',
  properties: {
    codes: { type: 'array', items: { type: 'string', enum: TOLD_CODES } },
    living: { type: 'string', enum: TOLD_LIVING },
    children_shared: { type: 'string', enum: TOLD_CHILDREN },
  },
  required: ['codes', 'living', 'children_shared'],
};

// The keyword reader: code only, for when Gemini Nano is not on the device. Each rule is a code and the words that
// name it; a sentence that says the way in is over ("turned off", "deleted", "used to") is skipped.
const RULES = [
  ['device.given_by_other', /\b(bought|got|gave|given|set ?up|setup)\b[^.]{0,40}\b(phone|iphone|samsung|tablet|ipad|laptop|computer)\b|\b(phone|tablet|ipad|laptop|computer)\b[^.]{0,30}\b(he|she|they) (bought|gave|set up)/i],
  ['carrier.plan.holder_other', /\b(pays?|paying) (for )?(the |my )?(phone|cell)|\b(pays?|paying) (for )?my (phone |cell )?(plan|bill)\b|\bmy phone (bill|plan)\b[^.]{0,30}\b(his|her|their) name|\b(his|her|their) (family |phone )?plan\b|\bon (his|her|their) [a-z-]* ?(family )?plan\b|\bfamily plan with\b/i],
  ['phone.app.control', /\b(installed|put)\b[^.]{0,30}\bapp\b|\bapp\b[^.]{0,40}\b(didn.t|did not) install/i],
  ['tracker.alert', /\b(airtag|tracker)\b/i],
  ['apple.findmy.sharing', /\bfind my\b/i],
  ['apple.family.organizer_other', /\b(organizer|organizes)\b[^.]{0,40}\b(apple|icloud|family)\b|\b(apple|icloud) family\b[^.]{0,60}\borganiz/i],
  ['apple.account.device_other', /\b(signed|logged) (in|into)\b[^.]{0,20}\b(apple id|apple account|icloud)\b/i],
  ['life360.circle.member', /\blife ?360\b/i],
  ['maps.sharing.person', /\b(share|sharing)\b[^.]{0,30}\blocation\b|\blocation sharing\b/i],
  ['gmail.forwarding.external', /\bforward(s|ed|ing)?\b[^.]{0,40}\b(mail|email|gmail)\b|\b(mail|email|gmail)\b[^.]{0,30}\bforward/i],
  ['google.recovery.phone_unconfirmed', /\brecovery (phone|number)\b/i],
  ['google.recovery.email_other', /\brecovery email\b/i],
  ['google.family.manager_other', /\b(manager|manages)\b[^.]{0,40}\bfamily\b|\bfamily (group )?manager\b/i],
  ['google.family.member', /\bin my google family\b/i],
  ['google.devices.other', /\b(signed|logged) (in|into)\b[^.]{0,30}\bgoogle\b/i],
  ['amazon.household.adult', /\bamazon household\b/i],
  ['amazon.device.other', /\b(echo|alexa)\b/i],
];
const OVER = /\b(turned (it )?off|turn(ed)? off|deleted|removed|used to|no longer|stopped|changed it)\b/i;
const UNSURE = /\b(i think|somehow|maybe|might|not sure)\b/i;
// A sentence that says a way in is not there ("I do not have an AirTag", "he never bought me a phone") names no code.
// Phrases that say it IS there are taken out first: "never turned it off", "an app I did not install".
const NEGATION = /\b(not|never|no|don.t|doesn.t|didn.t|isn.t|aren.t|wasn.t|haven.t|hasn.t)\b/i;
const STILL_THERE = /\bnever (turned|changed|took|signed)\b[^.]*|\b(didn.t|did not|never) (install|download|add|put)\b[^.]*|\bno idea\b/gi;

/** The keyword reader. Returns { codes, living, children_shared } in the same shape as Gemini Nano's answer. */
export function keywordTold(text) {
  const out = { codes: [], living: 'unclear', children_shared: 'unclear' };
  // Sentences, and the parts of a sentence joined by "but" or by "and" before a new subject, so "I removed him from
  // Life360 but he can still see me on Find My" keeps its second half (judge round 11).
  const sentences = String(text || '').slice(0, TOLD_MAX_CHARS).split(/(?<=[.!?\n])\s+|,?\s+(?=but\b)|,?\s+(?=and (i|he|she|they|we|my|his|her)\b)/i).filter(s => s && !/^(i|he|she|they|we|my|his|her)$/i.test(s));
  for (const s of sentences) {
    if (OVER.test(s) && !/\bnever (turned|changed)\b/i.test(s)) continue;
    if (UNSURE.test(s)) continue;
    if (NEGATION.test(s.replace(STILL_THERE, ' '))) continue;
    for (const [code, re] of RULES) if (re.test(s) && !out.codes.includes(code)) out.codes.push(code);
  }
  // The family manager rule wins over the member rule when both match the same words.
  if (out.codes.includes('google.family.manager_other')) out.codes = out.codes.filter(c => c !== 'google.family.member');
  const all = String(text || '');
  if (/\b(live|living) (together|with (him|her|them))\b|\bsame (house|home|apartment)\b/i.test(all)) out.living = 'together';
  else if (/\b(moved out|left (him|her|them|in)|split up|separated|staying (at|with)|we broke up|i left)\b/i.test(all)) out.living = 'apart';
  if (/\bno (kids|children)\b|\bno children together\b/i.test(all)) out.children_shared = 'no';
  else if (/\b(kids?|children|son|daughter|baby)\b/i.test(all)) out.children_shared = 'yes';
  return out;
}

// A model answer that names more ways in than this is treated as unread: with the first prompt, Gemini Nano listed all
// 17 codes for "I moved out last month. No kids.", which names none. Set at 3 first; judge round 11 showed that threw
// away a right answer of 4 from a person who told a lot, so it is now 5 (more than a quarter of the 17 codes is a list,
// not a reading). Fixed before the third, fresh statement set was written.
export const TOLD_MAX_CODES = 5;

/**
 * The answer to use: Gemini Nano's when it reads the words, the keyword reader's when Nano's answer lists more than
 * TOLD_MAX_CODES ways in (a list, not a reading) or Nano is not there. Returns { answer, how }.
 */
export function pickTold(nanoAnswer, text) {
  const nano = nanoAnswer ? cleanTold(nanoAnswer) : null;
  if (nano && nano.codes.length <= TOLD_MAX_CODES) return { answer: nano, how: 'nano' };
  return { answer: cleanTold(keywordTold(text)), how: nano ? 'reader_after_nano' : 'reader' };
}

/** Checks an answer from either reader: known codes only, no repeats, and the answers from their lists. */
export function cleanTold(answer) {
  const codes = [...new Set((answer?.codes || []).filter(c => TOLD_CODES.includes(c) && CODES[c]))];
  return {
    codes,
    living: TOLD_LIVING.includes(answer?.living) ? answer.living : 'unclear',
    children_shared: TOLD_CHILDREN.includes(answer?.children_shared) ? answer.children_shared : 'unclear',
  };
}

/**
 * Findings for what the person told, after the ones already found. A code the settings pages already found is not
 * added again. The label says the person told it, so it is never mistaken for something read from a page.
 */
export function toldFindings(answer, { existing = [], refStart = 0, howFound = 'reader', words = {} } = {}) {
  // Only a finding the plan will act on counts as already found. One the person marked "Mine" (their own laptop, a
  // sister in Maps) is left out of the plan, so the same kind of way in, told about the other person, must still be
  // added (judge round 11).
  const have = new Set(existing.filter(f => f.ownership !== 'mine').map(f => f.code));
  let n = refStart;
  return cleanTold(answer).codes.filter(c => !have.has(c)).map(code => ({
    ref: `t${++n}`, code, check: CODES[code].check, service: 'told', group: CODES[code].group,
    label: `${words[code] || code}: from what you told Spare Key`, detail: 'From what you typed. Your words stayed on this device.',
    howFound, confidence: 'check_it', disagree: false, recency: 'unknown', access: ['unknown'], ownership: 'not_mine', openUrl: '',
  }));
}

/**
 * The situation answers the words gave, only where the person has not answered the question themselves, and only the
 * more careful answer: words can say "we live together" (changes they may notice wait) and "we share children" (a step
 * for the children's devices), never "apart" or "no children". A reader that misreads the words can then only make the
 * plan more careful, never less.
 */
export function toldSituation(answer, situation = {}) {
  const a = cleanTold(answer);
  const out = {};
  if (!situation.living && a.living === 'together') out.living = 'together';
  if (!situation.children_shared && a.children_shared === 'yes') out.children_shared = 'yes';
  return out;
}
