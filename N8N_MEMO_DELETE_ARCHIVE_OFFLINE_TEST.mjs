import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = JSON.parse(readFileSync('./N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json', 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const memoId = `memo-${'a'.repeat(64)}`;
const activePath = `/菲比工作總倉庫/00_INBOX_臨時丟進來/${memoId}.json`;
const archivePath = `/菲比工作總倉庫/99_ARCHIVE_封存/${memoId}.json`;
const sourceRevision = 'abcdef1234567890abcde';
const archivedRevision = 'abcdef1234567890abcdf';
const receivedAt = '2026-07-21T00:00:00.000Z';
const callbackUrl = 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize';
const activeMemo = {
  schema: 'pline-memo/v1', memo_id: memoId, type: 'memo', content: '去識別化內容', status: 'active',
  created_at: '2026-07-20T00:00:00.000Z', updated_at: '2026-07-20T00:00:00.000Z', source: 'line'
};
const archivedMemo = {
  ...activeMemo, status: 'archived', updated_at: receivedAt, archived_at: receivedAt
};
const validated = {
  valid: true, continue_operation: true, intent: 'memo_delete', memo_id: memoId, received_at: receivedAt,
  active_path: activePath, archive_path: archivePath, callback_url: callbackUrl,
  task_id: 'task-safe-0001', request_id: 'request-safe-0001', status: 'validated', reply_text: ''
};

async function runCode(name, json, lookups = {}, items = [json]) {
  const code = nodes.get(name).parameters.jsCode;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const lookup = (nodeName) => ({ first: () => ({ json: lookups[nodeName] || {} }) });
  const input = { all: () => items.map((item) => ({ json: item })) };
  return (await AsyncFunction('$json', '$input', '$', code)(json, input, lookup))[0].json;
}

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}
async function checkAsync(name, fn) {
  await fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

await checkAsync('exact deterministic delete command validates canonical paths only', async () => {
  const delivery = { callback_url: callbackUrl, task_id: validated.task_id, request_id: validated.request_id };
  const good = await runCode('Memo Delete Validate', {
    intent: 'memo_delete', safe_event_hash: 'b'.repeat(64), memo_id: memoId, received_at: receivedAt,
    reply_delivery_reference: delivery
  });
  assert.equal(good.continue_operation, true);
  assert.equal(good.active_path, activePath);
  assert.equal(good.archive_path, archivePath);
  for (const badId of ['../escape', 'idea-' + 'a'.repeat(64), memoId + '/extra', '']) {
    const bad = await runCode('Memo Delete Validate', {
      intent: 'memo_delete', safe_event_hash: 'b'.repeat(64), memo_id: badId, received_at: receivedAt,
      reply_delivery_reference: delivery
    });
    assert.equal(bad.continue_operation, false);
    assert.equal(bad.active_path, '');
    assert.equal(bad.archive_path, '');
  }
});

await checkAsync('unique active metadata yields exact source revision', async () => {
  const result = await runCode('Memo Delete Metadata Check', {}, { 'Memo Delete Validate': validated }, [{
    type: 'file', name: `${memoId}.json`, pathDisplay: activePath, pathLower: activePath.toLowerCase(), rev: sourceRevision
  }]);
  assert.equal(result.continue_operation, true);
  assert.equal(result.revision, sourceRevision);
});

await checkAsync('source missing malformed or not unique performs zero follow-up', async () => {
  const good = { type: 'file', name: `${memoId}.json`, pathDisplay: activePath, rev: sourceRevision };
  for (const items of [
    [], [{}], [{ ...good, type: 'folder' }], [{ ...good, name: 'idea.json' }],
    [good, { ...good, rev: archivedRevision }], [{ ...good, rev: 'bad rev' }]
  ]) {
    const result = await runCode('Memo Delete Metadata Check', {}, { 'Memo Delete Validate': validated }, items);
    assert.equal(result.continue_operation, false);
    assert.equal(result.revision, '');
  }
});

await checkAsync('source JSON must be exact active line Memo before archive preparation', async () => {
  const metadata = { ...validated, revision: sourceRevision };
  const exact = await runCode('Memo Delete Prepare Archive', { memo: activeMemo }, { 'Memo Delete Metadata Check': metadata });
  assert.equal(exact.continue_operation, true);
  assert.deepEqual(exact.expected_json, archivedMemo);
  for (const memo of [
    { ...activeMemo, type: 'calendar' }, { ...activeMemo, status: 'archived' },
    { ...activeMemo, source: 'other' }, { ...activeMemo, extra: true }, null
  ]) {
    assert.equal(Boolean((await runCode('Memo Delete Prepare Archive', { memo }, { 'Memo Delete Metadata Check': metadata })).continue_operation), false);
  }
});

check('conditional archive update remains header-safe update(rev) with no overwrite', () => {
  const node = nodes.get('Dropbox Delete Conditional Archive State');
  const arg = node.parameters.headerParameters.parameters.find((header) => header.name === 'Dropbox-API-Arg').value;
  assert.match(arg, /update:\$json\.revision/);
  assert.match(arg, /autorename:false/);
  assert.match(arg, /strict_conflict:true/);
  assert.match(arg, /String\.fromCharCode\(92\)/);
  assert.doesNotMatch(arg, /overwrite/);
});

await checkAsync('conditional update HTTP 200 stream only enters metadata guard', async () => {
  const prepared = { ...validated, revision: sourceRevision, expected_json: archivedMemo, expected_json_text: JSON.stringify(archivedMemo, null, 2) };
  for (const body of [{ _readableState: {} }, { rev: archivedRevision }]) {
    const result = await runCode('Memo Delete Update Check', { statusCode: 200, body }, { 'Memo Delete Prepare Archive': prepared });
    assert.equal(result.continue_operation, true);
    assert.equal(result.status, 'archive_state_update_accepted_metadata_pending');
    assert.equal(result.updated_revision, '');
  }
});

await checkAsync('conditional update non-2xx or malformed handoff cannot proceed', async () => {
  const prepared = { ...validated, revision: sourceRevision, expected_json: archivedMemo, expected_json_text: JSON.stringify(archivedMemo, null, 2) };
  assert.equal((await runCode('Memo Delete Update Check', { statusCode: 409 }, { 'Memo Delete Prepare Archive': prepared })).continue_operation, false);
  assert.equal((await runCode('Memo Delete Update Check', { statusCode: 500 }, { 'Memo Delete Prepare Archive': prepared })).continue_operation, false);
  assert.equal((await runCode('Memo Delete Update Check', { statusCode: 200 }, { 'Memo Delete Prepare Archive': { ...prepared, revision: '' } })).continue_operation, false);
  assert.equal((await runCode('Memo Delete Update Check', { statusCode: 200 }, { 'Memo Delete Prepare Archive': { ...prepared, expected_json_text: '{bad' } })).continue_operation, false);
});

await checkAsync('pre-move metadata requires one new exact revision', async () => {
  const updated = { ...validated, revision: sourceRevision, expected_json: archivedMemo, expected_json_text: JSON.stringify(archivedMemo, null, 2) };
  const current = { type: 'file', name: `${memoId}.json`, pathDisplay: activePath, rev: archivedRevision };
  const result = await runCode('Memo Delete Pre Move Guard', {}, { 'Memo Delete Update Check': updated }, [current]);
  assert.equal(result.continue_operation, true);
  assert.equal(result.updated_revision, archivedRevision);
  for (const items of [[], [current, current], [{ ...current, rev: sourceRevision }], [{ ...current, rev: 'bad rev' }]]) {
    assert.equal((await runCode('Memo Delete Pre Move Guard', {}, { 'Memo Delete Update Check': updated }, items)).continue_operation, false);
  }
});

check('collision-safe move is exact active to archive and never autorenames', () => {
  const node = nodes.get('Dropbox Delete Collision Safe Move');
  assert.match(node.parameters.body, /from_path:\$json\.active_path/);
  assert.match(node.parameters.body, /to_path:\$json\.archive_path/);
  assert.match(node.parameters.body, /autorename:false/);
  assert.doesNotMatch(node.parameters.body, /overwrite|delete_v2|permanently_delete/);
});

await checkAsync('move HTTP 200 only enters terminal verification and 409 is conflict', async () => {
  const guarded = { ...validated, updated_revision: archivedRevision, expected_json: archivedMemo };
  const moved = await runCode('Memo Delete Move Check', { statusCode: 200, body: { _readableState: {} } }, { 'Memo Delete Pre Move Guard': guarded });
  assert.equal(moved.continue_operation, true);
  assert.equal(moved.status, 'move_accepted_terminal_verification_pending');
  assert.notEqual(moved.status, 'completed');
  const collision = await runCode('Memo Delete Move Check', { statusCode: 409 }, { 'Memo Delete Pre Move Guard': guarded });
  assert.equal(collision.continue_operation, false);
  assert.equal(collision.status, 'conflict');
});

await checkAsync('active source must be absent before archive verification', async () => {
  const moved = { ...validated, updated_revision: archivedRevision, expected_json: archivedMemo };
  assert.equal((await runCode('Memo Delete Active Absence Check', { statusCode: 409 }, { 'Memo Delete Move Check': moved })).continue_operation, true);
  assert.equal((await runCode('Memo Delete Active Absence Check', { statusCode: 200 }, { 'Memo Delete Move Check': moved })).continue_operation, false);
  assert.equal((await runCode('Memo Delete Active Absence Check', {}, { 'Memo Delete Move Check': moved })).continue_operation, false);
});

await checkAsync('archive metadata accepts one exact target with its current legal revision', async () => {
  const absent = { ...validated, updated_revision: archivedRevision, expected_json: archivedMemo };
  const postMoveRevision = 'abcdef1234567890abce0';
  const entry = { type: 'file', name: `${memoId}.json`, pathDisplay: archivePath, rev: postMoveRevision };
  const other = { type: 'folder', name: 'safe-nontarget', pathDisplay: '/菲比工作總倉庫/99_ARCHIVE_封存/safe-nontarget', rev: 'abcdef1234567890abce1' };
  const result = await runCode('Memo Delete Archive Metadata Check', {}, { 'Memo Delete Active Absence Check': absent }, [other, entry]);
  assert.equal(result.continue_operation, true);
  assert.equal(result.archive_revision, postMoveRevision);
  for (const items of [
    [], [other], [entry, entry], [{ ...entry, rev: '' }], [{ ...entry, rev: 'bad rev' }], [{ ...entry, name: 'idea.json' }]
  ]) {
    assert.equal((await runCode('Memo Delete Archive Metadata Check', {}, { 'Memo Delete Active Absence Check': absent }, items)).continue_operation, false);
  }
});

await checkAsync('only exact archive readback can produce completed', async () => {
  const terminal = { ...validated, updated_revision: archivedRevision, expected_json: archivedMemo };
  const success = await runCode('Memo Delete Verify Readback', { memo: archivedMemo }, { 'Memo Delete Archive Metadata Check': terminal });
  assert.equal(success.status, 'completed');
  for (const memo of [{ ...archivedMemo, content: 'mismatch' }, { ...archivedMemo, status: 'active' }, { ...archivedMemo, extra: true }, null]) {
    assert.equal((await runCode('Memo Delete Verify Readback', { memo }, { 'Memo Delete Archive Metadata Check': terminal })).status, 'readback_failed');
  }
});

check('Delete branch contains no permanent delete node or idea/calendar route', () => {
  const deleteNodes = workflow.nodes.filter((node) => node.name.startsWith('Memo Delete') || node.name.startsWith('Dropbox Delete'));
  const serialized = JSON.stringify(deleteNodes);
  assert.equal(deleteNodes.some((node) => node.type === 'n8n-nodes-base.dropbox' && node.parameters.operation === 'delete'), false);
  for (const forbidden of ['delete_v2', 'permanently_delete', 'idea-', 'calendar', 'crud_task:v1', 'codex_delegate']) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

check('Delete topology reaches success only after active absence and archive readback', () => {
  const target = (name, output = 0) => workflow.connections[name].main[output].map((item) => item.node);
  assert.deepEqual(target('Memo Delete Move Route', 0), ['Dropbox Delete Active Absence']);
  assert.deepEqual(target('Memo Delete Active Absence Route', 0), ['Dropbox Delete Archive Metadata']);
  assert.deepEqual(target('Memo Delete Archive Metadata Route', 0), ['Dropbox Delete Archive Readback']);
  assert.deepEqual(target('Memo Delete Archive Extract', 0), ['Memo Delete Verify Readback']);
  assert.deepEqual(target('Memo Delete Verify Readback', 0), ['Memo Success Natural Reply Input']);
});

check('Delete native metadata nodes are read-only first-level lists', () => {
  const expectedPaths = new Map([
    ['Dropbox Delete Metadata', '/菲比工作總倉庫/00_INBOX_臨時丟進來'],
    ['Dropbox Delete Pre Move Metadata', '/菲比工作總倉庫/00_INBOX_臨時丟進來'],
    ['Dropbox Delete Archive Metadata', '/菲比工作總倉庫/99_ARCHIVE_封存']
  ]);
  for (const [name, path] of expectedPaths) {
    const node = nodes.get(name);
    assert.equal(node.type, 'n8n-nodes-base.dropbox');
    assert.equal(node.parameters.resource, 'folder');
    assert.equal(node.parameters.operation, 'list');
    assert.equal(node.parameters.path, path);
    assert.equal(node.parameters.returnAll, true);
    assert.deepEqual(node.parameters.filters, {});
  }
});

check('callback body and evidence fixtures contain no delivery secrets', () => {
  const callback = nodes.get('Memo CRUD Finalizer Callback');
  const safe = JSON.stringify({ callback: callback.parameters.body, contract: workflow.memo_crud_contract });
  for (const forbidden of ['replyToken', 'reply_token', 'user_id', 'finalize_token', 'access_token', 'client_secret']) {
    assert.equal(safe.includes(forbidden), false, forbidden);
  }
});

check('non-atomic metadata-to-move race remains explicit and ambiguity never succeeds', () => {
  assert.equal(workflow.connections['Dropbox Delete Pre Move Metadata'].main[0][0].node, 'Memo Delete Pre Move Guard');
  assert.equal(workflow.connections['Memo Delete Pre Move Route'].main[0][0].node, 'Dropbox Delete Collision Safe Move');
  const moveBody = nodes.get('Dropbox Delete Collision Safe Move').parameters.body;
  assert.doesNotMatch(moveBody, /revision|\brev\b/);
  assert.match(nodes.get('Memo Delete Move Check').parameters.jsCode, /ambiguous|continue_operation/);
});

assert.equal(pass, 18);
console.log(`RESULT ${pass}/18 PASS`);
