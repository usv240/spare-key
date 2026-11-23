// The real-account check (docs/accuracy.md "Real pages"): Spare Key's own reader and rules, run inside one real settings
// page in the person's own Chrome, returning only the check's status, finding codes and counts. No names, addresses or
// page text leave the page.
//
// Build:  npx esbuild tools/real-inpage.mjs --bundle --minify --format=iife --outfile=tools/out/real-inpage.js
// Use:    open a settings page (for example https://myaccount.google.com/u/0/signinoptions/twosv), paste
//         tools/out/real-inpage.js into DevTools' console (or run it with Chrome automation), then:
//           await __sk('google.2sv')            the page this tab shows (k = which page of a check, default 0)
//           await __skFrame(url, 'google.family')   another page of the same site, read in a hidden frame
// The November 22 and 23 results are in docs/evidence/real-account.json.
import { catalogue } from '../extension/src/scan/catalogue.js';
import { readPage } from '../extension/src/readers/read-page.js';
import { readToEntries } from '../extension/src/scan/engine.js';
import { toFinding } from '../extension/src/scan/rules.js';

globalThis.__skFrame = async (url, checkId, k = 0) => {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-3000px;top:0;width:1200px;height:900px;';
  const loaded = new Promise(r => f.addEventListener('load', r, { once: true }));
  f.src = url;
  document.body.append(f);
  await loaded;
  await new Promise(r => setTimeout(r, 2500));
  try { return await globalThis.__sk(checkId, k, f.contentDocument); } catch (e) { return { checkId, k, error: String(e).slice(0, 120) }; } finally { f.remove(); }
};

globalThis.__sk = async (checkId, k = 0, doc = document) => {
  const check = catalogue({}).find(c => c.id === checkId);
  const loc = doc.defaultView?.location || doc.location;
  const where = loc.host + loc.pathname;
  if (new RegExp(check.signedOutPattern).test(loc.href)) return { checkId, k, where, status: 'not_checked', why: 'signed_out' };
  if (new RegExp(check.reauthPattern).test(loc.href)) return { checkId, k, where, status: 'not_checked', why: 'needs_password' };
  const read = await readPage(check.pages[k].reader, doc);
  const base = { checkId, k, where, via: read.via, rawEntries: read.entries.length, withinFound: read.withinFound, emptyConfirmed: read.emptyConfirmed, timedOut: read.timedOut };
  if (read.errorPage) return { ...base, status: 'not_checked', why: 'did_not_load' };
  const p = await readToEntries({ check, read, account: read.account });
  if (p.why) return { ...base, status: 'not_checked', why: p.why };
  const codes = {};
  for (const [i, entry] of p.entries.entries()) {
    const fd = toFinding({ ref: `R${i}`, check, entry, cls: p.classes[i], howFound: 'reader', openUrl: '', account: read.account });
    if (fd) codes[fd.code] = (codes[fd.code] || 0) + 1;
  }
  return { ...base, status: 'checked', partly: p.partly, codes };
};
