// The guided phone check (web/phone-check.html), end to end in Chrome on the built site: an iPhone and an Android
// path, answers in, plan out. Checks that the plan follows the safety rules, that the person's answers change it, and
// that the page sends nothing anywhere after it loads. No cloud calls.
//   node build.mjs && node tools/phone-check-test.mjs [--shots]     writes docs/evidence/phone-check.json
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHROME } from './chrome-args.mjs';
import { serve } from './serve.mjs';

const shots = process.argv.includes('--shots');
const { url, close } = await serve(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const results = [];
const step = (name, ok, note = '') => { results.push({ name, ok: !!ok, note: String(note).slice(0, 200) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` (${note})` : ''}`); };
try {
  for (const run of [
    { os: 'iphone', yes: ['Find My'], unsure: ['Family'], situation: { living: 'together', safe_to_change_now: 'yes', children_shared: 'yes' } },
    { os: 'android', yes: ['Accessibility', 'Your phone plan'], unsure: [], situation: { living: 'apart', safe_to_change_now: 'yes' } },
    // "Anything else you know?": typed words, read on the device (the keyword reader here: headless Chrome has no Nano).
    { os: 'iphone', yes: [], unsure: [], situation: { safe_to_change_now: 'not_sure' }, told: 'He bought me this phone and set it up. We still live together.' },
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const after = [];
    let loaded = false;
    page.on('request', r => { if (loaded && !r.url().startsWith('data:')) after.push(r.url()); });
    await page.goto(`${url}/phone-check.html`, { waitUntil: 'networkidle0' });
    loaded = true;
    await page.click(`input[name="os"][value="${run.os}"]`);
    await page.waitForSelector('.place');
    // Answer each place: yes, not sure, or no, by its title.
    await page.evaluate(run => {
      for (const fs of document.querySelectorAll('.place')) {
        const title = fs.querySelector('legend').textContent;
        const v = run.yes.includes(title) ? 'yes' : run.unsure.includes(title) ? 'not_sure' : 'no';
        fs.querySelector(`input[value="${v}"]`).click();
      }
      for (const [k, v] of Object.entries(run.situation)) document.querySelector(`input[name="q-${k}"][value="${v}"]`).click();
    }, run);
    if (run.told) await page.type('#told-text', run.told);
    if (shots) { mkdirSync('tools/out/phone-check', { recursive: true }); await page.screenshot({ path: `tools/out/phone-check/${run.os}-ask.png`, fullPage: true }); }
    await page.click('#make-plan');
    await page.waitForSelector('#plan .plan');
    const plan = await page.evaluate(() => ({
      kinds: [...document.querySelectorAll('#plan .step')].map(s => s.dataset.action),
      titles: [...document.querySelectorAll('#plan .step-title')].map(t => t.textContent),
      text: document.querySelector('#plan').textContent,
    }));
    if (shots) await page.screenshot({ path: `tools/out/phone-check/${run.os}-plan.png`, fullPage: true });
    const n = run.yes.length + run.unsure.length + (run.told ? 1 : 0);
    step(`${run.os}: the plan starts with the record, then an advocate`, plan.kinds[0] === 'document' && plan.kinds[1] === 'talk_to_advocate', plan.kinds.join(' > '));
    step(`${run.os}: every place marked yes or not sure is in the plan (${n})`, plan.titles.length === n, plan.titles.join('; '));
    step(`${run.os}: no "safe", "secure" or "all clear" in the plan`, !/\b(safe|safely|secure|all clear)\b/i.test(plan.text));
    step(`${run.os}: the backup hotline is in the plan`, /1-866-331-9474/.test(plan.text));
    if (run.told) {
      step('told: the typed words add a step for the device they gave', /gave you or set up a device/i.test(plan.text), plan.titles.join('; '));
      step('told: "we still live together" fills the question left blank, so changes they may notice wait', !plan.kinds.includes('change_now'), plan.kinds.join(' > '));
      step('told: the typed words are not in the plan', !plan.text.includes('He bought me this phone'));
    } else if (run.os === 'iphone') {
      step('iphone: what the other person sees, from Apple’s own guide, is on the Find My step', /disappear from their Find My/.test(plan.text));
      step('iphone: shared children: a step for their devices', /Your children’s devices/.test(plan.text));
    } else {
      step('android: living apart, now a good time: the person can change things now', plan.kinds.includes('change_now'), plan.kinds.join(' > '));
      step('android: an app that may watch the phone comes first, with the note to use another device', plan.titles[0]?.startsWith('An app can read your screen') || /another phone|never had/i.test(plan.text), plan.titles[0]);
    }
    step(`${run.os}: nothing was sent after the page loaded`, after.length === 0, after.join(' '));
    await page.close();
  }
} finally {
  await browser.close();
  close();
}
const passed = results.filter(r => r.ok).length;
mkdirSync('docs/evidence', { recursive: true });
writeFileSync('docs/evidence/phone-check.json', JSON.stringify({ at: new Date().toISOString(), tool: 'node tools/phone-check-test.mjs', passed, of: results.length, results }, null, 1));
console.log(`${passed} of ${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
