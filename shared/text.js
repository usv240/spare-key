// Text helpers used on this computer only: finding addresses and numbers in page text, masking them for display, and
// reading how recent an entry is. Nothing here sends anything anywhere.

// An email address, and a US-style phone number (with or without +1, brackets, dots, spaces or dashes).
export const EMAIL_SOURCE = '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}';
export const PHONE_SOURCE = '(?:\\+?1[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}\\b';
// A phone number shown with most digits hidden, like "•••-•••-0177".
export const MASKED_PHONE_SOURCE = '(?:[\\u2022*]{2,}[\\s.-]?){1,3}\\d{2,4}\\b';
export const emailsIn = text => [...String(text || '').matchAll(new RegExp(EMAIL_SOURCE, 'gi'))].map(m => m[0]);
export const phonesIn = text => [...String(text || '').matchAll(new RegExp(PHONE_SOURCE, 'g'))].map(m => m[0].trim());

const DOT = '•';

/** j••••@gmail.com: the first letter and the domain stay, so the person can tell addresses apart. */
export function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return DOT.repeat(4);
  return `${local.slice(0, 1)}${DOT.repeat(4)}@${domain}`;
}

/** •••-•••-0188: the last four digits stay. */
export function maskPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return `${DOT.repeat(3)}-${DOT.repeat(3)}-${digits.slice(-4)}`;
}

/** The text with every email address and phone number masked. */
export function maskText(text) {
  return String(text || '')
    .replace(new RegExp(EMAIL_SOURCE, 'gi'), maskEmail)
    .replace(new RegExp(PHONE_SOURCE, 'g'), m => maskPhone(m));
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';

/**
 * How recent an entry is, from the words a settings page uses ("Active now", "2 hours ago", "Yesterday",
 * "3 days ago", "2 weeks ago", "Oct 3", "2024"). Returns one of the RECENCY enum values in shared/findings.js.
 */
export function recencyOf(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(active now|online now|right now|current session|currently)\b/.test(t) || /\bnow\b/.test(t) && !/until you turn this off/.test(t)) return 'now';
  if (/\b(\d+|a|an|one)\s*(second|minute|min|hour|hr)s?\s+ago\b/.test(t) || /\btoday\b/.test(t)) return 'today';
  if (/\byesterday\b/.test(t) || /\b[1-6]\s*days?\s+ago\b/.test(t)) return 'this_week';
  if (/\b([1-4]|a|one)\s*weeks?\s+ago\b/.test(t) || /\b([7-9]|[12]\d|30)\s*days?\s+ago\b/.test(t)) return 'this_month';
  if (/\b(\d+|a|one)\s*(month|year)s?\s+ago\b/.test(t) || new RegExp(`\\b(${MONTHS})\\b`).test(t) || /\b(19|20)\d{2}\b/.test(t)) return 'older';
  return 'unknown';
}

/** Plain-words recency for the results list. */
export const RECENCY_WORDS = { now: 'active now', today: 'today', this_week: 'this week', this_month: 'this month', older: 'a while ago', unknown: '' };

/** One short line from an entry's text, for a label: the first line, at most `max` characters, masked. */
export function shortLabel(text, max = 90) {
  const first = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean).join(' · ');
  const masked = maskText(first);
  return masked.length > max ? masked.slice(0, max - 1).trimEnd() + '…' : masked;
}
