// The "i" buttons (EXPERIENCE.md section 4). Every "i" opens one bottom sheet; only one is open at a time. Escape, a
// second tap on the same button, or a tap outside closes it, and focus returns to the button.
// All text comes from shared/info.json, which the site reads too.
import INFO from '../../../shared/info.json';

const $ = id => document.getElementById(id);
let openButton = null;
let closeTimer = 0;

export function infoText(id) {
  const entry = INFO[id];
  if (!entry) console.error(`Spare Key: no "i" text for ${id}`);
  return entry || { title: 'About this', what: '', why: '' };
}

/** Wires every [data-info] button under `root`, now and later (event delegation). */
export function initInfo(root = document) {
  const sheet = $('sheet');
  sheet.tabIndex = -1;
  for (const b of root.querySelectorAll('button.info[data-info]')) prepare(b);
  root.addEventListener('click', e => {
    const button = e.target.closest('button.info[data-info]');
    if (!button) return;
    if (openButton === button) closeInfo();
    else openInfo(button);
  });
  $('scrim').addEventListener('click', () => closeInfo());
  $('sheet-close').addEventListener('click', () => closeInfo());
}

/** New "i" buttons added after start-up get their ARIA attributes here. */
export function prepare(button) {
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'sheet');
}

export function isInfoOpen() { return !!openButton; }

export function openInfo(button) {
  if (openButton) openButton.setAttribute('aria-expanded', 'false');
  clearTimeout(closeTimer);
  const { title, what, why, tech } = infoText(button.dataset.info);
  $('sheet-title').textContent = title;
  $('sheet-what').textContent = what;
  $('sheet-why').textContent = why;
  $('sheet-tech').textContent = tech || '';
  $('sheet-tech-wrap').hidden = !tech;
  $('sheet-tech-wrap').open = false;
  const sheet = $('sheet');
  sheet.hidden = false;
  $('scrim').hidden = false;
  // Start from the closed position, then let the transition carry it up.
  sheet.dataset.state = 'closed';
  void sheet.offsetHeight;
  sheet.dataset.state = 'open';
  openButton = button;
  button.setAttribute('aria-expanded', 'true');
  sheet.focus({ preventScroll: true });
}

export function closeInfo({ returnFocus = true } = {}) {
  if (!openButton) return;
  const button = openButton;
  openButton = null;
  button.setAttribute('aria-expanded', 'false');
  const sheet = $('sheet');
  sheet.dataset.state = 'closed';
  $('scrim').hidden = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  closeTimer = setTimeout(() => { if (!openButton) sheet.hidden = true; }, reduce ? 0 : 170);
  if (returnFocus) button.focus({ preventScroll: true });
}
