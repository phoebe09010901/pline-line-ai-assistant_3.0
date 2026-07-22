import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const outputPath = process.argv[3] || sourcePath;
const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const required = [
  'Memo Batch Delete Route', 'Memo Batch Delete Validate', 'Memo Batch Delete Valid Route',
  'Memo Batch Delete Invalid Result', 'Memo Batch Delete Expand', 'Memo Batch Delete Loop',
  'Dropbox Batch Delete Active Metadata', 'Dropbox Batch Delete Archive Inventory',
  'Dropbox Batch Delete Conditional Archive State', 'Dropbox Batch Delete Collision Safe Move',
  'Memo CRUD Finalizer Payload', 'Memo CRUD Finalizer Callback', 'Memo CRUD Callback Result',
];
for (const name of required) if (!byName(name)) throw new Error(`required node missing: ${name}`);

const dropboxCredentials = workflow.nodes.find((node) => node.credentials?.dropboxOAuth2Api)?.credentials;
if (!dropboxCredentials?.dropboxOAuth2Api) throw new Error('Dropbox credential reference missing');
const lines = (values) => values.join('\n');
const codeNode = (name, id, jsCode, position, mode) => ({
  parameters: mode ? { mode, jsCode } : { jsCode },
  id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position,
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
  id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
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
  id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
});
const nativeDropbox = (name, id, parameters, position, extra = {}) => ({
  parameters: { authentication: 'oAuth2', ...parameters },
  id, name, type: 'n8n-nodes-base.dropbox', typeVersion: 1, position, ...extra,
  credentials: dropboxCredentials,
});

const validate = byName('Memo Batch Delete Validate');
const normalize = byName('Normalize Input');
if (!normalize?.parameters?.jsCode) throw new Error('Normalize Input code missing');
if (!normalize.parameters.jsCode.includes("confirmation_status: String(body.confirmation_status || '')")) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "selection_mode: String(body.selection_mode || ''),",
    "selection_mode: String(body.selection_mode || ''),\n    confirmation_status: String(body.confirmation_status || ''),",
  );
}
validate.parameters.jsCode = lines([
  "const input=$json||{}; const delivery=input.reply_delivery_reference&&typeof input.reply_delivery_reference==='object'?input.reply_delivery_reference:{};",
  "const memoIds=Array.isArray(input.memo_ids)?input.memo_ids.map((value)=>String(value||'')):[]; const mode=String(input.selection_mode||'');",
  "const receivedAt=String(input.received_at||''); const safe=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/;",
  "const valid=input.intent==='memo_delete'&&input.delete_scope==='memo_search_selection_snapshot'&&['single','multiple','range','all'].includes(mode)",
  "&&input.confirmation_status==='consumed'",
  "&&/^[a-f0-9]{64}$/.test(String(input.safe_event_hash||''))&&/^[a-f0-9]{64}$/.test(String(input.selection_snapshot_version||''))",
  "&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(receivedAt)&&Number.isFinite(Date.parse(receivedAt))",
  "&&memoIds.length>=1&&memoIds.length<=5&&memoIds.every((memoId)=>/^memo-[a-f0-9]{64}$/.test(memoId))&&new Set(memoIds).size===memoIds.length",
  "&&String(delivery.callback_url||'')==='https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'",
  "&&safe.test(String(delivery.task_id||''))&&safe.test(String(delivery.request_id||''));",
  "return [{json:{valid,continue_operation:valid,intent:'memo_delete',operation:'memo_delete',delete_scope:String(input.delete_scope||''),selection_mode:mode,",
  "selection_snapshot_version:valid?String(input.selection_snapshot_version):'',confirmation_status:valid?'consumed':'',safe_event_hash:valid?String(input.safe_event_hash):'',received_at:valid?receivedAt:'',",
  "memo_ids:valid?memoIds:[],callback_url:valid?String(delivery.callback_url):'',task_id:valid?String(delivery.task_id):'',request_id:valid?String(delivery.request_id):'',",
  "status:valid?'validated':'failed',failure_class:valid?'':'invalid_batch_contract',reply_text:valid?'':'無法確認要封存的備忘錄項目。'}}];",
]);

const activeMetadata = nativeDropbox('Dropbox Batch Delete Active Metadata', 'pline-v3-dropbox-batch-delete-active-metadata', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll: true, filters: {},
}, [-10096, 3000], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const activeCheck = codeNode('Memo Batch Delete Active Metadata Check', 'pline-v3-memo-batch-delete-active-metadata-check', lines([
  "const request=$('Memo Batch Delete Validate').first().json||{}; const entries=$input.all().map((item)=>item?.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{});",
  "const inventory=request.memo_ids.map((memoId)=>{const path='/菲比工作總倉庫/00_INBOX_臨時丟進來/'+memoId+'.json';",
  "const matches=entries.filter((entry)=>{const found=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===memoId+'.json'&&found.toLowerCase()===path.toLowerCase();});",
  "const rev=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:''; return {memo_id:memoId,active_path:path,match_count:matches.length,revision:/^[0-9a-f]{9,255}$/.test(rev)?rev:''};});",
  "return [{json:{...request,active_inventory:inventory}}];",
]), [-9872, 3000], 'runOnceForAllItems');
const archiveInventory = nativeDropbox('Dropbox Batch Delete Archive Inventory', 'pline-v3-dropbox-batch-delete-archive-inventory', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/99_ARCHIVE_封存', returnAll: true, filters: {},
}, [-9648, 3000], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const inventoryDecision = codeNode('Memo Batch Delete Inventory Decision', 'pline-v3-memo-batch-delete-inventory-decision', lines([
  "const request=$('Memo Batch Delete Active Metadata Check').first().json||{}; const entries=$input.all().map((item)=>item?.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{});",
  "const items=(request.memo_ids||[]).map((memoId,index)=>{const active=(request.active_inventory||[])[index]||{}; const archivePath='/菲比工作總倉庫/99_ARCHIVE_封存/'+memoId+'.json';",
  "const matches=entries.filter((entry)=>{const found=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===memoId+'.json'&&found.toLowerCase()===archivePath.toLowerCase();});",
  "const archiveRev=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:''; let source=''; let failure='preflight_inventory_invalid';",
  "if(active.match_count===1&&/^[0-9a-f]{9,255}$/.test(String(active.revision||''))&&matches.length===0){source='active';failure='';}",
  "else if(active.match_count===0&&matches.length===1&&/^[0-9a-f]{9,255}$/.test(archiveRev)){source='archive';failure='';}",
  "else if(matches.length>0){failure='archive_collision';}",
  "return {...request,memo_id:memoId,batch_index:index,batch_size:request.memo_ids.length,active_path:active.active_path||'/菲比工作總倉庫/00_INBOX_臨時丟進來/'+memoId+'.json',",
  "archive_path:archivePath,preflight_source:source,revision:source==='active'?String(active.revision||''):'',archive_revision:source==='archive'?archiveRev:'',",
  "preflight_inventory_valid:Boolean(source),failure_class:failure,status:source?'preflight_inventory_ready':'failed'};});",
  "const ok=request.valid===true&&items.length===request.memo_ids.length&&items.every((item)=>item.preflight_inventory_valid===true);",
  "return [{json:{...request,continue_operation:ok,inventory_items:items,status:ok?'preflight_inventory_completed':'failed',failure_class:ok?'':String(items.find((item)=>!item.preflight_inventory_valid)?.failure_class||'preflight_inventory_invalid'),reply_text:ok?'':'整批備忘錄目前無法安全封存。'}}];",
]), [-9424, 3000], 'runOnceForAllItems');
const inventoryRoute = boolRoute('Memo Batch Delete Preflight Inventory Route', 'pline-v3-memo-batch-delete-preflight-inventory-route', 'continue_operation', [-9200, 3000]);

const preflightExpand = codeNode('Memo Batch Delete Expand', 'pline-v3-memo-batch-delete-expand', lines([
  "const request=$json||{}; if(!request.continue_operation||!Array.isArray(request.inventory_items)) return [];",
  "return request.inventory_items.map((item,index)=>({json:{...item,batch_index:index},pairedItem:0}));",
]), [-8976, 2800], 'runOnceForAllItems');
const preflightReadback = nativeDropbox('Dropbox Batch Delete Active Download', 'pline-v3-dropbox-batch-delete-active-download', {
  operation: 'download', path: "={{ $json.preflight_source === 'archive' ? $json.archive_path : $json.active_path }}", binaryPropertyName: 'data',
}, [-8752, 2800], { onError: 'continueRegularOutput' });
const preflightVerify = codeNode('Memo Batch Delete Prepare Archive', 'pline-v3-memo-batch-delete-prepare-archive', lines([
  "const input=$json||{}; let request={}; try{request=$('Memo Batch Delete Expand').item.json||{};}catch(error){request={};} const memo=input.memo;",
  "const activeKeys=['schema','memo_id','type','content','status','created_at','updated_at','source']; const archiveKeys=[...activeKeys,'archived_at'];",
  "const exact=(keys)=>memo&&typeof memo==='object'&&!Array.isArray(memo)&&Object.keys(memo).sort().join('|')===keys.slice().sort().join('|');",
  "const iso=(value)=>/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(String(value||''))&&Number.isFinite(Date.parse(value));",
  "const active=exact(activeKeys)&&memo.schema==='pline-memo/v1'&&memo.memo_id===request.memo_id&&memo.type==='memo'&&memo.status==='active'&&memo.source==='line'",
  "&&typeof memo.content==='string'&&Boolean(memo.content.trim())&&iso(memo.created_at)&&iso(memo.updated_at)&&request.preflight_source==='active'&&/^[0-9a-f]{9,255}$/.test(String(request.revision||''));",
  "const archived=exact(archiveKeys)&&memo.schema==='pline-memo/v1'&&memo.memo_id===request.memo_id&&memo.type==='memo'&&memo.status==='archived'&&memo.source==='line'",
  "&&typeof memo.content==='string'&&Boolean(memo.content.trim())&&iso(memo.created_at)&&memo.updated_at===request.received_at&&memo.archived_at===request.received_at;",
  "let action='failed'; let expected=null; if(active){action='archive';expected={schema:memo.schema,memo_id:memo.memo_id,type:memo.type,content:memo.content,status:'archived',created_at:memo.created_at,updated_at:request.received_at,source:memo.source,archived_at:request.received_at};}",
  "else if(archived&&request.preflight_source==='active'&&/^[0-9a-f]{9,255}$/.test(String(request.revision||''))){action='resume_move';expected=memo;}",
  "else if(archived&&request.preflight_source==='archive'&&/^[0-9a-f]{9,255}$/.test(String(request.archive_revision||''))){action='duplicate';expected=memo;}",
  "const ok=action!=='failed'; return {json:{...request,preflight_valid:ok,item_action:action,expected_json:expected,expected_json_text:expected?JSON.stringify(expected,null,2):'',",
  "status:ok?'preflight_ready':'failed',failure_class:ok?'':'preflight_readback_invalid',reply_text:ok?'':'整批備忘錄內容驗證失敗。'},pairedItem:0};",
]), [-8304, 2800], 'runOnceForEachItem');
const preflightAggregate = codeNode('Memo Batch Delete Preflight Aggregate', 'pline-v3-memo-batch-delete-preflight-aggregate', lines([
  "const request=$('Memo Batch Delete Validate').first().json||{}; const items=$input.all().map((item)=>item.json||{}).sort((a,b)=>Number(a.batch_index)-Number(b.batch_index));",
  "const ok=request.valid===true&&items.length===request.memo_ids.length&&items.every((item,index)=>item.preflight_valid===true&&item.memo_id===request.memo_ids[index]",
  "&&Number(item.batch_index)===index&&['archive','resume_move','duplicate'].includes(String(item.item_action||'')));",
  "return [{json:{...request,continue_operation:ok,preflight_items:ok?items:[],status:ok?'preflight_completed':'failed',failure_class:ok?'':String(items.find((item)=>item.preflight_valid!==true)?.failure_class||'preflight_failed'),reply_text:ok?'':'整批備忘錄未通過安全檢查。'}}];",
]), [-8080, 3000], 'runOnceForAllItems');
const preflightRoute = boolRoute('Memo Batch Delete Prepare Route', 'pline-v3-memo-batch-delete-prepare-route', 'continue_operation', [-7856, 3000]);
const executeExpand = codeNode('Memo Batch Delete Execute Expand', 'pline-v3-memo-batch-delete-execute-expand', lines([
  "const request=$json||{}; if(!request.continue_operation||!Array.isArray(request.preflight_items)) return [];",
  "return request.preflight_items.map((item,index)=>({json:{...item,batch_index:index,batch_size:request.memo_ids.length},pairedItem:0}));",
]), [-7632, 3160], 'runOnceForAllItems');
const batchLoop = {
  parameters: { batchSize: 1, options: {} }, id: 'pline-v3-memo-batch-delete-loop', name: 'Memo Batch Delete Loop',
  type: 'n8n-nodes-base.splitInBatches', typeVersion: 3, position: [-7408, 3160],
};
const archiveRoute = stringRoute('Memo Batch Delete Archive Action Route', 'pline-v3-memo-batch-delete-archive-action-route', 'item_action', 'archive', [-7184, 3000]);
const resumeRoute = stringRoute('Memo Batch Delete Reentry Route', 'pline-v3-memo-batch-delete-reentry-route', 'item_action', 'resume_move', [-6960, 3200]);
const duplicateTerminal = codeNode('Memo Batch Delete Reentry Verify', 'pline-v3-memo-batch-delete-reentry-verify', lines([
  "const input=$json||{}; const ok=input.item_action==='duplicate'&&input.preflight_valid===true&&input.expected_json&&input.expected_json.status==='archived';",
  "return [{json:{...input,item_terminal:true,item_success:ok,status:ok?'duplicate':'failed',failure_class:ok?'':'duplicate_readback_invalid',reply_text:ok?'':'封存重入驗證失敗。'},pairedItem:0}];",
]), [-6736, 3340], 'runOnceForEachItem');

const updateCheck = byName('Memo Batch Delete Update Check');
updateCheck.parameters.jsCode = lines([
  "const response=$json&&typeof $json==='object'&&!Array.isArray($json)?$json:{}; let request={}; try{request=$('Memo Batch Delete Loop').item.json||{};}catch(error){request={};}",
  "const statusCode=Number(response.statusCode||0); const expected=request.expected_json&&typeof request.expected_json==='object'?request.expected_json:null;",
  "const safe=request.item_action==='archive'&&expected&&expected.memo_id===request.memo_id&&expected.status==='archived'&&expected.archived_at===request.received_at",
  "&&/^[0-9a-f]{9,255}$/.test(String(request.revision||''))&&request.active_path==='/菲比工作總倉庫/00_INBOX_臨時丟進來/'+request.memo_id+'.json';",
  "const accepted=statusCode>=200&&statusCode<300&&Boolean(safe); const failure=statusCode===409?'conditional_revision_conflict':statusCode===0?'conditional_update_ambiguous':'conditional_update_failed';",
  "return [{json:{...request,continue_operation:accepted,status:accepted?'archive_state_update_accepted_metadata_pending':(statusCode===409?'conflict':'failed'),failure_class:accepted?'':failure,reply_text:accepted?'':'備忘錄目前無法安全完成更新。'},pairedItem:0}];",
]);
const preMoveMetadata = nativeDropbox('Dropbox Batch Delete Pre Move Metadata', 'pline-v3-dropbox-batch-delete-pre-move-metadata', {
  resource: 'folder', operation: 'list', path: '/菲比工作總倉庫/00_INBOX_臨時丟進來', returnAll: true, filters: {},
}, [-6288, 2600], { alwaysOutputData: true, onError: 'continueRegularOutput' });
const preMoveGuard = codeNode('Memo Batch Delete Pre Move Guard', 'pline-v3-memo-batch-delete-pre-move-guard', lines([
  "let request={}; try{request=$('Memo Batch Delete Update Check').item.json||{};}catch(error){try{request=$('Memo Batch Delete Reentry Route').item.json||{};}catch(inner){request={};}}",
  "const entries=$input.all().map((item)=>item?.json&&typeof item.json==='object'&&!Array.isArray(item.json)?item.json:{}); const matches=entries.filter((entry)=>{const path=typeof entry.pathLower==='string'?entry.pathLower:String(entry.pathDisplay||'');",
  "return entry.type==='file'&&!Object.prototype.hasOwnProperty.call(entry,'error')&&String(entry.name||'')===request.memo_id+'.json'&&path.toLowerCase()===String(request.active_path||'').toLowerCase();});",
  "const current=matches.length===1&&typeof matches[0].rev==='string'?matches[0].rev:''; const legal=/^[0-9a-f]{9,255}$/.test(current);",
  "const ok=matches.length===1&&legal&&((request.item_action==='archive'&&current!==request.revision)||(request.item_action==='resume_move'&&current===request.revision));",
  "return [{json:{...request,continue_operation:ok,updated_revision:ok?current:'',status:ok?'move_ready':'failed',failure_class:ok?'':'pre_move_revision_conflict',reply_text:ok?'':'備忘錄在封存前又被更新，沒有移動檔案。'},pairedItem:0}];",
]), [-6064, 2600], 'runOnceForAllItems');
const moveCheck = byName('Memo Batch Delete Move Check');
moveCheck.parameters.jsCode = moveCheck.parameters.jsCode
  .replace("reply_text:accepted?'':(statusCode===409?'封存位置已有同名備忘錄，沒有覆蓋或移動。':'封存結果不明，沒有回報成功。')", "failure_class:accepted?'':(statusCode===409?'archive_collision':statusCode===0?'move_ambiguous':'move_failed'),reply_text:accepted?'':(statusCode===409?'封存位置已有同名備忘錄，沒有覆蓋或移動。':'封存結果不明，沒有回報成功。')");
const archiveVerify = byName('Memo Batch Delete Verify Readback');
archiveVerify.parameters.jsCode = archiveVerify.parameters.jsCode.replace("status:verified?'completed':'readback_failed',", "status:verified?'completed':'readback_failed',failure_class:verified?'':'terminal_readback_mismatch',");
const itemFailure = codeNode('Memo Batch Delete Item Failure', 'pline-v3-memo-batch-delete-item-failure', lines([
  "const input=$json||{}; const status=['conflict','readback_failed'].includes(String(input.status||''))?String(input.status):'failed';",
  "const failure=String(input.failure_class||status||'failed').replace(/[^a-z0-9_:-]/gi,'').slice(0,64)||'failed';",
  "return [{json:{...input,item_terminal:true,item_success:false,status,failure_class:failure,reply_text:'備忘錄目前無法安全完成封存。'},pairedItem:0}];",
]), [-3600, 2860], 'runOnceForEachItem');
const failureAggregate = codeNode('Memo Batch Delete Failure Aggregate', 'pline-v3-memo-batch-delete-failure-aggregate', lines([
  "const request=$('Memo Batch Delete Validate').first().json||{}; const item=$json||{}; const index=Number(item.batch_index);",
  "const completed=Number.isSafeInteger(index)&&index>=0&&index<request.memo_ids.length?index:0; const failed=Math.max(1,request.memo_ids.length-completed);",
  "const status=['conflict','readback_failed'].includes(String(item.status||''))?String(item.status):'failed'; const failure=String(item.failure_class||status||'failed').replace(/[^a-z0-9_:-]/gi,'').slice(0,64)||'failed';",
  "return [{json:{intent:'memo_delete',operation:'memo_delete',status,memo_id:'',memo_ids:request.memo_ids,callback_url:request.callback_url,task_id:request.task_id,request_id:request.request_id,",
  "success_count:completed,completed_count:completed,failed_count:failed,failure_class:failure,reply_text:'這次預計刪除 '+request.memo_ids.length+' 筆，成功 '+completed+' 筆，未刪除 '+failed+' 筆；基於安全檢查，未完成的項目沒有繼續處理。'}}];",
]), [-3376, 2860], 'runOnceForEachItem');
const successAggregate = codeNode('Memo Batch Delete Aggregate', 'pline-v3-memo-batch-delete-aggregate', lines([
  "const request=$('Memo Batch Delete Validate').first().json||{}; const preflight=$('Memo Batch Delete Preflight Aggregate').first().json||{}; const count=request.memo_ids.length;",
  "const duplicate=Array.isArray(preflight.preflight_items)&&preflight.preflight_items.length===count&&preflight.preflight_items.every((item)=>item.item_action==='duplicate');",
  "return [{json:{intent:'memo_delete',operation:'memo_delete',status:duplicate?'duplicate':'completed',memo_id:'',memo_ids:request.memo_ids,callback_url:request.callback_url,task_id:request.task_id,request_id:request.request_id,",
  "success_count:count,completed_count:count,failed_count:0,failure_class:'',reply_text:'這次預計刪除 '+count+' 筆，成功 '+count+' 筆，未刪除 0 筆。'}}];",
]), [-3376, 3160], 'runOnceForAllItems');

const replace = [
  activeMetadata, activeCheck, archiveInventory, inventoryDecision, inventoryRoute, preflightExpand,
  preflightReadback, preflightVerify, preflightAggregate, preflightRoute, executeExpand, batchLoop,
  archiveRoute, resumeRoute, duplicateTerminal, preMoveMetadata, preMoveGuard, itemFailure,
  failureAggregate, successAggregate,
];
const obsolete = new Set(['Dropbox Batch Delete Reentry Readback', 'Memo Batch Delete Reentry Extract']);
const replaceNames = new Set(replace.map((node) => node.name));
workflow.nodes = workflow.nodes.filter((node) => !replaceNames.has(node.name) && !obsolete.has(node.name));
workflow.nodes.push(...replace);
for (const name of [...replaceNames, ...obsolete]) delete workflow.connections[name];

const finalizer = byName('Memo CRUD Finalizer Payload');
finalizer.parameters.jsCode = finalizer.parameters.jsCode.replace("memoIds.length<=1&&memoIds.length>0", "memoIds.length<=5&&memoIds.length>0");
if (!finalizer.parameters.jsCode.includes('const successCount=')) {
  finalizer.parameters.jsCode = finalizer.parameters.jsCode
    .replace("const batch=operation==='memo_delete'&&memoIds.length>0;", "const batch=operation==='memo_delete'&&memoIds.length>0; const successCount=Number(input.success_count||0); const failureClass=String(input.failure_class||'').replace(/[^a-z0-9_:-]/gi,'').slice(0,64);")
    .replace("const batchValid=!batch||(memoId===''", "const batchValid=!batch||(Number.isSafeInteger(successCount)&&successCount>=0&&successCount<=memoIds.length&&((['completed','duplicate'].includes(status)&&successCount===memoIds.length)||(['failed','readback_failed','conflict'].includes(status)&&successCount<memoIds.length))&&memoId==='' ")
    .replace("selection_candidates:candidates,page_candidates:pageCandidates,total,page,page_count:pageCount,reply_text", "selection_candidates:candidates,page_candidates:pageCandidates,total,page,page_count:pageCount,success_count:successCount,failure_class:failureClass,reply_text");
}
const callback = byName('Memo CRUD Finalizer Callback');
if (!callback.parameters.body.includes('success_count:$json.success_count')) callback.parameters.body = callback.parameters.body.replace("page_count:$json.page_count, reply_text", "page_count:$json.page_count, success_count:$json.success_count, failure_class:$json.failure_class, reply_text");
const callbackResult = byName('Memo CRUD Callback Result');
if (!callbackResult.parameters.jsCode.includes('success_count:Number(payload.success_count')) callbackResult.parameters.jsCode = callbackResult.parameters.jsCode.replace("callback_sent:ok,", "success_count:Number(payload.success_count||0),failure_class:String(payload.failure_class||''),callback_sent:ok,");

const edge = (node, index = 0) => ({ node, type: 'main', index });
const connect = (from, yes, no) => {
  workflow.connections[from] = no === undefined ? { main: [[edge(yes)]] } : { main: [[edge(yes)], [edge(no)]] };
};
connect('Memo Batch Delete Valid Route', 'Dropbox Batch Delete Active Metadata', 'Memo Batch Delete Invalid Result');
connect('Dropbox Batch Delete Active Metadata', 'Memo Batch Delete Active Metadata Check');
connect('Memo Batch Delete Active Metadata Check', 'Dropbox Batch Delete Archive Inventory');
connect('Dropbox Batch Delete Archive Inventory', 'Memo Batch Delete Inventory Decision');
connect('Memo Batch Delete Inventory Decision', 'Memo Batch Delete Preflight Inventory Route');
connect('Memo Batch Delete Preflight Inventory Route', 'Memo Batch Delete Expand', 'Memo Batch Delete Item Failure');
connect('Memo Batch Delete Expand', 'Dropbox Batch Delete Active Download');
connect('Dropbox Batch Delete Active Download', 'Memo Batch Delete Active Extract');
connect('Memo Batch Delete Active Extract', 'Memo Batch Delete Prepare Archive');
connect('Memo Batch Delete Prepare Archive', 'Memo Batch Delete Preflight Aggregate');
connect('Memo Batch Delete Preflight Aggregate', 'Memo Batch Delete Prepare Route');
connect('Memo Batch Delete Prepare Route', 'Memo Batch Delete Execute Expand', 'Memo Batch Delete Item Failure');
connect('Memo Batch Delete Execute Expand', 'Memo Batch Delete Loop');
workflow.connections['Memo Batch Delete Loop'] = { main: [[edge('Memo Batch Delete Aggregate')], [edge('Memo Batch Delete Archive Action Route')]] };
connect('Memo Batch Delete Archive Action Route', 'Dropbox Batch Delete Conditional Archive State', 'Memo Batch Delete Reentry Route');
connect('Memo Batch Delete Reentry Route', 'Dropbox Batch Delete Pre Move Metadata', 'Memo Batch Delete Reentry Verify');
connect('Memo Batch Delete Reentry Verify', 'Memo Batch Delete Loop');
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
connect('Memo Batch Delete Item Failure', 'Memo Batch Delete Failure Aggregate');
connect('Memo Batch Delete Failure Aggregate', 'Memo CRUD Finalizer Payload');
connect('Memo Batch Delete Aggregate', 'Memo CRUD Finalizer Payload');

workflow.workflow_version_name = 'Memo Multi-Position Delete Preflight and Aggregate';
workflow.memo_search_selection_batch_archive_contract = {
  ...(workflow.memo_search_selection_batch_archive_contract || {}),
  selection_modes: ['single', 'multiple', 'range', 'all'], batch_limit: 5,
  preflight_all_or_none: true, preflight_readback_required: true,
  stop_after_first_execution_failure: true, resume_intermediate_archived_source: true,
  callback_once_after_batch_terminal: true, delete_all_supported: true,
  delete_all_scope: 'current_unexpired_same_actor_search_snapshot_only',
  confirmation_required: true, confirmation_status: 'consumed',
};
delete workflow.versionId;
delete workflow.activeVersionId;
delete workflow.pinData;
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
