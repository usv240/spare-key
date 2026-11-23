// Development aid: opens candidate settings addresses in the recording profile (tools/record-pages.mjs), read-only, and
// prints only each page's final address, its first heading, the number of links matching a pattern, and a few counts
// such as "Access to (3)". It prints no names, addresses or list contents.
// Usage: node tools/probe-urls.mjs "<url>|<link substring>" ...
import puppeteer from 'puppeteer-core';
import { CHROME } from './chrome-args.mjs';

const PROFILE = process.env.SK_ACCOUNTS_PROFILE || 'E:/spare-key-test/accounts-profile';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, userDataDir: PROFILE, defaultViewport: { width: 1280, height: 900 }, args: ['--no-first-run'] });
try {
  const page = await browser.newPage();
  for (const arg of process.argv.slice(2)) {
    const [url, link = ''] = arg.split('|');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    const info = await page.evaluate((link, words) => {
      const text = document.body.innerText;
      return {
        final: location.href.replace(/[?&]authuser=\d/, ''),
        heading: (document.querySelector('h1, h2')?.innerText || '').slice(0, 60),
        links: link ? [...document.querySelectorAll('a[href]')].filter(a => a.getAttribute('href').includes(link)).length : null,
        counts: [...new Set(text.match(/[A-Z][a-z ]{2,30} \(\d+\)/g) || [])].slice(0, 6),
        verify: /verify it.s you|confirm it.s you|enter your password/i.test(text),
        // Each matching link's text without its first line (the app's or person's name), emails masked.
        items: link ? [...document.querySelectorAll('a[href]')].filter(a => a.getAttribute('href').includes(link)).slice(0, 5)
          .map(a => a.innerText.split('\n').slice(1).join(' | ').replace(/[\w.+-]+@[\w.-]+/g, '<email>').slice(0, 160)) : null,
        words: words.filter(w => new RegExp(w, 'i').test(text)),
        length: text.length,
      };
    }, link, (process.env.WORDS || '').split(',').filter(Boolean));
    console.log(JSON.stringify({ url, ...info }));
  }
} finally {
  await browser.close();
}
