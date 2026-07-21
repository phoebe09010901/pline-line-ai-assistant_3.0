import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.argv[2] || './N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json';
const outputPath = process.argv[3] || sourcePath;
const workflow = JSON.parse(await readFile(sourcePath, 'utf8'));

const node = (name) => workflow.nodes.find((entry) => entry.name === name);
const required = [
  'OpenAI Chat Model',
  'Memo Callback Route',
  'Memo Finalizer Callback',
  'Memo Callback Result',
  'Memo Modify Verify Readback',
  'Memo Delete Verify Readback',
  'Memo CRUD Finalizer Payload',
];
for (const name of required) {
  if (!node(name)) throw new Error(`required node missing: ${name}`);
}

const codeNode = (name, id, jsCode, position) => ({
  parameters: { jsCode },
  id,
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
});

const safeInputCode = `const input = $json || {};
const operation = String(input.operation || input.intent || '');
const terminalStatus = String(input.status || '');
if (!['memo_create','memo_modify','memo_delete'].includes(operation)
  || !['completed','duplicate'].includes(terminalStatus)) {
  throw new Error('invalid_memo_success_natural_reply_input');
}
return [{ json: {
  operation,
  terminal_status: 'completed',
  locale: 'zh-TW',
  style: 'natural_concise'
} }];`;

const guardCode = `const input = $json || {};
const safe = $('Memo Success Natural Reply Input').first().json || {};
const operation = String(safe.operation || '');
const fallback = {
  memo_create: '好，我幫妳記好了。',
  memo_modify: '好，我幫妳改好了。',
  memo_delete: '好，我幫妳刪除了。'
};
function candidate(value) {
  if (typeof value !== 'string') return '';
  let text = value.trim().replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/i, '').trim();
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      text = String(parsed.reply_text || parsed.text || '');
    } catch (error) {
      text = '';
    }
  }
  return text.replace(/\\s+/g, ' ').trim();
}
const raw = candidate(input.reply_text || input.text || input.output || input.response || input.result || '');
const forbidden = /(?:memo-[a-f0-9]{8,}|備忘錄(?:編號|id)|\\.json\\b|\\/Users\\/|\\/菲比|Dropbox|Cloudflare|n8n|Worker|KV|webhook|payload|task_id|request_id|replyToken|credential|secret|token|system(?:\\s+prompt)?|JSON|工程|節點|欄位|執行紀錄)/i;
const simplified = /[这帮条记删录个后里务为]/;
const valid = raw.length >= 2 && raw.length <= 160 && /[\\u3400-\\u9fff]/.test(raw)
  && !forbidden.test(raw) && !simplified.test(raw);
return [{ json: {
  operation,
  terminal_status: 'completed',
  locale: 'zh-TW',
  style: 'natural_concise',
  reply_text: valid ? raw : fallback[operation],
  reply_source: valid ? 'ai_generated' : 'safe_fallback'
} }];`;

const finalizerPayloadCode = `const result = $json || {};
const operation = String(result.operation || '');
let source = {};
if (operation === 'memo_create') {
  try { source = $('Memo Cleanup Outcome').first().json || {}; } catch (error) { source = {}; }
  if (!source.task_id) source = $('Memo Verify Readback').first().json || {};
} else if (operation === 'memo_modify') {
  source = $('Memo Modify Verify Readback').first().json || {};
} else if (operation === 'memo_delete') {
  source = $('Memo Delete Verify Readback').first().json || {};
}
const callbackUrl = String(source.callback_url || '');
const taskId = String(source.task_id || '');
const requestId = String(source.request_id || '');
const memoId = String(source.memo_id || '');
const status = String(source.status || '');
const opaque = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/;
if (!['memo_create','memo_modify','memo_delete'].includes(operation)
  || !['completed','duplicate'].includes(status)
  || callbackUrl !== 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize'
  || !opaque.test(taskId) || !opaque.test(requestId) || !/^memo-[a-f0-9]{64}$/.test(memoId)
  || !['ai_generated','safe_fallback'].includes(String(result.reply_source || ''))
  || typeof result.reply_text !== 'string' || !result.reply_text.trim()) {
  throw new Error('invalid_memo_success_finalizer_contract');
}
return [{ json: {
  callback_url: callbackUrl,
  task_id: taskId,
  request_id: requestId,
  status,
  operation,
  memo_id: memoId,
  reply_text: result.reply_text.trim(),
  reply_source: result.reply_source
} }];`;

const newNodes = [
  codeNode('Memo Success Natural Reply Input', 'pline-v3-memo-success-natural-input', safeInputCode, [5920, -1180]),
  {
    parameters: {
      promptType: 'define',
      text: "={{ JSON.stringify({ operation: $json.operation, terminal_status: $json.terminal_status, locale: $json.locale, style: $json.style }) }}",
      messages: {
        messageValues: [{
          message: '請只回傳一句簡短、自然、溫暖的繁體中文成功回覆。memo_create 表示已記好；memo_modify 表示已改好；memo_delete 表示已刪除。禁止輸出任何編號、memo-字樣、檔名、路徑、JSON、系統欄位、服務名稱或工程術語；禁止解釋、Markdown、工具呼叫或額外欄位。'
        }]
      },
      options: {}
    },
    id: 'pline-v3-memo-success-natural-chain',
    name: 'Memo Success Natural Reply Chain',
    type: '@n8n/n8n-nodes-langchain.chainLlm',
    typeVersion: 1.4,
    position: [6140, -1180],
    onError: 'continueRegularOutput'
  },
  codeNode('Memo Success Natural Reply Guard', 'pline-v3-memo-success-natural-guard', guardCode, [6360, -1180]),
  codeNode('Memo Success Natural Reply Finalizer Payload', 'pline-v3-memo-success-natural-finalizer-payload', finalizerPayloadCode, [6580, -1180]),
];

const replaceNames = new Set(newNodes.map((entry) => entry.name));
workflow.nodes = workflow.nodes.filter((entry) => !replaceNames.has(entry.name));
workflow.nodes.push(...newNodes);
for (const name of replaceNames) delete workflow.connections[name];

const callback = node('Memo Finalizer Callback');
callback.parameters.body = "={{ JSON.stringify({ task_id:$json.task_id, request_id:$json.request_id, status:$json.status, operation:$json.operation, memo_id:$json.memo_id, reply_text:$json.reply_text }) }}";

const callbackResult = node('Memo Callback Result');
callbackResult.parameters.jsCode = `const response = $json || {};
const payload = $('Memo Success Natural Reply Finalizer Payload').first().json || {};
const statusCode = Number(response.statusCode || response.status || 0);
const accepted = statusCode >= 200 && statusCode < 300;
return [{ json: {
  ok: accepted,
  intent: payload.operation || '',
  status: accepted ? payload.status : 'finalizer_failed',
  callback_sent: accepted,
  reply_text: accepted ? payload.reply_text : '備忘錄已完成處理，但回覆尚未確認。',
  reply_source: accepted ? payload.reply_source : 'safe_fallback'
} }];`;

const edge = (target, type = 'main') => ({ node: target, type, index: 0 });
workflow.connections['Memo Callback Route'] = {
  main: [[edge('Memo Success Natural Reply Input')], [edge('Memo Safe Result')]],
};
workflow.connections['Memo Modify Verify Readback'] = { main: [[edge('Memo Success Natural Reply Input')]] };
workflow.connections['Memo Delete Verify Readback'] = { main: [[edge('Memo Success Natural Reply Input')]] };
workflow.connections['Memo Success Natural Reply Input'] = { main: [[edge('Memo Success Natural Reply Chain')]] };
workflow.connections['Memo Success Natural Reply Chain'] = { main: [[edge('Memo Success Natural Reply Guard')]] };
workflow.connections['Memo Success Natural Reply Guard'] = { main: [[edge('Memo Success Natural Reply Finalizer Payload')]] };
workflow.connections['Memo Success Natural Reply Finalizer Payload'] = { main: [[edge('Memo Finalizer Callback')]] };
workflow.connections['Memo Finalizer Callback'] = { main: [[edge('Memo Callback Result')]] };
workflow.connections['Memo Callback Result'] = { main: [[edge('Respond to Webhook')]] };

const modelConnections = workflow.connections['OpenAI Chat Model']?.ai_languageModel?.[0] || [];
workflow.connections['OpenAI Chat Model'] = {
  ai_languageModel: [[
    ...modelConnections.filter((entry) => entry.node !== 'Memo Success Natural Reply Chain'),
    edge('Memo Success Natural Reply Chain', 'ai_languageModel'),
  ]],
};

const crudPayloadSources = [
  'Memo Search Aggregate',
  'Memo Search Invalid Result',
  'Memo Modify Failure Result',
  'Memo Delete Failure Result',
];
for (const source of crudPayloadSources) {
  workflow.connections[source] = { main: [[edge('Memo CRUD Finalizer Payload')]] };
}

workflow.workflow_version_name = 'Memo Success Natural Reply Bridge';
workflow.memo_success_natural_reply_contract = {
  operations: ['memo_create', 'memo_modify', 'memo_delete'],
  search_unchanged: true,
  model: 'existing_openai_chat_model_reference',
  ai_agent_bypass: true,
  tool_connections: 0,
  structured_input: ['operation', 'terminal_status', 'locale', 'style'],
  success_result_contains_memo_id: false,
  safe_guard: 'traditional_chinese_nonempty_bounded_no_identity_or_engineering_terms',
  invalid_or_timeout_fallback: 'operation_specific_no_id',
  finalizer_after_terminal_readback_only: true,
  credentials_exported: false,
};

await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
