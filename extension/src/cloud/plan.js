// The cloud plan (TECHNICAL-DESIGN.md section 9.1). Gemini in the cloud orders the plan from finding codes and the
// person's chosen answers only. When it needs a fact, it asks: get_steps reads the public steps library, ask_device
// gets a yes / no / unknown about one finding from this computer, and ask_user asks the person a yes / no / not sure
// question in the panel. Every answer is an enum or public library text, checked by shared/cloud-safe.js before it goes.
// The plan that comes back still passes the safety rules (shared/plan/invariants.js) before anyone sees it.
import { cloudJson } from '../ai.js';
import { CODES } from '../../../shared/findings.js';

export const DEVICE_QUESTIONS = ['filter_also_deletes', 'forwarding_is_only_copy', 'device_active_this_week', 'app_can_read_mail', 'app_can_see_location', 'more_items_hidden', 'shared_with_link'];
export const USER_QUESTIONS = ['recognise_this', 'set_up_by_you', 'still_need_this', 'they_know_you_use_this'];

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const enumOf = (values, description) => ({ type: 'string', format: 'enum', enum: values, description });

export const PLAN_TOOLS = [{
  functionDeclarations: [
    {
      name: 'get_steps',
      description: 'Read the steps library entries for finding codes: what each means, whether a change may be noticed, what to screenshot, the steps, and what to do if now is not a good time. Ask for all the codes you need in one call.',
      parameters: { type: 'object', properties: { codes: { type: 'array', items: enumOf(Object.keys(CODES), 'A finding code from the request.') } }, required: ['codes'] },
    },
    {
      name: 'ask_device',
      description: 'Ask this computer a yes or no question about one finding. The answer is yes, no or unknown.',
      parameters: { type: 'object', properties: { ref: str('A finding ref from the request, like f1.'), question: enumOf(DEVICE_QUESTIONS, 'The question.') }, required: ['ref', 'question'] },
    },
    {
      name: 'ask_user',
      description: 'Ask the person a question about one finding, with the answers yes, no or not sure. Use it only when the answer would change the order, at most two times.',
      parameters: { type: 'object', properties: { ref: str('A finding ref from the request, like f1.'), question: enumOf(USER_QUESTIONS, 'The question.') }, required: ['ref', 'question'] },
    },
  ],
}];

// The instructions the cloud plan and the plan on this computer (extension/src/device-plan.js) share.
export const PLAN_INTRO = `You help a person decide the order in which to deal with access other people have to their accounts.
You see only finding codes and the person's chosen answers, never names or details. A finding with ownership "not_mine" or "unsure" gives someone else access; "mine" belongs to the person.
Rules you must follow: document before changing anything; warn whenever a change may be noticed;
when it may not be a good time to change things (safe_to_change_now is not "yes", or not given), say to wait and to talk to an advocate; never call anything safe or secure, and never say there is nothing to worry about.`;
export const PLAN_SHAPE = `Return the plan as JSON that follows the schema, in this shape:
1. One "document" step whose refs are every finding that is not "mine".
2. One "talk_to_advocate" step.
3. One step per finding code: put every ref with that code in the same step, as "change_now" or "wait". Every finding that is not "mine" must be in exactly one of these steps. Put first the codes that give the most access (mail, location, getting into the account).
4. One "check_manually" step for each item in not_checked.
Each "why" is one or two short sentences in plain words, at a grade 6 reading level, about that step only, with no names, addresses, phone numbers or links. The summary is two sentences at most.`;

const PLAN_SYSTEM = `${PLAN_INTRO}
Use get_steps once, with every code you need, to read the steps. In the same turn, call ask_device for the facts that
decide the order, at most 4 calls in all: for a gmail.filter.hides finding, filter_also_deletes (a filter that deletes
mail is more urgent); for a gmail.forwarding.external finding, forwarding_is_only_copy; for a google.devices.other
finding with recency "unknown", device_active_this_week. Put the findings the answers make more urgent first.
Use ask_user only when the answer would change the order, at most two times.
${PLAN_SHAPE}`;

export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          refs: { type: 'array', items: { type: 'string' } },
          action: { type: 'string', enum: ['document', 'talk_to_advocate', 'change_now', 'wait', 'check_manually'] },
          why: { type: 'string', maxLength: 160 },
        },
        required: ['refs', 'action', 'why'],
      },
    },
    summary: { type: 'string', maxLength: 240 },
  },
  required: ['actions', 'summary'],
};

/**
 * Ask the cloud for a plan. `body` is toCloud() output; `ask(kind, args)` answers ask_device and ask_user on this
 * computer (the panel holds the findings). Returns { answer, model }.
 */
export async function cloudPlan({ body, library, privateStrings, ask, onSend }) {
  // How often the cloud called each function, for the accuracy page: does it really ask the device?
  const calls = { get_steps: 0, ask_device: 0, ask_user: 0, other: 0 };
  const onCall = async (name, args) => {
    calls[Object.hasOwn(calls, name) ? name : 'other']++;
    if (name === 'get_steps') {
      const codes = [...new Set([...(Array.isArray(args.codes) ? args.codes : []), ...(args.code ? [args.code] : [])])].filter(c => library[c]).slice(0, 30);
      return codes.length ? { entries: Object.fromEntries(codes.map(c => [c, library[c]])) } : { note: 'Unknown function.' };
    }
    if (name === 'ask_device' && DEVICE_QUESTIONS.includes(args.question) && /^f\d{1,3}$/.test(args.ref || '')) {
      return { answer: await ask('device', args) };
    }
    if (name === 'ask_user' && USER_QUESTIONS.includes(args.question) && /^f\d{1,3}$/.test(args.ref || '')) {
      return { answer: await ask('user', args) };
    }
    return { note: 'Unknown function.' };
  };
  const r = await cloudJson({ purpose: 'plan', body, system: PLAN_SYSTEM, schema: PLAN_SCHEMA, tools: PLAN_TOOLS, onCall, privateStrings, library, onSend });
  return { ...r, calls };
}
