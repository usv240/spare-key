// The services and checks Spare Key runs, with the reader settings for each page. These are the defaults; Remote
// Config's "catalogue" key can override any field of any check by id (a new URL, wait condition or selector after a
// site changes its pages), with no store update.
//
// URL status, November 21, 2026 (docs/day1-verify.md):
//   "known"  the site answers the path with a sign-in redirect and a made-up path with 404, so the page exists
//   "route"  a Gmail settings route inside the app (after #), which a signed-out request cannot test
// Reader settings are PROVISIONAL until each page's signed-in structure is recorded from the test accounts
// (tools/record-pages.mjs). They lean on text and links rather than class names, which change most often.
// emptyText is each page's own words for an empty list, also provisional: a page that lists nothing without saying so
// is reported as "looked different", never as nothing found (the layout drift test, tools/drift-test.mjs).
import { remoteOverrides } from './overrides.js';
import { EMAIL_SOURCE, PHONE_SOURCE, MASKED_PHONE_SOURCE } from '../../../shared/text.js';

const GOOGLE_SIGNED_OUT = 'accounts\\.google\\.com/(v3/signin/(identifier|accountchooser)|ServiceLogin|AccountChooser|InteractiveLogin|signin/v2/identifier)';
const GOOGLE_REAUTH = 'accounts\\.google\\.com/(v3/signin/challenge|signin/v2/challenge|v3/signin/confirmidentifier)';
const AMAZON_SIGNED_OUT = 'amazon\\.com/ap/signin';
const AMAZON_REAUTH = 'amazon\\.com/ap/(cvf|mfa)';
const GOOGLE_ACCOUNT = ['[aria-label^="Google Account:"]', 'a[aria-label*="Google Account"]', '[data-sk-account]'];

export const PRACTICE_ORIGIN = 'https://spare-key-app.web.app';

// The page readers' version, sent in an opt-in layout report so the builder knows which readers a page broke.
// A Remote Config catalogue override sets its own ("rc-" and a date) in its "version" field.
export const READER_VERSION = '2026-11-23';
export const readerVersion = (overrides = remoteOverrides()) => (typeof overrides?.version === 'string' && /^[\w.-]{1,19}$/.test(overrides.version) ? overrides.version : READER_VERSION);

export const SERVICES = [
  { id: 'google', label: 'Google account', origins: ['https://myaccount.google.com/*'] },
  { id: 'gmail', label: 'Gmail', origins: ['https://mail.google.com/*'] },
  { id: 'photos', label: 'Google Photos', origins: ['https://photos.google.com/*'] },
  { id: 'amazon', label: 'Amazon', origins: ['https://www.amazon.com/*'] },
  { id: 'chrome', label: 'This Chrome browser', origins: [] },
];

const google = reader => ({ account: GOOGLE_ACCOUNT, ...reader });

export const CHECKS = [
  {
    id: 'google.devices', service: 'google', priority: 'must',
    label: 'Devices signed in to your Google account',
    progress: 'Checking which devices are signed in to your Google account',
    pages: [{
      url: 'https://myaccount.google.com/device-activity?authuser={u}', urlStatus: 'known',
      practiceUrl: '/practice/google/device-activity.html',
      reader: google({
        waitFor: { text: '(your devices|where you.re signed in|signed in)' },
        item: 'a[href*="device-activity/id/"]',
        exclude: '^(learn more|find a lost device|manage all devices)$',
      }),
    }],
  },
  {
    id: 'google.apps', service: 'google', priority: 'must',
    label: 'Apps that can use your Google account',
    progress: 'Checking which apps can use your Google account',
    pages: [{
      // Recorded November 22, 2026 on a real account: the page is now "Linked apps" and lists every app that uses "Sign
      // in with Google" (50 there). filters=3 shows only the apps with access to account data (3 there), which is
      // what Spare Key reports; an app that only signs you in cannot read anything.
      url: 'https://myaccount.google.com/connections?filters=3&authuser={u}', urlStatus: 'known',
      practiceUrl: '/practice/google/connections.html',
      reader: google({
        waitFor: { text: '(third.party|apps (and|&) services|connections|linked apps)' },
        item: 'a[href*="linkedapps/overview/"], a[href*="connections/link"], a[href*="connections/overview/"], a[href*="permissions/"]',
        exclude: '^(see all connections|learn more)$',
        emptyText: '(access to \\(0\\)|no (third-party )?(apps|connections)|you (haven.t|have not) (given|granted|connected))',
      }),
    }],
  },
  {
    id: 'google.recovery', service: 'google', priority: 'must',
    label: 'Your recovery phone and email',
    progress: 'Checking the phone and email that can get back into your account',
    pages: [
      {
        url: 'https://myaccount.google.com/signinoptions/rescuephone?authuser={u}', urlStatus: 'known',
        practiceUrl: '/practice/google/rescuephone.html',
        reader: google({ waitFor: { text: '(recovery phone|phone)' }, patterns: [PHONE_SOURCE, MASKED_PHONE_SOURCE], emptyText: '(add (a )?recovery phone|no recovery phone)' }),
      },
      {
        url: 'https://myaccount.google.com/recovery/email?authuser={u}', urlStatus: 'known',
        practiceUrl: '/practice/google/recovery-email.html',
        reader: google({ waitFor: { text: '(recovery email|email)' }, patterns: [EMAIL_SOURCE], emptyText: '(add (a )?recovery email|no recovery email)' }),
      },
    ],
  },
  {
    id: 'google.2sv', service: 'google', priority: 'must',
    label: 'Phones and keys for 2-Step Verification',
    progress: 'Checking which phones can approve a sign-in',
    pages: [{
      url: 'https://myaccount.google.com/signinoptions/twosv?authuser={u}', urlStatus: 'known',
      practiceUrl: '/practice/google/twosv.html',
      reader: google({
        waitFor: { text: '(2-step verification|second steps)' },
        // Each second step is one link row on the real page ("Google prompt / 3 devices"). Reading by words alone
        // counted headings and "Add authenticator app" as steps: 7 on a page with 3 (November 22, 2026).
        item: 'a[href*="signinoptions/passkeys"], a[href*="two-step-verification/"]',
        patterns: [PHONE_SOURCE, MASKED_PHONE_SOURCE, '\\b\\d+\\s+(devices?|phones?)\\b', '\\bauthenticator\\b', '\\b(security key|passkey)s?\\b'],
        // A row that only offers to add or get something is not a way in.
        exclude: '(^(turn off 2-step verification|backup codes)|\\n\\s*(add|set up|get)\\b)',
        emptyText: '(2-step verification is off|turn on 2-step verification)',
      }),
    }],
  },
  {
    id: 'maps.sharing', service: 'google', priority: 'must',
    label: 'People who can see your location',
    progress: 'Checking who can see your location',
    // Google Account's own Location sharing page; the Maps paths answer 404.
    pages: [{
      url: 'https://myaccount.google.com/locationsharing?authuser={u}', urlStatus: 'known',
      practiceUrl: '/practice/google/locationsharing.html',
      reader: google({
        waitFor: { text: 'location sharing' },
        patterns: [EMAIL_SOURCE, '\\bsharing (until|for|since)\\b', 'anyone with (the|this) link'],
        exclude: '^(location sharing|learn more)$',
        // Real wording, November 22, 2026: "You aren't sharing real-time location with anyone on Google."
        emptyText: '(you.re not sharing|aren.t sharing|not sharing your location|no one can see your location)',
      }),
    }],
  },
  {
    id: 'gmail.forwarding', service: 'gmail', priority: 'must',
    label: 'Gmail forwarding',
    progress: 'Checking whether your mail is forwarded somewhere',
    pages: [{
      url: 'https://mail.google.com/mail/u/{u}/#settings/fwdandpop', urlStatus: 'route',
      practiceUrl: '/practice/gmail/fwdandpop.html',
      reader: google({
        main: '[role="main"]',
        waitFor: { text: '(forwarding|pop download|imap access)' },
        within: '^\\s*forwarding:?\\s*$',
        patterns: ['forward a copy of incoming mail to', 'disable forwarding'],
        emptyText: '(add a forwarding address|forwarding is (off|disabled))',
      }),
    }],
  },
  {
    id: 'gmail.filters', service: 'gmail', priority: 'must',
    label: 'Gmail filters that forward or hide mail',
    progress: 'Checking your Gmail filters',
    pages: [{
      url: 'https://mail.google.com/mail/u/{u}/#settings/filters', urlStatus: 'route',
      practiceUrl: '/practice/gmail/filters.html',
      reader: google({
        main: '[role="main"]',
        waitFor: { text: '(filters|blocked addresses)' },
        patterns: ['\\bdo this:'],
        // Real Gmail with no filters (November 22, 2026) shows the heading, then straight away the Select buttons.
        emptyText: '(you (currently )?have no filters|no filters|applied to all incoming mail:\\s*select:)',
      }),
    }],
  },
  {
    id: 'gmail.delegates', service: 'gmail', priority: 'must',
    label: 'People who can open your Gmail',
    progress: 'Checking who else can open your Gmail',
    pages: [{
      url: 'https://mail.google.com/mail/u/{u}/#settings/accounts', urlStatus: 'route',
      practiceUrl: '/practice/gmail/accounts.html',
      reader: google({
        main: '[role="main"]',
        waitFor: { text: '(grant access to your account|send mail as)' },
        within: '^\\s*grant access to your account',
        patterns: [EMAIL_SOURCE],
        // Real Gmail's section also holds the person's own sender options, like "Show this address only (you@...)".
        exclude: '^(show this address|mark (the )?conversation|leave (the )?conversation|add another account|sender information)',
      }),
    }],
  },
  { id: 'chrome.extensions', service: 'chrome', priority: 'must', label: 'Extensions in this browser that can read every page', progress: 'Checking the extensions in this browser', permissions: ['management'], pages: [] },
  { id: 'chrome.sync', service: 'chrome', priority: 'must', label: 'The account this browser syncs to', progress: 'Checking which account this browser syncs to', permissions: ['identity', 'identity.email'], pages: [] },
  {
    id: 'amazon.household', service: 'amazon', priority: 'should',
    label: 'People in your Amazon household',
    progress: 'Checking who shares your Amazon account',
    // Amazon moved Household to "Amazon Family": /myh/households and /myh/manage now redirect here.
    pages: [{
      url: 'https://www.amazon.com/hz/profilepicker/amazonfamily/members', urlStatus: 'known',
      practiceUrl: '/practice/amazon/members.html',
      reader: { waitFor: { text: '(household|family|members)' }, patterns: ['\\b(adult|teen|child)\\b'], exclude: '^(add (an )?(adult|teen|child)|learn more)', emptyText: '(no (household|family) members|you (haven.t|have not) added anyone)' },
    }],
  },
  {
    id: 'amazon.devices', service: 'amazon', priority: 'should',
    label: 'Devices on your Amazon account',
    progress: 'Checking the devices on your Amazon account',
    pages: [{
      // "devicelist" now opens the content library, where book titles read as devices: 6 false finds on a real
      // account (November 22, 2026). The device list is "alldevices", shown as groups ("Echo, 1 device";
      // "Alexa, on 3 devices"): one entry per group, and the check is "in part" since each group hides its devices.
      url: 'https://www.amazon.com/hz/mycd/digital-console/alldevices', urlStatus: 'known',
      practiceUrl: '/practice/amazon/devicelist.html',
      reader: {
        // The page's own area: the top menu's "Kindle Books" read as a device.
        main: '.body-inner',
        waitFor: { text: '(devices|kindle|echo|fire)' },
        patterns: ['\\b(on )?\\d+ devices?\\b', '\\b(echo|kindle|fire tv|fire tablet|ring|blink|alexa)\\b'],
        partlyWhen: '\\b(on )?\\d+ devices?\\b',
        emptyText: '(no devices (found|registered)|you (don.t|do not) have any devices)',
      },
    }],
  },
  {
    id: 'google.family', service: 'google', priority: 'should',
    label: 'Your Google family group',
    progress: 'Checking your Google family group',
    pages: [{
      url: 'https://myaccount.google.com/family/details?authuser={u}', urlStatus: 'known',
      practiceUrl: '/practice/google/family.html',
      reader: google({ waitFor: { text: '(family group|family manager|members)' }, patterns: ['\\b(family manager|parent|member)\\b'], emptyText: '(create a family group|you.re not (in|part of) a family group)' }),
    }],
  },
  {
    id: 'photos.sharing', service: 'photos', priority: 'should',
    label: 'Google Photos partner sharing',
    progress: 'Checking who your photos are shared with',
    pages: [{
      url: 'https://photos.google.com/u/{u}/settings', urlStatus: 'known',
      practiceUrl: '/practice/photos/settings.html',
      reader: google({ waitFor: { text: '(partner sharing|sharing)' }, within: 'partner sharing', patterns: [EMAIL_SOURCE, '\\bshared with\\b'] }),
    }],
  },
];

const DEFAULT_PAGE_READER = { timeoutMs: 15000 };
const OVERRIDABLE = ['pages', 'words', 'enabled', 'progress', 'signedOutPattern', 'reauthPattern'];

// An override may only point a check at its own service's site (and the practice pages at the Spare Key site).
function pagesAllowed(service, pages) {
  if (!Array.isArray(pages) || !pages.length) return false;
  const origins = SERVICES.find(s => s.id === service)?.origins.map(o => o.replace(/\*$/, '')) || [];
  return pages.every(p => p && typeof p.url === 'string' && origins.some(o => p.url.startsWith(o))
    && (!p.practiceUrl || (typeof p.practiceUrl === 'string' && p.practiceUrl.startsWith('/practice/')))
    && (!p.reader || typeof p.reader === 'object'));
}

/** The catalogue with Remote Config's overrides applied. Unknown ids and unknown fields in an override are ignored. */
export function catalogue(overrides = remoteOverrides()) {
  return CHECKS.map(check => {
    const o = overrides && typeof overrides === 'object' ? overrides[check.id] : null;
    const merged = { enabled: true, ...check };
    if (o && typeof o === 'object') for (const key of OVERRIDABLE) {
      if (!Object.hasOwn(o, key)) continue;
      if (key === 'pages' && !pagesAllowed(check.service, o.pages)) continue;
      merged[key] = o[key];
    }
    merged.signedOutPattern ||= check.service === 'amazon' ? AMAZON_SIGNED_OUT : GOOGLE_SIGNED_OUT;
    merged.reauthPattern ||= check.service === 'amazon' ? AMAZON_REAUTH : GOOGLE_REAUTH;
    merged.pages = (merged.pages || []).map(p => ({ ...p, reader: { ...DEFAULT_PAGE_READER, ...(p.reader || {}) } }));
    merged.url = merged.pages[0]?.url || '';
    return merged;
  });
}

/** A check's page for account number `u` (0 to 3). */
export const pageUrl = (url, u = 0) => String(url).replaceAll('{u}', String(Math.max(0, Math.min(3, u | 0))));
