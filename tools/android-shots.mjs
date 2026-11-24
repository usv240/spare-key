// Screenshots of the Android app on a running emulator, through adb, for the website, the store listing and for
// looking at the design. It uses the practice phone (made-up apps), so nothing real is in a picture.
//
//   node tools/android-shots.mjs [--out=dir] [--dark] [--scale=2.0] [--real]
//
// --dark and --scale set the emulator's dark mode and text size for the run and put them back after.
// --real runs the real check instead (emulator only: the pictures then show the emulator's own apps).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const OUT = resolve(ROOT, arg('out') || 'docs/shots/android');
const DARK = process.argv.includes('--dark');
const REAL = process.argv.includes('--real');
const SCALE = arg('scale') || '1.0';
const APP = 'app.web.sparekey';
const SDK = process.env.ANDROID_HOME || 'C:/Users/ujwal/AppData/Local/Android/Sdk';
const ADB = existsSync(`${SDK}/platform-tools/adb.exe`) ? `${SDK}/platform-tools/adb.exe` : 'adb';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20 }).replace(/\r/g, '');
const shell = cmd => adb('shell', cmd);
const pause = ms => new Promise(r => setTimeout(r, ms));

function screen() {
  let xml = '';
  try { xml = shell('rm -f /sdcard/sk-ui.xml; uiautomator dump /sdcard/sk-ui.xml >/dev/null 2>&1; cat /sdcard/sk-ui.xml 2>/dev/null || true'); } catch {}
  return [...xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
    .map(m => ({ text: m[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&'), x: (+m[2] + +m[4]) >> 1, y: (+m[3] + +m[5]) >> 1 }));
}
async function find(t, ms = 90000, scroll = true) {
  const end = Date.now() + ms;
  let tries = 0;
  while (Date.now() < end) {
    const n = screen().find(x => (t instanceof RegExp ? t.test(x.text) : x.text === t) && x.y > 300 && x.y < 2290);
    if (n) return n;
    if (scroll && ++tries > 2) shell('input swipe 540 1800 540 1000 300');
    await pause(900);
  }
  throw new Error(`Could not find ${t}`);
}
const tap = async (t, ms) => { const n = await find(t, ms); shell(`input tap ${n.x} ${n.y}`); await pause(900); };
const top = async () => { for (let i = 0; i < 5; i++) shell('input swipe 540 700 540 2100 150'); await pause(600); };
let count = 0;
function shot(name) {
  const file = resolve(OUT, `${String(++count).padStart(2, '0')}-${name}${DARK ? '-dark' : ''}${SCALE !== '1.0' ? `-x${SCALE}` : ''}.png`);
  writeFileSync(file, execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
  console.log(file);
}
const down = async (n = 1) => { for (let i = 0; i < n; i++) shell('input swipe 540 1900 540 600 500'); await pause(900); };

mkdirSync(OUT, { recursive: true });
const before = { scale: shell('settings get system font_scale').trim(), night: /yes/.test(shell('cmd uimode night')) };
shell(`settings put system font_scale ${SCALE}`);
shell(`cmd uimode night ${DARK ? 'yes' : 'no'}`);
// A clean status bar for the pictures.
shell('settings put global sysui_demo_allowed 1');
shell('am broadcast -a com.android.systemui.demo -e command enter >/dev/null; am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0900 >/dev/null; am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null');
try {
  shell(`am force-stop ${APP}`);
  shell(`am start -n ${APP}/.MainActivity`);
  await find('Before you start', 90000, false);
  await pause(3500);
  shot('start');
  await tap(REAL ? 'Check this phone' : 'Try a practice phone first');
  await find(REAL ? 'What we found on this phone' : "What we found on Jordan's phone", 240000, false);
  await pause(800);
  shot('results');
  await down(); shot('results-card');
  await top();
  await tap('Not mine');
  await tap('Make my plan');
  await find(/^Is now a good time/, 30000, false);
  await tap('No');
  shot('questions');
  await tap('Make my plan');
  await find(/^(Ordered by|This plan was made|Practice check|The cloud did not|Gemini Nano did not)/, 180000, false);
  await top(); await pause(500);
  shot('plan');
  await down(); shot('plan-steps');
  await top();
  await tap('Under the hood');
  await pause(600);
  shot('hood');
  await down(2); shot('hood-sent');
  shell(`am force-stop ${APP}`);
} finally {
  shell('am broadcast -a com.android.systemui.demo -e command exit >/dev/null');
  shell(`settings put system font_scale ${before.scale === 'null' ? '1.0' : before.scale}`);
  shell(`cmd uimode night ${before.night ? 'yes' : 'no'}`);
}
