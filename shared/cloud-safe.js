// The only way anything about a scan may leave the computer.
//
// toCloud() builds a brand-new object from an allow-list of keys and enum values. It copies nothing else from a
// finding, so a name, an email address, a phone number, a device name or a page's words cannot ride along. Anything
// it does not recognise throws instead of being passed through.
//
// checkOutgoing() runs again on every request body right before it is sent (see extension/src/ai.js). It accepts only
// the shapes listed in OUTGOING, and it also refuses any body that contains one of this session's private strings
// (the names, addresses and devices the scan found), so even a bug elsewhere cannot send them.
import { CODES, CHECK_IDS, UNCHECKED_SERVICES, OWNERSHIP, RECENCY, HOW_FOUND, SITUATION, SITUATION_DEFAULTS, isCode } from './findings.js';

export class CloudSafetyError extends Error {
  constructor(message) { super(message); this.name = 'CloudSafetyError'; }
}
const fail = msg => { throw new CloudSafetyError(msg); };

export function assertCode(code) {
  if (typeof code !== 'string' || !isCode(code)) fail(`not a finding code: ${typeof code === 'string' ? code.slice(0, 40) : typeof code}`);
  return code;
}
export function assertEnum(value, allowed, what = 'value') {
  if (!allowed.includes(value)) fail(`${what} is not one of the allowed values`);
  return value;
}

/** Only the situation answers the person chose to share, each one an enum. */
export function pickSituation(situation = {}, shared = {}) {
  const out = {};
  for (const key of Object.keys(SITUATION)) {
    if (!shared[key]) continue;
    out[key] = assertEnum(situation[key] ?? SITUATION_DEFAULTS[key], SITUATION[key], key);
  }
  return out;
}

const NOT_CHECKED = [...CHECK_IDS, ...UNCHECKED_SERVICES];

/**
 * The cloud's view of a scan. `findings` are the local findings (full of private detail); `situation` holds the
 * person's answers and `shared` says which of them they agreed to share; `notChecked` is a list of check ids.
 * Returns { body, refs }: refs maps the renumbered cloud ref back to the local finding, and never leaves this computer.
 */
export function toCloud(findings, { situation = {}, shared = {}, notChecked = [] } = {}) {
  const refs = {};
  const body = {
    findings: findings.map((f, n) => {
      const ref = `f${n + 1}`;            // renumbered: carries nothing about the finding
      refs[ref] = f.ref;
      return {
        ref,
        code: assertCode(f.code),
        ownership: assertEnum(f.ownership ?? 'unsure', OWNERSHIP, 'ownership'),
        recency: assertEnum(f.recency ?? 'unknown', RECENCY, 'recency'),
        how_found: assertEnum(f.howFound, HOW_FOUND, 'how_found'),
      };
    }),
    situation: pickSituation(situation, shared),
    not_checked: [...new Set(notChecked.map(id => assertEnum(id, NOT_CHECKED, 'not_checked')))],
  };
  return { body, refs };
}

// ---------------------------------------------------------------------------------------------------------------
// Outgoing request bodies, checked again just before sending.

const REF = /^f\d{1,3}$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const URLISH = /\bhttps?:\/\/|\bwww\./i;

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function onlyKeys(obj, keys, where) {
  if (!isPlainObject(obj)) fail(`${where} must be an object`);
  for (const k of Object.keys(obj)) if (!keys.includes(k)) fail(`${where} has a key that is not allowed: ${k.slice(0, 30)}`);
}

function checkScanBody(b) {
  onlyKeys(b, ['findings', 'situation', 'not_checked'], 'body');
  if (!Array.isArray(b.findings) || b.findings.length > 200) fail('findings must be a short list');
  for (const f of b.findings) {
    onlyKeys(f, ['ref', 'code', 'ownership', 'recency', 'how_found'], 'finding');
    if (!REF.test(f.ref)) fail('finding ref must look like f1');
    assertCode(f.code);
    assertEnum(f.ownership, OWNERSHIP, 'ownership');
    assertEnum(f.recency, RECENCY, 'recency');
    assertEnum(f.how_found, HOW_FOUND, 'how_found');
  }
  onlyKeys(b.situation, Object.keys(SITUATION), 'situation');
  for (const [k, v] of Object.entries(b.situation)) assertEnum(v, SITUATION[k], k);
  if (!Array.isArray(b.not_checked)) fail('not_checked must be a list');
  for (const id of b.not_checked) assertEnum(id, NOT_CHECKED, 'not_checked');
}

// Short model-written text that is sent back to the cloud (the draft plan in the two-voice check). The cloud wrote it
// from codes only; it is still checked, because a model can echo anything.
function checkModelText(s, max) {
  if (typeof s !== 'string' || s.length > max) fail('model text too long');
  if (EMAIL.test(s) || PHONE.test(s) || URLISH.test(s)) fail('model text holds an address, number or link');
}

/**
 * The shapes a request body may take, by purpose. A purpose that is not listed cannot be sent at all.
 */
export const OUTGOING = {
  // The day-1 setup check and the "is the cloud reachable" probe: one fixed sentence, nothing else.
  check: b => { onlyKeys(b, ['probe'], 'body'); assertEnum(b.probe, ['ready'], 'probe'); },
  // The cloud plan (TECHNICAL-DESIGN section 9.1).
  plan: checkScanBody,
  // The two-voice check: the same scan body plus the draft plan written by the cloud.
  voices: b => {
    onlyKeys(b, ['scan', 'draft', 'voice'], 'body');
    checkScanBody(b.scan);
    assertEnum(b.voice, ['close_the_doors', 'stay_hidden', 'settle'], 'voice');
    onlyKeys(b.draft, ['actions', 'summary', 'arguments'], 'draft');
    for (const a of b.draft.actions || []) {
      onlyKeys(a, ['refs', 'action', 'why'], 'action');
      if (!Array.isArray(a.refs) || a.refs.length > 200 || !a.refs.every(r => REF.test(r))) fail('action refs must look like f1');
      assertEnum(a.action, ['document', 'talk_to_advocate', 'change_now', 'wait', 'check_manually'], 'action');
      checkModelText(a.why, 160);
    }
    checkModelText(b.draft.summary ?? '', 240);
    if (b.draft.arguments) for (const s of Object.values(b.draft.arguments)) checkModelText(s, 900);
  },
  // Steps freshness: a finding code, the public help page the steps library cites for it, and the library's own steps.
  freshness: (b, ctx) => {
    onlyKeys(b, ['code', 'help_title', 'help_url', 'steps', 'page_text'], 'body');
    // page_text: the cited public help page's text, fetched on this computer. Still checked against private strings.
    if (b.page_text !== undefined && (typeof b.page_text !== 'string' || b.page_text.length > 8000)) fail('page_text must be short text');
    assertCode(b.code);
    const entry = ctx?.library?.[b.code];
    const cited = entry?.sources || [];
    if (!cited.some(s => s.url === b.help_url && s.title === b.help_title)) fail('help page is not one the library cites');
    if (b.steps !== undefined && JSON.stringify(b.steps) !== JSON.stringify(entry?.steps)) fail('steps must be the library entry\'s own steps');
  },
};

/** Answers the device gives to the cloud's function calls. Enums only, or public text from the steps library. */
export const FUNCTION_ANSWERS = {
  ask_device: a => { onlyKeys(a, ['answer'], 'answer'); assertEnum(a.answer, ['yes', 'no', 'unknown'], 'answer'); },
  ask_user: a => { onlyKeys(a, ['answer'], 'answer'); assertEnum(a.answer, ['yes', 'no', 'not_sure', 'skipped'], 'answer'); },
  get_steps: (a, ctx) => {
    onlyKeys(a, ['entries'], 'answer');
    const entries = Object.entries(a.entries || {});
    if (!entries.length) fail('get_steps returned nothing');
    for (const [code, entry] of entries) {
      const lib = ctx?.library?.[code];
      if (!lib || JSON.stringify(entry) !== JSON.stringify(lib)) fail('get_steps may return only steps library entries');
    }
  },
  note: a => { onlyKeys(a, ['note'], 'answer'); assertEnum(a.note, ['No more lookups. Answer now.', 'Unknown function.'], 'note'); },
};

/** True when `text` contains any of the private strings, plainly, URL-encoded or in base64. */
export function leaksAny(text, privateStrings = []) {
  const lower = text.toLowerCase();
  for (const raw of privateStrings) {
    const s = String(raw || '').trim();
    if (s.length < 3) continue;
    const forms = [s, encodeURIComponent(s), b64(s)];
    if (forms.some(f => f && lower.includes(f.toLowerCase()))) return true;
  }
  return false;
}
function b64(s) {
  try { return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'); } catch { return ''; }
}

/**
 * The last check before anything is sent. Throws CloudSafetyError unless `body` has an allowed shape for `purpose`
 * and contains none of `privateStrings`. Returns the exact JSON text to send, so what is logged is what is sent.
 */
export function checkOutgoing(purpose, body, { privateStrings = [], library = null } = {}) {
  const check = Object.hasOwn(OUTGOING, purpose) ? OUTGOING[purpose] : null;
  if (!check) fail(`nothing may be sent for purpose "${String(purpose).slice(0, 30)}"`);
  check(body, { library });
  const text = JSON.stringify(body);
  if (leaksAny(text, privateStrings)) fail('the request holds a private string from this scan');
  return text;
}

/** The same check for a function-call answer going back to the cloud. Returns the answer unchanged. */
export function checkAnswer(name, answer, { privateStrings = [], library = null } = {}) {
  const check = Object.hasOwn(FUNCTION_ANSWERS, name) ? FUNCTION_ANSWERS[name] : null;
  if (!check) fail(`no answer may be sent for function "${String(name).slice(0, 30)}"`);
  check(answer, { library });
  if (leaksAny(JSON.stringify(answer), privateStrings)) fail('the answer holds a private string from this scan');
  return answer;
}

export { CODES };
