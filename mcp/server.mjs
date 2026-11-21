#!/usr/bin/env node
// Spare Key MCP server: the verified steps library for advocates' and developers' AI assistants.
//
// A chatbot asked "how do I stop my ex seeing my location" tends to give the steps and leave out the warning that the
// change can alert the other person (NYU Tandon, USENIX Security 2026). An assistant that calls these tools gets the
// current steps with that warning attached, and a plan in a safety-first order built by code.
//
// Every input is an enum (finding codes, yes/no answers), so no name, address or story can be sent to it. It runs on
// your own computer over stdio and reads the public Steps API (https://spare-key-app.web.app/api/v1), falling back to the
// copy of the library bundled with it.
//
// Tools:
//   list_findings   every finding code with its title, group and whether a change may be noticed
//   get_steps       one code's verified steps, what to screenshot first, the warning, and what to do if now is not a good time
//   make_plan       a plan, in order, from codes and optional situation answers, with Spare Key's safety rules applied
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CODES, SITUATION, OWNERSHIP, GROUP_LABELS } from './lib/findings.js';
import { buildPlan } from './lib/plan/engine.js';
import { applyInvariants } from './lib/plan/invariants.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.SPARE_KEY_API || 'https://spare-key-app.web.app/api/v1';
const HOTLINE = 'National Domestic Violence Hotline: call 1-800-799-7233, text START to 88788, or chat at thehotline.org (free, 24/7).';

let library = null;
async function loadLibrary() {
  if (library) return library;
  try {
    const index = await (await fetch(`${API}/index.json`, { signal: AbortSignal.timeout(8000) })).json();
    const entries = await Promise.all(index.codes.map(c => fetch(`${API}/steps/${c.code}.json`, { signal: AbortSignal.timeout(8000) }).then(r => r.json())));
    library = { from: 'live', updated_at: index.updated_at, map: Object.fromEntries(entries.map(e => [e.code, e])) };
  } catch {
    const lib = JSON.parse(await readFile(path.join(here, 'lib', 'steps.json'), 'utf8'));
    library = { from: 'bundled', updated_at: lib.updated_at, map: Object.fromEntries(lib.entries.map(e => [e.code, e])) };
  }
  return library;
}

const NOTICE_WORDS = { notifies: 'The other person is told.', noticeable: 'The other person may notice.', unlikely: 'Unlikely to be noticed.', unknown: 'Not known whether the other person is told; treat it as noticeable.' };
const text = s => ({ content: [{ type: 'text', text: s }] });

function entryText(e) {
  return [
    `${e.title} (${e.code})`,
    `What it means: ${e.what_it_means}`,
    `Could the other person notice a change? ${NOTICE_WORDS[e.who_can_notice] || NOTICE_WORDS.unknown} ${e.notice_why}`,
    `Screenshot first: ${e.evidence_first.join(' ')}`,
    `Steps, when it is a good time:\n${e.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`,
    `If now is not a good time: ${e.if_not_safe_yet}`,
    `Sources: ${e.sources.map(s => `${s.title} <${s.url}>`).join('; ')}`,
    `Checked: ${e.verified_at} (${e.verified_how}).`,
  ].join('\n');
}

const server = new McpServer({ name: 'spare-key', version: '0.1.0' });
const codeEnum = z.enum(Object.keys(CODES));

server.registerTool('list_findings', {
  title: 'List Spare Key finding codes',
  description: 'Every kind of account access Spare Key knows, as a finding code, with its title, group and whether removing it may be noticed. Use the codes with get_steps and make_plan.',
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => {
  const lib = await loadLibrary();
  const lines = Object.keys(CODES).map(c => {
    const e = lib.map[c];
    return `${c}: ${e?.title || c} [${GROUP_LABELS[CODES[c].group]}; ${NOTICE_WORDS[e?.who_can_notice] || NOTICE_WORDS.unknown}]`;
  });
  return text(`Spare Key steps library (${lib.from}, updated ${lib.updated_at}).\n${lines.join('\n')}`);
});

server.registerTool('get_steps', {
  title: 'Get verified steps for one finding',
  description: 'The verified steps to remove one kind of access, with what to screenshot first, whether the other person may notice, and what to do if now is not a good time. Always pass the warning on: changing a setting can alert the other person.',
  inputSchema: { code: codeEnum.describe('A finding code from list_findings, like gmail.forwarding.external') },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ code }) => {
  const lib = await loadLibrary();
  const e = lib.map[code];
  return e ? text(`${entryText(e)}\n\nBefore changing anything that may be noticed, talk to an advocate. ${HOTLINE}`) : text(`No library entry for ${code}.`);
});

server.registerTool('make_plan', {
  title: 'Make a safety-first plan from finding codes',
  description: 'An ordered plan from finding codes and optional situation answers: screenshot first, an advocate before any noticeable change, changes that may be noticed wait unless the person says now is a good time, and everything not checked gets a "check it yourself" step. Built by code with Spare Key\'s safety rules; no model.',
  inputSchema: {
    findings: z.array(z.object({ code: codeEnum, ownership: z.enum(OWNERSHIP).optional().describe('mine, not_mine or unsure; leave out if not known') })).min(1).max(60),
    living: z.enum(SITUATION.living).optional(),
    safe_to_change_now: z.enum(SITUATION.safe_to_change_now).optional().describe('Leave out unless the person said; the default is the most cautious answer'),
    children_shared: z.enum(SITUATION.children_shared).optional(),
    has_advocate: z.enum(SITUATION.has_advocate).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async args => {
  const lib = await loadLibrary();
  const findings = args.findings.map((f, i) => ({ ref: `f${i + 1}`, code: f.code, ownership: f.ownership || 'unsure' }));
  const situation = Object.fromEntries(['living', 'safe_to_change_now', 'children_shared', 'has_advocate'].filter(k => args[k]).map(k => [k, args[k]]));
  const ctx = { findings, situation, notChecked: ['other_services'], library: lib.map };
  const { plan } = applyInvariants(buildPlan(ctx), ctx);
  const LABEL = { document: 'Screenshot first', talk_to_advocate: 'Talk to an advocate', change_now: 'Change now', wait: 'Wait for a better time', check_manually: 'Check it yourself' };
  const lines = plan.actions.map((a, i) => {
    const head = `${i + 1}. ${LABEL[a.action]}`;
    if (a.action === 'document') return `${head}: screenshot each of these settings before anything changes: ${[...new Set(a.refs.map(r => lib.map[findings.find(f => f.ref === r).code]?.title))].join('; ')}.`;
    if (a.action === 'talk_to_advocate') return `${head}. ${a.why} ${HOTLINE}`;
    if (a.action === 'check_manually') return `${head}. Spare Key does not cover every service. Guides: https://www.techsafety.org/resources-survivors`;
    const e = lib.map[a.code];
    const warn = a.warning ? ` Warning: ${a.warning}` : '';
    const body = a.action === 'change_now' ? `\n   Steps: ${e.steps.join(' ')}` : `\n   For now: ${e.if_not_safe_yet}`;
    return `${head}: ${e.title}${a.refs.length > 1 ? ` (${a.refs.length})` : ''}. ${a.why}${warn}${body}`;
  });
  return text(`Plan (library ${lib.from}, updated ${lib.updated_at}). Pass every warning on to the person.\n\n${lines.join('\n')}`);
});

await server.connect(new StdioServerTransport());
