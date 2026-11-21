# Spare Key: technical design

Anything marked **Verify** is a fact to confirm on day 1 against the live page, the SDK or the docs, before code
depends on it.

## 1. Architecture

```
                 the user's computer                                    |  the cloud
                                                                        |
  settings pages (Google, Gmail, Maps, Amazon)                          |
        |  read only, in one scan tab                                   |
        v                                                               |
  readers (code)  ---> raw entries ---> Gemini Nano: classify           |
        |                 |              (ONLY_ON_DEVICE, no fallback)   |
        |                 +---> Gemini Nano: read the page itself       |
        |                       when a reader finds nothing             |
        v                                                               |
  findings (names, emails, devices: stay here, session storage only)    |
        |                                                               |
        +--> toCloud(): codes and enums only ---------------------------+--> Gemini (ONLY_IN_CLOUD)
        |       every request also written to "What left this computer" |     plan + function calls
        |                                                               |     two-voice check
        |   <-- ask_device / ask_user / get_steps (answered here) ------+     freshness (URL context)    
        v                                                               |
  plan engine (code): safety rules always applied                       |   Firestore: steps library (public)
        |                                                               |   Remote Config: readers, models, switches
        v                                                               |   App Check: guards every cloud call
  side panel: results, "Not checked", plan, print or locked file        |   Hosting: site, practice pages, Steps API
```

The one rule the code must make impossible to break: **`toCloud()` in `shared/cloud-safe.js` is the only function
whose output may be sent off the computer.** It builds a new object from an allow-list of keys and enum values, and
throws on anything else. Every cloud module imports only that function's output type. A unit test feeds it findings
full of names, emails and phone numbers and asserts that none of those strings appear in the output.

## 2. Repository layout

```
spare-key/
  LICENSE                      Apache-2.0
  README.md                    what it is, judge's tour, install, build, test
  firebase.json                Hosting, headers (CORS for /api), Firestore rules path
  firestore.rules
  remoteconfig.template.json   every Remote Config key with its default
  shared/                      used by the extension, the site, the API build and the MCP server
    findings.js                finding codes, groups, schema
    cloud-safe.js              toCloud(): the only exit to the cloud
    plan/engine.js             the plan built by code from findings and the steps library
    plan/invariants.js         the safety rules applied to every plan, from code or the cloud
    steps-schema.js            validation for steps.json
  data/steps.json              the steps library, one entry per finding code
  extension/
    manifest.json
    src/
      background.js            service worker: scan control, permissions, quick exit, commands
      offscreen.html, .js      hosts Gemini Nano sessions and the App Check bridge frame
      panel.html, .js          side panel UI
      ai.js                    Firebase AI Logic wrapper (from Still Recalled, backend changed)
      scan/engine.js           opens each page in the scan tab, runs its reader, collects results
      scan/catalogue.js        services and checks; defaults here, overrides from Remote Config
      readers/*.js             one reader per check: google-devices, google-apps, google-recovery,
                               google-2sv, gmail-forwarding, gmail-filters, gmail-delegates,
                               maps-sharing, amazon-household, amazon-devices, google-family,
                               photos-sharing
      chrome-checks.js         extensions with broad access; which account Chrome syncs to
      classify.js              Gemini Nano prompts: classify entries, read a page, read a screenshot
      cloud/plan.js            the cloud plan with function calling
      cloud/voices.js          the two-voice check
      cloud/freshness.js       steps freshness with the URL context tool
      sentlog.js               "What left this computer"
      lockedfile.js            password-locked export and import
      quickexit.js
  web/                         Firebase Hosting site (Vite, plain HTML, CSS and JS; no framework needed)
    index.html                 landing page
    how-it-works.html, built-with.html, try.html, plant.html, api.html, accuracy.html,
    privacy.html, safety.html, developers.html, appcheck-bridge.html
    practice/                  made-up settings pages for the practice scan (see section 13)
    src/
  api/build.mjs                writes the static Steps API into web/dist/api/v1 at deploy
  mcp/                         MCP server package for advocates' and developers' AI tools
  tools/                       evaluation scripts, fixture builder, end-to-end tests
  tests/                       node --test unit tests
```

Build: esbuild for the extension (one bundle per entry point, like Still Recalled), and Vite for the site. Pin the
`firebase` package to the version Still Recalled uses (13.3.0) unless a newer one is needed. **Verify** that version's
export names: `getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`.

## 3. Firebase project and cost

- **New project** (for example `spare-key-app`) on the **Spark (free) plan**. No billing account linked. On Spark, a
  bug cannot cost money; quota errors are the worst case.
- **Firebase AI Logic with the Gemini Developer API** (`new GoogleAIBackend()`). Free tier. **Verify** in the console
  which models the free tier allows and their per-minute limits. Default model list in Remote Config:
  `gemini-3.5-flash-lite,gemini-3.8-flash`.
- **Free-tier data use:** on the free tier, Google may use prompts to improve its products. Spare Key sends only codes
  and enums, so this is acceptable, and the privacy page says so plainly.
- **App Check** with the reCAPTCHA v3 provider, which needs no billing. **Verify** whether reCAPTCHA Enterprise works on
  Spark; if it does, either is fine. Enforce App Check on Firebase AI Logic and Firestore.
- **Cloud call budget:** one call at a time through a single queue; at most `max_cloud_calls` (Remote Config, default
  12) per scan; one retry on 429 or 503, then the code plan with a plain message. Plans are cached in session storage
  by a hash of their codes and enums.
- **Keyed API** (section 12) is the only thing that needs the Blaze plan. It is optional; build it only if everything
  else is done, and set a $5 budget alert first.

## 4. The extension

### Manifest (Manifest V3)

```jsonc
{
  "manifest_version": 3,
  "name": "Spare Key",
  "description": "Find out who still has a key to your accounts. Read-only. Names never leave your computer.",
  "action": { "default_title": "Spare Key" },
  "side_panel": { "default_path": "src/panel.html" },
  "background": { "service_worker": "background.js", "type": "module" },
  "permissions": ["sidePanel", "storage", "scripting", "offscreen"],
  "optional_permissions": ["management", "identity", "identity.email", "history"],
  "optional_host_permissions": [
    "https://myaccount.google.com/*", "https://mail.google.com/*",
    "https://photos.google.com/*", "https://www.amazon.com/*"
  ],
  "host_permissions": ["https://<site>.web.app/practice/*"],
  "commands": { "quick-exit": { "suggested_key": { "default": "Alt+Shift+X" }, "description": "Quick exit" } }
}
```

- Host access is requested at scan time with `chrome.permissions.request`, inside the click on "Start the check", for
  only the services the user ticked. The Chrome permission prompt then names exactly those sites.
- `management` (extensions check), `identity` and `identity.email` (sync account check) and `history` (cleanup) are
  asked for only when the user turns those options on. Each one has an "i" button explaining Chrome's warning text.
- The icon is a plain key, with no shield, no heart and no purple. The toolbar never shows a badge or a count.

### Contexts

| Context | Job |
|---|---|
| Service worker (`background.js`) | Scan control, permission requests, tab handling, the quick-exit command, session storage |
| Offscreen document | Gemini Nano sessions (`LanguageModel` needs a document), the App Check bridge frame, all Firebase calls |
| Side panel | The whole UI. It stays open across tabs, so it can show progress while the scan tab moves between pages |
| Injected reader (`chrome.scripting.executeScript`) | Runs in the scan tab, waits for the page, returns raw entries and a trimmed copy of the main text |

No persistent content scripts on real sites. Readers are injected only into the scan tab, only during a scan.

## 5. The scan engine

```
startScan(selectedChecks, mode = 'real' | 'practice'):
  open one scan tab (active, so single-page apps render fully; the side panel stays visible beside it)
  for each check in order:
    navigate the scan tab to check.url (or check.practiceUrl)
    wait for 'complete', then inject the check's reader
    the reader waits up to check.timeoutMs (default 15 s) for check.waitFor (a selector or a text pattern)
    outcome:
      signed out (URL matches check.signedOutPattern, for example accounts.google.com/v3/signin)
        -> "Not checked: you are not signed in to <service> in this browser"
      wait timed out, or the page shows an error  -> "Not checked: the page did not load"
      reader returned entries                      -> classify with Nano (section 6)
      reader returned none, page loaded            -> Nano reads the page text (section 6),
                                                      then classify; marked "found by reading the page"
      Nano not available and reader found none     -> "Checked by code only: nothing listed" (never "none")
  close the scan tab; record every URL it visited (for the optional history cleanup)
  run the Chrome checks (section 7)
  build findings; show results; build the plan (section 8)
```

- Each check records how it was read: `reader`, `nano`, `both` or `not_checked`, with the reason.
- **Google accounts:** the scan checks the account at `authuser=0` by default; a picker lets the user pick account 1,
  2 or 3. The checked account's email is shown in the panel and never leaves the computer.
- The progress line uses plain words from the catalogue, for example "Checking which devices are signed in to your
  Google account."
- The scan never scrolls, clicks, types or submits. If a list needs a click to expand ("Show all devices"), the reader
  reports "partly checked: N shown, more may be hidden", and the item says how to see the rest.

### The catalogue (defaults in code, overrides from Remote Config)

```jsonc
{
  "id": "google.devices",
  "service": "google",
  "label": "Devices signed in to your Google account",
  "progress": "Checking which devices are signed in to your Google account",
  "url": "https://myaccount.google.com/device-activity?authuser={u}",   // Verify
  "practiceUrl": "/practice/google/device-activity.html",
  "signedOutPattern": "accounts\\.google\\.com/.*/signin",
  "waitFor": { "selector": "main", "text": "(device|signed in)" },        // Verify the real markers
  "timeoutMs": 15000,
  "reader": "google-devices",
  "selectors": { "item": "...", "name": "...", "detail": "..." },        // reader defaults, overridable
  "enabled": true,
  "minVersion": "1.0.0"
}
```

Remote Config holds the catalogue as one JSON string (`catalogue`). When Google changes a page, the fix is a Remote
Config publish, which reaches every install within about an hour, with no store update. This is the creative use of
Remote Config to name in the write-up: the readers themselves are remotely configurable.

### URLs to confirm on day 1 (Verify every one)

| Check | Likely page |
|---|---|
| Signed-in devices | `https://myaccount.google.com/device-activity` |
| Third-party apps | `https://myaccount.google.com/connections` |
| Recovery phone and email | `https://myaccount.google.com/signinoptions/rescuephone` and `https://myaccount.google.com/recovery/email` (checked) |
| 2-Step Verification | `https://myaccount.google.com/signinoptions/twosv` |
| Gmail forwarding | `https://mail.google.com/mail/u/{u}/#settings/fwdandpop` |
| Gmail filters | `https://mail.google.com/mail/u/{u}/#settings/filters` |
| Gmail delegates | `https://mail.google.com/mail/u/{u}/#settings/accounts` |
| Maps location sharing | `https://myaccount.google.com/locationsharing` (checked: the Google Account page; the Maps paths are 404) |
| Google family group | `https://myaccount.google.com/family/details` |
| Photos partner sharing | `https://photos.google.com/settings` |
| Amazon Household | `https://www.amazon.com/myh/households` (checked: now redirects; Amazon renamed it Amazon Family, see docs/day1-verify.md) |
| Amazon devices | `https://www.amazon.com/hz/mycd/digital-console/devicelist` |

## 6. Gemini Nano on the device

All three prompts use `deviceModel()` (`ONLY_ON_DEVICE`) from `ai.js`, with a JSON Schema in `responseConstraint`.
Check `LanguageModel.availability()` at startup and show it on the first screen: "Gemini Nano is ready on this computer"
or "Not available: Spare Key will read pages with code only, and will tell you where that is less complete."

**There is no cloud fallback for these three, on purpose.** The page text is the private data. With Nano missing, the
readers run alone.

### 6.1 Classify entries

Input: the check's id and plain description, the checked account's own email and name (local), and the raw entries
the reader found (`[{ i, text }]`, each entry's visible text, trimmed to 300 characters).

```js
const CLASSIFY_SYSTEM = `You sort entries from a person's own account settings page.
For each entry, say what it is, whether it is the account owner's own, and what it gives access to.
Use only what the entry says. If the entry does not say, answer "unknown". Never guess a person's identity.`;

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: {
      i: { type: 'integer' },
      kind: { enum: ['person', 'device', 'app', 'email_address', 'phone_number', 'share_link', 'unknown'] },
      is_owner: { enum: ['yes', 'no', 'unknown'] },
      access: { type: 'array', items: { enum: ['location', 'mail', 'account', 'purchases', 'addresses',
        'photos', 'cameras', 'browsing', 'messages', 'unknown'] } },
      recency: { enum: ['now', 'today', 'this_week', 'this_month', 'older', 'unknown'] },
      this_computer: { enum: ['yes', 'no', 'unknown'] }
    }, required: ['i', 'kind', 'is_owner', 'access', 'recency', 'this_computer'] } }
  },
  required: ['items']
};
```

Code then maps each item to a finding code with rules per check (for example, in `gmail.forwarding` any
`email_address` with `is_owner` not `yes` becomes `gmail.forwarding.external`). Nano never picks the code; it only
fills enums the rules read.

### 6.2 Read the page when the reader finds nothing

When a page loaded but the reader returned no entries (likely a layout change), Nano gets the main text in chunks of at
most 3,500 characters (**Verify** the input quota with `LanguageModel.params()` and `session.measureInputUsage`):

```js
const READ_PAGE_SYSTEM = `This is the text of one settings page from the person's own account.
List every entry the page shows for: {check description}. Copy each entry's words exactly.
If the page shows none, return an empty list.`;
// schema: { entries: [{ text: string (max 300) }] }
```

The entries then go through 6.1. Findings from this path are marked "Found by reading the page. Check it in the
setting." Every time this path runs, the extension can offer (opt-in, off by default) an anonymous layout report
(section 11) so the reader can be fixed.

### 6.3 Read a screenshot (Could)

The user drops a screenshot of a phone app's sharing screen (Life360 circle, Find My, a carrier's family locator). Nano
gets the image and returns `{ entries: [{ text, kind, access }] }`. The image never leaves the computer and is dropped
from memory after reading. Without Nano the button says "Needs Gemini Nano on this computer, because a screenshot can
show names" and stays off.

### 6.4 How code and Nano combine

- Reader entries are trusted as existing; Nano adds the classification.
- Nano-only entries (6.2) are shown with lower confidence and an instruction to check the setting itself.
- If Nano and a reader rule disagree on ownership, the item shows "Not sure" and asks the user.
- The user's own answer ("Mine", "Not mine", "Not sure") always wins and is stored only in session storage.

## 7. Chrome checks (no page reading, no model)

- **Extensions with broad access** (`chrome.management.getAll`, optional permission). Flag enabled extensions with
  `<all_urls>` or many host permissions combined with `history`, `tabs`, `cookies`, `webRequest`, `desktopCapture`,
  `proxy` or `debugger`, and any with `installType: 'admin'` (installed by whoever manages this browser). Show the name,
  what it can do in plain words, and "Open Chrome's extensions page". Code only; nothing is sent.
- **Which account Chrome syncs to** (`chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })`, optional
  permissions). If the Chrome profile is signed in to an email that is not the account being checked, flag
  `chrome.sync.other_account`: "This browser may be sending your history and passwords to another account." The
  comparison happens locally.

## 8. Findings and the plan built by code

### Finding (local only)

```js
{
  ref: 'f3',                       // local id
  code: 'gmail.forwarding.external',
  check: 'gmail.forwarding',
  group: 'mail',                   // location | mail | account | purchases | devices | browsing | photos
  label: 'Forwards all mail to j••••@gmail.com',   // local; shown masked by default, tap to reveal
  detail: '...',                   // local
  howFound: 'reader' | 'nano' | 'both',
  confidence: 'high' | 'check_it',
  recency: 'today',
  ownership: null | 'mine' | 'not_mine' | 'unsure',
  openUrl: 'https://mail.google.com/mail/u/0/#settings/fwdandpop'
}
```

Labels mask addresses and phone numbers by default (`j••••@gmail.com`), with "Show" to reveal. Someone looking over the
user's shoulder sees less, and screenshots for the video are safe.

### Cloud-safe projection (`shared/cloud-safe.js`)

```js
// Only these keys, only these values. Anything else throws.
export function toCloud(findings, situation) {
  return {
    findings: findings.map((f, n) => ({
      ref: `f${n + 1}`,                       // renumbered, carries nothing
      code: assertCode(f.code),               // must exist in findings.js
      ownership: assertEnum(f.ownership ?? 'unsure', OWNERSHIP),
      recency: assertEnum(f.recency ?? 'unknown', RECENCY),
      how_found: assertEnum(f.howFound, HOW_FOUND),
    })),
    situation: pickEnums(situation, SITUATION),   // only the answers the user chose to share
    not_checked: notCheckedCodes(),               // check ids, not reasons that could hold text
  };
}
```

### Situation questions (optional, each one shared only if the user ticks "use this to order my plan")

| Key | Values |
|---|---|
| `living` | `together`, `apart`, `prefer_not_to_say` |
| `safe_to_change_now` | `yes`, `no`, `not_sure` |
| `children_shared` | `yes`, `no`, `prefer_not_to_say` |
| `has_advocate` | `yes`, `no`, `prefer_not_to_say` |

The default for every question is the most cautious value.

### Steps library entry (`data/steps.json`; also in Firestore `steps/{code}`)

```jsonc
{
  "code": "gmail.forwarding.external",
  "title": "Your mail is being copied to another address",
  "what_it_means": "Every new email you get is also sent to this address. Whoever reads it sees your mail.",
  "who_can_notice": "noticeable",            // notifies | noticeable | unlikely | unknown
  "notice_why": "Their copies stop arriving. They may notice within a day.",
  "evidence_first": ["Screenshot this settings page, including the address."],
  "steps": ["Open Gmail settings, then Forwarding and POP/IMAP.", "Choose Disable forwarding.", "Save Changes."],
  "if_not_safe_yet": "Leave it for now. Tell an advocate it is there. Use a new email account they do not know about for private messages.",
  "also_check": ["gmail.filter.forwards"],
  "sources": [{ "title": "Gmail Help: Automatically forward Gmail messages", "url": "https://support.google.com/mail/answer/10957" }],
  "verified_at": "2026-11-22",
  "verified_how": "builder followed the steps on a test account",
  "version": 1
}
```

- `who_can_notice` is `unknown` unless the builder observed it on the test accounts or an official source says so.
  `unknown` is treated exactly like `noticeable`.
- The builder writes and verifies every entry by following the steps on the test accounts (day 4). Each entry's
  sources are official help pages or the Cornell CETA and NNEDV Safety Net guides.

### Plan engine (`shared/plan/engine.js`, pure code, no model)

Ordered actions:

1. `document`: screenshot every `not_mine` and `unsure` finding first (one step listing them all).
2. `talk_to_advocate`: always present, with the hotline, before any change that `who_can_notice` is not `unlikely`.
3. `change_now`: account takeover paths whose change is `unlikely` to be noticed (delegates, filters that hide mail,
   unknown third-party apps with full access, a recovery email that is not the user's), only when
   `safe_to_change_now` is `yes`.
4. `wait`: every change that is `notifies`, `noticeable` or `unknown`, with `if_not_safe_yet`, unless
   `safe_to_change_now` is `yes`, in which case it becomes `change_now` with the warning attached.
5. `check_manually`: every service in "Not checked", with its trusted guide.

**Verify** this order against the Cornell CETA and NNEDV Safety Net guidance on day 4, and cite them on the
How it works page.

### Safety rules (`shared/plan/invariants.js`), applied to every plan from code or the cloud

| Rule | Enforcement |
|---|---|
| R1. Every `not_mine` and `unsure` finding appears in the plan | Missing ones are added as `wait` |
| R2. A `document` step comes before any change | Inserted first if missing |
| R3. A change to anything not `unlikely` to be noticed carries the library's warning text | Inserted by code, whatever the model wrote |
| R4. If `safe_to_change_now` is not `yes`, noticeable changes become `wait` | Rewritten by code; the user can override per step, with the warning shown again |
| R5. The advocate step is always present | Inserted if missing |
| R6. Model text never says "safe", "secure", "all clear", "nothing to worry", "you're fine" | Sentence removed; regex list in code |
| R7. Model text never contains an email, phone number or URL not in the library | Removed |
| R8. "Not checked" items always appear | Added as `check_manually` |

Each rule that changed a plan is recorded, and the panel can show "Spare Key added this warning" under "Why this
order". The evaluation counts how often each rule had to fire for the cloud plan, with and without the two-voice check.

## 9. The cloud

All cloud calls use `cloudJson()` (`ONLY_IN_CLOUD`), temperature 0, through the single queue, and every request body is
appended to the sent log before it is sent.

### 9.1 Cloud plan with function calling (`cloud/plan.js`)

System prompt, in outline:

```
You help a person decide the order in which to deal with access other people have to their accounts.
You see only finding codes and the person's chosen answers, never names or details.
Rules you must follow: document before changing anything; warn whenever a change may be noticed;
when it may not be safe to change things yet, say to wait and to talk to an advocate; never call anything safe.
Use get_steps to read the verified steps for a code. Use ask_device to learn a yes/no fact about a finding.
Use ask_user only when the answer would change the order, at most two times.
Return the plan as JSON that follows the schema.
```

Functions declared to the model (answered on the device):

```js
get_steps({ code })                          // returns the library entry (public text)
ask_device({ ref, question })                // question is an enum; answer is 'yes' | 'no' | 'unknown'
  // question enum: 'filter_also_deletes', 'forwarding_is_only_copy', 'device_active_this_week',
  //   'app_can_read_mail', 'app_can_see_location', 'more_items_hidden', 'shared_with_link'
ask_user({ ref, question })                  // question is an enum; the side panel shows it with buttons
  // question enum: 'recognise_this', 'set_up_by_you', 'still_need_this', 'they_know_you_use_this'
  // answer: 'yes' | 'no' | 'not_sure'
```

`ask_user` pauses the call and shows the question in the panel ("Did you set this up yourself?") with three buttons and
"Skip". The answer returned to the model is only the enum. Cap: three rounds of calls, as in Still Recalled's
`askWithTool`.

Answer schema:

```js
{ actions: [{ ref: string | null, action: 'document' | 'talk_to_advocate' | 'change_now' | 'wait' | 'check_manually',
              why: string (max 160) }],
  summary: string (max 240) }
```

Code renders every action with the library's own text (title, steps, warning). The model's words appear only in "why"
and "summary", after rules R6 and R7.

### 9.2 The two-voice check (`cloud/voices.js`)

Three calls after the draft plan, each seeing only the codes, the enums and the draft:

| Voice | Instruction |
|---|---|
| **Close the doors** | Argue which items should be changed soon and why: what the other person can do while each stays open. |
| **Stay hidden** | Argue which changes could be noticed, what could happen if the person notices, and what to screenshot or delay. |
| **Settle** | Read the draft and both arguments. Return a revised plan (same schema) and two short lines summarising each voice. |

The panel shows the result under "Why this order": two short paragraphs, one per voice, and the settled plan. Then the
safety rules run on the settled plan. A Remote Config switch (`two_voice_on`) turns it off; the evaluation compares the
two.

This answers a measured failure: single models "frequently failed to warn that making changes could alert an abuser."
One voice exists only to make that argument.

### 9.3 Freshness check with the URL context tool (`cloud/freshness.js`)

**Changed on day 1:** Google Search grounding is "Not available" on the Gemini Developer API free tier (pricing page,
November 21, 2026), so it would break the $0 rule. The URL context tool is free on the free tier and `firebase` 13.3.0
has `URLContextTool`, so the check reads the official help page the library already cites instead of searching. The
Remote Config switch is `freshness_on`. The original text follows; read "URL context" wherever it says Search.

For any library entry older than `fresh_days` (Remote Config, default 45), the plan offers "Check these steps are still
current". The cloud gets the finding code and the official help page's title and URL from the library, uses the Google
Search tool, and returns `{ still_matches: 'yes' | 'no' | 'not_sure', what_changed: string, sources: [url] }`.

- The result is shown beside the library steps ("Google's help page may have changed. Here is what it says today"),
  never instead of them.
- **Verify** that Firebase AI Logic's web SDK supports the Google Search tool with `GoogleAIBackend`, and that it can't
  be combined with function declarations in one request (keep it a separate call either way).
- **Verify** the display rules for grounded results: Google requires showing the Search suggestions it returns. Render
  them as the docs require.

## 10. "What left this computer" (`sentlog.js`)

- Every cloud request is appended, before it is sent, as `{ time, purpose, model, body }`, where `body` is the exact
  JSON sent (the `toCloud` output and the prompt name, not the system prompt text).
- The panel has a tab that shows the log live during the scan, with an "i" button: "This is everything Spare Key sent
  to Gemini in the cloud, word for word. Names and emails are never in it."
- The site's practice scan shows the same log.
- The log lives in session storage and is cleared with everything else.

## 11. Firestore, Authentication and Remote Config

### Firestore

| Collection | Who | Content |
|---|---|---|
| `steps/{code}` | Public read; no client writes | The steps library, mirrored from `data/steps.json` at deploy by an admin script |
| `meta/library` | Public read | `{ version, updated_at }`; the extension refreshes its bundled copy when this is newer |
| `layout_reports/{auto}` | Create only, no reads | Opt-in, anonymous: `{ check, reader_version, reason, ext_version, day }`, enums only, validated by the rules. No page text, no URL, no time finer than a day |
| `api_keys/{sha256}` | Owner read; created by the keyed API only | Only if the keyed API is built (section 12) |

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /steps/{code} { allow read: if true; allow write: if false; }
    match /meta/{doc} { allow read: if true; allow write: if false; }
    match /layout_reports/{id} {
      allow read, update, delete: if false;
      allow create: if request.resource.data.keys().hasOnly(['check','reader_version','reason','ext_version','day'])
        && request.resource.data.reason in ['no_entries','timeout','unexpected_layout']
        && request.resource.data.check is string && request.resource.data.check.size() < 40;
    }
  }
}
```

App Check is enforced on Firestore too.

### Authentication

Only on the `developers.html` page (Google sign-in) to request a key for the keyed API, and only if that API is built.
**Survivors never sign in, and the extension has no sign-in at all.** Say this on the How it's built page, because a
judge will look for Authentication and should see why it is kept away from the survivor.

### Remote Config keys

| Key | Default | Purpose |
|---|---|---|
| `catalogue` | the bundled catalogue | URLs, wait conditions and selectors for every check; the layout fix path |
| `cloud_models` | `gemini-3.5-flash-lite,gemini-3.8-flash` | Order to try cloud models |
| `cloud_on` | `true` | Turns every cloud step off for all installs (the product still works) |
| `two_voice_on` | `true` | The two-voice check |
| `freshness_on` | `true` | The freshness check (URL context tool; Search grounding is not free) |
| `max_cloud_calls` | `12` | Per scan |
| `fresh_days` | `45` | When a library entry counts as stale |
| `quick_exit_url` | `https://www.google.com/search?q=weather` | Where Quick exit goes |
| `hotline` | `{ "call": "1-800-799-7233", "text": "Text START to 88788", "web": "https://www.thehotline.org" }` | **Verify** before release |

## 12. Steps API and MCP server

### Static Steps API (build this; it costs nothing)

Generated at deploy by `api/build.mjs` from `data/steps.json` and served by Hosting with open CORS:

```
GET /api/v1/index.json              every finding code with title, group, who_can_notice, version
GET /api/v1/steps/{code}.json       one library entry
GET /api/v1/plan-rules.json         the plan order and safety rules as data
```

It takes no input, so it cannot receive personal data, and a static file cannot run up a bill. Also publish
`shared/plan` as a small npm package (`spare-key-plan`), so a hotline app can build the same plan locally from codes.

### MCP server (`mcp/`)

A Node MCP server with three tools: `list_findings`, `get_steps(code)` and `make_plan(codes, situation)`. It uses the
static API and the plan package. Point: an advocate's AI assistant that calls these tools gives current steps with the
warnings attached, which is the exact gap the NYU study found in chatbots. Document it on `api.html` with a copy-paste
config for Claude Code, Codex and Antigravity.

### Keyed API (optional; Blaze plan, $5 budget alert first)

`POST /api/v1/plan` (Cloud Functions, 2nd gen), header `x-api-key`, body `{ codes: [...], situation: {...} }`, both
validated against the same enums; returns the code-built plan. No model call, so a key holder cannot spend Gemini
quota. Keys come from `developers.html` after Google sign-in, are shown once, stored as SHA-256 hashes, and limited to
1,000 calls a day. Build this only if every Must and Should item is done; otherwise the API page explains that the
static API needs no key.

## 13. Practice scan and "plant a test key"

### Practice pages

`web/practice/` holds one HTML page per check that copies the real page's structure (built from the builder's saved
snapshots, every name, email, phone number, device and address replaced with made-up ones for a person called Jordan).

- The extension's "Practice" button scans these pages instead of the real ones, through the same engine, readers and
  Nano. A judge sees the full flow, with nothing of theirs involved.
- `try.html` runs the same practice scan inside the website, for browsers without the extension and for phones. There
  it uses `hybridModel()` (`PREFER_ON_DEVICE`), because the data is made up: Nano where available, the cloud
  otherwise, with the result labelled "Ran on this device" or "Ran in the cloud (practice data only)". This is the
  honest place for hybrid fallback.
- The practice pages carry a banner "Practice page. Made-up data" and `noindex`.

### Plant a test key (`plant.html`)

Three ways for a judge to plant a harmless access path in their own account, each with exact steps and an undo:

1. **Share your Maps location** with a second Google account you own, for one hour. Spare Key finds `maps.sharing.person`.
2. **Sign in to your Google account in a second browser** or a private window. Spare Key finds a new device in
   `google.devices.other`.
3. **Make a Gmail filter** that forwards a test subject to another address you own (Gmail asks you to confirm the
   address first). Spare Key finds `gmail.filter.forwards`.

Then scan, mark each one "Mine" (so the plan treats it correctly), and undo it.

## 14. Storage, locked file and cleanup

- **Session only by default:** findings, answers, the plan and the sent log live in `chrome.storage.session`, cleared
  when the browser closes and by "Clear everything".
- **`chrome.storage.local`** holds only settings (theme, cloud on or off, which checks were ticked).
- **Locked file:** "Save a locked copy" writes a `.spare-key` file: JSON `{ v: 1, salt, iv, data }`, where `data` is
  AES-GCM encrypted with a key from PBKDF2-SHA-256 over the user's password (600,000 iterations, 16-byte salt, 12-byte
  IV), all with WebCrypto. "Open a locked copy" reads it back in the panel. Explain that a forgotten password cannot be
  recovered.
- **Print:** a print-only page with the plan and masked labels, with "Show full details on the printout" off by default.
- **History cleanup (optional):** with the `history` permission, delete exactly the URLs the scan tab visited
  (`chrome.history.deleteUrl`). The "i" button says what this cannot hide: Google's own My Activity may still record
  visits, and the other person may know Spare Key is installed. It recommends removing the extension when done.

## 15. Quick exit (`quickexit.js`)

Triggers: the Quick exit button (always visible, top right of the panel and every site page), pressing Escape twice
within one second in the panel, and the `quick-exit` command (Alt+Shift+X).

Action, in this order: clear session storage; close the scan tab; replace the active tab with `quick_exit_url`
(`chrome.tabs.update`); close the side panel (**Verify** `chrome.sidePanel.close` in the target Chrome version;
otherwise `window.close()` from the panel). On the site: `location.replace(quick_exit_url)`, so Back does not return.

## 16. Testing

- **Unit (`node --test`):**
  - every reader against its saved fixture;
  - `toCloud` fuzzing (findings stuffed with names, emails and phone numbers; assert none appear in the output);
  - every safety rule;
  - the plan engine on every situation combination;
  - the locked file round trip;
  - `steps.json` validation (every code has an entry, every entry has sources and `verified_at`).
- **End to end (Puppeteer, packed extension, as in Still Recalled's `tools/e2e.mjs`):**
  - practice scan, all expected findings;
  - Quick exit;
  - locked file save and open;
  - the no-cloud mode;
  - the privacy intercept test (EVALUATION.md section 3).
- **Site:** axe accessibility checks on every page; Lighthouse at 375 px and 1440 px; both themes.

## 17. What the "How it's built" page shows

A table of every technology, where it runs and why, generated from one data file so it stays true:

| Piece | Runs | Why it is used |
|---|---|---|
| Gemini Nano through Firebase AI Logic (`ONLY_ON_DEVICE`) | This computer | Reads and sorts the private settings pages |
| Gemini through Firebase AI Logic (`ONLY_IN_CLOUD`, function calling) | Google's cloud | Orders the plan from codes only; asks the device yes/no questions |
| Two-voice check | Google's cloud | Two arguments and a settled plan |
| URL context tool | Google's cloud | Reads the official help page to check the steps are still current |
| Hybrid inference (`PREFER_ON_DEVICE`) | Either | Practice scan and "say it more simply", which hold no personal data |
| Firebase App Check (reCAPTCHA) | Site and extension | Only Spare Key can spend its model quota |
| Firebase Remote Config | Every install | Page readers, model list, switches: fixes without a store update |
| Cloud Firestore | Google's cloud | The public steps library; opt-in anonymous layout reports |
| Firebase Authentication | Developer page only | API keys; survivors never sign in |
| Firebase Hosting | Google's cloud | The site, practice pages and the Steps API |
| Chrome extension APIs | This computer | Side panel, scan tab, permissions, extensions check, history cleanup |
| WebCrypto | This computer | The locked file |
| MCP server | The developer's computer | Steps and plans for AI assistants |

Next to it: a diagram of section 1, and the live sent log from the practice scan.
