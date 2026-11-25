# Chrome Web Store listing (ready to paste)

For the builder's Chrome Web Store developer account. An **unlisted** listing is enough for the hackathon: judges and
advocates install it from a link, with no Developer mode. Upload `web/dist/downloads/spare-key-extension.zip` (made by
`RELEASE=1 node build.mjs`). The manifest's `key` keeps the extension ID the same as the developer build.

## Store listing

**Name:** Spare Key

**Summary (132 characters at most):**
Find out who still has a key to your accounts. Read-only: it reads your own settings pages, and names never leave your computer.

**Category:** Tools. **Language:** English (United States).

**Description:**

Spare Key is for people in the US who have left, or are planning to leave, an abusive partner, and for the advocates
who help them. It answers one question: who can still see my location, my mail or my account?

It opens your own settings pages for Google, Gmail, Google Photos and Amazon in a tab beside the side panel, reads
them, and lists every person, device and app that can still get in, grouped by what they could do. For each one it
says what the other person may notice if you remove it, quoted from the company's own help pages. Anything it could not
read is listed as not checked, never shown as empty.

Then it makes a plan that follows the field's advice: take screenshots first, talk to an advocate, and leave changes
the other person may notice for a time that is right for you. Code checks every plan against eleven safety rules.

What it never does:
- It never clicks, changes, removes or submits anything on a settings page.
- It never sends a name, email address, phone number, device or place anywhere. If you turn on plan help, the cloud
  gets finding types only (like "mail is forwarded to another address"), and every request is shown word for word under
  "What left this computer".
- It never says you are safe. It says what it checked and what it did not.

Quick exit is on every screen (the button, Escape twice, or Alt+Shift+X): it clears everything from the session and
shows an ordinary page. You can try everything first on made-up practice pages at https://spare-key-app.web.app.

Before you install: if Chrome sync is on, an extension you add from the Chrome Web Store is also added to every
computer signed in to the same Chrome profile, and it shows in the list of extensions there. If the other person uses
a computer signed in as you, turn off sync for extensions first (Chrome settings, You and Google, Sync, Manage what
you sync), or use a Chrome profile they have never used. Remove Spare Key when you are done.

National Domestic Violence Hotline: 1-800-799-7233, or text START to 88788.

**Privacy policy URL:** https://spare-key-app.web.app/privacy.html
**Homepage URL:** https://spare-key-app.web.app

## Privacy practices tab

**Single purpose:** Reads the person's own account settings pages, read-only, and lists who and what still has access,
with a safety plan.

**Permission justifications:**

| Permission | Why |
|---|---|
| `sidePanel` | The whole interface is a side panel next to the settings page it reads. |
| `storage` | Keeps the current check in session storage (cleared by Quick exit and when Chrome closes) and a few switches, such as plan help on or off. |
| `scripting` | Injects the read-only page reader into the settings page the person asked it to check. The reader never clicks, types or submits. |
| `offscreen` | Runs Gemini Nano (Chrome's built-in model) in a hidden extension page, so private page text is sorted on the device. |
| Optional hosts (myaccount.google.com, mail.google.com, photos.google.com, www.amazon.com, support.google.com) | Asked for only when the person starts a check, and only for the sites they tick. Needed to read those settings pages. |
| Host: spare-key-app.web.app/practice/* | The made-up practice pages, so anyone can try it without a real account. |
| Optional `management` | Only if the person ticks "extensions in this browser": lists extensions that can read every page. |
| Optional `identity`, `identity.email` | Only if the person ticks the Chrome sync check: which account this browser syncs to. |
| Optional `history` | Only if the person turns on "Remove the pages Spare Key opened from history". |

**Remote code:** No. All code is in the package. Remote Config sends settings (page reader patterns as data), never code.

**Data usage (check these):** Spare Key does not collect or sell user data. Website content (the settings pages) is read
on the device and is not transmitted. With plan help on, finding types (codes) are sent to Google's Gemini API through
Firebase AI Logic, with no personal information. Certify: not sold, not used for unrelated purposes, not used for
credit decisions.

## Images

- Icon: `extension/icons/icon-128.png`.
- Screenshots (1280 x 800): `node tools/store-shots.mjs` writes them to `tools/out/store/` from the demo footage; the current ones are in `docs/store/`.
- Small promo tile (440 x 280): optional.
