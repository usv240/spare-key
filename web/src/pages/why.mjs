// "Why Spare Key": the case for it, in the order a new reader asks: what is the problem, what does it do that other
// things do not, what leaves the device, how well does it work, how is it built. The home page is for the person who
// needs the check; this page is for the reader who wants the reasons and the proof. Every number comes from
// web/src/data (written from the test results); a number that has not been measured is not shown.
import { page, info, esc } from '../layout.mjs';

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
  return `<li><span class="n">${sum(code, 'found')} to ${sum(nano, 'found')}</span><p>of ${sum(code, 'of')} planted ways in found when the practice pages were changed five ways, the way a site redesign changes them: by code alone, then with Gemini Nano reading the changed page on the computer. This is the part code cannot do. ${esc(drift.nanoDate || drift.date)}.</p></li>`;
}

function androidProof(a) {
  if (!a || !a.passed || a.failed) return '';
  const date = new Date(a.at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  return `<li><span class="n">${a.passed} of ${a.passed + a.failed}</span><p>checks passed by the Android app on an Android ${esc(a.device.android)} emulator, with a test app that does nothing but hold the access a phone-watching app asks for. The emulator has no Gemini Nano, so Gemini Nano’s sorting on a phone is not part of this. ${esc(date)}.</p></li>`;
}

export default function why({ numbers, drift = null, android = null }) {
  const n = numbers;
  const plan = n.planSafety;
  const body = `
<section class="block why-top" aria-labelledby="why-title">
  <div class="wrap">
    <h1 id="why-title">Why Spare Key</h1>
    <p class="lead">The problem, what Spare Key does about it, and the proof. About two minutes.</p>
    <nav class="jump" aria-label="On this page">
      <a href="#problem">The problem</a><a href="#stays">What leaves the device</a><a href="#voices">Two voices</a><a href="#numbers">How well it works</a><a href="#built">How it’s built</a><a href="#builders">For advocates and developers</a>
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
    <p class="muted stakes">Why the order of the plan matters: nearly 2,400 women were killed by men in 2024, and of those who knew their killer, 57.6% were his wife or intimate partner (<a href="https://vpc.org/press/nearly-nine-out-of-10-women-murdered-by-men-are-killed-by-someone-they-know-and-almost-two-thirds-die-by-gunfire-new-violence-policy-center-study-finds/">Violence Policy Center</a>, September 16, 2026). A change the other person notices can be the dangerous moment, so Spare Key says which changes those are before anything is touched.</p>
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

<section class="block" id="voices" aria-labelledby="voices-title">
  <div class="wrap">
    <h2 id="voices-title">Two voices, one plan</h2>
    <p class="lead">Closing a door fast and staying hidden pull against each other, and which one is right depends on the person. So two AI voices argue over the plan, a third settles it, and Spare Key’s own rules make sure every warning is there.</p>
    ${n.voices ? `<div class="voices-grid">
      <div class="voice close rise"><h3>Close the doors</h3><p>${esc(n.voices.close)}</p></div>
      <div class="voice hidden rise"><h3>Stay hidden</h3><p>${esc(n.voices.hidden)}</p></div>
      <div class="voice rise"><h3>How they settled it</h3><p>${esc(n.voices.settled)}</p></div>
    </div><p class="muted">From the practice check for Jordan, ${esc(n.voices.date)}. The voices see finding types only. Ten safety rules, in code, check the plan whoever wrote it. <a href="/how-it-works.html">The ten rules</a></p>` : ''}
  </div>
</section>

<section class="block" id="numbers" aria-labelledby="numbers-title">
  <div class="wrap">
    <h2 id="numbers-title">How well it works</h2>
    <p class="muted">Measured on made-up practice pages and a made-up phone. The readers were also checked against one real account with nothing planted on it. What these numbers do not show is on the <a href="/accuracy.html">Accuracy</a> page.</p>
    <ul class="numbers">
      ${n.practice ? `<li><span class="n">${n.practice.found} of ${n.practice.of}</span><p>planted ways in found on the 13 made-up practice pages, and none of the 4 that belong to the person flagged, with code only and with Gemini Nano. ${esc(n.practice.date)}.</p></li>` : ''}
      ${nanoAdds(drift)}
      ${driftItem(drift)}
      ${n.privacy ? `<li><span class="n">${n.privacy.withPrivate} of ${n.privacy.requests}</span><p>requests from the extension held a name, email address, phone number or device, in a full practice check with every cloud step on. ${esc(n.privacy.date)}.</p></li>` : ''}
      ${plan ? `<li><span class="n">${plan.chatbot.document_first} of ${plan.of}</span><p>answers from a plain chatbot said to screenshot before changing anything, on ${plan.of} made-up situations, judged by keywords. It did warn that a change may be noticed in ${plan.chatbot.alert_warning}. Every plan Spare Key shows does both. ${esc(plan.date)}.</p></li>` : ''}
      ${androidProof(android)}
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
        <tr><td>App Check, Remote Config, Cloud Firestore, Hosting</td><td>Firebase</td><td>Only Spare Key spends its model quota; page readers and the words they read, fixed without an update; the public steps library; this site and the Steps API</td></tr>
      </tbody>
    </table></div>
    <p style="margin-top:20px"><a href="/built-with.html">The full stack, and why each piece is there</a></p>
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
