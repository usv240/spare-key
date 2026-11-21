// Steps freshness (TECHNICAL-DESIGN.md section 9.3, changed on day 1). Settings menus change, and this computer cannot
// know today's steps. For a library entry older than fresh_days, the cloud compares the library's steps with the official
// help page the library cites, and says whether they still match.
//
// Google Search grounding was the plan, but it is not on the Gemini Developer API free tier; the URL context tool is.
// Measured on November 21, 2026: the URL context tool read the Safety Net page, but could not fetch Google's or Amazon's
// help pages (URL_RETRIEVAL_STATUS_ERROR). So when it cannot read a page, this computer fetches the public help page
// itself (no cookies) and sends its text. Either way the request holds a finding code, the help page's title, address
// and text, and the library's own steps: nothing about the person. The result is shown beside the steps, never instead.
import { cloudJson } from '../ai.js';
import { cleanText } from '../../../shared/plan/invariants.js';

const ANSWER = `Answer with JSON only, in this exact shape, and nothing else:
{"still_matches": "yes" or "no" or "not_sure", "what_changed": "one or two short sentences in plain words, or an empty string"}
Never call anything safe or secure. No names, phone numbers or links.`;

const SYSTEM_URL = `You check whether a short list of steps still matches an official help page.
Read the page at help_url with the URL context tool. Compare what it says today with the steps given.
Say "not_sure" if you could not read the page.
${ANSWER}`;

const SYSTEM_TEXT = `You check whether a short list of steps still matches an official help page.
The page's text is given in page_text. Compare it with the steps given. Say "not_sure" if the text does not cover them.
${ANSWER}`;

function parse(answer) {
  const json = String(answer || '').match(/\{[\s\S]*\}/);
  try { return json ? JSON.parse(json[0]) : {}; } catch { return {}; }
}

/**
 * fetchPage(url) returns the help page's main text, read on this computer, or '' when it cannot.
 * Returns { still_matches, what_changed, read: [{ url, status }], via: 'url_context' | 'page_text', model, checked_at }.
 */
export async function checkFreshness({ code, entry, library, privateStrings = [], fetchPage, onSend }) {
  const source = entry.sources[0];
  const body = { code, help_title: source.title, help_url: source.url, steps: entry.steps };
  const first = await cloudJson({ purpose: 'freshness', body, system: SYSTEM_URL, schema: null, tools: [{ urlContext: {} }], library, privateStrings, onSend });
  const read = (first.urlContext?.urlMetadata || []).map(m => ({ url: m.retrievedUrl, status: m.urlRetrievalStatus }));
  let parsed = parse(first.answer);
  let via = 'url_context';
  let model = first.model;
  if (!read.some(m => /SUCCESS/.test(m.status || ''))) {
    const text = fetchPage ? await fetchPage(source.url).catch(() => '') : '';
    if (!text) return { still_matches: 'not_sure', what_changed: '', read, via, model, checked_at: new Date().toISOString() };
    const second = await cloudJson({ purpose: 'freshness', body: { ...body, page_text: text }, system: SYSTEM_TEXT, schema: null, library, privateStrings, onSend });
    parsed = parse(second.answer);
    via = 'page_text';
    model = second.model;
    read.push({ url: source.url, status: 'read on this computer' });
  }
  return {
    still_matches: ['yes', 'no', 'not_sure'].includes(parsed.still_matches) ? parsed.still_matches : 'not_sure',
    what_changed: cleanText(String(parsed.what_changed || '').slice(0, 300)).text,
    read,
    via,
    model,
    checked_at: new Date().toISOString(),
  };
}

/** The main text of a help page fetched on this computer, without cookies. Used only for the library's cited pages. */
export async function fetchHelpPage(url) {
  const res = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'Accept-Language': 'en-US' } });
  if (!res.ok) return '';
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  for (const el of doc.querySelectorAll('script, style, noscript, nav, header, footer, svg, form')) el.remove();
  const main = doc.querySelector('article, [role="main"], main, #help-content, .help-content') || doc.body;
  return (main?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 7000);
}
