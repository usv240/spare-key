// Every model call goes through Firebase AI Logic, and this file is the only place the SDK is touched.
// The pattern (device model, cloud model, hybrid model, function calling, model fallback from Remote Config, the App
// Check bridge) comes from the author's Still Recalled entry. What is new here:
//   - the Gemini Developer API backend (GoogleAIBackend), on the free tier of a Spark-plan project;
//   - one cloud call at a time, through a single queue, with a per-scan cap;
//   - every cloud request body passes shared/cloud-safe.js checkOutgoing() and is written to "What left this
//     computer" before it is sent, and every function-call answer passes checkAnswer().
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { firebaseConfig, recaptchaSiteKey, appCheckBridgeUrl } from './firebase-config.js';
import { CLOUD_MODELS, REMOTE_DEFAULTS, remoteDefaultConfig } from '../../shared/config.js';
import { checkOutgoing, checkAnswer, CloudSafetyError } from '../../shared/cloud-safe.js';

const CLOUD_TIMEOUT_MS = 30000;

const app = initializeApp(firebaseConfig);

// App Check is enforced on Firebase AI Logic, so only Spare Key can spend the project's model quota.
//   site:               reCAPTCHA Enterprise
//   extension:          tokens from the site's bridge page (bridgeToken below)
//   development builds: a debug token from extension/appcheck-debug.local.js (gitignored; RELEASE=1 leaves it out)
/* global __APPCHECK_DEBUG_TOKEN__ */
const debugToken = typeof __APPCHECK_DEBUG_TOKEN__ === 'string' ? __APPCHECK_DEBUG_TOKEN__ : '';
const hasDocument = typeof document !== 'undefined';
const inExtension = typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
if (debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
const noProvider = new CustomProvider({ getToken: () => Promise.reject(new Error('No App Check attestation in this context')) });
// Auto-refresh is off: every refresh is another reCAPTCHA score, and one refused score makes the SDK stop asking for
// a day. Tokens last an hour and are renewed when a call needs one.
initializeAppCheck(app, {
  provider: debugToken ? noProvider
    : inExtension && hasDocument ? new CustomProvider({ getToken: bridgeToken })
    : hasDocument ? new ReCaptchaEnterpriseProvider(recaptchaSiteKey)
    : noProvider,
  isTokenAutoRefreshEnabled: false,
});

// The Gemini Developer API. Free tier: no billing account is linked to the project, so a bug cannot cost money; the
// worst case is a quota error, which falls back to the plan built on this computer.
const ai = getAI(app, { backend: new GoogleAIBackend() });

// ---------------------------------------------------------------------------------------------------------------
// Remote Config: page readers, models and switches that can change without a store update.

let live = null;
let liveAt = 0;
const LIVE_FOR = 10 * 60 * 1000;

/** Resolves to { catalogue, models, cloudOn, twoVoiceOn, freshnessOn, maxCloudCalls, freshDays, quickExitUrl, hotline, from }. */
export function liveSettings() {
  if (live && Date.now() - liveAt > LIVE_FOR) live = null;
  if (!live) liveAt = Date.now();
  return live ||= (async () => {
    const raw = key => REMOTE_DEFAULTS[key].value;
    const read = (rc, from) => {
      const get = key => (rc ? getValue(rc, key).asString() : raw(key)) || raw(key);
      const json = key => { try { return JSON.parse(get(key)); } catch { return JSON.parse(raw(key)); } };
      const num = (key, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(get(key))) || Number(raw(key))));
      const models = get('cloud_models').split(',').map(m => m.trim()).filter(m => /^gemini-[\w.-]+$/.test(m));
      const exit = get('quick_exit_url');
      return {
        catalogue: json('catalogue'),
        models: models.length ? models : CLOUD_MODELS,
        cloudOn: get('cloud_on') !== 'false',
        twoVoiceOn: get('two_voice_on') !== 'false',
        freshnessOn: get('freshness_on') !== 'false',
        maxCloudCalls: num('max_cloud_calls', 0, 40),
        freshDays: num('fresh_days', 1, 365),
        quickExitUrl: /^https:\/\//.test(exit) ? exit : raw('quick_exit_url'),
        hotline: json('hotline'),
        from,
      };
    };
    // Remote Config needs a page (IndexedDB and a window); the service worker reads the defaults.
    if (!hasDocument || typeof indexedDB === 'undefined') return read(null, 'defaults');
    let rc = null;
    try {
      rc = getRemoteConfig(app);
      rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
      rc.settings.fetchTimeoutMillis = 5000;
      rc.defaultConfig = remoteDefaultConfig();
      await fetchAndActivate(rc);
      return read(rc, 'remote');
    } catch {
      return read(rc, rc && rc.lastFetchStatus === 'success' ? 'cached' : 'defaults');
    }
  })();
}

// ---------------------------------------------------------------------------------------------------------------
// The App Check bridge: an App Check token for the extension, from appcheck-bridge.html on the site. That page runs
// reCAPTCHA Enterprise on the site's own domain and answers postMessage only from this extension's origin.

let bridge = null;
let bridgeFrame = null;
const waiting = new Map();
let nextId = 0;

async function bridgeToken() {
  try {
    return await bridgeTokenOnce();
  } catch {
    // A refused token makes the SDK inside the bridge stop asking for a day; a fresh frame starts with no back-off.
    resetBridge();
    return bridgeTokenOnce();
  }
}
function resetBridge() {
  if (bridgeFrame) bridgeFrame.remove();
  bridgeFrame = null;
  bridge = null;
}
function bridgeTokenOnce() {
  const origin = new URL(appCheckBridgeUrl).origin;
  if (!bridge) {
    bridge = new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      bridgeFrame = frame;
      frame.src = appCheckBridgeUrl;
      frame.title = 'App Check';
      frame.style.display = 'none';
      const timer = setTimeout(() => { bridge = null; frame.remove(); reject(new Error('App Check bridge did not load')); }, 20000);
      addEventListener('message', e => {
        if (e.origin !== origin || !e.data) return;
        if (e.data.type === 'sk-appcheck-ready' && e.source === frame.contentWindow) { clearTimeout(timer); resolve(frame); }
        if (e.data.type === 'sk-appcheck-token' && waiting.has(e.data.id)) {
          const w = waiting.get(e.data.id);
          waiting.delete(e.data.id);
          if (e.data.error) w.reject(new Error(e.data.error));
          else w.resolve({ token: e.data.token, expireTimeMillis: e.data.expireTimeMillis });
        }
      });
      document.body.append(frame);
    });
  }
  return bridge.then(frame => new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    frame.contentWindow.postMessage({ type: 'sk-appcheck-get', id }, origin);
    setTimeout(() => { if (waiting.delete(id)) reject(new Error('App Check bridge did not answer')); }, 20000);
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Gemini Nano on this device.

export const TEXT_ONLY = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
export const TEXT_AND_IMAGE = { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

/**
 * A model that runs only on this device (ONLY_ON_DEVICE). There is no cloud fallback, on purpose: what it reads is
 * the person's own settings pages. `schema` is a JSON Schema the answer must follow.
 */
export function deviceModel({ system, schema, inputs = TEXT_ONLY } = {}) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        ...inputs,
        ...(system ? { initialPrompts: [{ role: 'system', content: [{ type: 'text', value: system }] }] } : {}),
      },
      ...(schema ? { promptOptions: { responseConstraint: schema } } : {}),
    },
  });
}

/** One JSON answer from Gemini Nano. Throws when Nano is not available; callers fall back to code, never the cloud. */
export async function deviceJson({ system, schema, text, inputs }) {
  const r = await deviceModel({ system, schema, inputs }).generateContent(text);
  return JSON.parse(r.response.text());
}

/** Is Gemini Nano usable from the calling page? Returns the browser's own word: available, downloadable, downloading, unavailable, absent. */
export async function deviceStatus(inputs = TEXT_ONLY) {
  if (!('LanguageModel' in self)) return 'absent';
  try {
    return await self.LanguageModel.availability(inputs);
  } catch (e) {
    return 'error: ' + String(e.message || e).slice(0, 80);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Gemini in the cloud. Only ever sees bodies that pass checkOutgoing().

// A function-calling exchange is several requests in one chat, and the free tier is slowest on the first one: in the
// plan safety run (November 21, 2026) 8 of 10 failures were 30-second timeouts during function calling.
const TOOL_TIMEOUT_MS = 60000;

function cloudModel({ system, schema, model, tools = null }) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model,
      ...(tools ? { tools } : {}),
      ...(system ? { systemInstruction: system } : {}),
      // Temperature 0: the same codes should get the same plan.
      generationConfig: schema ? { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 } : { temperature: 0 },
    },
  }, { timeout: tools ? TOOL_TIMEOUT_MS : CLOUD_TIMEOUT_MS });
}

// "Try the next model": busy, over quota, or a model that is no longer there.
const RETRYABLE = /\b(404|429|500|503|504)\b|NOT_FOUND|high demand|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|abort/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const retryDelay = (e, attempt) => {
  const m = String(e).match(/retry in ([\d.]+)\s*s/i);
  return Math.min(30000, m ? Math.ceil(parseFloat(m[1]) * 1000) + 250 : 4000 * 2 ** attempt);
};

// One cloud call at a time: the free tier answered only about 3 concurrent calls when Still Recalled measured it, and
// seven calls in six seconds drew a refusal on November 21, 2026. Each request also waits at least GAP_MS after the last.
const GAP_MS = 1200;
let lastCallAt = 0;
async function paced() {
  const wait = lastCallAt + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}
let tail = Promise.resolve();
let callsThisScan = 0;
function oneAtATime(fn) {
  const run = tail.then(fn, fn);
  tail = run.catch(() => {});
  return run;
}
/** Starts a new scan's cloud budget. */
export function resetCloudBudget() { callsThisScan = 0; }
export const cloudCallsUsed = () => callsThisScan;

export class CloudBudgetError extends Error {
  constructor() { super('This scan has used its cloud calls'); this.name = 'CloudBudgetError'; }
}

/**
 * One function-calling exchange. `onCall(name, args)` runs on this device; its answer passes checkAnswer() and is
 * logged before it goes back. At most three rounds, then the model is told to answer.
 */
async function askWithTool(model, text, onCall, guard, logSend, spend) {
  const chat = model.startChat();
  let r = await chat.sendMessage(text);
  for (let round = 0; round < 3; round++) {
    const calls = (r.response.functionCalls && r.response.functionCalls()) || [];
    if (!calls.length) break;
    const answers = [];
    for (const c of calls.slice(0, 4)) {
      let response = round < 2 ? await onCall(c.name, c.args || {}) : { note: 'No more lookups. Answer now.' };
      const name = response && response.note ? 'note' : c.name;
      response = checkAnswer(name, response, guard);
      answers.push({ functionResponse: { name: c.name, response } });
    }
    // Every round is another request: it counts against the scan's cloud budget and is logged before it is sent.
    await spend();
    // The exact text is logged: Chrome's storage re-sorts object keys, so a stored object would not be word for word.
    await logSend({ kind: 'function_answers', text: JSON.stringify(answers.map(a => ({ name: a.functionResponse.name, response: a.functionResponse.response }))) });
    r = await chat.sendMessage(answers);
  }
  return r;
}

/**
 * One JSON answer from the cloud.
 *   purpose:        a key of OUTGOING in shared/cloud-safe.js; it decides which body shapes may be sent
 *   body:           the request body (for a scan, the output of toCloud())
 *   privateStrings: this session's names, addresses and devices; a body containing any of them is refused
 *   onSend(entry):  writes the request to "What left this computer"; awaited before the request goes out
 *   tools, onCall:  function declarations and the on-device handler for them
 * Returns { answer, model }. Throws CloudSafetyError (never sent), CloudBudgetError, or the last cloud error.
 */
export function cloudJson({ purpose, body, system, schema, privateStrings = [], library = null, onSend = async () => {}, tools = null, onCall = null, retries = 1 }) {
  // Checked before queueing, so a refused body never waits in line and is never logged as sent.
  const text = checkOutgoing(purpose, body, { privateStrings, library });
  const guard = { privateStrings, library };
  return oneAtATime(async () => {
    const settings = await liveSettings();
    if (!settings.cloudOn) throw new Error('cloud_off');
    let last;
    const spend = () => {
      if (callsThisScan >= settings.maxCloudCalls) throw new CloudBudgetError();
      callsThisScan++;
      return paced();
    };
    for (let attempt = 0; attempt <= retries; attempt++) {
      for (const model of settings.models) {
        await spend();
        // Each entry also records the fixed parts sent with the data: the instructions, the answer format and the names of
        // the functions offered. They hold nothing about the person: fixed text, plus public steps library text for the codes sent.
        const fixed = { instructions: system || '', format: schema ? JSON.stringify(schema) : '', tools: (tools || []).flatMap(t => (t.functionDeclarations || []).map(f => f.name).concat(t.urlContext ? ['url_context'] : [])) };
        const logSend = entry => onSend({ time: new Date().toISOString(), purpose, model, ...(entry.kind === 'request' ? { fixed } : {}), ...entry });
        try {
          await logSend({ kind: 'request', text });
          let r = tools && onCall
            ? await askWithTool(cloudModel({ system, schema, model, tools }), text, onCall, guard, logSend, spend)
            : await cloudModel({ system, schema, model, tools }).generateContent(text);
          // A model that keeps calling functions after being told to answer leaves no JSON: ask once more without tools.
          if (tools && onCall && schema && !/^\s*\{/.test(r.response.text() || '')) {
            await spend();
            await logSend({ kind: 'request', text, note: 'asked again without functions' });
            r = await cloudModel({ system, schema, model }).generateContent(text);
          }
          return {
            answer: schema ? JSON.parse(r.response.text()) : r.response.text(),
            model,
            // Which pages the URL context tool read, when it was used.
            urlContext: r.response.candidates?.[0]?.urlContextMetadata || null,
          };
        } catch (e) {
          if (e instanceof CloudSafetyError || e instanceof CloudBudgetError) throw e;
          last = e;
          if (!RETRYABLE.test(String(e))) throw e;
          // A timeout is not the model's fault: a second model would make the person wait as long again. The plan made on
          // this computer is shown instead.
          if (/timed? ?out|abort/i.test(String(e))) throw e;
        }
      }
      // One retry on 429 or 503, then the caller uses the plan built on this computer.
      if (attempt < retries && /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|quota/i.test(String(last))) await sleep(retryDelay(last, attempt));
      else break;
    }
    throw last;
  });
}

/**
 * Hybrid inference (PREFER_ON_DEVICE): Gemini Nano when this device has it, the cloud when it does not. Used only
 * where the text is public or made up (the practice check and "say it more simply"), so the cloud fallback exposes
 * nothing. Returns { answer, source: 'on_device' | 'in_cloud', model }.
 */
export function hybridJson({ purpose, body, system, schema, guard = {}, onSend = async () => {} }) {
  const text = checkOutgoing(purpose, body, guard);
  return oneAtATime(async () => {
    const settings = await liveSettings();
    let last;
    for (const model of settings.models) {
      try {
        const m = getGenerativeModel(ai, {
          mode: InferenceMode.PREFER_ON_DEVICE,
          onDeviceParams: {
            createOptions: { ...TEXT_ONLY, ...(system ? { initialPrompts: [{ role: 'system', content: [{ type: 'text', value: system }] }] } : {}) },
            ...(schema ? { promptOptions: { responseConstraint: schema } } : {}),
          },
          inCloudParams: {
            model,
            ...(system ? { systemInstruction: system } : {}),
            generationConfig: schema ? { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 } : { temperature: 0 },
          },
        }, { timeout: CLOUD_TIMEOUT_MS });
        const onDevice = (await deviceStatus()) === 'available';
        // Logged before it is sent: PREFER_ON_DEVICE can fall back to the cloud even when Gemini Nano is present.
        await onSend({ time: new Date().toISOString(), purpose, model: onDevice ? `Gemini Nano, or ${model} if it falls back` : model, kind: 'request', text });
        const r = await m.generateContent(text);
        const source = r.response.inferenceSource || (onDevice ? 'on_device' : 'in_cloud');
        return { answer: schema ? JSON.parse(r.response.text()) : r.response.text(), source, model: source === 'on_device' ? 'Gemini Nano' : model };
      } catch (e) {
        last = e;
        if (!RETRYABLE.test(String(e))) throw e;
      }
    }
    throw last;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The steps library in Cloud Firestore (public, read-only; App Check enforced). Firestore Lite keeps the bundle small.

/** The library from Firestore when its version is newer than `haveVersion`; otherwise null. */
export async function remoteLibrary(haveVersion) {
  const { getFirestore, doc, getDoc, collection, getDocs } = await import('firebase/firestore/lite');
  const db = getFirestore(app);
  const meta = await getDoc(doc(db, 'meta', 'library'));
  const m = meta.exists() ? meta.data() : null;
  if (!m || !(Number(m.version) > Number(haveVersion))) return null;
  const snap = await getDocs(collection(db, 'steps'));
  return { version: Number(m.version), updated_at: String(m.updated_at || ''), entries: snap.docs.map(d => d.data()) };
}

export { InferenceMode };
