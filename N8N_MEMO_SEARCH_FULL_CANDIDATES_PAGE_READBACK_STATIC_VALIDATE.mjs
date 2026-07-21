import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const baselinePath = process.argv[3] || './backups/memo-search-full-candidates-page-readback-20260721-193041/published/PUBLISHED_f5bf27d5_SANITIZED.json';
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const nodes = new Map(workflow.nodes.map((entry) => [entry.name, entry]));
const baselineNodes = new Map(baseline.nodes.map((entry) => [entry.name, entry]));

const normalizeNode = (value) => {
  const node = structuredClone(value);
  delete node.id;
  delete node.position;
  if (node.credentials) node.credentials = Object.fromEntries(Object.keys(node.credentials).sort().map((type) => [type, { redacted: true }]));
  if (node.type === 'n8n-nodes-base.splitInBatches') node.parameters.batchSize ??= 1;
  if (node.type === 'n8n-nodes-base.dropbox' && node.parameters?.operation === 'download') node.parameters.binaryPropertyName ??= 'data';
  if (node.type === 'n8n-nodes-base.extractFromFile') node.parameters.binaryPropertyName ??= 'data';
  return node;
};

assert.equal(workflow.id, 'kcMcBQos5cxsnWU1');
assert.equal(workflow.nodes.length, 135);
assert.equal(Object.keys(workflow.connections || {}).length, 134);
assert.equal(new Set(workflow.nodes.map((entry) => entry.name)).size, 135);
assert.equal(new Set(workflow.nodes.map((entry) => entry.id)).size, 135);
assert.equal(Object.hasOwn(workflow, 'pinData'), false);
assert.equal(Object.hasOwn(workflow, 'versionId'), false);

const changedBaselineNodes = new Set([
  'Normalize Input', 'Memo Search Aggregate', 'Memo Batch Delete Validate',
  'Memo CRUD Finalizer Payload', 'Memo CRUD Finalizer Callback', 'Memo CRUD Callback Result',
]);
for (const [name, baselineNode] of baselineNodes) {
  assert.ok(nodes.has(name), `baseline node missing: ${name}`);
  if (!changedBaselineNodes.has(name)) assert.deepEqual(normalizeNode(nodes.get(name)), normalizeNode(baselineNode), `baseline drift: ${name}`);
}
for (const [name, connection] of Object.entries(baseline.connections || {})) {
  if (name !== 'Normalize Input') assert.deepEqual(workflow.connections[name], connection, `baseline connection drift: ${name}`);
}

for (const entry of workflow.nodes) if (entry.parameters?.jsCode) assert.doesNotThrow(() => new Function(entry.parameters.jsCode), entry.name);
const incoming = new Map(workflow.nodes.map((entry) => [entry.name, 0]));
for (const outputs of Object.values(workflow.connections || {})) for (const groups of Object.values(outputs || {})) {
  for (const group of groups || []) for (const edge of group || []) incoming.set(edge.node, (incoming.get(edge.node) || 0) + 1);
}
for (const entry of workflow.nodes) {
  const auxiliary = Object.keys(workflow.connections[entry.name] || {}).some((type) => type !== 'main');
  if (entry.name === 'Webhook' || auxiliary) continue;
  assert.ok((incoming.get(entry.name) || 0) > 0, `orphan node: ${entry.name}`);
}

const credentialCounts = workflow.nodes.reduce((counts, entry) => {
  for (const type of Object.keys(entry.credentials || {})) counts[type] = (counts[type] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(credentialCounts, { openAiApi: 1, dropboxOAuth2Api: 29, httpHeaderAuth: 2 });
const refByType = (value, type) => value.nodes.find((entry) => entry.credentials?.[type])?.credentials?.[type];
for (const type of ['openAiApi', 'dropboxOAuth2Api', 'httpHeaderAuth']) {
  const expected = refByType(baseline, type);
  for (const entry of workflow.nodes.filter((candidate) => candidate.credentials?.[type])) assert.deepEqual(entry.credentials[type], expected, `${type}: ${entry.name}`);
}

const searchCode = nodes.get('Memo Search Aggregate').parameters.jsCode;
assert.match(searchCode, /matches\.length > 100/);
assert.match(searchCode, /matches\.map\(\(memo,index\)/);
assert.match(searchCode, /matches\.slice\(0,10\)/);
assert.match(searchCode, /第 1\//);
assert.doesNotMatch(searchCode, /selectionCandidates = matches\.slice\(0,10\)/);

const pageValidate = nodes.get('Memo Search Page Validate').parameters.jsCode;
for (const contract of ['memo_search_page', 'memo_search_selection_snapshot', 'total<=100', 'memoIds.length<=10', 'globalStart===((page-1)*10)+1']) {
  assert.ok(pageValidate.includes(contract), contract);
}
assert.equal(nodes.get('Dropbox Search Page Readback').parameters.operation, 'download');
assert.equal(nodes.get('Dropbox Search Page Readback').parameters.path, '={{ $json.active_path }}');
assert.deepEqual(Object.keys(nodes.get('Dropbox Search Page Readback').credentials || {}), ['dropboxOAuth2Api']);
assert.match(nodes.get('Memo Search Page Aggregate').parameters.jsCode, /item\.memo_id===request\.memo_ids\[index\]/);
assert.match(nodes.get('Memo Search Page Aggregate').parameters.jsCode, /memo\.status==='active'/);
assert.doesNotMatch(JSON.stringify(workflow.nodes.filter((entry) => entry.name.includes('Search Page'))), /upload|move_v2|delete_v2|overwrite|autorename/);

assert.match(nodes.get('Memo Batch Delete Validate').parameters.jsCode, /memoIds\.length<=1/);
const callback = nodes.get('Memo CRUD Finalizer Callback').parameters.body;
for (const field of ['selection_candidates', 'page_candidates', 'page', 'page_count']) assert.ok(callback.includes(field), field);
const serialized = JSON.stringify(workflow);
for (const forbidden of ['"replyToken":', '"reply_token":', '"user_id":', '"accessToken":', '"refreshToken":', '"clientSecret":']) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}
for (const forbiddenRoute of ['calendar_', 'codex_delegate', 'crud_task:v1']) assert.equal(JSON.stringify(workflow.nodes.filter((entry) => entry.name.includes('Search Page'))).includes(forbiddenRoute), false);

console.log(JSON.stringify({
  static_validation: 'PASS',
  nodes: workflow.nodes.length,
  connection_sources: Object.keys(workflow.connections || {}).length,
  credential_counts: credentialCounts,
  baseline_nodes_unchanged: baseline.nodes.length - changedBaselineNodes.size,
  full_snapshot_limit: 100,
  page_size: 10,
  selection_batch_authorized_limit: 1,
}, null, 2));
