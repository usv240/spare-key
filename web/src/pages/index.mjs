// The landing page (EXPERIENCE.md section 5.1). Every number comes from web/src/data/numbers.json, which is written from
// the test results; a number that has not been measured is not shown.
import { page, info } from '../layout.mjs';

export default function index({ numbers, apk = null, grade = null }) {
  const n = numbers;

  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <div class="hero-copy">
      <h1 id="hero-title">Who still has a key to your accounts?</h1>
      <p class="lead">Spare Key reads your own Google, Amazon, Chrome and Android settings and lists who can still see your location, your mail or your account. Then it gives you a plan that starts with screenshots. It changes nothing, and names never leave your device.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="/try.html">Try the practice check</a>
        <a class="btn btn-secondary" href="/install.html">Get Spare Key</a>
      </div>
      <p class="hero-note">Free, with no sign-in. The practice check uses made-up pages and works on any phone. This visit stays in your browser’s history. ${info('shared-computer', 'About using a shared computer')}</p>
      <p class="hero-note hero-links"><a href="/phone-check.html">Only have a phone? Check it step by step</a><a href="/advocates.html">For advocates</a></p>
    </div>
    <figure class="panel-frame" id="panel-demo" data-ui>
      <iframe src="/panel-demo.html" title="The Spare Key side panel, showing a practice check for a made-up person" loading="eager"></iframe>
      <a class="panel-still" href="/try.html"><img src="/img/step-understand.png" width="720" height="800" alt="A finding in the side panel: someone can see your location, with Mine, Not mine and Not sure buttons. Opens the practice check."></a>
      <figcaption><span class="wide-only">The real side panel, showing a practice check for a made-up person called Jordan. The buttons work.</span><span class="narrow-only">A practice check for a made-up person called Jordan. Tap it to try the practice check.</span></figcaption>
    </figure>
  </div>
</section>

<section class="block" id="how" aria-labelledby="how-title">
  <div class="wrap">
    <h2 id="how-title">How it works</h2>
    <div class="steps">
      <div class="step-a rise">
        <figure class="shot" data-ui><img src="/img/step-check.png" width="1104" height="600" alt="A practice recovery phone page open in a tab beside the Spare Key panel, which says it is checking the phone and email that can get back into the account." loading="lazy"><figcaption>The scan tab beside the panel. You watch each page it opens.</figcaption></figure>
        <div class="step-text"><h3>Check ${info('how-check', 'About the check')}</h3><p>Spare Key opens each settings page and reads it. It never clicks or changes anything.</p></div>
      </div>
      <div class="step-b rise">
        <figure class="shot" data-ui><img src="/img/step-understand.png" width="720" height="800" alt="A finding in the panel: someone can see your location, with Mine, Not mine and Not sure buttons." loading="lazy"><figcaption>Each finding, in plain words.</figcaption></figure>
        <div class="step-text"><h3>Understand ${info('how-understand', 'About the results')}</h3><p>Each person, device and app is explained in plain words, with what removing it would do.</p></div>
      </div>
      <div class="step-c rise">
        <figure class="shot" data-ui><img src="/img/step-plan.png" width="720" height="800" alt="The plan in the panel: screenshot first, talk to an advocate, then steps to wait on." loading="lazy"><figcaption>A plan in a safety-first order.</figcaption></figure>
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
      <li><h3>An Android phone, with the Android app</h3><ul><li>Apps that can read and control the screen</li><li>Device admin apps</li><li>Apps that can read your notifications, texts or call log</li><li>Apps that can see your location all the time</li><li>Apps with these powers that came from outside the Play Store</li></ul></li>
    </ul>
    <div class="not-yet">
      <h3>Checked with your help</h3>
      <p>Apple and Find My, Life360, your phone plan and tracker alerts are in the <a href="/phone-check.html">step-by-step phone check</a>: you look, and the plan is made from your answers. Ring, Facebook and Snapchat come with a guide to check each one yourself: <a href="https://www.techsafety.org/resources-survivors">Safety Net (NNEDV)</a>, <a href="https://support.apple.com/guide/personal-safety/welcome/web">Apple’s Personal Safety User Guide</a> and the <a href="https://ceta.tech.cornell.edu/resources">Cornell Clinic to End Tech Abuse</a>.</p>
    </div>
  </div>
</section>

<section class="block" id="phone" aria-labelledby="phone-title">
  <div class="wrap phone-grid">
    <div class="phone-text">
      <h2 id="phone-title">The phone itself, iPhone or Android</h2>
      <p class="lead">An account check cannot see an app hidden on the phone. The Android app lists every app that could let someone watch it, and removes nothing. On any phone, iPhone included, the <a href="/phone-check.html">step-by-step phone check</a> shows where to look and makes the same plan.</p>
      <div class="phone-more"><p><a class="big" href="/install.html#${apk ? 'android' : 'android-by-hand'}">${apk ? 'Get the Android app' : 'Check your phone by hand, step by step'}</a></p><p><a href="/install.html#android-video">Watch it run on a practice phone (40 seconds)</a></p></div>
    </div>
    <div class="phones" tabindex="0" role="region" aria-label="Three screens from the Android app, on a made-up practice phone">
      <figure class="shot rise" data-ui><img src="/img/android/results.png" width="540" height="1200" alt="The Android app’s results for a made-up phone: an app called System Update Service can read and control the screen, is a device admin app, and can read notifications, texts and location." loading="lazy"><figcaption>What it found, one app to a card.</figcaption></figure>
      <figure class="shot rise" data-ui><img src="/img/android/plan.png" width="540" height="1200" alt="The plan on the phone: screenshot these first, talk to an advocate, then leave the watching app for a better time." loading="lazy"><figcaption>The same safety-first plan.</figcaption></figure>
      <figure class="shot rise" data-ui><img src="/img/android/hood.png" width="540" height="1200" alt="Under the hood on the phone: where each step runs, what left this phone, and what Spare Key did." loading="lazy"><figcaption>What ran where, and what left the phone.</figcaption></figure>
    </div>
  </div>
</section>

<section class="block field" id="stays" aria-labelledby="stays-title">
  <div class="wrap">
    <div class="block-head"><h2 id="stays-title">What stays on your device</h2>${info('sent-log', 'About what left this computer')}</div>
    <div class="split">
      <div class="rise"><h3>On your device</h3><ul><li>The settings pages Spare Key reads</li><li>Names, email addresses and phone numbers</li><li>Devices and apps</li><li>Your answers, like “Not mine”</li></ul><p class="muted">Gemini Nano reads the pages here, with no cloud fallback.</p></div>
      <div class="rise"><h3>Sent to Gemini in the cloud</h3><ul><li>Finding types, like <code>gmail.forwarding.external</code></li><li>Your optional choices, like “not sure”</li><li>Nothing at all, if you turn plan help off</li></ul><p class="muted">Every request is shown word for word under “What left this computer”, with the fixed instructions sent with it.</p></div>
    </div>
    ${n.privacy ? `<p class="stays-proof"><strong>In our test, ${n.privacy.withPrivate} of ${n.privacy.requests} requests held a name, email address, phone number or device.</strong> <a href="/why.html#stays">See a real request, word for word</a> · <a href="/privacy.html">Exactly what is read, sent and kept</a></p>` : ''}
  </div>
</section>

<section class="block" id="limits" aria-labelledby="limits-title">
  <div class="wrap">
    <h2 id="limits-title">Good to know</h2>
    <ul class="limits">
      <li>It reads; it does not fix. Every change is yours to make, when the time is right.</li>
      <li>When a site changes a page and a reader breaks, the page is listed under “Not checked”, never shown as empty.</li>
      <li>Gemini Nano gives the best reading. Without it, code reads the pages and says where that is less complete.</li>
      <li>An app hidden on a rooted phone can escape the Android app, and the results say so.</li>
      <li>Next: review by advocates and survivors. <a href="/advocates.html#review">Advocates can help here.</a></li>
    </ul>
  </div>
</section>

<section class="block" id="help" aria-labelledby="help-title">
  <div class="wrap">
    <h2 id="help-title">Get help now</h2>
    <div class="help-grid">
      <div class="rise"><h3>National Domestic Violence Hotline</h3><a class="call" href="tel:+18007997233">1-800-799-7233</a><p>Text START to 88788, or chat at <a href="https://www.thehotline.org">thehotline.org</a>. Free, 24/7. Line busy? loveisrespect: call <a href="tel:+18663319474">1-866-331-9474</a> or text LOVEIS to 22522. In danger now, call <a href="tel:911">911</a>.</p></div>
      <div class="rise"><h3>Safety Net (NNEDV)</h3><p>Guides on technology safety for survivors, app by app.</p><a href="https://www.techsafety.org/resources-survivors">techsafety.org</a></div>
      <div class="rise"><h3>Cornell Clinic to End Tech Abuse</h3><p>Resources from a clinic that helps survivors find out who has access.</p><a href="https://ceta.tech.cornell.edu/resources">ceta.tech.cornell.edu</a></div>
    </div>
  </div>
</section>

<section class="block" id="questions" aria-labelledby="questions-title">
  <div class="wrap faq">
    <div><h2 id="questions-title">Questions</h2><p class="muted">Short answers. More on the <a href="/privacy.html">Privacy</a> and <a href="/safety.html">Getting help</a> pages.</p></div>
    <div>
      <details><summary>Will they know I checked?</summary><p>Spare Key only opens your settings pages and reads them. That changes no setting and sends no alert. It can still leave traces: Google’s My Activity may record the visits, Chrome keeps a history, and they may see that the extension is installed. Signing in to Google on a computer you have not used before also sends a new sign-in alert to your recovery email and phone. If someone else uses this computer, check on one you already use that they never touch, and remove the extension when you are done.</p></details>
      <details><summary>Does it change anything?</summary><p>No. It never clicks, removes or saves anything on a settings page. Every change is yours to make, and the plan says which ones may be noticed.</p></details>
      <details><summary>What does it send to Google?</summary><p>Plan help uses Gemini in Google’s cloud. It sees finding types, like “mail is forwarded”, and the answers you choose to share. Never names, addresses, numbers or devices. You can turn plan help off, and then nothing is sent.</p></details>
      <details><summary>What if I don’t have Gemini Nano?</summary><p>Spare Key reads the pages with code only, and says where that is less complete. Gemini Nano needs Chrome on a computer with enough memory and disk.</p></details>
      <details><summary>Can I use it on my phone?</summary><p>On Android, yes. The Android app checks the phone itself: which apps can read your screen, your notifications, your texts or your location. The extension runs in Chrome on a computer and checks your accounts. There is no iPhone app; on an iPhone, Apple’s Safety Check does a similar job. The practice check on this site works on any phone.</p></details>
      <details><summary>Is it free?</summary><p>Yes. No sign-in, no account, no payment.</p></details>
      <details><summary>Who made it?</summary><p>One developer, for the #BuildHybridAI 2026 hackathon. It is open source under the Apache-2.0 license. It is not made by Google, Amazon or the National Domestic Violence Hotline.</p></details>
      <details><summary>How is this different from Google’s Security Checkup or Apple’s Safety Check?</summary><p>Those check one company’s account and are built to fix things fast. Spare Key reads Google, Gmail, Amazon, Chrome and an Android phone in one pass, changes nothing, and follows the field’s two rules: screenshot before you change anything, and a change can alert the other person. Use them together: Spare Key to see and plan, their tools to make each change when the time is right.</p></details>
      <details><summary>Why can’t a chatbot do this?</summary><p>A chatbot cannot see your settings, and pasting them into one sends the very details that are the danger. We asked a plain chatbot about 30 made-up situations and read every answer: ${grade ? `${grade.totals.document_first.yes} told the person to record their settings before changing anything, and ${grade.totals.unsafe} said something risky, like urging changes right away on someone who was not sure` : 'most did not say to record the settings first'}. Spare Key reads on your device, and every plan starts with the record and warns that a change may be noticed.</p></details>
    </div>
  </div>
</section>

`;
  return page({
    file: 'index.html',
    title: 'Spare Key',
    description: 'Find out who still has a key to your accounts and your phone. A free, read-only Chrome extension and Android app. Names never leave your device.',
    body,
  });
}
