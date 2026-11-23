# Evidence

The saved runs behind the numbers in [docs/accuracy.md](../accuracy.md), copied from `tools/out/` by
`node tools/save-evidence.mjs`. Everything here comes from made-up practice data for a person called Jordan, except
real-account.json, which holds only check names, finding codes and counts from the builder's own account. Run the
same tools to make your own.

| File | What it is |
|---|---|
| [privacy-report.json](privacy-report.json) | The privacy test (tools/privacy-test.mjs): every request, the canaries searched for, the sent log, the ledger. |
| [drift.json](drift.json) | Layout drift, code only and with the Remote Config fixes (tools/drift-test.mjs). |
| [drift-nano.json](drift-nano.json) | Layout drift with Gemini Nano (tools/drift-test.mjs --nano). |
| [drift-first-run.json](drift-first-run.json) | Layout drift, the first and blind run, before any change made after seeing the changed pages. |
| [plan-eval-cloud.json](plan-eval-cloud.json) | Plan safety: the plain chatbot, the cloud plan and the two voices on 40 situations (tools/plan-eval-cloud.mjs). |
| [plan-eval-cloud.log](plan-eval-cloud.log) | The same run's log, with each failure. |
| [plan-eval-nano.json](plan-eval-nano.json) | Plan safety: Gemini Nano's plans on the same 40 situations (tools/plan-eval-nano.mjs). |
| [plan-eval-cloud-summary.json](plan-eval-cloud-summary.json) | All plan safety scores, made offline from the two runs above (tools/plan-eval-score.mjs). |
| [screenshot-check.json](screenshot-check.json) | Gemini Nano reading a made-up phone sharing screen (tools/screenshot-check.mjs). |
| [screenshot-check.png](screenshot-check.png) | The made-up screen it read. |
| [e2e-e2e-practice.json](e2e-e2e-practice.json) | The practice check through the real extension, code only (tools/e2e-practice.mjs). |
| [e2e-e2e-practice-nano.json](e2e-e2e-practice-nano.json) | The same through the real extension with Gemini Nano (tools/e2e-practice.mjs --nano), November 22 or later. |
| [try-live.json](try-live.json) | The live practice check page in an automated browser (tools/try-live.mjs). |
| [try-break-report.json](try-break-report.json) | "Break the pages first" in an automated browser (tools/try-break.mjs). App Check refuses automated browsers, so Gemini was not asked there. |
| [e2e-quick-exit.json](e2e-quick-exit.json) | Quick exit through the real extension: the button mid-scan, one Escape, Escape twice (tools/e2e-quick-exit.mjs). |
| [a11y.json](a11y.json) | axe-core on every site page (375 and 1280 px, light and dark) and the real side panel's screens (tools/a11y-check.mjs). |
| [reading-grade.json](reading-grade.json) | Flesch-Kincaid grade of the site pages and the side panel (tools/reading-grade.mjs). |
| [try-html-live-chrome.md](try-html-live-chrome.md) | try.html in the builder's own Chrome with Gemini Nano: what the page said, word for word (written by hand). |
| [real-account.json](real-account.json) | The builder's own account, read-only: per check, what the site shows and what the reader found before and after each fix, codes and counts only (tools/real-inpage.mjs, run by hand inside each page). |

An earlier end-to-end run with Gemini Nano did not complete (the PC was out of memory) and is not kept; the run here
is the later one that finished.
