// Records each settings page's real URL and structure from the builder's TEST accounts (PLAN.md day 1), for writing the
// page readers and the practice pages. Read-only, like the product: it only opens pages and reads them. It never clicks,
// types or submits anything.
//
// Step 1, once:  node tools/record-pages.mjs --login
//   Opens an ordinary Chrome window (not automated: Google refuses sign-in from automated browsers) on a separate
//   profile. Sign in there to test account A (Google) and the Amazon test account, then close that window.
// Step 2:        node tools/record-pages.mjs [--only=google.devices,gmail.filters] [--u=0]
//   Opens every page in the catalogue with that profile and saves, per check, to private/pages/ (gitignored):
//     <id>.raw.json      the final URL, title, whether it asked to sign in, the main text and a DOM outline
//     <id>.masked.json   the same with emails, phone numbers and every string in private/test-accounts.local.json replaced
//     <id>.png           a screenshot (test account only; never commit it, never put it in the video)
//
// private/test-accounts.local.json (optional, gitignored): { "replace": { "Real Test Name": "Jordan Lee", ... } }
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CHROME } from './chrome-args.mjs';
import { catalogue, pageUrl } from '../extension/src/scan/catalogue.js';
import { readPage } from '../extension/src/readers/read-page.js';

const PROFILE = process.env.SK_ACCOUNTS_PROFILE || 'E:/spare-key-test/accounts-profile';
const OUT = path.resolve('private/pages');
const args = process.argv.slice(2);
const arg = name => (args.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
mkdirSync(PROFILE, { recursive: true });
mkdirSync(OUT, { recursive: true });

if (args.includes('--login')) {
  log(`Opening Chrome on ${PROFILE}. Sign in to the TEST accounts only, then close the window.`);
  const child = spawn(CHROME, [`--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
    'https://accounts.google.com/', 'https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0'], { stdio: 'ignore' });
  child.on('exit', () => log('Chrome closed. Now run: node tools/record-pages.mjs'));
}

// Masking: emails, US-style phone numbers, and the builder's own list of test names.
const replaceList = (() => {
  const f = 'private/test-accounts.local.json';
  try { return Object.entries(JSON.parse(readFileSync(f, 'utf8')).replace || {}); } catch { return []; }
})();
function mask(text) {
  let t = String(text || '');
  for (const [from, to] of replaceList) if (from) t = t.split(from).join(to);
  let n = 0;
  t = t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => `person${++n}@example.com`);
  let p = 0;
  t = t.replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, () => `(555) 010-${String(++p).padStart(4, '0')}`);
  return t;
}

async function record() {
  const only = arg('only') ? arg('only').split(',') : null;
  const u = Number(arg('u') || 0);
  const checks = catalogue({}).filter(c => c.pages.length && (!only || only.includes(c.id)));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, pipe: true, userDataDir: PROFILE, defaultViewport: null,
    // Fewer automation signs; the tool still only reads.
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--window-size=1280,1000', '--no-first-run', '--no-default-browser-check'],
  });
  const summary = [];
  try {
    const page = (await browser.pages())[0] || await browser.newPage();
    for (const check of checks) {
      for (const [n, pageDef] of check.pages.entries()) {
        const id = n ? `${check.id}.${n}` : check.id;
        const url = pageUrl(pageDef.url, u);
        log('open', id, url);
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          // Single-page apps keep loading after the document: give them time, but never interact.
          await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 2500));
          const finalUrl = page.url();
          const snap = await page.evaluate(() => {
            const main = document.querySelector('main, [role="main"]') || document.body;
            // An outline of the page: tags, roles, labels, ids, classes and data attributes, with text shortened.
            const outline = [];
            const walk = (el, depth) => {
              if (outline.length > 4000 || depth > 40) return;
              const attrs = [];
              for (const a of el.attributes || []) if (/^(id|class|role|aria-[\w-]+|data-[\w-]+|jsname|jscontroller|href|type|name)$/.test(a.name)) attrs.push(`${a.name}=${JSON.stringify(a.value.slice(0, 120))}`);
              const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ').slice(0, 160);
              if (!/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|LINK|META)$/i.test(el.tagName)) outline.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${attrs.length ? ' ' + attrs.join(' ') : ''}>${own ? ' ' + own : ''}`);
              for (const c of el.children) walk(c, depth + 1);
            };
            walk(main, 0);
            return { title: document.title, text: (main.innerText || '').slice(0, 30000), outline: outline.join('\n') };
          });
          const signedOut = new RegExp(check.signedOutPattern).test(finalUrl);
          const reauth = new RegExp(check.reauthPattern).test(finalUrl) || /verify it.s you|confirm it.s you|enter your password|to continue, first verify/i.test(snap.text);
          // What the current reader settings find on the real page, for tuning them.
          const reader = signedOut || reauth ? null : await page.evaluate(readPage, pageDef.reader).catch(e => ({ error: String(e).slice(0, 200) }));
          const rawRecord = { id, check: check.id, url, finalUrl, signedOut, reauth, reader: reader && { ...reader, mainText: undefined }, ...snap, recordedAt: new Date().toISOString() };
          writeFileSync(path.join(OUT, `${id}.raw.json`), JSON.stringify(rawRecord, null, 2));
          writeFileSync(path.join(OUT, `${id}.masked.json`), JSON.stringify({ ...rawRecord, finalUrl: mask(finalUrl), title: mask(snap.title), text: mask(snap.text), outline: mask(snap.outline), reader: reader && { ...reader, mainText: undefined, account: reader.account && { email: mask(reader.account.email), name: mask(reader.account.name) }, entries: (reader.entries || []).map(e => ({ ...e, text: mask(e.text), href: mask(e.href), state: (e.state || []).map(mask) })) } }, null, 2));
          await page.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: true }).catch(() => {});
          summary.push({ id, finalUrl: mask(finalUrl), signedOut, reauth, textChars: snap.text.length, readerVia: reader?.via, readerEntries: reader?.entries?.length ?? null, readerReady: reader?.ready ?? null });
          log(signedOut ? 'SIGNED OUT' : reauth ? 'ASKS TO VERIFY' : 'ok', id, `${snap.text.length} chars`);
        } catch (e) {
          summary.push({ id, error: String(e).slice(0, 200) });
          log('ERROR', id, String(e).slice(0, 200));
        }
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  log(`Saved ${summary.length} pages to ${OUT}`);
  if (!existsSync('private/test-accounts.local.json')) log('Tip: list the test accounts\' names in private/test-accounts.local.json so the masked copies replace them.');
}

// Run after everything above is defined.
if (!args.includes('--login')) await record();
