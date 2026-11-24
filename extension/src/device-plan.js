// The plan on this computer: Gemini Nano orders it from the same finding codes and chosen answers the cloud would see
// (the toCloud() body), with the steps library's facts for those codes written into its instructions in place of the
// cloud's get_steps function. It runs when the person has turned plan help from the cloud off and Nano is ready, so
// nothing at all leaves the computer; otherwise the plan made by code is shown (panel.js makePlan). The plan that comes
// back passes the same safety rules as the cloud's before anyone sees it. Measured on the 40 frozen situations
// (tools/plan-eval-nano.mjs): 35 answered within the 90-second limit, and the rules made 103 fixes.
import { deviceJson } from './ai.js';
import { PLAN_SCHEMA, libraryFacts, devicePlanSystem } from '../../shared/plan/prompts.js';
export { libraryFacts, devicePlanSystem };

/** Ask Gemini Nano for a plan. Throws when Nano is not ready; the caller then uses the cloud or the code plan. */
export async function devicePlan({ body, library }) {
  // 90 seconds at most: a plan usually takes 30 to 45; after that, the cloud plan or the code plan is shown instead.
  const answer = await deviceJson({ system: devicePlanSystem(body, library), schema: PLAN_SCHEMA, text: JSON.stringify(body), timeoutMs: 90000 });
  return { answer, model: 'Gemini Nano' };
}
