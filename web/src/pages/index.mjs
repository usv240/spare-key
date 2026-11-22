// The landing page (EXPERIENCE.md section 5.1). Every number comes from web/src/data/numbers.json, which is written from
// the test results; a number that has not been measured is not shown.
import { page, info, esc } from '../layout.mjs';

// The layout drift result: how often a check said it was done while missing a way in, on changed pages, now and on the
// first, blind run (tools/drift-test.mjs).
function driftItem(drift) {
  const rows = (drift?.rows || []).filter(r => r.mode === 'code' && r.kind !== 'none');
  if (!rows.length) return '';
  const silent = rows.reduce((a, r) => a + r.silentMisses, 0);
  const ways = rows.reduce((a, r) => a + r.of, 0);
  const first = (drift.first?.rows || []).reduce((a, r) => a + r.silentMisses, 0);
  return `<li><span class="n">${silent}</span><p>times a check said it was done while missing a way in, when the practice pages were changed five ways (${ways} planted ways in). A page Spare Key cannot read is listed as “Not checked” instead. On the first, blind run, this was ${first}. ${esc(drift.date)}.</p></li>`;
}

export default function index({ numbers, drift = null }) {
  const n = numbers;
  const plan = n.planSafety;
  const sentSample = n.sentSample || '';

  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <div>
      <h1 id="hero-title">Who still has a key to your accounts?</h1>
      <p class="lead">Spare Key checks your Google, Gmail, location sharing, Amazon and Chrome settings in a few minutes. It shows every person, device and app that can still see your location, your mail or your account. Read-only. Names never leave your computer.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="/install.html">Get the Chrome extension</a>
        <a class="btn btn-secondary" href="/try.html">Try the practice check</a>
      </div>
      <p class="hero-note">Free. No sign-in. If someone may be watching this computer, a computer they never use, like a trusted friend’s, is a better place to check. ${info('shared-computer', 'About using a shared computer')}</p>
      <p class="hero-note"><a href="#tour" id="tour-start">New here? Take the two-minute tour</a></p>
    </div>
    <figure class="panel-frame" id="panel-demo">
      <iframe src="/panel-demo.html" title="The Spare Key side panel, showing a practice check for a made-up person" loading="eager"></iframe>
      <figcaption>The real side panel, showing a practice check for a made-up person called Jordan. The buttons work.</figcaption>
    </figure>
  </div>
</section>

<section class="block" id="why" aria-labelledby="why-title">
  <div class="wrap">
    <div class="facts-head">
      <h2 id="why-title">Why this matters</h2>
      <p class="muted">Most of the ways in were set up in trust: a shared location, a forwarded inbox, a phone that never signed out.</p>
    </div>
    <ul class="facts">
      <li class="fact rise"><span class="fact-n">60%</span><p>When researchers asked AI chatbots 193 real questions from survivors, 60% of the answers left out critical safety warnings, often the warning that changing a setting can alert an abuser.</p><cite><a href="https://engineering.nyu.edu/news/ai-chatbots-often-give-unsafe-or-incomplete-advice-survivors-tech-enabled-abuse-study-finds">NYU Tandon, USENIX Security 2026</a> (October 20, 2026)</cite></li>
      <li class="fact rise"><span class="fact-n">3</span><p>There are only three dedicated tech-abuse clinics in the US, to the researchers’ knowledge.</p><cite><a href="https://engineering.nyu.edu/news/ai-chatbots-often-give-unsafe-or-incomplete-advice-survivors-tech-enabled-abuse-study-finds">Same study</a></cite></li>
      <li class="fact rise"><span class="fact-n">86.9%</span><p>Nearly 2,400 women were killed by men in 2024. 86.9% knew their killer.</p><cite><a href="https://vpc.org/press/nearly-nine-out-of-10-women-murdered-by-men-are-killed-by-someone-they-know-and-almost-two-thirds-die-by-gunfire-new-violence-policy-center-study-finds/">Violence Policy Center</a> (September 16, 2026)</cite></li>
    </ul>
  </div>
</section>

<section class="block" id="how" aria-labelledby="how-title">
  <div class="wrap">
    <h2 id="how-title">How it works</h2>
    <div class="steps">
      <div class="step-a rise">
        <figure class="shot"><img src="/img/step-check.png" width="1104" height="600" alt="A practice recovery phone page open in a tab beside the Spare Key panel, which says it is checking the phone and email that can get back into the account." loading="lazy"><figcaption>The scan tab beside the panel. You watch each page it opens.</figcaption></figure>
        <div class="step-text"><h3>Check ${info('how-check', 'About the check')}</h3><p>Spare Key opens each settings page and reads it. It never clicks or changes anything.</p></div>
      </div>
      <div class="step-b rise">
        <figure class="shot"><img src="/img/step-understand.png" width="720" height="800" alt="A finding in the panel: someone can see your location, with Mine, Not mine and Not sure buttons." loading="lazy"><figcaption>Each finding, in plain words.</figcaption></figure>
        <div class="step-text"><h3>Understand ${info('how-understand', 'About the results')}</h3><p>Each person, device and app is explained in plain words, with what removing it would do.</p></div>
      </div>
      <div class="step-c rise">
        <figure class="shot"><img src="/img/step-plan.png" width="720" height="800" alt="The plan in the panel: screenshot first, talk to an advocate, then steps to wait on." loading="lazy"><figcaption>A plan in a safety-first order.</figcaption></figure>
        <div class="step-text"><h3>Plan ${info('how-plan', 'About the plan')}</h3><p>You get an order to deal with them in: what to screenshot, what can change now, and what to leave for a better time.</p></div>
      </div>
    </div>
  </div>
</section>

<section class="block" id="checks" aria-labelledby="checks-title">
  <div class="wrap">
    <h2 id="checks-title">What it checks</h2>
    <p class="muted">Each check reads one of your own settings pages, on this computer.</p>
    <ul class="checks">
      <li><h3>Google account</h3><ul><li>Devices signed in to your account</li><li>Apps that can use your account, read your mail or see your location</li><li>Your recovery phone and email</li><li>Phones and keys for 2-Step Verification</li><li>People who can see your location</li><li>Your Google family group</li></ul></li>
      <li><h3>Gmail</h3><ul><li>Forwarding to another address</li><li>Filters that forward or hide mail</li><li>People who can open your Gmail</li></ul></li>
      <li><h3>Google Photos</h3><ul><li>Partner sharing</li></ul></li>
      <li><h3>Amazon</h3><ul><li>People in your Amazon household</li><li>Devices on your account, like Echo, Kindle and Fire TV</li></ul></li>
      <li><h3>This Chrome browser</h3><ul><li>Extensions that can read every page you visit</li><li>Whether Chrome sends your history to another account</li></ul></li>
    </ul>
    <div class="not-yet">
      <h3>Not checked yet</h3>
      <p>Ring, Life360, your phone carrier, Apple, Facebook, Snapchat, and your phone itself. Spare Key always lists these as not checked, with a guide to check each one yourself: <a href="https://www.techsafety.org/resources-survivors">Safety Net (NNEDV)</a>, <a href="https://support.apple.com/guide/personal-safety/welcome/web">Apple’s Personal Safety User Guide</a> and the <a href="https://ceta.tech.cornell.edu/resources">Cornell Clinic to End Tech Abuse</a>.</p>
    </div>
  </div>
</section>

<section class="block field" id="stays" aria-labelledby="stays-title">
  <div class="wrap">
    <div class="block-head"><h2 id="stays-title">What stays on your computer</h2>${info('sent-log', 'About what left this computer')}</div>
    <div class="split">
      <div><h3>On your computer</h3><ul><li>The settings pages Spare Key reads</li><li>Names, email addresses and phone numbers</li><li>Devices and apps</li><li>Your answers, like “Not mine”</li></ul><p class="muted">Gemini Nano reads the pages here, with no cloud fallback.</p></div>
      <div><h3>Sent to Gemini in the cloud</h3><ul><li>Finding types, like <code>gmail.forwarding.external</code></li><li>Your optional choices, like “not sure”</li><li>Nothing at all, if you turn plan help off</li></ul><p class="muted">Every request is shown word for word under “What left this computer”, with the fixed instructions sent with it.</p></div>
    </div>
    <div class="sent-sample">
      <div>
        ${n.privacy ? `<p class="result-line">In our test, ${n.privacy.withPrivate} of ${n.privacy.requests} requests from the extension held a name, email address, phone number or device.</p><p class="muted">Every request from the extension was captured during a full practice check with every cloud step on, and searched for every made-up name, address and number on the practice pages. ${esc(n.privacy.date)}.</p>` : ''}
        <p><a href="/privacy.html">Exactly what is read, sent and kept</a></p>
      </div>
      ${sentSample ? `<figure class="shot"><pre tabindex="0" aria-label="A real request from the practice check">${esc(sentSample)}</pre><figcaption class="muted">A real request from the practice check, word for word. ${esc(n.sentSampleNote || '')}</figcaption></figure>` : ''}
    </div>
  </div>
</section>

<section class="block" id="voices" aria-labelledby="voices-title">
  <div class="wrap">
    <h2 id="voices-title">Two voices, one plan</h2>
    <p class="lead">Before you see your plan, two AI voices argue over it. One argues for closing every door quickly. The other argues for staying hidden until it is a better time. A third settles it, and Spare Key’s own rules make sure every warning is there.</p>
    ${n.voices ? `<div class="voices-grid">
      <div class="voice close rise"><h3>Close the doors</h3><p>${esc(n.voices.close)}</p></div>
      <div class="voice hidden rise"><h3>Stay hidden</h3><p>${esc(n.voices.hidden)}</p></div>
      <div class="voice rise"><h3>How they settled it</h3><p>${esc(n.voices.settled)}</p></div>
    </div><p class="muted">From the practice check for Jordan, ${esc(n.voices.date)}. The voices see finding types only.</p>` : ''}
  </div>
</section>

<section class="block" id="try" aria-labelledby="try-title">
  <div class="wrap">
    <h2 id="try-title">Try it yourself</h2>
    <ul class="try-list">
      <li><h3>Practice check</h3><p>A made-up person’s settings pages, start to finish, in about two minutes. Nothing of yours is used. You can also break the pages first and watch what Spare Key does.</p><a class="big" href="/try.html">Start the practice check</a></li>
      <li><h3>Plant a test key</h3><p>Plant a harmless way in to your own account, watch Spare Key find it, then undo it.</p><a class="big" href="/plant.html">See the three recipes</a></li>
      <li><h3>New here?</h3><p>A short tour of the problem, a check, what left the computer, the two voices and how it is built.</p><a class="big" href="#tour" data-tour-start>Take the two-minute tour</a></li>
    </ul>
  </div>
</section>

<section class="block" id="builders" aria-labelledby="builders-title">
  <div class="wrap">
    <h2 id="builders-title">For advocates and developers</h2>
    <div class="split" style="margin-top:24px">
      <div>
        <p>Advocates can print the plan, with addresses hidden unless the person chooses to show them. The steps library, checked against official help pages, is a free, open API, and an MCP server lets an AI assistant give the current steps with the warnings attached.</p>
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

<section class="block" id="built" aria-labelledby="built-title">
  <div class="wrap">
    <h2 id="built-title">How it’s built</h2>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Table, scrolls sideways on small screens"><table>
      <thead><tr><th>Piece</th><th>Runs</th><th>Why it is used</th></tr></thead>
      <tbody>
        <tr><td>Gemini Nano through Firebase AI Logic (only on device)</td><td>This computer</td><td>Reads and sorts the private settings pages, reads a page a site has changed, reads a screenshot of a phone location app, and orders the plan when plan help from the cloud is off</td></tr>
        <tr><td>Gemini through Firebase AI Logic (only in the cloud, function calling)</td><td>Google’s cloud</td><td>Orders the plan from finding types only, and asks the device yes or no questions</td></tr>
        <tr><td>Hybrid inference (prefer on device)</td><td>Either</td><td>The practice check on this site, which holds no personal data</td></tr>
        <tr><td>App Check, Remote Config, Cloud Firestore, Hosting</td><td>Firebase</td><td>Only Spare Key spends its model quota; page readers and the words they read, fixed without an update; the public steps library; this site and the Steps API</td></tr>
      </tbody>
    </table></div>
    <p style="margin-top:20px"><a href="/built-with.html">The full stack, and why each piece is there</a></p>
  </div>
</section>

<section class="block" id="numbers" aria-labelledby="numbers-title">
  <div class="wrap">
    <h2 id="numbers-title">How well it works</h2>
    <p class="muted">Measured on made-up practice pages, not yet on real accounts. What these numbers do not show is on the <a href="/accuracy.html">Accuracy</a> page.</p>
    <ul class="numbers">
      ${n.practice ? `<li><span class="n">${n.practice.found} of ${n.practice.of}</span><p>planted ways in found on the 13 made-up practice pages, and none of the 4 that belong to the person flagged, with code only and with Gemini Nano. ${esc(n.practice.date)}.</p></li>` : ''}
      ${n.privacy ? `<li><span class="n">${n.privacy.withPrivate} of ${n.privacy.requests}</span><p>requests from the extension held a name, email address, phone number or device, in a full practice check with every cloud step on. ${esc(n.privacy.date)}.</p></li>` : ''}
      ${driftItem(drift)}
      ${plan ? `<li><span class="n">${plan.chatbot.document_first} of ${plan.of}</span><p>answers from a plain chatbot said to screenshot before changing anything, on ${plan.of} made-up situations, judged by keywords. It did warn that a change may be noticed in ${plan.chatbot.alert_warning}. Every plan Spare Key shows does both. ${esc(plan.date)}.</p></li>` : ''}
    </ul>
  </div>
</section>

<section class="block" id="limits" aria-labelledby="limits-title">
  <div class="wrap">
    <h2 id="limits-title">Limits</h2>
    <ul class="limits">
      <li>No survivor or advocate has tested it yet.</li>
      <li>It covers the services listed above, and nothing else.</li>
      <li>Websites change their pages, and a page reader can break. When it does, the result says so: the page is listed under “Not checked”, never shown as empty.</li>
      <li>Gemini Nano is needed for the best reading. Without it, pages are read by code only.</li>
      <li>It cannot see your phone itself. For a location app on it, you can give it a screenshot, which Gemini Nano reads on this computer.</li>
      <li>It reads; it does not fix. Every change is yours to make, when the time is right.</li>
    </ul>
  </div>
</section>

<section class="block" id="help" aria-labelledby="help-title">
  <div class="wrap">
    <h2 id="help-title">Get help now</h2>
    <div class="help-grid" style="margin-top:24px">
      <div><h3>National Domestic Violence Hotline</h3><a class="call" href="tel:+18007997233">1-800-799-7233</a><p>Text START to 88788, or chat at <a href="https://www.thehotline.org">thehotline.org</a>. Free, 24/7.</p></div>
      <div><h3>Safety Net (NNEDV)</h3><p>Guides on technology safety for survivors, app by app.</p><a href="https://www.techsafety.org/resources-survivors">techsafety.org</a></div>
      <div><h3>Cornell Clinic to End Tech Abuse</h3><p>Resources from a clinic that helps survivors find out who has access.</p><a href="https://ceta.tech.cornell.edu/resources">ceta.tech.cornell.edu</a></div>
    </div>
  </div>
</section>

<section class="block" id="questions" aria-labelledby="questions-title">
  <div class="wrap faq">
    <div><h2 id="questions-title">Questions</h2><p class="muted">Short answers. More on the <a href="/privacy.html">Privacy</a> and <a href="/safety.html">Getting help</a> pages.</p></div>
    <div>
      <details><summary>Will they know I checked?</summary><p>Spare Key only opens your settings pages and reads them, which changes nothing they can see. But Chrome keeps a history, and they may see that the extension is installed. If someone else uses this computer, check on another device, and remove the extension when you are done.</p></details>
      <details><summary>Does it change anything?</summary><p>No. It never clicks, removes or saves anything on a settings page. Every change is yours to make, and the plan says which ones may be noticed.</p></details>
      <details><summary>What does it send to Google?</summary><p>Plan help uses Gemini in Google’s cloud. It sees finding types, like “mail is forwarded”, and the answers you choose to share. Never names, addresses, numbers or devices. You can turn plan help off, and then nothing is sent.</p></details>
      <details><summary>What if I don’t have Gemini Nano?</summary><p>Spare Key reads the pages with code only, and says where that is less complete. Gemini Nano needs Chrome on a computer with enough memory and disk.</p></details>
      <details><summary>Can I use it on my phone?</summary><p>The extension runs in Chrome on a computer. The practice check on this site works on a phone.</p></details>
      <details><summary>Is it free?</summary><p>Yes. No sign-in, no account, no payment.</p></details>
      <details><summary>Who made it?</summary><p>One developer, for the #BuildHybridAI 2026 hackathon. It is open source under the Apache-2.0 license. It is not made by Google, Amazon or the National Domestic Violence Hotline.</p></details>
      <details><summary>Why can’t a chatbot do this?</summary><p>A chatbot cannot see your settings, and pasting them into one sends the very details that are the danger. Researchers also found chatbots often leave out the warning that a change can alert the other person. Spare Key reads on your computer and builds that warning into every plan.</p></details>
    </div>
  </div>
</section>

<section class="block" id="words" aria-labelledby="words-title">
  <div class="wrap">
    <h2 id="words-title">Words used here</h2>
    <dl class="glossary" style="margin-top:24px">
      <dt>Gemini Nano</dt><dd>A small AI model that runs inside Chrome, on your computer.</dd>
      <dt>The cloud</dt><dd>Computers run by a company, here Google, reached over the internet.</dd>
      <dt>Hybrid inference</dt><dd>Using the model on your computer when it is there, and the cloud when it is not. Spare Key uses it only for made-up practice data.</dd>
      <dt>Finding type</dt><dd>A name for a kind of access, like <code>gmail.forwarding.external</code>. It never names a person.</dd>
      <dt>App Check</dt><dd>A Firebase check that only Spare Key can use its AI quota.</dd>
      <dt>Remote Config</dt><dd>Settings Spare Key reads from Firebase, so a broken page reader can be fixed without an update.</dd>
      <dt>Advocate</dt><dd>A trained person who helps survivors plan for safety, for free. The hotline can connect you to one.</dd>
    </dl>
  </div>
</section>
`;
  return page({
    file: 'index.html',
    title: 'Spare Key',
    description: 'Find out who still has a key to your accounts. A free, read-only Chrome extension. Names never leave your computer.',
    body,
    scripts: ['/build/tour.js'],
  });
}
