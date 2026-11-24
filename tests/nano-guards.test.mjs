// The guards around Gemini Nano reading a page (extension/src/scan/engine.js readToEntries), with a stand-in for Nano.
// Each one comes from a real account's pages (November 23, 2026), where Nano read pages that list nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readToEntries } from '../extension/src/scan/engine.js';
import { catalogue } from '../extension/src/scan/catalogue.js';

const check = id => catalogue({}).find(c => c.id === id);
const OWNER = { email: 'jordan.lee@example.com', name: 'Jordan Lee' };
const nanoSays = texts => {
  const calls = [];
  const ask = async (type, options) => { calls.push({ type, options }); return { entries: texts.map((text, i) => ({ i, text, href: '', state: [] })) }; };
  return { ask, calls };
};
const read = extra => ({ entries: [], via: 'none', withinFound: false, emptyConfirmed: false, timedOut: false, mainText: 'Some settings page text', ...extra });

test('a page that says nothing is set up is not read by Nano', async () => {
  const { ask, calls } = nanoSays(['Someone']);
  const p = await readToEntries({ check: check('google.family'), read: read({ emptyConfirmed: true }), account: OWNER, ask });
  assert.equal(calls.length, 0);
  assert.equal(p.why, undefined);
  assert.equal(p.entries.length, 0);
});

test('Nano reads only the named section when the reader found it', async () => {
  const { ask, calls } = nanoSays([]);
  await readToEntries({ check: check('gmail.delegates'), read: read({ withinFound: true, sectionText: 'Grant access to your account' }), account: OWNER, ask });
  assert.equal(calls[0].options.text, 'Grant access to your account');
});

test('buttons and help lines the reader leaves out are left out of what Nano finds too', async () => {
  const { ask } = nanoSays(['Add another account', 'Mark conversation as read when opened by others']);
  const p = await readToEntries({ check: check('gmail.delegates'), read: read({ withinFound: true }), account: OWNER, ask });
  assert.equal(p.why, undefined);
  assert.equal(p.entries.length, 0);
});

test('on pages that name people by address, a Nano entry needs an address', async () => {
  const { ask } = nanoSays(['Albums', 'Sam Porter\nsam.porter@example.net']);
  const p = await readToEntries({ check: check('photos.sharing'), read: read({}), account: OWNER, ask });
  assert.equal(p.entries.length, 1);
  assert.match(p.entries[0].text, /sam\.porter/);
});

test('only the person\'s own address is nothing found, not "looked different"', async () => {
  const { ask } = nanoSays([`Jordan Lee <${OWNER.email}>`]);
  const p = await readToEntries({ check: check('gmail.delegates'), read: read({ withinFound: true }), account: OWNER, ask });
  assert.equal(p.why, undefined);
});

test('a Nano list that does not match the page\'s own count is not shown', async () => {
  const { ask } = nanoSays(['App one', 'App two', 'App three', 'App four']);
  const p = await readToEntries({ check: check('google.apps'), read: read({ mainText: 'Linked apps\nAccess to (3)\nApp one\nApp two\nApp three' }), account: OWNER, ask });
  assert.equal(p.why, 'looked_different');
  const ok = await readToEntries({ check: check('google.apps'), read: read({ mainText: 'Access to (2)' }), account: OWNER, ask: nanoSays(['App one', 'App two']).ask });
  assert.equal(ok.entries.length, 2);
});
