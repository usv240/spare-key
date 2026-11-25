// Runs the real check on a person's own phone over USB and reports numbers only: how many apps were read and listed,
// how long each part took, whether Gemini Nano ran on the phone, and what left it. Unlike android-e2e.mjs it plants
// nothing, clears nothing but Spare Key's own state, and changes no setting on the phone.
//
// App names are on the screen, so this tool sees them. It never prints them: everything it read is written to
// private/android-real.json (the private/ folder is not in the repository), and the summary it prints, and
// docs/evidence/android-real.json, hold counts, timings and Spare Key's own sentences only.
//
//   node tools/android-real.mjs [--apk=path] [--no-cloud] [--practice] [--webview-rules] [--label=text]
//   --practice runs the made-up practice phone instead (nothing on the phone is read), and prints what Gemini Nano
//   said about each made-up app: those names are invented, so they can be shown.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const APK = arg('apk') || resolve(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');
const NO_CLOUD = process.argv.includes('--no-cloud');
const PRACTICE = process.argv.includes('--practice');
// --webview-rules: a debug build runs its rules in the WebView backup instead of the JavaScript sandbox, to test the backup.
const WEBVIEW_RULES = process.argv.includes('--webview-rules');
const APP = 'app.web.sparekey';
const SDK = process.env.ANDROID_HOME || 'C:/Users/ujwal/AppData/Local/Android/Sdk';
const ADB = existsSync(`${SDK}/platform-tools/adb.exe`) ? `${SDK}/platform-tools/adb.exe` : 'adb';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).replace(/\r/g, '');
const shell = cmd => adb('shell', cmd);
const pause = ms => new Promise(r => setTimeout(r, ms));
const secs = t => Math.round((Date.now() - t) / 100) / 10;

const [W, H] = shell('wm size').match(/(\d+)x(\d+)/).slice(1).map(Number);
const X = Math.round(W / 2);
function screen() {
  let xml = '';
  try { xml = shell('uiautomator dump /sdcard/sk-ui.xml >/dev/null 2>&1; cat /sdcard/sk-ui.xml 2>/dev/null || true'); } catch {}
  const nodes = [];
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?package="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    const text = m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#10;/g, '\n');
    if (text) nodes.push({ text, pkg: m[2], x: (+m[3] + +m[5]) >> 1, y: (+m[4] + +m[6]) >> 1 });
  }
  return nodes;
}
const mine = () => screen().filter(n => n.pkg === APP);
async function waitFor(pred, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = mine().find(pred);
    if (hit) return hit;
    shell('input keyevent KEYCODE_WAKEUP');   // keeps the screen on while waiting; it changes no setting
    await pause(1200);
  }
  throw new Error(`Timed out waiting for ${what}`);
}
const tap = n => shell(`input tap ${n.x} ${n.y}`);
const swipeUp = () => shell(`input swipe ${X} ${Math.round(H * 0.70)} ${X} ${Math.round(H * 0.36)} 900`);
async function scrollTo(t) {
  for (let i = 0; i < 60; i++) {
    const n = mine().find(x => x.text === t);
    if (n && n.y < H * 0.93) return n;
    swipeUp(); await pause(600);
  }
  throw new Error(`Could not find "${t}"`);
}
/** Scrolls to the end, gathering every line on the way. */
async function readAll(until) {
  const seen = [];
  for (let i = 0; i < 120; i++) {
    const now = mine().map(n => n.text);
    const before = seen.length;
    for (const t of now) if (!seen.includes(t)) seen.push(t);
    if (until && now.includes(until)) break;
    if (i > 3 && seen.length === before && !until) break;
    swipeUp(); await pause(600);
  }
  return seen;
}
async function scrollTop() { for (let i = 0; i < 14; i++) shell(`input swipe ${X} ${Math.round(H * 0.3)} ${X} ${Math.round(H * 0.85)} 150`); await pause(500); }

// The family of phone only ("Pixel"), not the exact model: this is a person's own phone.
const report = { at: new Date().toISOString(), device: { model: shell('getprop ro.product.model').trim().split(/\s+/)[0], android: shell('getprop ro.build.version.release').trim(), sdk: +shell('getprop ro.build.version.sdk').trim() } };
const raw = { at: report.at };
console.log(`Device: ${report.device.model} (model not recorded), Android ${report.device.android} (API ${report.device.sdk}), ${W}x${H}`);
report.dark = /yes/.test(shell('cmd uimode night'));
report.fontScale = +shell('settings get system font_scale').trim() || 1;
report.appsInstalled = shell('pm list packages --user 0').split('\n').filter(l => l.startsWith('package:')).length;
report.appsAdded = shell('pm list packages --user 0 -3').split('\n').filter(l => l.startsWith('package:')).length;

adb('install', '-r', '--user', '0', APK);
shell(`pm clear --user 0 ${APP}`);
if (WEBVIEW_RULES) shell(`run-as ${APP} sh -c 'mkdir -p files && touch files/force-webview-rules'`);
shell('logcat -c');
// Spare Key's own log lines, kept as they are written: a busy phone's log is overwritten within seconds.
let ownLog = '';
const logcat = spawn(ADB, ['logcat', '-v', 'tag', '-s', 'SpareKey:V'], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
logcat.stdout.on('data', d => { ownLog += d; });
const uid = shell(`pm list packages --user 0 -U ${APP}`).match(/uid:(\d+)/)?.[1];

// 1. First screen.
const t0 = Date.now();
shell(`monkey --pct-syskeys 0 -p ${APP} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`);
await waitFor(n => n.text === 'Before you start', 60000, 'the first screen');
report.firstScreenSeconds = secs(t0);
await waitFor(n => n.text === 'Check this phone', 90000, 'Check this phone');
const first = await readAll('Text START to 88788');
raw.first = first;
report.nanoLine = first.find(t => /Gemini Nano/.test(t)) || '';
report.hotlineOnFirstScreen = first.some(t => /1-800-799-7233/.test(t));
if (NO_CLOUD) { const sw = mine().find(n => /Plan help from Gemini in the cloud/.test(n.text)); if (sw) { tap(sw); await pause(600); } }
await scrollTop();

// 2. The check.
const go = await scrollTo(PRACTICE ? 'Try a practice phone first' : 'Check this phone');
tap(go);
const t1 = Date.now();
const title = await waitFor(n => /^What we found on (this|Jordan's) phone/.test(n.text) || n.text === 'Show results now', 120000, 'the check');
report.listedAfterSeconds = secs(t1);
if (title.text === 'Show results now') {
  // Every app is listed already; Gemini Nano is adding its notes. Wait for it, up to 6 minutes.
  report.nanoWorking = true;
  await waitFor(n => /^What we found on (this|Jordan's) phone/.test(n.text), 360000, 'the results').catch(async () => { const b = mine().find(n => n.text === 'Show results now'); if (b) { tap(b); report.nanoCutShort = true; } await waitFor(n => /^What we found on (this|Jordan's) phone/.test(n.text), 30000, 'the results'); });
}
report.checkSeconds = secs(t1);
const results = await readAll('Make my plan');
raw.results = results;
const m = results.join('\n').match(/read (\d+) apps? with special access and listed (\d+) things?/);
report.appsWithAccess = m ? +m[1] : null;
report.listed = m ? +m[2] : results.some(t => /did not find an app here/.test(t)) ? 0 : null;
report.sortedBy = (results.find(t => /Gemini Nano sorted \d+ apps|Sorted by Spare Key's rules/.test(t)) || '').replace(/^.*?·\s*/, '');
report.groups = results.filter(t => /^[A-Z][^()]{4,60} \(\d+\)$/.test(t) && !/^\d/.test(t));
report.builtInLine = (results.find(t => /apps that came with this phone/.test(t)) || '').replace(/\..*$/, '.');
report.nanoNotes = results.filter(t => /^Gemini Nano on this phone:/.test(t)).length;
report.outsidePlayStore = results.filter(t => /^Installed from outside the Play Store\.$/.test(t)).length;
report.usbDebuggingFound = results.includes('USB debugging is on');
report.reassuranceWords = results.filter(t => /\b(safe|secure|all clear|nothing to worry)\b/i.test(t)).length;

if (PRACTICE) {
  // Made-up apps: what Gemini Nano said about each can be shown.
  logcat.kill();
  console.log(JSON.stringify({ sortedBy: report.sortedBy, groups: report.groups, checkSeconds: report.checkSeconds }, null, 1));
  let app = '';
  for (const t of results) {
    if (/^(System Update Service|Family Finder|Notify Mirror|Weather Now|Password Keeper)$/.test(t)) app = t;
    if (/^Gemini Nano on this phone:/.test(t)) console.log(`${app}: ${t}`);
  }
  // The app's own log of what it did (kinds as counts).
  await scrollTop();
  tap(await waitFor(n => n.text === 'Under the hood', 10000, 'the tab')); await pause(1500);
  for (const t of await readAll()) if (/Gemini Nano/.test(t) && /sorted|reading|available/.test(t)) console.log(t.replace(/^[\d:]+\s*(AM|PM)?\s*/i, ''));
  const exit = mine().find(n => n.text === 'Quick exit'); if (exit) tap(exit);
  process.exit(0);
}

// 3. The plan.
tap(await scrollTo('Make my plan')); await pause(1200);
await waitFor(n => /^Is now a good time/.test(n.text), 30000, 'the plan questions');
const no = mine().filter(n => n.text === 'No')[0]; if (no) { tap(no); await pause(500); }
tap(await scrollTo('Make my plan'));
const t2 = Date.now();
await waitFor(n => /^\d+\. /.test(n.text), 30000, 'the first plan');
report.planShownSeconds = secs(t2);
const note = await waitFor(n => /^(Ordered by|This plan was made|Gemini Nano did not|The cloud (did not|took))/.test(n.text), 120000, 'the plan');
report.planSeconds = secs(t2);
report.planNote = note.text;
const plan = await readAll('Back to what was found');
raw.plan = plan;
report.planSteps = plan.filter(t => /^\d+\. /.test(t)).map(t => t.replace(/\(\d+\)/, '(n)')).length;
report.planStepKinds = [...new Set(plan.filter(t => /^\d+\. /.test(t)).map(t => t.replace(/^\d+\. /, '').replace(/:.*$/, '').replace(/ \(\d+\)$/, '')))];
report.screenshotCaution = plan.some(t => /^On this phone, do not use a screenshot/.test(t));

// 4. Under the hood.
await scrollTop();
tap(await waitFor(n => n.text === 'Under the hood', 10000, 'the tab')); await pause(1500);
const hood = await readAll();
raw.hood = hood;
const after = (label) => { const i = hood.indexOf(label); return i >= 0 ? hood[i + 1] || '' : ''; };
report.where = { reading: after('Reading this phone'), sorting: after('Sorting the apps'), simpler: after('Simpler words for a step'), plan: after('Ordering your plan'), appCheck: after('App Check') };
report.leftThisPhone = +(hood.find(t => /^What left this phone \(\d+\)/.test(t))?.match(/\((\d+)\)/)?.[1] ?? -1);
report.did = hood.filter(t => /^\d{1,2}:\d{2}:\d{2}/.test(t)).map(t => t.replace(/^[\d:]+\s*(AM|PM)?\s*/i, '')).filter(t => !/[A-Z][a-z]+ [A-Z][a-z]+ \(/.test(t)).slice(0, 12);

// What Android's log says the app did, by Spare Key's own tag: counts only.
await pause(800); logcat.kill();
const log = ownLog;
report.modelErrors = log.split(/\n/).filter(l => /^W\/SpareKey/.test(l) && /plan:|simpler:|nano download/.test(l)).map(l => l.replace(/^W\/SpareKey\s*:\s*/, '').slice(0, 400));
report.kotlinChecks = (log.match(/outgoing checked in Kotlin/g) || []).length;
report.nanoLogLines = log.split('\n').filter(l => /nano|Nano/.test(l)).map(l => l.replace(/^.*SpareKey\s*:\s*/, '').slice(0, 160)).slice(0, 8);

// 5. Quick exit, then make sure nothing is left on screen from the check.
const exit = mine().find(n => n.text === 'Quick exit');
if (exit) { tap(exit); await pause(2500); }
report.quickExitLeft = !shell('dumpsys activity activities | grep -m1 topResumedActivity || true').includes(APP);
shell('input keyevent KEYCODE_HOME');

mkdirSync(resolve(ROOT, 'private'), { recursive: true });
writeFileSync(resolve(ROOT, 'private/android-real.json'), JSON.stringify({ report, raw }, null, 1));
mkdirSync(resolve(ROOT, 'docs/evidence'), { recursive: true });
// Every run is kept, so a change between runs (Gemini Nano downloaded, a rule changed) can be seen.
const evidence = resolve(ROOT, 'docs/evidence/android-real.json');
let all = { note: "Runs of the real check on the builder's own phone over USB (tools/android-real.mjs). Counts, timings and Spare Key's own sentences only: no app name is in this file.", runs: [] };
try { const old = JSON.parse(readFileSync(evidence, 'utf8')); if (Array.isArray(old.runs)) all = old; } catch { /* first run */ }
report.label = arg('label') || '';
all.runs.push(report);
writeFileSync(evidence, JSON.stringify(all, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
