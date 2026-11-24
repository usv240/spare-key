// The plan's instructions, answer format and functions: one copy for every place a model orders a plan (the cloud plan
// in the extension, the plan on this computer with Gemini Nano, the website, and the Android app's sandbox). Plain data
// and strings only, so it runs anywhere, including Jetpack's JavaScript sandbox on the phone.
import { CODES } from '../findings.js';

export const DEVICE_QUESTIONS = [
  'filter_also_deletes', 'forwarding_is_only_copy', 'device_active_this_week', 'app_can_read_mail', 'app_can_see_location',
  'more_items_hidden', 'shared_with_link',
  // The phone check (Android): answered on the phone from what it read.
  'app_outside_store', 'app_looks_like_monitoring',
];
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
      description: 'Ask this computer or phone a yes or no question about one finding. The answer is yes, no or unknown.',
      parameters: { type: 'object', properties: { ref: str('A finding ref from the request, like f1.'), question: enumOf(DEVICE_QUESTIONS, 'The question.') }, required: ['ref', 'question'] },
    },
    {
      name: 'ask_user',
      description: 'Ask the person a question about one finding, with the answers yes, no or not sure. Use it only when the answer would change the order, at most two times.',
      parameters: { type: 'object', properties: { ref: str('A finding ref from the request, like f1.'), question: enumOf(USER_QUESTIONS, 'The question.') }, required: ['ref', 'question'] },
    },
  ],
}];

export const PLAN_INTRO = `You help a person decide the order in which to deal with access other people have to their accounts.
You see only finding codes and the person's chosen answers, never names or details. A finding with ownership "not_mine" or "unsure" gives someone else access; "mine" belongs to the person.
Rules you must follow: document before changing anything; warn whenever a change may be noticed;
when it may not be a good time to change things (safe_to_change_now is not "yes", or not given), say to wait and to talk to an advocate; never call anything safe or secure, and never say there is nothing to worry about.
When the person's mail is copied to someone else (gmail.forwarding.external, gmail.filter.forwards, gmail.delegate), put those steps before any recovery, 2-Step Verification or signed-in device step, and never change those now while the mail copying waits: any email Google sends about such a change, like a security alert or a code, would reach the other person.
An app that can watch the phone (phone.app.control, phone.app.accessibility, phone.app.device_admin, phone.app.notifications, phone.app.messages) can see what the person does on that phone, including this plan: removing it may alert whoever installed it, so screenshot it and talk to an advocate first, and suggest planning on a phone or computer the other person has never had.`;
export const PLAN_SHAPE = `Return the plan as JSON that follows the schema, in this shape:
1. One "document" step whose refs are every finding that is not "mine".
2. One "talk_to_advocate" step.
3. One step per finding code: put every ref with that code in the same step, as "change_now" or "wait". Every finding that is not "mine" must be in exactly one of these steps. Put first the codes that give the most access (control of the phone, mail, location, getting into the account).
4. One "check_manually" step for each item in not_checked.
Each "why" is one or two short sentences in plain words, at a grade 6 reading level, about that step only, with no names, addresses, phone numbers or links. The summary is two sentences at most.`;

export const PLAN_SYSTEM = `${PLAN_INTRO}
Use get_steps once, with every code you need, to read the steps. In the same turn, call ask_device for the facts that
decide the order, at most 4 calls in all: for a gmail.filter.hides finding, filter_also_deletes (a filter that deletes
mail is more urgent); for a gmail.forwarding.external finding, forwarding_is_only_copy; for a google.devices.other
finding with recency "unknown", device_active_this_week; for a phone.app finding, app_looks_like_monitoring.
Put the findings the answers make more urgent first.
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

const NOTICE = { notifies: 'they are told', noticeable: 'they may notice', unlikely: 'unlikely to be noticed', unknown: 'not known, so treat it as noticeable' };

/** The library's facts for the codes in `body`, one line each. */
export function libraryFacts(body, library) {
  const codes = [...new Set((body?.findings || []).map(f => f.code))].filter(c => library?.[c]);
  return codes.map(c => `- ${c}: ${library[c].title}. If removed: ${library[c].what_they_see} (${NOTICE[library[c].who_can_notice] || NOTICE.unknown}).`).join('\n');
}

/** The instructions for a plan made on the device by Gemini Nano, with the library's facts written in. */
export const devicePlanSystem = (body, library) => `${PLAN_INTRO}
What each finding code is, and what the other person sees if it is removed, from Spare Key's steps library:
${libraryFacts(body, library)}
${PLAN_SHAPE}`;

// "Say it more simply": one steps library entry's public steps in simpler words. Hybrid inference with the fallback
// (PREFER_ON_DEVICE) on both clients, because the text is the library's, the same for everyone, and names no one.
export const SIMPLER_SYSTEM = `Rewrite these steps for changing one setting in very simple words, at a grade 4 reading level.
Keep the same order, and the same number of steps or one more. Keep every button and menu name exactly as written.
Keep every warning. Do not add names, numbers, links or advice that are not in the steps. Never say safe or secure.`;
export const SIMPLER_SCHEMA = { type: 'object', properties: { steps: { type: 'array', items: { type: 'string', maxLength: 200 } } }, required: ['steps'] };
