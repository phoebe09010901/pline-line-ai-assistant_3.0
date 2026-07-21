import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const outputPath = process.argv[3] || sourcePath;
const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));

const getNode = (name) => workflow.nodes.find((node) => node.name === name);
const required = [
  'Normalize Input', 'Memo Search Aggregate', 'Memo Delete Route', 'Memo Delete Validate',
  'Memo CRUD Finalizer Payload', 'Memo CRUD Finalizer Callback', 'Memo CRUD Callback Result',
  'Respond to Webhook',
];
for (const name of required) if (!getNode(name)) throw new Error(`required node missing: ${name}`);

const dropboxCredentials = workflow.nodes.find((node) => node.credentials?.dropboxOAuth2Api)?.credentials;
const headerCredentials = getNode('Memo CRUD Finalizer Callback')?.credentials;
if (!dropboxCredentials?.dropboxOAuth2Api || !headerCredentials?.httpHeaderAuth) {
  throw new Error('protected credential references missing');
}

const withCredentials = (node, credentials) => ({ ...node, credentials });
const code = (lines) => lines.join('\n');
const codeNode = (name, id, jsCode, position, mode) => ({
  parameters: mode ? { mode, jsCode } : { jsCode },
  id,
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
});
const boolRoute = (name, id, field, position) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: `${id}-condition`, leftValue: `={{ $json.${field} }}`, rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
  id,
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position,
});
const stringRoute = (name, id, field, value, position) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: `${id}-condition`, leftValue: `={{ $json.${field} }}`, rightValue: value,
        operator: { type: 'string', operation: 'equals' },
      }],
      combinator: 'and',
    },
    options: {},
  },
  id,
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position,
});
const nativeDropbox = (name, id, parameters, position, extra = {}) => withCredentials({
  parameters: { authentication: 'oAuth2', ...parameters },
  id,
  name,
  type: 'n8n-nodes-base.dropbox',
  typeVersion: 1,
  position,
  ...extra,
}, dropboxCredentials);
const dropboxHttp = (name, id, url, headers, body, position, contentType = 'application/json') => withCredentials({
  parameters: {
    method: 'POST',
    url,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'dropboxOAuth2Api',
    sendHeaders: true,
    headerParameters: { parameters: headers },
    sendBody: true,
    contentType: 'raw',
    rawContentType: contentType,
    body,
    options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } },
  },
  id,
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  onError: 'continueRegularOutput',
}, dropboxCredentials);
const extractJson = (name, id, position) => ({
  parameters: {
    operation: 'fromJson',
    binaryPropertyName: 'data',
    destinationKey: 'memo',
    options: { encoding: 'utf8', stripBOM: true, keepSource: 'json' },
  },
  id,
  name,
  type: 'n8n-nodes-base.extractFromFile',
  typeVersion: 1.1,
  position,
  onError: 'continueRegularOutput',
});

const normalize = getNode('Normalize Input');
const normalizeCode = normalize.parameters.jsCode;
const crudStart = normalizeCode.indexOf("if (['memo_search', 'memo_modify', 'memo_delete'].includes(rawIntent))");
const crudEnd = normalizeCode.indexOf("if (rawIntent === 'memo_create')", crudStart);
if (crudStart < 0 || crudEnd < 0) throw new Error('Memo CRUD Normalize block not found');
const normalizeBlock = code([
  "if (['memo_search', 'memo_modify', 'memo_delete'].includes(rawIntent)) {",
  "  const delivery = body.reply_delivery_reference && typeof body.reply_delivery_reference === 'object' ? body.reply_delivery_reference : {};",
  "  const memoIds = Array.isArray(body.memo_ids) ? body.memo_ids.map((value) => String(value || '').trim().toLowerCase()) : [];",
  "  return [{ json: {",
  "    intent: rawIntent,",
  "    safe_event_hash: String(body.safe_event_hash || '').trim().toLowerCase(),",
  "    received_at: String(body.received_at || '').trim(),",
  "    keyword: String(body.keyword || '').trim(),",
  "    list_all: body.list_all === true,",
  "    memo_id: String(body.memo_id || '').trim().toLowerCase(),",
  "    new_content: String(body.new_content || '').trim(),",
  "    delete_scope: String(body.delete_scope || ''),",
  "    selection_mode: String(body.selection_mode || ''),",
  "    selection_snapshot_version: String(body.selection_snapshot_version || '').trim().toLowerCase(),",
  "    memo_ids: memoIds,",
  "    reply_delivery_reference: {",
  "      callback_url: String(delivery.callback_url || ''),",
  "      task_id: String(delivery.task_id || ''),",
  "      request_id: String(delivery.request_id || '')",
  "    },",
  "    allowed_intents: ['memo_search', 'memo_modify', 'memo_delete', 'memo_create', 'idea_create', 'codex_task', 'clarify', 'unsupported']",
  "  } }];",
  "}",
  "",
]);
normalize.parameters.jsCode = normalizeCode.slice(0, crudStart) + normalizeBlock + normalizeCode.slice(crudEnd);

getNode('Memo Search Aggregate').parameters.jsCode = code([
  "const request = $('Memo Search Validate').first().json || {};",
  "const rawItems = $input.all();",
  "const sourceOverflow = rawItems.some((item) => item.json?.overflow === true);",
  "const keys = ['schema','memo_id','type','content','status','created_at','updated_at','source'];",
  "const validIso = (value) => /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(value || '')) && Number.isFinite(Date.parse(value));",
  "const matches = [];",
  "for (const item of rawItems) {",
  "  const memo = item.json?.memo; const name = String(item.json?.name || item.json?.candidate_name || '');",
  "  if (!memo || typeof memo !== 'object' || Array.isArray(memo)) continue;",
  "  if (Object.keys(memo).sort().join('|') !== keys.slice().sort().join('|')) continue;",
  "  if (memo.schema !== 'pline-memo/v1' || !/^memo-[a-f0-9]{64}$/.test(String(memo.memo_id || ''))",
  "    || name !== memo.memo_id + '.json' || memo.type !== 'memo' || memo.status !== 'active' || memo.source !== 'line'",
  "    || typeof memo.content !== 'string' || !memo.content.trim() || !validIso(memo.created_at) || !validIso(memo.updated_at)) continue;",
  "  if (!request.list_all && memo.memo_id !== request.keyword && !memo.content.includes(request.keyword)) continue;",
  "  matches.push(memo);",
  "}",
  "matches.sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.memo_id.localeCompare(b.memo_id));",
  "const selectionCandidates = matches.slice(0,10).map((memo,index) => {",
  "  const compact = memo.content.replace(/\\s+/g,' ').trim();",
  "  return { position:index+1, memo_id:memo.memo_id, summary:compact.length <= 80 ? compact : compact.slice(0,79) + '…' };",
  "});",
  "const replyText = sourceOverflow ? '備忘錄數量超過安全搜尋上限，請縮小關鍵字範圍。'",
  "  : matches.length === 0 ? '沒有找到符合的使用中備忘錄。' : '找到 ' + matches.length + ' 筆使用中備忘錄。';",
  "return [{ json:{ intent:'memo_search', operation:'memo_search', status:sourceOverflow ? 'failed' : 'completed', memo_id:'', memo_ids:[],",
  "  callback_url:request.callback_url, task_id:request.task_id, request_id:request.request_id, reply_text:replyText,",
  "  total:sourceOverflow ? 0 : matches.length, selection_candidates:sourceOverflow ? [] : selectionCandidates } }];",
]);

const batchRoute = stringRoute('Memo Batch Delete Route', 'pline-v3-memo-batch-delete-route', 'delete_scope', 'memo_search_selection_snapshot', [-10768, 3380]);
const batchValidateCode = code([
  "const input=$json||{}; const delivery=input.reply_delivery_reference&&typeof input.reply_delivery_reference==='object'?input.reply_delivery_reference:{};",
  "const memoIds=Array.isArray(input.memo_ids)?input.memo_ids.map((value)=>String(value||'')):[];",
  "const receivedAt=String(input.received_at||''); const safe=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/;",
  "const valid=input.intent==='memo_delete' && input.delete_scope==='memo_search_selection_snapshot'",
  "  && ['single','multiple','range','all'].includes(String(input.selection_mode||''))",
  "  && /^[a-f0-9]{64}$/.test(String(input.safe_event_hash||'')) && /^[a-f0-9]{64}$/.test(String(input.selection_snapshot_version||''))",
  "  && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(receivedAt) && Number.isFinite(Date.parse(receivedAt))",
  "  && memoIds.length>0 && memoIds.length<=10 && memoIds.every((memoId)=>/^memo-[a-f0-9]{64}$/.test(memoId))",
  "  && new Set(memoIds).size===memoIds.length",
  "  && String(delivery.callback_url||'')==='https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'",
  "  && safe.test(String(delivery.task_id||'')) && safe.test(String(delivery.request_id||''));",
  "return [{json:{valid,continue_operation:valid,intent:'memo_delete',operation:'memo_delete',delete_scope:String(input.delete_scope||''),",
  "  selection_mode:String(input.selection_mode||''),selection_snapshot_version:valid?String(input.selection_snapshot_version):'',",
  "  safe_event_hash:valid?String(input.safe_event_hash):'',received_at:valid?receivedAt:'',memo_ids:valid?memoIds:[],",
  "  callback_url:valid?String(delivery.callback_url):'',task_id:valid?String(delivery.task_id):'',request_id:valid?String(delivery.request_id):'',",
  "  status:valid?'validated':'failed',reply_text:valid?'':'無法確認要封存的備忘錄項目。'}}];",
]);
const batchValidate = codeNode('Memo Batch Delete Validate', 'pline-v3-memo-batch-delete-validate', batchValidateCode, [-10544, 3280]);
const batchValidRoute = boolRoute('Memo Batch Delete Valid Route', 'pline-v3-memo-batch-delete-valid-route', 'continue_operation', [-10320, 3280]);
const batchInvalidResult = codeNode('Memo Batch Delete Invalid Result', 'pline-v3-memo-batch-delete-invalid-result', code([
  "return [{json:{ok:false,intent:'memo_delete',status:'failed',callback_sent:false,memo_id:'',memo_ids:[],",
  "reply_text:'無法確認要封存的備忘錄項目。',reply_source:'deterministic'}}];",
]), [-10096, 3480]);
const batchExpand = codeNode('Memo Batch Delete Expand', 'pline-v3-memo-batch-delete-expand', code([
  "const request=$json||{}; if (!request.valid || !Array.isArray(request.memo_ids)) return [];",
  "return request.memo_ids.map((memoId,index)=>({json:{...request,memo_id:memoId,batch_index:index,batch_size:request.memo_ids.length,",
  "active_path:'/菲比工作總倉庫/00_INBOX_臨時丟進來/'+memoId+'.json',archive_path:'/菲比工作總倉庫/99_ARCHIVE_封存/'+memoId+'.json'}}));",
]), [-10096, 3160]);
const batchLoop = {
  parameters: { batchSize: 1, options: {} },
  id: 'pline-v3-memo-batch-delete-loop',
  name: 'Memo Batch Delete Loop',
  type: 'n8n-nodes-base.splitInBatches',
  typeVersion: 3,
  position: [-9872, 3160],
};

const activeMeta = nativeDropbox('Dropbox Batch Delete Active Metadata', 'pline-v3-dropbox-batch-delete-active-metadata', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll: true, filters: {},
}, [-9648, 3000], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const activeMetaCheck = codeNode('Memo Batch Delete Active Metadata Check', 'pline-v3-memo-batch-delete-active-metadata-check', code([
  "let request={}; try{request=$('Memo Batch Delete Loop').item.json||{};}catch(error){request={};}",
  "const entries=$input.all().map((item)=>item&&item.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{});",
  "const matches=entries.filter((entry)=>{const path=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===request.memo_id+'.json'&&path.toLowerCase()===String(request.active_path||'').toLowerCase();});",
  "const revision=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:'';",
  "return [{json:{...request,active_match_count:matches.length,active_revision:/^[0-9a-f]{9,255}$/.test(revision)?revision:''},pairedItem:0}];",
]), [-9424, 3000]);
const archiveInventory = nativeDropbox('Dropbox Batch Delete Archive Inventory', 'pline-v3-dropbox-batch-delete-archive-inventory', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/99_ARCHIVE_封存', returnAll: true, filters: {},
}, [-9200, 3000], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const inventoryDecision = codeNode('Memo Batch Delete Inventory Decision', 'pline-v3-memo-batch-delete-inventory-decision', code([
  "let request={}; try{request=$('Memo Batch Delete Active Metadata Check').item.json||{};}catch(error){request={};}",
  "const entries=$input.all().map((item)=>item&&item.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{});",
  "const matches=entries.filter((entry)=>{const path=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===request.memo_id+'.json'&&path.toLowerCase()===String(request.archive_path||'').toLowerCase();});",
  "const archiveRevision=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:'';",
  "let action='conflict'; let status='conflict';",
  "if(request.active_match_count===1&&/^[0-9a-f]{9,255}$/.test(String(request.active_revision||''))&&matches.length===0){action='archive';status='inventory_ready';}",
  "else if(request.active_match_count===0&&matches.length===1&&/^[0-9a-f]{9,255}$/.test(archiveRevision)){action='reentry_verify';status='reentry_readback_pending';}",
  "return [{json:{...request,item_action:action,revision:action==='archive'?request.active_revision:'',archive_revision:action==='reentry_verify'?archiveRevision:'',",
  "status,reply_text:action==='conflict'?'封存位置或來源狀態發生衝突，沒有覆蓋任何內容。':''},pairedItem:0}];",
]), [-8976, 3000]);
const actionRoute = stringRoute('Memo Batch Delete Archive Action Route', 'pline-v3-memo-batch-delete-archive-action-route', 'item_action', 'archive', [-8752, 3000]);
const reentryRoute = stringRoute('Memo Batch Delete Reentry Route', 'pline-v3-memo-batch-delete-reentry-route', 'item_action', 'reentry_verify', [-8528, 3200]);
const reentryDownload = nativeDropbox('Dropbox Batch Delete Reentry Readback', 'pline-v3-dropbox-batch-delete-reentry-readback', {
  operation: 'download', path: '={{ $json.archive_path }}', binaryPropertyName: 'data',
}, [-8304, 3100], { onError: 'continueRegularOutput' });
const reentryExtract = extractJson('Memo Batch Delete Reentry Extract', 'pline-v3-memo-batch-delete-reentry-extract', [-8080, 3100]);
const reentryVerify = codeNode('Memo Batch Delete Reentry Verify', 'pline-v3-memo-batch-delete-reentry-verify', code([
  "const input=$json||{}; let request={}; try{request=$('Memo Batch Delete Inventory Decision').item.json||{};}catch(error){request={};} const memo=input.memo;",
  "const keys=['schema','memo_id','type','content','status','created_at','updated_at','source','archived_at'];",
  "const iso=(v)=>/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(v||''))&&Number.isFinite(Date.parse(v));",
  "const exact=memo&&typeof memo==='object'&&!Array.isArray(memo)&&Object.keys(memo).sort().join('|')===keys.slice().sort().join('|');",
  "const verified=exact&&memo.schema==='pline-memo/v1'&&memo.memo_id===request.memo_id&&memo.type==='memo'&&memo.status==='archived'",
  "&&memo.source==='line'&&typeof memo.content==='string'&&memo.content.trim()&&iso(memo.created_at)",
  "&&memo.updated_at===request.received_at&&memo.archived_at===request.received_at&&/^[0-9a-f]{9,255}$/.test(String(request.archive_revision||''));",
  "return [{json:{...request,item_terminal:true,item_success:Boolean(verified),status:verified?'duplicate':'readback_failed',",
  "reply_text:verified?'':'封存結果無法確認，沒有回報成功。'},pairedItem:0}];",
]), [-7856, 3100]);

const activeDownload = nativeDropbox('Dropbox Batch Delete Active Download', 'pline-v3-dropbox-batch-delete-active-download', {
  operation: 'download', path: '={{ $json.active_path }}', binaryPropertyName: 'data',
}, [-8528, 2800], { onError: 'continueRegularOutput' });
const activeExtract = extractJson('Memo Batch Delete Active Extract', 'pline-v3-memo-batch-delete-active-extract', [-8304, 2800]);
const prepare = codeNode('Memo Batch Delete Prepare Archive', 'pline-v3-memo-batch-delete-prepare-archive', code([
  "const input=$json||{}; let request={}; try{request=$('Memo Batch Delete Inventory Decision').item.json||{};}catch(error){request={};} const memo=input.memo;",
  "const keys=['schema','memo_id','type','content','status','created_at','updated_at','source'];",
  "const iso=(v)=>/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(v||''))&&Number.isFinite(Date.parse(v));",
  "const exact=memo&&typeof memo==='object'&&!Array.isArray(memo)&&Object.keys(memo).sort().join('|')===keys.slice().sort().join('|');",
  "const valid=exact&&memo.schema==='pline-memo/v1'&&memo.memo_id===request.memo_id&&memo.type==='memo'&&memo.status==='active'&&memo.source==='line'",
  "&&typeof memo.content==='string'&&memo.content.trim()&&iso(memo.created_at)&&iso(memo.updated_at)&&/^[0-9a-f]{9,255}$/.test(String(request.revision||''));",
  "const expected=valid?{schema:memo.schema,memo_id:memo.memo_id,type:memo.type,content:memo.content,status:'archived',created_at:memo.created_at,updated_at:request.received_at,source:memo.source,archived_at:request.received_at}:null;",
  "return [{json:{...request,continue_operation:Boolean(valid),expected_json:expected,expected_json_text:expected?JSON.stringify(expected,null,2):'',",
  "status:valid?'prepared':'failed',reply_text:valid?'':'找不到可操作的使用中備忘錄。'},pairedItem:0}];",
]), [-8080, 2800]);
const prepareRoute = boolRoute('Memo Batch Delete Prepare Route', 'pline-v3-memo-batch-delete-prepare-route', 'continue_operation', [-7856, 2800]);
const conditionalUpdate = dropboxHttp(
  'Dropbox Batch Delete Conditional Archive State',
  'pline-v3-dropbox-batch-delete-conditional-archive-state',
  'https://content.dropboxapi.com/2/files/upload',
  [
    { name: 'Content-Type', value: 'application/octet-stream' },
    { name: 'Dropbox-API-Arg', value: "={{ JSON.stringify({ path:$json.active_path, mode:{ '.tag':'update', update:$json.revision }, autorename:false, mute:false, strict_conflict:true }).split('').map(c => c.charCodeAt(0) > 126 ? String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4,'0') : c).join('') }}" },
  ],
  "={{ $json.expected_json_text }}",
  [-7632, 2700],
  'application/octet-stream',
);
const updateCheck = codeNode('Memo Batch Delete Update Check', 'pline-v3-memo-batch-delete-update-check', code([
  "const response=$json&&typeof $json==='object'&&!Array.isArray($json)?$json:{}; let request={}; try{request=$('Memo Batch Delete Prepare Archive').item.json||{};}catch(error){request={};}",
  "const statusCode=Number(response.statusCode||0); const expected=request.expected_json&&typeof request.expected_json==='object'?request.expected_json:null;",
  "const safe=expected&&expected.memo_id===request.memo_id&&expected.status==='archived'&&expected.archived_at===request.received_at",
  "&&/^[0-9a-f]{9,255}$/.test(String(request.revision||''))&&request.active_path==='/菲比工作總倉庫/00_INBOX_臨時丟進來/'+request.memo_id+'.json';",
  "const accepted=statusCode>=200&&statusCode<300&&Boolean(safe);",
  "return [{json:{...request,continue_operation:accepted,status:accepted?'archive_state_update_accepted_metadata_pending':(statusCode===409?'conflict':'failed'),",
  "reply_text:accepted?'':(statusCode===409?'這筆備忘錄剛被更新，沒有覆蓋任何內容。':'備忘錄目前無法安全完成更新。')},pairedItem:0}];",
]), [-7408, 2700]);
const updateRoute = boolRoute('Memo Batch Delete Update Route', 'pline-v3-memo-batch-delete-update-route', 'continue_operation', [-7184, 2700]);
const preMoveMeta = nativeDropbox('Dropbox Batch Delete Pre Move Metadata', 'pline-v3-dropbox-batch-delete-pre-move-metadata', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll: true, filters: {},
}, [-6960, 2600], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const preMoveGuard = codeNode('Memo Batch Delete Pre Move Guard', 'pline-v3-memo-batch-delete-pre-move-guard', code([
  "let request={}; try{request=$('Memo Batch Delete Update Check').item.json||{};}catch(error){request={};}",
  "const entries=$input.all().map((item)=>item&&item.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{});",
  "const matches=entries.filter((entry)=>{const path=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===request.memo_id+'.json'&&path.toLowerCase()===request.active_path.toLowerCase();});",
  "const currentRevision=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:'';",
  "const ok=matches.length===1&&/^[0-9a-f]{9,255}$/.test(currentRevision)&&currentRevision!==request.revision;",
  "return [{json:{...request,continue_operation:ok,updated_revision:ok?currentRevision:'',status:ok?'move_ready':'failed',",
  "reply_text:ok?'':'備忘錄在封存前又被更新，沒有移動檔案。'},pairedItem:0}];",
]), [-6736, 2600]);
const preMoveRoute = boolRoute('Memo Batch Delete Pre Move Route', 'pline-v3-memo-batch-delete-pre-move-route', 'continue_operation', [-6512, 2600]);
const move = dropboxHttp(
  'Dropbox Batch Delete Collision Safe Move',
  'pline-v3-dropbox-batch-delete-collision-safe-move',
  'https://api.dropboxapi.com/2/files/move_v2',
  [{ name: 'Content-Type', value: 'application/json' }],
  "={{ JSON.stringify({ from_path:$json.active_path, to_path:$json.archive_path, autorename:false, allow_ownership_transfer:false }) }}",
  [-6288, 2500],
);
const moveCheck = codeNode('Memo Batch Delete Move Check', 'pline-v3-memo-batch-delete-move-check', code([
  "const response=$json&&typeof $json==='object'&&!Array.isArray($json)?$json:{}; let request={}; try{request=$('Memo Batch Delete Pre Move Guard').item.json||{};}catch(error){request={};}",
  "const statusCode=Number(response.statusCode||0); const safe=/^[0-9a-f]{9,255}$/.test(String(request.updated_revision||''))",
  "&&request.active_path==='/菲比工作總倉庫/00_INBOX_臨時丟進來/'+request.memo_id+'.json'",
  "&&request.archive_path==='/菲比工作總倉庫/99_ARCHIVE_封存/'+request.memo_id+'.json';",
  "const accepted=statusCode>=200&&statusCode<300&&safe;",
  "return [{json:{...request,continue_operation:accepted,status:accepted?'move_accepted_terminal_verification_pending':(statusCode===409?'conflict':'failed'),",
  "reply_text:accepted?'':(statusCode===409?'封存位置已有同名備忘錄，沒有覆蓋或移動。':'封存結果不明，沒有回報成功。')},pairedItem:0}];",
]), [-6064, 2500]);
const moveRoute = boolRoute('Memo Batch Delete Move Route', 'pline-v3-memo-batch-delete-move-route', 'continue_operation', [-5840, 2500]);
const activeAbsence = dropboxHttp(
  'Dropbox Batch Delete Active Absence',
  'pline-v3-dropbox-batch-delete-active-absence',
  'https://api.dropboxapi.com/2/files/get_metadata',
  [{ name: 'Content-Type', value: 'application/json' }],
  "={{ JSON.stringify({ path:$json.active_path, include_deleted:false }) }}",
  [-5616, 2400],
);
const activeAbsenceCheck = codeNode('Memo Batch Delete Active Absence Check', 'pline-v3-memo-batch-delete-active-absence-check', code([
  "const response=$json||{}; let request={}; try{request=$('Memo Batch Delete Move Check').item.json||{};}catch(error){request={};} const absent=Number(response.statusCode||0)===409;",
  "return [{json:{...request,continue_operation:absent,status:absent?'active_absent':'failed',",
  "reply_text:absent?'':'封存後來源狀態不一致，沒有回報成功。'},pairedItem:0}];",
]), [-5392, 2400]);
const activeAbsenceRoute = boolRoute('Memo Batch Delete Active Absence Route', 'pline-v3-memo-batch-delete-active-absence-route', 'continue_operation', [-5168, 2400]);
const archiveMeta = nativeDropbox('Dropbox Batch Delete Archive Metadata', 'pline-v3-dropbox-batch-delete-archive-metadata', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/99_ARCHIVE_封存', returnAll: true, filters: {},
}, [-4944, 2300], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const archiveMetaCheck = codeNode('Memo Batch Delete Archive Metadata Check', 'pline-v3-memo-batch-delete-archive-metadata-check', code([
  "let request={}; try{request=$('Memo Batch Delete Active Absence Check').item.json||{};}catch(error){request={};}",
  "const entries=$input.all().map((item)=>item&&item.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{});",
  "const matches=entries.filter((entry)=>{const path=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===request.memo_id+'.json'&&path.toLowerCase()===request.archive_path.toLowerCase();});",
  "const revision=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:''; const ok=matches.length===1&&/^[0-9a-f]{9,255}$/.test(revision);",
  "return [{json:{...request,continue_operation:ok,archive_revision:ok?revision:'',status:ok?'archive_metadata_verified':'failed',",
  "reply_text:ok?'':'封存檔版本無法確認，沒有回報成功。'},pairedItem:0}];",
]), [-4720, 2300]);
const archiveMetaRoute = boolRoute('Memo Batch Delete Archive Metadata Route', 'pline-v3-memo-batch-delete-archive-metadata-route', 'continue_operation', [-4496, 2300]);
const archiveReadback = nativeDropbox('Dropbox Batch Delete Archive Readback', 'pline-v3-dropbox-batch-delete-archive-readback', {
  operation: 'download', path: '={{ $json.archive_path }}', binaryPropertyName: 'data',
}, [-4272, 2200], { onError: 'continueRegularOutput' });
const archiveExtract = extractJson('Memo Batch Delete Archive Extract', 'pline-v3-memo-batch-delete-archive-extract', [-4048, 2200]);
const archiveVerify = codeNode('Memo Batch Delete Verify Readback', 'pline-v3-memo-batch-delete-verify-readback', code([
  "const input=$json||{}; let request={}; try{request=$('Memo Batch Delete Archive Metadata Check').item.json||{};}catch(error){request={};} const memo=input.memo;",
  "const keys=['schema','memo_id','type','content','status','created_at','updated_at','source','archived_at']; const expected=request.expected_json||{};",
  "const verified=memo&&typeof memo==='object'&&!Array.isArray(memo)&&Object.keys(memo).sort().join('|')===keys.slice().sort().join('|')",
  "&&Object.keys(expected).sort().join('|')===keys.slice().sort().join('|')&&keys.every((key)=>memo[key]===expected[key]);",
  "return [{json:{...request,item_terminal:true,item_success:Boolean(verified),status:verified?'completed':'readback_failed',",
  "reply_text:verified?'':'封存結果無法確認，沒有回報成功。'},pairedItem:0}];",
]), [-3824, 2200]);

const itemFailure = codeNode('Memo Batch Delete Item Failure', 'pline-v3-memo-batch-delete-item-failure', code([
  "const input=$json||{}; const status=['conflict','readback_failed'].includes(String(input.status||''))?String(input.status):'failed';",
  "return [{json:{...input,item_terminal:true,item_success:false,status,reply_text:String(input.reply_text||'備忘錄目前無法安全完成封存。')},pairedItem:0}];",
]), [-3600, 2860]);
const batchAggregate = codeNode('Memo Batch Delete Aggregate', 'pline-v3-memo-batch-delete-aggregate', code([
  "const request=$('Memo Batch Delete Validate').first().json||{}; const items=$input.all().map((item)=>item.json||{}).sort((a,b)=>Number(a.batch_index)-Number(b.batch_index));",
  "const shape=request.valid&&items.length===request.memo_ids.length&&items.every((item,index)=>item.memo_id===request.memo_ids[index]&&Number(item.batch_index)===index);",
  "const completed=shape?items.filter((item)=>['completed','duplicate'].includes(String(item.status||''))).length:0; const failed=request.memo_ids.length-completed;",
  "const allCompleted=shape&&completed===request.memo_ids.length; const status=allCompleted?(items.every((item)=>item.status==='duplicate')?'duplicate':'completed')",
  ":items.some((item)=>item.status==='conflict')?'conflict':items.some((item)=>item.status==='readback_failed')?'readback_failed':'failed';",
  "return [{json:{intent:'memo_delete',operation:'memo_delete',status,memo_id:'',memo_ids:request.memo_ids,callback_url:request.callback_url,",
  "task_id:request.task_id,request_id:request.request_id,completed_count:completed,failed_count:failed,",
  "reply_text:allCompleted?'好，已幫妳封存 '+completed+' 筆備忘錄。':'這次已完成 '+completed+' 筆，另有 '+failed+' 筆未完成。'}}];",
]), [-3376, 3160]);

const newNodes = [
  batchRoute, batchValidate, batchValidRoute, batchInvalidResult, batchExpand, batchLoop,
  activeMeta, activeMetaCheck, archiveInventory, inventoryDecision, actionRoute, reentryRoute,
  reentryDownload, reentryExtract, reentryVerify, activeDownload, activeExtract, prepare, prepareRoute,
  conditionalUpdate, updateCheck, updateRoute, preMoveMeta, preMoveGuard, preMoveRoute, move,
  moveCheck, moveRoute, activeAbsence, activeAbsenceCheck, activeAbsenceRoute, archiveMeta,
  archiveMetaCheck, archiveMetaRoute, archiveReadback, archiveExtract, archiveVerify, itemFailure, batchAggregate,
];
const replaceNames = new Set(newNodes.map((node) => node.name));
workflow.nodes = workflow.nodes.filter((node) => !replaceNames.has(node.name));
workflow.nodes.push(...newNodes);
for (const name of replaceNames) delete workflow.connections[name];

const finalizerPayload = getNode('Memo CRUD Finalizer Payload');
finalizerPayload.parameters.jsCode = code([
  "const input=$json||{}; const operation=String(input.operation||input.intent||'');",
  "const status=['completed','duplicate','failed','readback_failed','conflict'].includes(String(input.status||''))?String(input.status):'failed';",
  "const safe=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/; const callbackUrl=String(input.callback_url||'');",
  "const taskId=String(input.task_id||''); const requestId=String(input.request_id||''); const memoId=String(input.memo_id||'');",
  "const memoIds=Array.isArray(input.memo_ids)?input.memo_ids.map((value)=>String(value||'')):[];",
  "const candidates=Array.isArray(input.selection_candidates)?input.selection_candidates.map((entry)=>({position:Number(entry?.position),memo_id:String(entry?.memo_id||''),summary:String(entry?.summary||'')})):[];",
  "const batch=operation==='memo_delete'&&memoIds.length>0; const search=operation==='memo_search';",
  "const batchValid=!batch||(memoId===''&&memoIds.length<=10&&memoIds.every((id)=>/^memo-[a-f0-9]{64}$/.test(id))&&new Set(memoIds).size===memoIds.length);",
  "const searchValid=!search||(memoId===''&&memoIds.length===0&&Number.isInteger(Number(input.total||0))&&Number(input.total||0)>=candidates.length",
  "&&candidates.length<=10&&candidates.every((entry,index)=>entry.position===index+1&&/^memo-[a-f0-9]{64}$/.test(entry.memo_id)&&entry.summary.length>0&&entry.summary.length<=80)",
  "&&new Set(candidates.map((entry)=>entry.memo_id)).size===candidates.length&&!String(input.reply_text||'').includes('memo-'));",
  "if(!['memo_search','memo_modify','memo_delete'].includes(operation)||callbackUrl!=='https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'",
  "||!safe.test(taskId)||!safe.test(requestId)||!batchValid||!searchValid) throw new Error('invalid_safe_memo_crud_finalizer_contract');",
  "return [{json:{callback_url:callbackUrl,task_id:taskId,request_id:requestId,status,operation,memo_id:memoId,memo_ids:memoIds,",
  "selection_candidates:candidates,total:search?Number(input.total||0):0,reply_text:String(input.reply_text||'備忘錄操作尚未完成。')}}];",
]);
const finalizerCallback = getNode('Memo CRUD Finalizer Callback');
finalizerCallback.parameters.body = "={{ JSON.stringify({ task_id:$json.task_id, request_id:$json.request_id, status:$json.status, operation:$json.operation, memo_id:$json.memo_id, memo_ids:$json.memo_ids, selection_candidates:$json.selection_candidates, total:$json.total, reply_text:$json.reply_text }) }}";
const callbackResult = getNode('Memo CRUD Callback Result');
callbackResult.parameters.jsCode = code([
  "const response=$json||{}; const payload=$('Memo CRUD Finalizer Payload').first().json||{}; const statusCode=Number(response.statusCode||0); const ok=statusCode>=200&&statusCode<300;",
  "return [{json:{ok,intent:payload.operation,status:ok?payload.status:'finalizer_failed',memo_id:payload.memo_id||'',memo_ids:payload.memo_ids||[],",
  "selection_candidates:payload.selection_candidates||[],total:Number(payload.total||0),callback_sent:ok,",
  "reply_text:ok?payload.reply_text:'備忘錄操作已完成處理，但回覆尚未確認。',reply_source:'deterministic'}}];",
]);

const edge = (node, index = 0) => ({ node, type: 'main', index });
const connect = (from, yes, no) => {
  workflow.connections[from] = no === undefined
    ? { main: [[edge(yes)]] }
    : { main: [[edge(yes)], [edge(no)]] };
};
workflow.connections['Memo Delete Route'] = { main: [[edge('Memo Batch Delete Route')], [edge('Memo Create Route')]] };
connect('Memo Batch Delete Route', 'Memo Batch Delete Validate', 'Memo Delete Validate');
connect('Memo Batch Delete Validate', 'Memo Batch Delete Valid Route');
connect('Memo Batch Delete Valid Route', 'Memo Batch Delete Expand', 'Memo Batch Delete Invalid Result');
connect('Memo Batch Delete Invalid Result', 'Respond to Webhook');
connect('Memo Batch Delete Expand', 'Memo Batch Delete Loop');
workflow.connections['Memo Batch Delete Loop'] = {
  main: [[edge('Memo Batch Delete Aggregate')], [edge('Dropbox Batch Delete Active Metadata')]],
};
connect('Dropbox Batch Delete Active Metadata', 'Memo Batch Delete Active Metadata Check');
connect('Memo Batch Delete Active Metadata Check', 'Dropbox Batch Delete Archive Inventory');
connect('Dropbox Batch Delete Archive Inventory', 'Memo Batch Delete Inventory Decision');
connect('Memo Batch Delete Inventory Decision', 'Memo Batch Delete Archive Action Route');
connect('Memo Batch Delete Archive Action Route', 'Dropbox Batch Delete Active Download', 'Memo Batch Delete Reentry Route');
connect('Memo Batch Delete Reentry Route', 'Dropbox Batch Delete Reentry Readback', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Reentry Readback', 'Memo Batch Delete Reentry Extract');
connect('Memo Batch Delete Reentry Extract', 'Memo Batch Delete Reentry Verify');
connect('Memo Batch Delete Reentry Verify', 'Memo Batch Delete Loop');
connect('Dropbox Batch Delete Active Download', 'Memo Batch Delete Active Extract');
connect('Memo Batch Delete Active Extract', 'Memo Batch Delete Prepare Archive');
connect('Memo Batch Delete Prepare Archive', 'Memo Batch Delete Prepare Route');
connect('Memo Batch Delete Prepare Route', 'Dropbox Batch Delete Conditional Archive State', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Conditional Archive State', 'Memo Batch Delete Update Check');
connect('Memo Batch Delete Update Check', 'Memo Batch Delete Update Route');
connect('Memo Batch Delete Update Route', 'Dropbox Batch Delete Pre Move Metadata', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Pre Move Metadata', 'Memo Batch Delete Pre Move Guard');
connect('Memo Batch Delete Pre Move Guard', 'Memo Batch Delete Pre Move Route');
connect('Memo Batch Delete Pre Move Route', 'Dropbox Batch Delete Collision Safe Move', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Collision Safe Move', 'Memo Batch Delete Move Check');
connect('Memo Batch Delete Move Check', 'Memo Batch Delete Move Route');
connect('Memo Batch Delete Move Route', 'Dropbox Batch Delete Active Absence', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Active Absence', 'Memo Batch Delete Active Absence Check');
connect('Memo Batch Delete Active Absence Check', 'Memo Batch Delete Active Absence Route');
connect('Memo Batch Delete Active Absence Route', 'Dropbox Batch Delete Archive Metadata', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Archive Metadata', 'Memo Batch Delete Archive Metadata Check');
connect('Memo Batch Delete Archive Metadata Check', 'Memo Batch Delete Archive Metadata Route');
connect('Memo Batch Delete Archive Metadata Route', 'Dropbox Batch Delete Archive Readback', 'Memo Batch Delete Item Failure');
connect('Dropbox Batch Delete Archive Readback', 'Memo Batch Delete Archive Extract');
connect('Memo Batch Delete Archive Extract', 'Memo Batch Delete Verify Readback');
connect('Memo Batch Delete Verify Readback', 'Memo Batch Delete Loop');
connect('Memo Batch Delete Item Failure', 'Memo Batch Delete Loop');
connect('Memo Batch Delete Aggregate', 'Memo CRUD Finalizer Payload');

workflow.workflow_version_name = 'Memo Search Selection Candidates and Batch Archive';
workflow.memo_search_selection_batch_archive_contract = {
  search_selection_candidates: { ordered: true, max: 10, visible_reply_contains_memo_id: false },
  delete_scope: 'memo_search_selection_snapshot',
  selection_modes: ['single', 'multiple', 'range', 'all'],
  batch_limit: 10,
  input_uses_resolved_memo_ids_only: true,
  sequential_loop_batch_size: 1,
  revision_aware: true,
  archive_overwrite: false,
  archive_autorename: false,
  permanent_delete: false,
  active_absence_required: true,
  archive_readback_required: true,
  partial_failure_never_success: true,
  same_event_reentry: 'archived_at_and_updated_at_equal_received_at_with_exact_schema',
  callback_once_after_all_items_terminal: true,
  credentials_exported: false,
};

delete workflow.versionId;
delete workflow.activeVersionId;
delete workflow.pinData;
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
