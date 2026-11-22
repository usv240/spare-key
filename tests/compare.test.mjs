// "Since your last check": what is new, what is gone, and what is only newly checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareChecks } from '../extension/src/scan/compare.js';

const f = (ref, code, check, detail) => ({ ref, code, check, label: detail.split('\n')[0], detail });
const out = (...ids) => ids.map(id => ({ id, status: 'checked' }));

test('a device that is new since the last check is listed as new; a changed time is not', () => {
  const before = { outcomes: out('google.devices', 'gmail.forwarding'), findings: [f('L1', 'google.devices.other', 'google.devices', 'iPhone 15\nActive now'), f('L2', 'gmail.forwarding.external', 'gmail.forwarding', 'Forward a copy to s@example.net')] };
  const now = { outcomes: out('google.devices', 'gmail.forwarding'), findings: [f('L1', 'google.devices.other', 'google.devices', 'iPhone 15\n3 days ago'), f('L2', 'google.devices.other', 'google.devices', 'Pixel 9\nActive now')] };
  const r = compareChecks(before, now);
  assert.deepEqual(r.added, ['L2']);
  assert.deepEqual(r.removed.map(x => x.code), ['gmail.forwarding.external']);
  assert.equal(r.same, 1);
});

test('a check that did not run last time cannot have anything new since then', () => {
  const before = { outcomes: out('google.devices'), findings: [] };
  const now = { outcomes: out('google.devices', 'google.apps'), findings: [f('L1', 'google.apps.read_mail', 'google.apps', 'InboxPilot')] };
  const r = compareChecks(before, now);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.compared, ['google.devices']);
});

test('two devices with the same name count as two', () => {
  const before = { outcomes: out('google.devices'), findings: [f('L1', 'google.devices.other', 'google.devices', 'Mac')] };
  const now = { outcomes: out('google.devices'), findings: [f('L1', 'google.devices.other', 'google.devices', 'Mac'), f('L2', 'google.devices.other', 'google.devices', 'Mac')] };
  assert.deepEqual(compareChecks(before, now).added, ['L2']);
});
