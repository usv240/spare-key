// "What would they see?" (shared/they-see.js): what a written notice may say, checked against the steps library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { theySeeInput, checkTheySee, THEY_SEE_SCHEMA } from '../shared/they-see.js';
import { libraryMap } from '../shared/steps-schema.js';

const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));
const maps = theySeeInput(library['maps.sharing.person'], 'Sam Porter · s••••@example.net · Sharing until you turn this off', 'Jordan Lee');
const told = Object.values(library).find(e => e.who_can_notice === 'notifies');

test('the input carries the library\'s words, the names, and no email address', () => {
  assert.equal(maps.who_can_notice, 'noticeable');
  assert.equal(maps.owner, 'Jordan');
  assert.match(maps.entry, /Sam Porter/);
  assert.doesNotMatch(JSON.stringify(maps), /@/);
  assert.deepEqual(THEY_SEE_SCHEMA.required, ['notice']);
});

test('a notice in the library\'s terms, with the names, is shown', () => {
  const r = checkTheySee({ notice: 'Sam\'s map will stop showing Jordan, and any arrival alerts Sam set will stop.' }, maps);
  assert.equal(r.ok, true);
  assert.match(r.text, /Sam's map/);
});

test('reassurance, contact details and links are never shown: the library\'s words are', () => {
  for (const notice of ['Sam won\'t know you stopped sharing.', 'You are safe now.', 'Sam gets an email at sam@example.net.', 'See https://maps.google.com.']) {
    const r = checkTheySee({ notice }, maps);
    assert.equal(r.ok, false, notice);
    assert.equal(r.text, library['maps.sharing.person'].what_they_see);
  }
});

test('when the company tells the other person, the notice must say they are told', () => {
  const input = theySeeInput(told, 'Sam', 'Jordan');
  assert.equal(checkTheySee({ notice: 'Sam may notice it stops working.' }, input).ok, false);
  assert.equal(checkTheySee({ notice: 'Sam is not told.' }, input).ok, false);
  assert.equal(checkTheySee({ notice: 'Google tells Sam that Jordan left the family group.' }, input).ok, true);
});

test('an empty answer shows the library\'s words', () => {
  assert.equal(checkTheySee({}, maps).text, library['maps.sharing.person'].what_they_see);
});

test('the cloud gate lets a practice notice through only with the practice pages\' own words', async () => {
  const { checkOutgoing } = await import('../shared/cloud-safe.js');
  const owner = { name: 'Jordan Lee', email: 'jordan.lee@example.com' };
  const corpus = 'Sam Porter shares your location. Sharing until you turn this off. example.net';
  const guard = { library, practiceCorpus: corpus, practiceOwner: owner };
  const ok = { task: 'they_see', owner, input: theySeeInput(library['maps.sharing.person'], 'Sam Porter · Sharing until you turn this off', 'Jordan Lee') };
  assert.doesNotThrow(() => checkOutgoing('practice', ok, guard));
  const realName = { ...ok, input: { ...ok.input, entry: 'Marcus Vell · Sharing until you turn this off' } };
  assert.throws(() => checkOutgoing('practice', realName, guard));
  const changedWords = { ...ok, input: { ...ok.input, what_they_see: 'They will never know.' } };
  assert.throws(() => checkOutgoing('practice', changedWords, guard));
});
