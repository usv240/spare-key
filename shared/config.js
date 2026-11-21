// Settings shared by the extension, the site and the Remote Config template.

// The National Domestic Violence Hotline. Checked against https://www.thehotline.org on November 21, 2026:
// call 1.800.799.7233, text "START" to 88788. Re-check before every release.
export const HOTLINE = {
  call: '1-800-799-7233',
  tel: 'tel:+18007997233',
  text: 'Text START to 88788',
  sms: 'sms:88788?&body=START',
  web: 'https://www.thehotline.org',
  checked: '2026-11-21',
};

// Where Quick exit goes: an ordinary page that says nothing about Spare Key.
export const QUICK_EXIT_URL = 'https://www.google.com/search?q=weather';

// Cloud models, in the order they are tried. Both are on the Gemini Developer API free tier (checked on
// https://ai.google.dev/gemini-api/docs/pricing, November 21, 2026). The next one is tried when one is busy.
export const CLOUD_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

/**
 * Remote Config keys and their defaults. remoteconfig.template.json is generated from this object
 * (node tools/remote-config.mjs), so the code's fallback and the published template cannot drift apart.
 */
export const REMOTE_DEFAULTS = {
  catalogue: { type: 'JSON', value: '{}', about: 'Per-check overrides (URL, wait condition, selectors, on or off), keyed by check id. Empty means the bundled catalogue. This is how a broken page reader is fixed without a store update.' },
  cloud_models: { type: 'STRING', value: CLOUD_MODELS.join(','), about: 'Cloud models in the order to try them.' },
  cloud_on: { type: 'BOOLEAN', value: 'true', about: 'Turns every cloud step off for all installs. The product still works from the on-device steps library.' },
  two_voice_on: { type: 'BOOLEAN', value: 'true', about: 'The two-voice check on the plan.' },
  freshness_on: { type: 'BOOLEAN', value: 'true', about: 'The steps freshness check (reads the official help page with the URL context tool).' },
  max_cloud_calls: { type: 'NUMBER', value: '12', about: 'Most cloud calls one scan may make.' },
  fresh_days: { type: 'NUMBER', value: '45', about: 'Days after which a steps library entry counts as stale.' },
  quick_exit_url: { type: 'STRING', value: QUICK_EXIT_URL, about: 'Where Quick exit goes.' },
  hotline: { type: 'JSON', value: JSON.stringify({ call: HOTLINE.call, text: HOTLINE.text, web: HOTLINE.web }), about: 'The hotline shown on every screen.' },
};

/** Remote Config defaults in the shape the web SDK takes (rc.defaultConfig). */
export const remoteDefaultConfig = () => Object.fromEntries(Object.entries(REMOTE_DEFAULTS).map(([k, v]) => [k, v.value]));
