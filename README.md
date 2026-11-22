# Spare Key

**Find out who still has a key to your accounts.** A free, read-only Chrome extension for people leaving an abusive
partner. It reads your own settings pages (Google, Gmail, location sharing, Amazon, Chrome) and lists every person,
device and app that can still see your location, your mail or your account. Then it gives a plan in a safety-first
order: screenshot first, talk to an advocate, and leave changes the other person may notice for a better time. It
changes nothing on its own, and nothing that names a person ever leaves your computer.

Site: <https://spare-key-app.web.app> · Practice check in any browser: <https://spare-key-app.web.app/try.html>

If you need help now: National Domestic Violence Hotline, call 1-800-799-7233 or text START to 88788. Free, 24/7.

## Judge's tour

1. **Watch it work, nothing of yours involved (2 minutes).** Open <https://spare-key-app.web.app/try.html> and press
   **Start the practice check**. Spare Key reads 13 made-up settings pages for a person called Jordan with its real
   readers and finds the 24 planted ways in. Gemini sorts them: Gemini Nano on your device if Chrome has it, Gemini in
   the cloud if not (the data is made up, so the cloud is allowed here and only here).
2. **Break the pages.** Before you start, open **Break the pages first** and pick a change (reworded labels, rebuilt
   lists, all four at once). The code readers fail on some pages; watch Gemini read those pages instead, and see every
   page it cannot read listed under "Not checked" instead of shown as empty. Then tick **Apply the fix sent through
   Remote Config** and run it again: the code readers read every page again.
3. **See what left the computer.** Make the plan, then open **What left this computer**: a ledger of every request
   by destination, and every request to Gemini word for word with the fixed instructions sent with it. In the
   extension, those requests hold finding types like `gmail.forwarding.external`, never a name.
4. **What they see when you change it.** <https://spare-key-app.web.app/what-they-see.html>: for each of the 22 kinds
   of access, what the other person sees if it is removed, quoted from the official help page where one says.
5. **On your own account (optional, 5 minutes).** Install the extension (below), plant a harmless way in with a recipe
   on <https://spare-key-app.web.app/plant.html>, run the check, then undo it.

## Where each step runs, and why

The split is set by the problem: the settings pages are the private data. Spare Key uses **privacy-tiered routing**:
each step runs at the most private tier its data allows. Anything that can name a person is device only; finding types
go to whichever tier the person chooses and the measurements favour; public text goes to the cloud.

| Step | Where | Firebase AI Logic mode | Why |
|---|---|---|---|
| Read the settings pages and sort each entry | Gemini Nano | `ONLY_ON_DEVICE` | The pages name the other person. Sending them anywhere is the harm, so there is no cloud fallback, on purpose |
| Read a page the code reader cannot (a site changed it) | Gemini Nano | `ONLY_ON_DEVICE` | Same |
| Read a screenshot of a phone location app (Life360, Find My) | Gemini Nano, image input | `ONLY_ON_DEVICE` | A screenshot shows names |
| Order the plan | Gemini in the cloud if plan help is on; Gemini Nano if the person turned it off | `ONLY_IN_CLOUD` with function calling, or `ONLY_ON_DEVICE` | Finding codes only. The cloud asks the device yes/no questions (`ask_device`), the person (`ask_user`), and reads the public steps (`get_steps`). Measured on 40 frozen situations: Nano's own plans needed 100 safety-rule fixes, the cloud's 42 (17 after the two voices), so the cloud orders by default and Nano is the private option |
| Two voices ("close the doors" against "stay hidden", then settle) | Gemini in the cloud | `ONLY_IN_CLOUD` | Codes only; each voice argues from the steps library's facts |
| Check a step still matches the official help page | Gemini in the cloud | `ONLY_IN_CLOUD`, URL context | A code and a public help page |
| The practice check on the website | Either | `PREFER_ON_DEVICE` | Made-up data |

`shared/cloud-safe.js` is the only exit to the cloud. `toCloud()` builds a new object from an allow-list of codes and
enums, and `checkOutgoing()` checks every request again just before it is sent, refusing any request that holds a name,
address or device the scan found.

Also used: App Check (reCAPTCHA Enterprise; the extension gets tokens from a bridge page on the site), Remote Config
(the page readers and the words the code rules read, models and switches: a fix reaches every install the next time it
fetches, at most once an hour, with no store update), Cloud Firestore (the public steps library), Firebase Hosting (site, practice pages, Steps API).

## Results

All from scripts in `tools/`; details and limits in [docs/accuracy.md](docs/accuracy.md).

- **Practice pages:** 24 of 24 planted ways in found, 0 false alarms, code only and with Gemini Nano.
- **When a site changes its pages:** a script changed the 13 practice pages five ways. On the first, blind run, a
  check said it was done while missing a way in 24 times. Now 0 times, with code alone and with Gemini Nano: a page that
  cannot be read is listed under "Not checked". Nano reads what code cannot (pages changed all four ways: 8 of 24 shown
  by code, 19 with Nano, 24 after the Remote Config fix).
- **Privacy:** 0 of 20 requests from the extension held a name, email, phone number, device or place, in a full check
  with every cloud step on; all 9 model requests matched "What left this computer" word for word, and the panel's own
  ledger agreed (0 of 13). The cloud plan asked the device a yes/no question (`ask_device`) and got an enum back.
- **Plan safety (40 situations written before any run):** a plain chatbot put screenshots before changes in 4 of 30
  answered situations; every plan Spare Key shows does in 30 of 30, and carries the warning that a change may be noticed
  in 30 of 30. With plan help off, Gemini Nano orders
  the plan on the computer: its own plans needed 100 fixes from the safety rules on 35 answered situations, against 42
  for the cloud's (17 after the two voices), and after the rules pass every measure in 35 of 35. That measurement is why
  the cloud orders by default and Nano is the private option.

Limits: no survivor or advocate has tested it yet; the readers have not yet been measured on real test-account pages;
the free tier failed 10 of 40 plan situations (when the cloud does not answer, you get the plan made on your computer).

## Install

Spare Key is not in the Chrome Web Store yet.

1. Download [spare-key-extension.zip](https://spare-key-app.web.app/downloads/spare-key-extension.zip) and unzip it
   (or build it, below). It holds a folder called `spare-key`.
2. In Chrome, open `chrome://extensions`, turn on Developer mode, select **Load unpacked**, and choose `spare-key`.
3. Click the key in Chrome's toolbar to open the side panel.

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
```

More in [docs/dev.md](docs/dev.md). The design documents written before the build, and the build brief with its hard
rules, are in [docs/design/](docs/design/) ([BRIEF.md](docs/design/BRIEF.md) first).

## Reused code

The Firebase AI Logic wrapper pattern and the App Check bridge for a Chrome extension come from the author's other
#BuildHybridAI entry, Still Recalled, with the backend changed to the free Gemini Developer API. Everything else is new.

## License

Apache-2.0.
