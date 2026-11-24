# try.html in the builder's own Chrome, with Gemini Nano

Recorded by hand on November 22, 2026, from https://spare-key-app.web.app/try.html in the builder's everyday Chrome
(Chrome 158 on Windows, Gemini Nano available), driven through the Claude in Chrome extension. The page's own text
was read back after each step; it is copied below word for word. Automated browsers cannot run this: App Check's
reCAPTCHA refuses them (see `try-break-report.json`), so this is the only record of the Gemini path on the live site.

## Run 1: "Break the pages first", all four changes at once, no fix (about 10:00 AM Eastern)

- Start screen: "Gemini Nano is ready in this browser, so the practice entries are sorted on this device."
- Result line: "Pages changed: all four at once. The code reader read 5 of 12 checks. Gemini Nano, on this device, read 6
  more that the code could not. 1 could not be read, so it is listed under “Not checked” rather than shown as empty."
- Sorted line: "Sorted by Gemini Nano, on this device."
- Findings listed: 16 of the 24 planted ways in.
- Not checked: "Gmail forwarding: The page looked different from what Spare Key knows, so it could not tell what is
  listed."
- "Read Jordan's screenshot": "2 added to the list above. Gemini Nano read it on this device." (The made-up screenshot
  shows Sam Porter, Riley and "Me"; the two people were added and "Me" was not.) Findings listed: 18.
- What left this computer: the screenshot request was logged by the picture's name and SHA-256, not its pixels.

## Run 2: the pages as made, then the plan (about 11:00 AM Eastern, after the plan screen changes)

- Sorted line: "Sorted by Gemini Nano, on this device."
- Plan, "Start here": "Screenshot the 20 settings in step 1 ... Call or text an advocate ... Then the most urgent kind:
  your mail is being copied to another address. Leave it for a better time, and ask the advocate when."
- The plan showed 4 steps with the linked-findings note (rule R9).
- "Say it more simply" on Gmail forwarding: "In simpler words: Open Gmail settings, then Forwarding and POP/IMAP. Choose
  Disable forwarding. Select Save Changes. By Gemini Nano on this computer."

**What run 2 found wrong:** the plan said 20 settings, not 24. Gemini Nano had sorted all 24 entries in one prompt and
called four household and family members the person's own, so they were hidden. The fix, the same day: Gemini Nano may
say an entry is not the person's, never that it is (`extension/src/scan/rules.js` merge; `tests/rules.test.mjs`).

## November 24, 2026: recorded again for the video (`tools/record-break.mjs`, Chrome with Gemini Nano)

The reader was made stricter on November 23 (it skips anything on a page that is not visible), so code alone now reads
fewer of the changed pages than on November 22. The page's own result lines, all four changes at once:

- Without the fix: "Pages changed: all four at once. The code reader read 3 of 12 checks. Gemini Nano, on this device,
  read 8 more that the code could not. 1 could not be read, so it is listed under “Not checked” rather than shown as
  empty." This run took about 5 minutes: Gemini Nano read nine pages on this computer.
- With the fix: "Pages changed: all four at once, with the fix fetched from Remote Config. The code reader read 12 of
  12 checks." About 2 minutes.

The same day, the panel opened on its own address (not inside try.html) was found to read 0 of 12 pages: with no scan
view beside it, it only parsed each page, and the reader skips what is not laid out. It now reads them in a frame of
its own. The Try page was not affected.
