// Settings shared by the extension, the site and the Remote Config template.

// The National Domestic Violence Hotline. Checked against https://www.thehotline.org on November 21, 2026:
// call 1.800.799.7233, text "START" to 88788. Re-check before every release.
export const HOTLINE = {
  name: 'National Domestic Violence Hotline',
  word: 'START',
  to: '88788',
  call: '1-800-799-7233',
  tel: 'tel:+18007997233',
  text: 'Text START to 88788',
  sms: 'sms:88788?&body=START',
  web: 'https://www.thehotline.org',
  checked: '2026-11-21',
};

// The backup line, for when the first one is busy: loveisrespect. Checked against https://www.loveisrespect.org on
// November 24, 2026: call 1.866.331.9474, text "LOVEIS" to 22522. Re-check before release.
export const HOTLINE_BACKUP = {
  name: 'loveisrespect',
  call: '1-866-331-9474',
  tel: 'tel:+18663319474',
  word: 'LOVEIS',
  to: '22522',
  text: 'Text LOVEIS 22522',
  sms: 'sms:22522?&body=LOVEIS',
  web: 'https://www.loveisrespect.org',
  checked: '2026-11-24',
};
// For danger right now.
export const EMERGENCY = { call: '911', tel: 'tel:911' };

/**
 * The two lines to show, from Remote Config's `hotline` key when it is well formed, so a changed number reaches every
 * install with no store update. Anything malformed falls back to the bundled lines, one line at a time.
 */
export function hotlinesFrom(remote) {
  const line = (r, fallback) => {
    if (!r || typeof r !== 'object') return fallback;
    const call = String(r.call || '');
    const web = String(r.web || '');
    const word = String(r.word || '');
    const to = String(r.to || '');
    if (!/^1-\d{3}-\d{3}-\d{4}$/.test(call) || !/^https:\/\/[\w.-]+\.org\/?$/.test(web)) return fallback;
    if (!/^[A-Z]{2,12}$/.test(word) || !/^\d{5,6}$/.test(to)) return fallback;
    const name = /^[\w .'-]{2,60}$/.test(String(r.name || '')) ? String(r.name) : fallback.name;
    return { name, call, tel: `tel:+${call.replace(/-/g, '')}`, word, to, text: `Text ${word} ${to}`, sms: `sms:${to}?&body=${word}`, web, checked: fallback.checked };
  };
  return { main: line(remote, HOTLINE), backup: line(remote?.backup, HOTLINE_BACKUP) };
}

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
  plan_templates: { type: 'STRING', value: 'spare-key-plan-v1,spare-key-plan-b-v1', about: 'Firebase AI Logic server prompt templates the cloud plan is asked through, in order. Empty: the direct call only. The direct call is always the last backup.' },
  device_models: { type: 'STRING', value: 'preview_fast,preview,stable', about: 'Android on-device models in order: preview_fast (Gemini Nano 4 Fast), preview (Gemini Nano 4 Full), stable (the Gemini Nano a phone ships with). The first one the phone has is used.' },
  hotline: { type: 'JSON', value: JSON.stringify({ name: HOTLINE.name, call: HOTLINE.call, word: HOTLINE.word, to: HOTLINE.to, web: HOTLINE.web, backup: { name: HOTLINE_BACKUP.name, call: HOTLINE_BACKUP.call, word: HOTLINE_BACKUP.word, to: HOTLINE_BACKUP.to, web: HOTLINE_BACKUP.web } }), about: 'The hotline and its backup line, shown on every screen. A malformed line falls back to the bundled one.' },
};

/** Remote Config defaults in the shape the web SDK takes (rc.defaultConfig). */
export const remoteDefaultConfig = () => Object.fromEntries(Object.entries(REMOTE_DEFAULTS).map(([k, v]) => [k, v.value]));
