// End-to-end test of the Android phone check on a running emulator or test phone, through adb.
//
//   node tools/android-e2e.mjs [--apk=path] [--keep]
//
// It installs Spare Key and a planted test app (android/planted: does nothing, only holds access), turns on each kind
// of access a phone-watching app asks for (accessibility, device admin, notification access, location all the time,
// texts), then drives the real app: the check, the plan, Under the hood, Quick exit, and the practice phone. It checks
// that the planted app is found by the right code, that apps that came with the phone are not listed, that nothing
// naming an app reaches "What left this phone", and that Quick exit closes the app and leaves no recent-apps entry.
// The planted app is removed at the end (--keep leaves it). Use an emulator or a test phone only: it changes settings.
//
// Report: docs/evidence/android-e2e.json (test app names only; nothing from a real person's phone).
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const APK = arg('apk') || resolve(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');
const PLANTED_APK = resolve(ROOT, 'android/planted/build/outputs/apk/debug/planted-debug.apk');
const KEEP = process.argv.includes('--keep');
const APP = 'app.web.sparekey';
const P = 'com.example.planted';
const SDK = process.env.ANDROID_HOME || 'C:/Users/ujwal/AppData/Local/Android/Sdk';
const ADB = existsSync(`${SDK}/platform-tools/adb.exe`) ? `${SDK}/platform-tools/adb.exe` : 'adb';

const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 32 << 20 }).replace(/\r/g, '');
const shell = cmd => adb('shell', cmd);
const pause = ms => new Promise(r => setTimeout(r, ms));
const checks = [];
const check = (name, ok, note = '') => { checks.push({ name, ok: !!ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`); };

// ---- Reading the screen -----------------------------------------------------------------------------------------
function screen() {
  // uiautomator can fail while the screen is still moving: an empty read, and the caller looks again.
  let xml = '';
  try { xml = shell('rm -f /sdcard/sk-ui.xml; uiautomator dump /sdcard/sk-ui.xml >/dev/null 2>&1; cat /sdcard/sk-ui.xml 2>/dev/null || true'); } catch {}
  lastXml = xml;
  const nodes = [];
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?(?:content-desc="([^"]*)")?[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    const text = m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#10;/g, '\n');
    nodes.push({ text, desc: m[2] || '', x: (+m[3] + +m[5]) >> 1, y: (+m[4] + +m[6]) >> 1 });
  }
  return nodes;
}
const texts = () => screen().map(n => n.text).filter(Boolean);
/** Clickable things on screen smaller than 48dp either way (Android's minimum touch target), as "WxH" in dp. */
let lastXml = '';
function smallTargets() {
  const dp = +shell('wm density').match(/(\d+)\s*$/m)[1] / 160;
  const small = [];
  for (const m of lastXml.matchAll(/<node [^>]*?package="app\.web\.sparekey"[^>]*?clickable="true"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    const w = (+m[3] - +m[1]) / dp, h = (+m[4] - +m[2]) / dp;
    // A target cut off by the edge of the screen is only partly on screen, not small.
    if (+m[2] < 150 || +m[4] > 2250) continue;
    if (w < 47.5 || h < 47.5) small.push(`${Math.round(w)}x${Math.round(h)}`);
  }
  return small;
}
async function waitFor(pred, ms = 60000, what = '') {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const nodes = screen();
    const hit = nodes.find(pred);
    if (hit) return hit;
    // Android's own "isn't responding" dialog on a slow emulator: choose Wait.
    const wait = nodes.find(n => n.text === 'Wait');
    if (wait) shell(`input tap ${wait.x} ${wait.y}`);
    await pause(1500);
  }
  throw new Error(`Timed out waiting for ${what}`);
}
const tap = n => shell(`input tap ${n.x} ${n.y}`);
async function tapText(t, ms) { const n = await waitFor(x => x.text === t, ms, `"${t}"`); tap(n); await pause(800); return n; }
/** Scrolls to the end, gathering every line of text on the way. */
async function readAll(until) {
  const seen = [];
  for (let i = 0; i < 14; i++) {
    const now = texts();
    for (const t of now) if (!seen.includes(t)) seen.push(t);
    if (until && now.includes(until)) break;
    shell('input swipe 540 1900 540 700 350');
    await pause(700);
  }
  return seen;
}
async function scrollTo(t) {
  for (let i = 0; i < 14; i++) {
    const n = screen().find(x => x.text === t);
    if (n && n.y < 2290) return n;
    shell('input swipe 540 1900 540 900 350');
    await pause(700);
  }
  throw new Error(`Could not find "${t}"`);
}
async function scrollTop() { for (let i = 0; i < 6; i++) shell('input swipe 540 700 540 2000 200'); await pause(500); }

// ---- Run ------------------------------------------------------------------------------------------------------------
const report = { at: new Date().toISOString(), device: {}, checks };
const devices = adb('devices').split('\n').slice(1).filter(l => /\tdevice$/.test(l));
if (!devices.length) { console.error('No emulator or phone attached.'); process.exit(2); }
report.device = { model: shell('getprop ro.product.model').trim(), android: shell('getprop ro.build.version.release').trim(), sdk: +shell('getprop ro.build.version.sdk').trim() };
console.log(`Device: ${report.device.model}, Android ${report.device.android} (API ${report.device.sdk})`);

adb('install', '-r', APK);
adb('install', '-r', '-t', PLANTED_APK);
// Plant: each kind of access, turned on the way a person holding the phone would, through Settings (here, adb).
shell(`settings put secure enabled_accessibility_services ${P}/${P}.Watch`);
shell('settings put secure accessibility_enabled 1');
shell(`cmd notification allow_listener ${P}/${P}.Listen`);
try { shell(`dpm set-active-admin ${P}/.Admin`); } catch (e) { if (!/already/.test(String(e.stderr || e.message))) throw e; }
for (const perm of ['ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'READ_SMS']) shell(`pm grant ${P} android.permission.${perm}`);

try {
  // 1. The real check.
  shell(`am force-stop ${APP}`);
  shell(`am start -n ${APP}/.MainActivity`);
  const start = await waitFor(n => n.text === 'Check this phone', 90000, 'the first screen');
  const nanoLine = texts().find(t => /Gemini Nano/.test(t)) || '';
  report.nano = /is ready/.test(nanoLine) ? 'available' : /can't run/.test(nanoLine) ? 'unavailable' : 'downloadable';
  check('First screen shows the hotline and Quick exit', texts().includes('Call 1-800-799-7233') && texts().includes('Quick exit'));
  await pause(2500); // the rules engine starts in the sandbox; the button is enabled when it is ready
  tap(start);
  const t0 = Date.now();
  await waitFor(n => n.text === 'What we found on this phone', 240000, 'the results');
  report.checkSeconds = Math.round((Date.now() - t0) / 100) / 10;
  const results = await readAll('Make my plan');
  const iPlanted = results.indexOf('System Update Service');
  check('The planted app is found', iPlanted >= 0);
  check('It is listed as an app that can watch and control this phone', results[iPlanted + 1] === 'An app can watch and control this phone', results[iPlanted + 1]);
  check('It is the first finding', results.findIndex(t => /^An app can/.test(t)) === iPlanted + 1);
  check('The card says what the app can do, in words', results.includes('Can read and control the screen') && results.includes('Is a device admin app') && results.includes('Is this yours?'));
  check('Apps that came with the phone are not listed', !results.includes('Android System Intelligence'));
  check('They are counted under Not checked, with the rooted-phone caution', results.some(t => /came with this phone .* rooted/s.test(t)));
  check('A caution about being noticed is on the card', results.some(t => /notice|alert|told/.test(t)));
  const summary = results.find(t => /^Spare Key read \d+ apps/.test(t)) || '';
  report.summary = summary;
  if (report.device.sdk >= 37) check('USB debugging is listed as not checked on Android 17', results.some(t => /^USB debugging: Android does not let/.test(t)));
  check('Every button on the results is at least 48dp', smallTargets().length === 0, smallTargets().join(' '));
  check('No reassurance words', !results.some(t => /\b(safe|secure|all clear|nothing to worry)\b/i.test(t)));

  // 2. Mark the planted app, then make the plan.
  await scrollTop();
  await tapText('Not mine');
  const make = await scrollTo('Make my plan');
  tap(make); await pause(1200);
  await waitFor(n => /^Is now a good time/.test(n.text), 30000, 'the plan questions');
  check('A new screen opens at its top', screen().some(n => n.text === 'Your plan' && n.y < 900));
  await tapText('No');
  const go = await scrollTo('Make my plan');
  tap(go);
  const t1 = Date.now();
  const note = await waitFor(n => /^(Ordered by|This plan was made|Gemini Nano did not|The cloud did not|Practice check)/.test(n.text), 180000, 'the plan');
  report.planSeconds = Math.round((Date.now() - t1) / 100) / 10;
  report.planNote = note.text;
  check('A plan is made', true, note.text);
  const plan = await readAll('Back to what was found');
  const steps = plan.filter(t => /^\d+\. /.test(t));
  report.planSteps = steps;
  check('The plan says to wait on removing the watching app when now is not a good time', steps.some(t => /^\d+\. Leave for a better time: An app can watch and control this phone/.test(t)), steps.join(' | '));
  check('The plan points to an advocate', steps.some(t => /Talk to an advocate/.test(t)));
  check('The hotline is on the plan', plan.some(t => /1-800-799-7233/.test(t)));

  // 3. Under the hood: what left this phone.
  await scrollTop();
  await tapText('Under the hood');
  const hood = await readAll();
  const left = hood.join('\n');
  const ledgerCount = +((left.match(/What left this phone \((\d+)\)/) || [])[1] || 0);
  report.ledgerEntries = ledgerCount;
  report.sent = hood.slice(hood.findIndex(t => /^What left this phone/.test(t)) + 1).map(t => t.length > 400 ? `${t.slice(0, 400)} ... (${t.length} characters)` : t);
  check('Under the hood lists what Spare Key did, with timings', /What Spare Key did \(\d+\)/.test(left) && /Check finished in [\d.]+ s/.test(left));
  check('It says no usage or crash reports are sent', /sends no usage or crash reports/.test(left));
  check('Under the hood says where each step runs', /Reading this phone/.test(left) && /App Check/.test(left));
  check('Nothing naming an app left this phone', !/System Update Service|com\.example|planted/i.test(left), `${ledgerCount} sent`);
  if (/^Ordered by .* from finding types only/.test(note.text)) check('The cloud plan request is in the ledger, word for word', ledgerCount >= 1 && /phone\.app\.control/.test(left));

  // 4. Quick exit.
  await tapText('Quick exit');
  await pause(2500);
  const top = shell('dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" | head -1');
  const recents = shell('dumpsys activity recents | grep -E "baseIntent|realActivity" || true');
  check('Quick exit leaves Spare Key', !top.includes(APP), top.trim().replace(/\s+/g, ' ').slice(0, 120));
  check('Quick exit leaves no recent-apps entry', !recents.includes(APP));

  // 5. The practice phone.
  shell(`am start -n ${APP}/.MainActivity`);
  await tapText('Try a practice phone first', 60000);
  await waitFor(n => n.text === "What we found on Jordan's phone", 240000, 'the practice results');
  const practice = await readAll('Make my plan');
  const want = ['System Update Service', 'Notify Mirror', 'Password Keeper', 'Family Finder', 'Weather Now'];
  check('The practice phone finds its five apps', want.every(w => practice.some(t => t.startsWith(w))), want.filter(w => !practice.some(t => t.startsWith(w))).join(', '));
  check('The practice phone finds USB debugging', practice.includes('USB debugging is on'));
  check('The practice phone says it is made up', practice.some(t => /^Practice check/.test(t)));
  // 6. Back pressed twice quickly is Quick exit too.
  await tapText('Not mine');
  shell('input keyevent 4 4');
  await pause(2500);
  const top2 = shell('dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" | head -1');
  const recents2 = shell('dumpsys activity recents | grep -E "baseIntent|realActivity" || true');
  check('Back twice quickly leaves Spare Key and leaves no recent-apps entry', !top2.includes(APP) && !recents2.includes(APP));
  shell(`am start -n ${APP}/.MainActivity`);
  await waitFor(n => n.text === 'Before you start', 60000, 'the first screen again');
  check('After Quick exit, opening Spare Key again shows nothing from the last check', !texts().some(t => /Jordan|What we found/.test(t)));
  shell(`am force-stop ${APP}`);
} catch (e) {
  check('Run finished', false, e.message);
} finally {
  if (!KEEP) {
    shell(`am broadcast -n ${P}/.Release`); await pause(1500);
    shell('settings delete secure enabled_accessibility_services');
    try { adb('uninstall', P); } catch {}
  }
}

const failed = checks.filter(c => !c.ok).length;
report.passed = checks.length - failed;
report.failed = failed;
mkdirSync(resolve(ROOT, 'docs/evidence'), { recursive: true });
writeFileSync(resolve(ROOT, 'docs/evidence/android-e2e.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\n${report.passed} passed, ${failed} failed. Report: docs/evidence/android-e2e.json`);
process.exit(failed ? 1 : 0);
