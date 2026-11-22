// The writing rules (EXPERIENCE.md section 2) and the "i" button rules (section 4), checked on every UI string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { CHECKS } from '../extension/src/scan/catalogue.js';

const INFO = JSON.parse(readFileSync('shared/info.json', 'utf8'));
const UI_FILES = ['extension/src/panel.html', 'web/appcheck-bridge.html'];

// Visible text of an HTML file: tags, scripts, styles and attribute values other than labels removed.
function htmlText(file) {
  const html = readFileSync(file, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]);
  return [html.replace(/<[^>]+>/g, ' '), ...labels].join(' ').replace(/&amp;/g, '&');
}
// String literals in the panel's script that reach the screen (textContent and template strings).
function scriptStrings(file) {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.){12,})\1/g)].map(m => m[2]).filter(s => /[a-z] [a-z]/i.test(s));
}
const uiStrings = () => [
  ...UI_FILES.map(f => ({ where: f, text: htmlText(f) })),
  ...['extension/src/panel.js', 'extension/src/ui/results.js', 'extension/src/ui/plan.js', 'extension/src/ui/info.js']
    .flatMap(f => scriptStrings(f).map(t => ({ where: f, text: t }))),
  ...CHECKS.flatMap(c => [c.label, c.progress].map(t => ({ where: `catalogue ${c.id}`, text: t }))),
  ...Object.entries(INFO).flatMap(([id, e]) => Object.values(e).map(t => ({ where: `info.json ${id}`, text: t }))),
];

const EM_DASH = String.fromCharCode(0x2014);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const BANNED_WORDS = /\b(safe|safer|safest|safely|secure|securely|all clear|you'?re fine|nothing to worry|abuser|victim|act now|you should have)\b/i;

test('no em dash, emoji or exclamation mark in any UI string', () => {
  for (const { where, text } of uiStrings()) {
    assert.ok(!text.includes(EM_DASH), `${where}: em dash in "${text.slice(0, 80)}"`);
    assert.ok(!EMOJI.test(text), `${where}: emoji in "${text.slice(0, 80)}"`);
    assert.ok(!/[A-Za-z)]!(\s|$)/.test(text), `${where}: exclamation mark in "${text.slice(0, 80)}"`);
  }
});

test('no "safe", "secure", "all clear", "abuser" or "victim" in the product', () => {
  for (const { where, text } of uiStrings()) {
    const m = text.match(BANNED_WORDS);
    assert.ok(!m, `${where}: "${m && m[0]}" in "${text.slice(0, 100)}"`);
  }
});

test('no em dash anywhere in the repo text files', () => {
  // docs/evidence holds models' answers word for word (a plain chatbot's em dashes are part of what was measured).
  const skip = /(^|\/)node_modules(\/|$)|^(\.git|extension\/build|web\/dist|private|tools\/out|\.taste-skill|mcp\/lib|docs\/evidence)(\/|$)/;
  const bad = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const p = path.posix.join(dir, name);
      if (skip.test(p)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(md|js|mjs|json|html|css|txt)$/.test(name) && !/^OFL-/.test(name) && name !== 'package-lock.json' && readFileSync(p, 'utf8').includes(EM_DASH)) bad.push(p);
    }
  };
  walk('.');
  assert.deepEqual(bad, []);
});

test('every "i" button has text, and every text has a button', () => {
  // The panel, and the site's pages (which call info('id', ...)).
  const html = readFileSync('extension/src/panel.html', 'utf8');
  const site = ['web/src/pages/index.mjs', 'web/src/pages/docs.mjs'].map(f => readFileSync(f, 'utf8')).join('\n');
  const used = new Set([...html.matchAll(/data-info="([^"]+)"/g), ...site.matchAll(/info\('([^']+)'/g)].map(m => m[1]));
  for (const c of CHECKS) used.add(`check-${c.id}`);
  for (const extra of ['check-chrome.extensions', 'check-chrome.sync', 'history-cleanup']) used.add(extra);
  // Entries the site and later screens use.
  const later = new Set(['practice']);
  for (const id of used) assert.ok(INFO[id], `"i" button ${id} has no entry in shared/info.json`);
  for (const id of Object.keys(INFO)) assert.ok(used.has(id) || later.has(id), `shared/info.json entry ${id} is not used`);
  for (const [id, e] of Object.entries(INFO)) assert.ok(e.title && e.what && e.why, `${id} needs title, what and why`);
});

test('no "safe", "safer" or "secure" in the site\'s page text or the README', () => {
  // Page source with code identifiers (cloud-safe.js) and the instruction to the model taken out.
  const files = [...readdirSync('web/src/pages').map(f => `web/src/pages/${f}`), 'web/panel-demo.html', 'README.md'];
  const BANNED = new RegExp(String.raw`\b(safe|safer|safest|safely|secure|securely)\b`, 'i');
  for (const f of files) {
    const text = readFileSync(f, 'utf8').split('cloud-safe.js').join('').split('Never say safe or secure.').join('');
    const m = text.match(BANNED);
    assert.ok(!m, `${f}: "${m && m[0]}"`);
  }
});
