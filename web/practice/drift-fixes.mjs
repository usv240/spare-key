// The Remote Config fixes for the layout drift test: for each kind of change in web/practice/drift.mjs, the catalogue
// override the builder would publish in Remote Config's "catalogue" key, so every install reads the changed pages
// again with no store update. Written after the first code-only run showed what broke (tools/out/drift-first-run.json),
// so the "fixed" numbers show that the fix path works, not how well a first guess reads a new page.
//
// An override replaces a check's pages (each page's reader settings) and its words (the page words the code rules read,
// extension/src/scan/rules.js WORDS). tools/drift-test.mjs passes each one through the extension's own catalogue(), which
// checks that every page stays on its own service's site. Each value here is plain JSON, exactly what Remote Config holds.
import { CHECKS } from '../../extension/src/scan/catalogue.js';
import { driftUrl } from './drift.mjs';

// The check's own pages, pointed at the changed copies, with some reader settings replaced.
function fix(kind, id, readers = [], words = null) {
  const check = CHECKS.find(c => c.id === id);
  const pages = check.pages.map((p, k) => ({ ...p, practiceUrl: driftUrl(p.practiceUrl, kind), reader: { ...p.reader, ...(readers[k] || {}) } }));
  return { pages, ...(words ? { words } : {}) };
}

// The fixes for reworded labels: new words to wait for and match.
const reworded = kind => ({
  'google.devices': fix(kind, 'google.devices', [{ waitFor: { text: '(your devices|where you.re signed in|signed in|logged in)' } }]),
  'google.apps': fix(kind, 'google.apps', [{ waitFor: { text: '(third.party|apps (and|&) services|connections|linked apps)' } }],
    { location: 'location|where you are', sign_in_only: 'sign in with google|signing in with google|uses google to log in' }),
  'google.recovery': fix(kind, 'google.recovery', [{ waitFor: { text: '(recovery phone|phone|backup number)' } }]),
  'google.2sv': fix(kind, 'google.2sv', [{
    waitFor: { text: '(2-step verification|second steps|two-factor)' },
    patterns: [...CHECKS.find(c => c.id === 'google.2sv').pages[0].reader.patterns, '\\btap to confirm\\b', '\\bcode generator\\b'],
  }]),
  'maps.sharing': fix(kind, 'maps.sharing', [{
    waitFor: { text: '(location sharing|who can see where you are)' },
    patterns: [...CHECKS.find(c => c.id === 'maps.sharing').pages[0].reader.patterns, '\\bvisible until\\b', 'anybody who has the link'],
  }], { link: 'anyone with (the|this) link|anybody who has the link' }),
  'gmail.forwarding': fix(kind, 'gmail.forwarding', [{
    within: '^\\s*(forwarding|auto-forward):?\\s*$',
    patterns: ['forward a copy of incoming mail to', 'send a copy of new mail to', 'disable forwarding'],
  }], { on: 'forward a copy|send a copy' }),
  'gmail.filters': fix(kind, 'gmail.filters', [{ waitFor: { text: '(filters|blocked addresses|blocked senders)' }, patterns: ['\\bdo this:', '\\bthen:'] }],
    { forwards: '\\b(forward|send) (it )?to\\b' }),
  'gmail.delegates': fix(kind, 'gmail.delegates', [{ within: '^\\s*(grant access to your account|let others use your mail)' }]),
  'amazon.household': fix(kind, 'amazon.household', [{ patterns: ['\\b(adult|teen|child|grown-up|ages 13 to 17)\\b'] }], { teen: '\\bteen\\b|ages 13 to 17' }),
  'google.family': fix(kind, 'google.family', [{
    waitFor: { text: '(family group|family manager|members|your google family)' },
    patterns: ['\\b(family manager|parent|member|group admin|in this group)\\b'],
  }], { manager: 'family manager|\\bparent\\b|group admin' }),
  'photos.sharing': fix(kind, 'photos.sharing', [{ within: '(partner sharing|share with a partner)', patterns: [...CHECKS.find(c => c.id === 'photos.sharing').pages[0].reader.patterns, 'your partner:'] }]),
});

export const FIXES = {
  renamed: {
    'google.devices': fix('renamed', 'google.devices', [{ item: 'a[href*="security/sessions/"]' }]),
    'google.apps': fix('renamed', 'google.apps', [{ item: 'a[href*="apps/item"]' }]),
  },
  reworded: reworded('reworded'),
  rebuilt: {
    'google.devices': fix('rebuilt', 'google.devices', [{ item: '[data-target*="device-activity/id/"]' }]),
    'google.apps': fix('rebuilt', 'google.apps', [{ item: '[data-target*="connections/link"]' }]),
  },
  formats: {},
  all: (() => {
    const f = reworded('all');
    f['google.devices'].pages[0].reader.item = '[data-target*="security/sessions/"]';
    f['google.apps'].pages[0].reader.item = '[data-target*="apps/item"]';
    return f;
  })(),
};
