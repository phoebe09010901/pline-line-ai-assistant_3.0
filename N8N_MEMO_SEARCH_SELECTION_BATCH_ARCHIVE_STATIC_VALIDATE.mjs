import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const baselinePath = process.argv[3] || './backups/memo-search-selection-batch-archive-20260721-182403/published/PUBLISHED_1067536e_SANITIZED.json';
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const byName = (value) => new Map(value.nodes.map((node) => [node.name, node]));
const currentNodes = byName(workflow);
const baselineNodes = byName(baseline);

assert.equal(workflow.id, 'kcMcBQos5cxsnWU1');
assert.equal(workflow.nodes.length, 127);
assert.equal(Object.keys(workflow.connections || {}).length, 126);
assert.equal(Object.hasOwn(workflow, 'pinData'), false);
assert.equal(Object.hasOwn(workflow, 'versionId'), false);
assert.equal(new Set(workflow.nodes.map((node) => node.name)).size, workflow.nodes.length);
assert.equal(new Set(workflow.nodes.map((node) => node.id)).size, workflow.nodes.length);

const allowedChangedBaselineNodes = new Set([
  'Normalize Input',
  'Memo Search Aggregate',
  'Memo CRUD Finalizer Payload',
  'Memo CRUD Finalizer Callback',
  'Memo CRUD Callback Result',
]);
for (const [name, node] of baselineNodes) {
  assert.ok(currentNodes.has(name), `baseline node missing: ${name}`);
  if (!allowedChangedBaselineNodes.has(name)) {
    assert.deepEqual(currentNodes.get(name), node, `unexpected baseline node drift: ${name}`);
  }
}

const allowedChangedConnections = new Set(['Memo Delete Route']);
for (const [name, connection] of Object.entries(baseline.connections || {})) {
  if (!allowedChangedConnections.has(name)) {
    assert.deepEqual(workflow.connections[name], connection, `unexpected baseline connection drift: ${name}`);
  }
}

for (const node of workflow.nodes) {
  if (node.parameters?.jsCode) assert.doesNotThrow(() => new Function(node.parameters.jsCode), node.name);
}

const incoming = new Map(workflow.nodes.map((node) => [node.name, 0]));
for (const outputs of Object.values(workflow.connections || {})) {
  for (const groups of Object.values(outputs || {})) {
    for (const group of groups || []) {
      for (const edge of group || []) incoming.set(edge.node, (incoming.get(edge.node) || 0) + 1);
    }
  }
}
for (const node of workflow.nodes) {
  const isAuxiliarySource = Object.keys(workflow.connections[node.name] || {}).some((type) => type !== 'main');
  if (node.name === 'Webhook' || isAuxiliarySource) continue;
  assert.ok((incoming.get(node.name) || 0) > 0, `orphan node: ${node.name}`);
}

const credentialCounts = workflow.nodes.reduce((counts, node) => {
  for (const type of Object.keys(node.credentials || {})) counts[type] = (counts[type] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(credentialCounts, { openAiApi: 1, dropboxOAuth2Api: 28, httpHeaderAuth: 2 });
const baselineDropbox = baseline.nodes.find((node) => node.credentials?.dropboxOAuth2Api)?.credentials?.dropboxOAuth2Api;
const baselineHeader = baseline.nodes.find((node) => node.credentials?.httpHeaderAuth)?.credentials?.httpHeaderAuth;
const baselineOpenAi = baseline.nodes.find((node) => node.credentials?.openAiApi)?.credentials?.openAiApi;
for (const node of workflow.nodes.filter((entry) => entry.credentials?.dropboxOAuth2Api)) {
  assert.deepEqual(node.credentials.dropboxOAuth2Api, baselineDropbox, `Dropbox reference drift: ${node.name}`);
}
for (const node of workflow.nodes.filter((entry) => entry.credentials?.httpHeaderAuth)) {
  assert.deepEqual(node.credentials.httpHeaderAuth, baselineHeader, `Header Auth reference drift: ${node.name}`);
}
for (const node of workflow.nodes.filter((entry) => entry.credentials?.openAiApi)) {
  assert.deepEqual(node.credentials.openAiApi, baselineOpenAi, `OpenAI reference drift: ${node.name}`);
}

const searchCode = currentNodes.get('Memo Search Aggregate').parameters.jsCode;
assert.match(searchCode, /selectionCandidates/);
assert.match(searchCode, /position:index\+1/);
assert.match(searchCode, /slice\(0,10\)/);
assert.doesNotMatch(searchCode, /shown\.map.*memo_id/);
assert.match(searchCode, /'找到 ' \+ matches\.length \+ ' 筆使用中備忘錄。'/);

const validateCode = currentNodes.get('Memo Batch Delete Validate').parameters.jsCode;
for (const contract of [
  'memo_search_selection_snapshot', "['single','multiple','range','all']", 'memoIds.length<=10',
  'new Set(memoIds).size===memoIds.length', '/^memo-[a-f0-9]{64}$/'
]) assert.ok(validateCode.includes(contract), `batch validation missing: ${contract}`);

const update = currentNodes.get('Dropbox Batch Delete Conditional Archive State');
assert.equal(update.parameters.url, 'https://content.dropboxapi.com/2/files/upload');
const updateArg = update.parameters.headerParameters.parameters.find((entry) => entry.name === 'Dropbox-API-Arg')?.value || '';
assert.match(updateArg, /'\.tag':'update'/);
assert.match(updateArg, /update:\$json\.revision/);
assert.match(updateArg, /autorename:false/);
assert.match(updateArg, /strict_conflict:true/);
assert.doesNotMatch(updateArg, /overwrite/);

const move = currentNodes.get('Dropbox Batch Delete Collision Safe Move');
assert.equal(move.parameters.url, 'https://api.dropboxapi.com/2/files/move_v2');
assert.match(move.parameters.body, /autorename:false/);
assert.doesNotMatch(JSON.stringify(workflow.memo_search_selection_batch_archive_contract), /permanent_delete":true/);

const loop = currentNodes.get('Memo Batch Delete Loop');
assert.equal(loop.type, 'n8n-nodes-base.splitInBatches');
assert.equal(loop.parameters.batchSize, 1);
assert.equal(workflow.connections['Memo Batch Delete Loop'].main[0][0].node, 'Memo Batch Delete Aggregate');
assert.equal(workflow.connections['Memo Batch Delete Loop'].main[1][0].node, 'Dropbox Batch Delete Active Metadata');

const loopCodeNodes = workflow.nodes.filter((node) => node.name.includes('Batch Delete') && node.parameters?.jsCode);
for (const node of loopCodeNodes.filter((entry) => !['Memo Batch Delete Validate', 'Memo Batch Delete Expand', 'Memo Batch Delete Aggregate', 'Memo Batch Delete Invalid Result'].includes(entry.name))) {
  assert.doesNotMatch(node.parameters.jsCode, /\.first\(/, `loop node must not default to run 0: ${node.name}`);
  assert.match(node.parameters.jsCode, /pairedItem:0/, `loop node must preserve item linking: ${node.name}`);
}

const aggregateCode = currentNodes.get('Memo Batch Delete Aggregate').parameters.jsCode;
assert.match(aggregateCode, /completed===request\.memo_ids\.length/);
assert.match(aggregateCode, /status==='conflict'/);
assert.match(aggregateCode, /status==='readback_failed'/);
assert.doesNotMatch(aggregateCode, /memo-\[a-f0-9\]/);

const callbackBody = currentNodes.get('Memo CRUD Finalizer Callback').parameters.body;
for (const field of ['memo_ids', 'selection_candidates', 'total']) assert.ok(callbackBody.includes(field));
assert.equal(currentNodes.get('Memo CRUD Finalizer Callback').credentials.httpHeaderAuth.id, baselineHeader.id);

const batchSerialized = JSON.stringify(workflow.nodes.filter((node) => node.name.includes('Batch Delete')));
for (const forbidden of ['reply_token', 'replyToken', 'user_id', 'finalize_token', 'raw payload']) {
  assert.equal(batchSerialized.includes(forbidden), false, `sensitive contract leak: ${forbidden}`);
}
for (const forbiddenRoute of ['calendar_', 'codex_delegate', 'crud_task:v1']) {
  assert.equal(batchSerialized.includes(forbiddenRoute), false, `forbidden route: ${forbiddenRoute}`);
}

console.log(JSON.stringify({
  static_validation: 'PASS',
  nodes: workflow.nodes.length,
  connection_sources: Object.keys(workflow.connections || {}).length,
  credential_counts: credentialCounts,
  baseline_nodes_unchanged: baseline.nodes.length - allowedChangedBaselineNodes.size,
  batch_limit: 10,
}, null, 2));
