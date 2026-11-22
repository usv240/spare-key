# Accuracy

Measured on November 21 and 22, 2026, with extension version 0.1.0 and Chrome 158.0.8127.36 on the builder's Windows PC
(32 GB of RAM, with other programs running and as little as 1 to 3 GB free during the runs). Every number comes from a
script in `tools/` that anyone can run. Misses and limits are reported as plainly as passes.

## 1. Planted ways in (EVALUATION.md section 1)

**Practice pages only, so far.** 13 made-up settings pages for a person called Jordan (`web/practice/pages.mjs`) with
24 planted ways in and 4 entries that belong to Jordan (this computer, an app used only for sign-in, a filter that only
labels mail, Jordan's own household profile).

| Mode | Found | False alarms | Time | Test |
|---|---|---|---|---|
| Code only | 24 of 24 | 0 | 13 s for 12 checks | `tools/reader-test.mjs`, `tools/e2e-practice.mjs` |
| Code and Gemini Nano | 24 of 24 | 0 | 101 s for 12 checks, after loading Gemini Nano (133 s, once) | `tools/e2e-practice.mjs --nano` |

"0 false alarms" rests on only 4 entries that belong to Jordan. On a real account, the person's own phone, recovery
number, authenticator app and Kindle are listed too, by design, for the person to mark "Not mine": Spare Key cannot tell
whose phone is whose, so it shows them rather than guess.

What this does not show: the builder wrote the practice pages and tuned the readers on them, so this proves the whole
system works end to end, not how well it reads real pages. The planted-access test on real test accounts (25 paths,
10 controls, three modes, three runs each) has not been run yet: it needs the test accounts (`docs/test-accounts.md`).

What Gemini Nano changed: on its first run it marked an "Active now" phone as "this computer" (which would have hidden
it), gave a "Sign in with Google" app full access, and dated a device the page gave no date for. The rules now let code
win where the page's own words decide (TECHNICAL-DESIGN.md section 6.4), and both modes find 24 of 24.

## 2. Layout drift (EVALUATION.md section 2)

Not run yet: it needs the real pages' snapshots.

## 3. Privacy: nothing that names a person leaves (EVALUATION.md section 3)

`tools/privacy-test.mjs`, last run November 22, 2026: a full practice check with every cloud step on (the cloud plan
with function calling, the two voices, every situation answer shared, two findings answered, and the setup probe). Every
network request from the extension's service worker, hidden page and side panel was captured through the Chrome
DevTools Protocol, with its URL, headers and body, and searched for 30 made-up names, emails, phone numbers, devices,
places and filter words from the practice pages (the list is in `tools/privacy-test.mjs`), plain, URL-encoded, base64 and
JSON-escaped.

| Result | |
|---|---|
| Requests from the extension | 17, to 6 hosts (Firebase AI Logic, App Check, Remote Config, Installations, Firestore, and the extension itself) |
| Requests holding a name, email, phone number, device or place | **0 of 17** |
| Requests to the model | 6 |
| Model requests that match "What left this computer" word for word | **6 of 6**, and all 6 logged entries were sent |

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

Fixes the safety rules made to the model's plan (R3 not counted):

| | R1 finding missing | R6 promise or banned word | R8 not-checked step | Total |
|---|---|---|---|---|
| C. Cloud plan | 0 | 38 | 4 | 42 |
| D. With two voices | 5 | 12 | 0 | 17 |

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
- The two voices cut the fixes from 42 to 17, and cut "change now" steps from 27 to 15 (more waits). They also dropped
  a finding 5 times, which rule R1 put back.
- What a person sees (E) passes every measure by construction: the rules enforce it whatever the model writes.
- 10 of 40 situations failed in the cloud, a quarter of the run. On the free tier, the plan made by code on the
  computer is what a person sees when the cloud does not answer, and it passes every measure.

**How it was measured, and its limits:** the structured plans (B to E) are read step by step by code. The plain
chatbot's free-text answers are read with fixed keyword lists, which is rough: a warning word anywhere in a long answer
counts as a warning, and "screenshot first" is judged by where the first such word falls. The optional AI-graded second
check for A was not run, to stay within the agreed number of calls. The question to the chatbot says "my ex" and "he",
like the study's real-world questions.

## 5. Speed and readability (EVALUATION.md section 5)

Speed: see section 1. On this PC, loading Gemini Nano the first time took 104 to 133 s; after that, each check took 4 to
19 s with Nano and about 1 s with code only. The PC had little free memory during these runs, so these are slow numbers.

Reading level: every string the side panel shows (257 strings from the panel code, the "i" sheets and the steps
library) was scored with the Flesch-Kincaid grade formula on November 22. Median grade 4.3. 5 of 257 score between
grade 8 and 9.1. They are short steps that name a menu, such as "Open Gmail settings, then Forwarding and POP/IMAP.",
where the formula counts the menu's name as hard words.

## 6. Steps freshness (TECHNICAL-DESIGN.md section 9.3)

The URL context tool could not fetch Google's or Amazon's help pages (`URL_RETRIEVAL_STATUS_ERROR`); it did read the
Safety Net page. With the help page's text fetched on the computer instead, Gmail's forwarding steps were confirmed
current. Amazon's page could not be read either way, and the check says "not sure".
