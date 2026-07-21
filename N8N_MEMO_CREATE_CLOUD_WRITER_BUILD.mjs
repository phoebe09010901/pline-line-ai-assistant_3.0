import { readFile, writeFile } from 'node:fs/promises';

const workflowPath = process.argv[2]
  ? new URL(`file://${process.argv[2]}`)
  : new URL('./N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json', import.meta.url);
const outputPath = process.argv[3]
  ? new URL(`file://${process.argv[3]}`)
  : workflowPath;
const workflow = JSON.parse(await readFile(workflowPath, 'utf8'));

const existingDropboxCredentials = workflow.nodes.find((node) =>
  ['Dropbox Create If Absent', 'Dropbox Stage Upload', 'Dropbox Readback'].includes(node.name)
)?.credentials;
const existingCallbackCredentials = workflow.nodes.find((node) => node.name === 'Memo Finalizer Callback')?.credentials;
const preserveCredentials = (node, credentials) => credentials ? { ...node, credentials } : node;

const normalize = workflow.nodes.find((node) => node.name === 'Normalize Input');
if (!normalize) throw new Error('Normalize Input node not found');

const memoNormalizeBlock = `
if (rawIntent === 'memo_create') {
  const safeEventHash = String(body.safe_event_hash || body.event_identity || '').trim().toLowerCase();
  const memoId = String(body.memo_id || '').trim().toLowerCase();
  const canonicalContent = String(body.canonical_content || body.content || '').trim();
  const receivedAt = String(body.received_at || '').trim();
  const rawReplyDeliveryReference = body.reply_delivery_reference && typeof body.reply_delivery_reference === 'object'
    ? body.reply_delivery_reference
    : {};
  const replyDeliveryReference = {
    callback_url: String(rawReplyDeliveryReference.callback_url || ''),
    task_id: String(rawReplyDeliveryReference.task_id || ''),
    request_id: String(rawReplyDeliveryReference.request_id || '')
  };
  return [{ json: {
    intent: 'memo_create',
    safe_event_hash: safeEventHash,
    memo_id: memoId,
    canonical_content: canonicalContent,
    received_at: receivedAt,
    reply_delivery_reference: replyDeliveryReference,
    allowed_intents: ['memo_create', 'idea_create', 'codex_task', 'clarify', 'unsupported']
  } }];
}
`;

const memoNormalizeStart = normalize.parameters.jsCode.indexOf("if (rawIntent === 'memo_create')");
const memoNormalizeEnd = memoNormalizeStart >= 0
  ? normalize.parameters.jsCode.indexOf('function removeTerm', memoNormalizeStart)
  : -1;
if (memoNormalizeStart >= 0 && memoNormalizeEnd > memoNormalizeStart) {
  normalize.parameters.jsCode = `${normalize.parameters.jsCode.slice(0, memoNormalizeStart)}${memoNormalizeBlock}\n${normalize.parameters.jsCode.slice(memoNormalizeEnd)}`;
} else {
  const anchor = "const workerRequestId = String(body.request_id || body.worker_request_id || '');\n";
  if (!normalize.parameters.jsCode.includes(anchor)) throw new Error('Normalize Input anchor not found');
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(anchor, `${anchor}${memoNormalizeBlock}`);
}

const memoBuildCode = `const input = $json || {};
const safeEventHash = String(input.safe_event_hash || '').trim().toLowerCase();
const memoId = String(input.memo_id || '').trim().toLowerCase();
const content = String(input.canonical_content || '').trim();
const receivedAt = String(input.received_at || '').trim();
const delivery = input.reply_delivery_reference && typeof input.reply_delivery_reference === 'object'
  ? input.reply_delivery_reference
  : {};
const callbackUrl = String(delivery.callback_url || '');
const taskId = String(delivery.task_id || '').trim();
const requestId = String(delivery.request_id || '').trim();
const hashValid = /^[a-f0-9]{64}$/.test(safeEventHash);
const memoIdValid = memoId === \`memo-\${safeEventHash}\`;
const receivedAtValid = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(receivedAt)
  && Number.isFinite(Date.parse(receivedAt));
const allowedCallbackUrl = 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize';
const callbackValid = callbackUrl === allowedCallbackUrl;
const opaque = (value) => /^[A-Za-z0-9][A-Za-z0-9._:-]{7,191}$/.test(value);
const valid = input.intent === 'memo_create'
  && hashValid
  && memoIdValid
  && content.length > 0
  && content.length <= 4000
  && receivedAtValid
  && callbackValid
  && opaque(taskId)
  && opaque(requestId);
const memoJson = valid ? {
  schema: 'pline-memo/v1',
  memo_id: memoId,
  type: 'memo',
  content,
  status: 'active',
  created_at: receivedAt,
  updated_at: receivedAt,
  source: 'line'
} : null;
return [{ json: {
  intent: 'memo_create',
  valid,
  status: valid ? 'validated' : 'rejected',
  reason: valid ? '' : (!content ? 'empty_content' : (!callbackValid ? 'invalid_callback_url' : 'invalid_memo_contract')),
  memo_id: valid ? memoId : '',
  dropbox_path: valid ? \`/菲比工作總倉庫/00_INBOX_臨時丟進來/\${memoId}.json\` : '',
  staging_path: valid ? \`/菲比工作總倉庫/00_INBOX_臨時丟進來/.pline-stage-\${memoId}.tmp\` : '',
  memo_json: memoJson,
  memo_json_text: memoJson ? JSON.stringify(memoJson, null, 2) : '',
  callback_url: valid ? callbackUrl : '',
  task_id: valid ? taskId : '',
  request_id: valid ? requestId : ''
} }];
`;

const uploadOutcomeCode = `const response = $json || {};
const memo = $('Memo Build and Validate').first().json || {};
const commitFailed = typeof response.error === 'string' && response.error.length > 0;
const commitSucceeded = memo.valid === true && !commitFailed;
const readbackRequired = memo.valid === true;
return [{ json: {
  ...memo,
  upload_state: commitSucceeded ? 'created' : 'collision_or_failed',
  readback_required: readbackRequired,
  status: readbackRequired ? 'readback_required' : 'commit_failed',
  reason: readbackRequired ? '' : 'dropbox_commit_failed'
} }];`;

const verifyReadbackCode = `const response = $json || {};
const memo = $('Memo Upload Outcome').first().json || {};
const body = response.readback_json && typeof response.readback_json === 'object'
  ? response.readback_json
  : null;
const expected = memo.memo_json || {};
const keys = ['schema', 'memo_id', 'type', 'content', 'status', 'created_at', 'updated_at', 'source'];
const exactKeys = Boolean(body && typeof body === 'object' && !Array.isArray(body)
  && Object.keys(body).sort().join('|') === keys.slice().sort().join('|'));
const readbackValid = exactKeys
  && keys.every((key) => body[key] === expected[key]);
const collision = memo.upload_state !== 'created';
const terminalStatus = readbackValid ? (collision ? 'duplicate' : 'completed') : (collision ? 'conflict' : 'readback_failed');
return [{ json: {
  intent: 'memo_create',
  memo_id: memo.memo_id || '',
  callback_url: memo.callback_url || '',
  task_id: memo.task_id || '',
  request_id: memo.request_id || '',
  status: terminalStatus,
  readback_verified: readbackValid,
  callback_allowed: readbackValid,
  cleanup_required: collision,
  reply_text: readbackValid
    ? (collision ? '這筆備忘錄已經存好了。' : '已經幫妳把備忘錄存好了。')
    : (collision ? '這筆備忘錄與既有資料不一致，沒有覆蓋原檔。' : '備忘錄目前尚未完成。')
} }];`;

const cleanupOutcomeCode = `const response = $json || {};
const memo = $('Memo Verify Readback').first().json || {};
const cleanupFailed = typeof response.error === 'string' && response.error.length > 0;
return [{ json: {
  ...memo,
  cleanup_succeeded: !cleanupFailed,
  callback_allowed: memo.callback_allowed === true && !cleanupFailed,
  status: cleanupFailed ? 'cleanup_failed' : memo.status,
  reason: cleanupFailed ? 'dropbox_stage_cleanup_failed' : ''
} }];`;

const safeResultCode = `const input = $json || {};
const status = String(input.status || 'failed');
const empty = input.reason === 'empty_content';
return [{ json: {
  ok: false,
  intent: 'memo_create',
  status,
  memo_id: String(input.memo_id || ''),
  callback_sent: false,
  reply_text: empty
    ? '請在「備忘錄：」後面輸入要記錄的內容。'
    : String(input.reply_text || (status === 'conflict' ? '這筆備忘錄與既有資料不一致，沒有覆蓋原檔。' : '備忘錄目前尚未完成。')),
  reply_source: 'deterministic'
} }];`;

const callbackResultCode = `const response = $json || {};
const memo = $('Memo Verify Readback').first().json || {};
const statusCode = Number(response.statusCode || response.status || 0);
const accepted = statusCode >= 200 && statusCode < 300;
return [{ json: {
  ok: accepted,
  intent: 'memo_create',
  status: accepted ? memo.status : 'finalizer_failed',
  memo_id: memo.memo_id || '',
  callback_sent: accepted,
  reply_text: accepted ? memo.reply_text : '備忘錄已完成儲存，但回覆尚未確認。',
  reply_source: 'deterministic'
} }];`;

const nodes = [
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'memo-route-condition', leftValue: '={{ $json.intent }}', rightValue: 'memo_create', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'pline-v3-memo-create-route', name: 'Memo Create Route', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [-430, -120]
  },
  {
    parameters: { jsCode: memoBuildCode },
    id: 'pline-v3-memo-build', name: 'Memo Build and Validate', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-180, -180]
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'memo-valid-condition', leftValue: '={{ $json.valid }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'pline-v3-memo-valid-route', name: 'Memo Valid Route', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [50, -180]
  },
  preserveCredentials({
    parameters: {
      authentication: 'oAuth2',
      resource: 'file',
      operation: 'upload',
      path: "={{ $('Memo Build and Validate').first().json.staging_path }}",
      binaryData: false,
      fileContent: "={{ $('Memo Build and Validate').first().json.memo_json_text }}"
    },
    id: 'pline-v3-dropbox-stage-upload', name: 'Dropbox Stage Upload', type: 'n8n-nodes-base.dropbox', typeVersion: 1, position: [290, -300], onError: 'continueRegularOutput'
  }, existingDropboxCredentials),
  preserveCredentials({
    parameters: {
      authentication: 'oAuth2',
      resource: 'file',
      operation: 'move',
      path: "={{ $('Memo Build and Validate').first().json.staging_path }}",
      toPath: "={{ $('Memo Build and Validate').first().json.dropbox_path }}"
    },
    id: 'pline-v3-dropbox-commit-create-only', name: 'Dropbox Commit Create Only', type: 'n8n-nodes-base.dropbox', typeVersion: 1, position: [510, -300], onError: 'continueRegularOutput'
  }, existingDropboxCredentials),
  {
    parameters: { jsCode: uploadOutcomeCode },
    id: 'pline-v3-memo-upload-outcome', name: 'Memo Upload Outcome', type: 'n8n-nodes-base.code', typeVersion: 2, position: [730, -300]
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'memo-readback-condition', leftValue: '={{ $json.readback_required }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'pline-v3-memo-readback-route', name: 'Memo Readback Route', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [750, -260]
  },
  preserveCredentials({
    parameters: {
      authentication: 'oAuth2',
      resource: 'file',
      operation: 'download',
      path: "={{ $('Memo Build and Validate').first().json.dropbox_path }}",
      binaryPropertyName: 'data'
    },
    id: 'pline-v3-dropbox-readback', name: 'Dropbox Readback', type: 'n8n-nodes-base.dropbox', typeVersion: 1, position: [1180, -380], onError: 'continueRegularOutput'
  }, existingDropboxCredentials),
  {
    parameters: {
      operation: 'fromJson',
      binaryPropertyName: 'data',
      destinationKey: 'readback_json',
      options: { encoding: 'utf8', stripBOM: true, keepSource: 'json' }
    },
    id: 'pline-v3-memo-extract-readback', name: 'Memo Extract Readback', type: 'n8n-nodes-base.extractFromFile', typeVersion: 1.1, position: [1400, -380], onError: 'continueRegularOutput'
  },
  {
    parameters: { jsCode: verifyReadbackCode },
    id: 'pline-v3-memo-verify-readback', name: 'Memo Verify Readback', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1620, -380]
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'memo-cleanup-condition', leftValue: '={{ $json.cleanup_required }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'pline-v3-memo-cleanup-route', name: 'Memo Cleanup Route', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1840, -380]
  },
  preserveCredentials({
    parameters: {
      authentication: 'oAuth2',
      resource: 'file',
      operation: 'delete',
      path: "={{ $('Memo Build and Validate').first().json.staging_path }}"
    },
    id: 'pline-v3-dropbox-stage-cleanup', name: 'Dropbox Stage Cleanup', type: 'n8n-nodes-base.dropbox', typeVersion: 1, position: [2060, -500], onError: 'continueRegularOutput'
  }, existingDropboxCredentials),
  {
    parameters: { jsCode: cleanupOutcomeCode },
    id: 'pline-v3-memo-cleanup-outcome', name: 'Memo Cleanup Outcome', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2280, -500]
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'memo-callback-condition', leftValue: '={{ $json.callback_allowed }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'pline-v3-memo-callback-route', name: 'Memo Callback Route', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [2500, -380]
  },
  preserveCredentials({
    parameters: {
      method: 'POST',
      url: '={{ $json.callback_url }}',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: "={{ JSON.stringify({ task_id: $json.task_id, request_id: $json.request_id, status: $json.status, operation: 'memo_create', memo_id: $json.memo_id, reply_text: $json.reply_text }) }}",
      options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } }
    },
    id: 'pline-v3-memo-finalizer-callback', name: 'Memo Finalizer Callback', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2720, -460], onError: 'continueRegularOutput'
  }, existingCallbackCredentials),
  {
    parameters: { jsCode: callbackResultCode },
    id: 'pline-v3-memo-callback-result', name: 'Memo Callback Result', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2940, -460]
  },
  {
    parameters: { jsCode: safeResultCode },
    id: 'pline-v3-memo-safe-result', name: 'Memo Safe Result', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2720, -160]
  }
];

const replaceNames = new Set([
  ...nodes.map((node) => node.name),
  'Dropbox Create If Absent'
]);
workflow.nodes = workflow.nodes.filter((node) => !replaceNames.has(node.name));
workflow.nodes.push(...nodes);

for (const name of replaceNames) delete workflow.connections[name];

workflow.connections['Normalize Input'] = { main: [[{ node: 'Memo Create Route', type: 'main', index: 0 }]] };
workflow.connections['Memo Create Route'] = { main: [
  [{ node: 'Memo Build and Validate', type: 'main', index: 0 }],
  [{ node: 'AI Agent', type: 'main', index: 0 }]
] };
workflow.connections['Memo Build and Validate'] = { main: [[{ node: 'Memo Valid Route', type: 'main', index: 0 }]] };
workflow.connections['Memo Valid Route'] = { main: [
  [{ node: 'Dropbox Stage Upload', type: 'main', index: 0 }],
  [{ node: 'Memo Safe Result', type: 'main', index: 0 }]
] };
workflow.connections['Dropbox Stage Upload'] = { main: [[{ node: 'Dropbox Commit Create Only', type: 'main', index: 0 }]] };
workflow.connections['Dropbox Commit Create Only'] = { main: [[{ node: 'Memo Upload Outcome', type: 'main', index: 0 }]] };
workflow.connections['Memo Upload Outcome'] = { main: [[{ node: 'Memo Readback Route', type: 'main', index: 0 }]] };
workflow.connections['Memo Readback Route'] = { main: [
  [{ node: 'Dropbox Readback', type: 'main', index: 0 }],
  [{ node: 'Memo Safe Result', type: 'main', index: 0 }]
] };
workflow.connections['Dropbox Readback'] = { main: [[{ node: 'Memo Extract Readback', type: 'main', index: 0 }]] };
workflow.connections['Memo Extract Readback'] = { main: [[{ node: 'Memo Verify Readback', type: 'main', index: 0 }]] };
workflow.connections['Memo Verify Readback'] = { main: [[{ node: 'Memo Cleanup Route', type: 'main', index: 0 }]] };
workflow.connections['Memo Cleanup Route'] = { main: [
  [{ node: 'Dropbox Stage Cleanup', type: 'main', index: 0 }],
  [{ node: 'Memo Callback Route', type: 'main', index: 0 }]
] };
workflow.connections['Dropbox Stage Cleanup'] = { main: [[{ node: 'Memo Cleanup Outcome', type: 'main', index: 0 }]] };
workflow.connections['Memo Cleanup Outcome'] = { main: [[{ node: 'Memo Callback Route', type: 'main', index: 0 }]] };
workflow.connections['Memo Callback Route'] = { main: [
  [{ node: 'Memo Finalizer Callback', type: 'main', index: 0 }],
  [{ node: 'Memo Safe Result', type: 'main', index: 0 }]
] };
workflow.connections['Memo Finalizer Callback'] = { main: [[{ node: 'Memo Callback Result', type: 'main', index: 0 }]] };
workflow.connections['Memo Callback Result'] = { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] };
workflow.connections['Memo Safe Result'] = { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] };

workflow.workflow_version_name = 'Memo Create Deterministic Fast Path Implementation';
workflow.memo_create_cloud_writer_contract = {
  intent: 'memo_create',
  ai_agent_bypass: true,
  active_dropbox_path: '/菲比工作總倉庫/00_INBOX_臨時丟進來',
  filename: '<memo_id>.json',
  create_if_absent: { strategy: 'native_stage_then_move_v2', autorename: false, overwrite_final: false },
  staging_cleanup_on_collision: true,
  readback_required: true,
  finalizer_after_terminal_readback_only: true,
  callback_auth: 'header_auth_credential_reference_required',
  callback_payload_credential_absent: true,
  processing_push: false,
  worker_deployment_required_in_next_gate: false,
  credentials_exported: false
};

await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
