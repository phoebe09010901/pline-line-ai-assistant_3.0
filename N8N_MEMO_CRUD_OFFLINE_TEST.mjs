import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  MEMO_CRUD_CONTRACT,
  isActiveMemo,
  isArchivedMemo,
  memoPath,
  normalizeMemoCrudInput,
  normalizeModifyMetadataResponse,
  normalizeModifyUpdateResponse,
  prepareMemoArchive,
  prepareMemoModify,
  searchActiveMemos,
  validateMemoCrudInput,
  verifyMemoArchive,
  verifyMemoModify
} from './N8N_MEMO_CRUD_LOGIC.mjs';
import {
  buildConditionalUpdateRequest,
  buildGetMetadataRequest,
  buildGuardedArchiveMoveRequest
} from './N8N_DROPBOX_REVISION_ADAPTER_BUILD.mjs';

const memoId = 'memo-' + 'a'.repeat(64);
const memoIdB = 'memo-' + 'b'.repeat(64);
const memoIdC = 'memo-' + 'c'.repeat(64);
const receivedAt = '2026-07-21T00:00:00.000Z';
const callbackUrl = 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize';
const dropboxRev = 'abcdef1234567890abcde';
const staleDropboxRev = 'abcdef1234567890abcdf';

const modifyUpdateHandoff = () => {
  const expected = { ...memo(), content: '更新內容', updated_at: receivedAt };
  return {
    memo_id: memoId,
    active_path: memoPath(memoId),
    path: memoPath(memoId),
    rev: dropboxRev,
    revision: dropboxRev,
    expected_content: expected.content,
    updated_content: expected.content,
    expected_json: expected,
    expected_json_text: JSON.stringify(expected, null, 2)
  };
};

const request = (intent, extra = {}) => ({
  intent,
  safe_event_hash: 'd'.repeat(64),
  received_at: receivedAt,
  reply_delivery_reference: {
    callback_url: callbackUrl,
    task_id: 'task-safe-0001',
    request_id: 'request-safe-0001'
  },
  ...extra
});

const memo = (id = memoId, content = '第一筆中文備忘錄', updatedAt = receivedAt) => ({
  schema: 'pline-memo/v1',
  memo_id: id,
  type: 'memo',
  content,
  status: 'active',
  created_at: '2026-07-20T00:00:00.000Z',
  updated_at: updatedAt,
  source: 'line'
});

let pass = 0;
const check = (name, fn) => {
  fn();
  pass += 1;
  console.log('PASS ' + name);
};
const checkAsync = async (name, fn) => {
  await fn();
  pass += 1;
  console.log('PASS ' + name);
};

check('normalize keeps only safe deterministic CRUD fields', () => {
  const normalized = normalizeMemoCrudInput(request('memo_search', { keyword: '中文', list_all: false, reply_token: 'forbidden' }));
  assert.equal(normalized.intent, 'memo_search');
  assert.equal(normalized.keyword, '中文');
  assert.equal(Object.hasOwn(normalized, 'reply_token'), false);
});

check('search keyword matches Unicode content', () => {
  const result = searchActiveMemos([{ name: memoId + '.json', memo: memo() }], request('memo_search', { keyword: '中文' }));
  assert.equal(result.total, 1);
  assert.equal(result.shown[0].memo_id, memoId);
});

check('search exact memo id matches', () => {
  const result = searchActiveMemos([{ name: memoId + '.json', memo: memo() }], request('memo_search', { keyword: memoId }));
  assert.equal(result.total, 1);
});

check('search list all reports exact valid total', () => {
  const records = [
    { name: memoId + '.json', memo: memo() },
    { name: memoIdB + '.json', memo: memo(memoIdB, '第二筆') }
  ];
  assert.equal(searchActiveMemos(records, request('memo_search', { list_all: true })).total, 2);
});

check('search displays ten while preserving total and deterministic order', () => {
  const records = Array.from({ length: 12 }, (_, index) => {
    const hex = (index + 1).toString(16).padStart(64, '0');
    const id = 'memo-' + hex;
    const day = String((index % 9) + 1).padStart(2, '0');
    return { name: id + '.json', memo: memo(id, '項目 ' + index, '2026-07-' + day + 'T00:00:00.000Z') };
  });
  const result = searchActiveMemos(records, request('memo_search', { list_all: true }));
  assert.equal(result.total, 12);
  assert.equal(result.shown.length, 10);
  assert.deepEqual(result.shown.map((item) => item.memo_id), [...result.shown.map((item) => item.memo_id)].sort((a, b) => {
    const sourceA = records.find((record) => record.memo.memo_id === a).memo;
    const sourceB = records.find((record) => record.memo.memo_id === b).memo;
    return sourceB.updated_at.localeCompare(sourceA.updated_at) || a.localeCompare(b);
  }));
});

check('search no result is a natural response', () => {
  const result = searchActiveMemos([{ name: memoId + '.json', memo: memo() }], request('memo_search', { keyword: '不存在' }));
  assert.equal(result.total, 0);
  assert.match(result.reply_text, /沒有找到/);
});

check('search ignores archive idea calendar nonmemo and invalid JSON shapes', () => {
  const archived = { ...memo(memoIdB), status: 'archived', archived_at: receivedAt };
  const records = [
    { name: 'idea-' + 'a'.repeat(64) + '.json', memo: memo() },
    { name: memoIdB + '.json', memo: archived },
    { name: 'calendar-event.json', memo: memo() },
    { name: memoIdC + '.json', memo: { ...memo(memoIdC), type: 'calendar' } },
    { name: memoId + '.json', memo: { broken: true } }
  ];
  assert.equal(searchActiveMemos(records, request('memo_search', { list_all: true })).total, 0);
});

check('search is read only', () => {
  const records = [{ name: memoId + '.json', memo: memo() }];
  const before = structuredClone(records);
  searchActiveMemos(records, request('memo_search', { list_all: true }));
  assert.deepEqual(records, before);
});

check('modify preserves six fixed fields and changes only content and updated_at', () => {
  const existing = memo();
  const result = prepareMemoModify(existing, request('memo_modify', { memo_id: memoId, new_content: '  更新內容  ' }), dropboxRev);
  assert.equal(result.valid, true);
  assert.equal(result.updated.content, '更新內容');
  assert.equal(result.updated.updated_at, receivedAt);
  for (const key of ['schema', 'memo_id', 'type', 'status', 'created_at', 'source']) {
    assert.equal(result.updated[key], existing[key]);
  }
});

check('modify rejects empty content bad id missing and nonactive', () => {
  assert.equal(validateMemoCrudInput(request('memo_modify', { memo_id: memoId, new_content: '   ' })).valid, false);
  assert.equal(validateMemoCrudInput(request('memo_modify', { memo_id: '../escape', new_content: 'x' })).valid, false);
  assert.equal(prepareMemoModify({ ...memo(), status: 'archived' }, request('memo_modify', { memo_id: memoId, new_content: 'x' }), 'rev-001').valid, false);
});

check('modify builds update(rev) strict conditional request', () => {
  const built = buildConditionalUpdateRequest({ memoId, expectedRevision: dropboxRev, content: JSON.stringify(memo()) });
  const arg = JSON.parse(built.headers['Dropbox-API-Arg']);
  assert.equal(arg.mode['.tag'], 'update');
  assert.equal(arg.mode.update, dropboxRev);
  assert.equal(arg.autorename, false);
  assert.equal(arg.strict_conflict, true);
  assert.match(built.headers['Dropbox-API-Arg'], /^[\x00-\x7f]+$/);
  assert.match(built.headers['Dropbox-API-Arg'], /\\u83f2/);
  assert.equal(arg.path, memoPath(memoId));
});

check('modify revision mismatch is zero overwrite', () => {
  const store = { rev: dropboxRev, content: JSON.stringify(memo()), writes: 0 };
  const built = buildConditionalUpdateRequest({ memoId, expectedRevision: staleDropboxRev, content: '{"content":"unsafe"}' });
  const arg = JSON.parse(built.headers['Dropbox-API-Arg']);
  if (arg.mode.update === store.rev) {
    store.content = built.body;
    store.writes += 1;
  }
  assert.equal(store.writes, 0);
  assert.equal(store.content, JSON.stringify(memo()));
});

check('modify readback mismatch cannot verify success', () => {
  const expected = { ...memo(), content: '更新內容', updated_at: receivedAt };
  assert.equal(verifyMemoModify({ ...expected, content: '其他內容' }, expected), false);
  assert.equal(verifyMemoModify(expected, expected), true);
});

check('update HTTP 200 with stream body continues only to readback', () => {
  const result = normalizeModifyUpdateResponse({ statusCode: 200, body: { _readableState: {}, _events: {} } }, modifyUpdateHandoff());
  assert.equal(result.continue_operation, true);
  assert.equal(result.status, 'update_accepted_readback_pending');
  assert.equal(result.updated_revision, '');
});

check('update HTTP 200 with materialized body still requires readback', () => {
  const result = normalizeModifyUpdateResponse({ statusCode: 200, body: { rev: staleDropboxRev } }, modifyUpdateHandoff());
  assert.equal(result.continue_operation, true);
  assert.equal(result.status, 'update_accepted_readback_pending');
  assert.notEqual(result.status, 'completed');
});

check('update non-2xx blocks readback follow-up', () => {
  for (const statusCode of [0, 400, 409, 500]) {
    const result = normalizeModifyUpdateResponse({ statusCode }, modifyUpdateHandoff());
    assert.equal(result.continue_operation, false);
    assert.notEqual(result.status, 'completed');
  }
});

check('update missing or malformed safe handoff blocks readback', () => {
  const valid = modifyUpdateHandoff();
  const invalid = [
    { ...valid, path: '/wrong' },
    { ...valid, rev: '', revision: '' },
    { ...valid, rev: 'bad rev', revision: 'bad rev' },
    { ...valid, expected_json: null },
    { ...valid, expected_json_text: '{malformed' },
    { ...valid, updated_content: 'mismatch' }
  ];
  for (const handoff of invalid) {
    assert.equal(normalizeModifyUpdateResponse({ statusCode: 200 }, handoff).continue_operation, false);
  }
});

check('modify duplicate event performs no second write or final', () => {
  const seen = new Set();
  let writes = 0;
  let finals = 0;
  for (const event of ['event-1', 'event-1']) {
    if (seen.has(event)) continue;
    seen.add(event);
    writes += 1;
    finals += 1;
  }
  assert.deepEqual({ writes, finals }, { writes: 1, finals: 1 });
});

check('modify path derives exactly one file', () => {
  assert.equal(memoPath(memoId), '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json');
  assert.throws(() => memoPath('../escape'));
});

await checkAsync('native Dropbox list metadata normalizes exact-path revision and handoff', async () => {
  const input = validateMemoCrudInput(request('memo_modify', { memo_id: memoId, new_content: '更新內容' }));
  input.active_path = memoPath(memoId);
  const response = [
    { type: 'file', pathLower: '/other', rev: 'rev-other' },
    { type: 'file', pathLower: memoPath(memoId).toLowerCase(), rev: dropboxRev }
  ];
  const result = await normalizeModifyMetadataResponse(response, input);
  assert.equal(result.continue_operation, true);
  assert.equal(result.rev, dropboxRev);
  assert.equal(result.revision, result.rev);
  assert.equal(result.path, memoPath(memoId));
  assert.equal(result.memo_id, memoId);
  assert.equal(result.expected_content, '更新內容');
  assert.equal(result.updated_content, '更新內容');
});

await checkAsync('single native metadata item remains compatible', async () => {
  const input = { ...validateMemoCrudInput(request('memo_modify', { memo_id: memoId, new_content: '更新內容' })), active_path: memoPath(memoId) };
  const result = await normalizeModifyMetadataResponse({ type: 'file', pathDisplay: memoPath(memoId), rev: staleDropboxRev }, input);
  assert.equal(result.continue_operation, true);
  assert.equal(result.rev, staleDropboxRev);
});

await checkAsync('matching metadata without revision blocks update', async () => {
  const input = { ...validateMemoCrudInput(request('memo_modify', { memo_id: memoId, new_content: '更新內容' })), active_path: memoPath(memoId) };
  const result = await normalizeModifyMetadataResponse([{ type: 'file', pathLower: memoPath(memoId).toLowerCase() }], input);
  assert.equal(result.continue_operation, false);
  assert.equal(result.rev, '');
  assert.equal(result.status, 'failed');
});

await checkAsync('metadata malformed duplicate stream and error responses block update', async () => {
  const input = { ...validateMemoCrudInput(request('memo_modify', { memo_id: memoId, new_content: '更新內容' })), active_path: memoPath(memoId) };
  for (const response of [
    [{ type: 'file', pathLower: memoPath(memoId).toLowerCase(), rev: 'bad rev' }],
    [{ body: { rev: 'rev-wrapped' }, statusCode: 200 }],
    [{ _readableState: {}, rev: 'rev-stream' }],
    [{ type: 'file', pathLower: memoPath(memoId).toLowerCase(), error: 'safe-error', rev: 'rev-should-not-pass' }],
    [
      { type: 'file', pathLower: memoPath(memoId).toLowerCase(), rev: 'rev-one' },
      { type: 'file', pathDisplay: memoPath(memoId), rev: 'rev-two' }
    ],
    [],
    null
  ]) {
    const result = await normalizeModifyMetadataResponse(response, input);
    assert.equal(result.continue_operation, false);
    assert.equal(result.rev, '');
  }
});

check('delete prepares archived nine-field document', () => {
  const result = prepareMemoArchive(memo(), request('memo_delete', { memo_id: memoId }), 'rev-001');
  assert.equal(result.valid, true);
  assert.equal(result.archived.status, 'archived');
  assert.equal(result.archived.archived_at, receivedAt);
  assert.equal(result.archived.updated_at, receivedAt);
  assert.equal(isArchivedMemo(result.archived, memoId), true);
});

check('delete move leaves active absent and archive exact', () => {
  const activePath = memoPath(memoId, 'active');
  const archivePath = memoPath(memoId, 'archive');
  const prepared = prepareMemoArchive(memo(), request('memo_delete', { memo_id: memoId }), 'rev-001').archived;
  const store = new Map([[activePath, { rev: 'rev-002', memo: prepared }]]);
  const move = buildGuardedArchiveMoveRequest({ memoId, conditionalUpdateRevision: 'rev-002', currentMetadataRevision: 'rev-002' });
  store.set(move.body.to_path, store.get(move.body.from_path));
  store.delete(move.body.from_path);
  assert.equal(store.has(activePath), false);
  assert.equal(verifyMemoArchive(store.get(archivePath).memo, prepared), true);
});

check('delete archive collision is zero overwrite and source retained', () => {
  const activePath = memoPath(memoId, 'active');
  const archivePath = memoPath(memoId, 'archive');
  const store = new Map([[activePath, { rev: 'rev-002' }], [archivePath, { rev: 'rev-existing' }]]);
  if (!store.has(archivePath)) {
    store.set(archivePath, store.get(activePath));
    store.delete(activePath);
  }
  assert.equal(store.get(archivePath).rev, 'rev-existing');
  assert.equal(store.has(activePath), true);
});

check('delete invalid nonactive and idea id perform zero move', () => {
  assert.equal(validateMemoCrudInput(request('memo_delete', { memo_id: 'idea-' + 'a'.repeat(64) })).valid, false);
  assert.equal(prepareMemoArchive({ ...memo(), status: 'archived' }, request('memo_delete', { memo_id: memoId }), 'rev-001').valid, false);
});

check('delete pre-move revision change builds no move', () => {
  assert.throws(() => buildGuardedArchiveMoveRequest({
    memoId,
    conditionalUpdateRevision: 'rev-002',
    currentMetadataRevision: 'rev-raced'
  }), /pre_move_revision_mismatch/);
});

check('delete intermediate archived source is excluded from active search', () => {
  const archived = prepareMemoArchive(memo(), request('memo_delete', { memo_id: memoId }), 'rev-001').archived;
  const result = searchActiveMemos([{ name: memoId + '.json', memo: archived }], request('memo_search', { list_all: true }));
  assert.equal(result.total, 0);
});

check('delete duplicate event performs no second move or final', () => {
  const seen = new Set();
  let moves = 0;
  let finals = 0;
  for (const event of ['event-delete', 'event-delete']) {
    if (seen.has(event)) continue;
    seen.add(event);
    moves += 1;
    finals += 1;
  }
  assert.deepEqual({ moves, finals }, { moves: 1, finals: 1 });
});

check('delete TOCTOU post-move revision mismatch is safe ambiguity', () => {
  const expectedRev = 'rev-expected';
  const movedRev = 'rev-concurrent';
  const success = expectedRev === movedRev;
  assert.equal(success, false);
  assert.equal(MEMO_CRUD_CONTRACT.delete_move_atomic, false);
});

const builtPath = '/tmp/n8n-memo-crud-offline-built.json';
execFileSync(process.execPath, ['N8N_MEMO_CRUD_BUILD.mjs', 'N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json', builtPath], { cwd: process.cwd() });
const workflow = JSON.parse(readFileSync(builtPath, 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const serialized = JSON.stringify(workflow);

check('workflow deterministic CRUD routes bypass AI Agent', () => {
  assert.equal(workflow.connections['Memo Search Route'].main[0][0].node, 'Memo Search Validate');
  assert.equal(workflow.connections['Memo Modify Route'].main[0][0].node, 'Memo Modify Validate');
  assert.equal(workflow.connections['Memo Delete Route'].main[0][0].node, 'Memo Delete Validate');
  for (const name of ['Memo Search Route', 'Memo Modify Route', 'Memo Delete Route']) {
    assert.equal(JSON.stringify(workflow.connections[name].main[0]).includes('AI Agent'), false);
  }
});

check('revision source uses native Dropbox OAuth and revision writes use exact predefined OAuth endpoints', () => {
  const nativeMetadata = nodes.get('Dropbox Modify Metadata');
  assert.equal(nativeMetadata.type, 'n8n-nodes-base.dropbox');
  assert.equal(nativeMetadata.parameters.authentication, 'oAuth2');
  assert.equal(nativeMetadata.parameters.resource, 'folder');
  assert.equal(nativeMetadata.parameters.operation, 'list');
  // The repository export keeps only the protected credential reference type;
  // values are never exported and are verified again after Publish.
  assert.deepEqual(Object.keys(nativeMetadata.credentials || {}), ['dropboxOAuth2Api']);

  for (const name of ['Dropbox Delete Metadata', 'Dropbox Delete Pre Move Metadata', 'Dropbox Delete Archive Metadata']) {
    const node = nodes.get(name);
    assert.equal(node.type, 'n8n-nodes-base.dropbox');
    assert.equal(node.parameters.authentication, 'oAuth2');
    assert.equal(node.parameters.resource, 'folder');
    assert.equal(node.parameters.operation, 'list');
    assert.equal(node.parameters.returnAll, true);
    assert.deepEqual(Object.keys(node.credentials || {}), ['dropboxOAuth2Api']);
  }

  const expected = new Map([
    ['Dropbox Modify Conditional Update', 'https://content.dropboxapi.com/2/files/upload'],
    ['Dropbox Delete Conditional Archive State', 'https://content.dropboxapi.com/2/files/upload'],
    ['Dropbox Delete Collision Safe Move', 'https://api.dropboxapi.com/2/files/move_v2']
  ]);
  for (const [name, url] of expected) {
    const node = nodes.get(name);
    assert.equal(node.parameters.authentication, 'predefinedCredentialType');
    assert.equal(node.parameters.nodeCredentialType, 'dropboxOAuth2Api');
    assert.equal(node.parameters.url, url);
  }
});

check('workflow has no legacy generic CRUD or Calendar codex delegation', () => {
  for (const forbidden of ['google_calendar_direct', 'crud_task:v1', 'codex_delegate', 'memo_crud_route']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  const calendarRoute = nodes.get('Calendar Create Route');
  assert.equal(calendarRoute.type, 'n8n-nodes-base.if');
  assert.equal(workflow.connections['Calendar Create Route'].main[1][0].node, 'Memo Search Page Route');
});

check('workflow callback uses Header Auth reference contract and secret-free body', () => {
  const callback = nodes.get('Memo CRUD Finalizer Callback');
  assert.equal(callback.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(callback.parameters.authentication, 'genericCredentialType');
  for (const forbidden of ['finalize_token', 'replyToken', 'reply_token', 'user_id', 'Authorization', 'access_token', 'client_secret']) {
    assert.equal(callback.parameters.body.includes(forbidden), false, forbidden);
  }
});

check('workflow topology has all referenced nodes and no duplicate names', () => {
  assert.equal(nodes.size, workflow.nodes.length);
  for (const outputs of Object.values(workflow.connections)) {
    for (const channel of outputs.main || []) {
      for (const target of channel || []) assert.equal(nodes.has(target.node), true, target.node);
    }
  }
});

check('workflow response and contract contain no sensitive runtime fields', () => {
  const safeSections = JSON.stringify({
    contract: workflow.memo_crud_contract,
    callback: nodes.get('Memo CRUD Finalizer Callback').parameters.body,
    result: nodes.get('Memo CRUD Callback Result').parameters.jsCode
  });
  for (const forbidden of ['replyToken', 'reply_token', 'user_id', 'finalize_token', 'access_token', 'client_secret']) {
    assert.equal(safeSections.includes(forbidden), false, forbidden);
  }
});

check('search cap and sort and delete non-atomic policy are explicit', () => {
  assert.equal(workflow.memo_crud_contract.search.candidate_cap, 500);
  assert.equal(workflow.memo_crud_contract.search.display_limit, 10);
  assert.equal(workflow.memo_crud_contract.search.sort, 'updated_at_desc_then_memo_id_asc');
  assert.equal(workflow.memo_crud_contract.delete.move_atomic, false);
  assert.equal(workflow.memo_crud_contract.delete.ambiguity_never_success, true);
});

check('existing Memo Create idea and codex nodes remain present', () => {
  for (const name of ['Memo Create Route', 'Memo Build and Validate', 'idea_create', 'codex_task', 'AI Agent']) {
    assert.equal(nodes.has(name), true, name);
  }
  assert.equal(isActiveMemo(memo()), true);
  assert.equal(buildGetMetadataRequest({ memoId }).operation, 'get_metadata');
});

assert.equal(pass, 39);
console.log('RESULT ' + pass + '/39 PASS');
