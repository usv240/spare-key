// The network ledger: every request the offscreen page makes (Gemini, Remote Config, Firestore, Firebase
// installations), counted by wrapping fetch before any Firebase code loads. It keeps, for this session only and only in
// this page's memory, each request's destination, size and text, so the panel can show bytes per destination and check
// that none of them holds a name, address, device or page word from this scan.
//
// Not counted here: the App Check bridge, a page on Spare Key's site in a hidden frame that asks Google's reCAPTCHA for
// a token. It is sent nothing from Spare Key.
import { leaksAny } from '../../shared/cloud-safe.js';

const MAX_KEPT = 400;
const kept = [];
const byHost = new Map();

const WHO = [
  [/firebaseml|firebasevertexai|generativelanguage/, 'Gemini in the cloud'],
  [/firebaseremoteconfig/, 'Remote Config (page readers and switches)'],
  [/firestore/, 'Cloud Firestore (the steps library)'],
  [/firebaseinstallations/, 'Firebase installation ID'],
  [/firebaseappcheck/, 'App Check (proof this is Spare Key)'],
  [/support\.google\.com|amazon\.com/, 'Official help page (read only)'],
];
const who = host => (WHO.find(([re]) => re.test(host)) || [null, host])[1];

async function bodyText(input, init) {
  try {
    const body = init?.body ?? (input instanceof Request ? await input.clone().text() : '');
    if (typeof body === 'string') return body;
    if (body instanceof Blob) return await body.text();
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
    if (body instanceof URLSearchParams || body instanceof FormData) return String(new URLSearchParams(body));
    return body ? String(body) : '';
  } catch { return ''; }
}

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async function ledgerFetch(input, init) {
  const url = String(input instanceof Request ? input.url : input);
  let host = 'unknown';
  try { host = new URL(url, location.href).host; } catch { /* keep unknown */ }
  const text = await bodyText(input, init);
  const bytes = new TextEncoder().encode(text).length + new TextEncoder().encode(url).length;
  const row = byHost.get(host) || { host, who: who(host), requests: 0, bytes: 0 };
  row.requests++;
  row.bytes += bytes;
  byHost.set(host, row);
  kept.push(`${url}\n${text}`);
  if (kept.length > MAX_KEPT) kept.shift();
  return realFetch(input, init);
};

/** Bytes and requests per destination, and how many requests hold one of `privateStrings` (URL and body). */
export function ledgerSummary(privateStrings = []) {
  return {
    rows: [...byHost.values()].sort((a, b) => b.bytes - a.bytes),
    requests: kept.length,
    holdingPrivate: privateStrings.length ? kept.filter(t => leaksAny(t, privateStrings)).length : null,
  };
}
