// "Why Spare Key": the case for it, in the order a new reader asks: what is the problem, what does it do that other
// things do not, what leaves the device, how well does it work, how is it built. The home page is for the person who
// needs the check; this page is for the reader who wants the reasons and the proof. Every number comes from
// web/src/data (written from the test results); a number that has not been measured is not shown.
import { page, info, esc } from '../layout.mjs';
import { cleanText } from '../../../shared/plan/invariants.js';

const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);

// The layout drift result: how often a check said it was done while missing a way in, on changed pages, now and on the
// first, blind run (tools/drift-test.mjs).
function driftItem(drift) {
  const rows = (drift?.rows || []).filter(r => r.mode === 'code' && r.kind !== 'none');
  if (!rows.length) return '';
  const first = sum(drift.first?.rows || [], 'silentMisses');
  return `<li><span class="n">${sum(rows, 'silentMisses')}</span><p>times a check said it was done while missing a way in, when the practice pages were changed five ways (${sum(rows, 'of')} planted ways in). A page Spare Key cannot read is listed as “Not checked” instead. On the first, blind run, this was ${first}. ${esc(drift.date)}.</p></li>`;
}

// What the model on the device adds that code cannot: reading a page after a site has changed it.
function nanoAdds(drift) {
  const changed = mode => (drift?.rows || []).filter(r => r.mode === mode && r.kind !== 'none');
  const code = changed('code'), nano = changed('nano');
  if (!code.length || !nano.length) return '';
  return `<li><span class="n">${sum(nano, 'found')} of ${sum(nano, 'of')}</span><p>planted ways in found with Gemini Nano reading the changed page on the computer, when the practice pages were changed five ways, the way a site redesign changes them. Code alone found ${sum(code, 'found')}. This is the part code cannot do. ${esc(drift.nanoDate || drift.date)}.</p></li>`;
}

function androidProof(a) {
  if (!a || !a.passed || a.failed) return '';
  const date = new Date(a.at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  return `<li><span class="n">${a.passed} of ${a.passed + a.failed}</span><p>checks passed by the Android app on an Android ${esc(a.device.android)} emulator, with a test app that does nothing but hold the access a phone-watching app asks for. The emulator has no Gemini Nano, so Gemini Nano’s sorting on a phone is not part of this. ${esc(date)}.</p></li>`;
}

// The optional two-voice step: two model voices argue the plan, a third settles it. It runs after the plan made by
// code is already on the screen, and every line passes the same text rule as a plan (rule 6), shown here on a real run.
function voicesBlock(v) {
  if (!v) return '';
  const line = (label, text) => { const c = cleanText(text); return `<div><dt>${label}</dt><dd>${c.text ? esc(c.text) : `<span class="muted">Removed by rule 6. The model wrote: “${esc(text)}” A plan cannot promise that.</span>`}</dd></div>`; };
  return `<div class="voices-note" id="voices">
      <h3>An optional second look: two voices</h3>
      <p>Closing a door fast and staying hidden pull against each other. When plan help is on, one model voice argues for each and a third settles it, from finding types only. The plan made by code is already on the screen, and the eleven rules check whatever the voices write. From the practice check for Jordan, ${esc(v.date)}:</p>
      <dl class="voices-lines">${line('Close the doors', v.close)}${line('Stay hidden', v.hidden)}${line('How they settled it', v.settled)}</dl>
    </div>`;
}

// The real check on a real phone, as counts (tools/android-real.mjs).
function realPhone(real) {
  const runs = real?.runs || [];
  if (!runs.length) return '';
  const r = runs[0];
  // The run to quote: the latest where Gemini Nano sorted the apps and the cloud ordered the plan, else the latest
  // where Gemini Nano sorted them.
  const sorted = runs.filter(x => /Gemini Nano sorted/.test(x.sortedBy || ''));
  const n = [...sorted].reverse().find(x => /^Ordered by/.test(x.planNote || '')) || sorted[sorted.length - 1];
  const took = n && (n.did || []).map(t => /Gemini Nano sorted (\d+) of \d+ apps on this phone in ([\d.]+) s/.exec(t)).find(Boolean);
  return `<li><span class="n">${r.appsWithAccess} to ${r.listed}</span><p>On a real phone with ${r.appsInstalled} apps, ${r.appsWithAccess} held some special access. Spare Key listed ${r.listed} for the person to look at and counted the ${r.appsWithAccess - r.listed} that came with the phone, in about a second, by its rules.${took ? ` Gemini Nano then read all ${took[1]} on the phone itself in ${took[2]} seconds${/^Ordered by/.test(n.planNote || '') ? `, and Gemini in the cloud ordered the plan from finding types ${n.planSeconds} seconds after the button was pressed (on ${runs.filter(x => /^Ordered by/.test(x.planNote || '')).length} of ${runs.length} runs; on the others the free-tier model did not answer in time and the plan made by code stayed)` : ''}.` : ''} Nothing was planted on it. <a href="/accuracy.html#android-real">What that run showed</a></p></li>`;
}

export default function why({ numbers, drift = null, android = null, grade = null, real = null }) {
  const n = numbers;
  const plan = n.planSafety;
  const body = `
<section class="block why-top" aria-labelledby="why-title">
  <div class="wrap">
    <h1 id="why-title">Why Spare Key</h1>
    <p class="lead">The problem, the idea, and the proof. About two minutes.</p>
    <nav class="jump" aria-label="On this page">
      <a href="#problem">The problem</a><a href="#stays">What leaves the device</a><a href="#numbers">How well it works</a><a href="#built">How it’s built</a><a href="#builders">For advocates and developers</a>
    </nav>
  </div>
</section>

<section class="block" id="problem" aria-labelledby="problem-title">
  <div class="wrap">
    <div class="facts-head">
      <h2 id="problem-title">The problem</h2>
      <p class="muted">Most of the ways in were set up in trust: a shared location, a forwarded inbox, a phone that never signed out. After someone leaves, they stay open.</p>
    </div>
    <ul class="facts">
      <li class="fact rise"><span class="fact-n">3.4 million</span><p>people age 16 or older in the US were stalked in 2019. Those stalked both in person and with technology were most often stalked by an intimate partner (35%).</p><cite><a href="https://bjs.ojp.gov/content/pub/pdf/sv19.pdf">Bureau of Justice Statistics, Stalking Victimization, 2019</a> (February 2022)</cite></li>
      <li class="fact rise"><span class="fact-n">60%</span><p>When researchers asked AI chatbots 193 real questions from survivors, 60% of the answers left out critical safety warnings.</p><cite><a href="https://engineering.nyu.edu/news/ai-chatbots-often-give-unsafe-or-incomplete-advice-survivors-tech-enabled-abuse-study-finds">NYU Tandon, USENIX Security 2026</a> (October 20, 2026)</cite></li>
      <li class="fact rise"><span class="fact-n">3</span><p>There are only three dedicated tech-abuse clinics in the US, to the researchers’ knowledge. They do this check by hand, account by account.</p><cite><a href="https://engineering.nyu.edu/news/ai-chatbots-often-give-unsafe-or-incomplete-advice-survivors-tech-enabled-abuse-study-finds">Same study</a></cite></li>
    </ul>
    <p class="closing-line">Spare Key does the clinic’s first job for anyone: it reads the person’s own settings and lists who still has a way in. Then it gives the two warnings the chatbots left out, every time.</p>
    <p class="stakes">A change the other person notices can make things worse. That is why the plan tells you which changes they may notice before you touch anything.</p>
  </div>
</section>

<section class="block" id="clinic" aria-labelledby="clinic-title">
  <div class="wrap">
    <h2 id="clinic-title">Measured against what real clinics found</h2>
    <p class="lead">Researchers from Cornell and NYU sat with 44 survivors at New York City’s Family Justice Centers and checked their phones and accounts by hand. For 23 of the 44 (52%), they found a real risk. Here is what they found, and where Spare Key looks for it.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Clinic findings: table, scrolls sideways on small screens"><table>
      <thead><tr><th>What the clinic found</th><th>Clients</th><th>Where Spare Key looks</th></tr></thead>
      <tbody>
        <tr><td>Signs a password was known to the other person</td><td>14</td><td>What a known password leads to: devices signed in, the recovery email and phone, and 2-Step Verification phones. The plan says when to change the password.</td></tr>
        <tr><td>Unknown devices signed in (8 on email or social media, 4 on iCloud)</td><td>12</td><td>Read: the devices signed in to a Google account. The phone check walks through the devices on an Apple account.</td></tr>
        <tr><td>A shared family or phone plan</td><td>4</td><td>The phone check asks who holds the phone plan, and the Google family group is read.</td></tr>
        <tr><td>Possible spyware</td><td>3</td><td>The Android app lists every app that holds the access spyware needs.</td></tr>
        <tr><td>Browser extensions the person did not install</td><td>2</td><td>Read: the Chrome extensions that can see every page.</td></tr>
        <tr><td>A rooted phone</td><td>1</td><td>The Android app looks for signs the phone is rooted: a root tool, a rooting app, or Android built with test keys. The plan then treats the phone as watched.</td></tr>
      </tbody>
    </table></div>
    <p class="muted">Source: Havron and others, <a href="https://www.usenix.org/system/files/sec19-havron.pdf">Clinical Computer Security for Victims of Intimate Partner Violence</a>, USENIX Security 2019, Figure 3. In an earlier study by the same group, with 39 survivors and 50 professionals, people described 47 times how an abuser tracked a phone’s location (Freed and others, <a href="https://rist.tech.cornell.edu/papers/stalkers-paradise-intimate.pdf">A Stalker’s Paradise</a>, CHI 2018). Spare Key reads Google location sharing and Android’s always-on location, and the phone check covers Find My, Life360 and tracker alerts.</p>
    <p class="result-line">By hand, this check means 13 settings pages on 4 sites, and the 18 official help pages behind them: 12,640 words in the 15 that could be counted, about an hour of reading. Spare Key reads the 12 checks in one pass: 13 seconds on the practice pages.</p>
    <p class="muted"><a href="https://github.com/usv240/spare-key/blob/main/docs/evidence/effort.json">How that was counted</a> (<code>tools/effort.mjs</code>).</p>
  </div>
</section>

<section class="block field" id="stays" aria-labelledby="stays-title">
  <div class="wrap">
    <div class="block-head"><h2 id="stays-title">What leaves the device</h2>${info('sent-log', 'About what left this computer')}</div>
    <p class="lead">The settings pages name the other person. Sending them anywhere is the harm. So the model that reads them runs on the device, with no cloud fallback, and the cloud only ever sees the kind of thing that was found.</p>
    <div class="split">
      <div><h3>Stays on the device</h3><ul><li>The settings pages Spare Key reads</li><li>Names, email addresses and phone numbers</li><li>Devices and apps</li><li>Your answers, like “Not mine”</li></ul><p class="muted">Gemini Nano reads the pages here. If it is not there, code reads them, and the result says so. Nothing falls back to the cloud.</p></div>
      <div><h3>Sent to Gemini in the cloud</h3><ul><li>Finding types, like <code>gmail.forwarding.external</code></li><li>Your optional choices, like “not sure”</li><li>Nothing at all, if you turn plan help off</li></ul><p class="muted">The cloud orders the plan and can ask the device yes or no questions. Every request is shown word for word under “What left this computer”.</p></div>
    </div>
    <div class="sent-sample">
      <div>
        ${n.privacy ? `<p class="result-line">In our test, ${n.privacy.withPrivate} of ${n.privacy.requests} requests from the extension held a name, email address, phone number or device.</p><p class="muted">Every request from the extension was captured during a full practice check with every cloud step on, and searched for every made-up name, address and number on the practice pages. ${esc(n.privacy.date)}.</p>` : ''}
        <p><a href="/privacy.html">Exactly what is read, sent and kept</a></p>
      </div>
      ${n.sentSample ? `<figure class="shot"><pre tabindex="0" aria-label="A real request from the practice check">${esc(n.sentSample)}</pre><figcaption class="muted">A real request from the practice check, word for word. ${esc(n.sentSampleNote || '')}</figcaption></figure>` : ''}
    </div>
  </div>
</section>

<section class="block" id="numbers" aria-labelledby="numbers-title">
  <div class="wrap">
    <h2 id="numbers-title">How well it works</h2>
    <p class="muted">Measured on made-up practice pages and a made-up phone. The readers were also checked against one real account, read-only. How to read each number is on the <a href="/accuracy.html">Accuracy</a> page.</p>
    <ul class="ledger">
      ${n.practice ? `<li><span class="n">${n.practice.found} of ${n.practice.of}</span><p>planted ways in found on the 13 made-up practice pages, and none of the 4 that belong to the person flagged, with code only and with Gemini Nano. ${esc(n.practice.date)}.</p></li>` : ''}
      ${nanoAdds(drift)}
      ${driftItem(drift)}
      ${n.privacy ? `<li><span class="n">${n.privacy.withPrivate} of ${n.privacy.requests}</span><p>requests from the extension held a name, email address, phone number or device, in a full practice check with every cloud step on. ${esc(n.privacy.date)}.</p></li>` : ''}
      ${grade ? `<li><span class="n">${grade.totals.document_first.yes} of ${grade.of}</span><p>answers from a plain chatbot told the person to record their settings before changing anything, on ${grade.of} made-up situations. None made it the first thing to do, ${grade.totals.first_instruction.change} began with a change, and ${grade.totals.unsafe} said something risky, such as “now is the absolute best time to make changes” to a person who was not sure. It warned clearly that a change may be noticed in ${grade.totals.alert_warning.yes}. Every plan Spare Key shows starts with the record and carries the warning. Each answer was read in full against a written rubric by an AI reviewer; a person’s review of the grades is next (<a href="https://github.com/usv240/spare-key/blob/main/docs/evidence/chatbot-hand-grade.json">the grades, with a quote for each</a>). ${esc(plan?.date || '')}.</p></li>` : ''}
      ${androidProof(android)}
      ${realPhone(real)}
    </ul>
  </div>
</section>

<section class="block" id="built" aria-labelledby="built-title">
  <div class="wrap">
    <h2 id="built-title">How it’s built</h2>
    <p class="lead">Each step runs at the most private place its data allows. That is what hybrid means here: the data decides where the model runs.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Table, scrolls sideways on small screens"><table>
      <thead><tr><th>Piece</th><th>Runs</th><th>Why it is used</th></tr></thead>
      <tbody>
        <tr><td>Gemini Nano through Firebase AI Logic (only on device)</td><td>This computer</td><td>Reads and sorts the private settings pages, reads a page a site has changed, reads a screenshot of a phone location app, and orders the plan when plan help from the cloud is off</td></tr>
        <tr><td>Gemini through Firebase AI Logic (only in the cloud, function calling)</td><td>Google’s cloud</td><td>Orders the plan from finding types only, and asks the device yes or no questions</td></tr>
        <tr><td>Hybrid inference (prefer on device)</td><td>Either</td><td>Only text that names no one: the practice check on this site, and putting a public step in simpler words</td></tr>
        <tr><td>Firebase AI Logic on Android (Gemini Nano on device, Gemini in the cloud)</td><td>The phone, and Google’s cloud</td><td>Gemini Nano says what kind of app each one seems to be, on the phone. The cloud orders the plan from finding types and asks the phone yes or no questions</td></tr>
        <tr><td>One rules engine for both</td><td>Computer and phone</td><td>The extension’s own JavaScript runs in Android’s sandbox, so the finding types, the cloud gate and the safety rules cannot drift apart</td></tr>
        <tr><td>Server prompt templates (Firebase AI Logic)</td><td>Firebase’s server</td><td>The plan’s instructions and functions stay on the server; apps send only the template’s id and finding codes, and the server refuses anything that is not a code</td></tr>
        <tr><td>App Check, Remote Config, Cloud Firestore, Hosting</td><td>Firebase</td><td>Only Spare Key spends its model quota; page readers and the words they read, fixed without an update; the public steps library; this site and the Steps API</td></tr>
      </tbody>
    </table></div>
    <p style="margin-top:20px"><a href="/built-with.html">The full stack, and why each piece is there</a></p>
    ${voicesBlock(n.voices)}
  </div>
</section>

<section class="block" id="fits" aria-labelledby="fits-title">
  <div class="wrap">
    <h2 id="fits-title">How it fits with the tools people already use</h2>
    <p class="lead">Spare Key adds two things to the checks that exist: one look across several companies at once, and, for each thing it finds, what the other person may notice and which to change first.</p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Other tools: table, scrolls sideways on small screens"><table>
      <thead><tr><th>Tool</th><th>What it does well</th><th>What Spare Key adds</th></tr></thead>
      <tbody>
        <tr><td>Apple Safety Check</td><td>On an iPhone, reviews and stops sharing with people and apps, in one place</td><td>The same kind of review for Google, Gmail, Google Photos, Amazon, Chrome and Android phones, and a plan that says what each change shows the other person</td></tr>
        <tr><td>Google Security Checkup</td><td>Reviews one Google account’s devices, recovery details and connected apps</td><td>Reads Gmail forwarding, filters and delegates, location sharing and Amazon too, and puts the changes that may be noticed last, after a record and an advocate</td></tr>
        <tr><td>Cornell’s Clinic to End Tech Abuse and its phone scanner</td><td>Trained volunteers check a survivor’s accounts and phone with them, and a scanner looks for spyware on a connected phone</td><td>The clinic’s first job, finding who still has a way in, for anyone, at any hour, with a record an advocate can use in a session</td></tr>
        <tr><td>A chatbot</td><td>Answers questions in plain words</td><td>Reads the settings itself, so the person never pastes names or addresses into a chat, and code makes sure every plan starts with the record and an advocate</td></tr>
      </tbody>
    </table></div>
  </div>
</section>

<section class="block" id="builders" aria-labelledby="builders-title">
  <div class="wrap">
    <h2 id="builders-title">For advocates and developers</h2>
    <div class="split">
      <div>
        <p>An advocate can run the check with someone, read the findings together, and print the plan, with addresses hidden unless the person chooses to show them. <a href="/advocates.html">How to use it in a session</a></p>
        <p>The steps library, checked against official help pages, is a free, open API, and an MCP server lets an AI assistant give the current steps with the warnings attached.</p>
        <p><a href="/api.html">The Steps API and the MCP server</a> · <a href="/what-they-see.html">What they see when you change it</a></p>
    <p class="muted stakes">For advocates and judges, why the order matters: nearly 2,400 women were killed by men in 2024, and of those who knew their killer, 57.6% were his wife or intimate partner (<a href="https://vpc.org/press/nearly-nine-out-of-10-women-murdered-by-men-are-killed-by-someone-they-know-and-almost-two-thirds-die-by-gunfire-new-violence-policy-center-study-finds/">Violence Policy Center</a>, September 16, 2026). A change the other person notices can be the dangerous moment, so Spare Key says which changes those are before anything is touched.</p>
      </div>
      <pre tabindex="0" aria-label="Example request to the Steps API"><code>GET https://spare-key-app.web.app/api/v1/steps/google.recovery.email_other.json

{ "title": "Another email address can reset your password",
  "who_can_notice": "noticeable",
  "what_they_see": "Google may still send codes to the old address for 7 days...",
  "notice_source": { "url": "https://support.google.com/...", "quote": "..." },
  "evidence_first": ["Screenshot this settings page..."], ... }</code></pre>
    </div>
  </div>
</section>

<section class="block" id="words" aria-labelledby="words-title">
  <div class="wrap">
    <h2 id="words-title">Words used here</h2>
    <dl class="glossary" style="margin-top:24px">
      <dt>Gemini Nano</dt><dd>A small AI model that runs inside Chrome, on your computer, or on some Android phones.</dd>
      <dt>The cloud</dt><dd>Computers run by a company, here Google, reached over the internet.</dd>
      <dt>Hybrid inference</dt><dd>Using the model on your device when it is there, and the cloud when it is not. Spare Key uses it only for text that names no one: the made-up practice check, and putting the public steps in simpler words.</dd>
      <dt>Finding type</dt><dd>A name for a kind of access, like <code>gmail.forwarding.external</code>. It never names a person.</dd>
      <dt>App Check</dt><dd>A Firebase check that only Spare Key can use its AI quota.</dd>
      <dt>Remote Config</dt><dd>Settings Spare Key reads from Firebase, so a broken page reader can be fixed without an update.</dd>
      <dt>Advocate</dt><dd>A trained person who helps survivors plan for safety, for free. The hotline can connect you to one.</dd>
    </dl>
    <p style="margin-top:32px"><a class="btn btn-primary" href="/try.html">Try the practice check</a></p>
  </div>
</section>
`;
  return page({
    file: 'why.html',
    title: 'Why Spare Key',
    description: 'The problem Spare Key is for, what leaves the device, how well it works and how it is built.',
    body,
  });
}
