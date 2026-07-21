import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const outputPath = process.argv[3] || sourcePath;
const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));

const dropboxCredentials = workflow.nodes.find((node) =>
  node.type === 'n8n-nodes-base.dropbox' && node.credentials?.dropboxOAuth2Api
)?.credentials;
const callbackCredentials = workflow.nodes.find((node) =>
  node.name === 'Memo Finalizer Callback' && node.credentials?.httpHeaderAuth
)?.credentials;
const withCredentials = (node, credentials) => credentials ? { ...node, credentials } : node;
const code = (lines) => lines.join('\n');

const normalize = workflow.nodes.find((node) => node.name === 'Normalize Input');
if (!normalize) throw new Error('Normalize Input node not found');

const crudNormalizeBlock = code([
  "if (['memo_search', 'memo_modify', 'memo_delete'].includes(rawIntent)) {",
  "  const delivery = body.reply_delivery_reference && typeof body.reply_delivery_reference === 'object' ? body.reply_delivery_reference : {};",
  "  return [{ json: {",
  "    intent: rawIntent,",
  "    safe_event_hash: String(body.safe_event_hash || '').trim().toLowerCase(),",
  "    received_at: String(body.received_at || '').trim(),",
  "    keyword: String(body.keyword || '').trim(),",
  "    list_all: body.list_all === true,",
  "    memo_id: String(body.memo_id || '').trim().toLowerCase(),",
  "    new_content: String(body.new_content || '').trim(),",
  "    reply_delivery_reference: {",
  "      callback_url: String(delivery.callback_url || ''),",
  "      task_id: String(delivery.task_id || ''),",
  "      request_id: String(delivery.request_id || '')",
  "    },",
  "    allowed_intents: ['memo_search', 'memo_modify', 'memo_delete', 'memo_create', 'idea_create', 'codex_task', 'clarify', 'unsupported']",
  "  } }];",
  "}",
  ""
]);
const crudStart = normalize.parameters.jsCode.indexOf("if (['memo_search', 'memo_modify', 'memo_delete'].includes(rawIntent))");
if (crudStart >= 0) {
  const crudEnd = normalize.parameters.jsCode.indexOf("if (rawIntent === 'memo_create')", crudStart);
  if (crudEnd < 0) throw new Error('Memo CRUD normalize end anchor not found');
  normalize.parameters.jsCode = normalize.parameters.jsCode.slice(0, crudStart)
    + crudNormalizeBlock
    + normalize.parameters.jsCode.slice(crudEnd);
} else {
  const anchor = "if (rawIntent === 'memo_create')";
  if (!normalize.parameters.jsCode.includes(anchor)) throw new Error('Memo Create normalize anchor not found');
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(anchor, crudNormalizeBlock + anchor);
}

const routeNode = (name, id, intent, position) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: id + '-condition', leftValue: '={{ $json.intent }}', rightValue: intent, operator: { type: 'string', operation: 'equals' } }],
      combinator: 'and'
    },
    options: {}
  },
  id,
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position
});

const boolRouteNode = (name, id, field, position) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: id + '-condition', leftValue: '={{ $json.' + field + ' }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and'
    },
    options: {}
  },
  id,
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position
});

const codeNode = (name, id, jsCode, position, mode) => ({
  parameters: mode ? { mode, jsCode } : { jsCode },
  id,
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position
});

const nativeDropbox = (name, id, parameters, position, extra = {}) => withCredentials({
  parameters: { authentication: 'oAuth2', ...parameters },
  id,
  name,
  type: 'n8n-nodes-base.dropbox',
  typeVersion: 1,
  position,
  ...extra
}, dropboxCredentials);

const dropboxHttp = (name, id, url, body, position, rawContentType = 'application/json') => withCredentials({
  parameters: {
    method: 'POST',
    url,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'dropboxOAuth2Api',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: rawContentType }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType,
    body,
    options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } }
  },
  id,
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  onError: 'continueRegularOutput'
}, dropboxCredentials);

const extractJson = (name, id, position) => ({
  parameters: {
    operation: 'fromJson',
    binaryPropertyName: 'data',
    destinationKey: 'memo',
    options: { encoding: 'utf8', stripBOM: true, keepSource: 'json' }
  },
  id,
  name,
  type: 'n8n-nodes-base.extractFromFile',
  typeVersion: 1.1,
  position,
  onError: 'continueRegularOutput'
});

const validateCode = code([
  "const input = $json || {};",
  "const delivery = input.reply_delivery_reference && typeof input.reply_delivery_reference === 'object' ? input.reply_delivery_reference : {};",
  "const intent = String(input.intent || '');",
  "const memoId = String(input.memo_id || '');",
  "const receivedAt = String(input.received_at || '');",
  "const keyword = String(input.keyword || '').trim();",
  "const newContent = String(input.new_content || '').trim();",
  "const callbackUrl = String(delivery.callback_url || '');",
  "const taskId = String(delivery.task_id || '');",
  "const requestId = String(delivery.request_id || '');",
  "const common = ['memo_search','memo_modify','memo_delete'].includes(intent)",
  "  && /^[a-f0-9]{64}$/.test(String(input.safe_event_hash || ''))",
  "  && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(receivedAt)",
  "  && Number.isFinite(Date.parse(receivedAt))",
  "  && callbackUrl === 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'",
  "  && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/.test(taskId)",
  "  && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/.test(requestId);",
  "const operationValid = intent === 'memo_search'",
  "  ? (input.list_all === true || keyword.length > 0)",
  "  : intent === 'memo_modify'",
  "    ? (/^memo-[a-f0-9]{64}$/.test(memoId) && newContent.length > 0 && newContent.length <= 4000)",
  "    : /^memo-[a-f0-9]{64}$/.test(memoId);",
  "const valid = common && operationValid;",
  "return [{ json: {",
  "  valid, continue_operation: valid, intent, memo_id: memoId, keyword, list_all: input.list_all === true, new_content: newContent, received_at: receivedAt,",
  "  active_path: valid && memoId ? '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json' : '',",
  "  archive_path: valid && memoId ? '/菲比工作總倉庫/99_ARCHIVE_封存/' + memoId + '.json' : '',",
  "  callback_url: valid ? callbackUrl : '', task_id: valid ? taskId : '', request_id: valid ? requestId : '',",
  "  status: valid ? 'validated' : 'failed',",
  "  reply_text: valid ? '' : '備忘錄指令格式不完整，請再試一次。'",
  "} }];"
]);

const searchCandidateCode = code([
  "const items = $input.all();",
  "const candidates = [];",
  "for (const item of items) {",
  "  const name = String(item.json?.name || '');",
  "  const path = String(item.json?.pathDisplay || '');",
  "  if (item.json?.type === 'file' && /^memo-[a-f0-9]{64}\\.json$/.test(name)",
  "    && path === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + name) {",
  "    candidates.push({ json: { candidate: true, name, path } });",
  "  }",
  "}",
  "if (items.length > 500) return [{ json: { candidate: false, overflow: true } }];",
  "return candidates.length ? candidates : [{ json: { candidate: false, overflow: false } }];"
]);

const searchAggregateCode = code([
  "const request = $('Memo Search Validate').first().json || {};",
  "const rawItems = $input.all();",
  "const sourceOverflow = rawItems.some((item) => item.json?.overflow === true);",
  "const keys = ['schema','memo_id','type','content','status','created_at','updated_at','source'];",
  "const validIso = (value) => /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(value || '')) && Number.isFinite(Date.parse(value));",
  "const matches = [];",
  "for (const item of rawItems) {",
  "  const memo = item.json?.memo;",
  "  const name = String(item.json?.name || item.json?.candidate_name || '');",
  "  if (!memo || typeof memo !== 'object' || Array.isArray(memo)) continue;",
  "  if (Object.keys(memo).sort().join('|') !== keys.slice().sort().join('|')) continue;",
  "  if (memo.schema !== 'pline-memo/v1' || !/^memo-[a-f0-9]{64}$/.test(String(memo.memo_id || ''))",
  "    || name !== memo.memo_id + '.json' || memo.type !== 'memo' || memo.status !== 'active'",
  "    || memo.source !== 'line' || typeof memo.content !== 'string' || !memo.content.trim()",
  "    || !validIso(memo.created_at) || !validIso(memo.updated_at)) continue;",
  "  if (!request.list_all && memo.memo_id !== request.keyword && !memo.content.includes(request.keyword)) continue;",
  "  matches.push(memo);",
  "}",
  "matches.sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.memo_id.localeCompare(b.memo_id));",
  "const shown = matches.slice(0,10).map((memo) => {",
  "  const compact = memo.content.replace(/\\s+/g,' ').trim();",
  "  return { memo_id: memo.memo_id, summary: compact.length <= 80 ? compact : compact.slice(0,79) + '…' };",
  "});",
  "const replyText = sourceOverflow ? '備忘錄數量超過安全搜尋上限，請縮小關鍵字範圍。'",
  "  : matches.length === 0 ? '沒有找到符合的使用中備忘錄。'",
  "  : '找到 ' + matches.length + ' 筆使用中備忘錄。' + shown.map((memo,index) => '\\n' + (index+1) + '. ' + memo.memo_id + '｜' + memo.summary).join('');",
  "return [{ json: { intent:'memo_search', operation:'memo_search', status: sourceOverflow ? 'failed' : 'completed', memo_id:'',",
  "  callback_url:request.callback_url, task_id:request.task_id, request_id:request.request_id, reply_text:replyText, total:sourceOverflow ? 0 : matches.length, shown_count:shown.length } }];"
]);

const metadataCheckCode = (validateNode, operation, successField = 'revision') => code([
  "const response = $json || {};",
  "const request = $('" + validateNode + "').first().json || {};",
  "const statusCode = Number(response.statusCode || 0);",
  "const rev = String(response.body?.rev || '');",
  "const ok = statusCode >= 200 && statusCode < 300 && /^[A-Za-z0-9._:-]{1,255}$/.test(rev);",
  "return [{ json: { ...request, continue_operation:ok, " + successField + ":ok ? rev : '', status:ok ? 'metadata_ready' : 'failed',",
  "  reply_text:ok ? '' : '找不到可操作的使用中備忘錄。', operation:'" + operation + "' } }];"
]);

const modifyMetadataCheckCode = code([
  "const request = $('Memo Modify Validate').first().json || {};",
  "const entries = $input.all().map((item) => item && item.json && typeof item.json === 'object' && !Array.isArray(item.json) ? item.json : {});",
  "const path = String(request.active_path || '');",
  "const memoId = String(request.memo_id || '');",
  "const updatedContent = String(request.new_content || '');",
  "const targetPath = path.toLowerCase();",
  "const matches = entries.filter((entry) => {",
  "  const candidatePath = typeof entry.pathLower === 'string' ? entry.pathLower : (typeof entry.pathDisplay === 'string' ? entry.pathDisplay : '');",
  "  return entry.type === 'file' && !Object.prototype.hasOwnProperty.call(entry, 'error') && candidatePath.toLowerCase() === targetPath;",
  "});",
  "const metadata = matches.length === 1 ? matches[0] : {};",
  "const rev = typeof metadata.rev === 'string' ? metadata.rev : '';",
  "const handoffValid = /^memo-[a-f0-9]{64}$/.test(memoId)",
  "  && path === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json'",
  "  && updatedContent.length > 0;",
  "const ok = matches.length === 1 && /^[0-9a-f]{9,255}$/.test(rev) && handoffValid;",
  "return [{ json: { ...request, continue_operation:ok, rev:ok ? rev : '', revision:ok ? rev : '',",
  "  path:ok ? path : '', memo_id:memoId, expected_content:ok ? updatedContent : '', updated_content:ok ? updatedContent : '',",
  "  status:ok ? 'metadata_ready' : 'failed', reply_text:ok ? '' : '找不到可操作的使用中備忘錄。', operation:'memo_modify' } }];"
]);

const deleteMetadataCheckCode = code([
  "const request = $('Memo Delete Validate').first().json || {};",
  "const entries = $input.all().map((item) => item && item.json && typeof item.json === 'object' && !Array.isArray(item.json) ? item.json : {});",
  "const memoId = String(request.memo_id || '');",
  "const activePath = String(request.active_path || '');",
  "const archivePath = String(request.archive_path || '');",
  "const matches = entries.filter((entry) => {",
  "  const candidatePath = typeof entry.pathLower === 'string' ? entry.pathLower : (typeof entry.pathDisplay === 'string' ? entry.pathDisplay : '');",
  "  return entry.type === 'file' && !Object.prototype.hasOwnProperty.call(entry, 'error')",
  "    && String(entry.name || '') === memoId + '.json' && candidatePath.toLowerCase() === activePath.toLowerCase();",
  "});",
  "const metadata = matches.length === 1 ? matches[0] : {};",
  "const revision = typeof metadata.rev === 'string' ? metadata.rev : '';",
  "const handoffValid = request.intent === 'memo_delete' && /^memo-[a-f0-9]{64}$/.test(memoId)",
  "  && activePath === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json'",
  "  && archivePath === '/菲比工作總倉庫/99_ARCHIVE_封存/' + memoId + '.json';",
  "const ok = matches.length === 1 && /^[0-9a-f]{9,255}$/.test(revision) && handoffValid;",
  "return [{ json:{ ...request, continue_operation:ok, revision:ok ? revision : '', status:ok ? 'metadata_ready' : 'failed',",
  "  operation:'memo_delete', reply_text:ok ? '' : '找不到可操作的使用中備忘錄。' } }];"
]);

const activeMemoPrepareCode = (operation) => code([
  "const input = $json || {};",
  "const request = $('Memo " + (operation === 'memo_modify' ? "Modify Metadata Check" : "Delete Metadata Check") + "').first().json || {};",
  "const memo = input.memo;",
  "const keys = ['schema','memo_id','type','content','status','created_at','updated_at','source'];",
  "const exact = memo && typeof memo === 'object' && !Array.isArray(memo) && Object.keys(memo).sort().join('|') === keys.slice().sort().join('|');",
  "const valid = exact && memo.schema === 'pline-memo/v1' && memo.memo_id === request.memo_id && memo.type === 'memo'",
  "  && memo.status === 'active' && memo.source === 'line' && typeof memo.content === 'string' && memo.content.trim()",
  "  && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(memo.created_at || ''))",
  "  && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(memo.updated_at || ''));",
  operation === 'memo_modify'
    ? "const expected = valid ? { ...memo, content:request.new_content, updated_at:request.received_at } : null;"
    : "const expected = valid ? { schema:memo.schema, memo_id:memo.memo_id, type:memo.type, content:memo.content, status:'archived', created_at:memo.created_at, updated_at:request.received_at, source:memo.source, archived_at:request.received_at } : null;",
  "return [{ json: { ...request, continue_operation:valid, expected_json:expected, expected_json_text:expected ? JSON.stringify(expected,null,2) : '',",
  "  status:valid ? 'prepared' : 'failed', reply_text:valid ? '' : '找不到可操作的使用中備忘錄。' } }];"
]);

const updateCheckCode = (prepareNode, operation) => code([
  "const response = $json || {};",
  "const request = $('" + prepareNode + "').first().json || {};",
  "const statusCode = Number(response.statusCode || 0);",
  "const rev = String(response.body?.rev || '');",
  "const ok = statusCode >= 200 && statusCode < 300 && /^[A-Za-z0-9._:-]{1,255}$/.test(rev);",
  "return [{ json:{ ...request, continue_operation:ok, updated_revision:ok ? rev : '', status:ok ? 'updated' : (statusCode === 409 ? 'conflict' : 'failed'),",
  "  operation:'" + operation + "', reply_text:ok ? '' : (statusCode === 409 ? '這筆備忘錄剛被更新，沒有覆蓋任何內容。' : '備忘錄目前無法安全完成更新。') } }];"
]);

const modifyUpdateCheckCode = code([
  "const response = $json && typeof $json === 'object' && !Array.isArray($json) ? $json : {};",
  "const request = $('Memo Modify Prepare').first().json || {};",
  "const statusCode = Number(response.statusCode || 0);",
  "const memoId = String(request.memo_id || '');",
  "const path = String(request.path || request.active_path || '');",
  "const revision = String(request.rev || request.revision || '');",
  "const expected = request.expected_json && typeof request.expected_json === 'object' && !Array.isArray(request.expected_json) ? request.expected_json : null;",
  "const expectedKeys = ['schema','memo_id','type','content','status','created_at','updated_at','source'];",
  "let parsedExpected = null; try { parsedExpected = JSON.parse(typeof request.expected_json_text === 'string' ? request.expected_json_text : ''); } catch (error) { parsedExpected = null; }",
  "const exactExpectedKeys = expected && Object.keys(expected).sort().join('|') === expectedKeys.slice().sort().join('|');",
  "const expectedValid = Boolean(exactExpectedKeys && expected.schema === 'pline-memo/v1' && expected.memo_id === memoId && expected.type === 'memo'",
  "  && typeof expected.content === 'string' && expected.content.trim().length > 0 && expected.status === 'active'",
  "  && typeof expected.created_at === 'string' && typeof expected.updated_at === 'string' && expected.source === 'line'",
  "  && parsedExpected && JSON.stringify(parsedExpected) === JSON.stringify(expected)",
  "  && String(request.expected_content || '') === expected.content && String(request.updated_content || '') === expected.content);",
  "const handoffValid = /^memo-[a-f0-9]{64}$/.test(memoId)",
  "  && path === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json'",
  "  && /^[0-9a-f]{9,255}$/.test(revision) && expectedValid;",
  "const acceptedForReadback = statusCode >= 200 && statusCode < 300 && handoffValid;",
  "return [{ json:{ ...request, continue_operation:acceptedForReadback, updated_revision:'',",
  "  status:acceptedForReadback ? 'update_accepted_readback_pending' : (statusCode === 409 ? 'conflict' : 'failed'),",
  "  operation:'memo_modify', reply_text:acceptedForReadback ? '' : (statusCode === 409 ? '這筆備忘錄剛被更新，沒有覆蓋任何內容。' : '備忘錄目前無法安全完成更新。') } }];"
]);

const deleteUpdateCheckCode = code([
  "const response = $json && typeof $json === 'object' && !Array.isArray($json) ? $json : {};",
  "const request = $('Memo Delete Prepare Archive').first().json || {};",
  "const statusCode = Number(response.statusCode || 0);",
  "const memoId = String(request.memo_id || '');",
  "const activePath = String(request.active_path || '');",
  "const archivePath = String(request.archive_path || '');",
  "const revision = String(request.revision || '');",
  "const expected = request.expected_json && typeof request.expected_json === 'object' && !Array.isArray(request.expected_json) ? request.expected_json : null;",
  "const expectedKeys = ['schema','memo_id','type','content','status','created_at','updated_at','source','archived_at'];",
  "let parsedExpected = null; try { parsedExpected = JSON.parse(typeof request.expected_json_text === 'string' ? request.expected_json_text : ''); } catch (error) { parsedExpected = null; }",
  "const exactExpectedKeys = expected && Object.keys(expected).sort().join('|') === expectedKeys.slice().sort().join('|');",
  "const expectedValid = Boolean(exactExpectedKeys && expected.schema === 'pline-memo/v1' && expected.memo_id === memoId && expected.type === 'memo'",
  "  && typeof expected.content === 'string' && expected.content.trim().length > 0 && expected.status === 'archived'",
  "  && typeof expected.created_at === 'string' && typeof expected.updated_at === 'string' && expected.source === 'line'",
  "  && expected.archived_at === expected.updated_at && parsedExpected && JSON.stringify(parsedExpected) === JSON.stringify(expected));",
  "const handoffValid = request.intent === 'memo_delete' && /^memo-[a-f0-9]{64}$/.test(memoId)",
  "  && activePath === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json'",
  "  && archivePath === '/菲比工作總倉庫/99_ARCHIVE_封存/' + memoId + '.json'",
  "  && /^[0-9a-f]{9,255}$/.test(revision) && expectedValid;",
  "const accepted = statusCode >= 200 && statusCode < 300 && handoffValid;",
  "return [{ json:{ ...request, continue_operation:accepted, updated_revision:'',",
  "  status:accepted ? 'archive_state_update_accepted_metadata_pending' : (statusCode === 409 ? 'conflict' : 'failed'),",
  "  operation:'memo_delete', reply_text:accepted ? '' : (statusCode === 409 ? '這筆備忘錄剛被更新，沒有覆蓋任何內容。' : '備忘錄目前無法安全完成更新。') } }];"
]);

const deletePreMoveGuardCode = code([
  "const request = $('Memo Delete Update Check').first().json || {};",
  "const entries = $input.all().map((item) => item && item.json && typeof item.json === 'object' && !Array.isArray(item.json) ? item.json : {});",
  "const memoId = String(request.memo_id || '');",
  "const activePath = String(request.active_path || '');",
  "const matches = entries.filter((entry) => {",
  "  const candidatePath = typeof entry.pathLower === 'string' ? entry.pathLower : (typeof entry.pathDisplay === 'string' ? entry.pathDisplay : '');",
  "  return entry.type === 'file' && !Object.prototype.hasOwnProperty.call(entry, 'error')",
  "    && String(entry.name || '') === memoId + '.json' && candidatePath.toLowerCase() === activePath.toLowerCase();",
  "});",
  "const currentRevision = matches.length === 1 && typeof matches[0].rev === 'string' ? matches[0].rev : '';",
  "const ok = matches.length === 1 && /^[0-9a-f]{9,255}$/.test(currentRevision)",
  "  && /^[0-9a-f]{9,255}$/.test(String(request.revision || '')) && currentRevision !== request.revision",
  "  && activePath === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json';",
  "return [{ json:{ ...request, continue_operation:ok, updated_revision:ok ? currentRevision : '', status:ok ? 'move_ready' : 'failed',",
  "  reply_text:ok ? '' : '備忘錄在封存前又被更新，沒有移動檔案。' } }];"
]);

const deleteMoveCheckCode = code([
  "const response = $json && typeof $json === 'object' && !Array.isArray($json) ? $json : {};",
  "const request = $('Memo Delete Pre Move Guard').first().json || {};",
  "const statusCode = Number(response.statusCode || 0);",
  "const memoId = String(request.memo_id || '');",
  "const activePath = String(request.active_path || '');",
  "const archivePath = String(request.archive_path || '');",
  "const revision = String(request.updated_revision || '');",
  "const expected = request.expected_json && typeof request.expected_json === 'object' && !Array.isArray(request.expected_json) ? request.expected_json : null;",
  "const safeRequest = /^memo-[a-f0-9]{64}$/.test(memoId) && /^[0-9a-f]{9,255}$/.test(revision)",
  "  && activePath === '/菲比工作總倉庫/00_INBOX_臨時丟進來/' + memoId + '.json'",
  "  && archivePath === '/菲比工作總倉庫/99_ARCHIVE_封存/' + memoId + '.json'",
  "  && expected && expected.memo_id === memoId && expected.type === 'memo' && expected.status === 'archived' && expected.source === 'line';",
  "const accepted = statusCode >= 200 && statusCode < 300 && Boolean(safeRequest);",
  "return [{ json:{ ...request, continue_operation:accepted, moved_revision:accepted ? revision : '',",
  "  status:accepted ? 'move_accepted_terminal_verification_pending' : (statusCode === 409 ? 'conflict' : 'failed'),",
  "  reply_text:accepted ? '' : (statusCode === 409 ? '封存位置已有同名備忘錄，沒有覆蓋或移動。' : '封存結果不明，沒有回報成功。') } }];"
]);

const deleteArchiveMetadataCheckCode = code([
  "const request = $('Memo Delete Active Absence Check').first().json || {};",
  "const entries = $input.all().map((item) => item && item.json && typeof item.json === 'object' && !Array.isArray(item.json) ? item.json : {});",
  "const memoId = String(request.memo_id || '');",
  "const archivePath = String(request.archive_path || '');",
  "const matches = entries.filter((entry) => {",
  "  const candidatePath = typeof entry.pathLower === 'string' ? entry.pathLower : (typeof entry.pathDisplay === 'string' ? entry.pathDisplay : '');",
  "  return entry.type === 'file' && !Object.prototype.hasOwnProperty.call(entry, 'error')",
  "    && String(entry.name || '') === memoId + '.json' && candidatePath.toLowerCase() === archivePath.toLowerCase();",
  "});",
  "const archiveRevision = matches.length === 1 && typeof matches[0].rev === 'string' ? matches[0].rev : '';",
  "const ok = matches.length === 1 && /^[0-9a-f]{9,255}$/.test(archiveRevision)",
  "  && /^[0-9a-f]{9,255}$/.test(String(request.updated_revision || ''))",
  "  && archivePath === '/菲比工作總倉庫/99_ARCHIVE_封存/' + memoId + '.json';",
  "return [{ json:{ ...request, continue_operation:ok, archive_revision:ok ? archiveRevision : '',",
  "  status:ok ? 'archive_metadata_verified' : 'failed', reply_text:ok ? '' : '封存檔版本無法確認，沒有回報成功。' } }];"
]);

const verifyReadbackCode = (checkNode, operation, archived) => code([
  "const input = $json || {};",
  "const request = $('" + checkNode + "').first().json || {};",
  "const memo = input.memo;",
  "const keys = " + (archived
    ? "['schema','memo_id','type','content','status','created_at','updated_at','source','archived_at'];"
    : "['schema','memo_id','type','content','status','created_at','updated_at','source'];"),
  "const expected = request.expected_json || {};",
  "const verified = memo && typeof memo === 'object' && !Array.isArray(memo)",
  "  && Object.keys(memo).sort().join('|') === keys.slice().sort().join('|')",
  "  && keys.every((key) => memo[key] === expected[key]);",
  "return [{ json:{ intent:'" + operation + "', operation:'" + operation + "', memo_id:request.memo_id || '', callback_url:request.callback_url || '',",
  "  task_id:request.task_id || '', request_id:request.request_id || '', status:verified ? 'completed' : 'readback_failed',",
  "  reply_text:verified ? '" + (operation === 'memo_modify' ? '已經幫妳更新這筆備忘錄。' : '已經幫妳封存這筆備忘錄。') + "' : '" + (archived ? '封存結果無法確認，沒有回報成功。' : '修改結果無法確認，沒有回報成功。') + "' } }];"
]);

const terminalizeCode = (sourceNode, operation, fallback) => code([
  "const input = $json || $('" + sourceNode + "').first().json || {};",
  "return [{ json:{ intent:'" + operation + "', operation:'" + operation + "', memo_id:String(input.memo_id || ''),",
  "  callback_url:String(input.callback_url || ''), task_id:String(input.task_id || ''), request_id:String(input.request_id || ''),",
  "  status:['completed','failed','readback_failed','conflict'].includes(String(input.status || '')) ? String(input.status) : 'failed',",
  "  reply_text:String(input.reply_text || '" + fallback + "') } }];"
]);

const nodes = [];

nodes.push(routeNode('Memo Search Route','pline-v3-memo-search-route','memo_search',[-650,-620]));
nodes.push(routeNode('Memo Modify Route','pline-v3-memo-modify-route','memo_modify',[-430,-520]));
nodes.push(routeNode('Memo Delete Route','pline-v3-memo-delete-route','memo_delete',[-210,-420]));

nodes.push(codeNode('Memo Search Validate','pline-v3-memo-search-validate',validateCode,[-430,-760]));
nodes.push(boolRouteNode('Memo Search Valid Route','pline-v3-memo-search-valid-route','continue_operation',[-210,-760]));
nodes.push(nativeDropbox('Dropbox Search List Active','pline-v3-dropbox-search-list',{
  resource:'folder', operation:'list', path:'/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll:false, limit:501,
  filters:{ include_deleted:false, include_has_explicit_shared_members:false, include_mounted_folders:true, include_non_downloadable_files:false, recursive:false }
},[20,-880],{ alwaysOutputData:true, onError:'continueRegularOutput' }));
nodes.push(codeNode('Memo Search Candidate Paths','pline-v3-memo-search-candidates',searchCandidateCode,[240,-880],'runOnceForAllItems'));
nodes.push(boolRouteNode('Memo Search Candidate Route','pline-v3-memo-search-candidate-route','candidate',[460,-880]));
nodes.push(nativeDropbox('Dropbox Search Download','pline-v3-dropbox-search-download',{
  resource:'file', operation:'download', path:'={{ $json.path }}', binaryPropertyName:'data'
},[680,-960],{ onError:'continueRegularOutput' }));
nodes.push(extractJson('Memo Search Extract JSON','pline-v3-memo-search-extract',[900,-960]));
nodes.push(codeNode('Memo Search Aggregate','pline-v3-memo-search-aggregate',searchAggregateCode,[1120,-880],'runOnceForAllItems'));
nodes.push(codeNode('Memo Search Invalid Result','pline-v3-memo-search-invalid',terminalizeCode('Memo Search Validate','memo_search','備忘錄搜尋條件不完整，請再試一次。'),[20,-660]));

nodes.push(codeNode('Memo Modify Validate','pline-v3-memo-modify-validate',validateCode,[-210,-280]));
nodes.push(boolRouteNode('Memo Modify Valid Route','pline-v3-memo-modify-valid-route','continue_operation',[20,-280]));
nodes.push(nativeDropbox('Dropbox Modify Metadata','pline-v3-dropbox-modify-metadata',{
  resource:'folder', operation:'list', path:'/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll:true,
  filters:{ include_deleted:false, include_has_explicit_shared_members:false, include_mounted_folders:true, include_non_downloadable_files:false, recursive:false }
},[240,-400],{ alwaysOutputData:true, onError:'continueRegularOutput' }));
nodes.push(codeNode('Memo Modify Metadata Check','pline-v3-memo-modify-metadata-check',modifyMetadataCheckCode,[460,-400],'runOnceForAllItems'));
nodes.push(boolRouteNode('Memo Modify Metadata Route','pline-v3-memo-modify-metadata-route','continue_operation',[680,-400]));
nodes.push(nativeDropbox('Dropbox Modify Download','pline-v3-dropbox-modify-download',{
  resource:'file', operation:'download', path:"={{ $('Memo Modify Validate').first().json.active_path }}", binaryPropertyName:'data'
},[900,-520],{ onError:'continueRegularOutput' }));
nodes.push(extractJson('Memo Modify Extract JSON','pline-v3-memo-modify-extract',[1120,-520]));
nodes.push(codeNode('Memo Modify Prepare','pline-v3-memo-modify-prepare',activeMemoPrepareCode('memo_modify'),[1340,-520]));
nodes.push(boolRouteNode('Memo Modify Prepare Route','pline-v3-memo-modify-prepare-route','continue_operation',[1560,-520]));
nodes.push(dropboxHttp('Dropbox Modify Conditional Update','pline-v3-dropbox-modify-update','https://content.dropboxapi.com/2/files/upload',
  "={{ $('Memo Modify Prepare').first().json.expected_json_text }}",[1780,-640],'application/octet-stream'));
nodes[nodes.length - 1].parameters.headerParameters.parameters.push({
  name:'Dropbox-API-Arg',
  value:"={{ JSON.stringify({ path:$json.path, mode:{ '.tag':'update', update:$json.rev }, autorename:false, mute:false, strict_conflict:true }).split('').map(c => c.charCodeAt(0) > 126 ? String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4,'0') : c).join('') }}"
});
nodes.push(codeNode('Memo Modify Update Check','pline-v3-memo-modify-update-check',modifyUpdateCheckCode,[2000,-640]));
nodes.push(boolRouteNode('Memo Modify Update Route','pline-v3-memo-modify-update-route','continue_operation',[2220,-640]));
nodes.push(nativeDropbox('Dropbox Modify Readback','pline-v3-dropbox-modify-readback',{
  resource:'file', operation:'download', path:"={{ $('Memo Modify Validate').first().json.active_path }}", binaryPropertyName:'data'
},[2440,-760],{ onError:'continueRegularOutput' }));
nodes.push(extractJson('Memo Modify Readback Extract','pline-v3-memo-modify-readback-extract',[2660,-760]));
nodes.push(codeNode('Memo Modify Verify Readback','pline-v3-memo-modify-verify',verifyReadbackCode('Memo Modify Update Check','memo_modify',false),[2880,-760]));
nodes.push(codeNode('Memo Modify Failure Result','pline-v3-memo-modify-failure',terminalizeCode('Memo Modify Validate','memo_modify','備忘錄目前無法安全完成修改。'),[2440,-480]));

nodes.push(codeNode('Memo Delete Validate','pline-v3-memo-delete-validate',validateCode,[20,-40]));
nodes.push(boolRouteNode('Memo Delete Valid Route','pline-v3-memo-delete-valid-route','continue_operation',[240,-40]));
nodes.push(nativeDropbox('Dropbox Delete Metadata','pline-v3-dropbox-delete-metadata',{
  resource:'folder', operation:'list', path:'/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll:true,
  filters:{}
},[460,-160],{ alwaysOutputData:true, onError:'continueRegularOutput' }));
nodes.push(codeNode('Memo Delete Metadata Check','pline-v3-memo-delete-metadata-check',deleteMetadataCheckCode,[680,-160]));
nodes.push(boolRouteNode('Memo Delete Metadata Route','pline-v3-memo-delete-metadata-route','continue_operation',[900,-160]));
nodes.push(nativeDropbox('Dropbox Delete Download','pline-v3-dropbox-delete-download',{
  resource:'file', operation:'download', path:"={{ $('Memo Delete Validate').first().json.active_path }}", binaryPropertyName:'data'
},[1120,-280],{ onError:'continueRegularOutput' }));
nodes.push(extractJson('Memo Delete Extract JSON','pline-v3-memo-delete-extract',[1340,-280]));
nodes.push(codeNode('Memo Delete Prepare Archive','pline-v3-memo-delete-prepare',activeMemoPrepareCode('memo_delete'),[1560,-280]));
nodes.push(boolRouteNode('Memo Delete Prepare Route','pline-v3-memo-delete-prepare-route','continue_operation',[1780,-280]));
nodes.push(dropboxHttp('Dropbox Delete Conditional Archive State','pline-v3-dropbox-delete-update','https://content.dropboxapi.com/2/files/upload',
  "={{ $('Memo Delete Prepare Archive').first().json.expected_json_text }}",[2000,-400],'application/octet-stream'));
nodes[nodes.length - 1].parameters.headerParameters.parameters.push({
  name:'Dropbox-API-Arg',
  value:"={{ JSON.stringify({ path:$json.active_path, mode:{ '.tag':'update', update:$json.revision }, autorename:false, mute:false, strict_conflict:true }).split('').map(c => c.charCodeAt(0) > 126 ? String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4,'0') : c).join('') }}"
});
nodes.push(codeNode('Memo Delete Update Check','pline-v3-memo-delete-update-check',deleteUpdateCheckCode,[2220,-400]));
nodes.push(boolRouteNode('Memo Delete Update Route','pline-v3-memo-delete-update-route','continue_operation',[2440,-400]));
nodes.push(nativeDropbox('Dropbox Delete Pre Move Metadata','pline-v3-dropbox-delete-premove-metadata',{
  resource:'folder', operation:'list', path:'/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll:true,
  filters:{}
},[2660,-520],{ alwaysOutputData:true, onError:'continueRegularOutput' }));
nodes.push(codeNode('Memo Delete Pre Move Guard','pline-v3-memo-delete-premove-guard',deletePreMoveGuardCode,[2880,-520]));
nodes.push(boolRouteNode('Memo Delete Pre Move Route','pline-v3-memo-delete-premove-route','continue_operation',[3100,-520]));
nodes.push(dropboxHttp('Dropbox Delete Collision Safe Move','pline-v3-dropbox-delete-move','https://api.dropboxapi.com/2/files/move_v2',
  "={{ JSON.stringify({ from_path:$json.active_path, to_path:$json.archive_path, autorename:false, allow_ownership_transfer:false }) }}",[3320,-640]));
nodes.push(codeNode('Memo Delete Move Check','pline-v3-memo-delete-move-check',deleteMoveCheckCode,[3540,-640]));
nodes.push(boolRouteNode('Memo Delete Move Route','pline-v3-memo-delete-move-route','continue_operation',[3760,-640]));
nodes.push(dropboxHttp('Dropbox Delete Active Absence','pline-v3-dropbox-delete-active-absence','https://api.dropboxapi.com/2/files/get_metadata',
  "={{ JSON.stringify({ path:$json.active_path, include_deleted:false }) }}",[3980,-760]));
nodes.push(codeNode('Memo Delete Active Absence Check','pline-v3-memo-delete-active-absence-check',code([
  "const response=$json||{}; const request=$('Memo Delete Move Check').first().json||{};",
  "const absent=Number(response.statusCode||0)===409;",
  "return [{json:{...request,continue_operation:absent,status:absent?'active_absent':'failed',reply_text:absent?'':'封存後來源狀態不一致，沒有回報成功。'}}];"
]),[4200,-760]));
nodes.push(boolRouteNode('Memo Delete Active Absence Route','pline-v3-memo-delete-active-absence-route','continue_operation',[4420,-760]));
nodes.push(nativeDropbox('Dropbox Delete Archive Metadata','pline-v3-dropbox-delete-archive-metadata',{
  resource:'folder', operation:'list', path:'/菲比工作總倉庫/99_ARCHIVE_封存', returnAll:true,
  filters:{}
},[4640,-880],{ alwaysOutputData:true, onError:'continueRegularOutput' }));
nodes.push(codeNode('Memo Delete Archive Metadata Check','pline-v3-memo-delete-archive-metadata-check',deleteArchiveMetadataCheckCode,[4860,-880]));
nodes.push(boolRouteNode('Memo Delete Archive Metadata Route','pline-v3-memo-delete-archive-metadata-route','continue_operation',[5080,-880]));
nodes.push(nativeDropbox('Dropbox Delete Archive Readback','pline-v3-dropbox-delete-archive-readback',{
  resource:'file', operation:'download', path:"={{ $('Memo Delete Validate').first().json.archive_path }}", binaryPropertyName:'data'
},[5300,-1000],{ onError:'continueRegularOutput' }));
nodes.push(extractJson('Memo Delete Archive Extract','pline-v3-memo-delete-archive-extract',[5520,-1000]));
nodes.push(codeNode('Memo Delete Verify Readback','pline-v3-memo-delete-verify',verifyReadbackCode('Memo Delete Archive Metadata Check','memo_delete',true),[5740,-1000]));
nodes.push(codeNode('Memo Delete Failure Result','pline-v3-memo-delete-failure',terminalizeCode('Memo Delete Validate','memo_delete','備忘錄目前無法安全完成封存。'),[5300,-700]));

const finalizerPayloadCode = code([
  "const input=$json||{};",
  "const operation=String(input.operation||input.intent||'');",
  "const status=['completed','failed','readback_failed','conflict'].includes(String(input.status||''))?String(input.status):'failed';",
  "const safe=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/;",
  "const callbackUrl=String(input.callback_url||''); const taskId=String(input.task_id||''); const requestId=String(input.request_id||'');",
  "if (!['memo_search','memo_modify','memo_delete'].includes(operation) || callbackUrl!=='https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'",
  "  || !safe.test(taskId) || !safe.test(requestId)) throw new Error('invalid_safe_memo_crud_finalizer_contract');",
  "return [{json:{callback_url:callbackUrl,task_id:taskId,request_id:requestId,status,operation,memo_id:String(input.memo_id||''),reply_text:String(input.reply_text||'備忘錄操作尚未完成。')}}];"
]);
nodes.push(codeNode('Memo CRUD Finalizer Payload','pline-v3-memo-crud-finalizer-payload',finalizerPayloadCode,[5960,-500]));
nodes.push(withCredentials({
  parameters:{
    method:'POST', url:'={{ $json.callback_url }}', authentication:'genericCredentialType', genericAuthType:'httpHeaderAuth',
    sendHeaders:true, headerParameters:{parameters:[{name:'Content-Type',value:'application/json'}]},
    sendBody:true, contentType:'raw', rawContentType:'application/json',
    body:"={{ JSON.stringify({ task_id:$json.task_id, request_id:$json.request_id, status:$json.status, operation:$json.operation, memo_id:$json.memo_id, reply_text:$json.reply_text }) }}",
    options:{response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}
  },
  id:'pline-v3-memo-crud-finalizer-callback', name:'Memo CRUD Finalizer Callback', type:'n8n-nodes-base.httpRequest', typeVersion:4.2,
  position:[6180,-500], onError:'continueRegularOutput'
},callbackCredentials));
nodes.push(codeNode('Memo CRUD Callback Result','pline-v3-memo-crud-callback-result',code([
  "const response=$json||{}; const payload=$('Memo CRUD Finalizer Payload').first().json||{};",
  "const statusCode=Number(response.statusCode||0); const ok=statusCode>=200&&statusCode<300;",
  "return [{json:{ok,intent:payload.operation,status:ok?payload.status:'finalizer_failed',memo_id:payload.memo_id||'',callback_sent:ok,",
  "reply_text:ok?payload.reply_text:'備忘錄操作已完成處理，但回覆尚未確認。',reply_source:'deterministic'}}];"
]),[6400,-500]));

const replaceNames = new Set(nodes.map((node) => node.name));
workflow.nodes = workflow.nodes.filter((node) => !replaceNames.has(node.name));
workflow.nodes.push(...nodes);
for (const name of replaceNames) delete workflow.connections[name];

const connect = (from, yes, no) => {
  workflow.connections[from] = { main: no === undefined ? [[{node:yes,type:'main',index:0}]] : [
    [{node:yes,type:'main',index:0}],
    [{node:no,type:'main',index:0}]
  ] };
};

connect('Normalize Input','Memo Search Route');
connect('Memo Search Route','Memo Search Validate','Memo Modify Route');
connect('Memo Modify Route','Memo Modify Validate','Memo Delete Route');
connect('Memo Delete Route','Memo Delete Validate','Memo Create Route');

connect('Memo Search Validate','Memo Search Valid Route');
connect('Memo Search Valid Route','Dropbox Search List Active','Memo Search Invalid Result');
connect('Dropbox Search List Active','Memo Search Candidate Paths');
connect('Memo Search Candidate Paths','Memo Search Candidate Route');
connect('Memo Search Candidate Route','Dropbox Search Download','Memo Search Aggregate');
connect('Dropbox Search Download','Memo Search Extract JSON');
connect('Memo Search Extract JSON','Memo Search Aggregate');

connect('Memo Modify Validate','Memo Modify Valid Route');
connect('Memo Modify Valid Route','Dropbox Modify Metadata','Memo Modify Failure Result');
connect('Dropbox Modify Metadata','Memo Modify Metadata Check');
connect('Memo Modify Metadata Check','Memo Modify Metadata Route');
connect('Memo Modify Metadata Route','Dropbox Modify Download','Memo Modify Failure Result');
connect('Dropbox Modify Download','Memo Modify Extract JSON');
connect('Memo Modify Extract JSON','Memo Modify Prepare');
connect('Memo Modify Prepare','Memo Modify Prepare Route');
connect('Memo Modify Prepare Route','Dropbox Modify Conditional Update','Memo Modify Failure Result');
connect('Dropbox Modify Conditional Update','Memo Modify Update Check');
connect('Memo Modify Update Check','Memo Modify Update Route');
connect('Memo Modify Update Route','Dropbox Modify Readback','Memo Modify Failure Result');
connect('Dropbox Modify Readback','Memo Modify Readback Extract');
connect('Memo Modify Readback Extract','Memo Modify Verify Readback');

connect('Memo Delete Validate','Memo Delete Valid Route');
connect('Memo Delete Valid Route','Dropbox Delete Metadata','Memo Delete Failure Result');
connect('Dropbox Delete Metadata','Memo Delete Metadata Check');
connect('Memo Delete Metadata Check','Memo Delete Metadata Route');
connect('Memo Delete Metadata Route','Dropbox Delete Download','Memo Delete Failure Result');
connect('Dropbox Delete Download','Memo Delete Extract JSON');
connect('Memo Delete Extract JSON','Memo Delete Prepare Archive');
connect('Memo Delete Prepare Archive','Memo Delete Prepare Route');
connect('Memo Delete Prepare Route','Dropbox Delete Conditional Archive State','Memo Delete Failure Result');
connect('Dropbox Delete Conditional Archive State','Memo Delete Update Check');
connect('Memo Delete Update Check','Memo Delete Update Route');
connect('Memo Delete Update Route','Dropbox Delete Pre Move Metadata','Memo Delete Failure Result');
connect('Dropbox Delete Pre Move Metadata','Memo Delete Pre Move Guard');
connect('Memo Delete Pre Move Guard','Memo Delete Pre Move Route');
connect('Memo Delete Pre Move Route','Dropbox Delete Collision Safe Move','Memo Delete Failure Result');
connect('Dropbox Delete Collision Safe Move','Memo Delete Move Check');
connect('Memo Delete Move Check','Memo Delete Move Route');
connect('Memo Delete Move Route','Dropbox Delete Active Absence','Memo Delete Failure Result');
connect('Dropbox Delete Active Absence','Memo Delete Active Absence Check');
connect('Memo Delete Active Absence Check','Memo Delete Active Absence Route');
connect('Memo Delete Active Absence Route','Dropbox Delete Archive Metadata','Memo Delete Failure Result');
connect('Dropbox Delete Archive Metadata','Memo Delete Archive Metadata Check');
connect('Memo Delete Archive Metadata Check','Memo Delete Archive Metadata Route');
connect('Memo Delete Archive Metadata Route','Dropbox Delete Archive Readback','Memo Delete Failure Result');
connect('Dropbox Delete Archive Readback','Memo Delete Archive Extract');
connect('Memo Delete Archive Extract','Memo Delete Verify Readback');

for (const terminal of [
  'Memo Search Aggregate','Memo Search Invalid Result','Memo Modify Verify Readback','Memo Modify Failure Result',
  'Memo Delete Verify Readback','Memo Delete Failure Result'
]) connect(terminal,'Memo CRUD Finalizer Payload');
connect('Memo CRUD Finalizer Payload','Memo CRUD Finalizer Callback');
connect('Memo CRUD Finalizer Callback','Memo CRUD Callback Result');
connect('Memo CRUD Callback Result','Respond to Webhook');

workflow.workflow_version_name = 'Memo Search Modify Delete Workflow Implementation';
workflow.memo_crud_contract = {
  intents:['memo_search','memo_modify','memo_delete'],
  ai_agent_bypass:true,
  active_path:'/菲比工作總倉庫/00_INBOX_臨時丟進來',
  archive_path:'/菲比工作總倉庫/99_ARCHIVE_封存',
  memo_id_pattern:'^memo-[a-f0-9]{64}$',
  search:{read_only:true,first_level_only:true,candidate_cap:500,display_limit:10,sort:'updated_at_desc_then_memo_id_asc'},
  modify:{conditional_update:'update(rev)',autorename:false,strict_conflict:true,readback_required:true},
  delete:{permanent_delete:false,conditional_archive_state_update:true,pre_move_revision_guard:true,move_atomic:false,toctou:'metadata_to_move',archive_autorename:false,post_move_readback_required:true,ambiguity_never_success:true},
  callback_auth:'header_auth_credential_reference_required',
  callback_body_secret_absent:true,
  processing_push:false,
  credentials_exported:false
};

await writeFile(outputPath, JSON.stringify(workflow,null,2) + '\n');
