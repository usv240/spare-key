# Setting up the test accounts

Spare Key's page readers need the real settings pages to read. These steps make two throwaway Google accounts, plant a
few harmless "ways in", and let Spare Key record what the pages look like. About 45 minutes. Use made-up names only, and
never use your own real accounts. Nothing here goes in the repo, screenshots or the video.

## 1. Make two Google accounts (10 minutes)

Use a separate browser window so your own accounts stay out of it: in Chrome, click your profile picture, then
**Add**, then **Continue without an account**. Do all of the Google steps in that profile.

1. Go to <https://accounts.google.com/signup>.
2. **Account A, "the person checking"**: a made-up name, for example *Jordan Testlee*. Pick a new Gmail address.
3. **Account B, "the other person"**: another made-up name, for example *Sam Testporter*. Sign out of A first, or use
   a second window of the same profile.
4. Google may ask for a phone number to verify each account. Your own number is fine; one number can verify a few
   accounts. Turn down the offers to add it for "other Google services" if you like.

Write down both addresses and passwords somewhere private (not in the repo).

## 2. Plant the ways in (25 minutes)

Each one has an undo for afterwards. Do these signed in as **Account A** unless it says otherwise.

| # | What Spare Key should find | How to plant it | Undo |
|---|---|---|---|
| 1 | A second signed-in device | Sign in to Account A in a different browser (Microsoft Edge works) | <https://myaccount.google.com/device-activity>, select it, **Sign out** |
| 2 | An app that can read Gmail | Open <https://developers.google.com/oauthplayground>. In the list, open **Gmail API v1**, tick `https://www.googleapis.com/auth/gmail.readonly`, click **Authorize APIs**, and allow it as Account A | <https://myaccount.google.com/connections>, select **Google OAuth 2.0 Playground**, remove access |
| 3 | A recovery email that is not yours | <https://myaccount.google.com/recovery/email>: set it to **Account B's** address. Google sends B a code; open B's Gmail to get it | Set it back, or remove it |
| 4 | Mail forwarded to someone else | Gmail settings (gear, **See all settings**), **Forwarding and POP/IMAP**, **Add a forwarding address**: Account B. Confirm with the code Gmail sends to B. Then choose **Forward a copy of incoming mail to** B and **Save Changes** | Choose **Disable forwarding**, save |
| 5 | A filter that forwards mail | Gmail search box, the filter icon: **Subject** `test-forward`, **Create filter**, tick **Forward it to** B | **Filters and Blocked Addresses**, delete it |
| 6 | A filter that hides mail | Same, **Subject** `test-hide`, tick **Skip the Inbox (Archive it)** | Delete it |
| 7 | Someone who can open your Gmail | Gmail settings, **Accounts and Import**, **Grant access to your account**: add B. Open B's Gmail and accept (it can take up to 30 minutes to start) | Delete B there |
| 8 | Someone who can see your location | This one needs a phone. In the **Google Maps** app, add Account A, then your picture, **Location sharing**, **New share**, **For 1 hour**, choose Account B | It ends by itself after an hour |

Optional, if you have time: a Google family group with B as the manager (<https://families.google/families>), and
Google Photos partner sharing with B. Amazon is optional too; skip it for now.

Also leave a few things that are **yours**, so Spare Key can be tested for false alarms: the computer you use, your
own phone number as the recovery phone, and an app you really use.

## 3. Let Spare Key record the pages (10 minutes)

Tell Claude "ready". Claude then runs `node tools/record-pages.mjs --login`, which opens a separate Chrome window
(its own profile on E:, not your normal Chrome):

1. In that window, sign in to **Account A only**. If you set up Amazon, sign in to the Amazon test account too.
2. Close the window.

Claude then runs `node tools/record-pages.mjs`. It opens each settings page, reads it without clicking anything, and
saves the structure to `private/pages/` (git-ignored), with addresses and phone numbers masked. If you want the
test names masked too, tell Claude the two made-up names and it will add them to `private/test-accounts.local.json`,
which never leaves your computer.

If Google asks you to "verify it's you" on the recovery or 2-Step Verification pages, that is expected: Spare Key
reports it as "asked for your password" instead of reading the page.
