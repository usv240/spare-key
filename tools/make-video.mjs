// Builds the demo video from the footage tools/record-demo.mjs saved (the real extension on the practice pages), slides
// drawn here, and narration with burned-in captions. Every number is from README.md "Results" and docs/evidence/.
//   voice: edge-tts (Microsoft neural voice; only the narration text below is sent to Microsoft's speech service)
//   node tools/record-demo.mjs && node tools/make-video.mjs [--out=E:/spare-key-video] [--voice=en-US-AvaNeural] [--rate=+4%]
// Writes <out>/spare-key-demo.mp4 (1920x1080, 30 fps) and <out>/spare-key-demo.srt.
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHROME } from './chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const OUT = opt('out', 'E:/spare-key-video');
const VOICE = opt('voice', 'en-US-AvaNeural');
const RATE = opt('rate', '+4%');
const W = 1920, H = 1080, FPS = 30;
const work = path.join(OUT, 'build');
mkdirSync(work, { recursive: true });
const FONTS = path.join(OUT, 'fonts');
if (!existsSync(path.join(FONTS, 'AtkinsonHyperlegibleNext.ttf'))) throw new Error(`Convert extension/fonts/AtkinsonHyperlegibleNext-latin.woff2 to ${FONTS}/AtkinsonHyperlegibleNext.ttf (fontTools)`);
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).toString();
const ff = a => run('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
const duration = f => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));
const esc = p => p.replace(/\\/g, '/').replace(':', '\\:');
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const M = read(path.join(OUT, 'marks.json'));

// ---- Scenes: narration, and what is on screen. "panel" footage runs from..to (seconds on the recorder's clock). ----
// "Break the pages first", recorded by tools/record-break.mjs: the numbers in its narration are the page's own result lines.
const B = M.break || null;
const num = (line, re) => Number((String(line || '').match(re) || [])[1] || 0);
const breakSay = B && (() => {
  const w = B.lines?.without || '';
  const code = num(w, /code reader read (\d+)/), total = num(w, /read \d+ of (\d+)/), nano = num(w, /read (\d+) more/), not = num(w, /(\d+) could not be read/);
  return `Sites change their pages. Here every practice page is changed four ways at once. The code reader still reads ${code} of ${total} checks. Gemini Nano reads ${nano} more, on this computer.${not ? ` ${not === 1 ? 'One page it cannot read is' : `The ${not} it cannot read are`} listed as not checked, never as empty.` : ''}`;
})();
const fixSay = B && (() => {
  const f = B.lines?.withFix || '';
  const code = num(f, /code reader read (\d+)/), total = num(f, /read \d+ of (\d+)/);
  return `Then the fix: new words and places to look, fetched from Firebase Remote Config, with no update to install. The code reads ${code} of ${total} again.`;
})();
const PHONE_CLIP = path.join(OUT, 'android-practice.mp4');
const scenes = [
  { key: 'hook', slide: 'hook',
    say: 'When someone leaves an abusive partner, that person often still has a way in: a signed-in phone, mail copied to another address, a shared location. And 60 percent of AI chatbot answers to survivors left out critical safety warnings.' },
  { key: 'hybrid', slide: 'hybrid',
    say: 'Here is the idea. The settings pages name the other person, so Gemini Nano reads them on the device, with no cloud fallback, on purpose. The cloud gets only codes, and asks the device yes-or-no questions.' },
  { key: 'safety', panel: [M.safety - 0.5, M.choose + 3], slide: 'side', head: 'Read-only. Quick exit on every screen.', sub: 'Spare Key is a free Chrome extension. It reads your own settings pages and changes nothing.',
    say: 'Spare Key is a free Chrome extension and Android app. It reads your own settings pages and changes nothing. Quick exit is on every screen.' },
  { key: 'scan', panel: [M.start - 0.3, M.results + 0.5], tab: 'tab-1', slide: 'side', head: 'Gemini Nano sorts every entry, on this computer.', sub: 'Firebase AI Logic, on-device only: these pages are the private data. Practice pages for a made-up person, Jordan.',
    say: 'It opens each settings page beside the panel. Code reads it, and Gemini Nano sorts every entry through Firebase AI Logic, in on-device-only mode.' },
  { key: 'results', panel: [M.results, M['not checked'] + 1], slide: 'side', head: 'What the other person could do, and what they may notice.', sub: 'Each card says what removing it does, from Google\'s own help pages. Anything not read is listed as not checked.',
    say: 'It lists what it found by what the other person could do, and what they may notice if you remove it, from Google\'s own help pages. Anything it could not read is listed as not checked.' },
  ...(B ? [
    { key: 'break', footage: 'break', range: [B['break chosen'] - 0.5, B['break read']], slide: 'side', head: 'Sites change their pages. Gemini Nano reads what code cannot.', sub: 'Every practice page changed four ways at once.', say: breakSay },
    { key: 'fix', footage: 'break', range: [B['fix chosen'] - 0.5, B['fix read']], slide: 'side', head: 'A fix from Remote Config. No update to install.', sub: 'Fetched by the page from Firebase Remote Config.', say: fixSay },
  ] : []),
  { key: 'plan', panel: [M.questions, M['plan end']], slide: 'side', head: 'Screenshots first. Then an advocate. Then changes, at a time that is right for you.', sub: 'Code checks every plan against ten safety rules, whoever wrote it.',
    say: 'The plan follows the field\'s advice: screenshots first, then an advocate, and changes they may notice wait. Gemini in the cloud can order it from finding codes, and code checks every plan with ten safety rules. One of them: if mail is copied to someone else, stop that first, or Google\'s alert emails reach them.' },
  // The Android app on a made-up practice phone, recorded from the emulator's screen (adb screenrecord).
  ...(existsSync(PHONE_CLIP) ? [{ key: 'android', clip: PHONE_CLIP, range: [6, 100], slide: 'side', head: 'And the phone itself, on Android.', sub: 'The same rules, the same code, in Android\'s sandbox. A made-up practice phone.',
    say: 'An account check cannot see an app hidden on the phone. So there is an Android app too. It lists every app that could let someone watch the phone, and gives the same plan. The cloud never sees an app\'s name.' }] : []),
  { key: 'hood', panel: [M.hood, M.ledger + 0.5], slide: 'side', head: 'Every request to the cloud, word for word.', sub: 'A test searched every request for the made-up names and addresses: none held one.',
    say: 'Every request to the cloud is listed word for word. A test searched every one for names and addresses. Zero of twenty held one.' },
  { key: 'gap', slide: 'gap',
    say: 'We asked a plain chatbot about 30 situations and read every answer. Only 7 said to record the settings before changing anything. Spare Key\'s plans do in all 30.' },
  { key: 'results-slide', slide: 'numbers',
    say: 'It finds all 24 planted ways in, with zero silent misses when pages change.' },
  { key: 'close', slide: 'close',
    say: 'Spare Key. Find out who still has a key to your accounts, at spare key app dot web dot app. The hotline is always there: 1 800 799 7233.' },
];

// ---- Slides -------------------------------------------------------------------------------------------------------
const font = f => pathToFileURL(path.resolve('extension/fonts', f)).href;
const base = `
@font-face { font-family: Atkinson; src: url("${font('AtkinsonHyperlegibleNext-latin.woff2')}"); font-weight: 200 800; }
:root { --bg: #F7F4EE; --surface: #FFFFFF; --ink: #1F2328; --ink-2: #4A5058; --line: #DDD7CC; --accent: #2F5D50; --tint: #E3ECE8; --caution: #8A5200; --caution-bg: #FBF1E1; }
* { box-sizing: border-box; }
html, body { margin: 0; width: ${W}px; height: ${H}px; background: var(--bg); color: var(--ink); font-family: Atkinson, system-ui, sans-serif; }
.slide { position: absolute; inset: 0; padding: 96px 140px 200px; display: flex; flex-direction: column; justify-content: center; }
h1 { font-size: 68px; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em; margin: 0; max-width: 1560px; text-wrap: balance; }
.lede { font-size: 32px; line-height: 1.4; color: var(--ink-2); margin: 26px 0 0; max-width: 1380px; }
.brand { display: flex; align-items: center; gap: 16px; font-weight: 700; font-size: 30px; color: var(--ink); }
.brand svg { width: 44px; height: 44px; }
code { font-family: Atkinson; font-weight: 700; font-size: 0.82em; background: var(--tint); color: var(--accent); padding: 4px 10px; border-radius: 6px; }
`;
const key = '<svg viewBox="0 0 24 24" fill="none" stroke="#2F5D50" stroke-width="2.4" stroke-linecap="round"><circle cx="7.5" cy="12" r="4.5"/><path d="M12 12h10M18 12v4M21 12v3"/></svg>';
// The left side of a panel scene: a headline over the space the footage does not use (the panel sits on the right).
const side = (head, sub) => `<style>${base}
.slide { right: 640px; padding: 96px 80px 200px 140px; }
h1 { font-size: 60px; }
.lede { font-size: 30px; }
.frame { position: absolute; right: 120px; top: 24px; width: 456px; height: 1032px; border-radius: 18px; background: var(--surface); box-shadow: 0 18px 50px rgba(31,35,40,.16); }
</style><div class="frame"></div><div class="slide"><div class="brand">${key}Spare Key</div><h1 style="margin-top:36px">${head || ''}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}</div>`;
const SLIDES = {
  gap: `<style>${base}
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 64px; max-width: 1500px; }
.c { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 38px; }
.c.us { border: 2px solid var(--accent); }
.n { font-size: 112px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.c .n { color: var(--ink-2); } .c.us .n { color: var(--accent); }
.t { font-size: 28px; line-height: 1.4; color: var(--ink-2); margin-top: 18px; }
</style><div class="slide"><h1>Screenshots first, before any change.</h1>
<p class="lede">The field's first rule. Our test: 30 made-up situations, the same Gemini model.</p>
<div class="row">
<div class="c"><div class="n">7 of 30</div><div class="t">answers from a plain chatbot said to record the settings before changing anything. 10 said something risky.</div></div>
<div class="c us"><div class="n">30 of 30</div><div class="t">plans Spare Key shows start with the screenshots, and warn that a change may be noticed.</div></div>
</div></div>`,
  hook: `<style>${base}
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 70px; max-width: 1500px; }
.fact { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 34px 38px; }
.n { font-size: 96px; font-weight: 800; letter-spacing: -0.03em; color: var(--accent); line-height: 1; }
.t { font-size: 27px; line-height: 1.4; color: var(--ink-2); margin-top: 14px; }
.cite { font-size: 20px; color: var(--ink-2); margin-top: 16px; }
</style><div class="slide"><div class="brand">${key}Spare Key</div>
<h1 style="margin-top:40px">Who still has a key to your accounts?</h1>
<div class="facts">
<div class="fact"><div class="n">60%</div><div class="t">of AI chatbot answers to 193 real survivor questions left out critical safety warnings.</div><div class="cite">NYU Tandon, USENIX Security 2026</div></div>
<div class="fact"><div class="n">3</div><div class="t">dedicated tech-abuse clinics in the US, to the researchers' knowledge.</div><div class="cite">Same study</div></div>
</div></div>`,
  hybrid: `<style>${base}
.cols { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 28px; margin-top: 60px; }
.col { border-radius: 16px; padding: 34px 34px 38px; display: flex; flex-direction: column; gap: 16px; }
.dev { background: var(--surface); border: 2px solid var(--accent); }
.cloud { background: #EEF1F6; }
.hyb { background: var(--surface); border: 1px solid var(--line); }
.what { font-size: 34px; font-weight: 700; }
.how { font-size: 24px; line-height: 1.45; color: var(--ink-2); }
</style><div class="slide"><h1>The private pages never leave the computer. The cloud sees codes.</h1>
<p class="lede">Firebase AI Logic, all three ways it can run.</p>
<div class="cols">
<div class="col dev"><code>ONLY_ON_DEVICE</code><div class="what">Gemini Nano</div><div class="how">Sorts every entry, and reads a page the code could not. No cloud fallback, on purpose.</div></div>
<div class="col cloud"><code>ONLY_IN_CLOUD</code><div class="what">Gemini</div><div class="how">Orders the plan from finding codes. Asks the device <b>ask_device</b>, which answers in yes or no.</div></div>
<div class="col hyb"><code>PREFER_ON_DEVICE</code><div class="what">Either</div><div class="how">Public text only: "Say it more simply", the practice screenshot. Device first, cloud if needed.</div></div>
</div><p class="lede" style="font-size:26px;margin-top:34px">Page readers and fixes ship through Remote Config, with no store update. App Check guards the cloud.</p></div>`,
  numbers: `<style>${base}
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 64px; }
.c { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 34px; }
.n { font-size: 84px; font-weight: 800; letter-spacing: -0.03em; color: var(--accent); line-height: 1; }
.t { font-size: 25px; line-height: 1.42; color: var(--ink-2); margin-top: 16px; }
</style><div class="slide"><h1>Measured, and every run is in the repository.</h1>
<div class="grid">
<div class="c"><div class="n">24 of 24</div><div class="t">planted ways in found on the practice pages, with code alone and with Gemini Nano.</div></div>
<div class="c"><div class="n">0</div><div class="t">silent misses when the pages change (24 on the first, blind run). A page it cannot read is listed as not checked.</div></div>
<div class="c"><div class="n">0 of 20</div><div class="t">requests to the cloud held a name, address, phone number or device.</div></div>
</div><p class="lede" style="font-size:26px">Plus one real account, read only: 5 of 12 checks needed a fix; after the fixes, every check it could read matches the page.</p></div>`,
  close: `<style>${base}
.slide { justify-content: center; }
.big { display: flex; align-items: center; gap: 28px; font-size: 92px; font-weight: 800; letter-spacing: -0.02em; }
.big svg { width: 92px; height: 92px; }
.links { margin-top: 44px; font-size: 36px; line-height: 1.6; color: var(--ink-2); }
.links b { color: var(--ink); }
.hot { margin-top: 40px; display: inline-block; background: var(--caution-bg); color: var(--caution); font-size: 30px; font-weight: 700; padding: 16px 24px; border-radius: 12px; }
</style><div class="slide"><div class="big">${key}Spare Key</div>
<div class="links">Find out who still has a key to your accounts.<br>Try the practice check: <b>spare-key-app.web.app</b><br>Built with Firebase AI Logic hybrid inference</div>
<div><span class="hot">National Domestic Violence Hotline: 1-800-799-7233</span></div></div>`,
};
for (const s of scenes) if (s.slide === 'side') SLIDES[`side-${s.key}`] = side(s.head, s.sub);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  for (const [name, html] of Object.entries(SLIDES)) {
    const f = path.join(work, `slide-${name}.html`);
    writeFileSync(f, `<!doctype html><meta charset="utf-8">${html}`);
    await page.goto(pathToFileURL(f).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(work, `slide-${name}.png`) });
  }
} finally {
  await browser.close();
}

// Every clip in one colour setup (images are full range; video is limited range, BT.709), or the joined video shifts
// colour between clips.
const vf = `fps=${FPS},scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p`;
const ENC = ['-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '17', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];

// ---- Footage: a 30 fps clip from saved frames, from..to on the recorder's clock, stretched or squeezed to `dur`. ------
function footage(name, from, to, dur, out) {
  const frames = read(path.join(OUT, name, 'frames.json'));
  const speed = Math.max(1, (to - from) / dur);
  const lines = [];
  let last = null;
  for (let i = 0; i < Math.ceil(dur * FPS); i++) {
    const t = from + (i / FPS) * speed;
    const f = frames.filter(x => x.t <= t).pop() || frames[0];
    if (last && last.file === f.file) last.n++; else lines.push(last = { file: f.file, n: 1 });
  }
  const list = path.join(work, `${path.basename(out)}.txt`);
  writeFileSync(list, lines.map(l => `file '${path.join(OUT, name, l.file).replace(/\\/g, '/')}'\nduration ${(l.n / FPS).toFixed(4)}`).join('\n') + `\nfile '${path.join(OUT, name, lines.at(-1).file).replace(/\\/g, '/')}'`);
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-t', String(dur), ...ENC, out]);
  return speed;
}

// ---- Narration, then each scene cut to it -------------------------------------------------------------------------
const srt = [];
let clock = 0;
const clips = [];
const stamp = s => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const parseSrt = text => text.trim().split(/\r?\n\r?\n/).map(b => { const l = b.split(/\r?\n/); const [a, z] = l[1].split(' --> ').map(t => { const [hh, mm, rest] = t.split(':'); const [ss, ms] = rest.split(/[,.]/); return +hh * 3600 + +mm * 60 + +ss + +ms / 1000; }); return { a, z, text: l.slice(2).join(' ') }; });
for (const s of scenes) {
  const mp3 = path.join(work, `${s.key}.mp3`), sub = path.join(work, `${s.key}.srt`);
  run('edge-tts', ['--voice', VOICE, `--rate=${RATE}`, '--text', s.say, '--write-media', mp3, '--write-subtitles', sub]);
  const D = +(duration(mp3) + 0.8).toFixed(2);
  // Captions show what is written, not how it is said.
  const written = t => t.replace(/spare key app dot web dot app/gi, 'spare-key-app.web.app').replace(/\b1 800 799 7233\b/g, '1-800-799-7233').replace(/\byes or no\b/g, 'yes-or-no');
  for (const c of parseSrt(readFileSync(sub, 'utf8'))) srt.push({ a: clock + c.a, z: clock + c.z, text: written(c.text) });
  const clip = path.join(work, `${s.key}.mp4`);
  if (s.panel || s.range) {
    const bg = path.join(work, `slide-side-${s.key}.png`);
    const pv = path.join(work, `${s.key}-panel.mp4`);
    const [from, to] = s.panel || s.range;
    let speed;
    if (s.clip) {
      // A recorded clip, squeezed to the narration's length.
      speed = Math.max(1, (to - from) / D);
      // A screen recording is already limited range, unlike the saved frames, so it is not converted again.
      ff(['-ss', String(from), '-t', String(to - from), '-i', s.clip, '-vf', `setpts=PTS/${speed.toFixed(4)},fps=${FPS},scale=in_range=tv:out_range=tv:out_color_matrix=bt709,format=yuv420p`, '-t', String(D), '-an', ...ENC, pv]);
    } else speed = footage(s.panel ? 'panel' : s.footage, from, to, D, pv);
    const inputs = ['-loop', '1', '-i', bg, '-i', pv];
    // The panel sits in the white frame on the right (456 x 1032 at 1344, 24).
    let graph = `[1:v]scale=440:-2,crop=440:min(ih\\,1016):0:0[p];[0:v]format=gbrp[bg];[bg][p]overlay=1352:32:format=gbrp`;
    if (s.tab) {
      const tv = path.join(work, `${s.key}-tab.mp4`);
      footage(s.tab, Math.max(s.panel[0], M[s.tab] || 0), s.panel[1], D, tv);
      inputs.push('-i', tv);
      // Above the captions, which sit at the bottom left.
      graph += `[a];[2:v]scale=1140:-2[t];[a][t]overlay=110:40:format=gbrp`;
    }
    // Top left, clear of the panel frame and the captions.
    const label = speed >= 1.5 ? `,drawtext=fontfile='${esc(path.join(FONTS, 'AtkinsonHyperlegibleNext.ttf'))}':text='Shown at ${Math.round(speed * 10) / 10}x speed':x=140:y=44:fontsize=24:fontcolor=0x4A5058` : '';
    ff([...inputs, '-filter_complex', `${graph}${label},${vf}`, '-t', String(D), '-an', ...ENC, clip]);
  } else {
    ff(['-loop', '1', '-i', path.join(work, `slide-${s.slide}.png`), '-vf', vf, '-t', String(D), ...ENC, clip]);
  }
  const wav = path.join(work, `${s.key}.wav`);
  ff(['-i', mp3, '-af', `apad=whole_dur=${D}`, '-ar', '48000', '-ac', '2', wav]);
  clips.push({ clip, wav });
  clock += D;
  console.log(`${s.key.padEnd(14)} ${D.toFixed(1)} s`);
}

// ---- Join, then burn in the captions -------------------------------------------------------------------------------
writeFileSync(path.join(work, 'video.txt'), clips.map(c => `file '${c.clip.replace(/\\/g, '/')}'`).join('\n'));
writeFileSync(path.join(work, 'audio.txt'), clips.map(c => `file '${c.wav.replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', path.join(work, 'video.txt'), '-c', 'copy', path.join(work, 'joined.mp4')]);
ff(['-f', 'concat', '-safe', '0', '-i', path.join(work, 'audio.txt'), '-c', 'pcm_s16le', path.join(work, 'narration.wav')]);
const srtFile = path.join(OUT, 'spare-key-demo.srt');
writeFileSync(srtFile, srt.map((c, i) => `${i + 1}\n${stamp(c.a)} --> ${stamp(c.z)}\n${c.text}\n`).join('\n'));
const assTime = t => { const cs = Math.round(t * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const assFile = path.join(work, 'captions.ass');
writeFileSync(assFile, [
  '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  // Captions sit bottom-left, clear of the panel on the right.
  'Style: Cap,Atkinson Hyperlegible Next,38,&H00FFFFFF,&H00FFFFFF,&H18282320,&H18282320,1,0,0,0,100,100,0,0,3,14,0,1,140,640,48,1',
  '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ...srt.map(c => `Dialogue: 0,${assTime(c.a)},${assTime(c.z)},Cap,,0,0,0,,${c.text.replace(/\r?\n/g, ' ')}`),
].join('\n'));
ff(['-i', path.join(work, 'joined.mp4'), '-i', path.join(work, 'narration.wav'),
  '-vf', `ass='${esc(assFile)}':fontsdir='${esc(FONTS)}'`,
  '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '18', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
  path.join(OUT, 'spare-key-demo.mp4')]);
console.log(`wrote ${path.join(OUT, 'spare-key-demo.mp4')} (${clock.toFixed(1)} s) and ${srtFile}`);
