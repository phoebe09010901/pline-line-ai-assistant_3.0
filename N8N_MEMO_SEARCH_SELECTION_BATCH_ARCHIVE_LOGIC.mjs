export const MEMO_FULL_SNAPSHOT_LIMIT = 100;
export const MEMO_SEARCH_PAGE_SIZE = 10;
export const MEMO_SELECTION_BATCH_LIMIT = 5;
export const MEMO_ID_PATTERN = /^memo-[a-f0-9]{64}$/;
export const SAFE_REVISION_PATTERN = /^[0-9a-f]{9,255}$/;
export const CALLBACK_URL = 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize';

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const OPAQUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/;
const ACTIVE_PREFIX = '/菲比工作總倉庫/00_INBOX_臨時丟進來/';
const ARCHIVE_PREFIX = '/菲比工作總倉庫/99_ARCHIVE_封存/';
const ACTIVE_KEYS = ['schema', 'memo_id', 'type', 'content', 'status', 'created_at', 'updated_at', 'source'];
const ARCHIVE_KEYS = [...ACTIVE_KEYS, 'archived_at'];

function exactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|'));
}

function validIso(value) {
  return ISO_PATTERN.test(String(value || '')) && Number.isFinite(Date.parse(String(value || '')));
}

export function normalizeSearchSelectionResult({ matches = [], overflow = false } = {}) {
  if (overflow || matches.length > MEMO_FULL_SNAPSHOT_LIMIT) {
    return {
      status: 'failed',
      total: 0,
      selection_candidates: [],
      page_candidates: [],
      page: 0,
      page_count: 0,
      reply_text: '備忘錄數量超過安全搜尋上限，請縮小關鍵字範圍。',
    };
  }
  const ordered = [...matches].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))
    || String(a.memo_id).localeCompare(String(b.memo_id)));
  const selectionCandidates = ordered.map((memo, index) => ({
    position: index + 1,
    memo_id: String(memo.memo_id || ''),
  }));
  const pageCandidates = ordered.slice(0, MEMO_SEARCH_PAGE_SIZE).map((memo, index) => {
    const compact = String(memo.content || '').replace(/\s+/g, ' ').trim();
    return {
      position: index + 1,
      memo_id: String(memo.memo_id || ''),
      summary: compact.length <= 80 ? compact : `${compact.slice(0, 79)}…`,
    };
  });
  const total = ordered.length;
  const pageCount = total === 0 ? 0 : Math.ceil(total / MEMO_SEARCH_PAGE_SIZE);
  return {
    status: 'completed',
    total,
    page: total === 0 ? 0 : 1,
    page_count: pageCount,
    selection_candidates: selectionCandidates,
    page_candidates: pageCandidates,
    reply_text: total
      ? `找到 ${total} 筆使用中備忘錄，第 1/${pageCount} 頁。${pageCandidates.map((entry) => `\n${entry.position}. ${entry.summary}`).join('')}`
      : '沒有找到符合的使用中備忘錄。',
  };
}

export function validateMemoSearchPageRequest(input = {}) {
  const delivery = input.reply_delivery_reference && typeof input.reply_delivery_reference === 'object'
    ? input.reply_delivery_reference
    : {};
  const memoIds = Array.isArray(input.memo_ids) ? input.memo_ids.map((value) => String(value || '')) : [];
  const page = Number(input.page_number);
  const pageCount = Number(input.page_count);
  const total = Number(input.total);
  const globalStart = Number(input.global_start);
  const expectedPageCount = Number.isSafeInteger(total) && total > 0
    ? Math.ceil(total / MEMO_SEARCH_PAGE_SIZE)
    : 0;
  const expectedLength = Number.isSafeInteger(globalStart) && Number.isSafeInteger(total)
    ? Math.min(MEMO_SEARCH_PAGE_SIZE, Math.max(0, total - globalStart + 1))
    : 0;
  const valid = input.intent === 'memo_search_page'
    && input.page_scope === 'memo_search_selection_snapshot'
    && /^[a-f0-9]{64}$/.test(String(input.safe_event_hash || ''))
    && /^[a-f0-9]{64}$/.test(String(input.selection_snapshot_version || ''))
    && validIso(input.received_at)
    && Number.isSafeInteger(total) && total > 0 && total <= MEMO_FULL_SNAPSHOT_LIMIT
    && Number.isSafeInteger(page) && page >= 1 && page <= pageCount
    && pageCount === expectedPageCount
    && Number.isSafeInteger(globalStart) && globalStart === ((page - 1) * MEMO_SEARCH_PAGE_SIZE) + 1
    && memoIds.length === expectedLength && memoIds.length > 0 && memoIds.length <= MEMO_SEARCH_PAGE_SIZE
    && memoIds.every((memoId) => MEMO_ID_PATTERN.test(memoId))
    && new Set(memoIds).size === memoIds.length
    && String(delivery.callback_url || '') === CALLBACK_URL
    && OPAQUE_PATTERN.test(String(delivery.task_id || ''))
    && OPAQUE_PATTERN.test(String(delivery.request_id || ''));
  return {
    valid,
    intent: 'memo_search_page',
    operation: 'memo_search_page',
    page_scope: valid ? String(input.page_scope) : '',
    selection_snapshot_version: valid ? String(input.selection_snapshot_version) : '',
    safe_event_hash: valid ? String(input.safe_event_hash) : '',
    received_at: valid ? String(input.received_at) : '',
    page: valid ? page : 0,
    page_count: valid ? pageCount : 0,
    total: valid ? total : 0,
    global_start: valid ? globalStart : 0,
    memo_ids: valid ? memoIds : [],
    callback_url: valid ? String(delivery.callback_url) : '',
    task_id: valid ? String(delivery.task_id) : '',
    request_id: valid ? String(delivery.request_id) : '',
  };
}

export function expandMemoSearchPageRequest(request = {}) {
  if (!request.valid) return [];
  return request.memo_ids.map((memoId, index) => ({
    ...request,
    memo_id: memoId,
    page_index: index,
    position: request.global_start + index,
    active_path: `${ACTIVE_PREFIX}${memoId}.json`,
  }));
}

export function aggregateMemoSearchPage(request = {}, items = []) {
  const valid = request.valid
    && items.length === request.memo_ids.length
    && items.every((item, index) => {
      const memo = item?.memo;
      return item.memo_id === request.memo_ids[index]
        && Number(item.position) === request.global_start + index
        && exactKeys(memo, ACTIVE_KEYS)
        && memo.schema === 'pline-memo/v1'
        && memo.memo_id === request.memo_ids[index]
        && memo.type === 'memo'
        && memo.status === 'active'
        && memo.source === 'line'
        && typeof memo.content === 'string' && Boolean(memo.content.trim())
        && validIso(memo.created_at) && validIso(memo.updated_at);
    });
  const pageCandidates = valid ? items.map((item, index) => {
    const compact = String(item.memo.content || '').replace(/\s+/g, ' ').trim();
    return {
      position: request.global_start + index,
      memo_id: request.memo_ids[index],
      summary: compact.length <= 80 ? compact : `${compact.slice(0, 79)}…`,
    };
  }) : [];
  return {
    intent: 'memo_search_page',
    operation: 'memo_search_page',
    status: valid ? 'completed' : 'failed',
    memo_id: '',
    memo_ids: request.memo_ids || [],
    selection_candidates: [],
    page_candidates: pageCandidates,
    total: valid ? request.total : 0,
    page: valid ? request.page : 0,
    page_count: valid ? request.page_count : 0,
    callback_url: request.callback_url || '',
    task_id: request.task_id || '',
    request_id: request.request_id || '',
    reply_text: valid
      ? `找到 ${request.total} 筆使用中備忘錄，第 ${request.page}/${request.page_count} 頁。${pageCandidates.map((entry) => `\n${entry.position}. ${entry.summary}`).join('')}`
      : '這一頁的備忘錄內容已變更，請重新搜尋。',
  };
}

export function validateBatchDeleteRequest(input = {}) {
  const delivery = input.reply_delivery_reference && typeof input.reply_delivery_reference === 'object'
    ? input.reply_delivery_reference
    : {};
  const memoIds = Array.isArray(input.memo_ids) ? input.memo_ids.map((value) => String(value || '')) : [];
  const safeEventHash = String(input.safe_event_hash || '').trim().toLowerCase();
  const receivedAt = String(input.received_at || '').trim();
  const snapshotVersion = String(input.selection_snapshot_version || '').trim().toLowerCase();
  const selectionMode = String(input.selection_mode || '');
  const valid = input.intent === 'memo_delete'
    && input.delete_scope === 'memo_search_selection_snapshot'
    && ['single', 'multiple', 'range', 'all'].includes(selectionMode)
    && input.confirmation_status === 'consumed'
    && /^[a-f0-9]{64}$/.test(safeEventHash)
    && /^[a-f0-9]{64}$/.test(snapshotVersion)
    && validIso(receivedAt)
    && memoIds.length > 0
    && memoIds.length <= MEMO_SELECTION_BATCH_LIMIT
    && memoIds.every((memoId) => MEMO_ID_PATTERN.test(memoId))
    && new Set(memoIds).size === memoIds.length
    && String(delivery.callback_url || '') === CALLBACK_URL
    && OPAQUE_PATTERN.test(String(delivery.task_id || ''))
    && OPAQUE_PATTERN.test(String(delivery.request_id || ''));
  return {
    valid,
    intent: 'memo_delete',
    operation: 'memo_delete',
    delete_scope: String(input.delete_scope || ''),
    selection_mode: selectionMode,
    confirmation_status: valid ? 'consumed' : '',
    selection_snapshot_version: valid ? snapshotVersion : '',
    safe_event_hash: valid ? safeEventHash : '',
    received_at: valid ? receivedAt : '',
    memo_ids: valid ? memoIds : [],
    callback_url: valid ? String(delivery.callback_url) : '',
    task_id: valid ? String(delivery.task_id) : '',
    request_id: valid ? String(delivery.request_id) : '',
  };
}

export function expandBatchDeleteRequest(request = {}) {
  if (!request.valid || !Array.isArray(request.memo_ids)) return [];
  return request.memo_ids.map((memoId, index) => ({
    ...request,
    memo_id: memoId,
    batch_index: index,
    batch_size: request.memo_ids.length,
    active_path: `${ACTIVE_PREFIX}${memoId}.json`,
    archive_path: `${ARCHIVE_PREFIX}${memoId}.json`,
  }));
}

export function buildBatchPreflightInventory(request = {}, activeEntries = [], archiveEntries = []) {
  const items = expandBatchDeleteRequest(request).map((item) => {
    const activeMatches = exactMetadataMatches(activeEntries, item.memo_id, item.active_path);
    const archiveMatches = exactMetadataMatches(archiveEntries, item.memo_id, item.archive_path);
    const activeRevision = activeMatches.length === 1 ? String(activeMatches[0].rev || '') : '';
    const archiveRevision = archiveMatches.length === 1 ? String(archiveMatches[0].rev || '') : '';
    if (activeMatches.length === 1 && SAFE_REVISION_PATTERN.test(activeRevision) && archiveMatches.length === 0) {
      return { ...item, preflight_source: 'active', revision: activeRevision, archive_revision: '', preflight_inventory_valid: true };
    }
    if (activeMatches.length === 0 && archiveMatches.length === 1 && SAFE_REVISION_PATTERN.test(archiveRevision)) {
      return { ...item, preflight_source: 'archive', revision: '', archive_revision: archiveRevision, preflight_inventory_valid: true };
    }
    return {
      ...item,
      preflight_source: '',
      revision: '',
      archive_revision: '',
      preflight_inventory_valid: false,
      status: activeMatches.length > 1 || archiveMatches.length > 1 || archiveMatches.length === 1 ? 'conflict' : 'failed',
      failure_class: archiveMatches.length === 1 ? 'archive_collision' : 'preflight_inventory_invalid',
    };
  });
  return {
    valid: Boolean(request.valid) && items.length === request.memo_ids.length && items.every((item) => item.preflight_inventory_valid),
    items,
  };
}

export function verifyBatchPreflightItem(item = {}, memo = {}) {
  const activeExact = exactKeys(memo, ACTIVE_KEYS)
    && memo.schema === 'pline-memo/v1'
    && memo.memo_id === item.memo_id
    && memo.type === 'memo'
    && memo.status === 'active'
    && memo.source === 'line'
    && typeof memo.content === 'string' && Boolean(memo.content.trim())
    && validIso(memo.created_at) && validIso(memo.updated_at)
    && item.preflight_source === 'active'
    && SAFE_REVISION_PATTERN.test(String(item.revision || ''));
  const archivedExact = exactKeys(memo, ARCHIVE_KEYS)
    && memo.schema === 'pline-memo/v1'
    && memo.memo_id === item.memo_id
    && memo.type === 'memo'
    && memo.status === 'archived'
    && memo.source === 'line'
    && typeof memo.content === 'string' && Boolean(memo.content.trim())
    && validIso(memo.created_at)
    && memo.updated_at === item.received_at
    && memo.archived_at === item.received_at;
  if (activeExact) {
    const expected = {
      schema: memo.schema,
      memo_id: memo.memo_id,
      type: memo.type,
      content: memo.content,
      status: 'archived',
      created_at: memo.created_at,
      updated_at: item.received_at,
      source: memo.source,
      archived_at: item.received_at,
    };
    return { ...item, preflight_valid: true, item_action: 'archive', expected_json: expected, expected_json_text: JSON.stringify(expected, null, 2), status: 'preflight_ready' };
  }
  if (archivedExact && item.preflight_source === 'active' && SAFE_REVISION_PATTERN.test(String(item.revision || ''))) {
    return { ...item, preflight_valid: true, item_action: 'resume_move', expected_json: memo, expected_json_text: JSON.stringify(memo, null, 2), status: 'preflight_resume_move' };
  }
  if (archivedExact && item.preflight_source === 'archive' && SAFE_REVISION_PATTERN.test(String(item.archive_revision || ''))) {
    return { ...item, preflight_valid: true, item_action: 'duplicate', expected_json: memo, expected_json_text: JSON.stringify(memo, null, 2), status: 'preflight_duplicate' };
  }
  return { ...item, preflight_valid: false, item_action: 'failed', expected_json: null, expected_json_text: '', status: 'failed', failure_class: 'preflight_readback_invalid' };
}

export function aggregateBatchPreflight(request = {}, items = []) {
  const ordered = [...items].sort((a, b) => Number(a.batch_index) - Number(b.batch_index));
  const valid = Boolean(request.valid)
    && ordered.length === request.memo_ids.length
    && ordered.every((item, index) => item.preflight_valid === true
      && item.memo_id === request.memo_ids[index]
      && Number(item.batch_index) === index
      && ['archive', 'resume_move', 'duplicate'].includes(String(item.item_action || '')));
  return {
    ...request,
    valid,
    continue_operation: valid,
    preflight_items: valid ? ordered : [],
    status: valid ? 'preflight_completed' : 'failed',
    failure_class: valid ? '' : String(ordered.find((item) => item.preflight_valid !== true)?.failure_class || 'preflight_failed'),
  };
}

function exactMetadataMatches(entries, memoId, expectedPath) {
  return entries.filter((entry) => {
    const path = typeof entry?.pathLower === 'string' ? entry.pathLower : String(entry?.pathDisplay || '');
    return entry?.type === 'file'
      && !Object.prototype.hasOwnProperty.call(entry || {}, 'error')
      && String(entry?.name || '') === `${memoId}.json`
      && path.toLowerCase() === expectedPath.toLowerCase();
  });
}

export function planBatchArchiveItem(item = {}, activeEntries = [], archiveEntries = []) {
  const activeMatches = exactMetadataMatches(activeEntries, item.memo_id, item.active_path);
  const archiveMatches = exactMetadataMatches(archiveEntries, item.memo_id, item.archive_path);
  const activeRevision = activeMatches.length === 1 ? String(activeMatches[0].rev || '') : '';
  const archiveRevision = archiveMatches.length === 1 ? String(archiveMatches[0].rev || '') : '';
  if (activeMatches.length === 1 && SAFE_REVISION_PATTERN.test(activeRevision) && archiveMatches.length === 0) {
    return { ...item, item_action: 'archive', revision: activeRevision, archive_revision: '' };
  }
  if (activeMatches.length === 0 && archiveMatches.length === 1 && SAFE_REVISION_PATTERN.test(archiveRevision)) {
    return { ...item, item_action: 'reentry_verify', revision: '', archive_revision: archiveRevision };
  }
  return { ...item, item_action: 'conflict', revision: '', archive_revision: '', status: 'conflict' };
}

export function prepareArchivedMemo(item = {}, memo = {}) {
  const valid = exactKeys(memo, ACTIVE_KEYS)
    && memo.schema === 'pline-memo/v1'
    && memo.memo_id === item.memo_id
    && memo.type === 'memo'
    && memo.status === 'active'
    && memo.source === 'line'
    && typeof memo.content === 'string'
    && Boolean(memo.content.trim())
    && validIso(memo.created_at)
    && validIso(memo.updated_at)
    && SAFE_REVISION_PATTERN.test(String(item.revision || ''));
  if (!valid) return { ...item, continue_operation: false, status: 'failed', expected_json: null };
  const expected = {
    schema: memo.schema,
    memo_id: memo.memo_id,
    type: memo.type,
    content: memo.content,
    status: 'archived',
    created_at: memo.created_at,
    updated_at: item.received_at,
    source: memo.source,
    archived_at: item.received_at,
  };
  return { ...item, continue_operation: true, status: 'prepared', expected_json: expected, expected_json_text: JSON.stringify(expected, null, 2) };
}

export function verifyArchiveReadback(item = {}, memo = {}, { reentry = false } = {}) {
  const common = exactKeys(memo, ARCHIVE_KEYS)
    && memo.schema === 'pline-memo/v1'
    && memo.memo_id === item.memo_id
    && memo.type === 'memo'
    && memo.status === 'archived'
    && memo.source === 'line'
    && typeof memo.content === 'string'
    && Boolean(memo.content.trim())
    && validIso(memo.created_at)
    && memo.updated_at === item.received_at
    && memo.archived_at === item.received_at;
  const exact = reentry
    ? common
    : common && exactKeys(item.expected_json, ARCHIVE_KEYS)
      && ARCHIVE_KEYS.every((key) => memo[key] === item.expected_json[key]);
  return {
    ...item,
    status: exact ? (reentry ? 'duplicate' : 'completed') : 'readback_failed',
    item_terminal: true,
    item_success: exact,
  };
}

export function aggregateBatchArchive(request = {}, itemResults = []) {
  const ordered = [...itemResults].sort((a, b) => Number(a.batch_index) - Number(b.batch_index));
  const shapeValid = request.valid
    && ordered.length === request.memo_ids.length
    && ordered.every((item, index) => item.memo_id === request.memo_ids[index] && Number(item.batch_index) === index);
  const completed = shapeValid
    ? ordered.filter((item) => ['completed', 'duplicate'].includes(String(item.status || ''))).length
    : 0;
  const failed = request.memo_ids.length - completed;
  const allCompleted = shapeValid && completed === request.memo_ids.length;
  const status = allCompleted
    ? (ordered.every((item) => item.status === 'duplicate') ? 'duplicate' : 'completed')
    : ordered.some((item) => item.status === 'conflict') ? 'conflict'
      : ordered.some((item) => item.status === 'readback_failed') ? 'readback_failed'
        : 'failed';
  return {
    intent: 'memo_delete',
    operation: 'memo_delete',
    status,
    memo_id: '',
    memo_ids: request.memo_ids,
    callback_url: request.callback_url,
    task_id: request.task_id,
    request_id: request.request_id,
    completed_count: completed,
    success_count: completed,
    failed_count: failed,
    reply_text: allCompleted
      ? `這次預計刪除 ${request.memo_ids.length} 筆，成功 ${completed} 筆，未刪除 0 筆。`
      : `這次預計刪除 ${request.memo_ids.length} 筆，成功 ${completed} 筆，未刪除 ${failed} 筆；基於安全檢查，未完成的項目沒有繼續處理。`,
  };
}

export function aggregateBatchArchiveFailure(request = {}, item = {}) {
  const index = Number(item.batch_index);
  const safeIndex = Number.isSafeInteger(index) && index >= 0 && index < request.memo_ids.length ? index : 0;
  const completed = safeIndex;
  const failed = Math.max(1, request.memo_ids.length - completed);
  const status = ['conflict', 'readback_failed'].includes(String(item.status || '')) ? String(item.status) : 'failed';
  return {
    intent: 'memo_delete',
    operation: 'memo_delete',
    status,
    memo_id: '',
    memo_ids: request.memo_ids,
    callback_url: request.callback_url,
    task_id: request.task_id,
    request_id: request.request_id,
    completed_count: completed,
    success_count: completed,
    failed_count: failed,
    failure_class: String(item.failure_class || status || 'failed').replace(/[^a-z0-9_:-]/gi, '').slice(0, 64) || 'failed',
    reply_text: `這次預計刪除 ${request.memo_ids.length} 筆，成功 ${completed} 筆，未刪除 ${failed} 筆；基於安全檢查，未完成的項目沒有繼續處理。`,
  };
}
