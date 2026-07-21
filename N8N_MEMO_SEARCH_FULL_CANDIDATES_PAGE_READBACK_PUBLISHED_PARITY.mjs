import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [expectedPath, actualPath] = process.argv.slice(2);
if (!expectedPath || !actualPath) throw new Error('usage: node N8N_MEMO_SEARCH_FULL_CANDIDATES_PAGE_READBACK_PUBLISHED_PARITY.mjs expected.json actual.json');
const expected = JSON.parse(await readFile(expectedPath, 'utf8'));
const actual = JSON.parse(await readFile(actualPath, 'utf8'));
const normalizeNode = (value) => {
  const node = structuredClone(value);
  delete node.id;
  delete node.position;
  if (node.credentials) node.credentials = Object.fromEntries(Object.keys(node.credentials).sort().map((type) => [type, { redacted: true }]));
  if (node.type === 'n8n-nodes-base.code') node.parameters.mode ??= 'runOnceForAllItems';
  if (node.type === 'n8n-nodes-base.splitInBatches') node.parameters.batchSize ??= 1;
  if (node.type === 'n8n-nodes-base.dropbox' && node.parameters?.operation === 'download') node.parameters.binaryPropertyName ??= 'data';
  if (node.type === 'n8n-nodes-base.extractFromFile') node.parameters.binaryPropertyName ??= 'data';
  return node;
};
const expectedNodes = new Map(expected.nodes.map((entry) => [entry.name, entry]));
const actualNodes = new Map(actual.nodes.map((entry) => [entry.name, entry]));
assert.equal(actual.id || actual.workflow_id, 'kcMcBQos5cxsnWU1');
assert.equal(actual.nodes.length, 135);
assert.equal(Object.keys(actual.connections || {}).length, 134);
assert.deepEqual([...actualNodes.keys()].sort(), [...expectedNodes.keys()].sort());
assert.deepEqual(actual.connections, expected.connections);
for (const [name, entry] of expectedNodes) assert.deepEqual(normalizeNode(actualNodes.get(name)), normalizeNode(entry), `node drift: ${name}`);
const credentialCounts = actual.nodes.reduce((counts, entry) => {
  for (const type of Object.keys(entry.credentials || {})) counts[type] = (counts[type] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(credentialCounts, { openAiApi: 1, dropboxOAuth2Api: 29, httpHeaderAuth: 2 });
assert.deepEqual(actual.pinData || {}, {});
const serialized = JSON.stringify(actual);
for (const forbidden of ['"accessToken":', '"refreshToken":', '"clientSecret":', '"replyToken":', '"reply_token":', '"user_id":']) assert.equal(serialized.includes(forbidden), false, forbidden);
console.log(JSON.stringify({ published_parity: 'PASS', workflow_id: actual.id || actual.workflow_id, nodes: actual.nodes.length, connection_sources: Object.keys(actual.connections || {}).length, credential_counts: credentialCounts }, null, 2));
