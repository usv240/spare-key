// The hotline and its backup: Remote Config can change the numbers, and anything malformed falls back to the bundled lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hotlinesFrom, HOTLINE, HOTLINE_BACKUP, REMOTE_DEFAULTS } from '../shared/config.js';

test('the published default gives both bundled lines', () => {
  const { main, backup } = hotlinesFrom(JSON.parse(REMOTE_DEFAULTS.hotline.value));
  assert.equal(main.tel, HOTLINE.tel);
  assert.equal(main.sms, HOTLINE.sms);
  assert.equal(backup.tel, HOTLINE_BACKUP.tel);
  assert.equal(backup.sms, HOTLINE_BACKUP.sms);
});

test('no Remote Config value gives the bundled lines', () => {
  assert.equal(hotlinesFrom(null).main, HOTLINE);
  assert.equal(hotlinesFrom(undefined).backup, HOTLINE_BACKUP);
});

test('a well formed new number is used', () => {
  const { main } = hotlinesFrom({ name: 'Test line', call: '1-800-555-0100', word: 'HELLO', to: '12345', web: 'https://example.org' });
  assert.equal(main.tel, 'tel:+18005550100');
  assert.equal(main.sms, 'sms:12345?&body=HELLO');
});

test('a malformed line falls back, one line at a time', () => {
  for (const bad of [{ call: '911' }, { call: '1-800-555-0100', word: 'HELLO', to: '12345', web: 'http://example.org' }, { call: '1-800-555-0100', word: 'hello', to: '12345', web: 'https://example.org' }, { call: 'javascript:alert(1)', word: 'A', to: '1', web: 'https://x.org' }]) {
    const { main, backup } = hotlinesFrom({ ...bad, backup: { call: 'x' } });
    assert.equal(main, HOTLINE);
    assert.equal(backup, HOTLINE_BACKUP);
  }
  const mixed = hotlinesFrom({ call: 'bad', backup: { name: 'Second', call: '1-866-555-0100', word: 'HI', to: '22222', web: 'https://example.org/' } });
  assert.equal(mixed.main, HOTLINE);
  assert.equal(mixed.backup.call, '1-866-555-0100');
});
