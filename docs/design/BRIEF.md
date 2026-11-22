# Spare Key: build plan

**Spare Key finds out who still has a key to your accounts.** It is a Chrome extension and website for people leaving an
abusive partner. It reads your own logged-in settings pages (Google, Gmail, Maps, Amazon, Chrome itself) and lists every
person, device and app that can still see your location, your mail or your account. Then it gives a safety-first plan
for each one. It changes nothing on its own. Nothing that names a person ever leaves the computer.

This folder is the brief for the build. Read the documents in this order:

| File | What it decides |
|---|---|
| [PLAN.md](PLAN.md) | The problem, who it is for, scope, how it wins each judging criterion, rules checklist, day-by-day schedule |
| [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md) | Architecture, every component, data schemas, prompts, Firebase products, API, cost controls |
| [EXPERIENCE.md](EXPERIENCE.md) | Screens, safety UX, landing page content, the "i" buttons, design system, light and dark, phone and desktop |
| [EVALUATION.md](EVALUATION.md) | How accuracy, privacy and plan safety are measured, and which numbers get published |

## Hard rules for whoever builds this

1. **Nothing that names a person leaves the computer.** No name, email address, phone number, device name, address or
   page text is ever sent to the cloud, to Firestore or to any log. The cloud gets finding codes only (for example
   `gmail.forwarding.external`). The privacy test in [EVALUATION.md](EVALUATION.md) has to pass before any release.
2. **Read-only.** The extension never clicks, changes, removes or submits anything on a settings page. It only opens a
   page and reads it.
3. **Never say "safe".** It says what it checked, what it found and what it did not check.
4. **Cost stays at about $0.** Use a new Firebase project on the free Spark plan and the Gemini Developer API free tier
   (`GoogleAIBackend`). Do not use Vertex AI or the Agent Platform backend. Call the cloud one request at a time, and
   cache the results. Before any test run that makes more than about 50 cloud calls, say how many and ask the user.
5. **No emojis and no em dashes** anywhere: not in UI text, docs, the site, commit messages or the video script.
6. **Simple words.** Write for someone who is scared, tired and reading on a phone. Aim for a grade 6 to 8 reading
   level. Technical detail goes behind an "i" button or on the "How it's built" page, never in the main flow.
7. **US only.** US resources, US services, English.
8. **Secrets.** Never commit an App Check debug token, a service account key, `.env` files or test account passwords.
   Test accounts are the builder's own and stay out of the repo, screenshots and video.
9. **Design skills.** If the builder is Claude Code, load the `impeccable`, `design-taste-frontend` and
   `emil-design-eng` skills in `~/.claude/skills` before any UI work. Do not install Impeccable's hooks or download its
   engine binary without asking. If the builder is another agent, follow [EXPERIENCE.md](EXPERIENCE.md) exactly.
10. **Use Firebase Agent Skills** (the rules recommend them for coding agents) when wiring Firebase.

## Reuse from Still Recalled (disclose it in the write-up)

The sibling project `../still-recalled` already solved these problems; copy the pattern, not the product:

- `still-recalled/extension/src/ai.js`: Firebase AI Logic wrapper with `deviceModel` (`ONLY_ON_DEVICE`), `cloudModel`
  (`ONLY_IN_CLOUD`), `hybridModel` (`PREFER_ON_DEVICE`), function calling (`askWithTool`), model fallback list from
  Remote Config, and `deviceStatus`. Change the backend to `GoogleAIBackend` for the free tier.
- `still-recalled/web/appcheck-bridge.html` and its `bridge.js`: App Check tokens for a Chrome extension, which has no
  attestation provider. The extension's offscreen page frames a page on the site that runs reCAPTCHA and answers
  `postMessage` only from the extension's origin.
- `still-recalled/tools/e2e.mjs`: driving a packed extension in Chrome with Puppeteer for end-to-end tests.

The free tier answered only about 3 concurrent calls when Still Recalled tested it on 2026-11-16, so queue cloud calls
one at a time.
