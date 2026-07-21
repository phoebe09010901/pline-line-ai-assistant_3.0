import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const outputPath = process.argv[3] || sourcePath;
const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));
const node = (name) => workflow.nodes.find((entry) => entry.name === name);

for (const name of [
  'Normalize Input', 'Memo Search Route', 'Memo Search Aggregate', 'Memo Batch Delete Validate',
  'Memo CRUD Finalizer Payload', 'Memo CRUD Finalizer Callback', 'Memo CRUD Callback Result',
]) if (!node(name)) throw new Error(`required node missing: ${name}`);

const dropboxCredentials = workflow.nodes.find((entry) => entry.credentials?.dropboxOAuth2Api)?.credentials;
if (!dropboxCredentials?.dropboxOAuth2Api) throw new Error('Dropbox OAuth reference missing');

const normalize = node('Normalize Input');
const pageNormalize = `if (rawIntent === 'memo_search_page') {
  const delivery = body.reply_delivery_reference && typeof body.reply_delivery_reference === 'object' ? body.reply_delivery_reference : {};
  const memoIds = Array.isArray(body.memo_ids) ? body.memo_ids.map((value) => String(value || '').trim().toLowerCase()) : [];
  return [{ json: {
    intent: 'memo_search_page',
    safe_event_hash: String(body.safe_event_hash || '').trim().toLowerCase(),
    received_at: String(body.received_at || '').trim(),
    page_scope: String(body.page_scope || ''),
    selection_snapshot_version: String(body.selection_snapshot_version || '').trim().toLowerCase(),
    page_number: Number(body.page_number),
    page_count: Number(body.page_count),
    total: Number(body.total),
    global_start: Number(body.global_start),
    memo_ids: memoIds,
    reply_delivery_reference: {
      callback_url: String(delivery.callback_url || ''),
      task_id: String(delivery.task_id || ''),
      request_id: String(delivery.request_id || '')
    },
    allowed_intents: ['memo_search_page', 'memo_search', 'memo_modify', 'memo_delete', 'memo_create', 'idea_create', 'codex_task', 'clarify', 'unsupported']
  } }];
}
`;
if (!normalize.parameters.jsCode.includes("rawIntent === 'memo_search_page'")) {
  const marker = "if (['memo_search', 'memo_modify', 'memo_delete'].includes(rawIntent))";
  const index = normalize.parameters.jsCode.indexOf(marker);
  if (index < 0) throw new Error('Normalize Memo CRUD block missing');
  normalize.parameters.jsCode = `${normalize.parameters.jsCode.slice(0, index)}${pageNormalize}${normalize.parameters.jsCode.slice(index)}`;
}

node('Memo Search Aggregate').parameters.jsCode = `const request = $('Memo Search Validate').first().json || {};
const rawItems = $input.all();
const sourceOverflow = rawItems.some((item) => item.json?.overflow === true);
const keys = ['schema','memo_id','type','content','status','created_at','updated_at','source'];
const validIso = (value) => /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(value || '')) && Number.isFinite(Date.parse(value));
const matches = [];
for (const item of rawItems) {
  const memo = item.json?.memo; const name = String(item.json?.name || item.json?.candidate_name || '');
  if (!memo || typeof memo !== 'object' || Array.isArray(memo)) continue;
  if (Object.keys(memo).sort().join('|') !== keys.slice().sort().join('|')) continue;
  if (memo.schema !== 'pline-memo/v1' || !/^memo-[a-f0-9]{64}$/.test(String(memo.memo_id || ''))
    || name !== memo.memo_id + '.json' || memo.type !== 'memo' || memo.status !== 'active' || memo.source !== 'line'
    || typeof memo.content !== 'string' || !memo.content.trim() || !validIso(memo.created_at) || !validIso(memo.updated_at)) continue;
  if (!request.list_all && memo.memo_id !== request.keyword && !memo.content.includes(request.keyword)) continue;
  matches.push(memo);
}
matches.sort((a,b) => b.updated_at.localeCompare(a.updated_at) || a.memo_id.localeCompare(b.memo_id));
const overflow = sourceOverflow || matches.length > 100;
const selectionCandidates = overflow ? [] : matches.map((memo,index) => ({ position:index+1, memo_id:memo.memo_id }));
const pageCandidates = overflow ? [] : matches.slice(0,10).map((memo,index) => {
  const compact = memo.content.replace(/\\s+/g,' ').trim();
  return { position:index+1, memo_id:memo.memo_id, summary:compact.length <= 80 ? compact : compact.slice(0,79) + '…' };
});
const total = matches.length; const pageCount = total === 0 || overflow ? 0 : Math.ceil(total / 10); const page = total === 0 || overflow ? 0 : 1;
const replyText = overflow ? '備忘錄數量超過安全搜尋上限，請縮小關鍵字範圍。'
  : total === 0 ? '沒有找到符合的使用中備忘錄。'
    : '找到 ' + total + ' 筆使用中備忘錄，第 1/' + pageCount + ' 頁。' + pageCandidates.map((entry) => '\\n' + entry.position + '. ' + entry.summary).join('');
return [{ json:{ intent:'memo_search', operation:'memo_search', status:overflow ? 'failed' : 'completed', memo_id:'', memo_ids:[],
  callback_url:request.callback_url, task_id:request.task_id, request_id:request.request_id, reply_text:replyText,
  total, page, page_count:pageCount, selection_candidates:selectionCandidates, page_candidates:pageCandidates } }];`;

node('Memo Batch Delete Validate').parameters.jsCode = node('Memo Batch Delete Validate').parameters.jsCode
  .replace('memoIds.length<=10', 'memoIds.length<=1');

const codeNode = (name, id, jsCode, position, mode) => ({
  parameters: mode ? { mode, jsCode } : { jsCode },
  id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position,
});
const routeNode = (name, id, field, value, position, type = 'string') => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: `${id}-condition`, leftValue: `={{ $json.${field} }}`, rightValue: value,
        operator: type === 'boolean'
          ? { type: 'boolean', operation: 'true', singleValue: true }
          : { type: 'string', operation: 'equals' },
      }], combinator: 'and',
    }, options: {},
  },
  id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
});

const validateCode = `const input=$json||{}; const delivery=input.reply_delivery_reference&&typeof input.reply_delivery_reference==='object'?input.reply_delivery_reference:{};
const memoIds=Array.isArray(input.memo_ids)?input.memo_ids.map((value)=>String(value||'')):[]; const page=Number(input.page_number); const pageCount=Number(input.page_count);
const total=Number(input.total); const globalStart=Number(input.global_start); const receivedAt=String(input.received_at||'');
const safe=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/; const expectedPageCount=Number.isSafeInteger(total)&&total>0?Math.ceil(total/10):0;
const expectedLength=Number.isSafeInteger(globalStart)&&Number.isSafeInteger(total)?Math.min(10,Math.max(0,total-globalStart+1)):0;
const identityValid=input.intent==='memo_search_page'&&input.page_scope==='memo_search_selection_snapshot'
  &&/^[a-f0-9]{64}$/.test(String(input.safe_event_hash||''))&&/^[a-f0-9]{64}$/.test(String(input.selection_snapshot_version||''))
  &&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(receivedAt)&&Number.isFinite(Date.parse(receivedAt))
  &&String(delivery.callback_url||'')==='https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'
  &&safe.test(String(delivery.task_id||''))&&safe.test(String(delivery.request_id||''));
const shapeValid=Number.isSafeInteger(total)&&total>0&&total<=100&&Number.isSafeInteger(page)&&page>=1&&page<=pageCount
  &&pageCount===expectedPageCount&&Number.isSafeInteger(globalStart)&&globalStart===((page-1)*10)+1
  &&memoIds.length===expectedLength&&memoIds.length>0&&memoIds.length<=10&&memoIds.every((id)=>/^memo-[a-f0-9]{64}$/.test(id))&&new Set(memoIds).size===memoIds.length;
const valid=identityValid&&shapeValid;
return [{json:{valid,continue_operation:valid,intent:'memo_search_page',operation:'memo_search_page',page_scope:String(input.page_scope||''),
selection_snapshot_version:identityValid?String(input.selection_snapshot_version):'',safe_event_hash:identityValid?String(input.safe_event_hash):'',received_at:identityValid?receivedAt:'',
page:valid?page:0,page_count:valid?pageCount:0,total:valid?total:0,global_start:valid?globalStart:0,memo_ids:shapeValid?memoIds:[],
callback_url:identityValid?String(delivery.callback_url):'',task_id:identityValid?String(delivery.task_id):'',request_id:identityValid?String(delivery.request_id):'',
status:valid?'validated':'failed',reply_text:valid?'':'這一頁的備忘錄內容無法確認，請重新搜尋。'}}];`;

const invalidCode = `const input=$json||{}; return [{json:{intent:'memo_search_page',operation:'memo_search_page',status:'failed',memo_id:'',memo_ids:Array.isArray(input.memo_ids)?input.memo_ids:[],
selection_candidates:[],page_candidates:[],total:0,page:0,page_count:0,callback_url:String(input.callback_url||''),task_id:String(input.task_id||''),request_id:String(input.request_id||''),
reply_text:'這一頁的備忘錄內容無法確認，請重新搜尋。'}}];`;

const expandCode = `const request=$json||{}; if(!request.valid) return []; return request.memo_ids.map((memoId,index)=>({json:{...request,memo_id:memoId,page_index:index,
position:request.global_start+index,active_path:'/菲比工作總倉庫/00_INBOX_臨時丟進來/'+memoId+'.json'},pairedItem:0}));`;

const aggregateCode = `const request=$('Memo Search Page Validate').first().json||{}; const items=$input.all().map((item)=>item.json||{});
const keys=['schema','memo_id','type','content','status','created_at','updated_at','source'];
const validIso=(value)=>/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(value||''))&&Number.isFinite(Date.parse(value));
const valid=request.valid===true&&items.length===request.memo_ids.length&&items.every((item,index)=>{const memo=item.memo;
return item.memo_id===request.memo_ids[index]&&Number(item.position)===request.global_start+index&&memo&&typeof memo==='object'&&!Array.isArray(memo)
&&Object.keys(memo).sort().join('|')===keys.slice().sort().join('|')&&memo.schema==='pline-memo/v1'&&memo.memo_id===request.memo_ids[index]
&&memo.type==='memo'&&memo.status==='active'&&memo.source==='line'&&typeof memo.content==='string'&&Boolean(memo.content.trim())
&&validIso(memo.created_at)&&validIso(memo.updated_at);});
const pageCandidates=valid?items.map((item,index)=>{const compact=String(item.memo.content||'').replace(/\\s+/g,' ').trim();
return {position:request.global_start+index,memo_id:request.memo_ids[index],summary:compact.length<=80?compact:compact.slice(0,79)+'…'};}):[];
const replyText=valid?'找到 '+request.total+' 筆使用中備忘錄，第 '+request.page+'/'+request.page_count+' 頁。'+pageCandidates.map((entry)=>'\\n'+entry.position+'. '+entry.summary).join('')
:'這一頁的備忘錄內容已變更，請重新搜尋。';
return [{json:{intent:'memo_search_page',operation:'memo_search_page',status:valid?'completed':'failed',memo_id:'',memo_ids:request.memo_ids||[],selection_candidates:[],page_candidates:pageCandidates,
total:valid?request.total:0,page:valid?request.page:0,page_count:valid?request.page_count:0,callback_url:request.callback_url||'',task_id:request.task_id||'',request_id:request.request_id||'',reply_text:replyText}}];`;

const newNodes = [
  routeNode('Memo Search Page Route', 'pline-v3-memo-search-page-route', 'intent', 'memo_search_page', [860, -500]),
  codeNode('Memo Search Page Validate', 'pline-v3-memo-search-page-validate', validateCode, [1080, -500]),
  routeNode('Memo Search Page Valid Route', 'pline-v3-memo-search-page-valid-route', 'valid', true, [1300, -500], 'boolean'),
  codeNode('Memo Search Page Invalid Result', 'pline-v3-memo-search-page-invalid', invalidCode, [1520, -360]),
  codeNode('Memo Search Page Expand', 'pline-v3-memo-search-page-expand', expandCode, [1520, -580]),
  {
    parameters: { authentication: 'oAuth2', operation: 'download', path: '={{ $json.active_path }}', binaryPropertyName: 'data' },
    id: 'pline-v3-dropbox-search-page-readback', name: 'Dropbox Search Page Readback', type: 'n8n-nodes-base.dropbox', typeVersion: 1,
    position: [1740, -580], onError: 'continueRegularOutput', credentials: dropboxCredentials,
  },
  {
    parameters: { operation: 'fromJson', binaryPropertyName: 'data', destinationKey: 'memo', options: { encoding: 'utf8', stripBOM: true, keepSource: 'json' } },
    id: 'pline-v3-memo-search-page-extract', name: 'Memo Search Page Extract JSON', type: 'n8n-nodes-base.extractFromFile', typeVersion: 1.1,
    position: [1960, -580], onError: 'continueRegularOutput',
  },
  codeNode('Memo Search Page Aggregate', 'pline-v3-memo-search-page-aggregate', aggregateCode, [2180, -580], 'runOnceForAllItems'),
];

const replace = new Set(newNodes.map((entry) => entry.name));
workflow.nodes = workflow.nodes.filter((entry) => !replace.has(entry.name));
workflow.nodes.push(...newNodes);
for (const name of replace) delete workflow.connections[name];

const finalizer = node('Memo CRUD Finalizer Payload');
finalizer.parameters.jsCode = `const input=$json||{}; const operation=String(input.operation||input.intent||'');
const status=['completed','duplicate','failed','readback_failed','conflict'].includes(String(input.status||''))?String(input.status):'failed';
const safe=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/; const callbackUrl=String(input.callback_url||'');
const taskId=String(input.task_id||''); const requestId=String(input.request_id||''); const memoId=String(input.memo_id||'');
const memoIds=Array.isArray(input.memo_ids)?input.memo_ids.map((value)=>String(value||'')):[];
const candidates=Array.isArray(input.selection_candidates)?input.selection_candidates.map((entry)=>({position:Number(entry?.position),memo_id:String(entry?.memo_id||'')})):[];
const pageCandidates=Array.isArray(input.page_candidates)?input.page_candidates.map((entry)=>({position:Number(entry?.position),memo_id:String(entry?.memo_id||''),summary:String(entry?.summary||'')})):[];
const total=Number(input.total||0); const page=Number(input.page||0); const pageCount=Number(input.page_count||0);
const batch=operation==='memo_delete'&&memoIds.length>0; const search=operation==='memo_search'; const pageRead=operation==='memo_search_page';
const batchValid=!batch||(memoId===''&&memoIds.length<=1&&memoIds.length>0&&memoIds.every((id)=>/^memo-[a-f0-9]{64}$/.test(id))&&new Set(memoIds).size===memoIds.length);
const searchCompleted=status==='completed'&&Number.isSafeInteger(total)&&total>=0&&total<=100&&candidates.length===total
&&candidates.every((entry,index)=>entry.position===index+1&&/^memo-[a-f0-9]{64}$/.test(entry.memo_id))&&new Set(candidates.map((entry)=>entry.memo_id)).size===candidates.length
&&page===(total===0?0:1)&&pageCount===(total===0?0:Math.ceil(total/10))&&pageCandidates.length===Math.min(total,10)
&&pageCandidates.every((entry,index)=>entry.position===index+1&&entry.memo_id===candidates[index]?.memo_id&&entry.summary.length>0&&entry.summary.length<=80);
const searchFailed=status==='failed'&&candidates.length===0&&pageCandidates.length===0&&page===0&&pageCount===0&&Number.isSafeInteger(total)&&total>=0;
const searchValid=!search||(memoId===''&&memoIds.length===0&&(searchCompleted||searchFailed)&&!String(input.reply_text||'').includes('memo-'));
const pageCompleted=status==='completed'&&memoId===''&&memoIds.length>0&&memoIds.length<=10&&memoIds.every((id)=>/^memo-[a-f0-9]{64}$/.test(id))
&&new Set(memoIds).size===memoIds.length&&Number.isSafeInteger(total)&&total>0&&total<=100&&Number.isSafeInteger(page)&&page>=1
&&pageCount===Math.ceil(total/10)&&pageCandidates.length===memoIds.length&&pageCandidates.every((entry,index)=>entry.position===((page-1)*10)+index+1
&&entry.memo_id===memoIds[index]&&entry.summary.length>0&&entry.summary.length<=80)&&!String(input.reply_text||'').includes('memo-');
const pageFailed=status==='failed'&&pageCandidates.length===0&&page===0&&pageCount===0;
const pageValid=!pageRead||(pageCompleted||pageFailed);
if(!['memo_search','memo_search_page','memo_modify','memo_delete'].includes(operation)||callbackUrl!=='https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'
||!safe.test(taskId)||!safe.test(requestId)||!batchValid||!searchValid||!pageValid) throw new Error('invalid_safe_memo_crud_finalizer_contract');
return [{json:{callback_url:callbackUrl,task_id:taskId,request_id:requestId,status,operation,memo_id:memoId,memo_ids:memoIds,
selection_candidates:candidates,page_candidates:pageCandidates,total,page,page_count:pageCount,reply_text:String(input.reply_text||'備忘錄操作尚未完成。')}}];`;

node('Memo CRUD Finalizer Callback').parameters.body = "={{ JSON.stringify({ task_id:$json.task_id, request_id:$json.request_id, status:$json.status, operation:$json.operation, memo_id:$json.memo_id, memo_ids:$json.memo_ids, selection_candidates:$json.selection_candidates, page_candidates:$json.page_candidates, total:$json.total, page:$json.page, page_count:$json.page_count, reply_text:$json.reply_text }) }}";
node('Memo CRUD Callback Result').parameters.jsCode = `const response=$json||{}; const payload=$('Memo CRUD Finalizer Payload').first().json||{}; const statusCode=Number(response.statusCode||0); const ok=statusCode>=200&&statusCode<300;
return [{json:{ok,intent:payload.operation,status:ok?payload.status:'finalizer_failed',memo_id:payload.memo_id||'',memo_ids:payload.memo_ids||[],
selection_candidates:payload.selection_candidates||[],page_candidates:payload.page_candidates||[],total:Number(payload.total||0),page:Number(payload.page||0),page_count:Number(payload.page_count||0),callback_sent:ok,
reply_text:ok?payload.reply_text:'備忘錄操作已完成處理，但回覆尚未確認。',reply_source:'deterministic'}}];`;

const edge = (target) => ({ node: target, type: 'main', index: 0 });
workflow.connections['Normalize Input'] = { main: [[edge('Memo Search Page Route')]] };
workflow.connections['Memo Search Page Route'] = { main: [[edge('Memo Search Page Validate')], [edge('Memo Search Route')]] };
workflow.connections['Memo Search Page Validate'] = { main: [[edge('Memo Search Page Valid Route')]] };
workflow.connections['Memo Search Page Valid Route'] = { main: [[edge('Memo Search Page Expand')], [edge('Memo Search Page Invalid Result')]] };
workflow.connections['Memo Search Page Invalid Result'] = { main: [[edge('Memo CRUD Finalizer Payload')]] };
workflow.connections['Memo Search Page Expand'] = { main: [[edge('Dropbox Search Page Readback')]] };
workflow.connections['Dropbox Search Page Readback'] = { main: [[edge('Memo Search Page Extract JSON')]] };
workflow.connections['Memo Search Page Extract JSON'] = { main: [[edge('Memo Search Page Aggregate')]] };
workflow.connections['Memo Search Page Aggregate'] = { main: [[edge('Memo CRUD Finalizer Payload')]] };

workflow.workflow_version_name = 'Memo Search Full Candidates and Page Readback N8N Fix';
workflow.memo_search_full_snapshot_page_contract = {
  full_snapshot_limit: 100,
  page_size: 10,
  first_page_only_in_reply: true,
  full_ordered_candidates_in_callback: true,
  page_readback_exact_ids_only: true,
  page_read_only: true,
  selection_batch_authorized_limit: 1,
  credential_values_exported: false,
};
delete workflow.versionId;
delete workflow.activeVersionId;
delete workflow.pinData;
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
