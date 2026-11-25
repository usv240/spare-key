# Devpost submission text

Paste each section into the matching field of the Devpost form. Platform: **Web (Chrome)** and **Android**. Every number here comes
from `docs/accuracy.md` and the saved runs in `docs/evidence/`; check them again on the day you submit.

- Project name: Spare Key
- Tagline (under 60 characters): Find out who still has a key to your accounts.
- Site: https://spare-key-app.web.app
- Try it in any browser: https://spare-key-app.web.app/try.html
- The case and the proof on one page: https://spare-key-app.web.app/why.html
- Code: https://github.com/usv240/spare-key (Apache-2.0)
- Video: (YouTube link, public; made by `tools/record-demo.mjs` and `tools/make-video.mjs` from the real extension
  on the practice pages; upload steps in `docs/video.md`)

---

## Inspiration

When someone leaves an abusive partner, the partner often still has a way in: a phone signed in to her Google account,
mail quietly forwarded to his address, a location share she forgot, an app on her phone. Finding them means a dozen
settings pages. Then comes the harder part: removing access can alert the other person, and that is most dangerous
right after leaving.

Researchers at NYU asked AI chatbots 193 real questions from survivors; 60% of the answers left out critical safety
warnings. The same study counts three dedicated tech-abuse clinics in the US. And a chatbot cannot see your settings:
pasting them in sends the very names and addresses that are the danger.

## What it does

Spare Key is a free, read-only Chrome extension and Android app.

1. **It checks.** The extension reads the person's own settings pages for Google, Gmail, Google Photos, Amazon and
   Chrome. The Android app asks the phone which apps hold the access a phone-watching app needs. Neither ever clicks,
   changes or removes anything.
2. **It shows what it found**, grouped by what the other person could do: see your location, read your mail, get into
   your account, watch your phone. Anything it could not read is listed under "Not checked", never shown as empty.
3. **It makes a plan in the order the field teaches**: screenshot first, talk to an advocate, then each change, with
   what the other person will see if you make it, quoted from the company's own help page where one says. Changes they
   may notice wait for a better time.
4. **Quick exit** is on every screen, and nothing is kept unless the person asks.

## How we built it: the data decides where the model runs

Most hybrid apps treat the cloud as the fallback. Here the fallback is refused on purpose. The settings pages name the
other person, so the model that reads them has to run on the device. When Gemini Nano is not there, code reads the
pages and the result says so. The cloud only ever sees the kind of thing that was found.

| Step | Where | Firebase AI Logic mode |
|---|---|---|
| Read and sort the private pages; read a page a site has changed; read a phone screenshot | Gemini Nano | `ONLY_ON_DEVICE`, no cloud fallback |
| Order the plan from finding codes | Gemini in the cloud | `ONLY_IN_CLOUD` with function calling: the cloud asks the device yes or no questions (`ask_device`), asks the person (`ask_user`) and reads the public steps (`get_steps`) |
| Two voices argue ("close the doors" against "stay hidden"), a third settles | Gemini in the cloud, codes only | `ONLY_IN_CLOUD` |
| Put a public step in simpler words; the website's practice check | Gemini Nano, else the cloud | `PREFER_ON_DEVICE`, only for text that names no one |
| On Android: the same three modes through Firebase AI Logic for Android | Gemini Nano through AICore; Gemini in the cloud | `InferenceMode.ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`, `PREFER_ON_DEVICE` |

**What Gemini does that code cannot.** Sites redesign their pages. When we changed the 13 practice pages five ways by
script, code alone found 79 of 120 planted ways in; with Gemini Nano reading the changed page on the device, 105. With
four changes at once it was 6 of 24 by code and 18 with Gemini Nano, and a Remote Config fix restored all 24 with no
update.

**What code does that a model must not.** One file, `shared/cloud-safe.js`, is the only exit to the cloud: it builds
each request from an allow-list of codes and enums, and checks it again before it is sent. Ten safety rules in code
check any plan a model writes. Gemini Nano's plans needed 103 fixes on 35 situations and the cloud's 43 on 30, so the
rules, not the model, decide what a person in danger is told.

**The prompt lives on Firebase's server, and the server checks the codes too.** The plan is asked through a Firebase AI
Logic server prompt template (`shared/plan/template.js`, created by `tools/templates.mjs` from the same shared code).
Its instructions, answer format and the three functions stay on Firebase's server; the extension, the website and
the Android app send only the template's id and the codes. The template's input schema is the same allow-list as
`cloud-safe.js`, so the server is a second gate: a request with a name where a code goes, a name as a ref, or an
address in an answer was refused with HTTP 400 before any model saw it. Backups: a second template on a second
model, then the direct call through the same gate; which templates to use is a Remote Config key. On Android, which
on-device model to use is a Remote Config list too: Gemini Nano 4 Fast and Full (previews built on Gemma 4) first,
then the Gemini Nano a phone ships with.

**One rules engine, two platforms.** The extension's own JavaScript (finding codes, the cloud gate, the plan, the
safety rules) runs unchanged inside Jetpack's JavaScript sandbox on Android, so the two cannot drift apart.

Also used: **App Check** with reCAPTCHA Enterprise, **Remote Config** (page readers fixed for every install without a
store update, the templates and the on-device model order), **Cloud Firestore** (the public steps library), **Firebase Hosting** (the site, the practice pages and a
free Steps API), and an MCP server so an advocate's AI assistant gives the current steps with the warnings attached.
Not used, on purpose: **Firebase Authentication**. An account is a record that ties a person to a safety check, and a
sign-in can send an alert; Spare Key works with no account. App Check guards the quota instead.

**Every step has a backup, and the last one never needs the cloud.** The plan: two server prompt templates on two
models, then the direct call, then the plan made by code. Gemini Nano on Android: Nano 4 Fast, Nano 4 Full, then the
stable Nano. The Android rules engine: Jetpack's JavaScript sandbox, then a hidden WebView with the network off. App
Check: the bridge page on two Hosting domains. The hotline: the National Domestic Violence Hotline, then loveisrespect,
then 911. Settings, page readers and the steps library each fall back to the copy built into the app.

## Challenges we ran into

- **Proving nothing leaks.** A test captures every network request the extension makes and searches it for 30 made-up
  names, emails, phones and places in four encodings: 0 of 20 requests held one. On Android, a second check in Kotlin
  looks for app names at the call site, and the emulator's own packet capture shows where traffic went (see
  `docs/accuracy.md`).
- **Sites change their pages.** On the first, blind run a check said it was done while missing a way in 24 times. Now
  it does so 0 times: a page it cannot read is listed as "looked different".
- **Small models need guardrails.** In a live run, Gemini Nano called four household members the person's own, which
  would have hidden them. Now only the page's own words can mark an entry as yours, and Gemini Nano can raise a
  concern but never lower one.

## Accomplishments that we're proud of

- A plain chatbot told the person to record their settings before changing anything in 7 of 38 answers, each read in full
  against a written rubric; none made it the first step and 14 said something risky, like urging changes at once on someone who was
  not sure. Every plan Spare Key shows starts with the record, in 38 of 38.
- Rule R9: when mail is copied to someone else, or someone else may hold the recovery email or phone, deal with that
  before any change Google would tell them about. By keyword position, the chatbot got the mail order wrong in 3 of 7
  situations where it applied.
- "What they see when you change it": 30 kinds of access, 22 with the official help page quoted.
- Android: 34 of 34 end-to-end checks on an Android 16 emulator, with a test app that holds the
  access a phone-watching app asks for. The plan made by code is on the screen in 3 seconds, and Gemini, through the
  server prompt template, reordered it 9.8 seconds after the button was pressed. When the free-tier model does not answer, the app keeps the
  plan made by code and says so. The emulator's own packet capture of the run shows no reporting host reached.
- The whole hybrid path on a real phone: on the builder's own Pixel with 703 apps, 72 held some special access; Spare
  Key listed 13 and counted the 59 that came with the phone. Gemini Nano read all 13 on the phone in 9.8 seconds, and
  Gemini in the cloud ordered the plan from finding types in 3.3 seconds, asking the phone one yes or no question (on 1 of
  4 runs: on the others the free-tier model did not answer in time, and the plan made by code stayed on screen).
  Gemini Nano's first run there raised a caution on 10 of the 13, so a caution now has to be backed up by something
  code can check: 2 were kept and 6 set aside.
- Accessibility: axe-core finds 0 violations in 74 runs across the site and the panel; median reading grade
  4.3
- A real account, read-only: real Google and Amazon pages differed from what we expected in 5 of 12 checks. After the
  fixes, every check Spare Key could read matched what the site shows.

## What we learned

The field's advice (document first, an advocate before any change, warn that a change may be noticed) is easy to state
and easy for a model to drop. Putting it in code, and letting models only read, order and explain within it, made the
product more useful and more honest about what each part does.

## Limits, stated plainly

No survivor or advocate has tested it yet. Planted access has been found on made-up pages and a test phone, not yet on
a real account. Gemini Nano on Android has run on one real phone (13 of 13 listed apps read in 9.8 seconds), not in the automated test: the emulator has none. The cloud model is
on the free tier: in 40 test situations it failed to order the plan in 5 and failed the two-voice check in 5 more. The
plan made by code is shown at once either way.

## What's next

- Review by advocates at tech-abuse clinics: the request and the questions are at
  https://spare-key-app.web.app/advocates.html.
- Plant known ways in on real test accounts, and test "what they see" between two accounts.
- A Chrome Web Store listing and a signed Android release, so no Developer mode is needed.
- More services: Apple and iCloud, Life360, phone carriers.

## Built with

Firebase AI Logic (web and Android, hybrid inference and server prompt templates), Gemini Nano (Chrome built-in AI and
AICore), Gemini Developer API, Firebase App Check with reCAPTCHA Enterprise, Firebase Remote Config, Cloud Firestore, Firebase Hosting, Chrome Extensions
(Manifest V3, side panel), Kotlin with Jetpack Compose and JavaScriptSandbox, Model Context Protocol. Built with Claude
Code and Firebase Agent Skills.

## Testing instructions (for judges)

1. **No install, 2 minutes:** open https://spare-key-app.web.app/try.html and press Start the practice check. It reads
   13 made-up settings pages for a person called Jordan. Gemini Nano sorts the entries if your Chrome has it, Gemini in
   the cloud if not (made-up data only). Open "Break the pages first" to see what happens when a site changes its pages.
   Very private or automated browsers may be refused by App Check; the page says so, and the check still runs with code.
2. **The extension:** download https://spare-key-app.web.app/downloads/spare-key-extension.zip, unzip it, open
   `chrome://extensions`, turn on Developer mode, Load unpacked, choose the `spare-key` folder, then click the puzzle
   piece and the key. Choose **Try a practice check first** to run it on the made-up pages with nothing of yours opened.
3. **The Android app (optional):** build it from `android/` (README, "The Android app") and choose **Try a practice
   phone first**. Nothing on the phone is read in a practice check.

## Code reused from before the submission period

The Firebase AI Logic wrapper pattern and the App Check bridge for a Chrome extension come from the author's other
#BuildHybridAI entry, Still Recalled, as does the Android shell (the Firebase AI Logic wrapper for Android, the App
Check bridge through a WebView, and running shared JavaScript in Jetpack's sandbox). The checks, the rules, the plan,
the screens, the practice pages, the planted test app and every test are new.
