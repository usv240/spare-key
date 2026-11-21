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

// The site: plain HTML pages, with bundled scripts. The bridge page never carries a debug token.
await rm('web/dist', { recursive: true, force: true });
await mkdir('web/dist/build', { recursive: true });
await build({ ...common, define: { ...common.define, __APPCHECK_DEBUG_TOKEN__: '""' }, format: 'esm', outdir: 'web/dist/build', entryPoints: { bridge: 'web/src/bridge.js' } });
for (const f of await readdir('web')) if (f.endsWith('.html')) await cp(`web/${f}`, `web/dist/${f}`);
if (existsSync('web/public')) await cp('web/public', 'web/dist', { recursive: true });

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
console.log('Built extension/build and web/dist');
