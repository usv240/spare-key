// The "Verify it's you" wait (extension/src/scan/engine.js waitForVerify): Spare Key only watches the scan tab's address.
import test from 'node:test';
import assert from 'node:assert/strict';

const REAUTH = /accounts\.google\.com\/(v3\/signin\/challenge|signin\/v2\/challenge)/;
const PAGE = 'https://myaccount.google.com/device-activity?authuser=0';
const CHALLENGE = 'https://accounts.google.com/v3/signin/challenge/pk?continue=x';

// A scan tab whose address follows a script, one entry per poll (the last one repeats).
function fakeTab(urls) {
  let n = 0;
  globalThis.chrome = { tabs: { get: async () => ({ status: 'complete', url: urls[Math.min(n++, urls.length - 1)] }) } };
}

const { waitForVerify } = await import('../extension/src/scan/engine.js');

test('returns the page once the site sends the tab back and it stays there', async () => {
  fakeTab([CHALLENGE, CHALLENGE, PAGE, PAGE, PAGE]);
  assert.equal(await waitForVerify(1, PAGE, REAUTH, {}), PAGE);
});

test('a page that shows its frame and then asks again is not taken as verified', async () => {
  fakeTab([PAGE, CHALLENGE, CHALLENGE, PAGE, PAGE, PAGE]);
  const t0 = Date.now();
  assert.equal(await waitForVerify(1, PAGE, REAUTH, {}), PAGE);
  assert.ok(Date.now() - t0 >= 5500, 'it waited for three steady looks after the second ask');
});

test('Skip ends the wait with nothing', async () => {
  fakeTab([CHALLENGE]);
  const skip = new AbortController();
  setTimeout(() => skip.abort(), 1500);
  assert.equal(await waitForVerify(1, PAGE, REAUTH, { skip: skip.signal }), null);
});

test('Stop ends the scan', async () => {
  fakeTab([CHALLENGE]);
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 1500);
  await assert.rejects(waitForVerify(1, PAGE, REAUTH, { signal: stop.signal }), /stopped/);
});
