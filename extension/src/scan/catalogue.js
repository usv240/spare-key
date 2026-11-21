// The services and checks Spare Key runs. These are the defaults; Remote Config's "catalogue" key can override any
// field of any check by id (for example a new URL or selector after a site changes), with no store update.
//
// URL status, November 21, 2026 (see docs/day1-verify.md):
//   "known"     the site answers the path with a sign-in redirect, and answers a made-up path on the same site with 404,
//               so the page exists. Its signed-in structure is not recorded yet.
//   "route"     a Gmail settings route inside the app (after #), which a signed-out request cannot test.
// Every check's signed-in structure (waitFor, selectors) is recorded on day 2 from test accounts.
import { remoteOverrides } from './overrides.js';

const GOOGLE_SIGNED_OUT = 'accounts\\.google\\.com/(v3/signin|ServiceLogin|InteractiveLogin|signin)';
const AMAZON_SIGNED_OUT = 'amazon\\.com/ap/signin';

export const SERVICES = [
  { id: 'google', label: 'Google account', origins: ['https://myaccount.google.com/*'] },
  { id: 'gmail', label: 'Gmail', origins: ['https://mail.google.com/*'] },
  { id: 'photos', label: 'Google Photos', origins: ['https://photos.google.com/*'] },
  { id: 'amazon', label: 'Amazon', origins: ['https://www.amazon.com/*'] },
  { id: 'chrome', label: 'This Chrome browser', origins: [] },
];

export const CHECKS = [
  {
    id: 'google.devices', service: 'google', priority: 'must',
    label: 'Devices signed in to your Google account',
    progress: 'Checking which devices are signed in to your Google account',
    url: 'https://myaccount.google.com/device-activity?authuser={u}', urlStatus: 'known',
  },
  {
    id: 'google.apps', service: 'google', priority: 'must',
    label: 'Apps that can use your Google account',
    progress: 'Checking which apps can use your Google account',
    url: 'https://myaccount.google.com/connections?authuser={u}', urlStatus: 'known',
  },
  {
    id: 'google.recovery', service: 'google', priority: 'must',
    label: 'Your recovery phone and email',
    progress: 'Checking the phone and email that can get back into your account',
    // Two pages: the recovery phone and the recovery email each have their own.
    url: 'https://myaccount.google.com/signinoptions/rescuephone?authuser={u}', urlStatus: 'known',
    extraUrls: ['https://myaccount.google.com/recovery/email?authuser={u}'],
  },
  {
    id: 'google.2sv', service: 'google', priority: 'must',
    label: 'Phones and keys for 2-Step Verification',
    progress: 'Checking which phones can approve a sign-in',
    url: 'https://myaccount.google.com/signinoptions/twosv?authuser={u}', urlStatus: 'known',
  },
  {
    id: 'gmail.forwarding', service: 'gmail', priority: 'must',
    label: 'Gmail forwarding',
    progress: 'Checking whether your mail is forwarded somewhere',
    url: 'https://mail.google.com/mail/u/{u}/#settings/fwdandpop', urlStatus: 'route',
  },
  {
    id: 'gmail.filters', service: 'gmail', priority: 'must',
    label: 'Gmail filters that forward or hide mail',
    progress: 'Checking your Gmail filters',
    url: 'https://mail.google.com/mail/u/{u}/#settings/filters', urlStatus: 'route',
  },
  {
    id: 'gmail.delegates', service: 'gmail', priority: 'must',
    label: 'People who can open your Gmail',
    progress: 'Checking who else can open your Gmail',
    url: 'https://mail.google.com/mail/u/{u}/#settings/accounts', urlStatus: 'route',
  },
  {
    id: 'maps.sharing', service: 'google', priority: 'must',
    label: 'People who can see your location',
    progress: 'Checking who can see your location',
    // Google Account's own Location sharing page. The Maps paths tried (google.com/maps/locationsharing and others)
    // answer 404; this page is known to the Google Account site.
    url: 'https://myaccount.google.com/locationsharing?authuser={u}', urlStatus: 'known',
  },
  { id: 'chrome.extensions', service: 'chrome', priority: 'must', label: 'Extensions in this browser that can read every page', progress: 'Checking the extensions in this browser', permission: 'management' },
  { id: 'chrome.sync', service: 'chrome', priority: 'must', label: 'The account this browser sends your data to', progress: 'Checking which account this browser syncs to', permission: 'identity' },
  {
    id: 'amazon.household', service: 'amazon', priority: 'should',
    label: 'People in your Amazon household',
    progress: 'Checking who shares your Amazon account',
    // Amazon moved Household to "Amazon Family": /myh/households and /myh/manage now redirect here.
    url: 'https://www.amazon.com/hz/profilepicker/amazonfamily/members', urlStatus: 'known',
  },
  {
    id: 'amazon.devices', service: 'amazon', priority: 'should',
    label: 'Devices on your Amazon account',
    progress: 'Checking the devices on your Amazon account',
    url: 'https://www.amazon.com/hz/mycd/digital-console/devicelist', urlStatus: 'known',
  },
  {
    id: 'google.family', service: 'google', priority: 'should',
    label: 'Your Google family group',
    progress: 'Checking your Google family group',
    url: 'https://myaccount.google.com/family/details?authuser={u}', urlStatus: 'known',
  },
  {
    id: 'photos.sharing', service: 'photos', priority: 'should',
    label: 'Google Photos partner sharing',
    progress: 'Checking who your photos are shared with',
    url: 'https://photos.google.com/u/{u}/settings', urlStatus: 'known',
  },
];

const DEFAULTS = { timeoutMs: 15000, enabled: true, minVersion: '0.1.0' };

/** The catalogue with Remote Config's overrides applied. Unknown ids and unknown fields in an override are ignored. */
export function catalogue(overrides = remoteOverrides()) {
  return CHECKS.map(check => {
    const o = overrides && typeof overrides === 'object' ? overrides[check.id] : null;
    const merged = { ...DEFAULTS, ...check };
    if (o && typeof o === 'object') for (const key of ['url', 'extraUrls', 'waitFor', 'selectors', 'timeoutMs', 'enabled', 'signedOutPattern', 'progress']) {
      if (Object.hasOwn(o, key)) merged[key] = o[key];
    }
    merged.signedOutPattern ||= check.service === 'amazon' ? AMAZON_SIGNED_OUT : GOOGLE_SIGNED_OUT;
    return merged;
  });
}

/** A check's page for account number `u` (0 to 3). */
export const pageUrl = (url, u = 0) => url.replaceAll('{u}', String(Math.max(0, Math.min(3, u | 0))));
