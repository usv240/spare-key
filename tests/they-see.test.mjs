// "What would they see?" (shared/they-see.js): what a written notice may say, checked against the steps library, and
// who is who, fixed in code (the first Nano run swapped the names).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { theySeeInput, checkTheySee, otherName, THEY_SEE_SCHEMA } from '../shared/they-see.js';
import { libraryMap } from '../shared/steps-schema.js';

const library = libraryMap(JSON.parse(readFileSync('data/steps.json', 'utf8')));
const maps = theySeeInput(library['maps.sharing.person'], 'Sam Porter · s••••@example.net · Sharing until you turn this off');
const member = theySeeInput(library['google.family.member'], 'Riley · Member');
const apps = theySeeInput(library['google.apps.read_mail'], 'InboxPilot · Has access to Gmail');

test('the other person\'s name comes from the entry, by code; the person\'s own name is never given', () => {
  assert.equal(otherName('Sam Porter · Adult'), 'Sam');
  assert.equal(otherName('Sam’s Echo Dot · Registered 2023'), 'Sam');
  assert.equal(otherName('InboxPilot · Has access to Gmail'), '');
  assert.equal(otherName('Link · Anyone with this link'), '');
  assert.equal(maps.them, 'Sam');
  assert.equal(apps.them, 'the other person');
  assert.doesNotMatch(JSON.stringify(maps), /@|•|Jordan/);
  assert.deepEqual(THEY_SEE_SCHEMA.required, ['notice']);
});

test('a notice about the other person, by name, in the library\'s terms, is shown', () => {
  assert.equal(checkTheySee({ notice: 'Sam\'s map stops showing you, and any arrival alerts Sam set for you stop.' }, maps, 'Jordan Lee').ok, true);
  assert.equal(checkTheySee({ notice: 'Google emails Riley to say Riley was removed from the family group.' }, member, 'Jordan Lee').ok, true);
});

test('the swaps the first Nano run made are refused', () => {
  const bad = {
    'Jordan may notice that Sam disappears from their map.': 'uses_your_name',
    'Your map stops showing Sam.': 'other_person_not_named_or_side',
    'You will receive an email from Google saying Riley has been removed.': 'wrong_side',
  };
  assert.equal(checkTheySee({ notice: 'Jordan may notice that Sam disappears from their map.' }, maps, 'Jordan Lee').why, 'uses_your_name');
  assert.equal(checkTheySee({ notice: 'Their map stops showing you.' }, maps, 'Jordan Lee').why, 'other_person_not_named');
  assert.equal(checkTheySee({ notice: 'You will receive an email from Google saying Riley has been removed.' }, member, 'Jordan Lee').why, 'wrong_side');
  assert.ok(Object.keys(bad).length);
});

test('reassurance, contact details and links are never shown: the library\'s words are', () => {
  for (const notice of ['Sam won\'t know you stopped sharing.', 'Sam is safe now.', 'Sam gets an email at sam@example.net.', 'Sam can see https://maps.google.com.']) {
    const r = checkTheySee({ notice }, maps, 'Jordan Lee');
    assert.equal(r.ok, false, notice);
    assert.equal(r.text, library['maps.sharing.person'].what_they_see);
  }
});

test('when the company tells the other person, the notice must say they are told', () => {
  assert.equal(checkTheySee({ notice: 'Riley may notice it stops working.' }, member).why, 'drops_told');
  assert.equal(checkTheySee({ notice: 'Riley is not told.' }, member).ok, false);
});

test('an empty answer shows the library\'s words', () => {
  assert.equal(checkTheySee({}, maps).text, library['maps.sharing.person'].what_they_see);
});

test('the cloud gate lets a practice notice through only with the practice pages\' own words', async () => {
  const { checkOutgoing } = await import('../shared/cloud-safe.js');
  const owner = { name: 'Jordan Lee', email: 'jordan.lee@example.com' };
  const corpus = 'Sam Porter shares your location. Sharing until you turn this off. example.net';
  const guard = { library, practiceCorpus: corpus, practiceOwner: owner };
  const ok = { task: 'they_see', owner, input: theySeeInput(library['maps.sharing.person'], 'Sam Porter · Sharing until you turn this off') };
  assert.doesNotThrow(() => checkOutgoing('practice', ok, guard));
  assert.throws(() => checkOutgoing('practice', { ...ok, input: { ...ok.input, them: 'Marcus' } }, guard));
  assert.throws(() => checkOutgoing('practice', { ...ok, input: { ...ok.input, entry: 'Marcus Vell · Sharing' } }, guard));
  assert.throws(() => checkOutgoing('practice', { ...ok, input: { ...ok.input, what_they_see: 'They will never know.' } }, guard));
});

test('the swaps read by hand in the second run are refused, and fine wording still passes', () => {
  const link = theySeeInput(library['maps.sharing.link'], 'Link · Anyone with this link can see your location until 9:00 PM');
  const echo = theySeeInput(library['amazon.device.other'], 'Sam’s Echo Dot · Registered 2023');
  const loc = theySeeInput(library['google.apps.location'], 'TrailMate · Has access to your location');
  assert.equal(checkTheySee({ notice: 'The link stops showing where the other person is.' }, link).why, 'location_swapped');
  assert.equal(checkTheySee({ notice: 'Sam, your Echo Dot no longer shows your account’s content.' }, echo).why, 'speaks_to_them');
  assert.equal(checkTheySee({ notice: 'TrailMate may notice when your location stops updating.' }, loc).why, 'not_a_person_notices');
  assert.equal(checkTheySee({ notice: 'The link will no longer show your location. The other person may notice when they open it.' }, link).ok, true);
  assert.equal(checkTheySee({ notice: 'Sam may notice when your account’s content stops showing on their Echo Dot.' }, echo).ok, true);
});
