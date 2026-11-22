# Spare Key: product plan

## 1. The problem, in plain words

When someone leaves an abusive partner, the partner often still has a way in: a phone still signed in to her Google
account, Gmail quietly forwarding her mail, Maps still sharing her location, an Amazon Household that shows her orders
and addresses, a recovery phone number that is his. These are not hacks. They were set up when the two trusted each
other, and they are spread across many companies' settings pages, each one buried in a different menu.

Finding them takes a trained person going account by account. Changing them in the wrong order can tip the abuser off at
the most dangerous time, which is right after she leaves.

### Evidence (dated, third party; re-check every figure against the page before publishing)

| Fact | Source |
|---|---|
| On 193 real-world survivor questions, 86% of answers from GPT-4o, Claude 3.7 Sonnet and two survivor-focused chatbots fell short on accuracy, completeness or safety. 60% omitted critical safety warnings. The models often failed to warn that making changes could alert an abuser. | NYU Tandon, presented at USENIX Security, August 2026; TechXplore, October 21, 2026: https://techxplore.com/news/2026-10-ai-chatbots-unsafe-incomplete-advice.html |
| To the researchers' knowledge, only three dedicated technology-abuse clinics operate in the US. | Same article |
| Nearly 2,400 females were killed by males in 2024; 86.9% knew their killer. | Violence Policy Center, September 16, 2026: https://vpc.org/press/press-releases/ |
| The clinic method starts by identifying who has access, and is done by hand with per-platform guides. | Cornell Clinic to End Tech Abuse resources: https://www.ceta.tech.cornell.edu/resources |
| Apple Safety Check reviews sharing only for Apple accounts. Android's "Safety Check" is a check-in timer, not an access review. | Apple Safety Check coverage; Google Android Help: https://support.google.com/android/answer/9319337 |
| Signing out a device cuts the other person off, and they will likely notice. Screenshot the list first and plan the timing with an advocate. | DefaultPrivacy safety kit: https://defaultprivacy.com/stacks/stalking-abuse-survivor-safety-kit |

**The gap:** no tool checks across several companies automatically. Google's Security Checkup shows Google devices and
third-party apps, but not who can see your location or your mail, and nothing outside Google. A chatbot cannot see your
logged-in settings, and pasting fifteen settings pages into a chatbot is exactly the exposure a survivor must avoid.

## 2. Who it is for

- **First:** an adult in the US who has left, or is planning to leave, an abusive partner and wants to know what that
  person can still see. She may be scared, short on time and on a shared or watched device.
- **Second:** domestic-violence advocates and hotline staff, who help many survivors and have no tool for this. They
  get the same extension, a printable summary, and a free Steps API for their own tools.
- **Judges:** they must be able to try it on their own account in two minutes without any abuse situation, and see
  that it works and that nothing personal left their computer.

## 3. What it does, end to end

1. **Safety first screen.** Before anything else: "If someone may be watching this computer, a library computer or a
   friend's device is safer." The hotline (verify: 1-800-799-7233, text START to 88788, thehotline.org). A Quick exit
   button that is on every screen from then on.
2. **Choose what to check.** A short list of services with checkboxes, all on by default. Each has an "i" button
   explaining what will be opened and read.
3. **Scan.** The extension opens each settings page in one scan tab, reads it, and moves on. The side panel shows
   progress in plain words: "Checking which devices are signed in to your Google account." About one minute in total.
4. **Results.** Grouped by what the other person could do: see your location, read your mail, get into your account,
   see your purchases and addresses, watch through devices. Each item says what it is, how it was found, whether
   removing it will alert the person, and "Open this setting". The user marks each one "Mine", "Not mine" or "Not
   sure". That answer stays on the computer.
5. **What was not checked.** Always shown: services not covered, pages that would not load, accounts not signed in.
   This is what keeps the result from reading as an all-clear.
6. **Safety plan.** An ordered plan: what to screenshot first, what is safest to change now, what to leave until a
   safer moment, and what to talk over with an advocate. The two-voice check (section 5) explains why this order.
7. **Keep or clear.** Nothing is saved by default. The user can print the plan, save it as a file locked with a
   password, or clear everything. An optional cleanup removes the scan's pages from browser history.

## 4. Scope

**Platform:** Chrome extension (the product) plus a website on Firebase Hosting: the landing page, a practice scan that
runs in any browser, and the docs. Submit under Web/Chrome. Android is a stretch goal (section 8) for the multi-platform
Grand Prize consideration, and only if day 6 is on track.

### Checks, by priority

| Priority | Service | Check | Finding codes |
|---|---|---|---|
| Must | Google account | Signed-in devices | `google.devices.other` |
| Must | Google account | Third-party apps with access | `google.apps.full_access`, `google.apps.read_mail`, `google.apps.location` |
| Must | Google account | Recovery phone and recovery email | `google.recovery.phone_unconfirmed`, `google.recovery.email_other` |
| Must | Google account | 2-Step Verification phones and devices | `google.2sv.other_device` |
| Must | Gmail | Automatic forwarding | `gmail.forwarding.external` |
| Must | Gmail | Filters that forward or delete | `gmail.filter.forwards`, `gmail.filter.hides` |
| Must | Gmail | Delegates ("Grant access to your account") | `gmail.delegate` |
| Must | Google Maps | Who can see your location | `maps.sharing.person`, `maps.sharing.link` |
| Must | Chrome (no page reading) | Extensions with broad access | `chrome.extension.broad_access` |
| Must | Chrome (no page reading) | Which account Chrome is synced to | `chrome.sync.other_account` |
| Should | Amazon | Household members | `amazon.household.adult`, `amazon.household.teen` |
| Should | Amazon | Registered devices (Echo, Kindle, Fire, cameras) | `amazon.device.other` |
| Should | Google | Family group | `google.family.member`, `google.family.manager_other` |
| Should | Google Photos | Partner sharing and shared albums | `photos.partner_sharing` |
| Could | Any phone app | Read a screenshot of a sharing screen (Life360, Find My, carrier locator) on the device | `screenshot.sharing.person` |
| Won't (this release) | Ring, Life360 website, carrier sites, Apple, Facebook, Snapchat | Listed in "Not checked" with a link to a trusted manual guide | none |

Each "Won't" service still appears in the results as "Not checked, here is how to check it yourself", linking to a
trusted guide. The product is honest about its edges.

### Features beyond the scan (all in scope)

- **Practice scan** with a made-up person's settings pages, so anyone can see the whole flow without their own data.
- **Plant a test key:** three two-minute ways for a judge to plant a harmless access path in their own account, scan,
  watch it get found, then undo it. This is the "bring your own data" test.
- **What left this computer:** a log showing every cloud request word for word, live, during the scan.
- **No-cloud mode:** the whole product works with the cloud off; the plan then comes from the on-device steps library
  and code. The cloud adds ordering for the user's situation, the two-voice check and freshness checks.
- **Two-voice check:** two AI voices argue over the plan, one for acting now, one for staying safe, and a third settles
  it. Code then enforces the safety rules. See TECHNICAL-DESIGN.md section 9.
- **Steps API and MCP server:** the verified steps library as a free public API for advocates' tools, hotline
  software and coding agents. It never takes personal data.
- **Under the hood:** every result shows where it ran (this computer or the cloud), which model, and what was sent. A
  "How it's built" page shows the full stack.

## 5. How it wins each judging criterion

The criteria are equally weighted. Ties break in this order: Technology, Design, Impact, Idea.

### Technological Implementation: "how effectively does it use Firebase AI Logic hybrid inference"

The split is forced by the problem, not chosen for show:

| Step | Where | Mode | Why it must be there |
|---|---|---|---|
| Read logged-in settings pages and classify each entry (person, device, app; whose) | Gemini Nano | `ONLY_ON_DEVICE` | The pages name the abuser and the survivor. Sending them anywhere is the harm. There is deliberately no cloud fallback: without Nano, code parsers run alone and the result says so. |
| Read a phone screenshot of a sharing screen | Gemini Nano | `ONLY_ON_DEVICE` | Same reason. The feature is disabled without Nano. |
| Order the plan for the user's situation, ask clarifying questions | Gemini in the cloud | `ONLY_IN_CLOUD` with function calling | Needs stronger reasoning across many findings. It sees finding codes only, and calls back to the device for anything else. |
| Two-voice check | Gemini in the cloud | `ONLY_IN_CLOUD` | Three short reasoning calls the small model does poorly; codes only. |
| Keep removal steps current | Gemini in the cloud with the URL context tool | `ONLY_IN_CLOUD` | Settings menus change; the device cannot know today's steps. Input is a finding code and the official help page the steps library cites. (Google Search grounding is not on the free tier; checked November 21, 2026.) |
| "Say it more simply" on any step, and the practice scan on the website | Hybrid | `PREFER_ON_DEVICE` | The text is public or made up, so the cloud is an acceptable fallback on phones and browsers without Nano. |

The function calls go from the cloud back to the device: the cloud asks `ask_device` ("does this filter also delete the
mail?") or `ask_user` ("do you recognise this device?"), and the device answers with yes, no or unknown. The cloud reasons
about a person's situation without ever learning who they are. That pattern, "the cloud asks, the device answers in
enums", is the technical idea to name in the write-up and the video.

Published measurements (EVALUATION.md): recall and precision per check on planted access paths, code-only versus
Nano-only versus combined, robustness when page layouts change, and a privacy test that inspects every network request
during a scan.

### Design: "a complete, coherent product experience"

- One calm flow from the safety screen to the plan, with Quick exit everywhere.
- Every flag ends in something to do: screenshot, open the setting, wait, or talk to an advocate.
- Works for a judge in two minutes (practice scan, or plant a test key) and for a survivor in five.
- Light and dark, phone and desktop, keyboard and screen reader. See EXPERIENCE.md.

### Potential Impact: "a credible, specific case ... based on what's demonstrated"

- A named audience, a dated 2026 study, a scarce resource it extends (three clinics), and a harm that kills.
- Shown, not claimed: the planted-access results, the privacy test, and the plan-safety test against the same failure
  the NYU study found ("failed to warn that changes could alert an abuser").
- Reaches beyond one user: advocates use the printable summary, and the Steps API lets hotline software use the library.
- Be honest about the limit in the write-up: no survivor or advocate has tested it yet. If the user can get one advocate
  to look at it, a single quoted sentence is worth more than any number.

### Quality of the Idea: "creative, non-obvious use ... genuine understanding of the problem space"

- Turns a clinic's manual protocol into a one-minute automated check.
- Understands the field's two rules: document before you change, and changing things can alert the abuser. Both are
  built into the plan by code, not left to the model.
- The privacy argument for on-device inference is literal: the data is the danger.
- The two-voice check exists because the study showed single models drop the warning. It is a fix for a measured
  failure, not a gimmick.

## 6. Rules checklist (from Rules.md)

| Requirement | How it is met |
|---|---|
| Firebase AI Logic, imported and called at runtime | `src/ai.js` in the extension and `web/src/ai.js` on the site |
| A supported platform: Web (Chrome) with Gemini Nano via Firebase AI Logic | Chrome extension and website |
| App Check (debug tokens accepted, but avoid shipping one) | reCAPTCHA on the site; the bridge page for the extension |
| Other Firebase products encouraged | Remote Config, Firestore, Authentication (developer portal only), Hosting |
| Public repo with an open source license visible in the About section | Apache-2.0 `LICENSE` file; set the repo's license field |
| Repo has all source, assets and instructions to run | README with install, build, test and practice steps |
| Demo video under 3 minutes, public on YouTube, English | Script in section 9; record on day 9 |
| Text description: how Firebase AI Logic is used, features, value | Write-up drafted on day 8 from section 5 |
| Free of charge | Free extension, free site, free API |
| New project built in the period; disclose reused code | Say plainly that the AI wrapper and App Check bridge pattern come from the author's Still Recalled entry |
| Substantially different from the author's other entry | Different user, data, harm and surface (account settings, not shopping listings) |
| Testing instructions for judges | "Judge's two-minute tour" on the site and in the README |

## 7. Schedule

Today is Friday, November 20, 2026. The deadline is Monday, November 30, 2:00 PM PT. Plan to submit on Sunday, November
29, leaving Monday morning as a buffer. Thursday, November 26 is Thanksgiving; plan a light day.

| Day | Date | Build | Done when |
|---|---|---|---|
| 1 | Sat Nov 21 | New Firebase project (Spark plan); repo, license, build; extension shell with side panel and Quick exit; AI Logic with `GoogleAIBackend`; App Check bridge; Remote Config defaults. Builder creates two test Google accounts and one Amazon account and plants the access paths from EVALUATION.md. Opens every settings page and records its real URL and structure. | The side panel opens; a device-only prompt and a cloud prompt both answer; every Must page's URL is confirmed |
| 2 | Sun Nov 22 | Scan engine (scan tab, page readers, wait conditions from Remote Config); Google devices, third-party apps, recovery, 2-Step Verification; finding schema; save page snapshots as test fixtures (names replaced). | Four Google checks find their planted paths on the real accounts |
| 3 | Mon Nov 23 | Gmail forwarding, filters and delegates; Maps sharing; the two Chrome checks; Nano entry classification and Nano fallback extraction. | All Must checks run; code-only versus Nano comparison runs on fixtures |
| 4 | Tue Nov 24 | Steps library (Firestore plus a bundled copy); the plan built by code; cloud plan with function calling; the "What left this computer" log; no-cloud mode. | A full scan gives an ordered plan with the cloud on and with it off |
| 5 | Wed Nov 25 | Two-voice check plus code-enforced safety rules; freshness check with the URL context tool; Amazon checks; practice scan fixtures. | The safety rules pass on 40 scenarios |
| 6 | Thu Nov 26 | Website: landing page, How it works, How it's built, practice scan (`PREFER_ON_DEVICE`), docs; "i" buttons; light and dark; phone layout. Light day. | Site deployed; works at 375 px and 1440 px in both themes |
| 7 | Fri Nov 27 | Evaluation runs (planted access, layout drift, privacy intercept, plan safety); publish the numbers; Steps API and MCP server. | `docs/accuracy.md` with real numbers; API live |
| 8 | Sat Nov 28 | Design pass with the three design skills; accessibility audit; end-to-end tests; privacy page; write-up draft. Android stretch only if days 1 to 7 are done. | Every test passes; audit has no serious issues |
| 9 | Sun Nov 29 | Release; video (the user records); Devpost form; final checks. | Submitted |

If the schedule slips, cut in this order: the Android stretch, the Could screenshot check, the keyed API (keep the
static one), Photos and Family, then Amazon. Never cut the safety screen, Quick exit, "Not checked", the privacy test or
the practice scan.

## 8. Android stretch (only if day 6 is on track)

"Phone check" in a small Android app: Android APIs list apps with background location access, device admin rights,
accessibility services and notification access, which are the usual signs of stalkerware. Firebase AI Logic hybrid
inference (`PREFER_ON_DEVICE`) explains each finding from the app's package name and permissions only, which are not
personal, so the cloud fallback on phones without Nano is acceptable. Reuse Still Recalled's Android App Check bridge.
The emulator has no Nano, so say in the write-up that the device path was not run on a phone.

## 9. Video outline (under 3 minutes)

1. **0:00 to 0:20.** The problem in one story, using the study's finding: chatbots told survivors how to remove access
   and forgot to warn them it could alert the abuser. Three clinics in the whole country.
2. **0:20 to 1:20.** A judge-style run on a test account: safety screen, scan, results with "Not mine", "Removing this
   may alert them", and "Not checked".
3. **1:20 to 1:50.** "What left this computer": the log shows finding codes only. Then the cloud asks the device a
   question, and the device answers with yes or no.
4. **1:50 to 2:20.** The plan and the two-voice check, and why the order matters.
5. **2:20 to 2:50.** The numbers: planted paths found, the privacy test, warnings present versus a plain chatbot. The
   Steps API for advocates.
6. **2:50 to 3:00.** The hotline and the link.

Use test accounts only, with made-up names. Never show a real inbox.

## 10. Risks and answers

| Risk | Answer |
|---|---|
| A partial scan reads as "all clear" | "Not checked" is always visible; the product never says safe; every result names what it covered |
| The abuser shares the computer | Safety screen, Quick exit, neutral key icon, nothing saved by default, optional history cleanup |
| Settings pages change and the readers break | Readers and wait conditions live in Remote Config; Nano falls back when code fails; the layout drift test measures it |
| Advice is wrong or stale | Verified steps library with dates and sources; the freshness check flags stale steps; plans always end with an advocate referral |
| No real survivor or advocate tested it | Say so plainly; ask the user to show it to one advocate if possible; publish the planted-access and privacy numbers |
| Free-tier rate limits | One cloud call at a time, cached plans, the no-cloud mode as a full fallback |
| The extension's broad host permissions look scary in the store review | Request host access only for the listed settings domains, as optional permissions granted per service at scan time |
