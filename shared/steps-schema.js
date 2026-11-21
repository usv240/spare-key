// Validation for the steps library (data/steps.json). Used by the tests, the build, and the Steps API.
import { CODES } from './findings.js';

const NOTICE = ['notifies', 'noticeable', 'unlikely', 'unknown'];
const OFFICIAL = /^https:\/\/(support\.google\.com|www\.amazon\.com\/gp\/help|www\.techsafety\.org|techsafety\.org|ceta\.tech\.cornell\.edu|support\.apple\.com)\//;

/** Returns a list of problems; empty when the library is valid. */
export function validateLibrary(lib) {
  const problems = [];
  if (!lib || !Array.isArray(lib.entries)) return ['entries must be a list'];
  const seen = new Set();
  for (const e of lib.entries) {
    const where = e?.code || '(no code)';
    if (!CODES[e?.code]) problems.push(`${where}: not a finding code`);
    if (seen.has(e?.code)) problems.push(`${where}: listed twice`);
    seen.add(e?.code);
    for (const key of ['title', 'what_it_means', 'notice_why', 'if_not_safe_yet', 'verified_at', 'verified_how']) {
      if (typeof e?.[key] !== 'string' || !e[key].trim()) problems.push(`${where}: missing ${key}`);
    }
    if (!NOTICE.includes(e?.who_can_notice)) problems.push(`${where}: who_can_notice must be one of ${NOTICE.join(', ')}`);
    // "unlikely" lets a plan change something now; only something seen on a test account or an official source may say so.
    if (e?.who_can_notice === 'unlikely' && !e.steps_followed && !/source (page )?says/i.test(e.verified_how || '')) problems.push(`${where}: "unlikely" needs a test account or an official source`);
    if (!Array.isArray(e?.steps) || !e.steps.length) problems.push(`${where}: no steps`);
    if (!Array.isArray(e?.evidence_first) || !e.evidence_first.length) problems.push(`${where}: no evidence_first`);
    if (!Array.isArray(e?.sources) || !e.sources.length) problems.push(`${where}: no sources`);
    for (const s of e?.sources || []) if (!OFFICIAL.test(s?.url || '') || !s?.title) problems.push(`${where}: source is not an official help page: ${s?.url}`);
    for (const c of e?.also_check || []) if (!CODES[c]) problems.push(`${where}: also_check has an unknown code ${c}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e?.verified_at || '')) problems.push(`${where}: verified_at must be a date`);
    if (typeof e?.steps_followed !== 'boolean') problems.push(`${where}: steps_followed must be true or false`);
  }
  for (const code of Object.keys(CODES)) if (!seen.has(code)) problems.push(`${code}: no library entry`);
  return problems;
}

/** The library as a map from code to entry. */
export const libraryMap = lib => Object.fromEntries((lib?.entries || []).map(e => [e.code, e]));
