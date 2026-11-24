// A made-up phone for the practice check (the person called Jordan): what PhoneScan.kt would read on a phone where
// someone set up a monitoring app. Every name here is invented. Used by the Android app's "Try a practice phone" and
// by the tests, so anyone can see the phone check without a monitored phone.
export const PRACTICE_PHONE = {
  apps: [
    { pkg: 'com.sysupdate.service', label: 'System Update Service', system: false, installer: 'other', first_installed: 0,
      powers: { accessibility: true, device_admin: true, notifications: true, messages: true, location_always: true, usage_access: false } },
    { pkg: 'com.example.familyfinder', label: 'Family Finder', system: false, installer: 'play', first_installed: 0,
      powers: { accessibility: false, device_admin: false, notifications: false, messages: false, location_always: true, usage_access: false } },
    { pkg: 'com.example.notifymirror', label: 'Notify Mirror', system: false, installer: 'play', first_installed: 0,
      powers: { accessibility: false, device_admin: false, notifications: true, messages: false, location_always: false, usage_access: false } },
    { pkg: 'com.example.weathernow', label: 'Weather Now', system: false, installer: 'play', first_installed: 0,
      powers: { accessibility: false, device_admin: false, notifications: false, messages: false, location_always: true, usage_access: false } },
    { pkg: 'com.example.passwordkeeper', label: 'Password Keeper', system: false, installer: 'play', first_installed: 0,
      powers: { accessibility: true, device_admin: false, notifications: false, messages: false, location_always: false, usage_access: false } },
    // The phone's own keyboard: a system app with only usage access, left out by the rules.
    { pkg: 'com.android.inputmethod', label: 'Keyboard', system: true, installer: 'unknown', first_installed: 0,
      powers: { accessibility: false, device_admin: false, notifications: false, messages: false, location_always: false, usage_access: true } },
  ],
  device: { usb_debugging: true, android: '16', sdk: 36 },
};

// What the practice check should find, for the tests: one finding per code, by app.
export const PRACTICE_PHONE_EXPECTED = [
  ['System Update Service', 'phone.app.control'],
  ['Notify Mirror', 'phone.app.notifications'],
  ['Password Keeper', 'phone.app.accessibility'],
  ['Family Finder', 'phone.app.location_always'],
  ['Weather Now', 'phone.app.location_always'],
  [null, 'phone.usb_debugging'],
];
