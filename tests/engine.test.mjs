// The scan's rules for one page (extension/src/scan/engine.js readToEntries) and the Remote Config words
// (extension/src/scan/rules.js): an empty-looking page is never "nothing found", and a reworded page can be fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readToEntries } from '../extension/src/scan/engine.js';
import { codeClassify, codeFor, toFinding } from '../extension/src/scan/rules.js';
import { catalogue } from '../extension/src/scan/catalogue.js';

const OWNER = { name: 'Jordan Lee', email: 'jordan.lee@example.com' };
const check = catalogue({}).find(c => c.id === 'amazon.household');
const read = (o = {}) => ({ ready: true, timedOut: false, entries: [], mainText: 'Who is in your family\nSam Porter\nGrown-up', withinFound: false, emptyConfirmed: false, ...o });

test('a page that lists nothing without saying so is "looked different", not nothing found', async () => {
  assert.equal((await readToEntries({ check, read: read(), account: OWNER })).why, 'looked_different');
  // When the page says it is empty, or the setting's own section is there, nothing found is believed.
  assert.equal((await readToEntries({ check, read: read({ emptyConfirmed: true }), account: OWNER })).why, undefined);
  assert.equal((await readToEntries({ check, read: read({ withinFound: true }), account: OWNER })).why, undefined);
});

test('a page that never showed the words the reader waits for is checked in part, or not at all', async () => {
  const entries = [{ i: 0, text: 'Sam Porter\nAdult', href: '', state: [] }];
  assert.equal((await readToEntries({ check, read: read({ timedOut: true, entries }), account: OWNER })).partly, true);
  assert.equal((await readToEntries({ check, read: read({ timedOut: true }), account: OWNER })).why, 'did_not_load');
});

test('Gemini Nano reads a page the reader could not, and its entries are marked as found by Nano', async () => {
  const asked = [];
  const ask = async (type, options) => {
    asked.push(type);
    if (type === 'sk:read-page') return { entries: [{ i: 0, text: 'Sam Porter\nGrown-up', href: '', state: [] }] };
    return { items: [{ kind: 'person', is_owner: 'no', access: ['purchases'], recency: 'unknown', this_computer: 'no' }] };
  };
  const p = await readToEntries({ check, read: read({ timedOut: true }), account: OWNER, ask });
  assert.deepEqual(asked, ['sk:read-page', 'sk:classify']);
  assert.equal(p.howFound, 'nano');
  assert.equal(p.partly, true);
  assert.equal(p.hows[0], 'nano');
});

test('Remote Config words fix a reworded page for the code rules', () => {
  const teen = { i: 0, text: 'Riley\nAges 13 to 17', href: '', state: [] };
  const cls = codeClassify('amazon.household', teen, OWNER);
  // Without the fix, an unplaced member is listed as an adult: it is never dropped.
  assert.equal(codeFor('amazon.household', teen, cls), 'amazon.household.adult');
  assert.equal(codeFor('amazon.household', teen, cls, { teen: '\\bteen\\b|ages 13 to 17' }), 'amazon.household.teen');
  // A word that is not a known key, or a broken pattern, is ignored.
  assert.equal(codeFor('amazon.household', teen, cls, { nonsense: 'x', teen: '(' }), 'amazon.household.adult');
});

test('an app whose access the page does not say is listed, not dropped', () => {
  const apps = catalogue({}).find(c => c.id === 'google.apps');
  const app = { i: 0, text: 'TrailMate\nCan see where you are', href: '', state: [] };
  const f = toFinding({ ref: 'L1', check: apps, entry: app, cls: codeClassify('google.apps', app, OWNER), howFound: 'reader', openUrl: '', account: OWNER });
  assert.equal(f.code, 'google.apps.full_access');
  const signIn = { i: 1, text: 'Recipe Box\nSign in with Google', href: '', state: [] };
  assert.equal(toFinding({ ref: 'L2', check: apps, entry: signIn, cls: codeClassify('google.apps', signIn, OWNER), howFound: 'reader', openUrl: '', account: OWNER }), null);
});

test('a Remote Config override with words passes the catalogue, and one pointing elsewhere does not', () => {
  const good = catalogue({ 'amazon.household': { words: { teen: 'ages 13 to 17' } } }).find(c => c.id === 'amazon.household');
  assert.deepEqual(good.words, { teen: 'ages 13 to 17' });
  const bad = catalogue({ 'amazon.household': { pages: [{ url: 'https://evil.example/', reader: {} }] } }).find(c => c.id === 'amazon.household');
  assert.ok(bad.pages[0].url.startsWith('https://www.amazon.com/'));
});
