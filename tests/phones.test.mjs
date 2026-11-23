// Phone numbers in page text (shared/text.js): US style and other layouts a real recovery phone page used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { phonesIn, maskText } from '../shared/text.js';

test('US numbers are found', () => {
  for (const p of ['(555) 010-0177', '555-010-0177', '+1 555 010 0177', '555.010.0177']) assert.equal(phonesIn(`Phone ${p} here`).length, 1, p);
});

test('a number written in another layout is found and masked', () => {
  assert.deepEqual(phonesIn('Recovery phone\n055501 00177\nUsed for'), ['055501 00177']);
  assert.equal(phonesIn('+44 20 7946 0958').length, 1);
  assert.match(maskText('055501 00177'), /^•••-•••-0177$/);
});

test('dates, counts and short codes are not phones', () => {
  for (const t of ['November 22, 2026', '9 sessions', 'Access to (20)', 'Code 123456', 'Windows 11 Home 10.0.26300', '2 hours ago']) assert.deepEqual(phonesIn(t), [], t);
});
