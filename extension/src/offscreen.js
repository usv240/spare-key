// Offscreen page: a hidden extension page that hosts Gemini Nano sessions and every Firebase call.
// It talks to the side panel and the service worker by runtime messages addressed { target: 'offscreen' }.
import { deviceStatus, deviceJson, cloudJson, liveSettings, resetCloudBudget, TEXT_ONLY, TEXT_AND_IMAGE } from './ai.js';
import { classifyEntries, readWholePage } from './classify.js';
import { cloudPlan } from './cloud/plan.js';
import { twoVoices } from './cloud/voices.js';
import { checkFreshness, fetchHelpPage } from './cloud/freshness.js';

// Every cloud request is written to "What left this computer" (kept by the service worker) before it is sent.
const onSend = entry => chrome.runtime.sendMessage({ type: 'sk:sent', entry });

/**
 * The setup check behind "Check this computer" in the panel's Under the hood tab, and the day-1 test
 * (tools/day1-check.mjs). It sends nothing personal: the cloud probe is one fixed sentence.
 */
async function setupCheck({ cloud = true } = {}) {
  const out = { settings: null, nano: {}, cloud: {} };
  const settings = await liveSettings();
  out.settings = { from: settings.from, models: settings.models, cloudOn: settings.cloudOn, maxCloudCalls: settings.maxCloudCalls };

  // Gemini Nano: availability, its input limits, and one structured prompt.
  out.nano.text = await deviceStatus(TEXT_ONLY);
  out.nano.image = await deviceStatus(TEXT_AND_IMAGE);
  if ('LanguageModel' in self) {
    try { out.nano.params = await self.LanguageModel.params?.(); } catch (e) { out.nano.paramsError = String(e).slice(0, 120); }
  }
  if (out.nano.text === 'available') {
    try {
      // How many tokens 3,500 characters of settings-page-like text use, against the session's input limit.
      const session = await self.LanguageModel.create(TEXT_ONLY);
      const sample = 'Signed in on Windows, Chrome. Last active 2 days ago. '.repeat(65).slice(0, 3500);
      out.nano.inputQuota = session.inputQuota ?? session.contextWindow ?? null;
      const measure = session.measureInputUsage || session.measureContextUsage;
      out.nano.tokensFor3500Chars = measure ? await measure.call(session, sample) : null;
      session.destroy();
    } catch (e) { out.nano.quotaError = String(e).slice(0, 160); }
    try {
      const t0 = performance.now();
      out.nano.answer = await deviceJson({
        system: 'You check that you are working. Answer in JSON.',
        schema: { type: 'object', properties: { status: { enum: ['ready'] } }, required: ['status'] },
        text: 'Reply with status "ready".',
      });
      out.nano.ms = Math.round(performance.now() - t0);
    } catch (e) { out.nano.error = String(e).slice(0, 200); }
  }

  // The cloud: one fixed probe through the same checked, logged, one-at-a-time path as every cloud call.
  if (cloud) {
    resetCloudBudget();
    try {
      const t0 = performance.now();
      const { answer, model } = await cloudJson({
        purpose: 'check',
        body: { probe: 'ready' },
        system: 'You check that you are working. The user sends {"probe":"ready"}. Answer in JSON.',
        schema: { type: 'object', properties: { status: { type: 'string', enum: ['ready'] } }, required: ['status'] },
        onSend,
      });
      out.cloud = { answer, model, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      out.cloud = { error: String(e).slice(0, 300) };
    }
  }
  return out;
}

// Gemini Nano work for the scan. Only the extension's own pages may ask (the sender check below).
// Loading Gemini Nano takes long the first time (104 s on the builder's PC before the first check, November 21, 2026;
// 4 to 12 s per check after). The panel asks for one tiny prompt as it opens, so the model is loaded before a scan.
let warm = null;
const NANO = {
  'sk:nano-warm': () => (warm ||= deviceJson({
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    text: 'Reply with {"ok": true}.',
  }).then(() => ({ ok: true }), e => { warm = null; return { error: String(e).slice(0, 200) }; })),
  'sk:nano-status': async () => ({ status: await deviceStatus(TEXT_ONLY) }),
  // The cloud plan. The panel sends the toCloud() body, this session's private strings (to refuse any request that
  // holds one) and the public steps library; questions from the cloud go back to the panel, which holds the findings.
  'sk:cloud-plan': async ({ body, privateStrings, library, newScan }) => {
    if (newScan) resetCloudBudget();
    const ask = (kind, args) => chrome.runtime.sendMessage({ type: 'sk:ask', kind, ref: args.ref, question: args.question })
      .then(r => r?.answer, () => (kind === 'user' ? 'skipped' : 'unknown'));
    try {
      const { answer, model } = await cloudPlan({ body, library, privateStrings, ask, onSend });
      return { answer, model };
    } catch (e) {
      return { error: String(e && e.message || e).slice(0, 300), kind: e?.name || 'Error' };
    }
  },
  // Steps freshness for one library entry, when Remote Config's freshness_on is true.
  'sk:freshness': async ({ code, library, privateStrings = [] }) => {
    const settings = await liveSettings();
    if (!settings.freshnessOn || !settings.cloudOn) return { off: true };
    try {
      return await checkFreshness({ code, entry: library[code], library, privateStrings, fetchPage: fetchHelpPage, onSend });
    } catch (e) {
      return { error: String(e && e.message || e).slice(0, 300) };
    }
  },
  'sk:fresh-days': async () => ({ freshDays: (await liveSettings()).freshDays }),
  // The two-voice check on a cloud draft, when Remote Config's two_voice_on is true.
  'sk:two-voices': async ({ body, draft, privateStrings, library }) => {
    const settings = await liveSettings();
    if (!settings.twoVoiceOn) return { off: true };
    try {
      return await twoVoices({ scan: body, draft, privateStrings, library, onSend });
    } catch (e) {
      return { error: String(e && e.message || e).slice(0, 300), kind: e?.name || 'Error' };
    }
  },
  'sk:classify': async o => ({ items: await classifyEntries(o) }),
  'sk:read-page': async o => ({ entries: await readWholePage(o) }),
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.target !== 'offscreen') return false;
  if (sender.id !== chrome.runtime.id) return false;
  if (NANO[msg.type]) {
    NANO[msg.type](msg.options || {}).then(reply, e => reply({ error: String(e && e.message || e).slice(0, 300) }));
    return true;
  }
  if (msg.type === 'sk:setup-check') {
    setupCheck(msg.options || {}).then(reply, e => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === 'sk:settings') {
    liveSettings().then(s => reply(s), e => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === 'sk:catalogue-overrides') {
    liveSettings().then(s => reply({ catalogue: s.catalogue || {}, from: s.from }), () => reply({ catalogue: {}, from: 'defaults' }));
    return true;
  }
  return false;
});
