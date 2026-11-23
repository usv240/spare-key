# Devpost submission text

Paste each section into the matching field of the Devpost form. Platform: **Web (Chrome)**. Every number here comes
from `docs/accuracy.md` and the saved runs in `docs/evidence/`; check them again on the day you submit.

- Project name: Spare Key
- Tagline (under 60 characters): Find out who still has a key to your accounts.
- Site: https://spare-key-app.web.app
- Try it in any browser: https://spare-key-app.web.app/try.html
- Code: https://github.com/usv240/spare-key (Apache-2.0)
- Video: (YouTube link, public, 2:34; made by `tools/record-demo.mjs` and `tools/make-video.mjs` from the real extension
  on the practice pages; upload steps in `docs/video.md`)

---

## Inspiration

When someone leaves an abusive partner, the partner often still has a way in: a phone signed in to her Google account,
mail quietly forwarded to his address, a location share she forgot, a recovery email he controls. Finding them means
visiting a dozen settings pages, each with its own words, and then deciding what to change without tipping him off,
because removing access can alert the other person, and that can be most dangerous right after leaving.

Researchers at NYU asked AI chatbots 193 real questions from survivors; 60% of the answers left out critical safety
warnings. In our own test on 30 situations, a plain chatbot said to take screenshots before changing anything in only 4,
and when mail was copied to the other person it put an account change first in 3 of 7, so Google's alert emails would
reach them. There are only three dedicated tech-abuse clinics in the US. A chatbot also cannot see your settings, and
pasting them into one sends the very names and addresses that are the danger. That is the gap Spare Key fills.

## What it does

Spare Key is a free, read-only Chrome extension for people leaving an abusive partner in the US.

1. **It checks.** It opens the person's own settings pages (signed-in devices, connected apps, recovery phone and email,
   2-Step Verification, Google location sharing, Gmail forwarding, filters and delegates, Google family group, Google
   Photos partner sharing, Amazon household and devices, Chrome extensions and sync) and reads them. It never clicks,
   types or changes anything.
2. **It shows what it found**, grouped by what the other person could do: see your location, read your mail, get into
   your account. Addresses are masked until you ask. You mark each one Mine, Not mine or Not sure. Anything it could not
   read is listed under "Not checked", never shown as empty.
3. **It makes a plan in the order the field advises**: screenshot first (the record is gone once a setting changes), talk
   to an advocate (the National Domestic Violence Hotline is on every screen), then each change, with what the other
   person will see if you make it, quoted from Google's and Amazon's own help pages where they say. If now is not a good
   time, changes the other person may notice wait.
4. **Quick exit** on every screen, a locked copy only your password opens, and "since your last check" to spot someone
   getting back in.

Nothing that names a person ever leaves the computer. A tab called "What left this computer" shows every request,
word for word, with a ledger of bytes per destination.

## How we built it: Firebase AI Logic hybrid inference

The split between the computer and the cloud is set by the problem: the settings pages are the private data. We call it
privacy-tiered routing: each step runs at the most private tier its data allows.

| Step | Where | Firebase AI Logic mode |
|---|---|---|
| Read the settings pages and sort each entry (whose is it, what can it see) | Gemini Nano | `ONLY_ON_DEVICE`, no cloud fallback on purpose |
| Read a page a site has changed, when the code reader finds nothing | Gemini Nano | `ONLY_ON_DEVICE` |
| Read a screenshot of a phone location app (Life360, Find My) | Gemini Nano with image input | `ONLY_ON_DEVICE` |
| Order the plan and explain each step | Gemini in the cloud, from finding codes only | `ONLY_IN_CLOUD` with function calling: the cloud calls `ask_device` (yes/no facts from the computer), `ask_user` and `get_steps` |
| Two voices ("close the doors" against "stay hidden") then settle | Gemini in the cloud, codes only | `ONLY_IN_CLOUD` |
| Check a step still matches the official help page | Gemini in the cloud | `ONLY_IN_CLOUD` with the URL context tool |
| "Say it more simply" on a public step, and the website's practice check | Gemini Nano, else the cloud | `PREFER_ON_DEVICE` (public or made-up text only) |

One file, `shared/cloud-safe.js`, is the only exit to the cloud. It builds each request from an allow-list of codes and
enums, then checks it again just before it is sent and refuses anything holding a name, address or device the scan
found. Code, not a model, decides what keeps a person out of danger: nine safety rules check any plan a model writes.

Also used: **App Check** with reCAPTCHA Enterprise (the extension gets tokens from a small bridge page on the site),
**Remote Config** (the page readers and the words the rules read, so a site change is fixed for every install with no
store update), **Cloud Firestore** (the public steps library, and opt-in anonymous "this page looked different"
reports), **Firebase Hosting** (the site, practice pages and a free Steps API). There is also an MCP server so an
advocate's AI assistant can give the current steps with the warnings attached.

## Challenges we ran into

- **Proving nothing leaks.** A test captures every network request the extension makes and searches it for 30 made-up
  names, emails, phones and places in four encodings: 0 of 20 requests held one, and all 9 model requests matched the
  "What left this computer" log word for word.
- **Sites change their pages.** We changed the 13 practice pages five ways by script. On the first, blind run a check said
  it was done while missing a way in 24 times. Now it does so 0 times: a page it cannot read is listed as "looked
  different". With all four changes at once, code alone shows 8 of 24 ways in, Gemini Nano 18, and a Remote Config fix
  restores 24.
- **Small models need guardrails.** In a live run, Gemini Nano called four household members the person's own, which
  would have hidden them. Now only the page's own words can mark an entry as yours. Gemini Nano's own plans needed 103
  fixes from the safety rules on 35 situations, the cloud's 43 on 30, so the cloud orders the plan by default and Nano
  is the fully private option.

## Accomplishments that we're proud of

- A plain chatbot put "screenshot before changing anything" first in 4 of 30 situations; every plan Spare Key shows does
  in 30 of 30.
- Rule R9: when mail is copied to someone else, stop that before changing recovery or 2-Step settings, because Google's
  alert emails would reach them. The chatbot got this order wrong in 3 of 7 situations where it applied.
- "What they see when you change it": 22 kinds of access, 15 of them with the official help page quoted.
- Accessibility: axe-core finds 0 violations in 60 runs (13 site pages at two widths in light and dark, and the side
  panel's screens); median reading grade 4.2 (tools/a11y-check.mjs, tools/reading-grade.mjs).
- Quick exit, tested through the real extension: the button in the middle of a check, and Escape twice, each close the
  panel and the scan tab, show an ordinary page, and leave nothing in Spare Key's storage (8 of 8 checks). With the
  history extra on, it also removes the pages the check opened from Chrome's history (not covered by the test).
- A real account, read-only: real Google and Amazon pages differed from what we expected in 5 of 12 checks (about 50
  wrong app entries, a missed recovery phone, 6 false Amazon devices). After the fixes, every check Spare Key could
  read matched what the site shows.

## What we learned

The field's advice (document first, an advocate before any change, warn that a change may be noticed) is easy to state
and easy for a model to drop. Putting it in code, and letting models only order and explain within it, made the product
both more useful and more honest about what each part does.

## What's next

- Plant known ways in on real test accounts and measure misses there (so far: one real account with nothing planted).
- Review by advocates at tech-abuse clinics, and a Chrome Web Store listing so no Developer mode is needed.
- More services: Apple and iCloud, Life360, phone carriers.

## Built with

Firebase AI Logic, Gemini Nano (Chrome built-in AI), Gemini Developer API, Firebase App Check, reCAPTCHA Enterprise,
Firebase Remote Config, Cloud Firestore, Firebase Hosting, Chrome Extensions (Manifest V3, side panel, offscreen
documents), WebCrypto, Model Context Protocol, esbuild, Puppeteer, axe-core, JavaScript.

## Testing instructions (for judges)

1. **No install, 2 minutes:** open https://spare-key-app.web.app/try.html and press Start the practice check. It reads
   13 made-up settings pages for a person called Jordan. Gemini Nano sorts the entries if your Chrome has it, Gemini in
   the cloud if not (made-up data only). Open "Break the pages first" to see what happens when a site changes its pages,
   and "Read Jordan's screenshot" for the phone app reader. Very private or automated browsers may be refused by App
   Check; the page says so, and the check still runs with code.
2. **The extension:** download https://spare-key-app.web.app/downloads/spare-key-extension.zip, unzip it, open
   `chrome://extensions`, turn on Developer mode, Load unpacked, choose the `spare-key` folder, then click the puzzle
   piece and the key. Choose **Try a practice check first** to run it on the made-up pages with nothing of yours opened.
3. **Your own account (optional):** https://spare-key-app.web.app/plant.html has three recipes to plant a harmless way
   in, run the check, and undo it.

## Code reused from before the submission period

The Firebase AI Logic wrapper pattern and the App Check bridge for a Chrome extension come from the author's other
#BuildHybridAI entry, Still Recalled. Everything else was built during the submission period.
