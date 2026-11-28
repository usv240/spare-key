// Cuts the public clip of the real phone check from the private recordings tools/android-record-real.mjs made.
// Only screens that hold no app name are used: the check running, the summary (the list of apps below it blurred),
// and Under the hood (where each step runs, what left the phone, what Spare Key did). The status bar, which shows
// which apps have notifications, and the navigation bar are cropped away.
//
// The cut times are for the take of November 28, 2026, after its start (a video floating over the app) and its end
// (the notification shade) were trimmed off and deleted. A new take needs new times: look at it first.
//
//   node tools/android-real-clip.mjs [--dir=E:/spare-key-video-2]     writes <dir>/android-real.mp4
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = (process.argv.find(a => a.startsWith('--dir=')) || '--dir=E:/spare-key-video-2').slice(6);
const RAW = path.join(DIR, 'private-raw');
const marks = JSON.parse(readFileSync(path.join(RAW, 'android-real-marks.json'), 'utf8'));
const ff = a => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'pipe'] });

// The phone's status bar is the top 200 px and its navigation bar the bottom 72 px (dumpsys window, this phone).
const TOP = 200, BOTTOM = 72, [W, H] = marks.size;
const CH = H - TOP - BOTTOM;
const blurFrom = marks.a.results.blurFrom - TOP;   // in the cropped picture
const crop = `crop=${W}:${CH}:0:${TOP}`;
const out = 'scale=720:-2,fps=30,format=yuv420p';
// [file, from, to, blur the list of apps?]
const cuts = [
  ['real-a.mp4', 9.5, 14.5, false],    // Checking this phone: Gemini Nano sorting the apps, n of 14
  ['real-a.mp4', 17.2, 22.6, true],    // What we found on this phone: the summary; the apps below it blurred
  ['real-b.mp4', 2.0, 7.5, false],     // Under the hood: where each step runs
  ['real-b.mp4', 26.5, 31.5, false],   // What left this phone: the real request, word for word
  ['real-b.mp4', 40.2, 43.8, false],   // What Spare Key did: its log of this run, as counts
];
const parts = [];
cuts.forEach(([file, from, to, blur], i) => {
  const p = path.join(RAW, `cut-${i}.mp4`);
  const vf = blur
    ? `${crop},split[a][b];[b]crop=${W}:${CH - blurFrom}:0:${blurFrom},boxblur=40:4[bl];[a][bl]overlay=0:${blurFrom},${out}`
    : `${crop},${out}`;
  ff(['-ss', String(from), '-t', String(to - from), '-i', path.join(RAW, file), '-filter_complex', vf, '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', p]);
  parts.push(p);
});
const list = path.join(RAW, 'cuts.txt');
writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
const file = path.join(DIR, 'android-real.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', file]);
console.log(`wrote ${file}: ${cuts.reduce((s, c) => s + c[2] - c[1], 0).toFixed(1)} s, the list of apps blurred from y=${blurFrom} of ${CH}`);
