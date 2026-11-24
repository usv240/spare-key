// The Android app's rules engine: the same shared modules the Chrome extension and the website run (shared/), bundled
// by build.mjs into android/app/src/main/assets/engine.js and run in Jetpack's JavaScript sandbox
// (androidx.javascriptengine), an isolated process with no network and no files. Kotlin reads the phone and makes every
// model call through Firebase AI Logic; everything that decides runs here, so the phone and the extension cannot drift
// apart: the same finding codes, the same cloud gate (toCloud, checkOutgoing), the same plan and safety rules.
// Pattern reused from the author's Still Recalled entry.
//
// Every function takes plain JSON values and returns a JSON string (the sandbox passes strings).
import { phoneFindings, phoneAnswer, APP_KIND_SYSTEM, APP_KIND_SCHEMA, appKindText, appKindFrom } from '../../shared/phone.js';
import { toCloud, checkOutgoing, checkAnswer } from '../../shared/cloud-safe.js';
import { buildPlan } from '../../shared/plan/engine.js';
import { applyInvariants, cleanText } from '../../shared/plan/invariants.js';
import { PLAN_SYSTEM, PLAN_SCHEMA, PLAN_TOOLS, DEVICE_QUESTIONS, USER_QUESTIONS, devicePlanSystem } from '../../shared/plan/prompts.js';
import { libraryMap } from '../../shared/steps-schema.js';
import { CODE_TEXT, GROUP_LABELS, GROUPS, SITUATION, SITUATION_DEFAULTS } from '../../shared/findings.js';
import STEPS from '../../data/steps.json';

const out = v => JSON.stringify(v === undefined ? null : v);
const LIBRARY = libraryMap(STEPS);
let scan = null;      // { findings, outcomes } of the last check, on the phone only
let refs = {};        // cloud ref (f1) -> finding ref (P1), for the last toCloud()

globalThis.SK = {
  library() { return out({ version: STEPS.version, updated_at: STEPS.updated_at, entries: LIBRARY, codeText: CODE_TEXT, groups: GROUPS, groupLabels: GROUP_LABELS, situation: SITUATION }); },

  // ---- The check ------------------------------------------------------------------------------------------------
  appKindPrompt() { return out({ system: APP_KIND_SYSTEM, schema: APP_KIND_SCHEMA }); },
  appKindText(app) { return out(appKindText(app)); },
  appKindFrom(answer) { return out(appKindFrom(answer)); },
  /** facts: PhoneScan.kt's result. nano: { pkg: { kind, about } } from Gemini Nano on the phone. */
  findings(facts, nano) { scan = phoneFindings(facts, { nano: nano || {} }); return out(scan); },
  setOwnership(ref, ownership) {
    const f = scan?.findings.find(x => x.ref === ref);
    if (f) f.ownership = ['mine', 'not_mine', 'unsure'].includes(ownership) ? ownership : null;
    return out(!!f);
  },

  // ---- The plan --------------------------------------------------------------------------------------------------
  /** The plan made by code, always shown first, and the body the cloud would get (codes and chosen answers only). */
  codePlan(situation, notChecked) {
    const findings = scan?.findings || [];
    const ctx = { findings, situation: { ...SITUATION_DEFAULTS, ...situation }, notChecked: notChecked || [], library: LIBRARY };
    return out(applyInvariants(buildPlan(ctx), ctx));
  },
  /** toCloud(): the only thing that may leave the phone. Also checked again, the same way the extension checks it. */
  cloudBody(situation, shared, notChecked) {
    const r = toCloud(scan?.findings || [], { situation, shared: shared || {}, notChecked: notChecked || [] });
    refs = r.refs;
    const privateStrings = (scan?.findings || []).flatMap(f => [f.label, f.detail, f.pkg]).filter(Boolean);
    const text = checkOutgoing('plan', r.body, { privateStrings, library: LIBRARY });
    return out({ body: r.body, text });
  },
  planPrompt(body) { return out({ system: PLAN_SYSTEM, schema: PLAN_SCHEMA, tools: PLAN_TOOLS, deviceSystem: devicePlanSystem(body, LIBRARY) }); },
  /** A function call from the cloud plan, answered here. Returns the answer object, already checked. */
  answerCall(name, args) {
    let answer;
    if (name === 'get_steps') {
      const codes = [...new Set(Array.isArray(args?.codes) ? args.codes : [])].filter(c => LIBRARY[c]).slice(0, 30);
      answer = codes.length ? { entries: Object.fromEntries(codes.map(c => [c, LIBRARY[c]])) } : { note: 'Unknown function.' };
    } else if (name === 'ask_device' && DEVICE_QUESTIONS.includes(args?.question)) {
      const f = scan?.findings.find(x => x.ref === refs[args.ref]);
      answer = { answer: phoneAnswer(f, args.question) };
    } else answer = { note: 'Unknown function.' };
    const privateStrings = (scan?.findings || []).flatMap(f => [f.label, f.detail, f.pkg]).filter(Boolean);
    return out(checkAnswer(name, answer, { privateStrings, library: LIBRARY }));
  },
  userQuestions() { return out(USER_QUESTIONS); },
  /** A model's plan (cloud refs) mapped back to findings and passed through the safety rules. */
  settle(answer, situation, notChecked) {
    const findings = scan?.findings || [];
    const actions = (answer?.actions || []).map(a => ({ action: a.action, refs: (Array.isArray(a.refs) ? a.refs : []).map(r => refs[r]).filter(Boolean), why: cleanText(String(a.why || '')).text }));
    const ctx = { findings, situation: { ...SITUATION_DEFAULTS, ...situation }, notChecked: notChecked || [], library: LIBRARY };
    return out(applyInvariants({ actions, summary: cleanText(String(answer?.summary || '')).text }, ctx));
  },
};
