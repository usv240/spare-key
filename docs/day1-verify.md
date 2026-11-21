# Day 1: items marked "Verify"

Checked on November 21, 2026, before any code depends on them. Each row says what was checked, how, and the result.
Items that need a signed-in test account are marked **Open** until the test accounts exist.

## Firebase and cost

| Item | How it was checked | Result |
|---|---|---|
| New project on the free Spark plan | `projects:create spare-key-app`; Cloud Billing API `billingInfo` | Done. `billingEnabled: false`, no billing account linked |
| Firebase AI Logic provisioned with the Gemini Developer API | Same call `init ailogic` makes (`firebase:provisionFirebaseApp` with `firebaseAiLogicInput`) | Done. `firebasevertexai` and `generativelanguage` APIs on |
| `firebase` 13.3.0 exports `getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode` | Imported the installed package in Node | All four present. `InferenceMode` has `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`, `PREFER_IN_CLOUD` |
| Free-tier models | Firebase AI Logic models page and Gemini API pricing page | `gemini-3.5-flash-lite` and `gemini-3.8-flash` are both stable, with "Free of charge" input and output on the free tier. Free-tier prompts may be used to improve Google's products (the privacy page must say so; Spare Key sends codes only) |
| Free-tier rate limits | Gemini API rate limits page | Limits are per project and shown per account in AI Studio, not on the page. Requests per day reset at midnight Pacific. Plan for few calls: one at a time, `max_cloud_calls` 12 per scan |
| reCAPTCHA Enterprise on Spark | Enabled the API and created a score key on the Spark project | Works with no billing account. Site key `6LcA6SouAAAAAC0dXkvRkUvbFIbuZYL3QaOt1x0N` for `spare-key-app.web.app`, `spare-key-app.firebaseapp.com` and `localhost` |
| App Check enforced on Firebase AI Logic | App Check API, service `firebaseml.googleapis.com` (the name AI Logic uses in App Check) | `ENFORCED` |
| Google Search grounding on the free tier | Gemini API pricing page, both models | **Not available on the free tier** (paid tier only). So the freshness check cannot use it at $0. Changed: the freshness check uses the **URL context** tool instead, which is free, reading the official help page the steps library already cites. `firebase` 13.3.0 has `URLContextTool`. Remote Config key renamed `grounding_on` to `freshness_on` |

## Settings pages (signed out)

A Google Account path that does not exist answers 404; a real one answers with a sign-in redirect. Amazon behaves the
same way. That shows each page exists. What each page looks like when signed in is checked on day 2.

| Check | URL | Result |
|---|---|---|
| Signed-in devices | `https://myaccount.google.com/device-activity` | Exists |
| Third-party apps | `https://myaccount.google.com/connections` | Exists |
| Recovery phone | `https://myaccount.google.com/signinoptions/rescuephone` | Exists (`/recovery/phone` is 404) |
| Recovery email | `https://myaccount.google.com/recovery/email` | Exists |
| 2-Step Verification | `https://myaccount.google.com/signinoptions/twosv` | Exists |
| Location sharing | `https://myaccount.google.com/locationsharing` | **Changed from the plan.** Exists in Google Account. The Maps paths tried (`google.com/maps/locationsharing`, `maps.google.com/locationsharing`) are 404. This also means one fewer site permission |
| Family group | `https://myaccount.google.com/family/details` | Exists |
| Photos partner sharing | `https://photos.google.com/settings` | Exists |
| Amazon Household | `https://www.amazon.com/hz/profilepicker/amazonfamily/members` | **Changed from the plan.** Amazon renamed Household to "Amazon Family": `/myh/households` now redirects to a sign-up page and `/myh/manage` to this members page |
| Amazon devices | `https://www.amazon.com/hz/mycd/digital-console/devicelist` | Exists |
| Gmail forwarding, filters, delegates | `https://mail.google.com/mail/u/{u}/#settings/fwdandpop`, `#settings/filters`, `#settings/accounts` | Open: routes after `#` cannot be tested signed out |
| Every page's signed-in structure (wait condition, selectors) | Needs the test accounts | **Open** |

## Help and fonts

| Item | How it was checked | Result |
|---|---|---|
| Hotline | thehotline.org home page | Call 1.800.799.7233; text "START" to 88788; thehotline.org. Matches the plan |
| Atkinson Hyperlegible Next and Mono on Google Fonts | Google Fonts CSS API | Both answer 200 |

## Checked by running the extension (`tools/day1-check.mjs`, Chrome 158, November 21, 2026)

| Item | Result |
|---|---|
| The side panel opens; the safety screen comes first with the hotline; Quick exit is the first control | Pass |
| `chrome.sidePanel.close` in Chrome 158 | Exists. Quick exit closes the panel from the service worker, with `window.close()` as a fallback |
| Remote Config reaches the extension | Pass: values come from Remote Config (`from: remote`), template version 1 |
| A cloud prompt answers (`ONLY_IN_CLOUD`, `GoogleAIBackend`, App Check enforced, development debug token) | Pass: `gemini-3.5-flash-lite` answered in 1.3 to 1.5 s. Limited-use App Check tokens were not needed |
| A device-only prompt answers (`ONLY_ON_DEVICE`, Gemini Nano) | Pass, in the test profile on E: (`tools/nano-profile.mjs`). First answer 12.6 s, which includes loading the model. Chrome reports "downloading" for up to about 2 minutes after it starts, while it registers an installed model; the panel must not call that "not supported" |
| `LanguageModel.params()` | Returns an empty object in Chrome 158, so it gives no limits. Use the session instead |
| Input quota for 3,500 characters | Session `inputQuota` is 9,216 tokens; 3,500 characters of settings-like text measured 913 tokens. The 3,500-character chunk of section 6.2 fits with room for the prompt and schema |
| Every cloud request is in "What left this computer", word for word | Pass: the one request was `{"probe":"ready"}` |
| Quick exit clears the session, leaves the page and closes the panel | Pass. Google sometimes answers an automated browser with its "unusual traffic" page, which still carries the weather search |
| The Alt+Shift+X shortcut | **Not assigned** in the test profiles (Chrome shows no shortcut for `quick-exit`). Chrome can leave a suggested shortcut unassigned, so the panel now reads the shortcut Chrome really assigned and names only that; Escape twice always works. Check again with a normal "Load unpacked" install |

## Still open

| Item | When |
|---|---|
| Every settings page's signed-in structure (needs the test accounts) | Day 2 |
| The Cornell CETA and NNEDV order of steps | Day 4 |
| The extension's App Check bridge path in a release build (needs the site deployed) | Day 1, after deploy |
