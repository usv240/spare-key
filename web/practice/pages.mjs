// The practice check's made-up settings pages, for a person called Jordan Lee whose ex-partner, Sam Porter, still has
// several ways in. Everything here is invented: addresses use the reserved example.com, example.net and example.org
// domains, and phone numbers use the 555-01xx range set aside for fiction, so none of it can reach a real person.
//
// The pages keep the hooks the readers use (links, labels, the account control) but none of the real sites' look or
// branding, and each says plainly that it is a practice page. They are regenerated from real page structure once the
// test accounts are recorded (tools/record-pages.mjs).
//
// EXPECTED lists the findings a practice scan must produce. The end-to-end test checks a scan against it.

const OWNER = { name: 'Jordan Lee', email: 'jordan.lee@example.com' };
const SAM = 'sam.porter@example.net';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page({ service, title, lead = '', body, gmail = false }) {
  const header = gmail
    ? `<header class="top"><span class="svc">Practice: ${esc(service)}</span><a class="acct" href="#account" aria-label="Google Account: ${esc(OWNER.name)} (${esc(OWNER.email)})">JL</a></header>`
    : `<header class="top"><span class="svc">Practice: ${esc(service)}</span><a class="acct" href="#account" aria-label="${service.startsWith('Amazon') ? 'Account' : 'Google Account'}: ${esc(OWNER.name)} (${esc(OWNER.email)})">JL</a></header>`;
  const main = gmail
    ? `<div class="gmail" role="main"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${body}</div>`
    : `<main><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${body}</main>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Practice: ${esc(title)}</title>
<link rel="icon" type="image/png" href="/icon-32.png">
<link rel="stylesheet" href="/practice/practice.css">
</head>
<body>
<p class="banner" role="note">Practice page. Made-up data for a person called Jordan. Spare Key reads it the way it reads the real page.</p>
${header}
${main}
</body>
</html>
`;
}

const list = items => `<ul class="list">${items.join('')}</ul>`;

export const PAGES = {
  'google/device-activity.html': page({
    service: 'Google Account', title: 'Your devices', lead: 'You are signed in to your Google Account on these devices.',
    body: list([
      ['p1', 'Windows computer', 'Chrome', 'Columbus, OH', 'This device'],
      ['p2', 'iPhone 15', 'Columbus, OH', 'Active now'],
      ['p3', 'Pixel 8', 'Dayton, OH', '2 hours ago'],
      ['p4', 'Mac', 'Safari', 'Dayton, OH', '3 weeks ago'],
    ].map(([id, ...lines]) => `<li><a href="device-activity/id/${id}"><strong>${esc(lines[0])}</strong><span>${lines.slice(1).map(esc).join(' · ')}</span></a></li>`)),
  }),
  'google/connections.html': page({
    service: 'Google Account', title: 'Third-party apps and services', lead: 'Apps you gave access to your Google Account.',
    body: list([
      ['inboxpilot', 'InboxPilot', 'Has access to Gmail', 'Access given 3 months ago'],
      ['trailmate', 'TrailMate', 'Has access to your location', 'Access given 5 weeks ago'],
      ['recipebox', 'Recipe Box', 'Sign in with Google', 'Access given 2 years ago'],
    ].map(([id, name, what, when]) => `<li><a href="connections/link?id=${id}"><strong>${esc(name)}</strong><span>${esc(what)} · ${esc(when)}</span></a></li>`)),
  }),
  'google/rescuephone.html': page({
    service: 'Google Account', title: 'Recovery phone', lead: 'Your recovery phone can be used to get back into your account.',
    body: `<div class="card"><p class="value">(937) 555-0177</p><p class="muted">Added 2 years ago</p></div>`,
  }),
  'google/recovery-email.html': page({
    service: 'Google Account', title: 'Recovery email', lead: 'Your recovery email can be used to get back into your account.',
    body: `<div class="card"><p class="value">${SAM}</p><p class="muted">Verified</p></div>`,
  }),
  'google/twosv.html': page({
    service: 'Google Account', title: '2-Step Verification', lead: 'Second steps that can approve a sign-in to your account.',
    body: list([
      '<li><strong>Google prompts</strong><span>2 devices: Pixel 8, iPhone 15</span></li>',
      '<li><strong>Phone number</strong><span>(937) 555-0177 · Text or voice</span></li>',
      '<li><strong>Authenticator app</strong><span>Added 2 years ago</span></li>',
    ]),
  }),
  'google/locationsharing.html': page({
    service: 'Google Account', title: 'Location sharing', lead: 'People and links that can see your location.',
    body: list([
      `<li><strong>Sam Porter</strong><span>${SAM}</span><span>Sharing until you turn this off</span></li>`,
      '<li><strong>Link</strong><span>Anyone with this link can see your location until 9:00 PM</span></li>',
    ]),
  }),
  'gmail/fwdandpop.html': page({
    service: 'Gmail settings', gmail: true, title: 'Forwarding and POP/IMAP',
    body: `<table class="settings"><tbody>
<tr><td class="label">Forwarding:</td><td>
  <div><label><input type="radio" name="fwd" value="off"> Disable forwarding</label></div>
  <div><label><input type="radio" name="fwd" value="on" checked> Forward a copy of incoming mail to</label>
    <select aria-label="Forwarding address"><option selected>${SAM}</option></select> and keep Gmail's copy in the Inbox</div>
</td></tr>
<tr><td class="label">POP download:</td><td>Status: POP is disabled</td></tr>
<tr><td class="label">IMAP access:</td><td>Status: IMAP is enabled</td></tr>
</tbody></table>`,
  }),
  'gmail/filters.html': page({
    service: 'Gmail settings', gmail: true, title: 'Filters and Blocked Addresses',
    body: `<table class="settings"><tbody>
<tr><td>Matches: from:(alerts@examplebank.com)<br>Do this: Forward to ${SAM}</td></tr>
<tr><td>Matches: subject:(appointment)<br>Do this: Skip Inbox, Mark as read</td></tr>
<tr><td>Matches: from:(receipts@example.org)<br>Do this: Apply label "Receipts"</td></tr>
</tbody></table>`,
  }),
  'gmail/accounts.html': page({
    service: 'Gmail settings', gmail: true, title: 'Accounts and Import',
    body: `<table class="settings"><tbody>
<tr><td class="label">Send mail as:</td><td>${esc(OWNER.name)} &lt;${OWNER.email}&gt;</td></tr>
<tr><td class="label">Grant access to your account:</td><td><div>${SAM}</div><div class="muted">Mark conversation as read when opened by others</div></td></tr>
</tbody></table>`,
  }),
  'amazon/members.html': page({
    service: 'Amazon Family', title: 'Household members',
    body: list([
      '<li><strong>Jordan Lee (you)</strong><span>Adult</span></li>',
      '<li><strong>Sam Porter</strong><span>Adult</span></li>',
      '<li><strong>Riley</strong><span>Teen</span></li>',
    ]),
  }),
  'amazon/devicelist.html': page({
    service: 'Amazon', title: 'Your devices',
    body: list([
      "<li><strong>Sam's Echo Dot</strong><span>Registered 2023</span></li>",
      '<li><strong>Kindle Paperwhite</strong><span>Registered 2022</span></li>',
      '<li><strong>Fire TV Stick</strong><span>Living room</span></li>',
    ]),
  }),
  'google/family.html': page({
    service: 'Google Account', title: 'Your family group',
    body: list([
      '<li><strong>Sam Porter</strong><span>Family manager</span></li>',
      '<li><strong>Jordan Lee (you)</strong><span>Member</span></li>',
      '<li><strong>Riley</strong><span>Member</span></li>',
    ]),
  }),
  'photos/settings.html': page({
    service: 'Google Photos', title: 'Settings',
    body: `<section class="card" data-section="partner"><h2>Partner sharing</h2><p>Shared with ${SAM}</p><p class="muted">Photos of all people, since January 2024</p></section>
<section class="card"><h2>Backup</h2><p class="muted">Backup is on</p></section>`,
  }),
};

// What a practice scan must find: check id and code, in no particular order.
export const EXPECTED = [
  ['google.devices', 'google.devices.other'], ['google.devices', 'google.devices.other'], ['google.devices', 'google.devices.other'],
  ['google.apps', 'google.apps.read_mail'], ['google.apps', 'google.apps.location'],
  ['google.recovery', 'google.recovery.phone_unconfirmed'], ['google.recovery', 'google.recovery.email_other'],
  ['google.2sv', 'google.2sv.other_device'], ['google.2sv', 'google.2sv.other_device'], ['google.2sv', 'google.2sv.other_device'],
  ['maps.sharing', 'maps.sharing.person'], ['maps.sharing', 'maps.sharing.link'],
  ['gmail.forwarding', 'gmail.forwarding.external'],
  ['gmail.filters', 'gmail.filter.forwards'], ['gmail.filters', 'gmail.filter.hides'],
  ['gmail.delegates', 'gmail.delegate'],
  ['amazon.household', 'amazon.household.adult'], ['amazon.household', 'amazon.household.teen'],
  ['amazon.devices', 'amazon.device.other'], ['amazon.devices', 'amazon.device.other'], ['amazon.devices', 'amazon.device.other'],
  ['google.family', 'google.family.manager_other'], ['google.family', 'google.family.member'],
  ['photos.sharing', 'photos.partner_sharing'],
];

export const PRACTICE_OWNER = OWNER;

export const PRACTICE_CSS = `:root{color-scheme:light dark;--bg:#fbfbf9;--surface:#fff;--ink:#1f2328;--ink-2:#55595f;--line:#dcdcd6;--note:#fbf1e1;--note-ink:#6f4300}
@media (prefers-color-scheme:dark){:root{--bg:#16181b;--surface:#1f2226;--ink:#e9e6e0;--ink-2:#b0ada7;--line:#34383e;--note:#2b2318;--note-ink:#e5ae57}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
.banner{margin:0;padding:10px 16px;background:var(--note);color:var(--note-ink);font-weight:600}
.top{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
.svc{font-weight:600}.acct{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--line);color:var(--ink);text-decoration:none;font-weight:700}
main,.gmail{max-width:760px;margin:0 auto;padding:16px}h1{font-size:24px;margin:16px 0 8px}h2{font-size:18px;margin:0 0 6px}.lead,.muted{color:var(--ink-2)}
.list{list-style:none;margin:16px 0;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.list li{padding:12px 14px;border-top:1px solid var(--line)}.list li:first-child{border-top:0}
.list li>*{display:block}.list a{color:inherit;text-decoration:none}.list a>*{display:block}.list span{color:var(--ink-2)}
.card{margin:16px 0;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.value{font-size:18px;font-weight:600;margin:0}
.settings{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line)}.settings td{padding:12px 14px;border-top:1px solid var(--line);vertical-align:top}.settings .label{width:34%;font-weight:600}
`;
