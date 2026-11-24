# Spare Key

**Find out who still has a key to your accounts.** A free, read-only Chrome extension for people leaving an abusive
partner. It reads your own settings pages (Google, Gmail, location sharing, Amazon, Chrome) and lists the people,
devices and apps on them that can still see your location, your mail or your account. Then it gives a plan in a safety-first
order: screenshot first, talk to an advocate, and leave changes the other person may notice for a better time. It
changes nothing on its own, and nothing that names a person ever leaves your computer.

**And the phone itself.** An account check cannot see an app hidden on the phone, so there is an Android app too
(`android/`). It reads the phone's own settings and lists every app that could let someone watch it: apps that can read
the screen, device admin apps, apps that read notifications, texts or the call log, and apps that see your location all
the time. It runs the extension's own rules, the same JavaScript, in Android's sandbox. Gemini Nano sorts the apps on
the phone; the cloud orders the plan from finding types and never sees an app's name. (Gemini Nano on Android has not run yet: the test
emulator has none. Everything else in the Android app is tested end to end.)

Site: <https://spare-key-app.web.app> · Practice check in any browser: <https://spare-key-app.web.app/try.html>

The case and the test results on one page: <https://spare-key-app.web.app/why.html> · For advocates:
<https://spare-key-app.web.app/advocates.html>

If you need help now: National Domestic Violence Hotline, call 1-800-799-7233 or text START to 88788. Free, 24/7.

## Judge's tour

1. **Watch it work, nothing of yours involved (2 minutes).** Open <https://spare-key-app.web.app/try.html> and press
   **Start the practice check**. Spare Key reads 13 made-up settings pages for a person called Jordan with its real
   readers and finds the 24 planted ways in. Gemini sorts them: Gemini Nano on your device if Chrome has it, Gemini in
   the cloud if not (the data is made up, so the cloud is allowed here and only here).
2. **Break the pages.** Before you start, open **Break the pages first** and pick a change (reworded labels, rebuilt
   lists, all four at once). The code readers fail on some pages; watch Gemini read those pages instead, and see every
   page it cannot read listed under "Not checked" instead of shown as empty. Then tick **Apply the fix sent through
   Remote Config** and run it again: the code readers read every page again. After either run, **Read Jordan's
   screenshot** reads a made-up phone sharing screen. (Checked in Chrome with Gemini Nano on November 24, all four changes at once: code read 3 of
   12 checks, Gemini Nano read 8 more on the device, 1 was listed as not checked, and with the Remote Config fix code
   read 12 of 12. On November 22 the screenshot added both made-up people
   on it, Sam Porter and Riley, leaving out "Me"; recorded in [docs/evidence/try-html-live-chrome.md](docs/evidence/try-html-live-chrome.md). Automated
   browsers are refused by App Check's reCAPTCHA, so there Gemini is not asked and the page says so.)
3. **See what left the computer.** Make the plan, then open **What left this computer**: a ledger of every request
   by destination, and every request to Gemini word for word with the fixed instructions sent with it. In the
   extension, those requests hold finding types like `gmail.forwarding.external`, never a name.
4. **What they see when you change it.** <https://spare-key-app.web.app/what-they-see.html>: for each of the 30 kinds
   of access, what the other person sees if it is removed, quoted from the official help page where one says.
5. **On your own account (optional, 5 minutes).** Install the extension (below) and run the check. The recipes on
   <https://spare-key-app.web.app/plant.html> plant a harmless way in to find; the builder has not yet run them on a
   real account, so a miss there is new information, and the first one sends a new sign-in alert to the account.

6. **The Android app (optional).** Build it (below) and choose **Try a practice phone first**: a made-up phone with a
   hidden "System Update Service" that holds every kind of access. Or run `node tools/android-e2e.mjs` on an emulator: it
   installs a do-nothing test app that holds the same access, turns each one on, and drives the real app. 34 of 34
   checks passed on an Android 16 emulator ([docs/evidence/android-e2e.json](docs/evidence/android-e2e.json)).

## Where each step runs, and why

The split is set by the problem: the settings pages are the private data. Spare Key uses **privacy-tiered routing**:
each step runs at the most private tier its data allows. Anything that can name a person is device only; finding types
go to whichever tier the person chooses and the measurements favour; public text goes to the cloud.

| Step | Where | Firebase AI Logic mode | Why |
|---|---|---|---|
| Read the settings pages and sort each entry | Gemini Nano | `ONLY_ON_DEVICE` | The pages name the other person. Sending them anywhere is the harm, so there is no cloud fallback, on purpose |
| Read a page the code reader cannot (a site changed it) | Gemini Nano | `ONLY_ON_DEVICE` | Same |
| Read a screenshot of a phone location app | Gemini Nano, image input | `ONLY_ON_DEVICE` | A screenshot shows names. Tried on one made-up screen, read on 1 of 3 runs; no real Life360 or Find My screen has been tried |
| Order and explain the plan | Gemini in the cloud if plan help is on; Gemini Nano if the person turned it off | `ONLY_IN_CLOUD` with function calling, or `ONLY_ON_DEVICE` | Finding codes only. The cloud asks the device yes/no questions (`ask_device`), the person (`ask_user`), and reads the public steps (`get_steps`). Code's safety rules decide what is shown either way (below) |
| Two voices ("close the doors" against "stay hidden", then settle) | Gemini in the cloud | `ONLY_IN_CLOUD` | Codes only; each voice argues from the steps library's facts |
| Check a step still matches the official help page | Gemini in the cloud | `ONLY_IN_CLOUD`, URL context | A code and a public help page. The tool could not fetch Google's or Amazon's help pages; given the page text fetched on the computer, it confirmed Gmail's forwarding steps |
| The practice check on the website | Either | `PREFER_ON_DEVICE` | Made-up data |

### The same split on Android

| Step | Where | Firebase AI Logic mode | Why |
|---|---|---|---|
| Read which apps hold special access | Code, on the phone | none | Android answers this exactly; a model would only add doubt |
| Add a caution about what kind of app each one seems to be | Gemini Nano on the phone (AICore) | `InferenceMode.ONLY_ON_DEVICE` | The list of apps on a phone is private. It can raise concern, never lower it: a reassuring note is not shown, and it can never hide a finding. Not yet run on a phone |
| Put a step's public instructions in simpler words | Gemini Nano on the phone if it has it, Gemini in the cloud if not | `InferenceMode.PREFER_ON_DEVICE` | The steps library is public text, the same for everyone, so the fallback is allowed here and only here |
| Order and explain the plan | Gemini in the cloud if plan help is on; Gemini Nano if not | `InferenceMode.ONLY_IN_CLOUD` with function calling, or on device | Finding codes only. `ask_device` asks the phone "did this app come from outside the store?" and the phone answers yes, no or unknown |
| Decide what is shown | Code, in Jetpack's JavaScript sandbox | none | The extension's own modules (`shared/`): finding codes, `toCloud()`, `checkOutgoing()`, the plan and the safety rules. One engine, so the two cannot drift apart |

App Check on Android goes through the site's reCAPTCHA Enterprise page, the way the extension's does: an app installed
from the site has no Play Integrity. Remote Config holds the same model list and cloud switch.

### What code decides, and what Gemini adds

Code decides everything that keeps a person out of danger. The readers and rules find the ways in on pages they know.
The plan made by code follows the field's advice by construction (screenshot first, an advocate before any change,
wait when now may not be a good time), and the safety rules (R1 to R10) hold any plan a model writes to the same
advice, so a model can never make the plan less careful. The seven measures below check that advice; they are not an
independent test of whether the advice is right, which only advocates can judge.

Gemini adds what code cannot do, measured:

| What | Without Gemini | With Gemini |
|---|---|---|
| Read settings pages a site has changed (all four kinds of change at once) | 6 of 24 ways in shown | 18 of 24 with Gemini Nano on the computer |
| Read a phone app's sharing screen from a screenshot | nothing (code cannot read a picture) | all made-up people, with "Me" left out, in 1 of 3 runs of the test screen and in the run on the website; the other two runs split lines or could not start Nano ([details](docs/accuracy.md)) |
| Order the plan and say why each step comes where it does, in plain words | one fixed order and stock sentences | an order and wording for the answers the person chose to share (none by default); Gemini asks the computer yes/no questions it needs |

The plan's ordering is where models still fall short, so the rules stay in charge: before the rules ran, the cloud's
plans needed 43 fixes on 30 situations (18 after the two voices), Gemini Nano's 103 on 35. So the cloud orders the plan
by default, and Gemini Nano is the private option for a person who turns plan help off.

`shared/cloud-safe.js` is the only exit to the cloud. `toCloud()` builds a new object from an allow-list of codes and
enums, and `checkOutgoing()` checks every request again just before it is sent, refusing any request that holds a name,
address or device the scan found.

Also used: App Check (reCAPTCHA Enterprise; the extension gets tokens from a bridge page on the site), Remote Config
(the page readers and the words the code rules read, models and switches: a fix reaches every install the next time it
fetches, at most once an hour, with no store update), Cloud Firestore (the public steps library), Firebase Hosting (site, practice pages, Steps API).

## Results

All from scripts in `tools/`; details and limits in [docs/accuracy.md](docs/accuracy.md), and the saved runs in
[docs/evidence/](docs/evidence/).

- **Practice pages:** 24 of 24 planted ways in found, code only and with Gemini Nano, and none of the 4 entries that
  belong to the person flagged. On a real account, your own phones, authenticator and Kindle are listed too, by design,
  for you to mark "Mine": Spare Key cannot tell whose phone is whose.
- **A real account (the builder's own, read-only):** run inside each real Google, Gmail and Amazon settings page, it
  first got 5 of 12 checks wrong in some way (about 50 wrong app entries, a missed recovery phone, 4 extra 2-Step
  entries, 6 false Amazon devices, 1 false household adult). After the fixes, every check it could read matches what
  the site shows; Google Photos partner sharing sits behind a click, so it is listed as not checked.
- **When a site changes its pages:** a script changed the 13 practice pages five ways. On the first, blind run, a
  check said it was done while missing a way in 24 times. Now 0 times, with code alone and with Gemini Nano: a page that
  cannot be read is listed under "Not checked". Nano reads what code cannot (pages changed all four ways: 6 of 24 shown
  by code, 18 with Nano, 24 after the Remote Config fix).
- **Privacy:** 0 of 20 requests from the extension held a name, email, phone number, device or place, in a full check
  with every cloud step on; all 9 model requests matched "What left this computer" word for word, and the panel's own
  ledger agreed (0 of 13). The cloud plan asked the device a yes/no question (`ask_device`) and got an enum back.
- **Plan safety (40 situations written before any run):** a plain chatbot (the same Gemini 3.5 Flash-Lite, with no Spare Key instructions) told the person to record their settings before changing anything in 7 of 30 answers,
  read in full against a written rubric by an AI reviewer (4 of 30 by the first, keyword count; none made it the first thing to do, and 10 said
  something risky). It warned clearly that a change may be noticed in 24. Every plan Spare Key shows starts with the record and carries the
  warning, in 30 of 30 ([docs/evidence/chatbot-hand-grade.json](docs/evidence/chatbot-hand-grade.json)). Where the person's mail was copied to someone else and an account change was also needed (7 of the 30),
  the chatbot brought up the account change (recovery, password, sign-ins) before stopping the mail copying in 3 of 7:
  Google's alert emails and codes would then reach the other person. Spare Key's rule R9 puts the mail copying first in
  7 of 7. The rule was added after these runs, and the chatbot's answers are judged by keyword position, which is rough.

Limits: no survivor or advocate has tested it yet; the readers have been measured on one real account, without planted
ways in, so a missed way in on a real account is not yet measured;
on the free tier the cloud plan failed in 5 of 40 situations and the two-voice check in 5 more (when the cloud does not
answer, you get the plan made on your computer; when only the voices fail, you keep the cloud plan).

### Android: a planted test app

`tools/android-e2e.mjs` installs `android/planted`, an app that does nothing but hold accessibility, device admin,
notification, texts and background location access, turns each one on through adb, and drives the real app.
**34 of 34 checks passed** on an Android 16 emulator: the planted app is found and listed first as "can watch
and control this phone"; apps that came with the phone are not listed (the first run flagged Android System
Intelligence, which is why); the plan says to leave the watching app for a better time when now is not a good time;
the cloud plan request is in "What left this phone" word for word and names no app; Quick exit and back-twice leave no
recent-apps entry; every button is at least 48dp. The check took 8.7 s. The plan made by code was on the screen 2.8 s after the button was pressed, and Gemini in the cloud reordered it 9.3 s after the button was pressed, with rule R10 applied by code. Also checked: an app that can see which apps you use is found; "Say it more simply" is answered through hybrid inference's cloud fallback (the emulator has no Gemini Nano); every request passes a second check for app names in Kotlin; and no usage statistics or crash reports are stored or sent. The emulator's own packet capture of that run, with Wi-Fi off so nothing could go another way, shows Spare Key reaching only Firebase AI Logic, App Check with reCAPTCHA, Remote Config and its own site (116.1 KB sent by host name; Android's counter for the app says 125.7 KB in all), and no usage, crash or analytics host looked up or reached (`tools/android-net.mjs`, `docs/evidence/android-net.json`).
Not shown by this: real stalkerware, a rooted phone, or Gemini Nano's sorting (the emulator has no Gemini Nano).

## Install

Spare Key is not in the Chrome Web Store yet.

1. Download [spare-key-extension.zip](https://spare-key-app.web.app/downloads/spare-key-extension.zip) and unzip it
   (or build it, below). It holds a folder called `spare-key`.
2. In Chrome, open `chrome://extensions`, turn on Developer mode, select **Load unpacked**, and choose `spare-key`.
3. Click the puzzle piece in Chrome's toolbar, then the key, to open the side panel.

### The Android app

Not in the Play Store (an app that reads the list of installed apps needs a longer review). Build it:

```
npm ci && node build.mjs            # bundles shared/ into android/app/src/main/assets/engine.js
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

Android 8 or newer. It asks for one thing, the list of apps. It keeps nothing: the check lives in memory.

## Build and test

Node 20 or later and Chrome.

```
npm install
RELEASE=1 node build.mjs            # extension/ is then ready to load unpacked; web/dist is the site
node --test tests/*.test.mjs        # unit tests (no cloud)
node tools/reader-test.mjs          # readers and rules on the practice pages (no cloud)
node tools/drift-test.mjs           # the same pages changed five ways (no cloud; --nano adds Gemini Nano)
node tools/e2e-practice.mjs         # the practice check through the real extension (no cloud)
node tools/privacy-test.mjs         # the privacy test (about 7 cloud calls)
node tools/e2e-quick-exit.mjs       # Quick exit through the real extension (no cloud)
node tools/a11y-check.mjs           # axe-core on the site and the side panel
node tools/reading-grade.mjs        # reading grade of the site and the panel
node tools/android-e2e.mjs          # the Android app on an emulator, with the planted test app (about 5 cloud calls)
node tools/android-shots.mjs        # screenshots of the Android app on the practice phone
node tools/record-demo.mjs --nano && node tools/make-video.mjs   # the demo video, from the practice check
```

More in [docs/dev.md](docs/dev.md). The design documents written before the build, and the build brief with its hard
rules, are in [docs/design/](docs/design/) ([BRIEF.md](docs/design/BRIEF.md) first).

## Reused code

The Firebase AI Logic wrapper pattern and the App Check bridge for a Chrome extension come from the author's other
#BuildHybridAI entry, Still Recalled, with the backend changed to the free Gemini Developer API. Everything else is new.

The Android shell (Firebase AI Logic wrapper for Android, the App Check bridge through a WebView, and running shared
JavaScript in Jetpack's sandbox) also comes from Still Recalled. The phone check itself, its rules, its screens, the
planted test app and its end-to-end test are new.

## License

Apache-2.0.
