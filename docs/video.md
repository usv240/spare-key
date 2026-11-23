# Demo video script (under 3 minutes)

## The generated video

`node tools/record-demo.mjs --nano` records the real extension running the practice check (the made-up person
Jordan, no real account), and `node tools/make-video.mjs` turns it into `spare-key-demo.mp4` (1920 x 1080, about
2:35) with narration (edge-tts) and burned-in captions, plus `spare-key-demo.srt`. Every number in it is from
README.md "Results". Footage that runs faster than real time is labeled with its speed.

To publish: upload to YouTube as **Public**, title "Spare Key: who still has a key to your accounts? (#BuildHybridAI)",
upload the `.srt` as English captions, paste the description below, then put the link in Devpost and the README.

Description: Spare Key is a free, read-only Chrome extension for people leaving an abusive partner in the US. It reads
your own Google, Gmail and Amazon settings pages, lists who can still see your location, mail or account, and makes a
safety-first plan. Gemini Nano sorts the private pages on the device through Firebase AI Logic; the cloud sees finding
codes only. Everything shown uses made-up practice pages. Try it: https://spare-key-app.web.app. Hotline:
1-800-799-7233.

## The script below

The table is the first hand-written script; the generated video follows the same order with the narration in
`tools/make-video.mjs`.

For YouTube, public, English. Record at 1920x1080 in Chrome with Gemini Nano available. Use only the practice check and
your own test accounts: never a real survivor's account, and keep test account names, emails and passwords out of the
frame (Spare Key masks addresses until "Show details"; do not press it on a real test account). Speak slowly; the
words below are about 2 minutes 40 seconds at a calm pace.

| Time | On screen | Say |
|---|---|---|
| 0:00 to 0:15 | The landing page, then the 60% and "3 clinics" facts | "When someone leaves an abusive partner, he often still has a way in: a phone signed in to her account, mail forwarded to him, a location share. Researchers found AI chatbots left out critical safety warnings in 60% of answers to survivors' questions." |
| 0:15 to 0:30 | The extension side panel: safety screen, Quick exit button | "Spare Key is a free Chrome extension. It reads your own settings pages, changes nothing, and nothing that names a person ever leaves your computer. Quick exit is on every screen." |
| 0:30 to 1:00 | Start the check on a test account (or the practice check): pages open in the scan tab, the progress line | "It opens each settings page and reads it. Gemini Nano, running on this computer through Firebase AI Logic, sorts every entry: whose it is, and what it can see. That mode is on-device only, on purpose: these pages are the private data." |
| 1:00 to 1:20 | Results: groups, a finding card with "If you remove it, they may notice", Mine / Not mine | "It lists what it found by what the other person could do, and says what they will see if you remove it, quoted from Google's own help pages. Anything it could not read is listed as not checked, never shown as empty." |
| 1:20 to 1:50 | Make my plan: Start here, the screenshot step, the advocate step, a folded wait block with the linked-mail note | "The plan follows the field's advice: screenshot first, talk to an advocate, and wait on changes they may notice. Gemini in the cloud orders it, but it only ever sees finding codes like gmail forwarding external. Code checks every plan with nine safety rules. One of them: if your mail is copied to him, stop that first, or Google's alert emails reach him." |
| 1:50 to 2:10 | Under the hood: "What left this computer", the ledger, one request opened | "Every request to the cloud is shown here, word for word, with where it went. A test searched every request for made-up names and addresses: zero of twenty held one." |
| 2:10 to 2:35 | try.html: open "Break the pages first", choose all four, run; then the result line | "Sites change their pages. When the code reader can't read one, Gemini Nano reads it instead, and a fix can reach everyone through Remote Config with no update. A page nobody can read is never reported as empty." |
| 2:35 to 2:50 | The plan's "Say it more simply", then the hotline on screen | "Any step can be put in simpler words. And the hotline is always one tap away: 1-800-799-7233." |
| 2:50 to 2:58 | Site address | "Spare Key. Find out who still has a key to your accounts. Try it at spare-key-app.web.app." |

Before uploading: check the video is under 3:00, has English captions (YouTube auto captions, corrected), and shows no
real names, emails or phone numbers.
