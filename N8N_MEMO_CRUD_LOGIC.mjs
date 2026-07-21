const MEMO_ID_RE = /^memo-[a-f0-9]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const CALLBACK_URL = 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize';
const ACTIVE_DIRECTORY = '/菲比工作總倉庫/00_INBOX_臨時丟進來';
const ARCHIVE_DIRECTORY = '/菲比工作總倉庫/99_ARCHIVE_封存';
const ACTIVE_KEYS = ['schema', 'memo_id', 'type', 'content', 'status', 'created_at', 'updated_at', 'source'];
const ARCHIVE_KEYS = [...ACTIVE_KEYS, 'archived_at'];

const exactKeys = (value, keys) => Boolean(
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === keys.slice().sort().join('|')
);

const validIso = (value) => ISO_RE.test(String(value || '')) && Number.isFinite(Date.parse(value));
const validOpaque = (value) => /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/.test(String(value || ''));

export function memoPath(memoId, location = 'active') {
  if (!MEMO_ID_RE.test(String(memoId || ''))) throw new Error('invalid_memo_id');
  const directory = location === 'active'
    ? ACTIVE_DIRECTORY
    : location === 'archive'
      ? ARCHIVE_DIRECTORY
      : (() => { throw new Error('invalid_location'); })();
  return directory + '/' + memoId + '.json';
}

export function normalizeMemoCrudInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const intent = String(input.intent || '');
  const delivery = input.reply_delivery_reference && typeof input.reply_delivery_reference === 'object'
    ? input.reply_delivery_reference
    : {};
  return {
    intent,
    safe_event_hash: String(input.safe_event_hash || '').trim().toLowerCase(),
    received_at: String(input.received_at || '').trim(),
    keyword: String(input.keyword || '').trim(),
    list_all: input.list_all === true,
    memo_id: String(input.memo_id || '').trim().toLowerCase(),
    new_content: String(input.new_content || '').trim(),
    callback_url: String(delivery.callback_url || ''),
    task_id: String(delivery.task_id || '').trim(),
    request_id: String(delivery.request_id || '').trim()
  };
}

export function validateMemoCrudInput(body) {
  const input = normalizeMemoCrudInput(body);
  const common = ['memo_search', 'memo_modify', 'memo_delete'].includes(input.intent)
    && /^[a-f0-9]{64}$/.test(input.safe_event_hash)
    && validIso(input.received_at)
    && input.callback_url === CALLBACK_URL
    && validOpaque(input.task_id)
    && validOpaque(input.request_id);
  const operationValid = input.intent === 'memo_search'
    ? (input.list_all === true || input.keyword.length > 0)
    : input.intent === 'memo_modify'
      ? (MEMO_ID_RE.test(input.memo_id) && input.new_content.length > 0 && input.new_content.length <= 4000)
      : MEMO_ID_RE.test(input.memo_id);
  return {
    ...input,
    valid: common && operationValid,
    reason: common && operationValid ? '' : 'invalid_memo_crud_contract'
  };
}

export function isActiveMemo(value, expectedMemoId = '') {
  return exactKeys(value, ACTIVE_KEYS)
    && value.schema === 'pline-memo/v1'
    && MEMO_ID_RE.test(String(value.memo_id || ''))
    && (!expectedMemoId || value.memo_id === expectedMemoId)
    && value.type === 'memo'
    && typeof value.content === 'string'
    && value.content.trim().length > 0
    && value.status === 'active'
    && validIso(value.created_at)
    && validIso(value.updated_at)
    && value.source === 'line';
}

export function isArchivedMemo(value, expectedMemoId = '') {
  return exactKeys(value, ARCHIVE_KEYS)
    && value.schema === 'pline-memo/v1'
    && MEMO_ID_RE.test(String(value.memo_id || ''))
    && (!expectedMemoId || value.memo_id === expectedMemoId)
    && value.type === 'memo'
    && typeof value.content === 'string'
    && value.content.trim().length > 0
    && value.status === 'archived'
    && validIso(value.created_at)
    && validIso(value.updated_at)
    && validIso(value.archived_at)
    && value.source === 'line';
}

function summary(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length <= 80 ? value : value.slice(0, 79) + '…';
}

export function searchActiveMemos(records, request) {
  const input = validateMemoCrudInput(request);
  if (!input.valid || input.intent !== 'memo_search') {
    return { status: 'failed', total: 0, shown: [], reply_text: '備忘錄搜尋條件不完整，請再試一次。' };
  }
  const valid = records
    .filter((record) => {
      const name = String(record.name || '');
      const memo = record.memo;
      return /^memo-[a-f0-9]{64}\.json$/.test(name)
        && isActiveMemo(memo)
        && name === memo.memo_id + '.json';
    })
    .map((record) => record.memo)
    .filter((memo) => input.list_all
      || memo.memo_id === input.keyword
      || memo.content.includes(input.keyword))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.memo_id.localeCompare(b.memo_id));
  const shown = valid.slice(0, 10).map((memo) => ({ memo_id: memo.memo_id, summary: summary(memo.content) }));
  const replyText = valid.length === 0
    ? '沒有找到符合的使用中備忘錄。'
    : '找到 ' + valid.length + ' 筆使用中備忘錄。' + shown.map((memo, index) =>
      '\n' + (index + 1) + '. ' + memo.memo_id + '｜' + memo.summary
    ).join('');
  return { status: 'completed', total: valid.length, shown, reply_text: replyText };
}

export function prepareMemoModify(existing, request, expectedRevision) {
  const input = validateMemoCrudInput(request);
  if (!input.valid || input.intent !== 'memo_modify' || !isActiveMemo(existing, input.memo_id)) {
    return { valid: false, reason: 'invalid_or_missing_active_memo' };
  }
  if (!/^[A-Za-z0-9._:-]{1,255}$/.test(String(expectedRevision || ''))) {
    return { valid: false, reason: 'missing_revision' };
  }
  const updated = {
    ...existing,
    content: input.new_content,
    updated_at: input.received_at
  };
  return { valid: true, expected_revision: expectedRevision, updated };
}

export function normalizeModifyMetadataResponse(response, request) {
  const entries = (Array.isArray(response) ? response : [response])
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
  const input = request && typeof request === 'object' ? request : {};
  const path = String(input.active_path || '');
  const memoId = String(input.memo_id || '');
  const updatedContent = String(input.new_content || '');
  const targetPath = path.toLowerCase();
  const matches = entries.filter((entry) => {
    const candidatePath = typeof entry.pathLower === 'string'
      ? entry.pathLower
      : typeof entry.pathDisplay === 'string'
        ? entry.pathDisplay
        : '';
    return entry.type === 'file'
      && !Object.prototype.hasOwnProperty.call(entry, 'error')
      && candidatePath.toLowerCase() === targetPath;
  });
  const metadata = matches.length === 1 ? matches[0] : {};
  const rev = typeof metadata.rev === 'string' ? metadata.rev : '';
  const handoffValid = MEMO_ID_RE.test(memoId)
    && path === ACTIVE_DIRECTORY + '/' + memoId + '.json'
    && updatedContent.length > 0;
  const ok = matches.length === 1
    && /^[0-9a-f]{9,255}$/.test(rev)
    && handoffValid;
  return {
    ...input,
    continue_operation: ok,
    rev: ok ? rev : '',
    revision: ok ? rev : '',
    path: ok ? path : '',
    memo_id: memoId,
    expected_content: ok ? updatedContent : '',
    updated_content: ok ? updatedContent : '',
    status: ok ? 'metadata_ready' : 'failed',
    reply_text: ok ? '' : '找不到可操作的使用中備忘錄。',
    operation: 'memo_modify'
  };
}

export function normalizeModifyUpdateResponse(response, request) {
  const output = response && typeof response === 'object' && !Array.isArray(response) ? response : {};
  const input = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  const statusCode = Number(output.statusCode || 0);
  const memoId = String(input.memo_id || '');
  const path = String(input.path || input.active_path || '');
  const revision = String(input.rev || input.revision || '');
  const expected = input.expected_json && typeof input.expected_json === 'object' && !Array.isArray(input.expected_json)
    ? input.expected_json
    : null;
  const expectedText = typeof input.expected_json_text === 'string' ? input.expected_json_text : '';
  let parsedExpected = null;
  try {
    parsedExpected = JSON.parse(expectedText);
  } catch {
    parsedExpected = null;
  }
  const expectedValid = isActiveMemo(expected, memoId)
    && exactKeys(expected, ACTIVE_KEYS)
    && parsedExpected !== null
    && JSON.stringify(parsedExpected) === JSON.stringify(expected)
    && String(input.expected_content || '') === expected.content
    && String(input.updated_content || '') === expected.content;
  const handoffValid = MEMO_ID_RE.test(memoId)
    && path === ACTIVE_DIRECTORY + '/' + memoId + '.json'
    && /^[0-9a-f]{9,255}$/.test(revision)
    && expectedValid;
  const acceptedForReadback = statusCode >= 200 && statusCode < 300 && handoffValid;
  return {
    ...input,
    continue_operation: acceptedForReadback,
    updated_revision: '',
    status: acceptedForReadback
      ? 'update_accepted_readback_pending'
      : statusCode === 409
        ? 'conflict'
        : 'failed',
    operation: 'memo_modify',
    reply_text: acceptedForReadback
      ? ''
      : statusCode === 409
        ? '這筆備忘錄剛被更新，沒有覆蓋任何內容。'
        : '備忘錄目前無法安全完成更新。'
  };
}

export function verifyMemoModify(readback, expected) {
  return isActiveMemo(readback, expected?.memo_id)
    && exactKeys(readback, ACTIVE_KEYS)
    && ACTIVE_KEYS.every((key) => readback[key] === expected[key]);
}

export function prepareMemoArchive(existing, request, expectedRevision) {
  const input = validateMemoCrudInput(request);
  if (!input.valid || input.intent !== 'memo_delete' || !isActiveMemo(existing, input.memo_id)) {
    return { valid: false, reason: 'invalid_or_missing_active_memo' };
  }
  if (!/^[A-Za-z0-9._:-]{1,255}$/.test(String(expectedRevision || ''))) {
    return { valid: false, reason: 'missing_revision' };
  }
  const archived = {
    schema: existing.schema,
    memo_id: existing.memo_id,
    type: existing.type,
    content: existing.content,
    status: 'archived',
    created_at: existing.created_at,
    updated_at: input.received_at,
    source: existing.source,
    archived_at: input.received_at
  };
  return { valid: true, expected_revision: expectedRevision, archived };
}

export function verifyMemoArchive(readback, expected) {
  return isArchivedMemo(readback, expected?.memo_id)
    && exactKeys(readback, ARCHIVE_KEYS)
    && ARCHIVE_KEYS.every((key) => readback[key] === expected[key]);
}

export const MEMO_CRUD_CONTRACT = Object.freeze({
  callback_url: CALLBACK_URL,
  active_directory: ACTIVE_DIRECTORY,
  archive_directory: ARCHIVE_DIRECTORY,
  memo_id_pattern: MEMO_ID_RE.source,
  search_limit: 10,
  search_candidate_cap: 500,
  modify_conditional: 'update(rev)',
  delete_move_atomic: false,
  delete_toctou_policy: 'metadata_rev_must_equal_conditional_update_rev_before_move; post_move_archive_rev_and_content_must_match; ambiguity_never_success'
});
