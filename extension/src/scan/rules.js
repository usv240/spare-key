// From the entries a reader found to findings with codes. Runs on this computer only.
//
// Each entry gets a classification (the enums of TECHNICAL-DESIGN.md section 6.1): from code alone (codeClassify), from
// Gemini Nano, or both merged (merge). Code rules per check then decide the finding code. Nano never picks a code; it
// only fills enums these rules read. When the two disagree on whose an entry is, the finding says "Not sure".
import { CODES, GROUPS } from '../../../shared/findings.js';
import { emailsIn, phonesIn, recencyOf, shortLabel, maskText, MASKED_PHONE_SOURCE } from '../../../shared/text.js';

const MASKED_PHONE = new RegExp(MASKED_PHONE_SOURCE);

const lower = s => String(s || '').toLowerCase();
const THIS_DEVICE = /\b(this device|this computer|current session|your current session|you.re using this device)\b/i;

// The page words the code rules read, per check, as regular expression sources. Remote Config's catalogue can replace
// any of them (a check's "words"), so when a site rewords a page, the rules are fixed for every install along with the
// reader, with no store update (measured by tools/drift-test.mjs).
export const WORDS = {
  'google.apps': {
    mail: 'gmail|mail|email', location: 'location',
    account: 'full access|all your google|your google account data|some access to your google account',
    sign_in_only: 'sign in with google|signing in with google',
  },
  'maps.sharing': { link: 'anyone with (the|this) link', person: '\\bsharing\\b' },
  'gmail.forwarding': { on: 'forward a copy', off: 'forwarding is (off|disabled)' },
  'gmail.filters': { forwards: '\\bforward (it )?to\\b', hides: '\\b(delete it|skip (the )?inbox|archive it|mark as read)\\b' },
  // Amazon marks the person's own card "Account holder" (a real account, November 22, 2026).
  'amazon.household': { teen: '\\bteen\\b', child: '\\b(child|kid)\\b', owner: '\\baccount holder\\b' },
  'google.family': { manager: 'family manager|\\bparent\\b' },
};
const NEVER = /(?!)/;
const asRegExp = src => { try { return typeof src === 'string' && src ? new RegExp(src, 'i') : NEVER; } catch { return NEVER; } };
/** A check's words as regular expressions: the defaults, with any of them replaced by `over` (from Remote Config). */
export function wordsFor(checkId, over) {
  const merged = { ...(WORDS[checkId] || {}) };
  if (over && typeof over === 'object' && !Array.isArray(over)) for (const [k, v] of Object.entries(over)) if (k in merged && typeof v === 'string') merged[k] = v;
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, asRegExp(v)]));
}

/** What code alone can say about one entry. Same shape as Nano's answer. `words` are the check's Remote Config words. */
export function codeClassify(checkId, entry, account, words) {
  const w = wordsFor(checkId, words);
  // The entry's words and its form state (the selected forwarding address lives in a select, not in the text).
  const text = [entry.text || '', ...(entry.state || [])].join('\n');
  const emails = emailsIn(text);
  const phones = [...phonesIn(text), ...(text.match(MASKED_PHONE) || []).slice(0, 1)];
  const ownerEmail = lower(account?.email);
  const mentionsOwner = !!ownerEmail && emails.some(e => lower(e) === ownerEmail);
  const others = emails.filter(e => lower(e) !== ownerEmail);
  const base = {
    kind: 'unknown', is_owner: /\((you|me)\)/i.test(text) ? 'yes' : 'unknown', access: ['unknown'],
    recency: recencyOf(text),
    this_computer: THIS_DEVICE.test(text) ? 'yes' : 'unknown',
  };
  switch (checkId) {
    case 'google.devices':
      return { ...base, kind: 'device', access: ['account', 'mail', 'location'], is_owner: base.this_computer === 'yes' ? 'yes' : 'unknown' };
    case 'google.apps': {
      const access = [];
      if (w.mail.test(text)) access.push('mail');
      if (w.location.test(text)) access.push('location');
      if (w.account.test(text)) access.push('account');
      // "Sign in with Google" alone gives the app nothing to read: certainly no access, not unknown.
      if (!access.length && w.sign_in_only.test(text)) return { ...base, kind: 'app', access: [] };
      return { ...base, kind: 'app', access: access.length ? access : ['unknown'] };
    }
    case 'google.recovery':
      if (phones.length) return { ...base, kind: 'phone_number', access: ['account'] };
      if (emails.length) return { ...base, kind: 'email_address', access: ['account'], is_owner: others.length ? 'no' : mentionsOwner ? 'yes' : 'unknown' };
      return base;
    case 'google.2sv':
      return { ...base, kind: phones.length ? 'phone_number' : 'device', access: ['account'] };
    case 'maps.sharing':
      if (w.link.test(text)) return { ...base, kind: 'share_link', access: ['location'] };
      return { ...base, kind: emails.length || w.person.test(text) ? 'person' : 'unknown', access: ['location'], is_owner: others.length ? 'no' : 'unknown' };
    case 'gmail.forwarding':
    case 'gmail.delegates':
      return { ...base, kind: emails.length ? 'email_address' : 'unknown', access: ['mail'], is_owner: others.length ? 'no' : mentionsOwner ? 'yes' : 'unknown' };
    case 'gmail.filters':
      return { ...base, kind: 'unknown', access: ['mail'] };
    case 'amazon.household':
      return { ...base, kind: 'person', access: ['purchases', 'addresses'], is_owner: w.owner.test(text) ? 'yes' : base.is_owner };
    case 'amazon.devices':
      return { ...base, kind: 'device', access: ['purchases', 'cameras'] };
    case 'google.family':
      return { ...base, kind: 'person', access: ['account', 'location'] };
    case 'photos.sharing':
      return { ...base, kind: emails.length ? 'person' : 'unknown', access: ['photos', 'location'], is_owner: others.length ? 'no' : 'unknown' };
    // A phone app's sharing screen, read from a screenshot by Gemini Nano: everyone on it can see the person's location.
    case 'screenshot':
      return { ...base, kind: 'person', access: ['location'], is_owner: entry.is_owner === 'yes' || /^(me|you|this phone)\b/i.test(text) ? 'yes' : base.is_owner };
    default:
      return base;
  }
}

/**
 * Code and Nano together (TECHNICAL-DESIGN.md section 6.4). Nano fills what code left unknown; a clash on ownership is
 * "unknown". Where the page's own words decide, code wins: measured on the practice pages (November 21, 2026), Nano
 * called an "Active now" phone "this computer" (which would hide it), gave a "Sign in with Google" app full access, and
 * dated a device the page gave no date for.
 */
export function merge(code, nano, text = '') {
  if (!nano) return { ...code, source: 'reader' };
  const pick = (a, b) => (a && a !== 'unknown' ? a : b || 'unknown');
  // Only the page's words can make an entry the person's own, which hides it. Nano may say an entry is not theirs, never
  // that it is: on the website's practice check (November 22, 2026), Nano sorting all 24 entries at once called four
  // household and family members the person's own, Sam Porter among them, and they disappeared from the results.
  const nanoOwner = nano.is_owner === 'yes' ? 'unknown' : nano.is_owner;
  const owner = code.is_owner !== 'unknown' && nanoOwner !== 'unknown' && code.is_owner !== nanoOwner ? 'unknown' : pick(code.is_owner, nanoOwner);
  // An empty list from code means "certainly no access" (sign-in only); only "unknown" lets Nano fill it in.
  const access = code.access.includes('unknown') ? (nano.access?.length ? nano.access : code.access) : code.access;
  // Only the page's words can make an entry this computer; Nano may only say it is not.
  const thisComputer = code.this_computer === 'yes' ? 'yes' : nano.this_computer === 'no' ? 'no' : 'unknown';
  // Nano's recency only when the entry has a time to read.
  // "until 9:00 PM" is when a share ends, not when it was used: a bare number is not a time to read.
  const hasTime = /\b(ago|today|yesterday|now|active|last (used|seen|active)|since)\b/i.test(text);
  return {
    kind: pick(code.kind, nano.kind),
    is_owner: owner,
    disagree: code.is_owner !== 'unknown' && nano.is_owner !== 'unknown' && code.is_owner !== nano.is_owner,
    access,
    recency: code.recency !== 'unknown' ? code.recency : hasTime ? nano.recency || 'unknown' : 'unknown',
    this_computer: thisComputer,
    source: 'both',
  };
}

/** The finding code for an entry, or null when it gives no one else access (this computer, the owner's own address). */
export function codeFor(checkId, entry, cls, words) {
  const w = wordsFor(checkId, words);
  const text = lower(entry.text);
  const state = lower((entry.state || []).join(' '));
  switch (checkId) {
    case 'google.devices':
      return cls.this_computer === 'yes' ? null : 'google.devices.other';
    case 'google.apps':
      if (cls.access.includes('mail')) return 'google.apps.read_mail';
      if (cls.access.includes('location')) return 'google.apps.location';
      // Access the page's words do not show is listed too, as the general kind: dropping it would hide it.
      if (cls.access.includes('account') || cls.access.includes('unknown')) return 'google.apps.full_access';
      return null; // "Sign in with Google" only: it cannot read anything.
    case 'google.recovery':
      if (cls.kind === 'phone_number') return 'google.recovery.phone_unconfirmed';
      if (cls.kind === 'email_address' && cls.is_owner !== 'yes') return 'google.recovery.email_other';
      return null;
    case 'google.2sv':
      return cls.this_computer === 'yes' ? null : 'google.2sv.other_device';
    case 'maps.sharing':
      if (cls.kind === 'share_link') return 'maps.sharing.link';
      return cls.is_owner === 'yes' ? null : 'maps.sharing.person';
    case 'gmail.forwarding': {
      // Forwarding is on only when "Forward a copy" is the chosen option and an address follows it.
      const chosen = (entry.state || []).some(c => /^chosen:/i.test(c) && w.on.test(c));
      const on = chosen || (!state && new RegExp(`(${w.on.source})[\\s\\S]{0,80}?\\S+@`, 'i').test(text) && !w.off.test(text));
      return on && cls.is_owner !== 'yes' && emailsIn(entry.text + ' ' + state).length ? 'gmail.forwarding.external' : null;
    }
    case 'gmail.filters':
      if (w.forwards.test(text)) return 'gmail.filter.forwards';
      if (w.hides.test(text)) return 'gmail.filter.hides';
      return null;
    case 'gmail.delegates':
      return cls.is_owner === 'yes' ? null : 'gmail.delegate';
    case 'amazon.household':
      if (cls.is_owner === 'yes') return null;
      if (w.teen.test(text)) return 'amazon.household.teen';
      if (w.child.test(text)) return null;
      // An adult unless the page says otherwise: an adult can see the most, so a person it cannot place is listed as one.
      return 'amazon.household.adult';
    case 'amazon.devices':
      return 'amazon.device.other';
    case 'google.family':
      if (cls.is_owner === 'yes') return null;
      return w.manager.test(text) ? 'google.family.manager_other' : 'google.family.member';
    case 'photos.sharing':
      return cls.is_owner === 'yes' ? null : 'photos.partner_sharing';
    case 'screenshot':
      return cls.is_owner === 'yes' ? null : 'screenshot.sharing.person';
    default:
      return null;
  }
}

// A clearer label than the raw entry for a few codes, still masked.
function labelFor(code, entry, extra, account) {
  const others = emailsIn([entry.text, ...extra].join(' ')).filter(e => lower(e) !== lower(account?.email));
  if (code === 'gmail.forwarding.external' && others[0]) return shortLabel(`Forwards new mail to ${others[0]}`);
  if (code === 'gmail.delegate' && others[0]) return shortLabel(others[0]);
  if (code === 'gmail.filter.forwards' || code === 'gmail.filter.hides') return shortLabel(entry.text.replace(/\s*\n\s*/g, '. '));
  return shortLabel([entry.text, ...extra].join('\n'));
}

/** One finding (TECHNICAL-DESIGN.md section 8). Everything in it stays on this computer. */
export function toFinding({ ref, check, entry, cls, howFound, openUrl, account }) {
  const code = codeFor(check.id, entry, cls, check.words);
  if (!code || !CODES[code]) return null;
  const extra = (entry.state || []).filter(s => /^selected:/.test(s)).map(s => s.replace(/^selected:\s*/, ''));
  return {
    ref,
    code,
    check: check.id,
    service: check.service,
    group: CODES[code].group,
    label: labelFor(code, entry, extra, account),
    detail: [entry.text, ...extra].join('\n'),      // shown only when the person taps Show
    howFound,                                        // reader | nano | both
    confidence: howFound === 'nano' || howFound === 'cloud' ? 'check_it' : 'high',
    disagree: !!cls.disagree,
    recency: cls.recency || 'unknown',
    access: cls.access || ['unknown'],
    ownership: null,                                 // the person's own answer: mine | not_mine | unsure
    openUrl,
    accountEmail: account?.email || '',
  };
}

/** A finding's text for display, masked unless the person asked to see it. */
export const displayLabel = (f, reveal = false) => (reveal ? f.detail.split('\n')[0] : f.label);
export const maskedDetail = f => maskText(f.detail);

// Within a group: a person first, then a way into the account, then links, apps and devices.
const CODE_ORDER = [
  'maps.sharing.person', 'gmail.forwarding.external', 'gmail.delegate', 'google.recovery.email_other', 'google.recovery.phone_unconfirmed',
  'google.family.manager_other', 'photos.partner_sharing', 'amazon.household.adult', 'chrome.sync.other_account',
  'gmail.filter.forwards', 'gmail.filter.hides', 'google.2sv.other_device', 'google.devices.other', 'maps.sharing.link',
  'google.apps.read_mail', 'google.apps.location', 'google.apps.full_access', 'chrome.extension.broad_access',
  'google.family.member', 'amazon.household.teen', 'amazon.device.other', 'screenshot.sharing.person',
];

/** Findings in the order the results show them: by group, then by risk, then most recent first. */
export function sortFindings(findings) {
  const RANK = { now: 0, today: 1, this_week: 2, this_month: 3, older: 4, unknown: 5 };
  const order = c => (CODE_ORDER.indexOf(c) + 1 || 99);
  return [...findings].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || order(a.code) - order(b.code) || RANK[a.recency] - RANK[b.recency]);
}
