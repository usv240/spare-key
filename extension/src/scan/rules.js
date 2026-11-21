// From the entries a reader found to findings with codes. Runs on this computer only.
//
// Each entry gets a classification (the enums of TECHNICAL-DESIGN.md section 6.1): from code alone (codeClassify), from
// Gemini Nano, or both merged (merge). Code rules per check then decide the finding code. Nano never picks a code; it
// only fills enums these rules read. When the two disagree on whose an entry is, the finding says "Not sure".
import { CODES, GROUPS } from '../../../shared/findings.js';
import { emailsIn, phonesIn, recencyOf, shortLabel, maskText } from '../../../shared/text.js';

const lower = s => String(s || '').toLowerCase();
const THIS_DEVICE = /\b(this device|this computer|current session|your current session|you.re using this device)\b/i;

/** What code alone can say about one entry. Same shape as Nano's answer. */
export function codeClassify(checkId, entry, account) {
  // The entry's words and its form state (the selected forwarding address lives in a select, not in the text).
  const text = [entry.text || '', ...(entry.state || [])].join('\n');
  const emails = emailsIn(text);
  const phones = phonesIn(text);
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
      const t = lower(text);
      const access = [];
      if (/gmail|mail|email/.test(t)) access.push('mail');
      if (/location/.test(t)) access.push('location');
      if (/full access|all your google|your google account data|some access to your google account/.test(t)) access.push('account');
      // "Sign in with Google" alone gives the app nothing to read: certainly no access, not unknown.
      if (!access.length && /sign in with google|signing in with google/.test(t)) return { ...base, kind: 'app', access: [] };
      return { ...base, kind: 'app', access: access.length ? access : ['unknown'] };
    }
    case 'google.recovery':
      if (phones.length) return { ...base, kind: 'phone_number', access: ['account'] };
      if (emails.length) return { ...base, kind: 'email_address', access: ['account'], is_owner: others.length ? 'no' : mentionsOwner ? 'yes' : 'unknown' };
      return base;
    case 'google.2sv':
      return { ...base, kind: phones.length ? 'phone_number' : 'device', access: ['account'] };
    case 'maps.sharing':
      if (/anyone with (the|this) link/i.test(text)) return { ...base, kind: 'share_link', access: ['location'] };
      return { ...base, kind: emails.length || /\bsharing\b/i.test(text) ? 'person' : 'unknown', access: ['location'], is_owner: others.length ? 'no' : 'unknown' };
    case 'gmail.forwarding':
    case 'gmail.delegates':
      return { ...base, kind: emails.length ? 'email_address' : 'unknown', access: ['mail'], is_owner: others.length ? 'no' : mentionsOwner ? 'yes' : 'unknown' };
    case 'gmail.filters':
      return { ...base, kind: 'unknown', access: ['mail'] };
    case 'amazon.household':
      return { ...base, kind: 'person', access: ['purchases', 'addresses'] };
    case 'amazon.devices':
      return { ...base, kind: 'device', access: ['purchases', 'cameras'] };
    case 'google.family':
      return { ...base, kind: 'person', access: ['account', 'location'] };
    case 'photos.sharing':
      return { ...base, kind: emails.length ? 'person' : 'unknown', access: ['photos', 'location'], is_owner: others.length ? 'no' : 'unknown' };
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
  const owner = code.is_owner !== 'unknown' && nano.is_owner !== 'unknown' && code.is_owner !== nano.is_owner ? 'unknown' : pick(code.is_owner, nano.is_owner);
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
export function codeFor(checkId, entry, cls) {
  const text = lower(entry.text);
  const state = lower((entry.state || []).join(' '));
  switch (checkId) {
    case 'google.devices':
      return cls.this_computer === 'yes' ? null : 'google.devices.other';
    case 'google.apps':
      if (cls.access.includes('mail')) return 'google.apps.read_mail';
      if (cls.access.includes('location')) return 'google.apps.location';
      if (cls.access.includes('account')) return 'google.apps.full_access';
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
      const on = /chosen:[^,]*forward a copy/.test(state) || (!state && /forward a copy of incoming mail to\s*\S+@/.test(text) && !/forwarding is (off|disabled)/.test(text));
      return on && cls.is_owner !== 'yes' && emailsIn(entry.text + ' ' + state).length ? 'gmail.forwarding.external' : null;
    }
    case 'gmail.filters':
      if (/\bforward (it )?to\b/.test(text)) return 'gmail.filter.forwards';
      if (/\b(delete it|skip (the )?inbox|archive it|mark as read)\b/.test(text)) return 'gmail.filter.hides';
      return null;
    case 'gmail.delegates':
      return cls.is_owner === 'yes' ? null : 'gmail.delegate';
    case 'amazon.household':
      if (cls.is_owner === 'yes') return null;
      if (/\bteen\b/.test(text)) return 'amazon.household.teen';
      return /\badult\b/.test(text) ? 'amazon.household.adult' : null;
    case 'amazon.devices':
      return 'amazon.device.other';
    case 'google.family':
      if (cls.is_owner === 'yes') return null;
      return /family manager|\bparent\b/.test(text) ? 'google.family.manager_other' : 'google.family.member';
    case 'photos.sharing':
      return cls.is_owner === 'yes' ? null : 'photos.partner_sharing';
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
  const code = codeFor(check.id, entry, cls);
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
    confidence: howFound === 'nano' ? 'check_it' : 'high',
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
