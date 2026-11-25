// "In your own words" (shared/told.js), measured on tools/told-cases.json: 40 statements written before either reader
// existed. Code's keyword reader runs offline; with --nano, Gemini Nano reads each statement through the extension's own
// offscreen page, on this computer (ONLY_ON_DEVICE). No cloud calls either way.
//   node tools/told-eval.mjs              the keyword reader only
//   node build.mjs && node tools/told-eval.mjs --nano     both, writes docs/evidence/told-eval.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { keywordTold, cleanTold } from '../shared/told.js';

const NANO = process.argv.includes('--nano');
const CASES = (process.argv.find(a => a.startsWith('--cases=')) || '--cases=tools/told-cases.json').slice(8);
const { cases } = JSON.parse(readFileSync(CASES, 'utf8'));

function score(answers) {
  let tp = 0, fp = 0, fn = 0, exact = 0, sitRight = 0, sitAsked = 0, sitWrongFill = 0;
  const misses = [];
  cases.forEach((c, i) => {
    const a = cleanTold(answers[i]);
    const want = new Set(c.codes), got = new Set(a.codes);
    const t = [...got].filter(x => want.has(x)).length;
    tp += t; fp += got.size - t; fn += want.size - t;
    const codesExact = t === want.size && got.size === want.size;
    let sitOk = true;
    for (const k of ['living', 'children_shared']) {
      if (c[k]) { sitAsked++; if (a[k] === c[k]) sitRight++; else sitOk = false; }
      else if (a[k] !== 'unclear') { sitWrongFill++; sitOk = false; }
    }
    if (codesExact && sitOk) exact++;
    else misses.push({ i, want: [...want], got: [...got], living: [c.living || 'unclear', a.living], children: [c.children_shared || 'unclear', a.children_shared] });
  });
  const r = x => Math.round(x * 1000) / 1000;
  return { cases: cases.length, exact, codes: { found: tp, wrongAdded: fp, missed: fn, precision: r(tp / (tp + fp || 1)), recall: r(tp / (tp + fn || 1)) },
    situation: { right: sitRight, of: sitAsked, filledWhenNotSaid: sitWrongFill }, misses };
}

const keyword = score(cases.map(c => keywordTold(c.text)));
console.log('keyword reader:', JSON.stringify({ ...keyword, misses: keyword.misses.length }));

let nano = null, nanoRaw = null;
if (NANO) {
  const { default: puppeteer } = await import('puppeteer-core');
  const { CHROME, NANO_PROFILE, builtInModelArgs, freshServiceWorkers } = await import('./chrome-args.mjs');
  freshServiceWorkers(NANO_PROFILE);
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, pipe: true, enableExtensions: [path.resolve('extension')], userDataDir: NANO_PROFILE,
    ignoreDefaultArgs: true, protocolTimeout: 900000, args: [...builtInModelArgs({ userDataDir: NANO_PROFILE }), '--no-first-run', '--window-size=900,700'],
  });
  try {
    const sw = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 60000 });
    const id = new URL(sw.url()).host;
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${id}/src/panel.html`);
    const ask = (type, options) => page.evaluate(async (type, options) => {
      await chrome.runtime.sendMessage({ type: 'sk:ensure-offscreen' });
      return chrome.runtime.sendMessage({ target: 'offscreen', type, options });
    }, type, options);
    const status = await ask('sk:nano-status', {});
    console.log('Gemini Nano:', status?.status);
    await ask('sk:nano-warm', {});
    nanoRaw = [];
    for (const [i, c] of cases.entries()) {
      const r = await ask('sk:told', { text: c.text });
      nanoRaw.push({ i, how: r?.how, ms: r?.ms, nanoError: r?.nanoError || null, answer: r?.answer });
      process.stdout.write(`${i + 1}/${cases.length} ${r?.how} ${r?.ms ?? ''}ms\r`);
    }
    console.log();
    const ran = nanoRaw.filter(x => x.how === 'nano').length;
    nano = { ...score(nanoRaw.map(x => x.answer)), ranOnNano: ran, medianMs: nanoRaw.filter(x => x.ms).map(x => x.ms).sort((a, b) => a - b)[Math.floor(ran / 2)] ?? null };
    console.log('Gemini Nano:', JSON.stringify({ ...nano, misses: nano.misses.length }));
  } finally { await browser.close(); }
}

mkdirSync('docs/evidence', { recursive: true });
writeFileSync(`docs/evidence/told-eval-${path.basename(CASES, '.json')}.json`, JSON.stringify({
  at: new Date().toISOString(), tool: 'node tools/told-eval.mjs' + (NANO ? ' --nano' : ''), cases: CASES,
  keyword, nano, nanoRaw,
}, null, 1));
