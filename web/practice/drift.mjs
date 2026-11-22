// Layout drift (EVALUATION.md section 2): the practice pages, changed the way a site redesign changes a page, so the
// readers can be measured on pages they were not tuned on. Made by a script, the same every time: nobody picks which
// words or tags to change after seeing a result.
//
//   renamed    class names, link paths and data attributes renamed
//   reworded   headings and labels reworded (the words the readers wait for and match)
//   rebuilt    lists and tables rebuilt from plain boxes; links become clickable boxes with no link
//   formats    phone numbers masked or written another way, dates written out, a name shown without its email
//   all        all four at once
//
// The people with access do not change, so web/practice/pages.mjs EXPECTED holds for every copy.
export const DRIFT = [
  { id: 'renamed', label: 'Class names and link paths renamed' },
  { id: 'reworded', label: 'Headings and labels reworded' },
  { id: 'rebuilt', label: 'Lists and tables rebuilt from plain boxes, links turned into buttons' },
  { id: 'formats', label: 'Phone numbers, dates and names written differently' },
  { id: 'all', label: 'All four at once' },
];

const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36).slice(0, 6); };
const renameClass = name => `k${hash(name)}`;
// Change only the text between tags, never attributes (the account control's label stays as the site writes it).
const onText = (html, fn) => html.replace(/>([^<]+)</g, (m, t) => `>${fn(t)}<`);

function renamed(html) {
  return html
    .replace(/class="([^"]+)"/g, (m, v) => `class="${v.split(/\s+/).map(renameClass).join(' ')}"`)
    .replace(/device-activity\/id\//g, 'security/sessions/')
    .replace(/connections\/link\?id=/g, 'apps/item?app=')
    .replace(/data-section="/g, 'data-block="')
    .replace('href="/practice/practice.css"', 'href="/practice/drift/renamed.css"');
}
/** The practice stylesheet with the same class names renamed, so a renamed page still looks the same. */
export const renamedCss = css => css.replace(/\.([a-zA-Z][\w-]*)/g, (m, n) => `.${renameClass(n)}`);

// Longest first, so a phrase is reworded before any word inside it.
const WORDS = [
  ['You are signed in to your Google Account on these devices.', 'These devices are logged in to your Google Account.'],
  ['Your devices', 'Devices with access'],
  ['Third-party apps and services', 'Linked apps'],
  ['Apps you gave access to your Google Account.', 'Apps that can use your Google Account.'],
  ['Has access to Gmail', 'Can read and send email'],
  ['Has access to your location', 'Can see where you are'],
  ['Sign in with Google', 'Uses Google to log in'],
  ['Access given', 'Linked'],
  ['Your recovery phone can be used to get back into your account.', 'We can text this number if you get locked out.'],
  ['Recovery phone', 'Backup number'],
  ['Your recovery email can be used to get back into your account.', 'We can email this address if you get locked out.'],
  ['Recovery email', 'Backup email'],
  ['Second steps that can approve a sign-in to your account.', 'Ways to confirm it is you when you log in.'],
  ['2-Step Verification', 'Two-factor sign-in'],
  ['Google prompts', 'Tap to confirm'],
  ['2 devices: Pixel 8, iPhone 15', 'On Pixel 8 and iPhone 15'],
  ['Authenticator app', 'Code generator app'],
  ['People and links that can see your location.', 'People and links with your real-time location.'],
  ['Location sharing', 'Who can see where you are'],
  ['Sharing until you turn this off', 'Visible until you stop it'],
  ['Anyone with this link can see your location until 9:00 PM', 'Open to anybody who has the link until 9:00 PM'],
  ['Forwarding and POP/IMAP', 'Forwarding and email apps'],
  ['Forwarding:', 'Auto-forward:'],
  ['Disable forwarding', 'Off'],
  ['Forward a copy of incoming mail to', 'Send a copy of new mail to'],
  ['Filters and Blocked Addresses', 'Rules and blocked senders'],
  ['Matches:', 'When:'],
  ['Do this:', 'Then:'],
  ['Forward to', 'Send to'],
  ['Skip Inbox', 'Archive it'],
  ['Accounts and Import', 'Accounts'],
  ['Grant access to your account:', 'Let others use your mail:'],
  ['Household members', 'Who is in your family'],
  ['Adult', 'Grown-up'],
  ['Teen', 'Ages 13 to 17'],
  ['Registered', 'Added'],
  ['Your family group', 'Your Google family'],
  ['Family manager', 'Group admin'],
  ['Member', 'In this group'],
  ['Partner sharing', 'Share with a partner'],
  ['Shared with', 'Your partner:'],
];
const reworded = html => onText(html, t => WORDS.reduce((s, [a, b]) => s.split(a).join(b), t));

function rebuilt(html) {
  return html
    .replace(/<ul class="([^"]*)">/g, '<div class="$1" role="list">').replace(/<\/ul>/g, '</div>')
    .replace(/<li>/g, '<div role="listitem"><div class="row">').replace(/<\/li>/g, '</div></div>')
    .replace(/<a href="([^"#][^"]*)">([\s\S]*?)<\/a>/g, '<div class="row-link" role="button" tabindex="0" data-target="$1">$2</div>')
    .replace(/<table class="([^"]*)">\s*<tbody>/g, '<div class="$1" role="table">').replace(/<\/tbody>\s*<\/table>/g, '</div>')
    .replace(/<tr>/g, '<div role="row">').replace(/<\/tr>/g, '</div>')
    .replace(/<td class="([^"]*)">/g, '<div class="$1" role="cell">').replace(/<td>/g, '<div role="cell">').replace(/<\/td>/g, '</div>')
    .replace(/<section class="([^"]*)"[^>]*>/g, '<div class="$1">').replace(/<\/section>/g, '</div>');
}

// Per page: how a redesign might write the same facts.
const FORMATS = {
  'google/device-activity.html': [['Active now', 'Online'], ['2 hours ago', 'Today at 10:14 AM'], ['3 weeks ago', 'Last active November 1']],
  'google/connections.html': [['3 months ago', 'in August 2026'], ['5 weeks ago', 'in October 2026'], ['2 years ago', 'in 2024']],
  'google/rescuephone.html': [['(937) 555-0177', '+1 937-555-0177']],
  'google/twosv.html': [['(937) 555-0177', '•••-•••-0177']],
  'google/locationsharing.html': [['<span>sam.porter@example.net</span>', '']],
  'amazon/devicelist.html': [['Registered 2023', 'Since 2023'], ['Registered 2022', 'Since 2022']],
  'photos/settings.html': [['since January 2024', 'since 1/2024']],
};
const formats = (html, file) => (FORMATS[file] || []).reduce((s, [a, b]) => s.split(a).join(b), html);

const label = id => DRIFT.find(d => d.id === id)?.label || id;
const banner = (html, id) => html.replace('Spare Key reads it the way it reads the real page.', `This copy was changed on purpose to test Spare Key: ${label(id).toLowerCase()}.`);

/** One practice page, changed by one kind of drift. `file` is its path under /practice/, like "google/twosv.html". */
export function driftPage(html, file, id) {
  let out = banner(html, id);
  if (id === 'formats' || id === 'all') out = formats(out, file);
  if (id === 'reworded' || id === 'all') out = reworded(out);
  if (id === 'rebuilt' || id === 'all') out = rebuilt(out);
  if (id === 'renamed' || id === 'all') out = renamed(out);
  return out;
}

/** The path of a drifted copy, like /practice/drift/all/google/twosv.html. */
export const driftUrl = (practiceUrl, id) => practiceUrl.replace(/^\/practice\//, `/practice/drift/${id}/`);
