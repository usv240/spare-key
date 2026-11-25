// The phone check's rules: what the Android app read on the phone (android/.../PhoneScan.kt), turned into findings.
// The same code runs on the phone (in Jetpack's JavaScript sandbox, android/engine/bridge.js), in the website's
// practice phone, and in the tests, so they cannot drift apart. Like every other check, a finding names a kind of
// access by code; the app's name stays on the phone.
import { shortLabel } from './text.js';

// One finding per app, by its strongest kind of control. An app with two or more strong powers, or one strong power
// and from outside the Play Store, is "control": the way monitoring apps are usually set up.
export const PHONE_CODES = {
  'phone.app.control': { group: 'phone', check: 'phone.apps' },
  'phone.app.accessibility': { group: 'phone', check: 'phone.apps' },
  'phone.app.device_admin': { group: 'phone', check: 'phone.apps' },
  'phone.app.notifications': { group: 'phone', check: 'phone.apps' },
  'phone.app.messages': { group: 'phone', check: 'phone.apps' },
  'phone.app.usage_access': { group: 'phone', check: 'phone.apps' },
  'phone.app.location_always': { group: 'location', check: 'phone.apps' },
  'phone.usb_debugging': { group: 'phone', check: 'phone.settings' },
  'phone.rooted': { group: 'phone', check: 'phone.settings' },
};
export const PHONE_CHECK_IDS = ['phone.apps', 'phone.settings'];

const STRONG = ['accessibility', 'device_admin', 'notifications'];
// Reading texts or the call log counts toward control, but alone it is common in the phone's own messages and phone apps.
const COUNTS = [...STRONG, 'messages'];
const POWER_WORDS = {
  accessibility: 'can read and control the screen',
  device_admin: 'is a device admin app',
  notifications: 'can read notifications',
  messages: 'can read your texts or call log',
  usage_access: 'can see which apps you use',
  location_always: 'can see your location all the time',
};
// Apps that came with the phone (Android's own, or the maker's) use some of these for their own job: the keyboard, the
// launcher, Android System Intelligence reading notifications. Another person cannot put an app there without rooting
// the phone, so they are counted, not listed, and the results say a rooted phone can hide an app there.
const ORDER = ['accessibility', 'device_admin', 'notifications', 'messages', 'usage_access', 'location_always'];
// One kind of access, held by an app from the Play Store: a password manager reading the screen, a watch app reading
// notifications. Still listed, with the same card and the same question, but under its own heading below the apps that
// can watch the whole phone, so a long list does not bury the one that matters. Device admin never goes here.
// A caution from Gemini Nano counts only when something code can check backs it up: the app came from outside the Play
// Store, or holds two or more strong powers, or its name or package says what it is. Found on a real phone on
// November 24, 2026: with no such check Gemini Nano raised a caution on 10 of 13 ordinary Play Store apps, and asking it
// for its own reason did not help (it called the right apps "monitoring" and gave the wrong reason).
const TELLING = /track|spy|monitor|locat|finder|family|parent|kids?\b|child|guardian|stealth|keylog|surveil|mirror|forward/i;
const backedUp = app => app.installer === 'other' || COUNTS.filter(k => app.powers?.[k]).length >= 2 || TELLING.test(`${app.label} ${app.pkg}`);
const ONE_KIND = ['phone.app.accessibility', 'phone.app.notifications', 'phone.app.messages', 'phone.app.usage_access'];

/** The finding code for one app, or null when it holds nothing worth listing. */
export function phoneCode(app) {
  const p = app.powers || {};
  if (app.system) return null;
  const counted = COUNTS.filter(k => p[k]);
  if (counted.length >= 2 || (counted.length && app.installer === 'other')) return 'phone.app.control';
  for (const k of ORDER) if (p[k]) return `phone.app.${k}`;
  return null;
}

/**
 * Findings from the phone's facts. `nano` maps a package to Gemini Nano's reading of the app on the phone
 * ({ kind, about }), when the phone has it. Returns { findings, outcomes }, in the extension's shapes.
 */
export function phoneFindings(facts, { nano = {}, refStart = 0 } = {}) {
  let n = refStart;
  const findings = [];
  const apps = facts?.apps || [];
  const builtIn = apps.filter(a => a.system).length;
  let setAside = 0;
  for (const app of apps) {
    const code = phoneCode(app);
    if (!code) continue;
    const p = app.powers || {};
    const powers = ORDER.filter(k => p[k]).map(k => POWER_WORDS[k]);
    const where = app.installer === 'other' ? 'installed from outside the Play Store' : app.installer === 'play' ? 'from the Play Store' : '';
    const said = nano[app.pkg];
    // Gemini Nano's reading, with a caution nothing backs up turned into "cannot tell".
    const aside = !!said && CAUTION_KINDS.includes(said.kind) && !backedUp(app);
    if (aside) setAside++;
    const read = aside ? { kind: 'unknown', about: '' } : said;
    const detail = [app.label, `It ${powers.join(', ')}.`, where, read?.about && ['monitoring', 'family_locator', 'parental_control'].includes(read.kind) ? `Gemini Nano on this phone: ${read.about}` : ''].filter(Boolean).join('\n');
    findings.push({
      ref: `P${++n}`,
      code,
      check: 'phone.apps',
      service: 'phone',
      group: app.installer === 'play' && ONE_KIND.includes(code) && !(read && CAUTION_KINDS.includes(read.kind)) ? 'phone_one' : PHONE_CODES[code].group,
      label: shortLabel([app.label, where].filter(Boolean).join('\n')),
      detail,
      howFound: read ? 'both' : 'reader',
      confidence: 'high',
      disagree: false,
      recency: 'unknown',
      access: code === 'phone.app.location_always' ? ['location'] : ['messages', 'location', 'account'],
      ownership: null,
      openUrl: '',
      // On the phone only: the app to open in Settings, and what it can do as a list for the card. Never sent
      // anywhere (toCloud() takes the code alone).
      pkg: app.pkg,
      name: app.label,
      can: powers,
      where,
      note: read && CAUTION_KINDS.includes(read.kind) ? read.about || '' : '',
      kind: read?.kind || 'unknown',
    });
  }
  if (facts?.device?.usb_debugging) {
    findings.push({
      ref: `P${++n}`, code: 'phone.usb_debugging', check: 'phone.settings', service: 'phone', group: 'phone',
      label: 'USB debugging is on', detail: 'USB debugging is on. A computer connected to this phone can install and control apps.',
      howFound: 'reader', confidence: 'high', disagree: false, recency: 'unknown', access: ['account'], ownership: null, openUrl: '',
    });
  }
  // Signs the phone is rooted, read by PhoneScan.kt: a root tool on the phone, a rooting app, or Android built with test
  // keys. None of them proves it, and a hidden root shows none of them, so the finding says "may be".
  const ROOT_WORDS = { su_binary: 'a root tool (su) is on the phone', root_app: 'a rooting app is installed', test_keys: 'Android on this phone was not built with the maker’s release keys' };
  const signs = (facts?.device?.root_signs || []).filter(s => ROOT_WORDS[s]);
  if (signs.length) {
    findings.push({
      ref: `P${++n}`, code: 'phone.rooted', check: 'phone.settings', service: 'phone', group: 'phone',
      label: 'This phone may be rooted', detail: `Signs: ${signs.map(s => ROOT_WORDS[s]).join('; ')}. An app on a rooted phone can hide from checks like this one, and from the phone’s own settings.`,
      howFound: 'reader', confidence: 'high', disagree: false, recency: 'unknown', access: ['account'], ownership: null, openUrl: '',
    });
  }
  const outcomes = [
    { id: 'phone.apps', service: 'phone', status: 'checked', how: 'reader', entries: apps.length, findings: findings.filter(f => f.check === 'phone.apps').length, partly: false, why: null },
    { id: 'phone.settings', service: 'phone', status: 'checked', how: 'reader', entries: 1, findings: findings.filter(f => f.check === 'phone.settings').length, partly: false, why: null },
  ];
  // Monitoring-looking and outside-the-store apps first, then by how much they can do.
  const rank = f => (f.kind === 'monitoring' ? 0 : 1) * 10 + Object.keys(PHONE_CODES).indexOf(f.code);
  findings.sort((a, b) => rank(a) - rank(b));
  return { findings, outcomes, builtIn, nanoSetAside: setAside };
}

/** ask_device for a phone finding, answered on the phone from what it read: 'yes', 'no' or 'unknown'. */
export function phoneAnswer(f, question) {
  if (!f || f.service !== 'phone') return 'unknown';
  if (question === 'app_outside_store') return /outside the Play Store/.test(f.detail || '') ? 'yes' : /from the Play Store/.test(f.detail || '') ? 'no' : 'unknown';
  // Gemini Nano's reading can raise concern, never lower it: "this looks everyday" is not evidence, so it is 'unknown'.
  if (question === 'app_looks_like_monitoring') return f.kind === 'monitoring' ? 'yes' : 'unknown';
  if (question === 'app_can_see_location') return f.access?.includes('location') ? 'yes' : 'unknown';
  return 'unknown';
}

// Gemini Nano on the phone: what kind of app this seems to be, from its name, package and powers. ONLY_ON_DEVICE: the
// list of apps on someone's phone is private. Nano can only add a note and a kind; it can never hide a finding, and
// its note is shown only when it is a caution (CAUTION_KINDS): a line like "a well-known weather app" would reassure,
// and a model's guess is not grounds for that.
export const APP_KIND_SYSTEM = `You look at one app on a person's own Android phone: its name, its package name, where it was installed from and the
powers it holds. Say what kind of app it most likely is, from what it is called:
"monitoring" for an app made to watch someone (spyware, "phone tracker", a hidden "system service" that did not come with the phone),
"family_locator" for a family or friends location app (Life360, Find My Kids), "parental_control",
"assistive" for screen readers, password managers and other tools that need these powers to help the person,
"everyday" for well-known apps (maps, weather, launchers, keyboards, watch and earbud companions, banks, messengers),
or "unknown" when you cannot tell.
The powers are never a reason on their own. Many everyday apps read notifications, use accessibility or see location:
a watch app, a password manager, a weather app. Another part of the program already counts the powers.
In "evidence" say what your answer rests on: "name" when the app's name tells you, "package" when its package name
tells you, "powers" when only the powers made you think so, "none" when you cannot tell. If it is "powers" or "none",
the kind must be "unknown".
Then write "about": at most 15 plain words on what the app seems to be. Never say an app is safe.
Examples.
App name: Life360. Package: com.life360.android.safetymapd. Answer: kind "family_locator", evidence "name".
App name: Galaxy Wearable. Package: com.samsung.android.app.watchmanager. Powers: can read notifications. Answer: kind "everyday", evidence "name".
App name: Sync Services. Package: com.sync.svc. Installed from: outside the Play Store. Powers: can read and control the screen; can read notifications. Answer: kind "monitoring", evidence "name".
App name: Notes Plus. Package: com.example.notesplus. Powers: can read notifications. Answer: kind "unknown", evidence "none".`;
export const APP_KIND_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['monitoring', 'family_locator', 'parental_control', 'assistive', 'everyday', 'unknown'] },
    evidence: { type: 'string', enum: ['name', 'package', 'powers', 'none'] },
    about: { type: 'string', maxLength: 120 },
  },
  required: ['kind', 'evidence', 'about'],
};
export const CAUTION_KINDS = ['monitoring', 'family_locator', 'parental_control'];
/** The text Gemini Nano reads for one app. */
export function appKindText(app) {
  const p = app.powers || {};
  return [
    `App name: ${String(app.label || '').slice(0, 80)}`,
    `Package: ${String(app.pkg || '').slice(0, 120)}`,
    `Installed from: ${app.installer === 'play' ? 'Google Play Store' : app.installer === 'other' ? 'outside the Play Store' : 'unknown'}`,
    `Powers: ${ORDER.filter(k => p[k]).map(k => POWER_WORDS[k]).join('; ') || 'none'}`,
  ].join('\n');
}
/** Gemini Nano's answer, kept only when it is one of the kinds, with its note cleaned of anything it should not say. */
export function appKindFrom(answer) {
  const kinds = APP_KIND_SCHEMA.properties.kind.enum;
  const kind = kinds.includes(answer?.kind) ? answer.kind : 'unknown';

  const about = String(answer?.about || '').replace(/\b(safe|secure|harmless|nothing to worry)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return { kind, about };
}
