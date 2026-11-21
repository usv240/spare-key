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

Load the extension by hand: `chrome://extensions`, turn on Developer mode, Load unpacked, pick `extension/`. Its id is
always `opmpimgddnahhbmhioookicpekibjahl` (fixed by the `key` in `manifest.json`).

## Never commit

`extension/appcheck-debug.local.js` (the App Check debug token), anything in `private/` (the extension's signing key,
test account notes, recorded pages and screenshots), and `tools/out/`. `.gitignore` covers all of them.

## Cost

The Firebase project is on the free Spark plan with no billing account, and the models are on the Gemini Developer API
free tier. Cloud calls go one at a time. Ask before any test run that makes more than about 50 cloud calls.
