// Test page for the plan safety test (tools/plan-eval-cloud.mjs). Runs in a local page with the development App Check
// debug token. It is not part of the extension: system A sends a plain-language question, which the extension's cloud
// gate (shared/cloud-safe.js) would rightly refuse. The scenarios are made up; none of them describes a real person.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import { resetCloudBudget, liveSettings } from '../../extension/src/ai.js';
import { cloudPlan } from '../../extension/src/cloud/plan.js';
import { twoVoices } from '../../extension/src/cloud/voices.js';
import { toCloud } from '../../shared/cloud-safe.js';
import { firebaseConfig, recaptchaSiteKey } from '../../extension/src/firebase-config.js';

// A second app for system A, the plain chatbot: same project, same backend, no Spare Key prompt, schema or tools.
const chatApp = initializeApp(firebaseConfig, 'plain-chatbot');
initializeAppCheck(chatApp, { provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey), isTokenAutoRefreshEnabled: false });
const chatAI = getAI(chatApp, { backend: new GoogleAIBackend() });

const sent = [];
const onSend = async entry => { sent.push(entry); };

window.evalReady = (async () => (await liveSettings()).models)();

/** System A: the plain chatbot. */
window.runPlainChatbot = async (question, model) => {
  const m = getGenerativeModel(chatAI, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model } }, { timeout: 60000 });
  const r = await m.generateContent(question);
  return r.response.text();
};

/** Systems C and D: Spare Key's cloud plan, then the two voices, before the safety rules. */
window.runSpareKey = async (scenario, library) => {
  resetCloudBudget();
  sent.length = 0;
  const findings = scenario.findings.map(f => ({ ref: f.ref, code: f.code, ownership: f.ownership, recency: f.recency, howFound: f.how_found }));
  const shared = Object.fromEntries(Object.keys(scenario.situation).map(k => [k, true]));
  const { body } = toCloud(findings, { situation: scenario.situation, shared, notChecked: scenario.notChecked });
  const ask = async kind => (kind === 'user' ? 'skipped' : 'unknown');
  const out = { C: null, D: null, errors: [] };
  try {
    out.C = await cloudPlan({ body, library, privateStrings: [], ask, onSend });
  } catch (e) { out.errors.push(`C: ${String(e).slice(0, 200)}`); return { ...out, calls: sent.length }; }
  try {
    out.D = await twoVoices({ scan: body, draft: out.C.answer, privateStrings: [], library, onSend });
  } catch (e) { out.errors.push(`D: ${String(e).slice(0, 200)}`); }
  return { ...out, calls: sent.length };
};
