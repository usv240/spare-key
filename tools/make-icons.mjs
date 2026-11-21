// Draws the toolbar and store icons (extension/icons/icon-N.png): a plain key, nothing else. No shield, no heart, no
// badge: on a shared computer the icon should not draw attention. Each size is rasterised by Chrome at that size.
// Usage: node tools/make-icons.mjs   (needs Chrome and ffmpeg on this computer)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = path.resolve('extension/icons');
const work = path.join(tmpdir(), 'sk-icons');
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });

// A mid-tone green reads on both light and dark toolbars. The bow's hole is cut out, so the toolbar shows through.
export const KEY_SVG = (pad = 0, fill = '#5B8C7D') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${24 + 2 * pad} ${24 + 2 * pad}" width="100%" height="100%">
  <mask id="m"><rect x="-9" y="-9" width="42" height="42" fill="#fff"/><circle cx="7.5" cy="12" r="2.2" fill="#000"/></mask>
  <g mask="url(#m)" fill="${fill}">
    <circle cx="7.5" cy="12" r="5.5"/>
    <rect x="11" y="10.6" width="11.5" height="2.8" rx="1"/>
    <rect x="16.4" y="12" width="2.6" height="4.6" rx="0.8"/>
    <rect x="19.9" y="12" width="2.6" height="3.6" rx="0.8"/>
  </g>
</svg>`;

const SIZES = { 16: -0.6, 32: -0.4, 48: 0.6, 128: 3 };
for (const [size, pad] of Object.entries(SIZES)) {
  const html = path.join(work, `i${size}.html`);
  writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${KEY_SVG(pad)}`);
  const shot = path.join(work, `i${size}.png`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    '--window-size=200,200', `--screenshot=${shot}`, `file:///${html.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', shot, '-vf', `crop=${size}:${size}:0:0`, path.join(out, `icon-${size}.png`)]);
  console.log(`icon-${size}.png`);
}
rmSync(work, { recursive: true, force: true });
