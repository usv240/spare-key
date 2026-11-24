// Records the made-up practice phone on a real phone: the first screen, Gemini Nano sorting the made-up apps on the
// device, the results, the plan, and Under the hood. Only invented apps are on screen. It changes no setting; turn on
// Do Not Disturb first so no notification lands on the recording, and look at the frames before using the clip.
//
//   node tools/android-record.mjs [--out=E:/spare-key-video-nano/android-practice-real.mp4]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const OUT = arg('out') || 'E:/spare-key-video-nano/android-practice-real.mp4';
const APP = 'app.web.sparekey';
const SDK = process.env.ANDROID_HOME || 'C:/Users/ujwal/AppData/Local/Android/Sdk';
const ADB = existsSync(`${SDK}/platform-tools/adb.exe`) ? `${SDK}/platform-tools/adb.exe` : 'adb';
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20, env }).replace(/\r/g, '');
const shell = cmd => adb('shell', cmd);
const pause = ms => new Promise(r => setTimeout(r, ms));

const [W, H] = shell('wm size').match(/(\d+)x(\d+)/).slice(1).map(Number);
const X = Math.round(W / 2);
function mine() {
  let xml = '';
  try { xml = shell('uiautomator dump /sdcard/sk-ui.xml >/dev/null 2>&1; cat /sdcard/sk-ui.xml 2>/dev/null || true'); } catch {}
  const nodes = [];
  for (const m of xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?package="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    if (m[1] && m[2] === APP) nodes.push({ text: m[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&'), x: (+m[3] + +m[5]) >> 1, y: (+m[4] + +m[6]) >> 1 });
  }
  return nodes;
}
async function waitFor(pred, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const hit = mine().find(pred); if (hit) return hit; await pause(700); }
  throw new Error(`Timed out waiting for ${what}`);
}
const tap = n => shell(`input tap ${n.x} ${n.y}`);
// A slow swipe, so the recording reads as a person scrolling.
const scroll = (frac = 0.36, ms = 1100) => shell(`input swipe ${X} ${Math.round(H * 0.72)} ${X} ${Math.round(H * (0.72 - frac))} ${ms}`);
async function scrollTo(t) {
  for (let i = 0; i < 30; i++) { const n = mine().find(x => x.text === t); if (n && n.y < H * 0.9) return n; scroll(0.34, 900); await pause(500); }
  throw new Error(`Could not find "${t}"`);
}
const top = async () => { for (let i = 0; i < 8; i++) shell(`input swipe ${X} ${Math.round(H * 0.3)} ${X} ${Math.round(H * 0.85)} 140`); await pause(400); };

shell(`am force-stop ${APP}`);
shell('rm -f /sdcard/sk-practice-real.mp4');
const rec = spawn(ADB, ['shell', 'screenrecord', '--time-limit', '170', '--bit-rate', '8000000', '/sdcard/sk-practice-real.mp4'], { env, stdio: 'ignore' });
await pause(1500);
const t0 = Date.now();
const mark = what => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} ${what}`);
try {
  shell(`monkey --pct-syskeys 0 -p ${APP} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`);
  await waitFor(n => n.text === 'Check this phone', 60000, 'the first screen');
  mark('first screen'); await pause(2200);
  // Down to the line that says Gemini Nano is on this phone.
  for (let i = 0; i < 6 && !mine().some(n => /Gemini Nano is ready on this phone/.test(n.text) && n.y < H * 0.8); i++) { scroll(0.3); await pause(500); }
  mark(mine().some(n => /Gemini Nano is ready/.test(n.text)) ? 'Gemini Nano is ready' : 'Gemini Nano line not found'); await pause(2600);
  await top();
  tap(await scrollTo('Try a practice phone first'));
  mark('practice check started');
  await waitFor(n => /^What we found on Jordan's phone/.test(n.text), 120000, 'the results');
  mark('results'); await pause(2600);
  for (let i = 0; i < 4; i++) { scroll(0.3, 1300); await pause(1500); }
  mark('results read');
  tap(await scrollTo('Make my plan')); await pause(1200);
  await waitFor(n => /^Is now a good time/.test(n.text), 30000, 'the questions');
  const no = mine().filter(n => n.text === 'No')[0]; if (no) { tap(no); await pause(900); }
  tap(await scrollTo('Make my plan'));
  await waitFor(n => /^\d+\. /.test(n.text), 30000, 'the plan');
  mark('plan'); await pause(2600);
  for (let i = 0; i < 3; i++) { scroll(0.3, 1300); await pause(1500); }
  await top();
  tap(await waitFor(n => n.text === 'Under the hood', 10000, 'the tab')); await pause(2400);
  mark('under the hood');
  for (let i = 0; i < 3; i++) { scroll(0.3, 1300); await pause(1500); }
  mark('done');
} finally {
  try { shell('pkill -INT screenrecord'); } catch {}
  await pause(4000);
  rec.kill();
  const exit = mine().find(n => n.text === 'Quick exit'); if (exit) tap(exit);
  await pause(1500);
  shell('input keyevent KEYCODE_HOME');
}
adb('pull', '/sdcard/sk-practice-real.mp4', OUT);
shell('rm -f /sdcard/sk-practice-real.mp4');
console.log(`wrote ${OUT} (${W}x${H})`);
