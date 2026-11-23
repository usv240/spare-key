// Reading level of the words people read: the built site pages and the extension panel, as the Flesch-Kincaid grade
// of their paragraphs, list items and headings (code, tables of numbers and the footer are left out). The goal
// (EXPERIENCE.md) is grade 6 to 8 or lower. Syllables are counted by a simple vowel-group rule, so read the grades as
// close, not exact.
//   node build.mjs && node tools/reading-grade.mjs        writes tools/out/reading-grade.json
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const files = [
  ...readdirSync('web/dist').filter(f => f.endsWith('.html') && !/^(appcheck-bridge|404)\.html$/.test(f)).map(f => path.join('web/dist', f)),
  'extension/src/panel.html',
];
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/g, ' ');
function blocks(html) {
  const body = html
    .replace(/<(script|style|code|pre|svg|footer|nav|table)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return [...body.matchAll(/<(p|li|h[1-6]|dd|summary|figcaption|label|button)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(t => /[a-z]{2}/i.test(t));
}
const syllables = w => {
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 0;
  if (s.length <= 3) return 1;
  const groups = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
};
function grade(texts) {
  let sentences = 0, words = 0, syl = 0;
  for (const t of texts) {
    const ws = t.split(/\s+/).filter(w => /[a-z]/i.test(w));
    if (!ws.length) continue;
    // A heading, list item or button with no full stop still counts as one sentence.
    sentences += Math.max(1, (t.match(/[.!?](\s|$)/g) || []).length);
    words += ws.length;
    syl += ws.reduce((n, w) => n + syllables(w), 0);
  }
  if (!words) return null;
  return { words, grade: Math.round((0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59) * 10) / 10 };
}
const rows = files.map(f => ({ page: f.replace(/\\/g, '/'), ...grade(blocks(readFileSync(f, 'utf8'))) })).filter(r => r.words);
const sorted = rows.map(r => r.grade).sort((a, b) => a - b);
const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) * 5) / 10;
for (const r of rows) console.log(String(r.grade).padStart(5), String(r.words).padStart(6), 'words ', r.page);
console.log(`median grade ${median} across ${rows.length} pages; highest ${sorted.at(-1)}`);
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/reading-grade.json', JSON.stringify({ at: new Date().toISOString(), method: 'Flesch-Kincaid grade of p, li, h1-h6, dd, summary, figcaption, label and button text; code, tables, nav and footer left out; vowel-group syllable count', median, rows }, null, 1));
