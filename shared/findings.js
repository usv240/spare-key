// Finding codes, the checks that produce them, and the groups the results are shown in.
// A finding code names a kind of access (for example "mail is forwarded to another address"). It never names a
// person, an address or a device, which is why codes are the only thing about a scan that may leave the computer.

// Groups, in the order the results show them: the access that matters most comes first.
export const GROUPS = ['location', 'mail', 'account', 'purchases', 'photos', 'devices', 'browsing'];

export const GROUP_LABELS = {
  location: 'Can see your location',
  mail: 'Can read your mail',
  account: 'Can get into your account',
  purchases: 'Can see your purchases and addresses',
  photos: 'Can see your photos',
  devices: 'Devices linked to your account',
  browsing: 'Can see what you do in Chrome',
};

// Every code the product can produce: its group and the check that finds it.
export const CODES = {
  'google.devices.other': { group: 'account', check: 'google.devices' },
  'google.apps.full_access': { group: 'account', check: 'google.apps' },
  'google.apps.read_mail': { group: 'mail', check: 'google.apps' },
  'google.apps.location': { group: 'location', check: 'google.apps' },
  'google.recovery.phone_unconfirmed': { group: 'account', check: 'google.recovery' },
  'google.recovery.email_other': { group: 'account', check: 'google.recovery' },
  'google.2sv.other_device': { group: 'account', check: 'google.2sv' },
  'gmail.forwarding.external': { group: 'mail', check: 'gmail.forwarding' },
  'gmail.filter.forwards': { group: 'mail', check: 'gmail.filters' },
  'gmail.filter.hides': { group: 'mail', check: 'gmail.filters' },
  'gmail.delegate': { group: 'mail', check: 'gmail.delegates' },
  'maps.sharing.person': { group: 'location', check: 'maps.sharing' },
  'maps.sharing.link': { group: 'location', check: 'maps.sharing' },
  'chrome.extension.broad_access': { group: 'browsing', check: 'chrome.extensions' },
  'chrome.sync.other_account': { group: 'browsing', check: 'chrome.sync' },
  'amazon.household.adult': { group: 'purchases', check: 'amazon.household' },
  'amazon.household.teen': { group: 'purchases', check: 'amazon.household' },
  'amazon.device.other': { group: 'devices', check: 'amazon.devices' },
  'google.family.member': { group: 'account', check: 'google.family' },
  'google.family.manager_other': { group: 'account', check: 'google.family' },
  'photos.partner_sharing': { group: 'photos', check: 'photos.sharing' },
  'screenshot.sharing.person': { group: 'location', check: 'screenshot' },
};

// Every check id, including the services Spare Key does not check yet. A "not checked" item carries only one of
// these ids, never the reason text, which could hold an address or a page's words.
export const CHECK_IDS = [
  'google.devices', 'google.apps', 'google.recovery', 'google.2sv',
  'gmail.forwarding', 'gmail.filters', 'gmail.delegates',
  'maps.sharing', 'chrome.extensions', 'chrome.sync',
  'amazon.household', 'amazon.devices', 'google.family', 'photos.sharing', 'screenshot',
];
export const UNCHECKED_SERVICES = ['ring', 'life360', 'phone_carrier', 'apple', 'facebook', 'snapchat', 'your_phone'];

// Enums shared by the finding schema, the cloud projection and the plan.
export const OWNERSHIP = ['mine', 'not_mine', 'unsure'];
export const RECENCY = ['now', 'today', 'this_week', 'this_month', 'older', 'unknown'];
export const HOW_FOUND = ['reader', 'nano', 'both'];
export const NOT_CHECKED_WHY = ['signed_out', 'did_not_load', 'not_selected', 'not_covered', 'needs_nano', 'no_permission'];

export const SITUATION = {
  living: ['together', 'apart', 'prefer_not_to_say'],
  safe_to_change_now: ['yes', 'no', 'not_sure'],
  children_shared: ['yes', 'no', 'prefer_not_to_say'],
  has_advocate: ['yes', 'no', 'prefer_not_to_say'],
};
// The most cautious answer to each question, used whenever the person does not answer.
export const SITUATION_DEFAULTS = { living: 'prefer_not_to_say', safe_to_change_now: 'not_sure', children_shared: 'prefer_not_to_say', has_advocate: 'prefer_not_to_say' };

export const isCode = c => Object.hasOwn(CODES, c);
export const groupOf = c => CODES[c]?.group;
