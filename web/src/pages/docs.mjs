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
<div class="note caution"><p><strong>Before you install:</strong> if someone else uses this computer, they may see that the extension is installed. A library computer or a friend’s device is a better place to check. You can remove Spare Key when you are done.</p></div>
<h2>Install it</h2>
<p>Spare Key is not in the Chrome Web Store yet. Until it is, install it this way:</p>
<ol>
  <li>Download <strong>spare-key-extension.zip</strong> from the <a href="https://github.com/usv240/spare-key/releases/latest">latest release</a> and unzip it.</li>
  <li>In Chrome, open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong> (top right).</li>
  <li>Select <strong>Load unpacked</strong> and choose the unzipped folder.</li>
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
    ['Gemini Nano through Firebase AI Logic (<code>ONLY_ON_DEVICE</code>)', 'This computer', 'Reads and sorts the private settings pages. No cloud fallback, on purpose: the pages are the private data.'],
    ['Gemini through Firebase AI Logic (<code>ONLY_IN_CLOUD</code>, function calling)', 'Google’s cloud', 'Orders the plan from finding types only. It asks the device yes or no questions with <code>ask_device</code> and the person with <code>ask_user</code>, and reads the public steps with <code>get_steps</code>.'],
    ['Two-voice check', 'Google’s cloud', 'Two arguments over the plan, and a third call that settles it. Finding types only.'],
    ['URL context tool', 'Google’s cloud', 'Checks that a library entry’s steps still match the official help page. (Search grounding is not on the free tier.)'],
    ['Hybrid inference (<code>PREFER_ON_DEVICE</code>)', 'Either', 'The practice check on this site, which holds only made-up data: Gemini Nano when the browser has it, the cloud when it does not.'],
    ['Firebase App Check (reCAPTCHA Enterprise)', 'Site and extension', 'Only Spare Key can spend its model quota. The extension gets tokens from a small page on this site that answers only the extension.'],
    ['Firebase Remote Config', 'Every install', 'Page readers, models and switches. When a site changes a page, its reader is fixed for every install within about an hour, with no store update.'],
    ['Cloud Firestore', 'Google’s cloud', 'The public steps library, which the extension refreshes when it is newer. Opt-in anonymous layout reports, create-only.'],
    ['Firebase Hosting', 'Google’s cloud', 'This site, the practice pages and the Steps API.'],
    ['Chrome extension APIs', 'This computer', 'Side panel, the scan tab, permissions asked for per site, the extensions check, history cleanup.'],
    ['WebCrypto', 'This computer', 'The locked copy: PBKDF2 with 600,000 rounds and AES-GCM.'],
    ['MCP server', 'The developer’s computer', 'Steps and plans for AI assistants, from finding types only.'],
  ];
  return doc('built-with.html', 'How it’s built', 'The full stack, where each piece runs and why.', `
<h1>How it’s built</h1>
<p class="lead">The split between this computer and the cloud is set by the problem: the settings pages are the private data, so they are read here, and the cloud only ever sees what kind of access was found.</p>
<div class="table-wrap"><table>
<thead><tr><th>Piece</th><th>Runs</th><th>Why it is used</th></tr></thead>
<tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
</table></div>
<h2>The cloud asks, the device answers</h2>
<p>Gemini in the cloud orders the plan without ever learning who anyone is. When it needs a fact, it calls back to the device, and the device answers with an enum:</p>
<pre><code>cloud:  ask_device({ ref: "f3", question: "filter_also_deletes" })
device: { "answer": "no" }
cloud:  ask_user({ ref: "f1", question: "set_up_by_you" })
person: Not sure   →   { "answer": "not_sure" }</code></pre>
<p>Every request and every answer passes one check, <code>checkOutgoing()</code>, which accepts only finding codes and fixed answers, and refuses any request holding a name, address or device this check found. Every request is shown word for word under “What left this computer”.</p>
<h2>Authentication only for developers</h2>
<p>Survivors never sign in, and the extension has no sign-in at all: an account would be one more thing to find. The Steps API needs no key.</p>
<h2>Reused code</h2>
<p>The Firebase AI Logic wrapper and the App Check bridge for a Chrome extension come from the author’s other #BuildHybridAI entry, Still Recalled, with the backend changed to the free Gemini Developer API.</p>`);
}

export function plantPage() {
  return doc('plant.html', 'Plant a test key', 'Three ways to plant a harmless way in to your own account, watch Spare Key find it, and undo it.', `
<h1>Plant a test key</h1>
<p class="lead">Try Spare Key on your own account without any risk: plant a harmless way in, run the check, watch it get found, then undo it. Mark each one “Mine” so the plan treats it as yours.</p>
<h2>1. A second signed-in device (2 minutes)</h2>
<ol><li>Sign in to your Google account in another browser, such as Microsoft Edge, or in a Chrome guest window.</li><li>Run Spare Key. It lists the new browser under <strong>Signed in to your account</strong>.</li><li><strong>Undo:</strong> open <a href="https://myaccount.google.com/device-activity">Your devices</a>, select it, and sign out.</li></ol>
<h2>2. Share your location for one hour (2 minutes)</h2>
<ol><li>In the Google Maps app on your phone, tap your picture, then <strong>Location sharing</strong>, then <strong>New share</strong>. Choose <strong>For 1 hour</strong> and a second Google account you own.</li><li>Run Spare Key. It lists the share under <strong>Can see your location</strong>.</li><li><strong>Undo:</strong> it ends by itself after an hour, or stop it in the same place.</li></ol>
<h2>3. A Gmail filter that forwards (2 minutes)</h2>
<ol><li>In Gmail settings, under <strong>Forwarding and POP/IMAP</strong>, add a second address you own as a forwarding address, and confirm it from that inbox.</li><li>Make a filter for the subject <code>test-forward</code> that forwards to that address.</li><li>Run Spare Key. It lists the filter under <strong>Can read your mail</strong>.</li><li><strong>Undo:</strong> delete the filter under <strong>Filters and Blocked Addresses</strong>, and remove the forwarding address.</li></ol>`);
}

export function apiPage() {
  return doc('api.html', 'Steps API and MCP server', 'The verified steps library as a free, open API and an MCP server.', `
<h1>Steps API and MCP server</h1>
<p class="lead">The verified steps library is free to use. It takes no input, so it cannot receive personal data, and it needs no key.</p>
<h2>Steps API</h2>
<pre><code>GET https://spare-key-app.web.app/api/v1/index.json            every finding code
GET https://spare-key-app.web.app/api/v1/steps/{code}.json     one entry
GET https://spare-key-app.web.app/api/v1/plan-rules.json       the plan order and safety rules</code></pre>
<p>Each entry has what the access means, whether removing it may be noticed and why, what to screenshot first, the steps, what to do if now is not a good time, and official sources with the date they were checked. Open CORS; cached for an hour.</p>
<h2>MCP server</h2>
<p>An AI assistant that uses these tools gives the current steps with the warnings attached. Every input is a finding code or a fixed answer, so no story or name can be sent to it.</p>
<ul><li><code>list_findings</code>: every finding code</li><li><code>get_steps(code)</code>: one code’s steps, with what to screenshot and the warning</li><li><code>make_plan(findings, situation)</code>: a plan in a safety-first order, with the safety rules applied</li></ul>
<p>From a copy of the <a href="https://github.com/usv240/spare-key">repository</a>, run <code>npm install</code> in <code>mcp/</code>, then add it to your assistant:</p>
<pre><code>Claude Code:   claude mcp add spare-key -- node /path/to/spare-key/mcp/server.mjs
Codex:         codex mcp add spare-key -- node /path/to/spare-key/mcp/server.mjs
Others (JSON): { "mcpServers": { "spare-key": { "command": "node", "args": ["/path/to/spare-key/mcp/server.mjs"] } } }</code></pre>
<h2>The plan as code</h2>
<p><code>shared/plan/engine.js</code> and <code>shared/plan/invariants.js</code> build the same plan from finding codes, with no model, so hotline software can make plans locally. Apache-2.0.</p>`);
}

export function accuracyPage({ numbers }) {
  const n = numbers;
  const p = n.planSafety;
  return doc('accuracy.html', 'Accuracy', 'How Spare Key is measured, the numbers, and what they do not show.', `
<h1>Accuracy</h1>
<p class="lead">Every number here comes from a test you can run from the repository. Misses and limits are reported as plainly as passes.</p>
<h2>Practice pages: planted ways in</h2>
${n.practice ? `<p><strong>${n.practice.found} of ${n.practice.of}</strong> planted ways in found, with <strong>${n.practice.falseAlarms}</strong> false alarms, on the 13 made-up practice pages, both with code only and with Gemini Nano. ${esc(n.practice.date)}. Tests: <code>tools/reader-test.mjs</code>, <code>tools/e2e-practice.mjs</code>.</p>` : ''}
<p class="muted">The practice pages were written by the builder, so the readers were tuned on the same pages they are tested on. They show the whole system works end to end; they do not show how well it reads real pages.</p>
<h2>Privacy: nothing that names a person leaves</h2>
${n.privacy ? `<p><strong>${n.privacy.withPrivate} of ${n.privacy.requests}</strong> requests from the extension held a name, email address, phone number, device or place, during a full practice check with every cloud step on. Every request from the service worker, the hidden page and the side panel was captured and searched in plain text, URL-encoded, base64 and JSON-escaped forms. All ${n.privacy.modelRequests} requests to the model matched “What left this computer” word for word. ${esc(n.privacy.date)}. Test: <code>tools/privacy-test.mjs</code>.</p>` : ''}
<h2>Plan safety: the warning that a change may be noticed</h2>
${p ? `<p>${p.of} situations, each a set of findings and answers, written before any results and not changed after. Measured by code.</p>
<div class="table-wrap"><table><thead><tr><th>Measure</th>${p.columns.map(c => `<th class="num">${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${p.rows.map(r => `<tr><td>${esc(r.label)}</td>${r.values.map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<p class="muted">${esc(p.note)}</p>` : '<p>Results are being measured.</p>'}
<h2>What these numbers do not show</h2>
<ul>
  <li>No survivor or advocate has tested Spare Key yet.</li>
  <li>The readers have not yet been measured on real settings pages from test accounts; that test is next.</li>
  <li>The plain chatbot was measured with fixed keyword lists, which are rougher than reading each answer.</li>
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
<p>If the other person may be watching this computer or your phone, a library computer, a work computer they never use, or a friend’s device is a better place to check and to plan.</p>
<h2>Remove Spare Key when you are done</h2>
<p>Open <code>chrome://extensions</code>, find Spare Key, and select Remove.</p>`);
}
