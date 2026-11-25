// What checking by hand costs, measured from Spare Key's own data: the settings pages a person would open (from the
// check catalogue), and the official help pages the steps library cites for the account checks, fetched and counted.
// No cloud model is called; the help pages are public.
//   node tools/effort.mjs        writes docs/evidence/effort.json
import { readFileSync, writeFileSync } from 'node:fs';
import { catalogue } from '../extension/src/scan/catalogue.js';

const WPM = 200; // a common adult reading speed for instructions; a stressed reader is slower
const lib = JSON.parse(readFileSync('data/steps.json', 'utf8'));
const checks = catalogue({}).filter(c => c.pages.length);
const pages = checks.flatMap(c => c.pages.map(p => p.url));
const sites = [...new Set(pages.map(u => new URL(u.replace('{u}', '0')).host))];
const accountCodes = Object.values(lib.entries).filter(e => !/^(phone|apple|tracker|life360|carrier|screenshot)\./.test(e.code));
const urls = [...new Set(accountCodes.flatMap(e => (e.sources || []).map(s => s.url)))];

const text = html => html
  .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const main = html => (html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];

const help = [];
for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', 'Accept-Language': 'en-US' }, redirect: 'follow' });
    const words = r.ok ? text(main(await r.text())).split(' ').filter(w => /[a-z]/i.test(w)).length : 0;
    help.push({ url, status: r.status, words });
  } catch (e) { help.push({ url, status: 0, words: 0, error: String(e).slice(0, 80) }); }
  console.log(help.at(-1).status, help.at(-1).words, url);
}
const read = help.filter(h => h.words > 0);
const words = read.reduce((a, h) => a + h.words, 0);
const out = {
  at: new Date().toISOString(), tool: 'node tools/effort.mjs',
  byHand: {
    settingsPages: pages.length, sites: sites.length, siteNames: sites, checks: checks.length,
    helpPagesCited: urls.length, helpPagesRead: read.length, helpWords: words, readingMinutesAt200wpm: Math.round(words / WPM),
  },
  note: 'Help pages are those the steps library cites for the account checks (Google, Gmail, Photos, Amazon, Chrome), counted from the article or main element. Reading time is at 200 words per minute and leaves out finding each setting, logging in and deciding what each entry means.',
  help,
};
writeFileSync('docs/evidence/effort.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.byHand, null, 1));
