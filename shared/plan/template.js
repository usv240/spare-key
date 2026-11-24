// The cloud plan as a Firebase AI Logic server prompt template. The instructions, the answer format and the three
// functions live on Firebase's server; a client sends only the template's id and the finding codes and chosen answers.
//
// The template's input schema is the same allow-list as shared/cloud-safe.js, written out as JSON Schema: every value
// is an enum or a ref like "f1", and no other key is allowed. So the server itself refuses a request that holds a name,
// an address or any free text, even from a client whose own check was removed. Built from the shared code, so the
// template, the extension, the website and the Android app cannot drift apart. tools/templates.mjs creates it.
import { CODES, CHECK_IDS, UNCHECKED_SERVICES, OWNERSHIP, RECENCY, HOW_FOUND, SITUATION } from '../findings.js';
import { PLAN_SYSTEM, PLAN_SCHEMA, PLAN_TOOLS } from './prompts.js';

/** Template ids, newest first: a client tries them in order, then falls back to a direct call through the same gate. */
export const PLAN_TEMPLATE = 'spare-key-plan-v1';
export const PLAN_TEMPLATE_BACKUP = 'spare-key-plan-b-v1';

const enumOf = values => ({ type: 'string', enum: values });

/** The request the server accepts: toCloud()'s body, as JSON Schema with nothing free-form in it. */
export const PLAN_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ref: { type: 'string', pattern: '^f[0-9]{1,3}$' },
          code: enumOf(Object.keys(CODES)),
          ownership: enumOf(OWNERSHIP),
          recency: enumOf(RECENCY),
          how_found: enumOf(HOW_FOUND),
        },
        required: ['ref', 'code', 'ownership', 'recency', 'how_found'],
      },
    },
    situation: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(Object.entries(SITUATION).map(([k, v]) => [k, enumOf(v)])),
    },
    not_checked: { type: 'array', items: enumOf([...CHECK_IDS, ...UNCHECKED_SERVICES]) },
  },
  required: ['findings', 'situation', 'not_checked'],
};

// Server prompt templates do not yet constrain output to a list of enums, so the answer's "action" is a plain string
// there; shared/plan/invariants.js drops any action that is not one of the five.
const outputSchema = JSON.parse(JSON.stringify(PLAN_SCHEMA, (k, v) => (k === 'enum' || k === 'format' || k === 'maxLength' ? undefined : v)));
const toolSchema = p => JSON.parse(JSON.stringify(p, (k, v) => (k === 'format' ? undefined : v)));

/** The Dotprompt text of the plan template for one model. JSON is valid YAML, so the frontmatter is written as JSON. */
export function planTemplateString(model) {
  const front = {
    model,
    config: { temperature: 0 },
    input: { schema: PLAN_INPUT_SCHEMA },
    output: { format: 'json', schema: outputSchema },
    tools: PLAN_TOOLS[0].functionDeclarations.map(f => ({ name: f.name, description: f.description, input: { schema: toolSchema(f.parameters) } })),
  };
  return [
    '---',
    ...Object.entries(front).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    '---',
    '{{role "system"}}',
    PLAN_SYSTEM,
    '',
    '{{role "user"}}',
    // Plain Handlebars loops: the server does not support a "json" helper.
    'The findings, by code only:',
    '{{#each findings}}- {{ref}}: {{code}}, ownership {{ownership}}, recency {{recency}}, found by {{how_found}}',
    '{{/each}}The answers the person chose to share: safe_to_change_now={{situation.safe_to_change_now}}, living={{situation.living}}, children_shared={{situation.children_shared}}, has_advocate={{situation.has_advocate}} (an empty value was not shared).',
    'Not checked: {{#each not_checked}}{{this}} {{/each}}',
    '{{history}}',
    '',
  ].join('\n');
}
