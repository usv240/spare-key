// The static Steps API (TECHNICAL-DESIGN.md section 12), written into web/dist/api/v1 at build time and served by
// Firebase Hosting with open CORS. It takes no input, so it cannot receive personal data, and a static file cannot run
// up a bill.
//   GET /api/v1/index.json            every finding code with its title, group, who_can_notice and version
//   GET /api/v1/steps/{code}.json     one steps library entry
//   GET /api/v1/plan-rules.json       the plan order and the safety rules, as data
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { CODES, GROUPS, GROUP_LABELS, SITUATION, SITUATION_DEFAULTS, OWNERSHIP } from '../shared/findings.js';
import { validateLibrary } from '../shared/steps-schema.js';
import { ACTIONS, TAKEOVER } from '../shared/plan/engine.js';

export async function buildApi(outDir = 'web/dist/api/v1') {
  const lib = JSON.parse(await readFile('data/steps.json', 'utf8'));
  const problems = validateLibrary(lib);
  if (problems.length) throw new Error(`The steps library is not valid:\n${problems.join('\n')}`);
  await mkdir(`${outDir}/steps`, { recursive: true });
  const meta = { api: 'spare-key-steps', version: 1, library_version: lib.version, updated_at: lib.updated_at, license: 'Apache-2.0', source: 'https://github.com/usv240/spare-key', note: lib.note };
  await writeFile(`${outDir}/index.json`, JSON.stringify({
    ...meta,
    codes: lib.entries.map(e => ({ code: e.code, title: e.title, group: CODES[e.code].group, check: CODES[e.code].check, who_can_notice: e.who_can_notice, what_they_see: e.what_they_see, notice_source: e.notice_source || null, verified_at: e.verified_at, steps_followed: e.steps_followed, version: e.version, url: `/api/v1/steps/${e.code}.json` })),
  }, null, 2));
  for (const e of lib.entries) await writeFile(`${outDir}/steps/${e.code}.json`, JSON.stringify({ ...e, group: CODES[e.code].group }, null, 2));
  await writeFile(`${outDir}/plan-rules.json`, JSON.stringify({
    ...meta,
    groups: GROUPS.map(g => ({ id: g, label: GROUP_LABELS[g] })),
    actions: ACTIONS,
    order: [
      'document: screenshot every finding that is not the person\'s own, before anything changes',
      'talk_to_advocate: always, before any change that may be noticed',
      'change_now: quiet ways into the account (takeover codes) whose change is unlikely to be noticed, only when safe_to_change_now is yes',
      'wait: every change that may be noticed, with if_not_safe_yet, unless safe_to_change_now is yes (then change_now with the warning)',
      'check_manually: every service that was not checked, with a trusted guide',
    ],
    takeover_codes: [...TAKEOVER],
    situation: Object.fromEntries(Object.entries(SITUATION).map(([k, v]) => [k, { values: v, most_cautious: SITUATION_DEFAULTS[k] }])),
    ownership: OWNERSHIP,
    rules: {
      R1: 'Every finding that is not the person\'s own appears in the plan.',
      R2: 'One document step comes before any change.',
      R3: 'A change that is not unlikely to be noticed carries the library\'s warning.',
      R4: 'If safe_to_change_now is not yes, changes that may be noticed wait.',
      R5: 'The advocate step is always present, before the first change.',
      R6: 'Plan text never calls anything safe or secure, or says there is nothing to worry about.',
      R7: 'Plan text never holds an email address, phone number or link the library does not.',
      R8: 'Everything not checked has a "check it yourself" step.',
    },
    code: 'shared/plan/engine.js and shared/plan/invariants.js in the repository build the same plan from codes, with no model.',
  }, null, 2));
  return lib.entries.length;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build.mjs') && process.argv[1].includes('api')) {
  const n = await buildApi();
  console.log(`Steps API: ${n} entries`);
}
