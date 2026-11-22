// This session's private strings: the names, addresses, numbers and device names a scan found. checkOutgoing() in
// shared/cloud-safe.js refuses any cloud request that contains one, as a second lock behind toCloud().
//
// A string that also appears in the public vocabulary (finding codes, enums, the steps library) is left out, because
// the cloud legitimately sees that text and it names no one ("Kindle" may be in a device name and in the library).
import { emailsIn, phonesIn } from '../../../shared/text.js';

const SPLIT = /\s*(?:\n|·|\||,|;|\(|\)|:)\s*/;
// A settings page's own labels name no one: the network ledger once counted "Phone number" (a 2-Step Verification
// label) as private because the fixed instructions say "phone numbers" (November 22, 2026).
const GENERIC = /^(phone( number)?|mobile( number)?|authenticator( app)?|google prompts?|security keys?|passkeys?|backup codes?|text or voice|this device|this computer|recovery (phone|email)|link|member|adult|teen|child|family manager)$/i;

export function privateStringsFrom({ findings = [], account = null, vocabulary = '' }) {
  const vocab = vocabulary.toLowerCase();
  const out = new Set();
  const add = s => {
    const t = String(s || '').trim();
    if (t.length < 4 || /^\d+$/.test(t) || GENERIC.test(t)) return;
    if (vocab.includes(t.toLowerCase())) return;
    out.add(t);
  };
  if (account) { add(account.email); add(account.name); }
  for (const f of findings) {
    const text = `${f.detail || ''}\n${f.accountEmail || ''}`;
    for (const e of emailsIn(text)) { add(e); add(e.split('@')[0]); }
    for (const p of phonesIn(text)) { add(p); add(p.replace(/\D/g, '')); }
    // The first part of each line: a device, app or person's name. Short common words are dropped by the vocabulary.
    for (const line of String(f.detail || '').split('\n')) {
      const head = line.split(SPLIT)[0];
      if (head && head.split(/\s+/).length <= 5) add(head);
    }
  }
  return [...out];
}
