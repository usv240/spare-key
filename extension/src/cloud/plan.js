// The cloud plan (TECHNICAL-DESIGN.md section 9.1). Gemini in the cloud orders the plan from finding codes and the
// person's chosen answers only. When it needs a fact, it asks: get_steps reads the public steps library, ask_device
// gets a yes / no / unknown about one finding from this computer, and ask_user asks the person a yes / no / not sure
// question in the panel. Every answer is an enum or public library text, checked by shared/cloud-safe.js before it goes.
// The plan that comes back still passes the safety rules (shared/plan/invariants.js) before anyone sees it.
import { cloudJson, templateJson, liveSettings } from '../ai.js';

// The instructions, answer format and functions live in shared/plan/prompts.js, so the extension, the website and the
// Android app's sandbox order plans with the same words.
import { DEVICE_QUESTIONS, USER_QUESTIONS, PLAN_TOOLS, PLAN_INTRO, PLAN_SHAPE, PLAN_SYSTEM, PLAN_SCHEMA } from '../../../shared/plan/prompts.js';
export { DEVICE_QUESTIONS, USER_QUESTIONS, PLAN_TOOLS, PLAN_INTRO, PLAN_SHAPE, PLAN_SCHEMA };

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
  // First through the server prompt template (the instructions and functions stay on Firebase's server, and the
  // server checks the codes again); if no template answers, the same request directly. Either way the body is the same.
  // Which templates, and whether to use one at all, comes from Remote Config (plan_templates).
  const { templates } = await liveSettings();
  let r;
  try {
    if (!templates?.length) throw new Error('no templates');
    r = await templateJson({ purpose: 'plan', templateIds: templates, body, privateStrings, library, onSend, onCall });
    r = { ...r, model: `Firebase prompt template ${r.template}` };
  } catch (e) {
    if (/CloudSafetyError|CloudBudgetError|cloud_off/.test(`${e?.name} ${e?.message}`)) throw e;
    r = await cloudJson({ purpose: 'plan', body, system: PLAN_SYSTEM, schema: PLAN_SCHEMA, tools: PLAN_TOOLS, onCall, privateStrings, library, onSend });
    r = { ...r, templateFailed: String(e?.message || e).slice(0, 120) };
  }
  return { ...r, calls };
}
