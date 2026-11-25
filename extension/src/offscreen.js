// Offscreen page: a hidden extension page that hosts Gemini Nano sessions and every Firebase call.
// It talks to the side panel and the service worker by runtime messages addressed { target: 'offscreen' }.
// The network ledger loads first, so it counts every request the Firebase code makes.
import { ledgerSummary } from './ledger.js';
import { deviceStatus, deviceJson, cloudJson, hybridJson, liveSettings, resetCloudBudget, remoteLibrary, sendLayoutReport, TEXT_ONLY, TEXT_AND_IMAGE } from './ai.js';
import { cleanText } from '../../shared/plan/invariants.js';
import { SIMPLER_SYSTEM, SIMPLER_SCHEMA } from '../../shared/plan/prompts.js';
import { validateLibrary } from '../../shared/steps-schema.js';
import { classifyEntries, readWholePage, readScreenshot, nanoAnswer } from './classify.js';
import { cloudPlan } from './cloud/plan.js';
import { devicePlan } from './device-plan.js';
import { TOLD_SYSTEM, TOLD_SCHEMA, TOLD_MAX_CHARS, keywordTold, cleanTold } from '../../shared/told.js';
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
// SIMPLER_SYSTEM and SIMPLER_SCHEMA are in shared/plan/prompts.js: the Android app asks the same thing.

let warm = null;
const NANO = {
  'sk:nano-warm': () => (warm ||= deviceJson({
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    text: 'Reply with {"ok": true}.',
  }).then(() => ({ ok: true }), e => { warm = null; return { error: String(e).slice(0, 200) }; })),
  'sk:nano-status': async () => ({ status: await deviceStatus(TEXT_ONLY) }),
  // Bytes and requests per destination this session, and how many hold one of this scan's private strings.
  'sk:ledger': async ({ privateStrings = [] } = {}) => ledgerSummary(privateStrings),
  // The cloud plan. The panel sends the toCloud() body, this session's private strings (to refuse any request that
  // holds one) and the public steps library; questions from the cloud go back to the panel, which holds the findings.
  'sk:cloud-plan': async ({ body, privateStrings, library, newScan }) => {
    if (newScan) resetCloudBudget();
    const ask = (kind, args) => chrome.runtime.sendMessage({ type: 'sk:ask', kind, ref: args.ref, question: args.question })
      .then(r => r?.answer, () => (kind === 'user' ? 'skipped' : 'unknown'));
    try {
      const { answer, model, calls } = await cloudPlan({ body, library, privateStrings, ask, onSend });
      return { answer, model, calls };
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
  // A newer steps library from Firestore, checked before use. Public text; nothing is sent but the read itself.
  'sk:library': async ({ version }) => {
    try {
      const lib = await remoteLibrary(version);
      if (!lib) return { same: true };
      const problems = validateLibrary(lib);
      return problems.length ? { invalid: problems.slice(0, 5) } : { library: lib };
    } catch (e) {
      return { error: String(e && e.message || e).slice(0, 200) };
    }
  },
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
  // The plan on this computer (extension/src/device-plan.js): finding codes in, nothing out.
  'sk:device-plan': async ({ body, library }) => devicePlan({ body, library }),
  // "In your own words": what the person typed, read into finding codes here, on this computer. Gemini Nano only
  // (ONLY_ON_DEVICE: the words name people, so there is no cloud fallback), and code's keyword reader when Nano is not
  // there or does not answer. Only the codes go back to the panel.
  'sk:told': async ({ text }) => {
    const words = String(text || '').slice(0, TOLD_MAX_CHARS);
    if (!words.trim()) return { answer: cleanTold({}), how: 'reader' };
    if ((await deviceStatus(TEXT_ONLY)) === 'available') {
      try {
        const t0 = performance.now();
        const answer = cleanTold(await deviceJson({ system: TOLD_SYSTEM, schema: TOLD_SCHEMA, text: words, timeoutMs: 60000 }));
        return { answer, how: 'nano', ms: Math.round(performance.now() - t0) };
      } catch (e) {
        return { answer: cleanTold(keywordTold(words)), how: 'reader', nanoError: String(e).slice(0, 160) };
      }
    }
    return { answer: cleanTold(keywordTold(words)), how: 'reader' };
  },
  // An ask_device question the code rules left unknown: Gemini Nano reads the entry's words here and answers with one
  // word. Only that word goes back to the cloud.
  'sk:nano-ask': async ({ question, text }) => ({
    answer: (await deviceStatus(TEXT_ONLY)) === 'available' ? await nanoAnswer({ question, text }) : 'unknown',
  }),
  // "Say it more simply": one steps library entry's public steps in simpler words, with hybrid inference
  // (PREFER_ON_DEVICE): Gemini Nano when this computer has it, the cloud when it does not and plan help is on. The text
  // is the library's, not the person's, so a cloud fallback exposes nothing. Every step comes back through the safety
  // rules' text check (no reassurance, no contact details or links).
  'sk:simpler': async ({ code, library, personCloudOn = true }) => {
    const settings = await liveSettings();
    const onDevice = (await deviceStatus(TEXT_ONLY)) === 'available';
    // Both switches count: Remote Config's, and the person's own "plan help from the cloud".
    const cloudAllowed = settings.cloudOn && personCloudOn !== false;
    if (!onDevice && !cloudAllowed) return { off: true };
    const entry = library?.[code];
    if (!entry) return { error: 'unknown code' };
    try {
      // With the cloud not allowed, Gemini Nano only (ONLY_ON_DEVICE): hybrid inference could fall back to the cloud.
      const r = cloudAllowed
        ? await hybridJson({
          purpose: 'simpler', body: { code, steps: entry.steps }, guard: { library }, onSend,
          system: SIMPLER_SYSTEM, schema: SIMPLER_SCHEMA,
        })
        : { answer: await deviceJson({ system: SIMPLER_SYSTEM, schema: SIMPLER_SCHEMA, text: JSON.stringify({ code, steps: entry.steps }) }), source: 'on_device', model: 'gemini-nano' };
      const allowed = JSON.stringify(entry);
      const steps = (r.answer.steps || []).slice(0, entry.steps.length + 1).map(s => cleanText(String(s).slice(0, 200), allowed).text).filter(Boolean);
      return steps.length ? { steps, source: r.source, model: r.model } : { error: 'empty' };
    } catch (e) {
      return { error: String(e && e.message || e).slice(0, 200) };
    }
  },
  // An opt-in, anonymous layout report, one per press of the button in the results (panel.js).
  'sk:layout-report': async ({ body }) => sendLayoutReport(body, { onSend }),
  'sk:classify': async o => ({ items: await classifyEntries(o) }),
  'sk:read-page': async o => readWholePage(o),
  // A phone screenshot, read here only: it shows names. Gemini Nano with image input, or nothing.
  'sk:read-screenshot': async o => readScreenshot(o),
  'sk:image-status': async () => ({ status: await deviceStatus(TEXT_AND_IMAGE) }),
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
    liveSettings().then(s => reply({ catalogue: s.catalogue || {}, hotline: s.hotline || null, from: s.from }), () => reply({ catalogue: {}, hotline: null, from: 'defaults' }));
    return true;
  }
  return false;
});
