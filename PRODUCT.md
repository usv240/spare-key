# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Chrome extension (Manifest V3, side panel) built with esbuild, plus a website on Firebase Hosting in plain HTML, CSS
and JavaScript built with Vite. No UI framework. Firebase AI Logic (`firebase` 13.3.0, Gemini Developer API free tier),
App Check, Remote Config, Firestore, Hosting. Confirmed by the owner from TECHNICAL-DESIGN.md on November 21, 2026.

## Users

- **First:** an adult in the US who has left, or is planning to leave, an abusive partner and wants to know what that
  person can still see. She may be scared, short on time, reading on a phone or a small side panel, and on a shared
  or watched device.
- **Second:** domestic-violence advocates and hotline staff, who help many survivors and have no tool for this. They
  use the same extension, a printable summary, and a free Steps API.
- **Third:** hackathon judges, who must be able to try it on their own account in two minutes without any abuse
  situation, and see that it works and that nothing personal left their computer.

## Product Purpose

Spare Key finds out who still has a key to your accounts. It reads the person's own logged-in settings pages (Google,
Gmail, location sharing, Amazon, Chrome itself) and lists every person, device and app that can still see their
location, their mail or their account. Then it gives a safety-first plan for each one. It changes nothing on its own.

Success: a survivor finishes in about five minutes with an ordered plan they trust, knowing what was checked and what
was not; a judge understands the whole system in two minutes.

## Positioning

It turns a tech-abuse clinic's manual protocol (identify who has access, account by account) into a one-minute
automated, read-only check across several companies, and it does so without the private data leaving the computer:
Gemini Nano reads the pages on the device, and the cloud sees only finding codes and enums ("the cloud asks, the
device answers in enums"). Its plans are built around the field's two rules: document before you change anything,
and changing something can alert the other person.

## Operating Context

- Runs in Chrome's side panel next to one scan tab that visibly opens each settings page; a website hosts the landing
  page, a practice scan with a made-up person (Jordan), "plant a test key" recipes, docs, and the Steps API.
- The person may need to leave instantly: Quick exit is on every screen (button, Escape twice, Alt+Shift+X).
- Nothing is saved by default; the person can print, save a password-locked file, or clear everything.
- Advocates receive a printable summary; developers and hotline software use the static Steps API and an MCP server.

## Capabilities and Constraints

- **Nothing that names a person leaves the computer.** The cloud gets finding codes and enums only; `toCloud()` is the
  only exit, and every request is shown word for word under "What left this computer".
- **Read-only.** Never clicks, changes, removes or submits anything on a settings page.
- **Never says "safe", "secure" or "all clear".** Always shows what was checked, what was found and what was not checked.
- Gemini Nano (`ONLY_ON_DEVICE`) reads private pages with no cloud fallback; without Nano, code readers run alone and
  the result says so. The cloud (`ONLY_IN_CLOUD`) orders the plan, runs the two-voice check and the steps freshness
  check. Hybrid (`PREFER_ON_DEVICE`) only for public or made-up text.
- Cost about $0: Spark plan, free-tier models, one cloud call at a time.
- US only, English. Grade 6 to 8 reading level. No emojis, no em dashes, no exclamation marks.
- In the product, never "abuser" or "victim": "someone else" or "the other person".

## Brand Commitments

- Name: Spare Key. Icon: a plain key, with no shield, no heart and no purple; the toolbar never shows a badge or count.
- Voice: calm, plain, honest about limits, no blame and no pressure ("never 'you should have', never 'act now'").
- EXPERIENCE.md is binding for the design system: its colour tokens (deep "door" green accent, warm paper background,
  caution amber), Atkinson Hyperlegible Next and Mono, spacing, radius, motion and the "i" button system.

## Evidence on Hand

- Dated third-party facts with sources in PLAN.md section 1 (NYU Tandon study, USENIX Security 2026; three US
  tech-abuse clinics; Violence Policy Center 2026; Cornell CETA; DefaultPrivacy). Re-check each figure before publishing.
- Measurements come only from the five tests in EVALUATION.md; none exist yet.
- No survivor or advocate has tested it. Never invent testimonials, users or numbers.

## Product Principles

1. Safety before features: the safety screen first, Quick exit everywhere, nothing kept unless asked.
2. Honest edges: every result names what was checked, how, and what was not.
3. Every finding ends in something to do: screenshot, open the setting, wait, or talk to an advocate.
4. The data is the danger: private pages are read on the device, and the cloud never learns who anyone is.
5. Plain words first, detail one tap away behind an "i" button.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast, visible focus, full keyboard use, labels on every control, headings in order, `lang="en"`.
Hit targets at least 44 px. Status changes announced politely. Respect reduced motion. Designed for low-vision,
scared and tired readers (hence Atkinson Hyperlegible). Test with axe and with NVDA or Narrator.
