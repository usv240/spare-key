// The site's other pages (EXPERIENCE.md section 5.2). Plain document pages, plus the practice check (try.html).
import { page, info, esc } from '../layout.mjs';

const doc = (file, title, description, inner, extra = {}) => page({
  file, title: `${title} | Spare Key`, description,
  body: `<article class="doc"><div class="wrap">${inner}</div></article>`, ...extra,
});

export function tryPage() {
  const body = `
<section class="try" aria-labelledby="try-title">
  <div class="wrap try-head">
    <h1 id="try-title">The practice check</h1>
    <p class="lead">Spare Key’s check, in your browser, on made-up settings pages for a person called Jordan. Nothing of yours is opened, and no extension is needed.</p>
  </div>
  <div class="wrap try-grid">
    <figure class="shot try-scan">
      <iframe id="scan-view" title="The practice settings page being read" src="/practice/google/device-activity.html"></iframe>
      <figcaption>The scan tab: each practice page as Spare Key reads it.</figcaption>
    </figure>
    <figure class="panel-frame" id="panel-demo">
      <iframe src="/panel-demo.html?mode=live" title="The Spare Key side panel, running the practice check" loading="eager"></iframe>
      <figcaption>The side panel, here in the page. Its tab “What left this computer” shows every request word for word.</figcaption>
    </figure>
  </div>
  <div class="wrap try-notes">
    <p>Press <strong>Start the practice check</strong> in the panel. The pages appear on the left as Spare Key reads them. When it is done, mark a finding Mine or Not mine, then make the plan.</p>
    <p class="muted">Gemini sorts the practice entries on this device if your browser has Gemini Nano, and in the cloud if it does not. That is acceptable here only because the data is made up: the extension never lets the cloud read your pages. ${info('practice', 'About the practice check')}</p>
  </div>
</section>`;
  return page({ file: 'try.html', title: 'Try it | Spare Key', description: 'Run Spare Key’s practice check in your browser, on made-up settings pages.', body });
}

export function installPage() {
  return doc('install.html', 'Get the Chrome extension', 'How to install Spare Key in Chrome.', `
<h1>Get the Chrome extension</h1>
<p class="lead">Spare Key runs in Chrome on a computer. It is free, and it does not ask you to sign in.</p>
<div class="note caution"><p><strong>Before you install:</strong> if someone else uses this computer, they may see that the extension is installed. A computer they never use, like a trusted friend’s, is a better place to check. Library and work computers usually do not allow installing extensions. You can remove Spare Key when you are done.</p></div>
<h2>Install it</h2>
<p>Spare Key is not in the Chrome Web Store yet. Until it is, install it this way:</p>
<ol>
  <li>Download <a href="/downloads/spare-key-extension.zip" download><strong>spare-key-extension.zip</strong></a> and unzip it. It holds a folder called <code>spare-key</code>.</li>
  <li>In Chrome, open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong> (top right).</li>
  <li>Select <strong>Load unpacked</strong> and choose the <code>spare-key</code> folder.</li>
  <li>Click the puzzle piece in Chrome’s toolbar, then the key, to open Spare Key beside the page.</li>
</ol>
<h2>Gemini Nano</h2>
<p>For the best reading, Spare Key uses Gemini Nano, a small AI model inside Chrome on your computer. Chrome downloads it the first time a site or extension asks for it, when the computer has enough memory and disk. Without it, Spare Key reads pages with code only and says where that is less complete.</p>
<h2>Remove it when you are done</h2>
<p>Open <code>chrome://extensions</code>, find Spare Key, and select <strong>Remove</strong>. Spare Key keeps nothing after Chrome closes unless you saved a locked copy.</p>`);
}

export function howItWorksPage() {
  return doc('how-it-works.html', 'How it works', 'How Spare Key checks, explains and plans, and the safety rules every plan follows.', `
<h1>How it works</h1>
<p class="lead">Spare Key does what a tech-abuse clinic does by hand: find out who still has access, account by account. It reads; it never changes anything.</p>
<h2>1. Before you start</h2>
<p>The first screen says that someone watching this computer could see the check, gives the hotline, and shows how to leave in one press: the Quick exit button, Escape twice, or the keyboard shortcut. Quick exit clears everything from this check and shows an ordinary page.</p>
<h2>2. Choose what to check</h2>
<p>You tick the services to check. When you start, Chrome asks you to let Spare Key read exactly those sites, and nothing else.</p>
<h2>3. The check</h2>
<p>Spare Key opens each settings page in one tab beside its panel and reads the list on it: devices, apps, recovery options, forwarding, filters, people with access, location sharing, Amazon household and devices. It does not click, scroll, type or save. If you are not signed in, or a page asks for your password, it says so and moves on.</p>
<p>Code reads each page first. When Gemini Nano is on your computer, it sorts each entry: is it a person, a device or an app, is it yours, what can it see. When the code finds nothing on a page that loaded (often because the page changed), Gemini Nano reads the page itself, and the result says to check it in the setting.</p>
<h2>4. What we found</h2>
<p>Findings are grouped by what the other person could do: see your location, read your mail, get into your account, see your purchases, see your photos. Addresses and numbers are hidden until you choose to show them. You mark each one Mine, Not mine or Not sure. “Not checked” is always shown, so a short list never reads as the whole story.</p>
<h2>5. The plan</h2>
<p>The plan is built in this order:</p>
<ol>
  <li><strong>Screenshot first.</strong> A record of what is set up now, before anything changes.</li>
  <li><strong>Talk to an advocate</strong>, before any change that may be noticed.</li>
  <li><strong>Change now</strong>: only when you say now is a good time, and only with the warning about who may notice.</li>
  <li><strong>Wait for a better time</strong>: everything that may be noticed, when now may not be a good time, with what to do meanwhile.</li>
  <li><strong>Check it yourself</strong>: everything Spare Key did not check, with trusted guides.</li>
</ol>
<p>This order follows the two rules the field teaches: document before you change anything, and changing something can alert the other person. See the <a href="https://www.techsafety.org/resources-survivors">Safety Net project’s survivor guides</a> and the <a href="https://ceta.tech.cornell.edu/resources">Cornell Clinic to End Tech Abuse</a>.</p>
<h2>The safety rules every plan follows</h2>
<p>Whether the plan came from code or from Gemini in the cloud, Spare Key checks it with these rules before you see it, and shows when a rule changed something:</p>
<ol>
  <li>Every finding that is not yours appears in the plan.</li>
  <li>Screenshot first comes before any change.</li>
  <li>A change that may be noticed always carries the warning.</li>
  <li>If now may not be a good time, changes that may be noticed wait.</li>
  <li>The advocate step is always there.</li>
  <li>The plan never promises that you are out of danger or that there is nothing to worry about.</li>
  <li>The plan never contains contact details or links that are not from the steps library.</li>
  <li>Everything not checked gets a “check it yourself” step.</li>
</ol>`);
}

export function builtWithPage({ numbers }) {
  const rows = [
    ['Gemini Nano through Firebase AI Logic (<code>ONLY_ON_DEVICE</code>)', 'This computer', 'Reads and sorts the private settings pages, reads a page a site has changed, reads a screenshot of a phone location app (image input), and orders the plan when the person turns plan help from the cloud off. No cloud fallback, on purpose: the pages and pictures are the private data.'],
    ['Gemini through Firebase AI Logic (<code>ONLY_IN_CLOUD</code>, function calling)', 'Google’s cloud', 'Orders the plan from finding types only, when plan help is on. It asks the device yes or no questions with <code>ask_device</code> and the person with <code>ask_user</code>, and reads the public steps with <code>get_steps</code>.'],
    ['Two-voice check', 'Google’s cloud', 'Two arguments over the plan, each from the steps library’s facts about what the other person would see, and a third call that settles it and says, kind by kind, what each voice argued. Finding types only.'],
    ['URL context tool', 'Google’s cloud', 'Checks that a library entry’s steps still match the official help page. (Search grounding is not on the free tier.)'],
    ['Hybrid inference (<code>PREFER_ON_DEVICE</code>)', 'Either', 'The practice check on this site, which holds only made-up data: Gemini Nano when the browser has it, the cloud when it does not. It reads changed practice pages and Jordan’s made-up phone screenshot the same way; the screenshot is checked by its hash before it can be sent.'],
    ['Firebase App Check (reCAPTCHA Enterprise)', 'Site and extension', 'Only Spare Key can spend its model quota. The extension gets tokens from a small page on this site that answers only the extension.'],
    ['Firebase Remote Config', 'Every install', 'Page readers, the words the code rules read, models and switches. When a site changes a page, a fix reaches every install with no store update: each install fetches it at most once an hour. The layout drift test runs every fix through the same code the extension runs.'],
    ['Cloud Firestore', 'Google’s cloud', 'The public steps library, which the extension refreshes when it is newer. Opt-in anonymous reports when a page looked different: five fixed fields, create-only, sent only when the person presses the button.'],
    ['Firebase Hosting', 'Google’s cloud', 'This site, the practice pages and the Steps API.'],
    ['Chrome extension APIs', 'This computer', 'Side panel, the scan tab, permissions asked for per site, the extensions check, history cleanup.'],
    ['WebCrypto', 'This computer', 'The locked copy: PBKDF2 with 600,000 rounds and AES-GCM. Opening one beside a new check shows what is new since then.'],
    ['A wrapper around fetch', 'This computer', 'The ledger under “What left this computer”: every request by where it went and its size, and how many hold anything from the check.'],
    ['MCP server', 'The developer’s computer', 'Steps and plans for AI assistants, from finding types only.'],
  ];
  return doc('built-with.html', 'How it’s built', 'The full stack, where each piece runs and why.', `
<h1>How it’s built</h1>
<p class="lead">The split between this computer and the cloud is set by the problem: the settings pages are the private data, so they are read here, and the cloud only ever sees what kind of access was found.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="The full stack: table, scrolls sideways on small screens"><table>
<thead><tr><th>Piece</th><th>Runs</th><th>Why it is used</th></tr></thead>
<tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
</table></div>
<h2>Privacy-tiered routing</h2>
<p>Each step runs at the most private tier its data allows, and the tier is set by the data, not by convenience:</p>
<ol>
  <li><strong>Device only</strong> (<code>ONLY_ON_DEVICE</code>): anything that can name a person. The settings pages, a page a site has changed, a phone screenshot. Without Gemini Nano these are read by code or not at all, never by the cloud.</li>
  <li><strong>The person’s choice</strong>: finding types and the answers the person chooses to share. With plan help from the cloud on, Gemini in the cloud orders and explains the plan; with it off, Gemini Nano does, on this computer. Either way, code’s safety rules decide what is shown.</li>
  <li><strong>Cloud</strong> (<code>ONLY_IN_CLOUD</code>): public text. The steps library, the official help pages, and the two voices arguing over finding types.</li>
</ol>
<p>One check, <code>checkOutgoing()</code>, sits between the tiers. The made-up practice check on this site is the one place a lower tier’s data may go up, because none of it is real.</p>
<h2>What code decides, and what Gemini adds</h2>
<p>Code decides everything that keeps a person out of danger. The plan made by code, with no model, passes every safety measure on its own, and the safety rules check any plan a model writes. Gemini adds what code cannot do:</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="What Gemini adds: table, scrolls sideways on small screens"><table><thead><tr><th>What</th><th>Without Gemini</th><th>With Gemini</th></tr></thead><tbody>
<tr><td>Read settings pages a site has changed (all four kinds of change at once)</td><td>8 of 24 ways in shown</td><td>18 of 24, by Gemini Nano on the computer</td></tr>
<tr><td>Read a phone app’s sharing screen from a screenshot</td><td>Nothing: code cannot read a picture</td><td>3 of 3 made-up people, with “Me” left out</td></tr>
<tr><td>Order the plan for this situation and explain each step in plain words</td><td>One fixed order and stock sentences</td><td>Per-situation order and wording, asking the computer yes or no questions it needs</td></tr>
<tr><td>Put a step in simpler words, on request</td><td>Not possible</td><td>Gemini Nano on the computer, or the cloud for the public steps only</td></tr>
</tbody></table></div>
<p>Ordering is where models still fall short, so the rules stay in charge. Before the rules ran, the cloud’s plans needed 43 fixes on 30 situations (18 after the two voices) and Gemini Nano’s 103 on 35. The <a href="accuracy.html">accuracy page</a> has the measures.</p>
<h2>The cloud asks, the device answers</h2>
<p>Gemini in the cloud orders the plan without ever learning who anyone is. When it needs a fact, it can call back to the device, and the device answers with an enum. The shape of an exchange:</p>
<pre tabindex="0" aria-label="Code example"><code>cloud:  ask_device({ ref: "f3", question: "filter_also_deletes" })
device: { "answer": "no" }
cloud:  ask_user({ ref: "f1", question: "set_up_by_you" })
person: Not sure   →   { "answer": "not_sure" }</code></pre>
<p>How often each function was called in the measured runs is on the <a href="accuracy.html">accuracy page</a>.</p>
<p>Every request and every answer passes one check, <code>checkOutgoing()</code>, which accepts only finding codes and fixed answers, and refuses any request holding a name, address or device this check found. Every request is shown word for word under “What left this computer”, with the fixed instructions sent with it.</p>
<h2>Authentication only for developers</h2>
<p>Survivors never sign in, and the extension has no sign-in at all: an account would be one more thing to find. The Steps API needs no key.</p>
<h2>Reused code</h2>
<p>The Firebase AI Logic wrapper and the App Check bridge for a Chrome extension come from the author’s other #BuildHybridAI entry, Still Recalled, with the backend changed to the free Gemini Developer API.</p>`);
}

export function plantPage() {
  return doc('plant.html', 'Plant a test key', 'Three ways to plant a harmless way in to your own account, watch Spare Key find it, and undo it.', `
<h1>Plant a test key</h1>
<p class="lead">Try Spare Key on your own account without any risk: plant a harmless way in, run the check, see whether it is found, then undo it. Mark each one “Mine” so the plan treats it as yours.</p>
<div class="note"><p>These recipes have not yet been run on a real account by the builder: the readers were made on practice pages, and the real pages may look different. If Spare Key misses one, it should say the page “looked different” under Not checked. Either way, that is worth knowing.</p></div>
<h2>1. A second signed-in device (2 minutes)</h2>
<ol><li>Sign in to your Google account in another browser, such as Microsoft Edge, or in a Chrome guest window.</li><li>Run Spare Key. It should list the new browser under <strong>Can get into your account</strong>.</li><li><strong>Undo:</strong> open <a href="https://myaccount.google.com/device-activity">Your devices</a>, select it, and sign out.</li></ol>
<h2>2. Share your location for one hour (2 minutes)</h2>
<ol><li>In the Google Maps app on your phone, tap your picture, then <strong>Location sharing</strong>, then <strong>New share</strong>. Choose <strong>For 1 hour</strong> and a second Google account you own.</li><li>Run Spare Key. It should list the share under <strong>Can see your location</strong>.</li><li><strong>Undo:</strong> it ends by itself after an hour, or stop it in the same place.</li></ol>
<h2>3. A Gmail filter that forwards (2 minutes)</h2>
<ol><li>In Gmail settings, under <strong>Forwarding and POP/IMAP</strong>, add a second address you own as a forwarding address, and confirm it from that inbox.</li><li>Make a filter for the subject <code>test-forward</code> that forwards to that address.</li><li>Run Spare Key. It should list the filter under <strong>Can read your mail</strong>.</li><li><strong>Undo:</strong> delete the filter under <strong>Filters and Blocked Addresses</strong>, and remove the forwarding address.</li></ol>`);
}

export function apiPage() {
  return doc('api.html', 'Steps API and MCP server', 'The steps library as a free, open API and an MCP server.', `
<h1>Steps API and MCP server</h1>
<p class="lead">The steps library is free to use. It takes no input, so it cannot receive personal data, and it needs no key.</p>
<h2>Steps API</h2>
<pre tabindex="0" aria-label="Code example"><code>GET https://spare-key-app.web.app/api/v1/index.json            every finding code
GET https://spare-key-app.web.app/api/v1/steps/{code}.json     one entry
GET https://spare-key-app.web.app/api/v1/plan-rules.json       the plan order and safety rules</code></pre>
<p>The same rows as a page for people: <a href="what-they-see.html">What they see when you change it</a>.</p>
<p>Each entry has what the access means, whether removing it may be noticed, what the other person sees (with the official help page’s words where one says), and why, what to screenshot first, the steps, what to do if now is not a good time, and official sources with the date they were checked. Open CORS; cached for an hour.</p>
<h2>MCP server</h2>
<p>An AI assistant that uses these tools gives the current steps with the warnings attached. Every input is a finding code or a fixed answer, so no story or name can be sent to it.</p>
<ul><li><code>list_findings</code>: every finding code</li><li><code>get_steps(code)</code>: one code’s steps, with what to screenshot and the warning</li><li><code>make_plan(findings, situation)</code>: a plan in a safety-first order, with the safety rules applied</li></ul>
<p>From a copy of the <a href="https://github.com/usv240/spare-key">repository</a>, run <code>npm install</code> in <code>mcp/</code>, then add it to your assistant:</p>
<pre tabindex="0" aria-label="Code example"><code>Claude Code:   claude mcp add spare-key -- node /path/to/spare-key/mcp/server.mjs
Codex:         codex mcp add spare-key -- node /path/to/spare-key/mcp/server.mjs
Others (JSON): { "mcpServers": { "spare-key": { "command": "node", "args": ["/path/to/spare-key/mcp/server.mjs"] } } }</code></pre>
<h2>The plan as code</h2>
<p><code>shared/plan/engine.js</code> and <code>shared/plan/invariants.js</code> build the same plan from finding codes, with no model, so hotline software can make plans locally. Apache-2.0.</p>`);
}

const SERVICE_OF = { google: 'Google account', gmail: 'Gmail', maps: 'Google Maps', chrome: 'Chrome', amazon: 'Amazon', photos: 'Google Photos', screenshot: 'Phone apps' };
const NOTICE_WORDS = { notifies: 'They are told', noticeable: 'They may notice', unlikely: 'Unlikely to notice', unknown: 'Not known' };

/** "What they see when you change it": every finding kind, what the other person sees, and the official words for it. */
export function whatTheySeePage({ library }) {
  const entries = library.entries;
  const counts = entries.reduce((m, e) => ({ ...m, [e.who_can_notice]: (m[e.who_can_notice] || 0) + 1 }), {});
  const sourced = entries.filter(e => e.notice_source).length;
  const groups = entries.reduce((m, e) => { const s = SERVICE_OF[e.code.split('.')[0]] || 'Other'; (m[s] ||= []).push(e); return m; }, {});
  const row = e => `<tr id="${esc(e.code)}">
  <td data-label="What was found"><strong>${esc(e.title)}</strong><br><code class="muted">${esc(e.code)}</code></td>
  <td data-label="Are they told?"><span class="notice-tag notice-${esc(e.who_can_notice)}">${esc(NOTICE_WORDS[e.who_can_notice])}</span></td>
  <td data-label="What they see if you remove it">${esc(e.what_they_see)}</td>
  <td data-label="The official words">${e.notice_source ? `<q>${esc(e.notice_source.quote)}</q><br><a href="${esc(e.notice_source.url)}">${esc(e.notice_source.title)}</a>` : '<span class="muted">No official page found</span>'}</td>
</tr>`;
  return doc('what-they-see.html', 'What they see when you change it', 'For each kind of access Spare Key finds: what the other person sees if you remove it, with the official words.', `
<h1>What they see when you change it</h1>
<p class="lead">Removing someone’s access can tell them you found it. Before you change anything, it helps to know what they will see. This is what Spare Key knows, kind by kind, and where it comes from.</p>
<ul class="numbers compact-numbers">
  <li><span class="n">${entries.length}</span><p>kinds of access Spare Key looks for</p></li>
  <li><span class="n">${sourced}</span><p>with an official help page quoted for what the change does</p></li>
  <li><span class="n">${counts.unknown || 0}</span><p>where no official page says, so Spare Key treats them as something they may notice</p></li>
</ul>
<p>“They may notice” means the change stops something they use, like your location on their map, so they can find out without being told. Spare Key never says a change is unnoticed unless an official page or a test account shows it, and today none of the ${entries.length} has that. Talk to an advocate before changing anything they may notice.</p>
${Object.entries(groups).map(([svc, list]) => `<h2>${esc(svc)}</h2>
<div class="see-wrap"><table class="see-table" aria-label="${esc(svc)}">
<thead><tr><th>What was found</th><th>Are they told?</th><th>What they see if you remove it</th><th>The official words</th></tr></thead>
<tbody>${list.map(row).join('')}</tbody></table></div>`).join('\n')}
<h2>How this is kept</h2>
<p>Each row comes from Spare Key’s steps library, version ${esc(String(library.version))}, updated ${esc(longDay(library.updated_at))}. The quotes are copied from the help page on the date shown in the <a href="api.html">Steps API</a>, where every row is also available as data (<code>who_can_notice</code>, <code>what_they_see</code> and <code>notice_source</code>). None of these steps has yet been followed on a test account, so a row says what the help page says, not what a test showed.</p>`);
}
const longDay = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// Layout drift (tools/drift-test.mjs): the practice pages changed five ways, read by code, by code and Gemini Nano, and
// after the Remote Config fix, next to the first, blind run.
function driftSection(drift, first) {
  if (!drift?.rows?.length) return '';
  const kinds = drift.rows.filter(r => r.mode === 'code' && r.kind !== 'none');
  const cell = (kind, mode) => drift.rows.find(r => r.kind === kind && r.mode === mode);
  const firstOf = kind => first?.rows?.find(r => r.kind === kind);
  const hasNano = drift.rows.some(r => r.mode === 'nano');
  const sum = (rows, k) => rows.reduce((n, r) => n + (r?.[k] || 0), 0);
  const silentFirst = sum(kinds.map(k => firstOf(k.kind)), 'silentMisses');
  const silentNow = sum(drift.rows.filter(r => r.kind !== 'none'), 'silentMisses');
  const extra = mode => drift.rows.filter(r => r.mode === mode && r.kind !== 'none').reduce((n, r) => n + (r.falseAlarms || 0), 0);
  const found = r => (!r ? 'not run' : r.shown !== undefined && r.shown !== r.found ? `${r.shown} of ${r.of} (${r.found} the right kind)` : `${r.found} of ${r.of}`);
  return `<h2>When a site changes its pages</h2>
<p>Sites change their settings pages without warning. A script changed the 13 practice pages five ways, the same way every time, and every check ran on each copy. The number is planted ways in shown, of 24; in brackets, how many were shown as exactly the right kind when that differs (a teen shown as an adult is shown, not the right kind).</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Layout drift: table, scrolls sideways on small screens"><table><thead><tr><th>What changed</th><th class="num">Code only, first run</th><th class="num">Code only, now</th>${hasNano ? '<th class="num">Code and Gemini Nano</th>' : ''}<th class="num">After the Remote Config fix</th></tr></thead>
<tbody>${kinds.map(k => `<tr><td>${esc(k.label)}</td><td class="num">${found(firstOf(k.kind))}</td><td class="num">${found(k)}</td>${hasNano ? `<td class="num">${found(cell(k.kind, 'nano'))}</td>` : ''}<td class="num">${found(cell(k.kind, 'fixed'))}</td></tr>`).join('')}</tbody></table></div>
<p><strong>The miss that matters most is a silent one:</strong> a check that says it is done while a way in is still there. On the first run there were <strong>${silentFirst}</strong> silent misses. Now there are <strong>${silentNow}</strong>: a page that lists nothing, without saying it is empty, is shown under “Not checked” as “looked different”, and a page that never showed the words Spare Key waits for is marked “checked in part”. Both tell the person to look for themselves.</p>
<p>Entries listed that are not planted ways in, across the five copies: ${extra('code')} with code alone${hasNano ? `, ${extra('nano')} with Gemini Nano` : ''}. Each is shown for the person to mark “Mine” or “Not mine”.</p>
<p class="muted">The first run was blind: nothing was changed after seeing these pages. The fixes since then are general (an empty-looking page is not called empty; lists built from plain boxes count as lists; masked phone numbers count), and the Remote Config fixes were written after seeing what broke, so the last column shows the fix path works, not how well a first guess reads a new page. ${esc(drift.date)}${drift.nanoDate ? `; Gemini Nano run ${esc(drift.nanoDate)}` : ''}. Test: <code>tools/drift-test.mjs</code>. You can try it on <a href="try.html">the practice check</a>: open “Break the pages first”.</p>`;
}

export function accuracyPage({ numbers, drift = null, driftFirst = null }) {
  const n = numbers;
  const p = n.planSafety;
  return doc('accuracy.html', 'Accuracy', 'How Spare Key is measured, the numbers, and what they do not show.', `
<h1>Accuracy</h1>
<p class="lead">Every number here comes from a test you can run from the repository, and the saved runs are in its <code>docs/evidence</code> folder. Misses and limits are reported as plainly as passes.</p>
<h2>Practice pages: planted ways in</h2>
${n.practice ? `<p><strong>${n.practice.found} of ${n.practice.of}</strong> planted ways in found, with <strong>${n.practice.falseAlarms}</strong> false alarms, on the 13 made-up practice pages, both with code only and with Gemini Nano.${n.practice.nanoSeconds ? ` Through the real extension, code alone took ${n.practice.codeSeconds} seconds for the 12 checks; with Gemini Nano on the builder’s PC, ${n.practice.nanoSeconds} seconds, after ${n.practice.nanoLoadSeconds} seconds loading the model.` : ''} ${esc(n.practice.date)}. Tests: <code>tools/reader-test.mjs</code>, <code>tools/e2e-practice.mjs</code>.</p>` : ''}
<p class="muted">The practice pages were written by the builder, so the readers were tuned on the same pages they are tested on. They show the whole system works end to end; they do not show how well it reads real pages.</p>
<h2>A real account</h2>
<p>Spare Key’s own readers and rules ran inside each real settings page of the builder’s own Google, Gmail and Amazon account, read-only and with code only. Only finding codes and counts came out of each page; no names or addresses. Google asked “Verify it’s you” on four pages, and the builder confirmed it in the same tab, as anyone using Spare Key would. November 22 and 23, 2026.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="A real account: table, scrolls sideways on small screens"><table><thead><tr><th>Check</th><th>What the site shows</th><th>First reading</th><th>After the fix</th></tr></thead>
<tbody>
<tr><td>Apps with access</td><td>3</td><td>Read the “Sign in with Google” list too (about 50)</td><td>3</td></tr>
<tr><td>Devices signed in</td><td>18</td><td>18 (17 listed, 1 this computer)</td><td>No change needed</td></tr>
<tr><td>Recovery phone</td><td>1</td><td>Missed: not written the US way</td><td>1</td></tr>
<tr><td>Recovery email</td><td>1</td><td>1</td><td>No change needed</td></tr>
<tr><td>2-Step Verification</td><td>3 methods</td><td>7: headings and “Add” rows counted</td><td>3</td></tr>
<tr><td>Location sharing, Gmail forwarding, filters, delegates, family group</td><td>Nothing set up</td><td>Nothing, confirmed by each page’s own words</td><td>No change needed</td></tr>
<tr><td>Google Photos partner sharing</td><td>Behind a click</td><td>Not checked</td><td>Not checked: Spare Key never clicks</td></tr>
<tr><td>Amazon household</td><td>The account holder, 8 profiles, 1 child</td><td>Listed the account holder as another adult</td><td>8 profiles, for you to mark</td></tr>
<tr><td>Amazon devices</td><td>7 device groups</td><td>6 false finds: the old page now shows books</td><td>7 groups, marked “in part”</td></tr>
</tbody></table></div>
<p class="muted">One account, with nothing planted on it: this shows the readers match real pages, not how many hidden ways in they would miss. That test needs planted test accounts and is next.</p>
${driftSection(drift, driftFirst)}
<h2>Privacy: nothing that names a person leaves</h2>
${n.privacy ? `<p><strong>${n.privacy.withPrivate} of ${n.privacy.requests}</strong> requests from the extension held a name, email address, phone number, device or place, during a full practice check with every cloud step on. Every request from the service worker, the hidden page and the side panel was captured and searched in plain text, URL-encoded, base64 and JSON-escaped forms. All ${n.privacy.modelRequests} requests to the model matched “What left this computer” word for word. ${esc(n.privacy.date)}. Test: <code>tools/privacy-test.mjs</code>.</p>` : ''}
<h2>Plan safety: seven measures from the field’s advice</h2>
${p ? `<p>${p.of} situations, each a set of findings and answers, written before any results and not changed after. Measured by code.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Plan safety: table, scrolls sideways on small screens"><table><thead><tr><th>Measure</th>${p.columns.map(c => `<th class="num">${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${p.rows.map(r => `<tr><td>${esc(r.label)}</td>${r.values.map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<p class="muted">${esc(p.note)}</p>` : '<p>Results are being measured.</p>'}
${n.nanoPlan ? `<h3>The plan made by Gemini Nano, on this computer</h3>
<p>The same ${n.nanoPlan.of} situations, ordered by Gemini Nano with nothing sent anywhere. ${n.nanoPlan.answered} of ${n.nanoPlan.of} answered${n.nanoPlan.medianSeconds ? `, in a median of ${n.nanoPlan.medianSeconds} seconds each on the builder’s PC` : ''}.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="The plan made by Gemini Nano: table, scrolls sideways on small screens"><table><thead><tr><th>Measure</th><th class="num">Gemini Nano’s plan</th><th class="num">What you see (after the safety rules)</th></tr></thead>
<tbody>${n.nanoPlan.rows.map(r => `<tr><td>${esc(r.label)}</td><td class="num">${r.before} of ${n.nanoPlan.answered}</td><td class="num">${r.after} of ${n.nanoPlan.answered}</td></tr>`).join('')}</tbody></table></div>
<p class="muted">The safety rules made ${n.nanoPlan.fixes} fixes to Gemini Nano’s plans (not counting the warning rule, which runs on every plan). Test: <code>tools/plan-eval-nano.mjs</code>, scored by <code>tools/plan-eval-score.mjs</code>. ${esc(n.nanoPlan.date || '')}.</p>` : ''}
<h2>What these numbers do not show</h2>
<ul>
  <li>No survivor or advocate has tested Spare Key yet.</li>
  <li>The readers have been measured on one real account with nothing planted on it. How many real ways in they would miss is not measured yet; that needs planted test accounts.</li>
  <li>The plain chatbot was measured with fixed keyword lists, which are rougher than reading each answer.</li>
  <li>“0 false alarms” rests on the 4 practice entries that belong to the person. On a real account, your own phone and recovery number are listed too, by design, for you to mark “Mine”.</li>
  <li>On the free tier the cloud plan failed in 5 of ${p ? p.planned : 40} situations (4 timeouts at a 30-second limit, since raised to 60, and 1 quota), and the two-voice check in 5 more. When the cloud plan does not answer, you get the plan made by code on your computer; when only the voices fail, you keep the cloud plan.</li>
</ul>`);
}

export function privacyPage() {
  return doc('privacy.html', 'Privacy', 'Exactly what Spare Key reads, sends and keeps.', `
<h1>Privacy</h1>
<p class="lead">The settings pages Spare Key reads name people. That is the danger, so they are read on your computer and never sent anywhere.</p>
<h2>What it reads</h2>
<p>Only the settings pages of the services you tick, in one tab, after Chrome asks your permission for exactly those sites. With the extras you turn on, the list of extensions in this Chrome and the account Chrome syncs to.</p>
<h2>What it sends</h2>
<ul>
  <li><strong>To Gemini in the cloud, only if plan help is on:</strong> finding types, like <code>gmail.forwarding.external</code>, how recent each is, your answer (mine, not mine, not sure), and the situation answers you choose to share. Never names, email addresses, phone numbers, devices or page text. Every request is shown word for word under “What left this computer”.</li>
  <li><strong>To check a step is still current, only when you ask:</strong> the finding type and the official help page’s address and text.</li>
  <li><strong>To Firebase, always:</strong> an App Check token, a Remote Config fetch and a read of the public steps library. These say nothing about you or your accounts.</li>
</ul>
<p>Spare Key uses the free tier of the Gemini API, where Google may use what it receives to improve its products. Because only finding types are sent, this is acceptable; it is also why nothing else is sent.</p>
<h2>What it keeps</h2>
<p>Nothing, unless you ask. Findings, your answers, the plan and the sent log live in Chrome’s session storage and are gone when Chrome closes, or when you press Clear everything or Quick exit. Settings like the theme are kept on this computer. A locked copy is saved only when you choose to, as a file only your password opens.</p>
<h2>What it cannot hide</h2>
<p>Chrome’s history shows the pages Spare Key opened, unless you turn on the cleanup. Google’s own My Activity may record the visits. Someone with access to this computer may see that the extension is installed. Remove it when you are done.</p>
<h2>How to remove everything</h2>
<p>Press Clear everything, or Quick exit. Then remove the extension at <code>chrome://extensions</code>.</p>`);
}

export function safetyPage() {
  return doc('safety.html', 'Getting help', 'Hotlines, guides, and how to use a device the other person cannot see.', `
<h1>Getting help</h1>
<p class="lead">You do not have to do this alone. An advocate can help you decide what to change, and when.</p>
<h2>Talk to someone now</h2>
<p><strong>National Domestic Violence Hotline</strong>, free and open all day, every day: call <a href="tel:+18007997233">1-800-799-7233</a>, text START to 88788, or chat at <a href="https://www.thehotline.org">thehotline.org</a>. You do not have to give your name.</p>
<p>If you are in danger right now, call 911.</p>
<h2>Guides for technology safety</h2>
<ul>
  <li><a href="https://www.techsafety.org/resources-survivors">Safety Net (NNEDV)</a>: guides for survivors, app by app</li>
  <li><a href="https://ceta.tech.cornell.edu/resources">Cornell Clinic to End Tech Abuse</a>: resources and guides</li>
  <li><a href="https://support.apple.com/guide/personal-safety/welcome/web">Apple Personal Safety User Guide</a>: for iPhone, including Safety Check</li>
  <li><a href="https://www.thehotline.org/plan-for-safety/">Plan for safety</a>, from the hotline</li>
</ul>
<h2>Use a device they cannot see</h2>
<p>If the other person may be watching this computer or your phone, a computer they never use, like a trusted friend’s, is a better place to check. A library computer is fine for reading this site and getting help, but usually does not allow installing extensions. Either is a better place to plan.</p>
<h2>Remove Spare Key when you are done</h2>
<p>Open <code>chrome://extensions</code>, find Spare Key, and select Remove.</p>`);
}

/** The page for an address that does not exist: the same header, with Quick exit, and the hotline. */
export function notFoundPage() {
  return doc('404.html', 'Page not found', 'This page does not exist.', `
<h1>This page does not exist</h1>
<p class="lead">The address may be mistyped, or the page has moved. Quick exit, at the top, leaves this site at once.</p>
<p><strong>Talk to someone now:</strong> call <a href="tel:+18007997233">1-800-799-7233</a>, text START to 88788, or chat at <a href="https://www.thehotline.org">thehotline.org</a>. It is free and open all day, every day.</p>
<p><a href="/index.html">Go to the home page</a> or <a href="/try.html">try the practice check</a>.</p>`);
}
