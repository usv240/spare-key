// The two-voice check (TECHNICAL-DESIGN.md section 9.2). Three short cloud calls after the draft plan, each seeing only
// finding codes, the person's shared answers and the draft:
//   Close the doors  argues what the other person can do while each access stays open, and what to change soon
//   Stay hidden      argues which changes could be noticed, what could happen then, and what to screenshot or delay
//   Settle           reads the draft and both arguments and returns a revised plan, with one line for each voice
// It exists because a study found single chatbots "frequently failed to warn that making changes could alert an
// abuser": one voice exists only to make that argument. The settled plan still passes the safety rules.
import { cloudJson } from '../ai.js';
import { PLAN_SCHEMA } from './plan.js';
import { cleanText } from '../../../shared/plan/invariants.js';

const COMMON = `You see only finding codes, the person's chosen answers and a draft plan, never names or details.
Write in plain words, at a grade 6 reading level, with no names, addresses, phone numbers or links.
Never call anything safe or secure, and never say there is nothing to worry about.`;

const VOICES = {
  close_the_doors: `You are one of two advisers. Argue for closing access soon.
For the findings that matter most, say what the other person can do while each stays open, and which steps should come first.
At most 120 words.
${COMMON}`,
  stay_hidden: `You are one of two advisers. Argue for staying hidden until it is a better time.
Say which changes the other person could notice, what could happen if they notice, and what to screenshot or delay.
At most 120 words.
${COMMON}`,
  settle: `Two advisers argued about this draft plan: one for closing access soon, one for staying hidden.
Read the draft and both arguments, then return a revised plan in the same shape as the draft:
one "document" step with every finding that is not "mine", one "talk_to_advocate" step, one step per finding code ("change_now" or "wait"), and one "check_manually" step per item in not_checked.
When safe_to_change_now is not "yes", anything the other person could notice waits.
Also return one short line summing up each adviser.
${COMMON}`,
};

const ARGUMENT_SCHEMA = { type: 'object', properties: { argument: { type: 'string', maxLength: 900 } }, required: ['argument'] };
const SETTLE_SCHEMA = {
  type: 'object',
  properties: {
    ...PLAN_SCHEMA.properties,
    close_the_doors_line: { type: 'string', maxLength: 160 },
    stay_hidden_line: { type: 'string', maxLength: 160 },
  },
  required: [...PLAN_SCHEMA.required, 'close_the_doors_line', 'stay_hidden_line'],
};

const REF = /^f\d{1,3}$/;
const ACTIONS = ['document', 'talk_to_advocate', 'change_now', 'wait', 'check_manually'];

/** A draft trimmed to the shape the outgoing check allows: refs, action and a short "why", cleaned of contact details. */
export function draftForCloud(answer) {
  const clean = (s, max) => cleanText(String(s || '').slice(0, max)).text.slice(0, max);
  return {
    actions: (answer?.actions || []).filter(a => ACTIONS.includes(a?.action)).slice(0, 60).map(a => ({
      refs: (Array.isArray(a.refs) ? a.refs : []).filter(r => REF.test(r)).slice(0, 200),
      action: a.action,
      why: clean(a.why, 160),
    })),
    summary: clean(answer?.summary, 240),
  };
}

/**
 * Run the three voices. `scan` is the toCloud() body, `draft` the cloud plan's answer (cloud refs).
 * Returns { answer: settled plan (cloud refs), lines: { close_the_doors, stay_hidden }, arguments, model }.
 */
export async function twoVoices({ scan, draft, privateStrings, library, onSend }) {
  const base = { scan, draft: draftForCloud(draft) };
  const ask = (voice, extra = {}, schema = ARGUMENT_SCHEMA) => cloudJson({
    purpose: 'voices', body: { ...base, draft: { ...base.draft, ...extra }, voice }, system: VOICES[voice], schema, privateStrings, library, onSend,
  });
  const close = await ask('close_the_doors');
  const hidden = await ask('stay_hidden');
  const args = {
    close_the_doors: cleanText(String(close.answer.argument || '').slice(0, 900)).text,
    stay_hidden: cleanText(String(hidden.answer.argument || '').slice(0, 900)).text,
  };
  const settled = await ask('settle', { arguments: args }, SETTLE_SCHEMA);
  return {
    answer: { actions: settled.answer.actions, summary: settled.answer.summary },
    lines: { close_the_doors: settled.answer.close_the_doors_line, stay_hidden: settled.answer.stay_hidden_line },
    arguments: args,
    model: settled.model,
  };
}
