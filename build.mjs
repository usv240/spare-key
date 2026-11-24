// Builds the extension (extension/build) and the site (web/dist). Usage: node build.mjs
//   RELEASE=1          leaves the App Check debug token out of every bundle (anything published must be built this way)
//   BRIDGE_URL=<url>   points the extension at a local App Check bridge (tools/serve.mjs) instead of the site's
import { build } from 'esbuild';
import { readFile, mkdir, cp, rm, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const release = process.env.RELEASE === '1';
let debugToken = '';
if (!release) {
  try {
    const src = await readFile('extension/appcheck-debug.local.js', 'utf8');
    debugToken = (src.match(/APPCHECK_DEBUG_TOKEN\s*=\s*'([^']+)'/) || [])[1] || '';
  } catch { /* no local token: cloud calls need the bridge */ }
}
console.log(release ? 'Release build: no debug token' : debugToken ? 'Development build: App Check debug token found' : 'Development build: no debug token (cloud calls use the bridge)');

const common = {
  bundle: true,
  target: 'chrome139',
  logLevel: 'warning',
  legalComments: 'none',
  define: {
    __APPCHECK_DEBUG_TOKEN__: JSON.stringify(debugToken),
    __BRIDGE_URL__: JSON.stringify(process.env.BRIDGE_URL || ''),
  },
};

// The extension: every page and the service worker load as modules.
await rm('extension/build', { recursive: true, force: true });
await build({
  ...common,
  format: 'esm',
  outdir: 'extension/build',
  entryPoints: {
    background: 'extension/src/background.js',
    offscreen: 'extension/src/offscreen.js',
    panel: 'extension/src/panel.js',
  },
  loader: { '.woff2': 'file' },
});

// The site: pages rendered to plain HTML here, with bundled scripts. No site bundle ever carries a debug token: the
// site's own cloud calls use reCAPTCHA Enterprise.
await rm('web/dist', { recursive: true, force: true });
await mkdir('web/dist/build', { recursive: true });
const site = { ...common, define: { __APPCHECK_DEBUG_TOKEN__: '""', __BRIDGE_URL__: '""' }, format: 'esm', outdir: 'web/dist/build', splitting: true };
await build({ ...site, entryPoints: { bridge: 'web/src/bridge.js', site: 'web/src/site.js', tour: 'web/src/tour.js', 'web-panel': 'web/src/web-panel.js' } });
for (const f of await readdir('web')) if (f.endsWith('.html')) await cp(`web/${f}`, `web/dist/${f}`);
if (existsSync('web/public')) await cp('web/public', 'web/dist', { recursive: true });
await cp('web/src/site.css', 'web/dist/build/site.css');
await mkdir('web/dist/panel', { recursive: true });
await cp('extension/src/panel.css', 'web/dist/panel/panel.css');
await cp('extension/fonts', 'web/dist/fonts', { recursive: true });
await cp('extension/src/theme-boot.js', 'web/dist/theme-boot.js');
await cp('extension/icons/icon-32.png', 'web/dist/icon-32.png');
{
  const numbers = JSON.parse(await readFile('web/src/data/numbers.json', 'utf8'));
  const readJson = async f => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return null; } };
  const { default: index } = await import('./web/src/pages/index.mjs');
  const docs = await import('./web/src/pages/docs.mjs');
  const pages = {
    'index.html': index({ numbers, drift: { ...(await readJson('web/src/data/drift.json')), first: await readJson('web/src/data/drift-first-run.json') } }),
    'try.html': docs.tryPage(),
    'install.html': docs.installPage(),
    'how-it-works.html': docs.howItWorksPage(),
    'built-with.html': docs.builtWithPage({ numbers }),
    'plant.html': docs.plantPage(),
    'api.html': docs.apiPage(),
    'accuracy.html': docs.accuracyPage({ numbers, drift: await readJson('web/src/data/drift.json'), driftFirst: await readJson('web/src/data/drift-first-run.json') }),
    'what-they-see.html': docs.whatTheySeePage({ library: JSON.parse(await readFile('data/steps.json', 'utf8')) }),
    'privacy.html': docs.privacyPage(),
    'safety.html': docs.safetyPage(),
    '404.html': docs.notFoundPage(),
  };
  for (const [file, html] of Object.entries(pages)) await writeFile(`web/dist/${file}`, html);
}

// The practice check's made-up settings pages (web/practice/pages.mjs).
const { PAGES, PRACTICE_CSS } = await import('./web/practice/pages.mjs');
for (const [file, html] of Object.entries(PAGES)) {
  const out = `web/dist/practice/${file}`;
  await mkdir(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  await writeFile(out, html);
}
await writeFile('web/dist/practice/practice.css', PRACTICE_CSS);
await cp('web/practice/phone-sharing.png', 'web/dist/practice/phone-sharing.png');
// The same pages changed the way a site redesign changes them, for the layout drift test (web/practice/drift.mjs).
{
  const { DRIFT, driftPage, renamedCss } = await import('./web/practice/drift.mjs');
  for (const { id } of DRIFT) for (const [file, html] of Object.entries(PAGES)) {
    const out = `web/dist/practice/drift/${id}/${file}`;
    await mkdir(out.slice(0, out.lastIndexOf('/')), { recursive: true });
    await writeFile(out, driftPage(html, file, id));
  }
  await writeFile('web/dist/practice/drift/renamed.css', renamedCss(PRACTICE_CSS));
}

// The static Steps API (api/build.mjs).
const { buildApi } = await import('./api/build.mjs');
await buildApi('web/dist/api/v1');

// The MCP server's copy of the shared plan code and the library (mcp/lib, generated; see mcp/server.mjs).
await mkdir('mcp/lib/plan', { recursive: true });
for (const f of ['findings.js', 'plan/engine.js', 'plan/invariants.js']) await cp(`shared/${f}`, `mcp/lib/${f}`);
await cp('data/steps.json', 'mcp/lib/steps.json');

// A published bundle must never carry the debug token.
if (debugToken) {
  const leaks = [];
  const scan = async dir => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await scan(p);
      else if ((await readFile(p, 'utf8').catch(() => '')).includes(debugToken)) leaks.push(p);
    }
  };
  await scan('web/dist');
  if (leaks.length) { console.error('The App Check debug token is in the site build:', leaks.join(', ')); process.exit(1); }
}
await writeFile('extension/build/BUILD.txt', `${release ? 'release' : 'development'} build ${new Date().toISOString()}\n`);

// The Android app's rules engine: the same shared modules, one script for Jetpack's JavaScript sandbox.
if (existsSync('android/engine/bridge.js')) {
  await mkdir('android/app/src/main/assets', { recursive: true });
  await build({ entryPoints: ['android/engine/bridge.js'], outfile: 'android/app/src/main/assets/engine.js', bundle: true, format: 'iife', target: 'es2020', logLevel: 'warning', legalComments: 'none' });
}

// A release build also makes the download the install page links to: the extension folder without the debug token's
// file, checked once more for the token itself.
if (release) {
  const { zipDir } = await import('./tools/zip.mjs');
  const files = await zipDir('extension', 'web/dist/downloads/spare-key-extension.zip', { prefix: 'spare-key', skip: rel => rel === 'appcheck-debug.local.js' });
  if (debugToken) {
    for (const f of files) if ((await readFile(`extension/${f}`, 'utf8').catch(() => '')).includes(debugToken)) { console.error('The debug token is in', f); process.exit(1); }
  }
  console.log(`Wrote web/dist/downloads/spare-key-extension.zip (${files.length} files)`);
}
console.log('Built extension/build and web/dist');
