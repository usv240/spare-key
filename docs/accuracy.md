# Accuracy

Measured on November 21 and 22, 2026, with extension version 0.1.0 and Chrome 158.0.8127.36 on the builder's Windows PC
(32 GB of RAM, with other programs running and as little as 1 to 3 GB free during the runs). Every number comes from a
script in `tools/` that anyone can run, with two exceptions said where they appear: the real-account table (the
script, `tools/real-inpage.mjs`, runs inside the person's own pages, so it was run there by hand and its codes-only
output saved) and the try.html run in the builder's own Chrome (written down by hand). Misses and limits are reported
as plainly as passes.

The saved runs behind every number are in [docs/evidence/](evidence/), copied from `tools/out/` by
`tools/save-evidence.mjs`.

## 1. Planted ways in (EVALUATION.md section 1)

**Practice pages only, so far.** 13 made-up settings pages for a person called Jordan (`web/practice/pages.mjs`) with
24 planted ways in and 4 entries that belong to Jordan (this computer, an app used only for sign-in, a filter that only
labels mail, Jordan's own household profile).

| Mode | Found | False alarms | Time | Test |
|---|---|---|---|---|
| Code only | 24 of 24 | 0 | 13 s for 12 checks | `tools/reader-test.mjs`, `tools/e2e-practice.mjs` |
| Code and Gemini Nano | 24 of 24 | 0 | 234 s for 12 checks through the real extension, after 85 s loading Gemini Nano (November 22, with the rule that Nano cannot hide an entry; 13 of 13 steps passed) | `tools/e2e-practice.mjs --nano` (`docs/evidence/e2e-e2e-practice-nano.json`); also 24 of 24 in `tools/drift-test.mjs --nano` on the unchanged copy |

"0 false alarms" rests on only 4 entries that belong to Jordan. On a real account, the person's own phone, recovery
number, authenticator app and Kindle are listed too, by design, for the person to mark "Mine": Spare Key cannot tell
whose phone is whose, so it shows them rather than guess.

What this does not show: the builder wrote the practice pages and tuned the readers on them, so this proves the whole
system works end to end, not how well it reads real pages. The planted-access test on real test accounts (25 paths,
10 controls, three modes, three runs each) has not been run yet: it needs the test accounts (`docs/test-accounts.md`).

### Real pages: the builder's own account (November 22 and 23, 2026)

Spare Key's own reader and rules (`tools/real-inpage.mjs`) ran inside each real settings page in the builder's everyday
Chrome, read-only, code only (no Gemini Nano); the codes-only output is `docs/evidence/real-account.json`. This is the
reader and rules, not the extension's whole scan: the permission prompt, the scan tab and the panel's "confirm it is
you" wait were not part of it. Only finding codes and counts left the page; no names, addresses or page text were copied out.
Google asked "Verify it's you" on four pages, and the builder confirmed with a passkey in the same tab, as a person
using Spare Key would. "What the site shows" was counted from the page's own links and labels, the same way.

| Check | What the site shows | First reading | After the fix |
|---|---|---|---|
| Apps with access | "Access to (3)" | Read the "Sign in with Google" list too (50 entries) | 3 found, all full access |
| Devices signed in | 18 device rows | 18 read, 17 listed, 1 this computer | No change needed |
| Recovery phone | 1 phone | "Looked different": the number was not written the US way | 1 found |
| Recovery email | 1 address | 1 found, for the person to confirm | No change needed |
| 2-Step Verification | 3 methods (passkeys, Google prompt, phone) | 7: headings and "Add authenticator app" were counted | 3 (one row each; rows that only offer to add are skipped) |
| Location sharing, Gmail forwarding, filters, delegates, family group | Nothing set up | Nothing found, each confirmed by the page's own words | No change needed |
| Google Photos partner sharing | Behind a click in a closed section | Not checked | Not checked, by design: Spare Key never clicks |
| Amazon household | 10 cards: the account holder, 8 profiles, 1 child | Would list the account holder as another adult | 8 listed, for the person to mark; the account holder and the child are not |
| Amazon devices | 7 device groups ("Echo, 1 device"; "Alexa, on 3 devices") | 6 false finds: the old address now opens the content library, and book titles read as devices | 7 groups found, marked "in part" because each group hides its devices |

So on one real account, before these fixes, Spare Key would have shown about 50 wrong app entries, missed a recovery
phone, counted 4 extra 2-Step entries, shown 6 false Amazon devices and 1 false household adult. After them, every
check it could read matches what the site shows. Every fix was rerun on the live page after it was made: apps on
November 22, the recovery phone, 2-Step (3 of 3), household and Amazon devices (7 groups, in part) on November 23 (the
dates are in the evidence file). The practice and drift tests pass with them (24 of 24, 0 silent misses). One account is
one account:
other accounts will show other layouts, which is what the layout report and Remote Config fixes are for.

**A second rule from a live run (November 22).** On the website's practice check in the builder's Chrome, Gemini Nano
sorted all 24 entries in one prompt and called four household and family members the person's own, Sam Porter among
them; the rules then hid them, and the plan said 20 settings instead of 24. Now only the page's own words (like "(you)"
or the person's own address) can make an entry the person's: Nano may say an entry is not theirs, never that it is
(`extension/src/scan/rules.js` merge, `tests/rules.test.mjs`).

What Gemini Nano changed: on its first run it marked an "Active now" phone as "this computer" (which would have hidden
it), gave a "Sign in with Google" app full access, and dated a device the page gave no date for. The rules now let code
win where the page's own words decide (TECHNICAL-DESIGN.md section 6.4), and both modes find 24 of 24.

## 2. Layout drift (EVALUATION.md section 2)

The real pages' snapshots need the test accounts, so this runs on the practice pages instead: `web/practice/drift.mjs`
changes all 13 pages five ways, by script, the same every time (class names and link paths renamed; headings and labels
reworded; lists and tables rebuilt from plain boxes with links turned into buttons; phone numbers masked, dates written
out and a name shown without its email; all four at once). `tools/drift-test.mjs` runs every check on each copy through
the scan engine's own `readToEntries`, and compares with the 24 planted ways in.

"Shown" counts a way in listed at all; "right kind" counts it listed as exactly the planted kind (a teen listed as an
adult is shown, not the right kind). A **silent miss** is a way in not shown on a check that says it was fully checked:
the dangerous kind, because "nothing found" reads as "nobody has access".

**First run, blind** (November 22, before any change made after seeing these pages; `web/src/data/drift-first-run.json`):

| Change | Found, code only | Silent misses |
|---|---|---|
| Renamed | 19 of 24 | 5 |
| Reworded | 13 of 24 | 7 |
| Rebuilt | 16 of 24 | 8 |
| New formats | 23 of 24 | 1 |
| All four | 7 of 24 | 3 |

24 silent misses: a reader that found nothing on a page that loaded reported "nothing listed".

**What changed after that run** (general rules, not tuned to these pages):
- A page that lists nothing counts as empty only when it says so (each check's `emptyText`, provisional until the real
  pages are recorded) or the setting's own section is there. Otherwise the check is "Not checked: the page looked
  different".
- A page that never showed the words the reader waits for is "checked in part" when the reader still found something on
  it. When it found nothing, Gemini Nano reads the page instead; Nano does not read a page the reader found some entries
  on.
- If Nano had to read a page and the code rules make nothing of any entry, that is "looked different" too.
- Lists and tables built from plain boxes with ARIA roles count as lists; masked phone numbers count; an app whose
  access the page does not say, and a household member the page does not place, are listed rather than dropped.
- Remote Config can now replace the words the code rules read, not only the readers.

**Now** (November 22):

| Change | Code only: shown (right kind) | Silent misses | Code and Gemini Nano: shown (right kind) | Silent misses | After the Remote Config fix |
|---|---|---|---|---|---|
| None | 24 (24) | 0 | 24 (24) | 0 |  |
| Renamed | 19 (19) | 0 | 24 (24) | 0 | 24 (24) |
| Reworded | 12 (11) | 0 | 19 (17) | 0 | 24 (24) |
| Rebuilt | 19 (19) | 0 | 24 (24) | 0 | 24 (24) |
| New formats | 24 (24) | 0 | 24 (24) | 0 | 24 (24) |
| All four | 6 (6) | 0 | 18 (16) | 0 | 24 (24) |

With code alone and with Gemini Nano, every way in that is not shown is on a check marked "Not checked" or "checked in
part", which tells the
person to look for themselves.

Entries listed that are not planted ways in: code alone listed 1 (on the reworded copy, an app whose access the page
no longer said, listed as "can use your Google account" rather than dropped); Gemini Nano listed 10 (2 on the reworded copy, 8 on the all-four copy), mostly one device or person split into two entries. Each is shown for the person to mark
"Mine" or "Not mine". This went up from 3 when Nano lost the power to call an entry the person's own (above): an extra
entry costs a tap, a hidden one can cost the person's safety. These Nano numbers are from the saved run with that rule, on
November 23 (`docs/evidence/drift-nano.json`).

**When a real page looks different.** A check that could not read a page offers, in the results, "Tell Spare Key
(anonymous)": one document per page to Cloud Firestore with five fields (the check's name, the reason, the readers'
version, Spare Key's version and the day), which the Firestore rules make create-only. Nothing is sent unless the person
presses it, and the request is shown under "What left this computer". Checked November 22 with
`tools/layout-report-check.mjs`: one report written (marked "selftest"), and a report carrying a page address refused
before sending. The builder then publishes a reader fix through Remote Config.

Limits: the builder wrote both the pages and the changes, so this measures how Spare Key fails, not how often real sites
change. The Remote Config fixes (`web/practice/drift-fixes.mjs`) were written after seeing what broke, so that column
shows the fix path works end to end (through the same `catalogue()` validation the extension runs on Remote Config's
value), not how well a first guess reads a new page. Whether a fix reaches every install within an hour was not timed.

## 3. Privacy: nothing that names a person leaves (EVALUATION.md section 3)

`tools/privacy-test.mjs`, last run November 22, 2026 (an earlier run that day: 0 of 17): a full practice check with every cloud step on (the cloud plan
with function calling, the two voices, every situation answer shared, two findings answered, and the setup probe). Every
network request from the extension's service worker, hidden page and side panel was captured through the Chrome
DevTools Protocol, with its URL, headers and body, and searched for 30 made-up names, emails, phone numbers, devices,
places and filter words from the practice pages (the list is in `tools/privacy-test.mjs`), plain, URL-encoded, base64 and
JSON-escaped.

| Result | |
|---|---|
| Requests from the extension | 20, to 6 hosts (Firebase AI Logic, App Check, Remote Config, Installations, Firestore, and the extension itself) |
| Requests holding a name, email, phone number, device or place | **0 of 20** |
| Requests to the model | 9 |
| Model requests that match "What left this computer" word for word | **9 of 9**, and all 9 logged entries were sent |
| The panel's own ledger (a wrapper around fetch in the hidden page) | **0 of 13** requests holding anything from the check |
| Functions the cloud called while ordering the plan | `get_steps` once, `ask_device` once (answered "no"), `ask_user` never |

The ledger and the network capture are independent checks: the first counts inside the extension, the second outside
it. An earlier run of the ledger counted 5 requests as holding something from the check: the private-string list held
"Phone number", a 2-Step Verification label, which the fixed instructions also use. Generic labels are no longer private
strings (`tests/private.test.mjs`), and the privacy test now fails if the ledger counts anything.

"Word for word" covers the part of each request that changes from scan to scan. Since November 22 the log also shows
the fixed part sent with every request: the instructions, the answer format and the function names.

The scan tab's own requests are the practice site's, not Spare Key's, and are not counted.

## 4. Plan safety (EVALUATION.md section 4)

40 situations (`tools/plan-scenarios.json`), written by a seeded script before any run and not changed after: each a set
of 2 to 6 findings and the four situation answers, covering every finding code at least 4 times and every answer at least
10 times. `tools/plan-eval-cloud.mjs`, model `gemini-3.5-flash-lite` on the Gemini Developer API free tier.

**30 of the 40 situations were scored.** The other 10 failed in the cloud and are not counted: 8 timed out after 30
seconds during function calling (5 while making the plan, 3 during the two voices), 1 got HTTP 500 (model overloaded)
and 1 got HTTP 429 (free-tier quota). The run made 267 cloud calls, including failed attempts. In 21 of the 30 scored
situations, the person said now is not a good time or was not sure.

The scores below are from `tools/plan-eval-score.mjs`, which reads the saved run again offline (no new calls). It
replaced the first scoring, which counted the word "safe" anywhere (even in "a safe device") as false reassurance, and
counted rule R3 as a fix (R3 adds the library's warning to every noticeable "change now" step by design).

| Measure (of 30) | A. Plain chatbot | B. Code plan | C. Cloud plan | D. C with two voices | E. What you see (D after the rules) |
|---|---|---|---|---|---|
| Warns that a change may be noticed | 30 | 30 | 24 | 26 | 30 |
| Screenshot before any change | **4** | 30 | 30 | 30 | 30 |
| Advocate or hotline step | 30 | 30 | 30 | 30 | 30 |
| Never promises "you are safe", "all clear" or the like | 23 | 30 | 26 | 26 | 30 |
| Every finding covered | 27 | 30 | 30 | 29 | 30 |
| Changes that may be noticed wait, when now may not be a good time | 22 | 30 | 30 | 30 | 30 |
| Mail copying stopped before account changes Google emails about (R9) | 27 | 30 | 29 | 28 | 30 |

Fixes the safety rules made to the model's plan (R3 not counted):

| | R1 finding missing | R6 promise or banned word | R8 not-checked step | R9 linked order | Total |
|---|---|---|---|---|---|
| C. Cloud plan | 0 | 38 | 4 | 1 | 43 |
| D. With two voices | 5 | 12 | 0 | 1 | 18 |

Rule R6 removes any sentence with the word "safe" or "secure", not only promises, because Spare Key never uses those
words (README hard rule 3). That is why R6 fires more often than the "promise" measure fails.

**What this shows, honestly:**

- The expected story was that the plain chatbot would often miss the warning that a change can alert the other person.
  On these 30 situations it did not: its answers mentioned noticing or alerting every time. Where it fell short was the
  field's other rule, keeping a record before changing anything: it put screenshots or documentation before the first
  change in 4 of 30. It promised the person would be fine or safe in 7 of 30, left a finding unaddressed in 3 of 30,
  and did not tell the person to wait in 8 of the 21 situations where now may not be a good time.
- The cloud plan alone (C) left out the warning on a noticeable "change now" step in 6 of 30 situations, and the two
  voices (D) in 4. Rule R3 attaches the library's warning in every case.
- The two voices cut the fixes from 43 to 18, and cut "change now" steps from 27 to 15 (more waits). They also dropped
  a finding 5 times, which rule R1 put back.
- **Linked findings (R9, added November 22, after these runs).** In 7 of the 30 situations, the person's mail was copied
  to someone else (forwarding, a forwarding filter, a delegate) and an account change was also needed (recovery, 2-Step
  Verification, signed-in devices). Any email Google sends about such a change, like a security alert or a code, would
  reach the other person, so the mail copying has to come first. The plain chatbot brought up the account change first
  in 3 of the 7 (keyword position, rough); the cloud plan got it wrong once, the two voices twice. The code plan puts the
  mail copying first by construction, and R9 fixes any model plan that does not.
- What a person sees (E) passes every measure by construction: the rules enforce it whatever the model writes.
- What a person would have seen, by situation (`docs/evidence/plan-eval-cloud.log`): the cloud plan answered in 35 of
  40, and the two voices then finished in 30 of those 35. In the other 5 the person keeps the cloud plan, which is
  drawn before the voices run. In 5 of 40 the cloud plan failed (4 timeouts at the then 30-second limit, 1 quota) and
  the person gets the plan made by code on the computer, which passes every measure. Since this run, the plan's
  function-calling exchange and the two voices each wait up to 60 seconds; that change is not yet re-measured.

**How it was measured, and its limits:** the structured plans (B to E) are read step by step by code. The plain
chatbot's free-text answers are read with fixed keyword lists, which is rough: a warning word anywhere in a long answer
counts as a warning, and "screenshot first" is judged by where the first such word falls. The optional AI-graded second
check for A was not run, to stay within the agreed number of calls. The question to the chatbot says "my ex" and "he",
like the study's real-world questions.

### The plan made by Gemini Nano on this computer

`tools/plan-eval-nano.mjs` sends the same 40 situations to the plan made on this computer (`extension/src/device-plan.js`:
Gemini Nano, the same finding codes and every situation answer, with the steps library's facts in its instructions), and
`tools/plan-eval-score.mjs` scores the answers offline with the same measures. No cloud calls.

Run November 22, 2026. **35 of 40 answered**; 5 ran past the plan's 90-second limit and were stopped (as they would be
for a person, who then gets the code plan). Median 29.5 seconds per plan on this PC.

| Measure (of 35) | Gemini Nano's plan | What you see (after the rules) |
|---|---|---|
| Warns that a change may be noticed | 15 | 35 |
| Screenshot before any change | 31 | 35 |
| Advocate or hotline step | 26 | 35 |
| Never promises "you are safe", "all clear" or the like | 33 | 35 |
| Every finding covered | 27 | 35 |
| Changes that may be noticed wait, when now may not be a good time | 11 | 35 |
| Mail copying stopped before account changes Google emails about (R9) | 31 | 35 |

The safety rules made **103 fixes** to Nano's 35 plans (R3 not counted): 44 moved a noticeable change to "wait" (R4),
22 added a "check it yourself" step (R8), 17 put back a finding Nano left out (R1), 8 added the advocate step (R5), 5
removed a banned word (R6), 4 moved the screenshot step first (R2), 3 put the mail copying first (R9). For comparison,
the cloud plan on the 30 situations it answered needed 43, and 18 after the two voices. The plan made by code needs none. On the 25 situations both answered, Nano said to change a noticeable
setting now when now may not be a good time far more often (Nano's plans had 58 "change now" steps across 35 plans,
against 27 for the cloud's 30).

**What this decided:** with plan help from the cloud on, the cloud orders the plan; Gemini Nano orders it only when the
person turns plan help off, so that nothing leaves the computer. In both cases the safety rules, not the model, decide
what a person sees, which is why both pass every measure after them.

**Read in full, not by keywords (`docs/evidence/chatbot-hand-grade.json`, November 24).** A reviewer said a keyword count was
too weak a judge, so each of the 30 chatbot answers was read in full against a written rubric by an AI reviewer (Claude),
with a quote saved for every grade. No person has checked the grades. Told the person to record their settings before
changing anything: yes in 7, partly in 3, no in 20 (the keyword count said 4, and only 3 of those were the same answers).
Warned clearly that a change may be noticed: yes in 24, a hint in 4, nothing in 2 (the keyword count said 30 of 30, which
overstated it). Pointed to an advocate before any change: 18; the other 12 named a hotline only as a resource at the end.
The first thing the answer told the person to do: an advocate in 13, a change in 5, something else in 12, the record in 0.
10 answers said something that could raise risk, mostly "now is the right time" to a person who had said they were not
sure; one gave a wrong hotline number. Six of the 7 "yes" answers gave no change steps at all, so the record came first
only by default; read strictly, one answer said "before you change them" outright. The site and the submission now quote
these numbers, not the keyword ones.

## 5. Speed and readability (EVALUATION.md section 5)

Speed: see section 1. On this PC, loading Gemini Nano the first time took 104 to 133 s; after that, each check took 4 to
19 s with Nano and about 1 s with code only. The PC had little free memory during these runs, so these are slow numbers.

Reading level (`tools/reading-grade.mjs`, `docs/evidence/reading-grade.json`, November 24): the Flesch-Kincaid grade
of the words on the 14 site pages and the side panel (paragraphs, list items, headings and buttons; code, number tables
and menus left out). Median grade 4.2; the highest page is 6.5 (`built-with.html`). The
goal is grade 6 to 8 or lower. An earlier one-off scoring of the panel's 257 strings on November 22 (not saved as a
script) gave median 4.3, with 5 short steps that name a menu, such as "Open Gmail settings, then Forwarding and
POP/IMAP.", between grade 8 and 9.1.

Accessibility (`tools/a11y-check.mjs`, `docs/evidence/a11y.json`, November 24): axe-core 4.10.2 with the WCAG 2.0 and 2.1
A and AA rules and best practices, on all 15 site pages at 375 and 1280 px in light and dark, and on the real side panel
(safety, choose, scanning with the "confirm it is you" box, results, the plan questions, the plan, and Under the hood) in light and dark: 74 runs, 0 violations, and no
page scrolls sideways. axe finds only what can be checked automatically; a keyboard and screen reader pass by a person
is still needed.

## 6. Steps freshness (TECHNICAL-DESIGN.md section 9.3)

The URL context tool could not fetch Google's or Amazon's help pages (`URL_RETRIEVAL_STATUS_ERROR`); it did read the
Safety Net page. With the help page's text fetched on the computer instead, Gmail's forwarding steps were confirmed
current. Amazon's page could not be read either way, and the check says "not sure".

## 7. Phone screenshots (TECHNICAL-DESIGN.md section 6.3)

`tools/screenshot-check.mjs` draws a made-up location-sharing screen (three people and "Me") and sends it to the
extension's on-device reader: Gemini Nano with image input, `ONLY_ON_DEVICE`, no cloud fallback.

November 22, 2026, three runs:

1. Gemini Nano read every name and line, but as eight entries (each name, then the words under it, separately).
   `extension/src/classify.js` now asks for one entry per person and joins a line like "Can see your location" to the
   name above it.
2. Nano could not start an image session ("unable to create a session"), with 3.7 GB of memory free. The panel then says
   it could not read the screenshot, and nothing is sent anywhere.
3. **Pass:** exactly Sam Porter, Riley and Dana (Work), one entry each with what they can see, and "Me / This phone"
   marked as the person's own, in 131.5 seconds (most of it loading the image model).

On the website (try.html, the builder's own Chrome with Gemini Nano, November 22): the practice check with the pages
changed all four ways read 5 checks by code, Gemini Nano on the device read 6 more, and the last was listed as "looked
different" (on November 24, after the reader was made stricter: 3 by code, 8 more by Gemini Nano, 1 not checked, and 12 of
12 by code with the Remote Config fix; `docs/evidence/try-html-live-chrome.md`); then "Read Jordan's screenshot" added Sam Porter and Riley, read by Gemini Nano on the device, and left out
"Me". Headless Chrome cannot run this on the live site: App Check's reCAPTCHA refuses automated browsers.

Limits: one made-up screen in no real app's look. Real Life360 or Find My screens have not been tried.

## 8. The Android app (`tools/android-e2e.mjs`, `docs/evidence/android-e2e.json`, November 24)

The test installs a second app that does nothing but hold the access a phone-watching app asks for (screen reading,
device admin, notifications, texts, location all the time, usage access), turns each one on through adb, and drives
the real app on an Android 16 emulator: **34 of 34 checks passed**. The check took 8.7 s.
The plan made by code was on the screen 2.8 s after the button was pressed, and Gemini in the cloud reordered it 9.3 s after the button was pressed, with rule R10 applied by code.

Where the traffic went (`tools/android-net.mjs`, `docs/evidence/android-net.json`): the emulator records every packet
from outside Android, and Wi-Fi is turned off for the run so nothing can go another way. The hosts Spare Key is built
to reach were:

| Host | What for | Sent | Received |
|---|---|---|---|
| `firebasevertexai.googleapis.com` | Gemini through Firebase AI Logic (the plan, from finding types) | 46.1 KB | 11.0 KB |
| `www.google.com` | reCAPTCHA Enterprise (for App Check) | 38.4 KB | 73.4 KB |
| `www.gstatic.com` | reCAPTCHA Enterprise (for App Check) | 16.2 KB | 1154.3 KB |
| `spare-key-app.web.app` | Spare Key site (the App Check bridge page) | 10.9 KB | 48.0 KB |
| `firebaseremoteconfig.googleapis.com` | Remote Config and its install id (settings) | 2.7 KB | 7.4 KB |
| `firebaseinstallations.googleapis.com` | Remote Config and its install id (settings) | 1.8 KB | 5.3 KB |

These add up to 116.1 KB sent and 1299.3 KB received; Android's own counter for the app says 125.7 KB
sent and 1310.0 KB received. The gap is traffic that hides its host name (QUIC) and went to addresses several Google
hosts share, App Check among them. No usage, crash or analytics host was looked up or reached. The capture also holds
the hosts Android itself reached in that time (Google Play services, time and connectivity checks); they are listed in
the evidence file.

Limits: an emulator, not a person's phone; a test app, not real stalkerware; a rooted phone can hide an app. Gemini
Nano was not on the emulator, so on-device sorting was not part of the run. A capture shows where traffic went and how
much, not the words inside, which are encrypted; the words are shown by the app's own list and checked a second time
in Kotlin before each request.

## 9. The Android app on a real phone (`tools/android-real.mjs`, `docs/evidence/android-real.json`, November 24)

The builder's own phone, a Pixel on Android 17 with 703 apps (328 added by its owner), over USB. The tool plants
nothing and changes no setting; what it reads from the screen stays in the `private/` folder, and the evidence file
holds counts, timings and Spare Key's own sentences only.

| Run | Apps with special access | Listed | Came with the phone, counted | Check | Gemini Nano on the phone | Plan |
|---|---|---|---|---|---|---|
| Rules only (Gemini Nano not yet downloaded) | 72 | 13 (3 can watch the phone, 3 location, 7 one kind of access) | 59 | 1.0 s | none | by rules, on screen in 2.3 s; the cloud did not answer |
| With Gemini Nano | 72 | 13 (9, 3, 1) | 59 | 8.3 s | 13 of 13 apps in 7.5 s; 10 cautions | by rules, on screen in 2.3 s; the cloud did not answer |

What it showed:

- **The app never offered Gemini Nano.** The phone reported it as downloadable and the app had no way to get it. The
  first screen now has "Download Gemini Nano", with progress.
- **Gemini Nano over-warned.** It raised a caution on 10 of 13 ordinary apps, mostly from their powers alone, which
  moved six Play Store apps with one kind of access under "Can watch this phone". Asking the model to say what its
  answer rested on did not help: on the made-up practice phone it picked the right two apps and gave "powers" as the
  reason. So the check is in code: a caution counts only when the app came from outside the Play Store, or holds two or
  more strong powers, or its name or package says what it is (`shared/phone.js`, `backedUp`). On the practice phone on
  the same device it then read: monitoring 1 ("System Update Service"), family locator 1 ("Family Finder"), everyday 2,
  assistive 1; cautions kept 2, set aside 0.
- **The cloud did not answer on either run** (a server error after about 45 s, with the plan request and four
  follow-up answers sent). The plan made by code was on the screen in 2.3 s both times. The cause is not yet known.
- **USB debugging was not flagged**, though it was on: Android 17 did not let the app read that setting, so it is
  listed under "Not checked".

Not shown by this: whether a hidden phone-watching app is found (nothing was planted on this phone; the planted test
is section 8, on an emulator), and the real phone has not yet been checked again after the caution rule changed.
