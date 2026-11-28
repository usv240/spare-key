// Records the REAL check on the builder's own phone for the demo video, and keeps the person's apps out of it.
// The raw recordings are written outside the repository (E:/spare-key-video-2/private-raw/) and are never published:
// part "a" shows the list of installed apps below the summary. tools/android-real-clip.mjs cuts the public clip from
// them: only the screens that hold no app name (the Gemini Nano line, the summary, Under the hood), with the list of
// apps blurred and the status bar cropped away.
//
// Ask the phone's owner first. Do Not Disturb on, no call running, phone unlocked. It changes no setting except
// holding the screen upright for the run (auto-rotate is put back afterwards).
//
//   node tools/android-record-real.mjs [--out=E:/spare-key-video-2/private-raw]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const OUT = arg('out') || 'E:/spare-key-video-2/private-raw';
mkdirSync(OUT, { recursive: true });
const APP = 'app.web.sparekey';
const SDK = process.env.ANDROID_HOME || 'C:/Users/ujwal/AppData/Local/Android/Sdk';
const ADB = existsSync(`${SDK}/platform-tools/adb.exe`) ? `${SDK}/platform-tools/adb.exe` : 'adb';
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20, env }).replace(/\r/g, '');
const shell = cmd => adb('shell', cmd);
const pause = ms => new Promise(r => setTimeout(r, ms));

const [W, H] = shell('wm size').match(/(\d+)x(\d+)/).slice(1).map(Number);
const X = Math.round(W / 2);
function nodes() {
  let xml = '';
  try { xml = shell('uiautomator dump /sdcard/sk-ui.xml >/dev/null 2>&1; cat /sdcard/sk-ui.xml 2>/dev/null || true'); } catch {}
  const out = [];
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?package="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    if (m[1] && m[2] === APP) out.push({ text: m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#10;/g, '\n'), x: (+m[3] + +m[5]) >> 1, y: (+m[4] + +m[6]) >> 1, top: +m[4], bottom: +m[6] });
  }
  return out;
}
async function waitFor(pred, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const hit = nodes().find(pred); if (hit) return hit; await pause(700); }
  throw new Error(`Timed out waiting for ${what}`);
}
const tap = n => shell(`input tap ${n.x} ${n.y}`);
// Slow drags with no fling, so nothing is skipped between two looks at the screen.
const scroll = (frac = 0.3, ms = 1300) => shell(`input swipe ${X} ${Math.round(H * 0.72)} ${X} ${Math.round(H * (0.72 - frac))} ${ms}`);
async function scrollTo(pred) {
  for (let i = 0; i < 60; i++) { const n = nodes().find(pred); if (n && n.y < H * 0.9 && n.y > H * 0.08) return n; scroll(); await pause(500); }
  throw new Error('Could not scroll to it');
}
const top = async () => { for (let i = 0; i < 14; i++) shell(`input swipe ${X} ${Math.round(H * 0.3)} ${X} ${Math.round(H * 0.85)} 140`); await pause(500); };

// Text that is Spare Key's own, on the screens the public clip uses. Anything else there is reported (letters masked),
// so a name cannot slip into the clip unseen.
const OWN = /^(Spare Key|Quick exit|Your check|Under the hood|Where each step runs|Reading this phone|Sorting the apps|Simpler words for a step|Ordering your plan|Prompt for the plan|Settings and switches|App Check|What left this phone \(\d+\)|What Spare Key did \(\d+\)|Plan request, [\d:]+|Answer to get_steps, [\d:]+|Hide the exact text|Show the exact text \(\d+ characters\)|\d{1,2}:\d{2}:\d{2}\s|Spare Key's rules|Gemini |Kept |Firebase |reCAPTCHA |Where each step runs, |\d+ findings by type only|The public steps for \d+ finding types|\{)/;
const unknown = list => list.filter(n => !OWN.test(n.text)).map(n => n.text.replace(/[A-Za-z]/g, 'x').slice(0, 50));

const rotate = shell('settings get system accelerometer_rotation').trim();
shell('settings put system accelerometer_rotation 0'); shell('settings put system user_rotation 0');
shell(`am force-stop ${APP}`);
const marks = { size: [W, H] };
// screenrecord stops at 3 minutes, so the run is two short recordings; the plan is made between them, off camera.
let tSpawn = 0, part = '';
const mark = (what, extra = {}) => {
  marks[part][what] = { t: +((Date.now() - tSpawn) / 1000).toFixed(2), ...extra };
  console.log(`${part} ${marks[part][what].t.toFixed(1).padStart(6)} ${what}${extra.note ? '  ' + extra.note : ''}`);
};
async function recording(name, run) {
  part = name; marks[part] = {};
  shell(`rm -f /sdcard/sk-real-${name}.mp4`);
  tSpawn = Date.now();
  const rec = spawn(ADB, ['shell', 'screenrecord', '--time-limit', '170', '--bit-rate', '10000000', `/sdcard/sk-real-${name}.mp4`], { env, stdio: 'ignore' });
  await pause(1800);
  try { await run(); } finally {
    try { shell('pkill -INT screenrecord'); } catch {}
    await pause(3500);
    rec.kill();
    try { adb('pull', `/sdcard/sk-real-${name}.mp4`, path.join(OUT, `android-real-${name}.mp4`)); } catch (e) { console.log('pull failed:', e.message.slice(0, 80)); }
    shell(`rm -f /sdcard/sk-real-${name}.mp4`);
  }
}
try {
  await recording('a', async () => {
    shell(`monkey --pct-syskeys 0 -p ${APP} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`);
    await waitFor(n => n.text === 'Check this phone', 90000, 'the first screen');
    mark('first screen'); await pause(2500);
    // Down to the line that says Gemini Nano is on this phone, and hold it.
    for (let i = 0; i < 8 && !nodes().some(n => /^Gemini Nano is ready on this phone/.test(n.text) && n.y < H * 0.85); i++) { scroll(0.5, 1300); await pause(400); }
    const ready = nodes().some(n => /^Gemini Nano is ready on this phone/.test(n.text));
    mark('nano line', { note: ready ? 'Gemini Nano is ready' : 'NOT ready' }); await pause(4500); mark('nano line end');
    if (!ready) throw new Error('Gemini Nano is not ready on the phone: restart AICore and run again');
    await top();
    tap(await scrollTo(n => n.text === 'Check this phone'));
    mark('check started');
    await waitFor(n => /^What we found on this phone/.test(n.text), 240000, 'the results');
    await pause(1200);
    // The top of the results, held still: everything below the first group heading is the list of apps.
    const now = nodes();
    const summary = now.find(n => /^Spare Key read \d+ apps/.test(n.text));
    const heading = now.find(n => /^[A-Z][^()]{4,60} \(\d+\)$/.test(n.text) && n.top > (summary?.bottom || 0));
    const blurFrom = heading ? heading.bottom + 12 : (summary ? summary.bottom + 120 : Math.round(H * 0.4));
    mark('results', { blurFrom, headingAt: heading?.top ?? null, note: `blur from y=${blurFrom}` });
    await pause(5500); mark('results end');
  });
  // The plan, so that "What left this phone" holds the real request. Its screens name apps, so they are not recorded.
  tap(await scrollTo(n => n.text === 'Make my plan')); await pause(1200);
  await waitFor(n => /^Is now a good time/.test(n.text), 30000, 'the questions');
  const no = nodes().filter(n => n.text === 'No')[0]; if (no) { tap(no); await pause(700); }
  tap(await scrollTo(n => n.text === 'Make my plan'));
  await waitFor(n => /^\d+\. /.test(n.text), 30000, 'the plan');
  const note = await waitFor(n => /^(Ordered by|This plan was made|Gemini Nano did not|The cloud (did not|took))/.test(n.text), 120000, 'the plan note');
  marks.planNote = note.text;
  console.log('plan:', note.text.slice(0, 110));
  await top();
  tap(await waitFor(n => n.text === 'Under the hood', 10000, 'the tab')); await pause(2000);
  await recording('b', async () => {
    let seen = nodes();
    mark('hood', { unknown: unknown(seen) }); await pause(5000); mark('hood end');
    // What left this phone: the real request, with its exact text opened.
    const sent = await scrollTo(n => /^What left this phone \(\d+\)/.test(n.text));
    shell(`input swipe ${X} ${sent.y} ${X} ${Math.round(H * 0.16)} 1500`); await pause(900);
    const show = nodes().find(n => /^Show the exact text \(\d+ characters\)/.test(n.text));
    if (show) { tap(show); await pause(1500); }
    seen = nodes();
    mark('left', { unknown: unknown(seen), note: (seen.find(n => /^What left this phone/.test(n.text)) || {}).text }); await pause(6500); mark('left end');
    // What Spare Key did: its own log of the run, as counts.
    const did = await scrollTo(n => /^What Spare Key did \(\d+\)/.test(n.text));
    shell(`input swipe ${X} ${did.y} ${X} ${Math.round(H * 0.16)} 1500`); await pause(1200);
    seen = nodes();
    mark('did', { unknown: unknown(seen) }); await pause(6500); mark('did end');
  });
} finally {
  const exit = nodes().find(n => n.text === 'Quick exit'); if (exit) tap(exit);
  await pause(1500);
  shell('input keyevent KEYCODE_HOME');
  shell(`settings put system accelerometer_rotation ${rotate === '0' ? 0 : 1}`);
  shell('rm -f /sdcard/sk-ui.xml');
  writeFileSync(path.join(OUT, 'android-real-marks.json'), JSON.stringify(marks, null, 1));
}
console.log(`wrote ${OUT}/android-real-a.mp4, android-real-b.mp4 and android-real-marks.json. Private: part a shows the phone's apps.`);
