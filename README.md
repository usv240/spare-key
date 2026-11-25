# Spare Key

**Find out who still has a key to your accounts.** A free, read-only Chrome extension, an Android app and a
step-by-step phone check for people leaving an abusive partner. It reads your own settings pages (Google, Gmail,
location sharing, Amazon, Chrome) and lists the people, devices and apps that can still see your location, your mail or
your account. Then it gives a plan in a safety-first order: screenshot first, talk to an advocate, and leave changes the
other person may notice for a better time. It changes nothing on its own, and nothing that names a person leaves your
computer or phone.

**The phone too.** The Android app (`android/`) lists every app that could let someone watch the phone: apps that read
the screen, device admin apps, and apps that read notifications, texts, the call log or your location all the time. It
runs the extension's own rules, the same JavaScript, in Android's sandbox. For any phone, iPhone included, the
[phone check](https://spare-key-app.web.app/phone-check.html) walks the person through Find My, Apple family, Life360,
tracker alerts, the phone plan and the apps that can watch a phone, and makes the plan in the page.

- Site: <https://spare-key-app.web.app> · Practice check: <https://spare-key-app.web.app/try.html>
- The case and the test results: <https://spare-key-app.web.app/why.html> · For advocates: <https://spare-key-app.web.app/advocates.html>
- Help now: National Domestic Violence Hotline, call 1-800-799-7233 or text START to 88788, free, 24/7. Backup line:
  loveisrespect, 1-866-331-9474.

## Judge's tour

1. **Watch it work (2 minutes).** Open <https://spare-key-app.web.app/try.html> and press **Start the practice check**.
   Spare Key reads 13 made-up settings pages for a person called Jordan with its real readers and finds the 24 planted
   ways in. Gemini sorts them: Gemini Nano on your device if Chrome has it, Gemini in the cloud if not (the data is made
   up, so the cloud is allowed here and only here).
2. **Break the pages.** Open **Break the pages first** and pick a change. The code readers fail on some pages; Gemini
   Nano reads those instead, and any page left unread is listed under "Not checked", never shown as empty. Tick **Apply
   the fix sent through Remote Config** and run again: code reads every page. (Chrome with Gemini Nano, all four changes
   at once: code read 3 of 12 checks, Nano 8 more, 1 listed as not checked; with the fix, code read 12 of 12.
   [Record](docs/evidence/try-html-live-chrome.md).)
3. **See what left the computer.** Make the plan, then open **What left this computer**: every request by destination,
   and every request to Gemini word for word. In the extension they hold finding types like `gmail.forwarding.external`.
4. **Only a phone (3 minutes).** <https://spare-key-app.web.app/phone-check.html>: look in a few places on an iPhone or
   Android phone, answer, and get the plan, made in the page by the same rules, with nothing sent.
5. **What they see when you change it.** <https://spare-key-app.web.app/what-they-see.html>: for each of the 30 kinds
   of access, what the other person sees if it is removed, quoted from the official help page where one says.
6. **On your own account or phone (optional).** Install the extension (below); the recipes on
   <https://spare-key-app.web.app/plant.html> plant a harmless way in to find. For Android, choose **Try a practice phone
   first**, or run `node tools/android-e2e.mjs` on an emulator with the planted test app.

## Where each step runs, and why

The settings pages are the private data, so each step runs at the most private tier its data allows. Anything that can
name a person stays on the device; finding types go where the person chooses; public text goes to the cloud.

| Step | Where | Firebase AI Logic mode | Why |
|---|---|---|---|
| Read the settings pages, sort each entry, read a page a site changed | Gemini Nano | `ONLY_ON_DEVICE` | The pages name the other person, so there is no cloud fallback, on purpose |
| Read a screenshot of a phone location app | Gemini Nano, image input | `ONLY_ON_DEVICE` | A screenshot shows names |
| Read what the person types about their situation ("he bought this phone") into finding codes | Gemini Nano, else code's keyword reader | `ONLY_ON_DEVICE` | The words name people. Only the codes go on, and they can add a step, never remove one |
| Order and explain the plan | Gemini in the cloud with plan help on; Gemini Nano with it off | `ONLY_IN_CLOUD` with function calling, or `ONLY_ON_DEVICE` | Finding codes only. The cloud asks the device yes/no questions (`ask_device`), the person (`ask_user`), and reads the public steps (`get_steps`) |
| Two voices ("close the doors" against "stay hidden", then settle) | Gemini in the cloud | `ONLY_IN_CLOUD` | Codes only, arguing from the steps library |
| Check a step still matches the official help page | Gemini in the cloud | `ONLY_IN_CLOUD`, URL context | A code and a public page |
| The practice check on the website | Either | `PREFER_ON_DEVICE` | Made-up data |
| Android: read which apps hold special access | Code on the phone | none | Android answers this exactly |
| Android: add a caution about what kind of app each one seems to be | Gemini Nano (AICore) | `ONLY_ON_DEVICE` | The app list is private. It can raise concern, never lower it, and a caution counts only when the app's name, source or powers back it up |
| Android: say a step more simply | Nano if the phone has it, else the cloud | `PREFER_ON_DEVICE` | Public text |
| Decide what is shown, everywhere | Code (`shared/`, in Jetpack's JavaScript sandbox on Android) | none | Finding codes, `toCloud()`, `checkOutgoing()`, the plan and the safety rules: one engine for both apps |

**Code decides what keeps a person out of danger.** The plan made by code follows the field's advice by construction,
and eleven safety rules (R1 to R11) hold any plan a model writes to the same advice, so a model can never make the plan
less careful. R11, for example, keeps any change that tells the other person waiting when the person may still live
with them.

**Gemini adds what code cannot do, measured:**

| What | Code alone | With Gemini |
|---|---|---|
| Read settings pages a site has changed (all four kinds of change at once) | 6 of 24 ways in shown | 18 of 24 shown (16 as the right kind) with Gemini Nano on the computer |
| Read a phone app's sharing screen from a screenshot | code cannot read a picture | every made-up person, with "Me" left out, in 1 of 3 test runs and on the website run ([details](docs/accuracy.md)) |
| Order the plan and say why, in plain words | one fixed order and stock sentences | an order and wording for the answers the person chose to share |

Models still need the rules: before the rules ran, the cloud's plans needed 63 fixes on 38 situations, Gemini Nano's
103 on 35. So the cloud orders the plan by default, and Gemini Nano is the private option.

**Two gates before the cloud.** `shared/cloud-safe.js` is the only exit: `toCloud()` builds each request from an
allow-list of codes, and `checkOutgoing()` checks it again just before it is sent. The plan is then asked through a
Firebase AI Logic server prompt template (`shared/plan/template.js`, made by `tools/templates.mjs`): the instructions and
the three functions live on Firebase's server, and its input schema is the same allow-list, so a request with a name
where a code goes was refused with HTTP 400 before any model saw it ([evidence](docs/evidence/template-check.json)).

Also used: App Check (reCAPTCHA Enterprise through a bridge page on the site), Remote Config (page readers, models,
templates, hotline numbers and switches; a fix reaches every install within an hour with no store update), Cloud
Firestore (the public steps library) and Firebase Hosting.

## Every step has a backup

The last backup never needs the cloud.

| Piece | In order |
|---|---|
| Ordering the plan | Template 1, template 2 on a second model, the direct call to two models, then the plan made by code, which is on screen before any of them answer |
| Gemini Nano on the computer | Nano, then code's own reader. A page neither can read is listed as not checked |
| Gemini Nano on the phone | Nano 4 Fast, Nano 4 Full, then the phone's own Nano (on the builder's phone that is Nano 4 Full), each asked one tiny question first so a model that does not answer yet is skipped, then code's sorting (a Remote Config list) |
| Reading a settings page | A reader fixed through Remote Config, the bundled reader, Gemini Nano, then "Not checked" with the page to check by hand |
| The rules engine on Android | Jetpack's JavaScript sandbox, then the same file in a locked-down hidden WebView. Both gave the same result on a real phone: 72 apps read, 13 listed, the same 7-step plan |
| App Check | The bridge page on spare-key-app.web.app, a fresh copy, then spare-key-app.firebaseapp.com; with no token, the plan made by code |
| Settings, steps library | Remote Config or Firestore, the last copy fetched, then the copy built into the app |
| Someone to talk to | The National Domestic Violence Hotline, then loveisrespect, then 911 for danger right now |

## Results

From scripts in `tools/`; details in [docs/accuracy.md](docs/accuracy.md), saved runs in [docs/evidence/](docs/evidence/).

- **Against what real clinics found:** a Cornell and NYU team checked 44 survivors' phones and accounts in person, by
  hand and with a spyware scanner, and found a real risk for 23 (Havron and others, USENIX Security 2019, Figure 3).
  Spare Key looks for 5 of the 6 kinds of problem they found: unknown signed-in devices (12 clients; Google read,
  Apple through the guided phone check, social media next), a shared family or phone plan (4), possible spyware (3;
  Android, judged by the access an app holds), browser extensions the person did not install (2) and a rooted phone
  (1; Android, tested on made-up phone facts). For the sixth, signs a password was known (14), it checks what a known
  password opens: signed-in devices, recovery details and 2-Step Verification.
- **In your own words:** a box where the person types what no settings page shows ("he bought this phone", "we're on
  his plan"). On 60 new statements written by an agent that never saw the code, committed before either reader ran on
  them and run once, Gemini Nano on the computer found 93 of 99 ways in, code's keyword reader 75. Nano added 17
  codes the words did not name, the keyword reader 4. Nano got exactly the right codes for 46 of the 60 statements,
  the keyword reader 40. Median 2.4 s. An extra code can only add a step, and typed words can only fill the careful
  answers ("together", "shared children"), never "apart". On phones, where Chrome has no Gemini Nano, the keyword
  reader does this ([evidence](docs/evidence/told-eval-told-fresh.json), `tools/told-eval.mjs`).
- **Effort saved:** by hand, the same check is 13 settings pages on 4 sites and 18 official help pages (12,640 words
  in the 15 that could be counted, about an hour of reading). Spare Key reads the 12 checks in one pass, 13 seconds on
  the practice pages ([evidence](docs/evidence/effort.json), `tools/effort.mjs`).
- **Practice pages:** 24 of 24 planted ways in found, code only and with Gemini Nano, and 0 of the 4 entries that
  belong to the person flagged.
- **A real account (the builder's own, read-only):** every check it could read matches what the site shows, after
  fixes found on that account (about 50 wrong app entries, a missed recovery phone and others, all fixed).
- **When a site changes its pages:** five kinds of change to the 13 practice pages. A check now says "done" while
  missing a way in 0 times, down from 24 on the first blind run.
- **Privacy:** 0 of 20 requests held a name, email, phone number, device or place, with every cloud step on and typed
  words naming a made-up person and town in the box; only their 3 codes reached the cloud. All 6 model requests matched
  "What left this computer" word for word.
- **Plan safety (40 situations written before any run):** a plain chatbot on the same model told the person to record
  their settings first in 7 of 38 answers and said something risky in 14 (each answer read against a written rubric by
  an AI reviewer). Every plan Spare Key shows starts with the record and warns that a change may be noticed: 38 of 38
  ([evidence](docs/evidence/chatbot-hand-grade.json)).
- **Android:** the planted test app on an emulator passed 34 of 34 checks, including the cloud plan through the
  template, Quick exit, 48dp buttons, and a packet capture showing only Firebase, reCAPTCHA (www.google.com, www.gstatic.com) and Spare Key's own site reached
  ([evidence](docs/evidence/android-e2e.json), [network](docs/evidence/android-net.json)). On the builder's own
  Android 17 phone, Gemini Nano read 13 of 13 listed apps in 7.5 to 10 s ([evidence](docs/evidence/android-real.json)),
  and Android's own AICore record shows those calls ran on Gemini Nano 4 (nano-v4-full): 51 finished calls, a median of
  0.7 s each ([evidence](docs/evidence/aicore-record.json)). In the latest run the two Nano 4 previews were listed
  but did not answer (AICore: not on this phone yet), so Spare Key skipped them and Nano 4 Full sorted all 13 apps in
  9.6 s; both plan templates returned a server error ("high demand") and the direct call ordered the plan.
- **Phone check:** 40 of 40 browser checks, including the typed-words box read by code and through the on-device path, ticking the plan off as you go, and that the page sends nothing after it loads.
- **Accessibility and reading level:** 78 axe runs with 0 issues; median reading grade 4.3.

Next: review by advocates and survivors, planted ways in on real test accounts, and real stalkerware samples for the
Android app.

## Install

1. Download [spare-key-extension.zip](https://spare-key-app.web.app/downloads/spare-key-extension.zip) and unzip it. It
   holds a folder called `spare-key`.
2. In Chrome, open `chrome://extensions`, turn on Developer mode, select **Load unpacked**, and choose `spare-key`.
3. Click the puzzle piece in Chrome's toolbar, then the key, to open the side panel.

The Android app (Android 8 or newer; it asks for one thing, the list of apps, and keeps nothing):

```
npm ci && node build.mjs            # bundles shared/ into android/app/src/main/assets/engine.js
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Build and test

Node 20 or later and Chrome.

```
npm install
RELEASE=1 node build.mjs            # extension/ is ready to load unpacked; web/dist is the site
node --test tests/*.test.mjs        # unit tests (no cloud)
node tools/reader-test.mjs          # readers and rules on the practice pages (no cloud)
node tools/drift-test.mjs           # the same pages changed five ways (--nano adds Gemini Nano)
node tools/e2e-practice.mjs         # the practice check through the real extension (--plan adds the cloud plan)
node tools/phone-check-test.mjs     # the step-by-step phone check (no cloud)
node tools/privacy-test.mjs         # the privacy test (about 7 cloud calls)
node tools/a11y-check.mjs           # axe-core on the site and the side panel
node tools/android-e2e.mjs          # the Android app on an emulator with the planted test app (about 5 cloud calls)
```

More in [docs/dev.md](docs/dev.md). The design documents written before the build are in [docs/design/](docs/design/)
([BRIEF.md](docs/design/BRIEF.md) first).

## Reused code

The Firebase AI Logic wrapper pattern, the App Check bridge for a Chrome extension and the Android shell (the wrapper,
the App Check bridge through a WebView, and shared JavaScript in Jetpack's sandbox) come from the author's other
#BuildHybridAI entry, Still Recalled. Everything else is new.

## License

Apache-2.0.
