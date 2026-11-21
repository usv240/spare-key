// The rules that turn entries into findings, and the text helpers they use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeClassify, merge, codeFor, toFinding } from '../extension/src/scan/rules.js';
import { catalogue } from '../extension/src/scan/catalogue.js';
import { recencyOf, maskEmail, maskPhone, maskText, emailsIn, phonesIn } from '../shared/text.js';

const OWNER = { email: 'jordan.lee@example.com', name: 'Jordan Lee' };
const code = (check, text, state = []) => {
  const entry = { text, state };
  return codeFor(check, entry, codeClassify(check, entry, OWNER));
};

test('Gmail forwarding counts only when "Forward a copy" is the chosen option', () => {
  const on = ['chosen: Forward a copy of incoming mail to', 'selected: sam.porter@example.net'];
  const off = ['chosen: Disable forwarding', 'selected: sam.porter@example.net'];
  const text = 'Disable forwarding\nForward a copy of incoming mail to\nand keep Gmail\'s copy in the Inbox';
  assert.equal(code('gmail.forwarding', text, on), 'gmail.forwarding.external');
  assert.equal(code('gmail.forwarding', text, off), null);
  // Forwarding to the person's own address is not someone else's access.
  assert.equal(code('gmail.forwarding', text, ['chosen: Forward a copy of incoming mail to', `selected: ${OWNER.email}`]), null);
});

test('Gmail filters: forwarding and hiding are flagged, a label is not', () => {
  assert.equal(code('gmail.filters', 'Matches: from:(a@example.org)\nDo this: Forward to b@example.net'), 'gmail.filter.forwards');
  assert.equal(code('gmail.filters', 'Matches: subject:(court)\nDo this: Delete it'), 'gmail.filter.hides');
  assert.equal(code('gmail.filters', 'Matches: subject:(x)\nDo this: Skip Inbox, Mark as read'), 'gmail.filter.hides');
  assert.equal(code('gmail.filters', 'Matches: from:(r@example.org)\nDo this: Apply label "Receipts"'), null);
});

test('this device and "(you)" are not findings', () => {
  assert.equal(code('google.devices', 'Windows computer\nChrome\nThis device'), null);
  assert.equal(code('google.devices', 'Pixel 8\nDayton, OH\n2 hours ago'), 'google.devices.other');
  assert.equal(code('amazon.household', 'Jordan Lee (you)\nAdult'), null);
  assert.equal(code('google.family', 'Jordan Lee (you)\nMember'), null);
});

test('Sign in with Google alone is not access to anything', () => {
  assert.equal(code('google.apps', 'Recipe Box\nSign in with Google'), null);
  assert.equal(code('google.apps', 'InboxPilot\nHas access to Gmail'), 'google.apps.read_mail');
});

test('recovery email: the owner\'s own address is not flagged', () => {
  assert.equal(code('google.recovery', OWNER.email), null);
  assert.equal(code('google.recovery', 'sam.porter@example.net'), 'google.recovery.email_other');
});

test('Nano and code disagreeing on ownership gives "unknown" and marks the disagreement', () => {
  const c = { kind: 'email_address', is_owner: 'no', access: ['mail'], recency: 'unknown', this_computer: 'unknown' };
  const n = { kind: 'email_address', is_owner: 'yes', access: ['mail'], recency: 'today', this_computer: 'no' };
  const m = merge(c, n, 'Last used 2 hrs back');
  assert.equal(m.is_owner, 'unknown');
  assert.equal(m.disagree, true);
  assert.equal(m.recency, 'today');
});

test('Nano cannot make an entry "this computer", invent a date, or widen sign-in-only access', () => {
  const device = { text: 'iPhone 15\nColumbus, OH\nActive now', state: [] };
  const fromNano = { kind: 'device', is_owner: 'unknown', access: ['account'], recency: 'now', this_computer: 'yes' };
  const m = merge(codeClassify('google.devices', device, OWNER), fromNano, device.text);
  assert.equal(m.this_computer, 'unknown');
  assert.equal(codeFor('google.devices', device, m), 'google.devices.other');
  const tv = { text: 'Fire TV Stick\nLiving room', state: [] };
  assert.equal(merge(codeClassify('amazon.devices', tv, OWNER), { ...fromNano, recency: 'today' }, tv.text).recency, 'unknown');
  const app = { text: 'Recipe Box\nSign in with Google', state: [] };
  const a = merge(codeClassify('google.apps', app, OWNER), { ...fromNano, kind: 'app', access: ['account'] }, app.text);
  assert.equal(codeFor('google.apps', app, a), null);
});

test('a finding from Gemini Nano alone is marked "check it"', () => {
  const check = catalogue({}).find(c => c.id === 'gmail.delegates');
  const entry = { text: 'sam.porter@example.net', state: [] };
  const f = toFinding({ ref: 'L1', check, entry, cls: codeClassify(check.id, entry, OWNER), howFound: 'nano', openUrl: '', account: OWNER });
  assert.equal(f.confidence, 'check_it');
  assert.equal(f.label, 's••••@example.net');
  assert.equal(f.ownership, null);
});

test('recency words', () => {
  assert.equal(recencyOf('Active now'), 'now');
  assert.equal(recencyOf('2 hours ago'), 'today');
  assert.equal(recencyOf('Yesterday'), 'this_week');
  assert.equal(recencyOf('3 weeks ago'), 'this_month');
  assert.equal(recencyOf('Oct 3'), 'older');
  assert.equal(recencyOf('Sharing until you turn this off'), 'unknown');
});

test('masking keeps enough to tell entries apart, and nothing more', () => {
  assert.equal(maskEmail('sam.porter@example.net'), 's••••@example.net');
  assert.equal(maskPhone('(937) 555-0177'), '•••-•••-0177');
  assert.ok(!maskText('call (937) 555-0177 or mail sam.porter@example.net').match(/937|sam\.porter/));
  assert.deepEqual(emailsIn('a sam@example.net b'), ['sam@example.net']);
  assert.deepEqual(phonesIn('+1 937 555 0177'), ['+1 937 555 0177']);
});

test('a Remote Config override cannot send a check to another site', () => {
  const evil = { 'google.devices': { pages: [{ url: 'https://evil.example.com/collect', reader: {} }] } };
  assert.equal(catalogue(evil).find(c => c.id === 'google.devices').url, 'https://myaccount.google.com/device-activity?authuser={u}');
  const fix = { 'google.devices': { pages: [{ url: 'https://myaccount.google.com/device-activity', reader: { item: 'li' } }] } };
  assert.equal(catalogue(fix).find(c => c.id === 'google.devices').pages[0].reader.item, 'li');
});
