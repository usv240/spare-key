// Scores the pages recorded from a real account (tools/record-pages.mjs, private/pages/*.raw.json) through the scan
// engine's own rules (readToEntries, then toFinding), code only, and prints per check only its status and the finding
// codes with counts: no names, addresses or page text. Compare with what the person says is really on the account.
// Usage: node tools/record-pages.mjs && node tools/real-check.mjs [--save]   (--save writes private/real-check.json)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { catalogue } from '../extension/src/scan/catalogue.js';
import { readToEntries } from '../extension/src/scan/engine.js';
import { toFinding } from '../extension/src/scan/rules.js';

const dir = 'private/pages';
const checks = catalogue({}).filter(c => c.pages.length);
const out = [];
for (const check of checks) {
  const files = check.pages.map((p, k) => `${dir}/${check.id}${k ? `.${k}` : ''}.raw.json`);
  let status = 'checked', why = null, partly = false;
  const codes = {};
  for (const [k, f] of files.entries()) {
    let rec;
    try { rec = JSON.parse(readFileSync(f, 'utf8')); } catch { status = 'not_recorded'; break; }
    if (rec.signedOut) { status = 'not_checked'; why = 'signed_out'; break; }
    if (rec.reauth) { status = 'not_checked'; why = 'needs_password'; break; }
    const read = rec.reader;
    if (!read || read.errorPage) { status = 'not_checked'; why = 'did_not_load'; break; }
    const p = await readToEntries({ check, read, account: read.account });
    if (p.why) { status = 'not_checked'; why = p.why; break; }
    partly ||= p.partly;
    for (const [i, entry] of p.entries.entries()) {
      const fd = toFinding({ ref: `R${i}`, check, entry, cls: p.classes[i], howFound: 'reader', openUrl: '', account: read.account });
      if (fd) codes[fd.code] = (codes[fd.code] || 0) + 1;
    }
  }
  out.push({ check: check.id, status, why, partly, codes });
  console.log(`${check.id.padEnd(18)} ${(status + (why ? ` (${why})` : partly ? ' (in part)' : '')).padEnd(30)} ${Object.entries(codes).map(([c, n]) => `${c} x${n}`).join(', ') || '(nothing found)'}`);
}
if (process.argv.includes('--save')) writeFileSync('private/real-check.json', JSON.stringify({ at: new Date().toISOString(), out }, null, 1));
