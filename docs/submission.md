# Devpost submission text

Paste each section into the matching field of the Devpost form. Platform: **Web (Chrome)** and **Android**. Every number here comes
from `docs/accuracy.md` and the saved runs in `docs/evidence/`; check them again on the day you submit.

- Project name: Spare Key
- Tagline: Find out who still has a key to your accounts.
- Site: https://spare-key-app.web.app
- Try it in any browser: https://spare-key-app.web.app/try.html
- The case and the proof on one page: https://spare-key-app.web.app/why.html
- Code: https://github.com/usv240/spare-key (Apache-2.0)
- Video: (YouTube link, public; upload steps in `docs/video.md`)

---

## Inspiration

When someone leaves an abusive partner, the partner often still has a way in: a phone signed in to their Google
account, mail quietly forwarded to the partner's address, a forgotten location share, an app on their phone. Finding
them means a dozen settings pages. Then comes the harder part: removing access can alert the other person, and that is
most dangerous right after leaving.

A Cornell and NYU team checked 44 survivors' phones and accounts in person at New York City's Family Justice Centers,
by hand and with a spyware scanner, and found a real risk for 23 of them (USENIX Security 2019). Researchers count
three dedicated tech-abuse clinics in the US. And when researchers asked AI chatbots 193 real questions survivors had
asked online and in published studies, 60% of the answers left out critical safety warnings. A chatbot also cannot see your settings: pasting them in sends the very names that are the danger.

## What it does

Spare Key is a free, read-only Chrome extension, an Android app, and a step-by-step phone check for any phone.

1. **It checks.** The extension reads the person's own settings pages for Google, Gmail, Google Photos, Amazon and
   Chrome. The Android app lists the apps that hold the access a phone-watching app needs. The phone check walks an
   iPhone or Android owner through Find My, Apple family, Life360, tracker alerts and the phone plan. Nothing is ever
   clicked or changed.
2. **It shows what it found**, grouped by what the other person could do. A page it could not read is listed under
   "Not checked", never shown as empty.
3. **It makes a plan in the order the field teaches**: screenshot first, talk to an advocate, then each change, with
   what the other person will see, quoted from the company's own help page. Changes they may notice wait.
4. **It closes the loop.** After a change, the person checks again, and "Since your last check", compared with a locked
   copy kept on the computer, shows what is gone and anything new. For advocates, a printed record of what was found goes in the case file.
5. **In your own words.** The person can type what no settings page shows: "he bought this phone", "we're on his
   plan". Gemini Nano turns the words into finding codes on the device, and only the codes reach the plan. This covers
   what no settings page shows, like a phone the abuser bought and set up or a plan in their name. If the words match
   nothing Spare Key checks, the plan says so and points to an advocate.
6. **Quick exit** is on every screen, and nothing is kept unless the person asks.

It looks for 5 of the 6 kinds of problem the Cornell and NYU clinic found: unknown signed-in devices (12 clients;
Google read, Apple through the guided check, social media next), a shared family or phone plan (4), possible spyware
(3; Android, judged by the access an app holds), browser extensions the person did not install (2) and a rooted phone
(1). For the sixth, signs a password was known (14), it checks what a known password opens. A phone that may be rooted is treated like one an app is watching:
it comes first in the plan, and every other step says to use a device the other person never had. By hand the same check is 13 settings pages on 4 sites
and about an hour of reading official help pages; Spare Key reads the 12 checks in one pass.

## How we used Firebase AI Logic: the data decides where the model runs

Most hybrid apps treat the cloud as the fallback. Here the fallback is refused on purpose. The settings pages name the
other person, so the model that reads them runs on the device. The cloud only ever sees the kind of thing found.

| Step | Where | Firebase AI Logic mode |
|---|---|---|
| Read and sort the private pages; read a page a site changed; read a phone screenshot | Gemini Nano | `ONLY_ON_DEVICE`, no cloud fallback |
| Read what the person types in their own words ("he bought this phone") into finding codes | Gemini Nano, else code's keyword reader | `ONLY_ON_DEVICE`: the words never leave |
| Order the plan from finding codes | Gemini in the cloud, through a server prompt template | `ONLY_IN_CLOUD` with function calling: `ask_device`, `ask_user`, `get_steps` |
| Two voices argue ("close the doors" against "stay hidden"), a third settles | Gemini in the cloud, codes only | `ONLY_IN_CLOUD` |
| Put a public step in simpler words; the website's practice check | Gemini Nano, else the cloud | `PREFER_ON_DEVICE`, only for text that names no one |
| Android: sort apps on the phone, plan in the cloud, simpler words | AICore and the cloud | The same three modes in the Android SDK |

**What Gemini does that code cannot.** Sites redesign their pages. With the 13 practice pages changed four ways at
once, code showed 6 of 24 planted ways in and Gemini Nano, reading the changed pages on the device, 18; a Remote Config
fix restored all 24 with no update. And people say things in their own way ("he pays my cell bill", "the alexa in
the kitchen is on his amazon"). On 60 new statements written by an agent that never saw the code, committed before
either reader ran and run once, Gemini Nano found 93 of 99 ways in on the device, against 75 for code's keyword
reader, in a median 2.4 seconds. It also added 17 codes the words did not name (the keyword reader 4); each can only
add a step. Nano got exactly the right codes for 46 statements, the keyword reader 40. Where Chrome has no Gemini
Nano, as on phones, the keyword reader does this alone.

**What code does that a model must not.** `shared/cloud-safe.js` is the only exit to the cloud: it builds each request
from an allow-list of codes and checks it again before it is sent. The server prompt template's input schema is the
same allow-list, so a request with a name where a code goes was refused with HTTP 400 before any model saw it. Eleven
safety rules in code check every plan a model writes: the cloud's plans needed 63 fixes on 38 situations before the
rules ran, Gemini Nano's 103 on 35. One rules engine, the extension's own JavaScript, runs unchanged in Jetpack's
JavaScript sandbox on Android.

Also used: App Check with reCAPTCHA Enterprise, Remote Config (page readers, model order, templates and hotline
numbers, changed without a store update), Cloud Firestore (the public steps library) and Firebase Hosting. No sign-in,
by design: an account would tie a person to a safety check.

**Every step has a backup, and the last one never needs the cloud**: two templates on two models, the direct call,
then the plan made by code, which is on screen before any of them answer. On the phone: Gemini Nano 4 Fast, Nano 4
Full, then the phone's own Nano, each asked one tiny question first, so a model that does not answer yet is skipped.

## Challenges we ran into

- **Proving nothing leaks.** A test captured every request the extension made and searched it for 30 made-up names,
  emails, phones and places in four encodings, with typed words naming a made-up person and town in the box too: 0 of
  20 requests held one, and only the typed words' 3 codes reached the cloud.
- **Sites change their pages.** On the first blind run, a check said it was done while missing a way in 24 times. Now 0:
  a page it cannot read is listed as "looked different".
- **Small models need guardrails.** In a live run, Gemini Nano called four household members the person's own, which
  would have hidden them. Now only the page's own words can mark an entry as yours.

## Accomplishments that we're proud of

- A plain chatbot on the same model told the person to record their settings before changing anything in 7 of 38
  situations and said something risky in 14 (each answer graded against a written rubric by an AI reviewer). Every plan Spare Key shows starts with the record: 38 of 38.
- Android: 34 of 34 end-to-end checks with a planted test app; the plan made by code is on screen in 2.3 seconds and
  Gemini reorders it through the template by 8.3 seconds. On the builder's own phone, Gemini Nano read all 13 listed
  apps in 7.5 to 10 seconds; Android's own AICore record shows those calls ran on Gemini Nano 4 (nano-v4-full):
  51 finished calls, a median of 0.7 seconds each. In the latest run, the two Nano 4 previews were listed but did not
  answer (AICore: not on this phone yet), so Spare Key skipped them after one tiny question each and Nano 4 Full sorted
  all 13 apps in 9.6 seconds; both plan templates returned a server error ("high demand"), and the direct call ordered
  the plan. Every backup in the chain ran once, on a real
  phone.
- On a real account, read-only, real pages differed from what we expected in 5 of 12 checks; after the fixes, every
  check Spare Key could read matched what the site shows.
- 0 accessibility violations in 78 axe-core runs; median reading grade 4.3.

## What we learned

The field's advice (document first, an advocate before any change, warn that a change may be noticed) is easy to state
and easy for a model to drop. Putting it in code, and letting models read, order and explain within it, made the
product more useful and more honest about what each part does.

## What's next

- Review by advocates and survivors: the questions are at https://spare-key-app.web.app/advocates.html.
- Readers for social media sign-ins, and a test of the rooted-phone check on a real rooted phone.
- A Chrome Web Store listing and a signed Android release.

## Built with

Firebase AI Logic, Gemini Nano, Gemini API, Firebase App Check, Firebase Remote Config, Cloud Firestore, Firebase
Hosting, Chrome Extensions, Kotlin, Jetpack Compose.

## Testing instructions (for judges)

1. **No install, 2 minutes:** open https://spare-key-app.web.app/try.html and press Start the practice check. It reads
   13 made-up settings pages for a person called Jordan. Open "Break the pages first" to see what happens when a site
   changes its pages. Very private or automated browsers may be refused by App Check; the check still runs with code.
2. **Any phone, 3 minutes:** open https://spare-key-app.web.app/phone-check.html, choose iPhone or Android, answer a
   few questions, and get the plan, made in the page with nothing sent.
3. **The extension:** download https://spare-key-app.web.app/downloads/spare-key-extension.zip, unzip it, open
   `chrome://extensions`, turn on Developer mode, Load unpacked, choose the `spare-key` folder, then click the puzzle
   piece and the key. Choose **Try a practice check first** to run it on the made-up pages.
4. **The Android app (optional):** on an Android phone, download the signed app from
   https://github.com/usv240/spare-key/releases/download/android-v0.1.0/spare-key-android.apk, allow the install for that one file, and choose
   **Try a practice phone first**.

## Code shared with the author's other entry

The Firebase AI Logic wrapper pattern, the App Check bridge for a Chrome extension and the Android shell (the wrapper,
the App Check bridge through a WebView, and shared JavaScript in Jetpack's sandbox) come from the author's other
#BuildHybridAI entry, Still Recalled. The checks, the rules, the plan, the screens, the practice pages, the planted test
app and every test are new.
