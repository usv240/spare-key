// The locked copy: a round trip opens with the right password only, and the file holds no readable trace of what it holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lock, unlock, WrongPassword } from '../shared/lockedfile.js';

const VALUE = { findings: [{ ref: 'L1', label: 'Forwards new mail to sam.porter@example.net', detail: 'sam.porter@example.net' }], plan: { actions: [{ action: 'document' }] } };

test('lock then unlock gives back the same value', async () => {
  const text = await lock(VALUE, 'correct horse battery', { iterations: 1000 });
  assert.deepEqual(await unlock(text, 'correct horse battery'), VALUE);
});

test('the wrong password fails with the plain message', async () => {
  const text = await lock(VALUE, 'correct horse battery', { iterations: 1000 });
  await assert.rejects(unlock(text, 'wrong horse battery'), WrongPassword);
  await assert.rejects(unlock(text, 'wrong horse battery'), /There is no way to recover a forgotten password/);
});

test('the file holds nothing readable', async () => {
  const text = await lock(VALUE, 'correct horse battery', { iterations: 1000 });
  assert.ok(!/sam|porter|example|Forwards|document/i.test(text));
  const file = JSON.parse(text);
  assert.equal(file.v, 1);
  assert.equal(file.kdf, 'PBKDF2-SHA-256');
  assert.equal(Buffer.from(file.salt, 'base64').length, 16);
  assert.equal(Buffer.from(file.iv, 'base64').length, 12);
});

test('the real setting is 600,000 iterations, and short passwords are refused', async () => {
  const text = await lock({ a: 1 }, 'eight chars');
  assert.equal(JSON.parse(text).iterations, 600000);
  await assert.rejects(lock({ a: 1 }, 'short'), /at least 8/);
});

test('two locks of the same value differ (fresh salt and IV)', async () => {
  const a = await lock(VALUE, 'correct horse battery', { iterations: 1000 });
  const b = await lock(VALUE, 'correct horse battery', { iterations: 1000 });
  assert.notEqual(JSON.parse(a).data, JSON.parse(b).data);
});

test('a file that is not a locked copy is refused', async () => {
  await assert.rejects(unlock('{"hello":1}', 'x'), /not a Spare Key locked file/);
  await assert.rejects(unlock('not json', 'x'), /not a Spare Key locked file/);
});
