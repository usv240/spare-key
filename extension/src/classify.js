// Gemini Nano on this computer (TECHNICAL-DESIGN.md section 6). Every prompt here runs ONLY_ON_DEVICE: what it reads is
// the person's own settings pages, so there is no cloud fallback, on purpose. Without Nano these throw, and the scan
// uses code alone.
import { deviceJson, deviceStatus, TEXT_AND_IMAGE } from './ai.js';

// The longest one Gemini Nano call may take before it is stopped and the scan carries on with code alone. Warm calls
// took 4 to 45 seconds on the builder's PC (November 21 and 22, 2026).
const NANO_LIMIT_MS = 90000;

export const CLASSIFY_SYSTEM = `You sort entries from a person's own account settings page.
For each entry, say what it is, whether it is the account owner's own, and what it gives access to.
Use only what the entry says. If the entry does not say, answer "unknown". Never guess a person's identity.
"is_owner" is "yes" only when the entry plainly belongs to the account owner (their own address, or "this device").
"this_computer" is "yes" only when the entry says it is this device or the current session.`;

export const ACCESS = ['location', 'mail', 'account', 'purchases', 'addresses', 'photos', 'cameras', 'browsing', 'messages', 'unknown'];
export const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          kind: { type: 'string', enum: ['person', 'device', 'app', 'email_address', 'phone_number', 'share_link', 'unknown'] },
          is_owner: { type: 'string', enum: ['yes', 'no', 'unknown'] },
          access: { type: 'array', items: { type: 'string', enum: ACCESS } },
          recency: { type: 'string', enum: ['now', 'today', 'this_week', 'this_month', 'older', 'unknown'] },
          this_computer: { type: 'string', enum: ['yes', 'no', 'unknown'] },
        },
        required: ['i', 'kind', 'is_owner', 'access', 'recency', 'this_computer'],
      },
    },
  },
  required: ['items'],
};

export const READ_PAGE_SYSTEM = `This is the text of one settings page from the person's own account.
List every entry the page shows for the thing named below: each person, device, app, address, filter or setting.
Make one entry per thing, never one per line. Put every line about that thing in its entry, each on its own line, copied
exactly: its name, then words like "This device", "Active now", "Has access to Gmail", or the address it sends to.
Leave out headings, buttons, help text and links to other pages. If the page shows none, return an empty list.`;
export const READ_PAGE_SCHEMA = {
  type: 'object',
  properties: { entries: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', maxLength: 300 } }, required: ['text'] } } },
  required: ['entries'],
};

// A screenshot of a phone app's sharing screen (TECHNICAL-DESIGN.md section 6.3): read by Gemini Nano on this computer
// only, because it shows names. The picture is not kept after reading.
const READ_SHOT_SYSTEM = `This is a screenshot from the person's own phone: a location-sharing or family app's screen, like Life360, Find My, or a phone carrier's family locator.
List every person or device on the screen that can see where the person is. Make one entry per person, never one per line: their name or label first, then the words shown under it, like "Can see your location" or "Sharing since March", copied exactly.
Mark the person themselves ("Me", "You", "This phone") with is_owner "yes". Leave out buttons, maps and menus. If the screen shows none, return an empty list.`;
const READ_SHOT_SCHEMA = {
  type: 'object',
  properties: {
    app: { type: 'string', maxLength: 60 },
    entries: { type: 'array', items: { type: 'object', properties: { text: { type: 'string', maxLength: 200 }, is_owner: { type: 'string', enum: ['yes', 'no', 'unknown'] } }, required: ['text', 'is_owner'] } },
  },
  required: ['entries'],
};

/** Read one screenshot ({ mimeType, data } in base64) on this computer. Returns { app, entries: [{ i, text, is_owner }] }. */
export async function readScreenshot({ mimeType, data }) {
  if (!/^image\/(png|jpeg|webp)$/.test(mimeType || '') || typeof data !== 'string') throw new Error('Not a picture');
  const answer = await deviceJson({
    system: READ_SHOT_SYSTEM, schema: READ_SHOT_SCHEMA, inputs: TEXT_AND_IMAGE,
    text: ['Read this screenshot.', { inlineData: { mimeType, data } }],
    // The first picture also loads the image model, which took most of 159 seconds on November 22, 2026.
    timeoutMs: 4 * NANO_LIMIT_MS,
  });
  return shotEntries(answer);
}

export { READ_SHOT_SYSTEM, READ_SHOT_SCHEMA };

/** A screenshot answer, cleaned: one entry per person. Shared with the website's practice check. */
export function shotEntries(answer) {
  // Nano sometimes lists a person's name and the words under it as two entries: the words join the name above them.
  // Measured on November 22, 2026 (tools/screenshot-check.mjs): "Sam Porter", then "Can see your location ...".
  const DESCRIBES = /^(can see|sharing|shared|since|until|last (seen|updated)|location|this phone|paused|invited|at |near )/i;
  const merged = [];
  for (const e of answer.entries || []) {
    const text = String(e.text || '').trim().slice(0, 200);
    if (!text) continue;
    const is_owner = ['yes', 'no'].includes(e.is_owner) ? e.is_owner : 'unknown';
    if (DESCRIBES.test(text) && merged.length) { merged[merged.length - 1].text = `${merged[merged.length - 1].text}\n${text}`.slice(0, 200); continue; }
    if (!merged.some(x => x.text === text)) merged.push({ text, is_owner });
  }
  const entries = merged.slice(0, 30).map((e, i) => ({ i, ...e }));
  return { app: String(answer.app || '').slice(0, 60), entries };
}

const BATCH = 12;
const CHUNK = 3500; // 3,500 characters measured 913 tokens against a 9,216-token input quota (docs/day1-verify.md).

export const nanoReady = async () => (await deviceStatus()) === 'available';

/**
 * Classify a check's entries. `owner` is the checked account ({ email, name }), local only.
 * Returns the items in the same order as `entries`, each with the enums above (missing ones filled as unknown).
 */
export async function classifyEntries({ description, owner, entries }) {
  const out = new Array(entries.length).fill(null);
  for (let start = 0; start < entries.length; start += BATCH) {
    const batch = entries.slice(start, start + BATCH).map((e, k) => ({ i: start + k, text: String(e.text).slice(0, 300) }));
    const text = [
      `Check: ${description}`,
      `Account owner: ${owner?.name || 'unknown name'} <${owner?.email || 'unknown email'}>`,
      'Entries:',
      JSON.stringify(batch),
    ].join('\n');
    const answer = await deviceJson({ system: CLASSIFY_SYSTEM, schema: CLASSIFY_SCHEMA, text, timeoutMs: NANO_LIMIT_MS });
    for (const item of answer.items || []) {
      if (!Number.isInteger(item.i) || item.i < start || item.i >= start + batch.length) continue;
      out[item.i] = {
        kind: item.kind || 'unknown',
        is_owner: item.is_owner || 'unknown',
        access: (item.access || []).filter(a => ACCESS.includes(a)),
        recency: item.recency || 'unknown',
        this_computer: item.this_computer || 'unknown',
      };
    }
  }
  return out;
}

const flat = s => String(s).replace(/\s+/g, ' ').trim();

/** When a reader found nothing on a page that loaded: Nano reads the page text itself, in chunks. */
export async function readWholePage({ description, text }) {
  const entries = [];
  const body = String(text || '');
  for (let start = 0; start < body.length && start < CHUNK * 4; start += CHUNK) {
    const chunk = body.slice(start, start + CHUNK);
    const answer = await deviceJson({ system: READ_PAGE_SYSTEM, schema: READ_PAGE_SCHEMA, text: `Find: ${description}\n\nPage text:\n${chunk}`, timeoutMs: NANO_LIMIT_MS });
    for (const e of answer.entries || []) {
      const t = String(e.text || '').trim().slice(0, 300);
      // Keep only words that are really on the page: Nano copies, it does not write.
      if (t && flat(body).includes(flat(t.slice(0, Math.min(40, t.length)))) && !entries.some(x => x.text === t)) entries.push({ i: entries.length, text: t, href: '', state: [] });
    }
  }
  return entries;
}
