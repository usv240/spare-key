# Spare Key: experience and design

## 1. Principles

1. **Calm, not alarming.** The user is already afraid. No red sirens, no flashing, no countdowns, no exclamation marks.
   Findings are facts with a next step.
2. **Safety before features.** The safety screen comes first, Quick exit is everywhere, and nothing is saved unless
   the user asks.
3. **Honest edges.** Every result says what was checked, how, and what was not. The words "safe", "secure" and
   "all clear" never appear.
4. **Plain words first, detail one tap away.** The main flow is short sentences. The "how" and "why" sit behind "i"
   buttons and on the How it's built page.
5. **Two audiences, one product.** A survivor must finish in five minutes. A judge must understand the whole system in
   two. The site has a short tour for judges, and the product never needs it.

## 2. Writing rules

- Grade 6 to 8 reading level. Short sentences. Second person ("your account").
- **In the product, never "abuser" or "victim".** Say "someone else" or "the other person". On the landing page, facts
  may say "abusive partner".
- Digits for numbers. Dates as "November 20, 2026".
- **No emojis, no em dashes, no exclamation marks.** Use commas, colons or full stops.
- Buttons say what they do: "Start the check", "Open this setting", "Save a locked copy", not "Submit" or "Next".
- Every warning has a reason and an option: "Removing this may alert them, because their copies of your mail will stop.
  If now is not a safe time, leave it and screenshot it."
- No blame and no pressure: never "you should have", never "act now".
- Add a test that scans every UI string and fails on an em dash, an emoji, an exclamation mark, or the words "safe",
  "secure" or "all clear" (allow-list the hotline's own name and quoted sources).

## 3. The side panel, screen by screen

Width: Chrome's side panel is about 320 to 500 px. Design at 360 px, and check 320 and 500.

### 3.1 First open: the safety screen

```
+----------------------------------+
| Spare Key            [Quick exit]|
|                                  |
| Before you start                 |
|                                  |
| If someone else uses or watches  |
| this computer, they may see that |
| you ran this check. A library    |
| computer or a friend's device is |
| safer.                     (i)   |
|                                  |
| Talk to someone now, free, 24/7: |
| Call 1-800-799-7233              |
| Text START to 88788              |
|                                  |
| Quick exit: press Esc twice,     |
| or Alt+Shift+X.            (i)   |
|                                  |
| [ I understand, continue ]       |
| [ Try a practice check first ]   |
+----------------------------------+
```

### 3.2 Choose what to check

- A list grouped by company. Each row has a checkbox, the check's name, and an "i" button: "Spare Key will open your
  Google account's device page and read the list of signed-in devices. It does not click or change anything."
- The Gemini Nano status line: "Gemini Nano is ready on this computer" or "Not available. Spare Key will read pages
  with code only. (i)".
- The cloud line: "Plan help from Gemini in the cloud: on. It sees finding types only, never names. (i)" with a switch.
- Optional extras, each off by default with an "i": the Chrome extensions check, the Chrome sync check, the history
  cleanup.
- The main button "Start the check" asks Chrome for access to exactly the ticked sites. The "i" beside it shows the
  Chrome prompt the user will see, and why.

### 3.3 Scanning

- One progress line in plain words, a step count ("4 of 9"), and a thin progress bar. The scan tab beside the panel
  shows each page as it is read, which builds trust: the user watches what is opened.
- "Stop" is always available and keeps what was found so far.
- If a page needs sign-in: "You are not signed in to Gmail in this browser. Skipped. (i)" and the scan continues.

### 3.4 Results

```
+----------------------------------+
| What we found          [Quick exit]
| 9 checks, 2 skipped. (i)         |
|                                  |
| Can see your location (1)        |
|  > Shared with j****@gmail.com   |
|    Google Maps, since 2024       |
|    Removing it: they may notice  |
|    [Mine] [Not mine] [Not sure]  |
|    [Open this setting]   (i)     |
|                                  |
| Can read your mail (1)           |
|  > Forwards to j****@gmail.com   |
|                                  |
| Signed in to your account (3)    |
|  > Pixel 7, Chicago, today       |
|  > Windows PC, this computer     |
|  > iPhone, 2 weeks ago           |
|                                  |
| Not checked (4)          (i)     |
|  Ring, Life360, your phone       |
|  carrier, Apple. How to check    |
|  each one yourself >             |
|                                  |
| [ Make my plan ]                 |
+----------------------------------+
```

- Groups are ordered by risk: location, then mail, then account access, then purchases and addresses, then devices
  and browsing.
- Addresses and numbers are masked, with "Show" per item.
- Each item's "i" explains: what it is, how Spare Key found it ("read by code" or "read by Gemini Nano on this
  computer"), and what removing it does.
- An empty group is not shown. The summary line never says "nothing found". It says "9 checks done. Here is what they
  show." If nothing at all was found: "These 9 checks found no other person, device or app. Spare Key did not check:
  ... ."

### 3.5 The plan

- An optional box first: "Want the plan ordered for your situation? These answers are optional." with the four
  situation questions, each with "Prefer not to say". "i": "If you answer, Gemini in the cloud sees only your choices,
  like 'not sure', never anything about you."
- The plan is a numbered list. Each step is a card with its action type as a quiet label: Screenshot first, Talk to
  an advocate, Change now, Wait for a safer time, Check it yourself.
- Cards for changes that may be noticed always show the warning line in the caution colour.
- If the cloud asks a question (`ask_user`), it appears inline as a card: "Did you set up this forwarding yourself?"
  with Yes, No, Not sure and Skip.
- "Why this order" opens the two-voice check: two short paragraphs labelled "Close the doors" and "Stay hidden", then
  "How they settled it". Below that, any line Spare Key's safety rules added ("Spare Key added this warning").
- The footer actions are Print, Save a locked copy, and Clear everything.

### 3.6 Under the hood (a tab in the panel)

- **Where each step ran:** "Read by code", "Gemini Nano, this computer", "Gemini in the cloud", with the model name.
- **What left this computer:** the live sent log, as formatted JSON, with an "i".
- **Settings source:** "Page readers updated November 25 from Remote Config."

This tab is for judges and the curious; the main flow never needs it.

## 4. The "i" button system

- **Look:** a 20 px circle with a lowercase "i", in the muted text colour, placed right after the thing it explains.
  The hit area is at least 44 by 44 px.
- **Behaviour:** click or tap to open, never hover only. On desktop it opens a popover anchored to the button. In the
  side panel and on phones it opens a bottom sheet. Escape, a second tap or a tap outside closes it. Only one is open at
  a time. Focus moves into it and back to the button on close.
- **Accessibility:** a real `button` with `aria-expanded` and `aria-controls`, an accessible name like "About signed-in
  devices", and content in a labelled region.
- **Content:** each one has up to three parts: "What this is" (one sentence), "Why it matters" (one sentence), and an
  optional "Technical detail" expander for judges (for example "Runs on Gemini Nano with ONLY_ON_DEVICE; no cloud
  fallback").
- **One source:** all "i" text lives in `shared/info.json`, keyed by id. The site and the panel read the same file. A
  test fails if any "i" button has no entry, or any entry is unused.

## 5. The website

The site serves survivors, advocates, judges and developers. Every page has the Quick exit button (top right, also
Escape twice) and a slim safety strip with the hotline. The tab title is just "Spare Key".

### 5.1 Landing page (`index.html`), section by section

1. **Hero.**
   - Headline: "Who still has a key to your accounts?"
   - Supporting line: "Spare Key checks your Google, Gmail, Maps, Amazon and Chrome settings in about a minute. It shows
     every person, device and app that can still see your location, your mail or your account. Read-only. Names never
     leave your computer."
   - Buttons: "Add to Chrome" (primary) and "Try the practice check" (secondary).
   - On the right, or below on phones: the real side panel, built in HTML, showing the practice results. It is not a
     screenshot, and the "i" buttons in it work.
2. **Why this matters.** Three facts, each with its source link:
   - "When researchers asked AI chatbots 193 real-world questions from survivors, 60% of the answers left out critical
     safety warnings, often the warning that changing a setting can alert an abuser." (NYU Tandon, USENIX Security 2026)
   - "There are only three dedicated tech-abuse clinics in the US." (same study)
   - "Nearly 2,400 women were killed by men in 2024. 86.9% knew their killer." (Violence Policy Center, September 16, 2026)

   Then one line: "Most of the ways in were set up in trust: a shared location, a forwarded inbox, a phone that never
   signed out."
3. **How it works.** Three steps, each with an "i":
   - Check: "Spare Key opens each settings page and reads it. It never clicks or changes anything."
   - Understand: "Each person, device and app is explained in plain words, with what removing it would do."
   - Plan: "You get an order to deal with them in: what to screenshot, what is safe to change now, and what to leave
     for a safer time."
4. **What it checks.** A grid of services with the checks under each, and a clearly separate "Not checked yet" list
   (Ring, Life360, phone carriers, Apple, social apps), each linking to a trusted manual guide.
5. **What stays on your computer.** A two-column diagram: left "On your computer" (pages, names, emails, devices,
   your answers), right "Sent to Gemini in the cloud" (finding types like `gmail.forwarding.external`, your optional
   choices like "not sure"). Under it, a real excerpt from the sent log and the privacy test result ("In our test,
   0 of N requests contained a name or email address").
6. **Two voices, one plan.** "Before you see your plan, two AI voices argue over it. One argues for closing every door
   quickly. The other argues for staying hidden until it is safe. A third settles it, and Spare Key's own rules make
   sure every warning is there." An example from the practice scan.
7. **Try it yourself.** Three cards: "Practice check" (made-up person, two minutes), "Plant a test key in your own
   account" (link to plant.html), and "New here? The two-minute tour" (section 5.3).
8. **For advocates and developers.** A printable summary for advocates, the free Steps API, the MCP server, with a
   short code sample.
9. **How it's built.** A summary of the stack table (TECHNICAL-DESIGN.md section 17), with a link to the full page.
10. **How well it works.** The published numbers from EVALUATION.md, with the dates and what they do not show.
11. **Limits.** Plain bullets:
    - No survivor or advocate has tested it yet.
    - It covers these services only.
    - Pages change, and a reader can break.
    - Gemini Nano is needed for the best reading.
    - It cannot see your phone.
12. **Get help now.** The hotline, text line and website; NNEDV Safety Net (techsafety.org); and the Cornell Clinic to
    End Tech Abuse. **Verify** every number and link.
13. **Questions.** Will they know I checked? Does it change anything? What does it send to Google? What if I don't
    have Gemini Nano? Can I use it on my phone? Is it free? Who made it? Why can't a chatbot do this?
14. **Words used here.** A short glossary: Gemini Nano, the cloud, hybrid inference, finding type, App Check, Remote
    Config, advocate.
15. **Footer.** References, privacy, GitHub repository, Apache-2.0 license, the hackathon.

### 5.2 Other pages

| Page | Content |
|---|---|
| How it works | The flow in detail, the safety rules R1 to R8 in plain words, the plan order and its sources (CETA, NNEDV) |
| How it's built | The stack table, the architecture diagram, each Firebase AI Logic mode and why, function calling explained with a real exchange, the Remote Config page readers, "Authentication only for developers" and why |
| Try it (`try.html`) | The practice check in the browser (`PREFER_ON_DEVICE`), with the "Ran on this device" or "Ran in the cloud (practice data only)" label and the live sent log |
| Plant a test key | The three plant-and-undo recipes, with screenshots made from the test accounts with names masked |
| API | The static Steps API, the plan package, the MCP server config, and the keyed API if built |
| Accuracy | EVALUATION.md's published tables, methods and limits |
| Privacy | Exactly what is read, what is sent, what is stored (nothing by default), the free-tier data note, and how to remove everything |
| Safety | Hotline and guides, how to use a safer device, how to remove the extension |

### 5.3 The judge's two-minute tour

A pinned link "New here? Take the two-minute tour" opens a five-stop guided overlay (each stop highlights one part of
the page and has Next and Close):

1. "This is the problem" (the facts).
2. "Watch a check" (starts the practice check in the hero panel).
3. "See what left the computer" (opens the sent log).
4. "See the two voices" (opens Why this order).
5. "See how it's built" (scrolls to the stack).

It must never block reading, and must work with the keyboard. Remember "tour seen" in `localStorage`, wrapped in
try/catch.

## 6. Design system

### Direction

Quiet, warm and trustworthy, like a well-made paper form from a good public service. No shields, padlocks, purple
gradients, glowing orbs or photos of hurt people. The one motif is the key, drawn simply and used sparingly. The
pictures are the product itself: the real panel and real (practice) settings pages, built in HTML.

### Colour tokens (check every text pair for at least 4.5:1 contrast)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F4EE` | `#15171A` | Page background |
| `--surface` | `#FFFFFF` | `#1D2024` | Cards, panel |
| `--ink` | `#1F2328` | `#E9E6E0` | Main text |
| `--ink-2` | `#4A5058` | `#B5B1AA` | Secondary text |
| `--line` | `#DDD7CC` | `#33373D` | Dividers |
| `--accent` | `#2F5D50` | `#86C2AE` | Buttons, links, focus (deep "door" green) |
| `--on-accent` | `#FFFFFF` | `#0F1A16` | Text on accent |
| `--caution` | `#8A5200` | `#E5AE57` | "May alert them" lines, with an icon and text, never colour alone |
| `--caution-bg` | `#FBF1E1` | `#2B2318` | Caution card background |
| `--focus` | `#1F6FEB` | `#79B8FF` | 2 px focus ring, offset 2 px |

Define them on `:root`, redefine under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`,
and again under `:root[data-theme="dark"]`. A theme switch (System, Light, Dark) is in the site header and the panel
settings.

### Type

- **Atkinson Hyperlegible Next** for all text, from Google Fonts. It was designed for low-vision readers, and it suits
  a scared, tired reader. **Atkinson Hyperlegible Mono** for finding codes and the sent log. **Verify** both are on
  Google Fonts; otherwise use the original Atkinson Hyperlegible and a plain system monospace.
- Sizes: body 17 px on the site and 16 px in the panel; line height 1.5; headings 40 / 28 / 21 / 18 px on desktop,
  scaled with `clamp()` on phones. Tabular numbers for counts.
- Maximum line length 68 characters.

### Space, shape, motion

- A 4 px spacing scale (4, 8, 12, 16, 24, 32, 48, 72). The radius is 10 px for cards and 8 px for buttons. One light
  shadow for raised cards, none in dark mode (use `--line`).
- Motion only where it explains: the panel's progress bar, a card expanding (200 ms, ease-out
  `cubic-bezier(0.23, 1, 0.32, 1)`), buttons scaling to 0.97 on press. No scroll-jacking, no parallax, no entrance
  animations on text.
- Respect `prefers-reduced-motion`: no movement at all, only instant changes.

### Layout

- Site: one column at 375 px with 16 px side gutters; two columns from 900 px; content maximum 1,120 px. No horizontal
  scroll at any width.
- Hit targets at least 44 px. The Quick exit button stays visible on scroll (sticky header) and is reachable first by
  keyboard (first focusable element).

### Accessibility

- WCAG 2.2 AA: contrast, focus visible, full keyboard use, labels on every control, headings in order, `lang="en"`.
- Every icon has a text label or an accessible name. Status changes in the panel are announced with `aria-live="polite"`.
- Test with axe on every page, and a manual pass with the keyboard and with NVDA or Narrator on Windows.

## 7. States to design (do not skip)

| State | What the user sees |
|---|---|
| Gemini Nano downloading | "Gemini Nano is downloading (about 22 GB disk needed). You can check now with code only, or wait." |
| Gemini Nano not supported | "This computer can't run Gemini Nano. Spare Key will read pages with code only, and will say where that is less complete." |
| Offline or cloud off | "Your plan was made on this computer from Spare Key's steps library." No error tone. |
| Cloud rate limit | Same as above, plus "The cloud was busy. You can try again in a minute." |
| Not signed in to a service | Listed under Not checked, with "Sign in, then check again". |
| Page did not load or changed | Listed under Not checked or "Read by Gemini Nano, check it yourself". |
| Nothing found | Never "all clear". The list of checks done and Not checked. |
| Locked file wrong password | "That password does not open this file. There is no way to recover a forgotten password." |

## 8. Before calling the UI done

- Run the three design skills' checks (critique, audit and polish from `impeccable`; the screenshot review loop from
  `design-taste-frontend`; the motion and interaction rules from `emil-design-eng`).
- Screenshots at 375, 768 and 1440 px in both themes, and the panel at 320, 360 and 500 px. Look at every one.
- Run the string test (section 2), axe, and Lighthouse (aim for 95 or more on accessibility and best practices).
