# Building and testing Spare Key

Commands run from the `spare-key` folder. Node 20 or later, Chrome, and (for the icons) ffmpeg.

| What | Command |
|---|---|
| Install | `npm install` |
| Build (development) | `node build.mjs` (uses `extension/appcheck-debug.local.js` if present) |
| Build (release, nothing secret inside) | `RELEASE=1 node build.mjs` |
| Unit tests | `node --test tests/*.test.mjs` |
| Day 1 check, no Gemini Nano | `node tools/day1-check.mjs --headful` (1 cloud call) |
| Day 1 check with Gemini Nano | `node tools/day1-check.mjs --nano` (1 cloud call; needs the profile below) |
| Make the Gemini Nano test profile | `node tools/nano-profile.mjs` (about 4 GB, on `E:/spare-key-test/nano-profile`) |
| Panel screenshots, 320/360/500 px, light and dark | `node tools/panel-shots.mjs` (to `.impeccable/review/panel/`) |
| Publish Remote Config defaults | `node tools/remote-config.mjs --publish` (uses your gcloud login) |
| Deploy the site | `RELEASE=1 node build.mjs`, then `npx -y firebase-tools@latest deploy --only hosting --project spare-key-app` |
| Record the test accounts' settings pages | `node tools/record-pages.mjs --login` once, then `node tools/record-pages.mjs` |
| Readers and rules on the practice pages, code only, no extension | `node tools/reader-test.mjs` |
| Practice check end to end, code only | `node tools/e2e-practice.mjs` (needs the practice pages deployed; no cloud calls) |
| Practice check end to end with Gemini Nano | `node tools/e2e-practice.mjs --nano` (add `--screens` for screenshots) |
| Layout drift: the practice pages changed five ways | `node tools/drift-test.mjs` (code and the Remote Config fixes; add `--nano` for Gemini Nano; no cloud calls) |
| Plan safety, the plan made by Gemini Nano | `node tools/plan-eval-nano.mjs` (40 situations, on this computer), then `node tools/plan-eval-score.mjs` |
| Plan safety, rescore the saved cloud run | `node tools/plan-eval-score.mjs` (offline) |
| Phone screenshot reading with Gemini Nano | `node tools/screenshot-check.mjs` (a made-up sharing screen; no cloud calls) |
| Plan screen screenshots | `node tools/plan-shots.mjs` |
| Privacy test | `node tools/privacy-test.mjs` (about 9 cloud calls) |
| The opt-in layout report, end to end | `node tools/layout-report-check.mjs` (one Firestore write, marked selftest; no model calls) |
| Copy the saved runs into `docs/evidence/` | `node tools/save-evidence.mjs` (refuses a file holding the debug token) |
| "Break the pages first" and the phone screenshot on the live site | `node tools/try-break.mjs` (about 12 cloud calls; automated browsers are refused by App Check) |

Load the extension by hand: `chrome://extensions`, turn on Developer mode, Load unpacked, pick `extension/`. Its id is
always `opmpimgddnahhbmhioookicpekibjahl` (fixed by the `key` in `manifest.json`).

## Never commit

`extension/appcheck-debug.local.js` (the App Check debug token), anything in `private/` (the extension's signing key,
test account notes, recorded pages and screenshots), and `tools/out/`. `.gitignore` covers all of them.

## Cost

The Firebase project is on the free Spark plan with no billing account, and the models are on the Gemini Developer API
free tier. Cloud calls go one at a time. Ask before any test run that makes more than about 50 cloud calls.
