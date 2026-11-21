// Starts the MCP server over stdio with the SDK's client and calls each tool once.
// Usage: node build.mjs && cd mcp && node test.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const client = new Client({ name: 'spare-key-mcp-test', version: '0.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ['server.mjs'], cwd: import.meta.dirname }));
const { tools } = await client.listTools();
assert.deepEqual(tools.map(t => t.name).sort(), ['get_steps', 'list_findings', 'make_plan']);

const list = await client.callTool({ name: 'list_findings', arguments: {} });
assert.match(list.content[0].text, /gmail\.forwarding\.external/);

const steps = await client.callTool({ name: 'get_steps', arguments: { code: 'gmail.forwarding.external' } });
assert.match(steps.content[0].text, /Screenshot first/);
assert.match(steps.content[0].text, /talk to an advocate/i);

const plan = await client.callTool({ name: 'make_plan', arguments: { findings: [{ code: 'maps.sharing.person', ownership: 'not_mine' }, { code: 'gmail.forwarding.external' }] } });
const p = plan.content[0].text;
assert.match(p, /1\. Screenshot first/);
assert.match(p, /2\. Talk to an advocate/);
assert.ok(!/Change now/.test(p), 'with no answer about timing, nothing that may be noticed is changed now');
assert.ok(!/\bsafe\b/i.test(p.replace(/safe_to_change_now/g, '')));

// Free text cannot get in: an unknown code is refused by the schema.
const bad = await client.callTool({ name: 'get_steps', arguments: { code: 'my ex is reading my mail' } }).catch(e => ({ isError: true, content: [{ text: String(e) }] }));
assert.ok(bad.isError, 'free text must be refused');

console.log('MCP server: 3 tools, all answer; free text is refused.');
console.log(p.split('\n').slice(0, 6).join('\n'));
await client.close();
