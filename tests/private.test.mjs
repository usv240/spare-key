// This scan's private strings (extension/src/scan/private.js): names, addresses, numbers and device names, never a
// settings page's own labels, which would make the network ledger count fixed instructions as private.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateStringsFrom } from '../extension/src/scan/private.js';
import { CODES, CODE_TEXT, SITUATION, OWNERSHIP, RECENCY, HOW_FOUND } from '../shared/findings.js';

const scan = JSON.parse(readFileSync('web/src/data/practice-scan.json', 'utf8'));
const STEPS = JSON.parse(readFileSync('data/steps.json', 'utf8'));
const vocabulary = JSON.stringify([STEPS, Object.keys(CODES), SITUATION, OWNERSHIP, RECENCY, HOW_FOUND, CODE_TEXT]);
const priv = privateStringsFrom({ findings: scan.findings, account: scan.account, vocabulary });

test('the practice scan\'s names, addresses and numbers are private', () => {
  for (const s of ['sam.porter@example.net', 'Sam Porter', 'jordan.lee@example.com', 'InboxPilot', 'TrailMate']) assert.ok(priv.includes(s), s);
  assert.ok(priv.some(s => /555.?0177/.test(s)), 'the phone number');
});

test('a settings page\'s own labels are not private', () => {
  for (const s of ['Phone number', 'Authenticator app', 'Google prompts', 'Member', 'Adult', 'Teen', 'Link']) assert.ok(!priv.includes(s), s);
});
