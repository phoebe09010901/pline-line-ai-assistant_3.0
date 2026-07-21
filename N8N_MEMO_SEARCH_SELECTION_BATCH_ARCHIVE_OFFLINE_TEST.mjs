import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CALLBACK_URL,
  MEMO_FULL_SNAPSHOT_LIMIT,
  MEMO_SEARCH_PAGE_SIZE,
  MEMO_SELECTION_BATCH_LIMIT,
  aggregateBatchArchiveFailure,
  aggregateBatchPreflight,
  aggregateMemoSearchPage,
  aggregateBatchArchive,
  buildBatchPreflightInventory,
  expandBatchDeleteRequest,
  expandMemoSearchPageRequest,
  normalizeSearchSelectionResult,
  planBatchArchiveItem,
  prepareArchivedMemo,
  validateBatchDeleteRequest,
  validateMemoSearchPageRequest,
  verifyBatchPreflightItem,
  verifyArchiveReadback,
} from './N8N_MEMO_SEARCH_SELECTION_BATCH_ARCHIVE_LOGIC.mjs';

const IDS = Array.from({ length: 101 }, (_, index) => `memo-${(index + 1).toString(16).padStart(64, '0')}`);
const RECEIVED_AT = '2026-07-21T10:00:00.000Z';
const WORKFLOW = JSON.parse(await readFile(new URL('./N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json', import.meta.url), 'utf8'));
const PREPARE_ARCHIVE_CODE = WORKFLOW.nodes.find((node) => node.name === 'Memo Batch Delete Prepare Archive')?.parameters?.jsCode || '';
const runPrepareArchiveNode = (requestItem, memo) => new Function('$json', '$', PREPARE_ARCHIVE_CODE)(
  { memo },
  () => ({ item: { json: requestItem } }),
);

function request(overrides = {}) {
  return {
    intent: 'memo_delete',
    safe_event_hash: 'a'.repeat(64),
    received_at: RECEIVED_AT,
    delete_scope: 'memo_search_selection_snapshot',
    selection_mode: 'multiple',
    selection_snapshot_version: 'b'.repeat(64),
    memo_ids: IDS.slice(0, 1),
    reply_delivery_reference: {
      callback_url: CALLBACK_URL,
      task_id: 'task.selection.test',
      request_id: 'request.selection.test',
    },
    ...overrides,
  };
}

function activeMemo(memoId, content = '安全內容') {
  return {
    schema: 'pline-memo/v1', memo_id: memoId, type: 'memo', content, status: 'active',
    created_at: '2026-07-20T10:00:00.000Z', updated_at: '2026-07-20T10:00:00.000Z', source: 'line',
  };
}

function metadata(memoId, prefix, rev = 'abcdef123') {
  return { type: 'file', name: `${memoId}.json`, pathDisplay: `${prefix}/${memoId}.json`, rev };
}

test('15-result search returns a complete ordered snapshot and only page one summaries', () => {
  const matches = IDS.slice(0, 15).map((memoId, index) => ({ memo_id: memoId, content: `摘要 ${index + 1}`, updated_at: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z` }));
  const result = normalizeSearchSelectionResult({ matches });
  assert.equal(result.selection_candidates.length, 15);
  assert.deepEqual(result.selection_candidates.map((entry) => entry.position), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.equal(result.selection_candidates.every((entry) => !Object.hasOwn(entry, 'summary')), true);
  assert.equal(result.page_candidates.length, MEMO_SEARCH_PAGE_SIZE);
  assert.deepEqual(result.page_candidates.map((entry) => entry.position), Array.from({ length: 10 }, (_, index) => index + 1));
  assert.equal(result.total, 15);
  assert.equal(result.page, 1);
  assert.equal(result.page_count, 2);
  assert.equal(result.reply_text.includes('memo-'), false);
  assert.match(result.reply_text, /第 1\/2 頁/);
  assert.match(result.reply_text, /\n10\. 摘要/);
});

test('selection batch authorization accepts one through five for only safe parser modes', () => {
  assert.equal(MEMO_SELECTION_BATCH_LIMIT, 5);
  for (const mode of ['single', 'multiple', 'range']) {
    const memoIds = IDS.slice(0, mode === 'single' ? 1 : 5);
    const validated = validateBatchDeleteRequest(request({ selection_mode: mode, memo_ids: memoIds }));
    assert.equal(validated.valid, true, mode);
    assert.deepEqual(expandBatchDeleteRequest(validated).map((entry) => entry.memo_id), memoIds);
    const blocked = validateBatchDeleteRequest(request({ selection_mode: mode, memo_ids: IDS.slice(0, 6) }));
    assert.equal(blocked.valid, false, `${mode}:2`);
    assert.deepEqual(expandBatchDeleteRequest(blocked), []);
  }
  assert.equal(validateBatchDeleteRequest(request({ selection_mode: 'all' })).valid, false);
  assert.equal(validateBatchDeleteRequest(request({ selection_mode: '' })).valid, false);
});

test('empty duplicate malformed and over-limit batches reject with zero items', () => {
  for (const memoIds of [[], [IDS[0], IDS[0]], ['memo-invalid'], IDS.slice(0, 6)]) {
    const validated = validateBatchDeleteRequest(request({ memo_ids: memoIds }));
    assert.equal(validated.valid, false);
    assert.deepEqual(expandBatchDeleteRequest(validated), []);
  }
});

function fullPreflight(memoIds, { activeMissing = -1, archiveCollision = -1, revisionMissing = -1 } = {}) {
  const validated = validateBatchDeleteRequest(request({ memo_ids: memoIds, selection_mode: memoIds.length === 1 ? 'single' : 'multiple' }));
  const activeEntries = memoIds.flatMap((memoId, index) => index === activeMissing ? [] : [metadata(
    memoId,
    '/菲比工作總倉庫/00_INBOX_臨時丟進來',
    index === revisionMissing ? '' : `abcdef12${index}`,
  )]);
  const archiveEntries = archiveCollision < 0 ? [] : [metadata(memoIds[archiveCollision], '/菲比工作總倉庫/99_ARCHIVE_封存')];
  const inventory = buildBatchPreflightInventory(validated, activeEntries, archiveEntries);
  const verified = inventory.items.map((item) => verifyBatchPreflightItem(item, activeMemo(item.memo_id, `內容 ${item.batch_index + 1}`)));
  return { validated, inventory, verified, aggregate: aggregateBatchPreflight(validated, verified) };
}

test('three-item list completes only after full preflight and aggregates one success', () => {
  const memoIds = IDS.slice(0, 3);
  const state = fullPreflight(memoIds);
  assert.equal(state.aggregate.valid, true);
  assert.deepEqual(state.aggregate.preflight_items.map((item) => item.memo_id), memoIds);
  const result = aggregateBatchArchive(state.validated, state.aggregate.preflight_items.map((item) => ({ ...item, status: 'completed' })));
  assert.equal(result.status, 'completed');
  assert.equal(result.success_count, 3);
  assert.equal(result.failed_count, 0);
  assert.match(result.reply_text, /3 筆/);
  assert.equal(result.reply_text.includes('memo-'), false);
});

test('four-item range keeps Worker order and aggregates one success', () => {
  const memoIds = [IDS[3], IDS[1], IDS[4], IDS[2]];
  const validated = validateBatchDeleteRequest(request({ memo_ids: memoIds, selection_mode: 'range' }));
  const activeEntries = memoIds.map((memoId, index) => metadata(memoId, '/菲比工作總倉庫/00_INBOX_臨時丟進來', `bcdef123${index}`));
  const inventory = buildBatchPreflightInventory(validated, activeEntries, []);
  const preflight = aggregateBatchPreflight(validated, inventory.items.map((item) => verifyBatchPreflightItem(item, activeMemo(item.memo_id))));
  assert.deepEqual(preflight.preflight_items.map((item) => item.memo_id), memoIds);
  const result = aggregateBatchArchive(validated, preflight.preflight_items.map((item) => ({ ...item, status: 'completed' })));
  assert.equal(result.success_count, 4);
  assert.equal(result.status, 'completed');
});

test('any inventory preflight failure blocks the complete batch before writes', () => {
  const memoIds = IDS.slice(0, 3);
  for (const options of [{ activeMissing: 1 }, { revisionMissing: 1 }, { archiveCollision: 1 }]) {
    const state = fullPreflight(memoIds, options);
    assert.equal(state.inventory.valid, false);
    assert.equal(state.aggregate.valid, false);
    assert.deepEqual(state.aggregate.preflight_items, []);
  }
});

test('mid-batch failure stops the remaining suffix and returns a safe aggregate', () => {
  const memoIds = IDS.slice(0, 5);
  const state = fullPreflight(memoIds);
  const failed = aggregateBatchArchiveFailure(state.validated, {
    ...state.aggregate.preflight_items[2], status: 'conflict', failure_class: 'conditional_revision_conflict',
  });
  assert.equal(failed.status, 'conflict');
  assert.equal(failed.success_count, 2);
  assert.equal(failed.failed_count, 3);
  assert.equal(failed.failure_class, 'conditional_revision_conflict');
  assert.equal(failed.reply_text.includes('memo-'), false);
});

test('same event safely resumes archived-source and completed-archive states', () => {
  const memoIds = IDS.slice(0, 2);
  const validated = validateBatchDeleteRequest(request({ memo_ids: memoIds }));
  const activeEntries = [metadata(memoIds[0], '/菲比工作總倉庫/00_INBOX_臨時丟進來')];
  const archiveEntries = [metadata(memoIds[1], '/菲比工作總倉庫/99_ARCHIVE_封存')];
  const inventory = buildBatchPreflightInventory(validated, activeEntries, archiveEntries);
  const archived = (memoId) => ({ ...activeMemo(memoId), status: 'archived', updated_at: RECEIVED_AT, archived_at: RECEIVED_AT });
  const verified = [
    verifyBatchPreflightItem(inventory.items[0], archived(memoIds[0])),
    verifyBatchPreflightItem(inventory.items[1], archived(memoIds[1])),
  ];
  assert.deepEqual(verified.map((item) => item.item_action), ['resume_move', 'duplicate']);
  assert.equal(aggregateBatchPreflight(validated, verified).valid, true);
});

test('search overflow above 100 fails closed with no actionable candidates', () => {
  assert.equal(MEMO_FULL_SNAPSHOT_LIMIT, 100);
  const matches = IDS.map((memoId, index) => ({ memo_id: memoId, content: `摘要 ${index + 1}`, updated_at: '2026-07-21T10:00:00.000Z' }));
  const result = normalizeSearchSelectionResult({ matches });
  assert.equal(result.status, 'failed');
  assert.equal(result.total, 0);
  assert.deepEqual(result.selection_candidates, []);
  assert.deepEqual(result.page_candidates, []);
  assert.match(result.reply_text, /縮小/);
});

test('page two reads only exact ordered IDs and renders global positions 11 through 15', () => {
  const pageRequest = validateMemoSearchPageRequest({
    intent: 'memo_search_page', safe_event_hash: 'a'.repeat(64), received_at: RECEIVED_AT,
    page_scope: 'memo_search_selection_snapshot', selection_snapshot_version: 'b'.repeat(64),
    page_number: 2, page_count: 2, total: 15, global_start: 11, memo_ids: IDS.slice(10, 15),
    reply_delivery_reference: { callback_url: CALLBACK_URL, task_id: 'task.page.test', request_id: 'request.page.test' },
  });
  assert.equal(pageRequest.valid, true);
  const expanded = expandMemoSearchPageRequest(pageRequest);
  assert.deepEqual(expanded.map((entry) => entry.position), [11, 12, 13, 14, 15]);
  const result = aggregateMemoSearchPage(pageRequest, expanded.map((entry, index) => ({ ...entry, memo: activeMemo(entry.memo_id, `頁二摘要 ${index + 1}`) })));
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.page_candidates.map((entry) => entry.position), [11, 12, 13, 14, 15]);
  assert.equal(result.reply_text.includes('memo-'), false);
  assert.match(result.reply_text, /第 2\/2 頁/);
});

test('page contract rejects partial duplicate missing invalid and reordered candidates', () => {
  const base = {
    intent: 'memo_search_page', safe_event_hash: 'a'.repeat(64), received_at: RECEIVED_AT,
    page_scope: 'memo_search_selection_snapshot', selection_snapshot_version: 'b'.repeat(64),
    page_number: 2, page_count: 2, total: 15, global_start: 11, memo_ids: IDS.slice(10, 15),
    reply_delivery_reference: { callback_url: CALLBACK_URL, task_id: 'task.page.test', request_id: 'request.page.test' },
  };
  for (const candidate of [
    { ...base, memo_ids: IDS.slice(10, 14) },
    { ...base, memo_ids: [IDS[10], IDS[10], ...IDS.slice(12, 15)] },
    { ...base, memo_ids: [...IDS.slice(10, 14), 'memo-invalid'] },
    { ...base, global_start: 10 },
  ]) assert.equal(validateMemoSearchPageRequest(candidate).valid, false);
  const valid = validateMemoSearchPageRequest(base);
  const expanded = expandMemoSearchPageRequest(valid);
  const missing = aggregateMemoSearchPage(valid, expanded.slice(0, 4).map((entry) => ({ ...entry, memo: activeMemo(entry.memo_id) })));
  assert.equal(missing.status, 'failed');
  const reordered = aggregateMemoSearchPage(valid, [...expanded].reverse().map((entry) => ({ ...entry, memo: activeMemo(entry.memo_id) })));
  assert.equal(reordered.status, 'failed');
});

test('only exact active without archive plans a revision-aware archive', () => {
  const validated = validateBatchDeleteRequest(request({ memo_ids: [IDS[0]], selection_mode: 'single' }));
  const item = expandBatchDeleteRequest(validated)[0];
  const active = metadata(IDS[0], '/菲比工作總倉庫/00_INBOX_臨時丟進來');
  assert.equal(planBatchArchiveItem(item, [active], []).item_action, 'archive');
  assert.equal(planBatchArchiveItem(item, [active], [metadata(IDS[0], '/菲比工作總倉庫/99_ARCHIVE_封存')]).status, 'conflict');
  assert.equal(planBatchArchiveItem(item, [], []).status, 'conflict');
});

test('archive preparation preserves content and immutable fields', () => {
  const validated = validateBatchDeleteRequest(request({ memo_ids: [IDS[0]], selection_mode: 'single' }));
  const item = planBatchArchiveItem(
    expandBatchDeleteRequest(validated)[0],
    [metadata(IDS[0], '/菲比工作總倉庫/00_INBOX_臨時丟進來')],
    [],
  );
  const prepared = prepareArchivedMemo(item, activeMemo(IDS[0], 'marker-like T0000 content'));
  assert.equal(prepared.continue_operation, true);
  assert.equal(prepared.expected_json.content, 'marker-like T0000 content');
  assert.equal(prepared.expected_json.status, 'archived');
  assert.equal(prepared.expected_json.archived_at, RECEIVED_AT);
  assert.equal(Object.keys(prepared.expected_json).length, 9);
});

test('actual n8n prepare node returns one object for comma range and single inputs', () => {
  for (const [selectionMode, count] of [['multiple', 3], ['range', 4], ['single', 1]]) {
    const validated = validateBatchDeleteRequest(request({ memo_ids: IDS.slice(0, count), selection_mode: selectionMode }));
    const items = expandBatchDeleteRequest(validated).map((item) => ({
      ...planBatchArchiveItem(
        item,
        [metadata(item.memo_id, '/菲比工作總倉庫/00_INBOX_臨時丟進來')],
        [],
      ),
      preflight_source: 'active',
    }));
    const outputs = items.map((item) => runPrepareArchiveNode(item, activeMemo(item.memo_id)));
    assert.equal(outputs.length, count);
    for (const output of outputs) {
      assert.equal(Array.isArray(output), false);
      assert.equal(typeof output?.json, 'object');
      assert.equal(output.json.preflight_valid, true);
      assert.equal(output.json.item_action, 'archive');
      assert.equal(/replyToken|raw_user|credential|finalize_token|secret/i.test(JSON.stringify(output)), false);
    }
  }
});

test('actual n8n prepare node fails closed with one object on malformed input', () => {
  const output = runPrepareArchiveNode({}, {});
  assert.equal(Array.isArray(output), false);
  assert.equal(typeof output?.json, 'object');
  assert.equal(output.json.preflight_valid, false);
  assert.equal(output.json.item_action, 'failed');
  assert.equal(output.json.failure_class, 'preflight_readback_invalid');
});

test('exact terminal readback succeeds and mismatch never succeeds', () => {
  const validated = validateBatchDeleteRequest(request({ memo_ids: [IDS[0]], selection_mode: 'single' }));
  const item = planBatchArchiveItem(expandBatchDeleteRequest(validated)[0], [metadata(IDS[0], '/菲比工作總倉庫/00_INBOX_臨時丟進來')], []);
  const prepared = prepareArchivedMemo(item, activeMemo(IDS[0]));
  assert.equal(verifyArchiveReadback(prepared, prepared.expected_json).status, 'completed');
  assert.equal(verifyArchiveReadback(prepared, { ...prepared.expected_json, content: 'mismatch' }).status, 'readback_failed');
});

test('same-event archived item can re-enter only with exact terminal identity', () => {
  const validated = validateBatchDeleteRequest(request({ memo_ids: [IDS[0]], selection_mode: 'single' }));
  const item = expandBatchDeleteRequest(validated)[0];
  const planned = planBatchArchiveItem(item, [], [metadata(IDS[0], '/菲比工作總倉庫/99_ARCHIVE_封存')]);
  const archived = { ...activeMemo(IDS[0]), status: 'archived', updated_at: RECEIVED_AT, archived_at: RECEIVED_AT };
  assert.equal(verifyArchiveReadback(planned, archived, { reentry: true }).status, 'duplicate');
  assert.equal(verifyArchiveReadback(planned, { ...archived, archived_at: '2026-07-21T09:00:00.000Z' }, { reentry: true }).status, 'readback_failed');
});

test('partial failure is never overall success and replies expose no identities', () => {
  const validated = validateBatchDeleteRequest(request({ memo_ids: [IDS[0]] }));
  const items = expandBatchDeleteRequest(validated);
  const result = aggregateBatchArchive(validated, [
    { ...items[0], status: 'conflict' },
  ]);
  assert.equal(result.status, 'conflict');
  assert.equal(result.completed_count, 0);
  assert.equal(result.failed_count, 1);
  assert.equal(result.reply_text.includes('memo-'), false);
  assert.equal(/(?:\.json|Dropbox|revision|路徑|系統欄位)/i.test(result.reply_text), false);
});

test('all completed and all duplicate batches preserve exact ordered memo_ids', () => {
  const validated = validateBatchDeleteRequest(request({ memo_ids: [IDS[0]] }));
  const items = expandBatchDeleteRequest(validated);
  const completed = aggregateBatchArchive(validated, items.map((item) => ({ ...item, status: 'completed' })));
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.memo_ids, validated.memo_ids);
  const duplicate = aggregateBatchArchive(validated, items.map((item) => ({ ...item, status: 'duplicate' })));
  assert.equal(duplicate.status, 'duplicate');
});
