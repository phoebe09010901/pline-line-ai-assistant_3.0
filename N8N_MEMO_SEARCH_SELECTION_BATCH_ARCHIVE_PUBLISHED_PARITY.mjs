import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [expectedPath, actualPath] = process.argv.slice(2);
if (!expectedPath || !actualPath) {
  throw new Error('usage: node N8N_MEMO_SEARCH_SELECTION_BATCH_ARCHIVE_PUBLISHED_PARITY.mjs expected.json actual-sanitized.json');
}

const expected = JSON.parse(await readFile(expectedPath, 'utf8'));
const actual = JSON.parse(await readFile(actualPath, 'utf8'));
const expectedNodes = new Map(expected.nodes.map((node) => [node.name, node]));
const actualNodes = new Map(actual.nodes.map((node) => [node.name, node]));

const stripCredentialIdentity = (node) => {
  const copy = structuredClone(node);
  // n8n regenerates canvas-only node IDs and coordinates when a validated
  // clipboard draft is pasted into an empty workflow.  They do not affect
  // expressions, named connections, credentials, or runtime behavior.
  delete copy.id;
  delete copy.position;
  // The n8n UI omits an explicit Loop Over Items batchSize of 1 because it is
  // the node's serialized default.  Normalize only that exact node/default.
  if (copy.name === 'Memo Batch Delete Loop' && copy.type === 'n8n-nodes-base.splitInBatches') {
    copy.parameters ||= {};
    copy.parameters.batchSize ??= 1;
  }
  // The Dropbox node likewise omits its default binary output property.
  if (copy.type === 'n8n-nodes-base.dropbox' && copy.parameters?.operation === 'download') {
    copy.parameters.binaryPropertyName ??= 'data';
  }
  if (copy.type === 'n8n-nodes-base.extractFromFile') {
    copy.parameters.binaryPropertyName ??= 'data';
  }
  if (copy.credentials) {
    copy.credentials = Object.fromEntries(Object.keys(copy.credentials).sort().map((type) => [type, { redacted: true }]));
  }
  return copy;
};

assert.equal(actual.id || actual.workflow_id, 'kcMcBQos5cxsnWU1');
assert.equal(actual.nodes.length, 127);
assert.equal(Object.keys(actual.connections || {}).length, 126);
assert.equal(actualNodes.size, expectedNodes.size);
assert.deepEqual([...actualNodes.keys()].sort(), [...expectedNodes.keys()].sort());
assert.deepEqual(actual.connections, expected.connections);

for (const [name, node] of expectedNodes) {
  assert.deepEqual(stripCredentialIdentity(actualNodes.get(name)), stripCredentialIdentity(node), `node drift: ${name}`);
}

const credentialCounts = actual.nodes.reduce((counts, node) => {
  for (const type of Object.keys(node.credentials || {})) counts[type] = (counts[type] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(credentialCounts, { openAiApi: 1, dropboxOAuth2Api: 28, httpHeaderAuth: 2 });
assert.deepEqual(actual.pinData || {}, {});

const serialized = JSON.stringify(actual);
for (const forbidden of ['"accessToken":', '"refreshToken":', '"clientSecret":', '"replyToken":', '"reply_token":', '"user_id":']) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

console.log(JSON.stringify({
  published_parity: 'PASS',
  workflow_id: actual.id || actual.workflow_id,
  nodes: actual.nodes.length,
  connection_sources: Object.keys(actual.connections || {}).length,
  credential_counts: credentialCounts,
}, null, 2));
