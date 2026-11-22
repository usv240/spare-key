// The judge's two-minute tour (EXPERIENCE.md section 5.3): five stops, each highlighting one part of the page, with
// Next and Close. It never blocks reading, works with the keyboard, and remembers that it was seen (in this browser).
const STOPS = [
  { target: '#why', title: 'This is the problem', text: 'Most ways in were set up in trust. Chatbots asked for help often leave out the warning that a change can alert the other person, and there are only three dedicated clinics in the US.' },
  { target: '#panel-demo', title: 'Watch a check', text: 'This is the real side panel, showing a practice check for a made-up person. Tap a finding’s "i", or try the full practice check.', link: ['/try.html', 'Run the practice check'] },
  { target: '#stays', title: 'See what left the computer', text: 'Pages are read on the computer by Gemini Nano. The cloud sees finding types only. This is a real request, word for word.' },
  { target: '#voices', title: 'See the two voices', text: 'Two AI voices argue over the plan, one for closing doors and one for staying hidden; a third settles it, and Spare Key’s rules make sure every warning is there.' },
  { target: '#built', title: 'See how it’s built', text: 'Gemini Nano on the device for private pages, Gemini in the cloud for the plan from codes, hybrid for the practice check, and Firebase around it.', link: ['/built-with.html', 'The full stack'] },
];

let box = null;
let at = 0;
let last = null;

function show(i) {
  at = i;
  const stop = STOPS[i];
  const el = document.querySelector(stop.target);
  last?.classList.remove('tour-target');
  if (el) { el.classList.add('tour-target'); el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
  last = el;
  box.querySelector('h2').textContent = `${i + 1} of ${STOPS.length}: ${stop.title}`;
  box.querySelector('p').textContent = stop.text;
  const link = box.querySelector('.tour-link');
  link.hidden = !stop.link;
  if (stop.link) { link.href = stop.link[0]; link.textContent = stop.link[1]; }
  const next = box.querySelector('[data-next]');
  next.textContent = i === STOPS.length - 1 ? 'Finish' : 'Next';
  next.focus({ preventScroll: true });
}

function close() {
  last?.classList.remove('tour-target');
  box?.remove();
  box = null;
  try { localStorage.setItem('sk-tour-seen', '1'); } catch { /* blocked */ }
}

function start(e) {
  e?.preventDefault();
  if (box) return;
  box = document.createElement('section');
  box.className = 'tour';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'false');
  box.setAttribute('aria-label', 'Two-minute tour');
  box.innerHTML = '<h2></h2><p></p><a class="tour-link" hidden></a><div class="tour-actions"><button class="btn btn-primary" type="button" data-next>Next</button><button class="btn btn-secondary" type="button" data-close>Close</button></div>';
  box.querySelector('[data-next]').addEventListener('click', () => (at < STOPS.length - 1 ? show(at + 1) : close()));
  box.querySelector('[data-close]').addEventListener('click', close);
  box.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } });
  document.body.append(box);
  show(0);
}

for (const a of document.querySelectorAll('#tour-start, [data-tour-start]')) a.addEventListener('click', start);
if (location.hash === '#tour') start();
