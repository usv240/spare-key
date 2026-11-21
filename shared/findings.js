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
// other_services stands for every service Spare Key does not cover, as one "check it yourself" step.
export const UNCHECKED_SERVICES = ['ring', 'life360', 'phone_carrier', 'apple', 'facebook', 'snapchat', 'your_phone', 'other_services'];

// Enums shared by the finding schema, the cloud projection and the plan.
export const OWNERSHIP = ['mine', 'not_mine', 'unsure'];
export const RECENCY = ['now', 'today', 'this_week', 'this_month', 'older', 'unknown'];
export const HOW_FOUND = ['reader', 'nano', 'both'];
export const NOT_CHECKED_WHY = ['signed_out', 'needs_password', 'did_not_load', 'not_selected', 'not_covered', 'needs_nano', 'no_permission', 'practice', 'nothing_to_compare', 'stopped'];

export const SITUATION = {
  living: ['together', 'apart', 'prefer_not_to_say'],
  safe_to_change_now: ['yes', 'no', 'not_sure'],
  children_shared: ['yes', 'no', 'prefer_not_to_say'],
  has_advocate: ['yes', 'no', 'prefer_not_to_say'],
};
// The most cautious answer to each question, used whenever the person does not answer.
export const SITUATION_DEFAULTS = { living: 'prefer_not_to_say', safe_to_change_now: 'not_sure', children_shared: 'prefer_not_to_say', has_advocate: 'prefer_not_to_say' };

// What each code means, in plain words, for the results list. The steps library (data/steps.json, day 4) adds the
// verified steps, sources and whether a change is likely to be noticed.
export const CODE_TEXT = {
  'google.devices.other': ['A device is signed in to your Google account', 'Whoever has this device can open your Gmail, see your location history and change your settings.'],
  'google.apps.full_access': ['An app can use your Google account', 'This app can see, and may be able to change, information in your Google account.'],
  'google.apps.read_mail': ['An app can read your Gmail', 'This app can read your email, and may be able to send it.'],
  'google.apps.location': ['An app can see your location', 'This app can see where you are or where you have been.'],
  'google.recovery.phone_unconfirmed': ['A phone can reset your password', 'Whoever has this phone number can use it to get back into your account, even after you change your password.'],
  'google.recovery.email_other': ['Another email address can reset your password', 'Whoever reads this email address can use it to get back into your account.'],
  'google.2sv.other_device': ['A phone or device can approve sign-ins', 'A sign-in to your account can be approved from this phone or device.'],
  'gmail.forwarding.external': ['Your mail is being copied to another address', 'Every new email you get is also sent to this address. Whoever reads it sees your mail.'],
  'gmail.filter.forwards': ['A filter sends some of your mail to another address', 'Mail that matches this filter is sent on to another address.'],
  'gmail.filter.hides': ['A filter hides some of your mail', 'Mail that matches this filter skips your inbox or is deleted, so you may never see it.'],
  'gmail.delegate': ['Someone else can open your Gmail', 'This person can read, send and delete your mail.'],
  'maps.sharing.person': ['Someone can see your location', 'This person can see where you are right now.'],
  'maps.sharing.link': ['A link shows your location to anyone who has it', 'Anyone with this link can see where you are while it is on.'],
  'chrome.extension.broad_access': ['An extension can see what you do in Chrome', 'This extension can read the pages you visit in this browser.'],
  'chrome.sync.other_account': ['This browser sends your data to another account', 'Chrome may be sending your history and saved passwords to an account that is not the one you checked.'],
  'amazon.household.adult': ['Another adult shares your Amazon account', 'They can see your orders and the addresses they go to.'],
  'amazon.household.teen': ['A teen profile is on your Amazon account', 'A teen in your household can shop from your account, and you approve their orders.'],
  'amazon.device.other': ['A device is on your Amazon account', 'This device can show your orders, messages or camera feeds.'],
  'google.family.member': ['Someone is in your Google family group', 'People in your family group may share purchases, a calendar and location.'],
  'google.family.manager_other': ['Someone else manages your Google family group', 'A family manager can see some of your activity and change some of your settings.'],
  'photos.partner_sharing': ['Your photos are shared with someone', 'New photos you take may be shared with this person, and photos can show where they were taken.'],
  'screenshot.sharing.person': ['Someone can see your location in another app', 'A person on this sharing screen can see where you are.'],
};

export const isCode = c => Object.hasOwn(CODES, c);
export const groupOf = c => CODES[c]?.group;
