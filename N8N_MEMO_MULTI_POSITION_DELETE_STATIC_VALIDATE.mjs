import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const baselinePath = process.argv[3] || './backups/memo-multi-position-delete-20260721-214823/published/PUBLISHED_58974dda_SANITIZED.json';
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const mapNodes = (value) => new Map(value.nodes.map((node) => [node.name, node]));
const nodes = mapNodes(workflow);
const baselineNodes = mapNodes(baseline);
const normalizeStableNode = (value) => {
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

assert.equal(workflow.id, 'kcMcBQos5cxsnWU1');
assert.equal(workflow.nodes.length, 137);
assert.equal(Object.keys(workflow.connections || {}).length, 136);
assert.equal(new Set(workflow.nodes.map((node) => node.name)).size, workflow.nodes.length);
assert.equal(new Set(workflow.nodes.map((node) => node.id)).size, workflow.nodes.length);
assert.equal(Object.hasOwn(workflow, 'pinData'), false);
assert.equal(Object.hasOwn(workflow, 'versionId'), false);

const allowedChanged = new Set([
  ...workflow.nodes.filter((node) => node.name.includes('Batch Delete')).map((node) => node.name),
  'Memo CRUD Finalizer Payload', 'Memo CRUD Finalizer Callback', 'Memo CRUD Callback Result',
]);
for (const [name, node] of baselineNodes) {
  if (name === 'Dropbox Batch Delete Reentry Readback' || name === 'Memo Batch Delete Reentry Extract') continue;
  assert.ok(nodes.has(name), `baseline node missing: ${name}`);
  if (!allowedChanged.has(name)) assert.deepEqual(normalizeStableNode(nodes.get(name)), normalizeStableNode(node), `unrelated node drift: ${name}`);
}

for (const node of workflow.nodes) {
  if (node.parameters?.jsCode) assert.doesNotThrow(() => new Function(node.parameters.jsCode), node.name);
}
const incoming = new Map(workflow.nodes.map((node) => [node.name, 0]));
for (const outputs of Object.values(workflow.connections || {})) {
  for (const groups of Object.values(outputs || {})) {
    for (const group of groups || []) for (const edge of group || []) incoming.set(edge.node, (incoming.get(edge.node) || 0) + 1);
  }
}
for (const node of workflow.nodes) {
  const auxiliary = Object.keys(workflow.connections[node.name] || {}).some((type) => type !== 'main');
  if (node.name === 'Webhook' || auxiliary) continue;
  assert.ok((incoming.get(node.name) || 0) > 0, `orphan node: ${node.name}`);
}

const counts = workflow.nodes.reduce((result, node) => {
  for (const type of Object.keys(node.credentials || {})) result[type] = (result[type] || 0) + 1;
  return result;
}, {});
assert.deepEqual(counts, { openAiApi: 1, dropboxOAuth2Api: 28, httpHeaderAuth: 2 });
for (const type of ['openAiApi', 'dropboxOAuth2Api', 'httpHeaderAuth']) {
  const reference = baseline.nodes.find((node) => node.credentials?.[type])?.credentials?.[type];
  assert.ok(reference, `${type} baseline reference missing`);
  for (const node of workflow.nodes.filter((entry) => entry.credentials?.[type])) {
    assert.deepEqual(node.credentials[type], reference, `${type} reference drift: ${node.name}`);
  }
}

const code = (name) => nodes.get(name).parameters.jsCode;
assert.match(code('Memo Batch Delete Validate'), /\['single','multiple','range'\]/);
assert.doesNotMatch(code('Memo Batch Delete Validate'), /'all'/);
assert.match(code('Memo Batch Delete Validate'), /memoIds\.length<=5/);
assert.match(code('Memo Batch Delete Validate'), /new Set\(memoIds\)\.size===memoIds\.length/);

const next = (name, output = 0) => workflow.connections[name]?.main?.[output]?.map((edge) => edge.node) || [];
assert.deepEqual(next('Memo Batch Delete Valid Route', 0), ['Dropbox Batch Delete Active Metadata']);
assert.deepEqual(next('Memo Batch Delete Inventory Decision'), ['Memo Batch Delete Preflight Inventory Route']);
assert.deepEqual(next('Memo Batch Delete Preflight Inventory Route', 0), ['Memo Batch Delete Expand']);
assert.deepEqual(next('Memo Batch Delete Preflight Inventory Route', 1), ['Memo Batch Delete Item Failure']);
assert.deepEqual(next('Memo Batch Delete Prepare Archive'), ['Memo Batch Delete Preflight Aggregate']);
assert.deepEqual(next('Memo Batch Delete Prepare Route', 0), ['Memo Batch Delete Execute Expand']);
assert.deepEqual(next('Memo Batch Delete Execute Expand'), ['Memo Batch Delete Loop']);
assert.deepEqual(next('Memo Batch Delete Item Failure'), ['Memo Batch Delete Failure Aggregate']);
assert.deepEqual(next('Memo Batch Delete Failure Aggregate'), ['Memo CRUD Finalizer Payload']);
assert.deepEqual(next('Memo Batch Delete Aggregate'), ['Memo CRUD Finalizer Payload']);
assert.notDeepEqual(next('Memo Batch Delete Item Failure'), ['Memo Batch Delete Loop']);

assert.match(code('Memo Batch Delete Inventory Decision'), /preflight_inventory_valid/);
assert.match(code('Memo Batch Delete Prepare Archive'), /resume_move/);
assert.match(code('Memo Batch Delete Prepare Archive'), /duplicate/);
assert.match(code('Memo Batch Delete Prepare Archive'), /return \{json:/);
assert.doesNotMatch(code('Memo Batch Delete Prepare Archive'), /return \[\{json:/);
assert.match(code('Memo Batch Delete Preflight Aggregate'), /items\.length===request\.memo_ids\.length/);
assert.match(code('Memo Batch Delete Failure Aggregate'), /success_count:completed/);
assert.match(code('Memo Batch Delete Aggregate'), /success_count:count/);
assert.match(code('Memo Batch Delete Aggregate'), /已幫您刪除/);

const update = nodes.get('Dropbox Batch Delete Conditional Archive State');
assert.equal(update.parameters.url, 'https://content.dropboxapi.com/2/files/upload');
const apiArg = update.parameters.headerParameters.parameters.find((entry) => entry.name === 'Dropbox-API-Arg')?.value || '';
assert.match(apiArg, /'\.tag':'update'/);
assert.match(apiArg, /update:\$json\.revision/);
assert.match(apiArg, /autorename:false/);
assert.match(apiArg, /strict_conflict:true/);
assert.doesNotMatch(apiArg, /overwrite/);
const move = nodes.get('Dropbox Batch Delete Collision Safe Move');
assert.equal(move.parameters.url, 'https://api.dropboxapi.com/2/files/move_v2');
assert.match(move.parameters.body, /autorename:false/);

const finalizer = code('Memo CRUD Finalizer Payload');
assert.match(finalizer, /memoIds\.length<=5/);
assert.match(finalizer, /success_count:successCount/);
assert.match(finalizer, /failure_class:failureClass/);
assert.match(nodes.get('Memo CRUD Finalizer Callback').parameters.body, /success_count/);
assert.match(nodes.get('Memo CRUD Finalizer Callback').parameters.body, /failure_class/);

assert.deepEqual(workflow.memo_search_selection_batch_archive_contract.selection_modes, ['single', 'multiple', 'range']);
assert.equal(workflow.memo_search_selection_batch_archive_contract.batch_limit, 5);
assert.equal(workflow.memo_search_selection_batch_archive_contract.preflight_all_or_none, true);
assert.equal(workflow.memo_search_selection_batch_archive_contract.stop_after_first_execution_failure, true);
assert.equal(workflow.memo_search_selection_batch_archive_contract.delete_all_supported, false);

const serialized = JSON.stringify(workflow.nodes.filter((node) => node.name.includes('Batch Delete')));
for (const forbidden of ['reply_token', 'replyToken', 'user_id', 'finalize_token', 'raw payload', 'calendar_', 'codex_delegate', 'crud_task:v1']) {
  assert.equal(serialized.includes(forbidden), false, `forbidden batch contract: ${forbidden}`);
}

console.log(JSON.stringify({
  static_validation: 'PASS', nodes: workflow.nodes.length,
  connection_sources: Object.keys(workflow.connections || {}).length,
  credential_counts: counts, batch_limit: 5,
  preflight_all_or_none: true, stop_after_first_failure: true,
}, null, 2));
