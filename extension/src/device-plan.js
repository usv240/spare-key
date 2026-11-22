// The plan on this computer: Gemini Nano orders it from the same finding codes and chosen answers the cloud would see
// (the toCloud() body), with the steps library's facts for those codes written into its instructions in place of the
// cloud's get_steps function. This is the plan's PREFER_ON_DEVICE: when Nano is ready, nothing at all leaves the
// computer, and when it is not, the cloud plan runs (the codes are not private). The plan that comes back passes the
// same safety rules as the cloud's before anyone sees it.
import { deviceJson } from './ai.js';
import { PLAN_INTRO, PLAN_SHAPE, PLAN_SCHEMA } from './cloud/plan.js';

const NOTICE = { notifies: 'they are told', noticeable: 'they may notice', unlikely: 'unlikely to be noticed', unknown: 'not known, so treat it as noticeable' };

/** The library's facts for the codes in `body`, one line each. */
export function libraryFacts(body, library) {
  const codes = [...new Set((body?.findings || []).map(f => f.code))].filter(c => library?.[c]);
  return codes.map(c => `- ${c}: ${library[c].title}. If removed: ${library[c].what_they_see} (${NOTICE[library[c].who_can_notice] || NOTICE.unknown}).`).join('\n');
}

export const devicePlanSystem = (body, library) => `${PLAN_INTRO}
What each finding code is, and what the other person sees if it is removed, from Spare Key's steps library:
${libraryFacts(body, library)}
${PLAN_SHAPE}`;

/** Ask Gemini Nano for a plan. Throws when Nano is not ready; the caller then uses the cloud or the code plan. */
export async function devicePlan({ body, library }) {
  // 90 seconds at most: a plan usually takes 30 to 45; after that, the cloud plan or the code plan is shown instead.
  const answer = await deviceJson({ system: devicePlanSystem(body, library), schema: PLAN_SCHEMA, text: JSON.stringify(body), timeoutMs: 90000 });
  return { answer, model: 'Gemini Nano' };
}
