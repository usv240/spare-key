# Evidence

The saved runs behind the numbers in [docs/accuracy.md](../accuracy.md), copied from `tools/out/` by
`node tools/save-evidence.mjs`. Everything here comes from made-up practice data for a person called Jordan. Run the
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
| [e2e-e2e-practice-nano.json](e2e-e2e-practice-nano.json) | The same with Gemini Nano (tools/e2e-practice.mjs --nano). |
| [try-live.json](try-live.json) | The live practice check page in an automated browser (tools/try-live.mjs). |
| [try-break-report.json](try-break-report.json) | "Break the pages first" in an automated browser (tools/try-break.mjs). App Check refuses automated browsers, so Gemini was not asked there. |
