import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [expectedPath, actualPath] = process.argv.slice(2);
if (!expectedPath || !actualPath) throw new Error('usage: node N8N_MEMO_MULTI_POSITION_DELETE_PUBLISHED_PARITY.mjs expected.json actual.json');
const expected = JSON.parse(await readFile(expectedPath, 'utf8'));
const actual = JSON.parse(await readFile(actualPath, 'utf8'));
const normalize = (value) => {
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
assert.equal(actual.id || actual.workflow_id, 'kcMcBQos5cxsnWU1');
assert.equal(actual.nodes.length, 137);
assert.equal(Object.keys(actual.connections || {}).length, 136);
const expectedNodes = new Map(expected.nodes.map((node) => [node.name, node]));
const actualNodes = new Map(actual.nodes.map((node) => [node.name, node]));
assert.deepEqual([...actualNodes.keys()].sort(), [...expectedNodes.keys()].sort());
assert.deepEqual(actual.connections, expected.connections);
for (const [name, node] of expectedNodes) assert.deepEqual(normalize(actualNodes.get(name)), normalize(node), `node drift: ${name}`);
const counts = actual.nodes.reduce((result, node) => {
  for (const type of Object.keys(node.credentials || {})) result[type] = (result[type] || 0) + 1;
  return result;
}, {});
assert.deepEqual(counts, { openAiApi: 1, dropboxOAuth2Api: 28, httpHeaderAuth: 2 });
assert.deepEqual(actual.pinData || {}, {});
const serialized = JSON.stringify(actual);
for (const forbidden of ['"accessToken":', '"refreshToken":', '"clientSecret":', '"replyToken":', '"reply_token":', '"user_id":']) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}
console.log(JSON.stringify({ published_parity: 'PASS', workflow_id: actual.id || actual.workflow_id, nodes: actual.nodes.length, connection_sources: Object.keys(actual.connections || {}).length, credential_counts: counts }, null, 2));
