import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = JSON.parse(await readFile(new URL('./N8N_WORKFLOW_PLINE_V3_TEST_AI_AGENT.json', import.meta.url), 'utf8'));
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const nextNodes = (name, output = 0) => (workflow.connections[name]?.main?.[output] || []).map((edge) => edge.node);

function runCode(name, json, nodeOutputs = {}) {
  const jsCode = byName(name)?.parameters?.jsCode;
  assert.equal(typeof jsCode, 'string', `${name} code missing`);
  const readNode = (nodeName) => ({ first: () => ({ json: nodeOutputs[nodeName] || {} }) });
  return new Function('$json', '$', jsCode)(json, readNode)[0].json;
}

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};

const memoId = `memo-${'a'.repeat(64)}`;
const callbackUrl = 'https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize';
const terminal = (operation) => ({
  intent: operation,
  operation,
  status: 'completed',
  memo_id: memoId,
  callback_url: callbackUrl,
  task_id: 'memo-task-opaque-0001',
  request_id: 'memo-request-opaque-0001',
  reply_token: 'forbidden-reply-token',
  user_id: 'forbidden-user-id',
  content: 'forbidden-private-content',
});

check('Create Modify Delete terminal success enters the natural bridge while Search stays unchanged', () => {
  assert.deepEqual(nextNodes('Memo Callback Route', 0), ['Memo Success Natural Reply Input']);
  assert.deepEqual(nextNodes('Memo Modify Verify Readback'), ['Memo Success Natural Reply Input']);
  assert.deepEqual(nextNodes('Memo Delete Verify Readback'), ['Memo Success Natural Reply Input']);
  assert.deepEqual(nextNodes('Memo Search Aggregate'), ['Memo CRUD Finalizer Payload']);
  assert.deepEqual(nextNodes('Memo Search Invalid Result'), ['Memo CRUD Finalizer Payload']);
});

check('natural-language input contains only operation terminal status locale and style', () => {
  for (const operation of ['memo_create', 'memo_modify', 'memo_delete']) {
    const result = runCode('Memo Success Natural Reply Input', terminal(operation));
    assert.deepEqual(Object.keys(result).sort(), ['locale', 'operation', 'style', 'terminal_status']);
    assert.equal(result.operation, operation);
    assert.equal(result.terminal_status, 'completed');
    assert.equal(result.locale, 'zh-TW');
    assert.equal(result.style, 'natural_concise');
    const serialized = JSON.stringify(result);
    for (const forbidden of [memoId, 'forbidden-reply-token', 'forbidden-user-id', 'forbidden-private-content']) {
      assert.equal(serialized.includes(forbidden), false);
    }
  }
});

check('normal success path uses a tool-free Basic LLM Chain and the existing OpenAI model', () => {
  const chain = byName('Memo Success Natural Reply Chain');
  assert.equal(chain.type, '@n8n/n8n-nodes-langchain.chainLlm');
  assert.equal(chain.onError, 'continueRegularOutput');
  assert.match(chain.parameters.text, /operation/);
  assert.doesNotMatch(chain.parameters.text, /memo_id|replyToken|user_id|content|path/i);
  const languageTargets = workflow.connections['OpenAI Chat Model'].ai_languageModel[0].map((edge) => edge.node);
  assert.deepEqual(languageTargets.sort(), ['AI Agent', 'Memo Success Natural Reply Chain'].sort());
  assert.equal(workflow.connections['Memo Success Natural Reply Chain'].ai_tool, undefined);
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    const toolTargets = (outputs.ai_tool || []).flat().map((edge) => edge.node);
    assert.equal(toolTargets.includes('Memo Success Natural Reply Chain'), false, `${source} connects a tool to the bridge`);
  }
});

check('valid natural Traditional Chinese output is preserved as AI generated', () => {
  const safeInput = runCode('Memo Success Natural Reply Input', terminal('memo_create'));
  const result = runCode('Memo Success Natural Reply Guard', {
    text: '已經幫妳存好了，晚點想找時再告訴我。',
  }, { 'Memo Success Natural Reply Input': safeInput });
  assert.equal(result.reply_source, 'ai_generated');
  assert.equal(result.reply_text, '已經幫妳存好了，晚點想找時再告訴我。');
  assert.equal('memo_id' in result, false);
});

check('AI output containing memo identity path or engineering fields is rejected without leakage', () => {
  for (const [operation, leaked, fallback] of [
    ['memo_create', `已完成，備忘錄編號：${memoId}`, '好，我幫妳記好了。'],
    ['memo_modify', '已更新 /菲比/active/memo.json', '好，我幫妳改好了。'],
    ['memo_delete', 'JSON task_id 已完成', '好，我幫妳刪除了。'],
  ]) {
    const safeInput = runCode('Memo Success Natural Reply Input', terminal(operation));
    const result = runCode('Memo Success Natural Reply Guard', { output: leaked }, {
      'Memo Success Natural Reply Input': safeInput,
    });
    assert.equal(result.reply_source, 'safe_fallback');
    assert.equal(result.reply_text, fallback);
    assert.equal(JSON.stringify(result).includes(memoId), false);
  }
});

check('AI timeout missing text malformed JSON and simplified output use a no-ID fallback', () => {
  const safeInput = runCode('Memo Success Natural Reply Input', terminal('memo_modify'));
  for (const response of [
    { error: 'timeout' },
    { text: '' },
    { text: '{not-json' },
    { text: '我帮你改好了。' },
  ]) {
    const result = runCode('Memo Success Natural Reply Guard', response, {
      'Memo Success Natural Reply Input': safeInput,
    });
    assert.equal(result.reply_source, 'safe_fallback');
    assert.equal(result.reply_text, '好，我幫妳改好了。');
    assert.doesNotMatch(result.reply_text, /memo-|備忘錄編號/);
  }
});

check('identity is attached only after the safe result and finalizer payload remains exact', () => {
  const guarded = {
    operation: 'memo_delete',
    terminal_status: 'completed',
    locale: 'zh-TW',
    style: 'natural_concise',
    reply_text: '好，我幫妳刪除了。',
    reply_source: 'ai_generated',
  };
  const payload = runCode('Memo Success Natural Reply Finalizer Payload', guarded, {
    'Memo Delete Verify Readback': terminal('memo_delete'),
  });
  assert.equal(payload.operation, 'memo_delete');
  assert.equal(payload.memo_id, memoId);
  assert.equal(payload.reply_text, guarded.reply_text);
  assert.equal(payload.reply_source, 'ai_generated');
  assert.deepEqual(Object.keys(payload).sort(), [
    'callback_url', 'memo_id', 'operation', 'reply_source', 'reply_text', 'request_id', 'status', 'task_id'
  ].sort());
});

check('callback success result contains no memo identity and callback body stays credential-free', () => {
  const callback = byName('Memo Finalizer Callback');
  const resultCode = byName('Memo Callback Result').parameters.jsCode;
  assert.match(callback.parameters.body, /operation:\s*\$json\.operation/);
  assert.doesNotMatch(callback.parameters.body, /finalize_token|credential|secret|replyToken|user_id/);
  assert.doesNotMatch(resultCode, /memo_id/);
  assert.doesNotMatch(resultCode, /finalize_token|credential|secret|replyToken|user_id/);
});

check('contract is bounded safe and does not change Search or tool routes', () => {
  assert.equal(byName('Memo Success Natural Reply Chain').type, '@n8n/n8n-nodes-langchain.chainLlm');
  assert.equal(Object.hasOwn(workflow.connections['Memo Success Natural Reply Chain'] || {}, 'ai_tool'), false);
  assert.deepEqual(nextNodes('Memo Search Aggregate'), ['Memo CRUD Finalizer Payload']);
  assert.match(byName('Memo Success Natural Reply Guard').parameters.jsCode, /forbidden[\s\S]*replyToken/);
  assert.deepEqual(nextNodes('Memo Success Natural Reply Input'), ['Memo Success Natural Reply Chain']);
  assert.deepEqual(nextNodes('Memo Success Natural Reply Chain'), ['Memo Success Natural Reply Guard']);
  assert.deepEqual(nextNodes('Memo Success Natural Reply Guard'), ['Memo Success Natural Reply Finalizer Payload']);
  assert.deepEqual(nextNodes('Memo Success Natural Reply Finalizer Payload'), ['Memo Finalizer Callback']);
});

const serialized = JSON.stringify(workflow);
for (const forbidden of ['forbidden-reply-token', 'forbidden-user-id', 'forbidden-private-content']) {
  assert.equal(serialized.includes(forbidden), false);
}

console.log(`PASS ${passed}/${passed} Memo Success Natural Reply Bridge offline checks`);
