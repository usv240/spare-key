// Every site page: Quick exit (button, Escape twice), the theme switch, the phone menu, and the "i" buttons.
import INFO from '../../shared/info.json';
import { QUICK_EXIT_URL } from '../../shared/config.js';

// ---------------------------------------------------------------------------------------------------------------
// Quick exit: replace this page, so Back does not return to it, and clear what this tab kept.
export function quickExit() {
  try { sessionStorage.clear(); } catch { /* blocked */ }
  location.replace(QUICK_EXIT_URL);
}
for (const b of document.querySelectorAll('[data-quick-exit]')) b.addEventListener('click', quickExit);
window.spareKeyQuickExit = quickExit; // the practice panel in its frame calls this
let lastEscape = 0;
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const now = performance.now();
  if (now - lastEscape < 1000) quickExit();
  lastEscape = now;
  closePop();
});

// ---------------------------------------------------------------------------------------------------------------
// Theme: System, Light or Dark, remembered in this browser only.
const theme = document.getElementById('theme');
const applyTheme = v => {
  if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  try { if (v === 'light' || v === 'dark') localStorage.setItem('sk-theme', v); else localStorage.removeItem('sk-theme'); } catch { /* blocked */ }
  for (const f of document.querySelectorAll('iframe[src^="/panel-demo"]')) f.contentWindow?.postMessage({ type: 'sk-theme', value: v }, location.origin);
};
if (theme) {
  try { theme.value = localStorage.getItem('sk-theme') || 'system'; } catch { theme.value = 'system'; }
  theme.addEventListener('change', () => applyTheme(theme.value));
}

// The phone menu.
const toggle = document.getElementById('menu-toggle');
const nav = document.getElementById('site-nav');
toggle?.addEventListener('click', () => {
  const open = !nav.classList.contains('open');
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
});

// ---------------------------------------------------------------------------------------------------------------
// The "i" buttons: a popover anchored to the button on desktop, a bottom sheet on phones. One open at a time; Escape,
// a second tap or a tap outside closes it; focus moves in and back.
const PAGE_INFO = window.SK_PAGE_INFO || {};
let pop = null;
let openBtn = null;

function closePop() {
  if (!pop || !openBtn) return;
  pop.dataset.state = 'closed';
  openBtn.setAttribute('aria-expanded', 'false');
  const b = openBtn;
  openBtn = null;
  setTimeout(() => { if (!openBtn) pop.hidden = true; }, 180);
  b.focus({ preventScroll: true });
}

function openPop(btn) {
  const entry = PAGE_INFO[btn.dataset.info] || INFO[btn.dataset.info];
  if (!entry) return;
  if (!pop) {
    pop = document.createElement('section');
    pop.className = 'pop';
    pop.id = 'info-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.tabIndex = -1;
    document.body.append(pop);
  }
  if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
  pop.replaceChildren();
  const h = (tag, text, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; el.textContent = text; return el; };
  const title = h('h2', entry.title);
  title.id = 'info-pop-title';
  pop.setAttribute('aria-labelledby', title.id);
  const what = h('p', '');
  what.append(h('span', 'What this is', 'label'), entry.what);
  const why = h('p', '');
  why.append(h('span', 'Why it matters', 'label'), entry.why);
  pop.append(title, what, why);
  if (entry.tech) {
    const d = document.createElement('details');
    d.append(h('summary', 'Technical detail'), h('p', entry.tech));
    pop.append(d);
  }
  pop.hidden = false;
  // Place it under the button, inside the window.
  const r = btn.getBoundingClientRect();
  const width = Math.min(360, innerWidth - 32);
  const left = Math.max(16, Math.min(innerWidth - width - 16, r.left + scrollX - 12));
  pop.style.left = `${left}px`;
  pop.style.top = `${r.bottom + scrollY + 10}px`;
  pop.style.setProperty('--origin', `${r.left + scrollX - left + 14}px top`);
  pop.dataset.state = 'closed';
  void pop.offsetHeight;
  pop.dataset.state = 'open';
  openBtn = btn;
  btn.setAttribute('aria-expanded', 'true');
  pop.focus({ preventScroll: true });
}

for (const b of document.querySelectorAll('button.info[data-info]')) {
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', 'info-pop');
}
document.addEventListener('click', e => {
  const btn = e.target.closest('button.info[data-info]');
  if (btn) { if (openBtn === btn) closePop(); else openPop(btn); return; }
  if (pop && openBtn && !pop.contains(e.target)) closePop();
});
