// The shell every site page shares: Quick exit first by keyboard, a hotline strip, the header, the footer.
// Pages are rendered to plain HTML at build time (build.mjs); the only scripts are site.js and a page's own.
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-key" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M7.5 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 3.3a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"/><path fill="currentColor" d="M12 10.6h9.5a1 1 0 0 1 1 1v.8a1 1 0 0 1-1 1H20.5v2.4a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-2.4h-.9v1.6a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-1.6H12Z"/></symbol>
  <symbol id="i-info" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="6.2" r="1" fill="currentColor"/></symbol>
  <symbol id="i-exit" viewBox="0 0 16 16"><path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 5l3 3-3 3M13 8H6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-menu" viewBox="0 0 20 20"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
</svg>`;

/** An "i" button; its text comes from shared/info.json (or the page's own, for page-only entries). */
export const info = (id, about) => `<button class="info" type="button" data-info="${esc(id)}" aria-label="${esc(about)}"><svg aria-hidden="true"><use href="#i-info"/></svg></button>`;

const NAV = [
  ['how-it-works.html', 'How it works'],
  ['try.html', 'Try it'],
  ['why.html', 'Why Spare Key'],
  ['advocates.html', 'For advocates'],
  ['accuracy.html', 'Accuracy'],
  ['privacy.html', 'Privacy'],
];

export function page({ file, title = 'Spare Key', description, body, scripts = [], styles = [] }) {
  const nav = NAV.map(([href, label]) => `<a href="/${href}"${href === file ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/png" href="/icon-32.png">
<link rel="stylesheet" href="/build/site.css">
${styles.map(s => `<link rel="stylesheet" href="${s}">`).join('\n')}
<script src="/theme-boot.js"></script>
</head>
<body>
${ICONS}
<header class="site-head">
  <div class="wrap">
    <button class="btn btn-exit" type="button" id="quick-exit" data-quick-exit><svg aria-hidden="true"><use href="#i-exit"/></svg>Quick exit</button>
    <a class="mark" href="/index.html"><svg aria-hidden="true"><use href="#i-key"/></svg>Spare Key</a>
    <nav class="site-nav" id="site-nav" aria-label="Site">${nav}</nav>
    <button class="btn btn-exit menu-toggle" type="button" id="menu-toggle" aria-expanded="false" aria-controls="site-nav"><svg aria-hidden="true"><use href="#i-menu"/></svg>Menu</button>
    <label class="visually-hidden" for="theme">Theme</label>
    <select class="theme-select" id="theme"><option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option></select>
  </div>
  <a class="skip" href="#main">Skip to the content</a>
</header>
<div class="safety-strip" role="region" aria-label="Help now">
  <div class="wrap">
    <span>Talk to someone now, free, 24/7:</span>
    <a href="tel:+18007997233">Call 1-800-799-7233</a>
    <a href="sms:88788?&amp;body=START">Text START to 88788</a>
    <span class="muted">Line busy? <a href="tel:+18663319474">loveisrespect 1-866-331-9474</a></span>
    <span class="muted">A call or text stays in this phone’s history.</span>
    <span class="muted key-hint">Quick exit: press Esc twice</span>
  </div>
</div>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <p class="foot-name">Spare Key</p>
        <p class="muted">Find out who still has a key to your accounts. Read-only. Names never leave your computer. Free.</p>
      </div>
      <div><h2 class="visually-hidden">The product</h2><ul>
        <li><a href="/how-it-works.html">How it works</a></li><li><a href="/try.html">Try the practice check</a></li>
        <li><a href="/why.html">Why Spare Key</a></li><li><a href="/advocates.html">For advocates</a></li><li><a href="/what-they-see.html">What they see when you change it</a></li><li><a href="/accuracy.html">Accuracy</a></li></ul></div>
      <div><h2 class="visually-hidden">For builders</h2><ul>
        <li><a href="/built-with.html">How it’s built</a></li><li><a href="/api.html">Steps API and MCP server</a></li><li><a href="/plant.html">Plant a test key (for testers)</a></li>
        <li><a href="https://github.com/usv240/spare-key">Source code (Apache-2.0)</a></li></ul></div>
      <div><h2 class="visually-hidden">Safety and privacy</h2><ul>
        <li><a href="/safety.html">Getting help</a></li><li><a href="/privacy.html">Privacy</a></li>
        <li><a href="https://www.thehotline.org">thehotline.org</a></li></ul></div>
    </div>
    <p class="foot-legal">Spare Key is an independent project made for the #BuildHybridAI 2026 hackathon. It is not made by or connected with Google, Amazon or the National Domestic Violence Hotline. No survivor or advocate has tested it yet.</p>
  </div>
</footer>
<script type="module" src="/build/site.js"></script>
${scripts.map(s => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}
