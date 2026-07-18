import assert from "node:assert/strict";
import {
  codexTaskCapabilityCheck,
  extractGateMarker,
  enqueueCodexTask,
  enqueueIdeaTask,
  handleCodexFinalize,
  handleEvidenceRead,
  handleEvidenceSelfcheck,
  handleIdeaFinalize,
  handleLineWebhook,
  lineAuthorizationHeader,
  markLineMessageAsRead,
  markLineMessageAsReadForEvent,
  n8nResponseRequestIdentity,
  n8nResponseShape,
  n8nWebhookAttribution,
  normalizeN8nResponseBody,
  normalizeReplyText,
  persistEvidenceStage,
  processN8nInBackground,
  readEvidenceForRequest,
  replyToLine,
  summarizeEvidenceStages,
  validateN8nContract,
  verifyAdmin,
  workerHealth,
} from "../src/index.js";

const originalFetch = globalThis.fetch;
const health = workerHealth({});
assert.equal(health.worker, "pline-v3-test-line-gateway");
assert.equal(health.resources.runtime_kv, "pline-v3-test-runtime");
assert.equal(health.resources.idempotency_kv, "pline-v3-test-idempotency");
assert.equal(health.n8n.webhook_url, "https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent");
assert.deepEqual(health.n8n.webhook_target, {
  host: "n8nphy.app.n8n.cloud",
  path: "/webhook/pline-v3-test-ai-agent",
  route_type: "production",
  workflow_hint: "pline-v3-test-ai-agent",
  path_fingerprint: n8nWebhookAttribution("https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent").path_fingerprint,
});
assert.equal(health.n8n.shared_secret_header, "x-pline-v3-shared-secret");
assert.equal(health.line_reply_mode, "no_visible_ack_background_n8n");
assert.deepEqual(health.line_mark_as_read, {
  enabled: false,
  mode: "disabled_chat_off_auto_read",
  endpoint: "https://api.line.me/v2/bot/chat/markAsRead",
  token_source: "message.markAsReadToken",
  evidence_completed_stage: "line_mark_as_read_completed",
  evidence_disabled_stage: "line_mark_as_read_skipped_disabled",
  evidence_skipped_stage: "line_mark_as_read_skipped_no_token",
  evidence_failed_stage: "line_mark_as_read_failed",
  transient_token_only: true,
});
assert.equal(health.codex_task_final_mode, "monitor_callback_exactly_once");
assert.equal(health.evidence.persistence, "RUNTIME_KV");
assert.equal(health.evidence.read_path, "/test/evidence");
assert.equal(health.evidence.selfcheck_path, "/test/evidence/selfcheck");
assert.equal(health.evidence.guard_header, "x-pline-v3-shared-secret");
assert.equal(health.evidence.selfcheck_guard_header, "x-pline-v3-selftest-secret");
assert.equal(health.evidence.runtime_kv_bound, false);
assert.equal(health.evidence.selfcheck_secret_configured, false);
assert.equal(health.codex_monitor.name, "pline-v3-test-codex-monitor");
assert.deepEqual(health.codex_monitor.task_prefixes, ["codex_task:v1", "idea_json:v1"]);
assert.deepEqual(health.codex_monitor.actions, ["create_smoke_file", "save_idea_json"]);
assert.equal(health.codex_monitor.target_path, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt");
assert.equal(health.codex_monitor.target_content, "Codex 任務測試成功");
assert.equal(health.codex_monitor.dropbox_idea_dir, "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03");
assert.deepEqual(health.supported_intents, ["idea_create", "codex_task", "clarify", "unsupported"]);
assert.deepEqual(health.gate_test_intents, ["idea_create", "codex_task"]);
assert.equal(health.required_env.N8N_WEBHOOK_URL, false);
assert.deepEqual(lineAuthorizationHeader({ LINE_CHANNEL_ACCESS_TOKEN: "test-token" }), {
  ok: true,
  value: "Bearer test-token",
});
assert.deepEqual(lineAuthorizationHeader({ LINE_CHANNEL_ACCESS_TOKEN: "test-token" }), {
  ok: true,
  value: "Bearer test-token",
});

const markReadCalls = [];
globalThis.fetch = async (url, options) => {
  markReadCalls.push({ url, options });
  return new Response("", { status: 200 });
};
assert.deepEqual(await markLineMessageAsRead("READ-MARK-UNIT", { LINE_CHANNEL_ACCESS_TOKEN: "test-token" }), { ok: true, status: 200 });
assert.equal(markReadCalls.length, 1);
assert.equal(markReadCalls[0].url, "https://api.line.me/v2/bot/chat/markAsRead");
assert.equal(markReadCalls[0].options.headers.authorization, "Bearer test-token");
assert.deepEqual(JSON.parse(markReadCalls[0].options.body), { markAsReadToken: "READ-MARK-UNIT" });
globalThis.fetch = originalFetch;

const markReadSkipKv = createMemoryKv();
assert.deepEqual(await markLineMessageAsReadForEvent({
  message: { type: "text" },
}, {
  request_id: "pline-v3-MARK-SKIP",
  gate_marker: "T1601-20260718010101",
}, {
  RUNTIME_KV: markReadSkipKv,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_MARK_AS_READ_ENABLED: "true",
}), { ok: true, skipped: true, reason: "missing_mark_as_read_token" });
const markReadSkipEvidence = await readEvidenceForRequest({ RUNTIME_KV: markReadSkipKv }, "pline-v3-MARK-SKIP");
assert.equal(markReadSkipEvidence.stages.some((stage) => stage.stage === "line_mark_as_read_skipped_no_token"), true);

const markReadDisabledKv = createMemoryKv();
const markReadDisabledCalls = [];
globalThis.fetch = async (url) => {
  markReadDisabledCalls.push(url);
  return new Response("", { status: 200 });
};
assert.deepEqual(await markLineMessageAsReadForEvent({
  message: { type: "text", markAsReadToken: "READ-MARK-DISABLED" },
}, {
  request_id: "pline-v3-MARK-DISABLED",
  gate_marker: "T1601D-20260718010101",
}, {
  RUNTIME_KV: markReadDisabledKv,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
}), { ok: true, skipped: true, reason: "LINE_MARK_AS_READ_DISABLED" });
assert.deepEqual(markReadDisabledCalls, []);
const markReadDisabledEvidence = await readEvidenceForRequest({ RUNTIME_KV: markReadDisabledKv }, "pline-v3-MARK-DISABLED");
assert.equal(markReadDisabledEvidence.stages.some((stage) => stage.stage === "line_mark_as_read_skipped_disabled"), true);
assert.equal(JSON.stringify(markReadDisabledEvidence).includes("READ-MARK-DISABLED"), false);
globalThis.fetch = originalFetch;

assert.deepEqual(await verifyAdmin({ source: { userId: "U_TEST" } }, { LINE_TEST_ADMIN_USER_IDS: "U_TEST" }), { ok: true });
assert.equal((await verifyAdmin({ source: { userId: "U_OTHER" } }, { LINE_TEST_ADMIN_USER_IDS: "U_TEST" })).reason, "not_test_admin");

const bootstrapWrites = [];
const bootstrapResult = await verifyAdmin({
  source: { userId: "U_BOOTSTRAP" },
  message: { text: "PLine03 admin bootstrap" },
}, {
  LINE_TEST_ADMIN_USER_IDS: "CAPTURE_CURRENT_03_EVENT",
  RUNTIME_KV: {
    put: async (key, value) => bootstrapWrites.push({ key, value }),
  },
});
assert.equal(bootstrapResult.ok, true);
assert.equal(bootstrapResult.bootstrapped, true);
assert.deepEqual(bootstrapWrites, [{ key: "admin:line_test_admin_user_id", value: "U_BOOTSTRAP" }]);
assert.equal((await verifyAdmin({
  source: { userId: "U_BOOTSTRAP" },
  message: { text: "wrong" },
}, {
  LINE_TEST_ADMIN_USER_IDS: "CAPTURE_CURRENT_03_EVENT",
  RUNTIME_KV: { put: async () => {} },
})).reason, "admin_bootstrap_phrase_required");

assert.equal(extractGateMarker("記一下：今天開始建立 _03 T1201-20260718010102"), "T1201-20260718010102");
assert.equal(extractGateMarker("記一下：今天開始建立 _03 T1201B-20260718010103"), "T1201B-20260718010103");
assert.equal(extractGateMarker("沒有時間碼"), "");

const evidenceKv = createMemoryKv();
await persistEvidenceStage({
  RUNTIME_KV: evidenceKv,
}, {
  request_id: "pline-v3-EVIDENCE1",
  user_id: "U_SHOULD_NOT_BE_STORED",
  message_text: "記一下：今天開始建立 _03 T1201-20260718010102",
  gate_marker: "T1201-20260718010102",
}, "line_event_received", {
  marker: "T1201-20260718010102",
});
await persistEvidenceStage({
  RUNTIME_KV: evidenceKv,
}, {
  request_id: "pline-v3-EVIDENCE1",
  gate_marker: "T1201-20260718010102",
}, "n8n_background_completed", {
  intent: "idea_create",
  status: "completed",
  tool_called: "idea_create",
  saved_record: 1,
  message_text: "SHOULD_NOT_BE_STORED",
  user_id: "U_SHOULD_NOT_BE_STORED",
});
const evidenceRead = await readEvidenceForRequest({ RUNTIME_KV: evidenceKv }, "pline-v3-EVIDENCE1");
assert.equal(evidenceRead.stages.length, 2);
assert.equal(evidenceRead.marker, "T1201-20260718010102");
assert.deepEqual(summarizeEvidenceStages(evidenceRead.stages), {
  line_event: true,
  signature: false,
  admin: false,
  idempotency: false,
  fast_ack: false,
  visible_ack_skipped: false,
  webhook_http_200: false,
  n8n_started: false,
  n8n_completed: true,
  n8n_failed: false,
  intent: "idea_create",
  tool_called: "idea_create",
  saved_record: 1,
  codex_task: 0,
  action: "",
  final_push: false,
});
const evidenceBlob = JSON.stringify(evidenceRead);
assert.equal(evidenceBlob.includes("U_SHOULD_NOT_BE_STORED"), false);
assert.equal(evidenceBlob.includes("SHOULD_NOT_BE_STORED"), false);
assert.equal(evidenceBlob.includes("今天開始建立"), false);

const rejectedEvidenceRead = await handleEvidenceRead(new Request("https://worker.example.test/test/evidence?marker=T1201-20260718010102"), {
  RUNTIME_KV: evidenceKv,
  N8N_SHARED_SECRET: "unit-shared-secret",
});
assert.equal(rejectedEvidenceRead.status, 401);
const acceptedEvidenceRead = await handleEvidenceRead(new Request("https://worker.example.test/test/evidence?marker=T1201-20260718010102", {
  headers: { "x-pline-v3-shared-secret": "unit-shared-secret" },
}), {
  RUNTIME_KV: evidenceKv,
  N8N_SHARED_SECRET: "unit-shared-secret",
});
assert.equal(acceptedEvidenceRead.status, 200);
const acceptedEvidenceBody = await acceptedEvidenceRead.json();
assert.equal(acceptedEvidenceBody.request_id, "pline-v3-EVIDENCE1");
assert.equal(acceptedEvidenceBody.summary.n8n_completed, true);
const acceptedEvidenceReadBySelftest = await handleEvidenceRead(new Request("https://worker.example.test/test/evidence?marker=T1201-20260718010102", {
  headers: { "x-pline-v3-selftest-secret": "unit-selftest-secret" },
}), {
  RUNTIME_KV: evidenceKv,
  EVIDENCE_SELFTEST_SECRET: "unit-selftest-secret",
});
assert.equal(acceptedEvidenceReadBySelftest.status, 200);

const selfcheckKv = createMemoryKv();
const rejectedSelfcheck = await handleEvidenceSelfcheck(new Request("https://worker.example.test/test/evidence/selfcheck", {
  method: "POST",
}), {
  RUNTIME_KV: selfcheckKv,
  EVIDENCE_SELFTEST_SECRET: "unit-selftest-secret",
});
assert.equal(rejectedSelfcheck.status, 401);
const acceptedSelfcheck = await handleEvidenceSelfcheck(new Request("https://worker.example.test/test/evidence/selfcheck?marker=T1601-20260718010203&request_id=pline-v3-selfcheck-unit", {
  method: "POST",
  headers: { "x-pline-v3-selftest-secret": "unit-selftest-secret" },
}), {
  RUNTIME_KV: selfcheckKv,
  EVIDENCE_SELFTEST_SECRET: "unit-selftest-secret",
});
assert.equal(acceptedSelfcheck.status, 200);
const acceptedSelfcheckBody = await acceptedSelfcheck.json();
assert.equal(acceptedSelfcheckBody.status, "ok");
assert.equal(acceptedSelfcheckBody.marker, "T1601-20260718010203");
assert.equal(acceptedSelfcheckBody.request_id, "pline-v3-selfcheck-unit");
assert.equal(acceptedSelfcheckBody.marker_roundtrip, true);
assert.equal(acceptedSelfcheckBody.stage_names.includes("selfcheck_started"), true);
assert.equal(acceptedSelfcheckBody.stage_names.includes("selfcheck_completed"), true);
assert.equal(await selfcheckKv.get("evidence:v1:marker:T1601-20260718010203"), "pline-v3-selfcheck-unit");

const ideaResult = validateN8nContract({
  request_id: "pline-v3-E1",
  intent: "idea_create",
  reply_text: "已記下",
  tool_called: "idea_create",
  saved_record: 1,
  status: "completed",
}, "pline-v3-E1");
assert.equal(ideaResult.ok, true);

const codexResult = validateN8nContract({
  request_id: "pline-v3-E2",
  intent: "codex_task",
  reply_text: "收到，我開始處理囉。",
  tool_called: "codex_task",
  task_id: "T1",
  action: "create_smoke_file",
  status: "completed",
}, "pline-v3-E2");
assert.equal(codexResult.ok, true);

assert.deepEqual(normalizeN8nResponseBody([{ json: {
  request_id: "pline-v3-E2",
  intent: "idea_create",
} }]), {
  request_id: "pline-v3-E2",
  intent: "idea_create",
});
assert.deepEqual(normalizeN8nResponseBody({ body: { request_id: "pline-v3-WRAP-BODY", intent: "idea_create" } }), {
  request_id: "pline-v3-WRAP-BODY",
  intent: "idea_create",
});
assert.deepEqual(normalizeN8nResponseBody({ output: JSON.stringify({ request_id: "pline-v3-WRAP-OUTPUT", intent: "idea_create" }) }), {
  request_id: "pline-v3-WRAP-OUTPUT",
  intent: "idea_create",
});
assert.deepEqual(n8nResponseShape({ body: { request_id: "pline-v3-SHAPE", intent: "idea_create" } }), {
  shape: "object",
  top_keys: "body",
  nested_keys: "body:intent,request_id",
});

assert.equal(validateN8nContract([{ json: {
  request_id: "pline-v3-E5",
  intent: "idea_create",
  reply_text: "已記下",
  tool_called: "idea_create",
  saved_record: 1,
  status: "completed",
} }], "pline-v3-E5").ok, true);
assert.equal(validateN8nContract({
  request_id: "pline-v3-E5B",
  intent: "idea_create",
  tool_called: "idea_create",
  saved_record: 1,
  status: "completed",
}, "pline-v3-E5B").ok, true);
assert.deepEqual(n8nResponseRequestIdentity({ worker_request_id: "pline-v3-CANON", request_id: "ai-wrong-id" }), {
  value: "pline-v3-CANON",
  source: "worker_request_id",
});
const workerRequestIdResult = validateN8nContract({
  request_id: "ai-wrong-id",
  worker_request_id: "pline-v3-CANON",
  canonicalRequestId: "pline-v3-CANON",
  intent: "idea_create",
  reply_text: "已記下",
  tool_called: "idea_create",
  saved_record: 1,
  status: "completed",
}, "pline-v3-CANON");
assert.equal(workerRequestIdResult.ok, true);
assert.equal(workerRequestIdResult.body.request_id, "pline-v3-CANON");
const canonicalRequestIdResult = validateN8nContract({
  request_id: "ai-wrong-id",
  canonicalRequestId: "pline-v3-CANON-2",
  intent: "idea_create",
  reply_text: "已記下",
  tool_called: "idea_create",
  saved_record: 1,
  status: "completed",
}, "pline-v3-CANON-2");
assert.equal(canonicalRequestIdResult.ok, true);
assert.equal(canonicalRequestIdResult.body.request_id, "pline-v3-CANON-2");

const clarifyResult = validateN8nContract({
  request_id: "pline-v3-E3",
  intent: "clarify",
  reply_text: "",
  status: "accepted",
}, "pline-v3-E3");
assert.equal(clarifyResult.ok, true);
assert.equal(clarifyResult.body.reply_text, "請再補充一句你想記錄或請 Codex 執行的內容。");

const unsupportedResult = validateN8nContract({
  request_id: "pline-v3-E4",
  intent: "unsupported",
  status: "completed",
}, "pline-v3-E4");
assert.equal(unsupportedResult.ok, true);
assert.equal(unsupportedResult.body.reply_text, "目前我只能先幫妳記想法，或處理指定的小任務。");

assert.equal(normalizeReplyText("idea_create", ""), "");
assert.deepEqual(codexTaskCapabilityCheck("請 Codex 執行最小任務測試，建立測試檔案").ok, true);
assert.equal(codexTaskCapabilityCheck("請 Codex 幫我用computer use開啟一個新的網頁").reason, "capability_not_yet_enabled");

assert.equal(validateN8nContract({
  request_id: "pline-v3-E2",
  intent: "codex_task",
  reply_text: "收到，我開始處理囉。",
  tool_called: "codex_task",
  action: "create_smoke_file",
  status: "completed",
}, "pline-v3-E2").reason, "missing_task_id");
assert.equal(validateN8nContract({
  request_id: "pline-v3-E6",
  intent: "idea_create",
  reply_text: "已記下",
  status: "completed",
}, "pline-v3-E6").reason, "missing_idea_create_tool_called");

let replyRequest = null;
globalThis.fetch = async (url, options) => {
  replyRequest = { url, options };
  return new Response("", { status: 200 });
};
assert.equal((await replyToLine("reply-token", "已收到", { LINE_CHANNEL_ACCESS_TOKEN: "test-token" })).ok, true);
assert.equal(replyRequest.url, "https://api.line.me/v2/bot/message/reply");
assert.equal(replyRequest.options.headers.authorization, "Bearer test-token");
assert.equal(replyRequest.options.headers["content-type"], "application/json");
assert.deepEqual(JSON.parse(replyRequest.options.body), {
  replyToken: "reply-token",
  messages: [{ type: "text", text: "已收到" }],
});
globalThis.fetch = originalFetch;

const backgroundCalls = [];
globalThis.fetch = async (url) => {
  backgroundCalls.push(url);
  return new Response(JSON.stringify({
    request_id: "pline-v3-BG1",
    intent: "idea_create",
    reply_text: "已記下",
    tool_called: "idea_create",
    saved_record: 1,
    status: "completed",
  }), { status: 200 });
};
const backgroundResult = await processN8nInBackground({
  request_id: "pline-v3-BG1",
  line_event_id: "BG1",
  reply_token: "reply-token",
  user_id: "U_TEST",
  message_text: "記一下：背景測試",
  received_at: "2026-07-18T00:00:00.000Z",
}, {
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
});
assert.equal(backgroundResult.ok, true);
assert.equal(backgroundResult.intent, "idea_create");
assert.deepEqual(backgroundCalls, ["https://n8n.example.test/webhook"]);
globalThis.fetch = originalFetch;

const codexBackgroundCalls = [];
const codexTaskKv = createMemoryKv();
globalThis.fetch = async (url) => {
  codexBackgroundCalls.push(url);
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  if (url === "https://api.line.me/v2/bot/chat/markAsRead") {
    return new Response("", { status: 200 });
  }
  return new Response(JSON.stringify({
    request_id: "pline-v3-BG2",
    intent: "codex_task",
    reply_text: "Codex 任務已建立。",
    tool_called: "codex_task",
    task_id: "T1",
    codex_task: 1,
    action: "create_smoke_file",
    status: "completed",
  }), { status: 200 });
};
const codexBackgroundResult = await processN8nInBackground({
  request_id: "pline-v3-BG2",
  line_event_id: "BG2",
  reply_token: "reply-token",
  user_id: "U_TEST",
  message_text: "請 Codex 在 _03 專案建立測試檔案",
  received_at: "2026-07-18T00:00:00.000Z",
}, {
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  RUNTIME_KV: codexTaskKv,
});
assert.equal(codexBackgroundResult.ok, true);
assert.equal(codexBackgroundResult.intent, "codex_task");
assert.deepEqual(codexBackgroundCalls, [
  "https://n8n.example.test/webhook",
  "https://api.line.me/v2/bot/message/push",
]);
const codexTaskKeys = await codexTaskKv.list({ prefix: "codex_task:v1:task:" });
assert.equal(codexTaskKeys.keys.length, 1);
const codexPendingKeys = await codexTaskKv.list({ prefix: "codex_task:v1:pending:" });
assert.deepEqual(codexPendingKeys.keys.map((key) => key.name), ["codex_task:v1:pending:T1"]);
const codexTaskRecord = JSON.parse(await codexTaskKv.get(codexTaskKeys.keys[0].name));
assert.equal(codexTaskRecord.status, "queued");
assert.equal(codexTaskRecord.task_id, "T1");
assert.equal(codexTaskRecord.task_type, "codex_task");
assert.equal(codexTaskRecord.project, "PLine03 safe smoke");
assert.equal(codexTaskRecord.project_path, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke");
assert.equal(codexTaskRecord.instruction, "Create or overwrite the fixed smoke file with the fixed smoke content.");
assert.equal(codexTaskRecord.request_id, "pline-v3-BG2");
assert.equal(codexTaskRecord.action, "create_smoke_file");
assert.equal(codexTaskRecord.target_path, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt");
assert.equal(codexTaskRecord.content, "Codex 任務測試成功");
assert.equal(typeof codexTaskRecord.finalize_token, "string");
assert.equal(codexTaskRecord.line_user_ref.includes("U_TEST"), false);
globalThis.fetch = originalFetch;

const capabilityNotEnabledCodexCalls = [];
const capabilityNotEnabledCodexKv = createMemoryKv();
globalThis.fetch = async (url) => {
  capabilityNotEnabledCodexCalls.push(url);
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  return new Response(JSON.stringify({
    request_id: "pline-v3-BG2-UNSUPPORTED",
    intent: "codex_task",
    reply_text: "收到，我開始處理囉。",
    tool_called: "codex_task",
    task_id: "T-UNSUPPORTED",
    codex_task: 1,
    action: "create_smoke_file",
    status: "completed",
  }), { status: 200 });
};
const capabilityNotEnabledCodexResult = await processN8nInBackground({
  request_id: "pline-v3-BG2-UNSUPPORTED",
  line_event_id: "BG2-UNSUPPORTED",
  reply_token: "reply-token",
  user_id: "U_TEST",
  message_text: "請 Codex 幫我用computer use開啟一個新的網頁",
  received_at: "2026-07-18T00:00:00.000Z",
}, {
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  RUNTIME_KV: capabilityNotEnabledCodexKv,
});
assert.equal(capabilityNotEnabledCodexResult.ok, false);
assert.equal(capabilityNotEnabledCodexResult.reason, "capability_not_yet_enabled");
assert.deepEqual(capabilityNotEnabledCodexCalls, [
  "https://n8n.example.test/webhook",
  "https://api.line.me/v2/bot/message/push",
]);
assert.equal((await capabilityNotEnabledCodexKv.list({ prefix: "codex_task:v1:task:" })).keys.length, 0);
const capabilityNotEnabledEvidence = await readEvidenceForRequest({ RUNTIME_KV: capabilityNotEnabledCodexKv }, "pline-v3-BG2-UNSUPPORTED");
assert.equal(capabilityNotEnabledEvidence.stages.some((stage) => stage.stage === "codex_task_capability_not_enabled"), true);
assert.equal(capabilityNotEnabledEvidence.stages.some((stage) => stage.stage === "codex_task_capability_notice_completed"), true);
assert.equal(capabilityNotEnabledEvidence.stages.some((stage) => stage.stage === "codex_task_processing_notice_completed"), false);
globalThis.fetch = originalFetch;

const enqueueKv = createMemoryKv();
const enqueueResult = await enqueueCodexTask({
  RUNTIME_KV: enqueueKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-ENQUEUE",
  gate_marker: "T1701-20260718010102",
  user_id: "U_RAW_SHOULD_NOT_STORE",
}, {
  task_id: "task-enqueue-unit",
  action: "create_smoke_file",
});
assert.equal(enqueueResult.ok, true);
const enqueueRecord = JSON.parse(await enqueueKv.get("codex_task:v1:task:task-enqueue-unit"));
assert.equal(enqueueRecord.status, "queued");
assert.equal(enqueueRecord.content, "Codex 任務測試成功");
assert.equal(enqueueRecord.project_path, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke");
assert.equal(await enqueueKv.get("codex_task:v1:pending:task-enqueue-unit"), "codex_task:v1:task:task-enqueue-unit");

const ideaKv = createMemoryKv();
const ideaEnqueueResult = await enqueueIdeaTask({
  RUNTIME_KV: ideaKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-IDEA1",
  line_event_id: "LINE-EVENT-IDEA1",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：這是新的繁中想法 T1702-20260718010102",
  gate_marker: "T1702-20260718010102",
});
assert.equal(ideaEnqueueResult.ok, true);
const ideaKeys = await ideaKv.list({ prefix: "idea_json:v1:task:" });
assert.equal(ideaKeys.keys.length, 1);
const ideaPendingKeys = await ideaKv.list({ prefix: "idea_json:v1:pending:" });
assert.equal(ideaPendingKeys.keys.length, 1);
const ideaRecord = JSON.parse(await ideaKv.get(ideaKeys.keys[0].name));
assert.equal(ideaRecord.action, "save_idea_json");
assert.equal(ideaRecord.target_dir, "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03");
assert.equal(ideaRecord.idea.schema_version, "1.0");
assert.equal(ideaRecord.idea.content, "這是新的繁中想法");
assert.equal(ideaRecord.idea.source, "line");
assert.equal(ideaRecord.idea.intent, "idea_create");
assert.equal(ideaRecord.idea.status, "saved");
assert.equal(/^[a-f0-9]{64}$/.test(ideaRecord.idea.actor_fingerprint), true);
assert.equal(/^[a-f0-9]{64}$/.test(ideaRecord.idea.line_event_key), true);
assert.equal(typeof ideaRecord.finalize_token, "string");
assert.equal(ideaRecord.finalize_token.startsWith("fin-"), true);
assert.equal(typeof ideaRecord.line_user_ref, "string");
assert.equal(ideaRecord.line_user_ref.startsWith("v1."), true);
assert.equal(JSON.stringify(ideaRecord).includes("U_RAW_SHOULD_NOT_STORE"), false);
assert.equal(await ideaKv.get(`idea_json:v1:pending:${ideaRecord.task_id}`), `idea_json:v1:task:${ideaRecord.task_id}`);
const duplicateIdeaEnqueue = await enqueueIdeaTask({
  RUNTIME_KV: ideaKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-IDEA1",
  line_event_id: "LINE-EVENT-IDEA1",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：這是新的繁中想法 T1702-20260718010102",
  gate_marker: "T1702-20260718010102",
});
assert.equal(duplicateIdeaEnqueue.ok, true);
assert.equal(duplicateIdeaEnqueue.duplicate, true);

const duplicateSuppressCalls = [];
const duplicateSuppressKv = createMemoryKv();
const duplicateSuppressNormalized = {
  request_id: "pline-v3-IDEA-DUP",
  line_event_id: "LINE-EVENT-IDEA-DUP",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：duplicate suppress T1703-20260718010103",
  gate_marker: "T1703-20260718010103",
};
await enqueueIdeaTask({
  RUNTIME_KV: duplicateSuppressKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, duplicateSuppressNormalized);
const duplicateSuppressKeys = await duplicateSuppressKv.list({ prefix: "idea_json:v1:task:" });
const duplicateSuppressTask = JSON.parse(await duplicateSuppressKv.get(duplicateSuppressKeys.keys[0].name));
await duplicateSuppressKv.put(duplicateSuppressKeys.keys[0].name, JSON.stringify({
  ...duplicateSuppressTask,
  status: "completed",
  file_written: true,
}));
globalThis.fetch = async (url) => {
  duplicateSuppressCalls.push(url);
  return new Response(JSON.stringify({
    request_id: "pline-v3-IDEA-DUP",
    intent: "idea_create",
    reply_text: "已記下",
    tool_called: "idea_create",
    saved_record: 1,
    status: "completed",
  }), { status: 200 });
};
const duplicateSuppressResult = await processN8nInBackground(duplicateSuppressNormalized, {
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  RUNTIME_KV: duplicateSuppressKv,
});
assert.equal(duplicateSuppressResult.ok, true);
assert.deepEqual(duplicateSuppressCalls, ["https://n8n.example.test/webhook"]);
const duplicateSuppressEvidence = await readEvidenceForRequest({ RUNTIME_KV: duplicateSuppressKv }, "pline-v3-IDEA-DUP");
assert.equal(duplicateSuppressEvidence.stages.some((stage) => stage.stage === "idea_json_final_push_suppressed"), true);
assert.equal(JSON.stringify(duplicateSuppressEvidence).includes("U_RAW_SHOULD_NOT_STORE"), false);
globalThis.fetch = originalFetch;

const finalizerCalls = [];
const finalizerKv = createMemoryKv();
await enqueueIdeaTask({
  RUNTIME_KV: finalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-IDEA-FINALIZE",
  line_event_id: "LINE-EVENT-FINALIZE",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：finalize callback T1704-20260718010104",
  gate_marker: "T1704-20260718010104",
}, {
  reply_text: "幫妳收好了，這個想法我先替妳放好 💡",
});
const finalizerKeys = await finalizerKv.list({ prefix: "idea_json:v1:task:" });
const finalizerTask = JSON.parse(await finalizerKv.get(finalizerKeys.keys[0].name));
await finalizerKv.put(finalizerKeys.keys[0].name, JSON.stringify({
  ...finalizerTask,
  status: "completed",
  file_written: true,
}));
globalThis.fetch = async (url, options) => {
  finalizerCalls.push({ url, options });
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  return new Response("{}", { status: 404 });
};
const finalizerRequestBody = {
  task_id: finalizerTask.task_id,
  request_id: finalizerTask.request_id,
  action: "save_idea_json",
  status: "completed",
  finalize_token: finalizerTask.finalize_token,
};
const finalizerResponse = await handleIdeaFinalize(new Request("https://worker.example.test/test/idea-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(finalizerRequestBody),
}), {
  RUNTIME_KV: finalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(finalizerResponse.status, 200);
assert.equal((await finalizerResponse.json()).status, "completed");
assert.deepEqual(finalizerCalls.map((call) => call.url), ["https://api.line.me/v2/bot/message/push"]);
assert.equal(JSON.parse(finalizerCalls[0].options.body).messages[0].text, "幫妳收好了，這個想法我先替妳放好 💡");
const repeatedFinalizerResponse = await handleIdeaFinalize(new Request("https://worker.example.test/test/idea-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(finalizerRequestBody),
}), {
  RUNTIME_KV: finalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(repeatedFinalizerResponse.status, 200);
assert.equal((await repeatedFinalizerResponse.json()).pushed, false);
assert.equal(finalizerCalls.length, 1);
const finalizerEvidenceRead = await readEvidenceForRequest({ RUNTIME_KV: finalizerKv }, "pline-v3-IDEA-FINALIZE");
assert.equal(finalizerEvidenceRead.stages.some((stage) => stage.stage === "idea_json_final_push_completed"), true);
assert.equal(summarizeEvidenceStages(finalizerEvidenceRead.stages).final_push, true);
assert.equal(JSON.stringify(finalizerEvidenceRead).includes("U_RAW_SHOULD_NOT_STORE"), false);
globalThis.fetch = originalFetch;

const fallbackFinalizerCalls = [];
const fallbackFinalizerKv = createMemoryKv();
await enqueueIdeaTask({
  RUNTIME_KV: fallbackFinalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-IDEA-FALLBACK-FINALIZE",
  line_event_id: "LINE-EVENT-FALLBACK-FINALIZE",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：fallback callback T1704A-20260718010104",
  gate_marker: "T1704A-20260718010104",
}, {
  reply_text: "已寫入 _03 JSON task",
});
const fallbackFinalizerKeys = await fallbackFinalizerKv.list({ prefix: "idea_json:v1:task:" });
const fallbackFinalizerTask = JSON.parse(await fallbackFinalizerKv.get(fallbackFinalizerKeys.keys[0].name));
await fallbackFinalizerKv.put(fallbackFinalizerKeys.keys[0].name, JSON.stringify({
  ...fallbackFinalizerTask,
  status: "completed",
  file_written: true,
}));
globalThis.fetch = async (url, options) => {
  fallbackFinalizerCalls.push({ url, options });
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  return new Response("{}", { status: 404 });
};
const fallbackFinalizerResponse = await handleIdeaFinalize(new Request("https://worker.example.test/test/idea-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    task_id: fallbackFinalizerTask.task_id,
    request_id: fallbackFinalizerTask.request_id,
    action: "save_idea_json",
    status: "completed",
    finalize_token: fallbackFinalizerTask.finalize_token,
  }),
}), {
  RUNTIME_KV: fallbackFinalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(fallbackFinalizerResponse.status, 200);
assert.equal(JSON.parse(fallbackFinalizerCalls[0].options.body).messages[0].text, "已經幫妳記下來了 💡");
globalThis.fetch = originalFetch;

const codexFinalizerCalls = [];
const codexFinalizerKv = createMemoryKv();
await enqueueCodexTask({
  RUNTIME_KV: codexFinalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-CODEX-FINALIZE",
  gate_marker: "T2301-20260718090101",
  user_id: "U_RAW_SHOULD_NOT_STORE",
}, {
  task_id: "codex-finalizer-unit",
  action: "create_smoke_file",
});
const codexFinalizerTask = JSON.parse(await codexFinalizerKv.get("codex_task:v1:task:codex-finalizer-unit"));
await codexFinalizerKv.put("codex_task:v1:task:codex-finalizer-unit", JSON.stringify({
  ...codexFinalizerTask,
  status: "completed",
  codex_execution: true,
  file_written: true,
}));
globalThis.fetch = async (url, options) => {
  codexFinalizerCalls.push({ url, options });
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  return new Response("{}", { status: 404 });
};
const codexFinalizerBody = {
  task_id: codexFinalizerTask.task_id,
  request_id: codexFinalizerTask.request_id,
  action: "create_smoke_file",
  status: "completed",
  finalize_token: codexFinalizerTask.finalize_token,
};
const codexFinalizerResponse = await handleCodexFinalize(new Request("https://worker.example.test/test/codex-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(codexFinalizerBody),
}), {
  RUNTIME_KV: codexFinalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(codexFinalizerResponse.status, 200);
assert.equal((await codexFinalizerResponse.json()).status, "completed");
assert.equal(codexFinalizerCalls.length, 1);
assert.equal(JSON.parse(codexFinalizerCalls[0].options.body).messages[0].text, "已經處理完成了 ✨\n指定的小任務已成功執行。");
const repeatedCodexFinalizerResponse = await handleCodexFinalize(new Request("https://worker.example.test/test/codex-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(codexFinalizerBody),
}), {
  RUNTIME_KV: codexFinalizerKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(repeatedCodexFinalizerResponse.status, 200);
assert.equal((await repeatedCodexFinalizerResponse.json()).pushed, false);
assert.equal(codexFinalizerCalls.length, 1);
const codexFinalizerEvidence = await readEvidenceForRequest({ RUNTIME_KV: codexFinalizerKv }, "pline-v3-CODEX-FINALIZE");
assert.equal(codexFinalizerEvidence.stages.some((stage) => stage.stage === "codex_task_final_push_completed"), true);
assert.equal(summarizeEvidenceStages(codexFinalizerEvidence.stages).final_push, true);
assert.equal(JSON.stringify(codexFinalizerEvidence).includes("U_RAW_SHOULD_NOT_STORE"), false);
globalThis.fetch = originalFetch;

const codexFailureCalls = [];
const codexFailureKv = createMemoryKv();
await enqueueCodexTask({
  RUNTIME_KV: codexFailureKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-CODEX-FAILED-FINALIZE",
  gate_marker: "T2302-20260718090102",
  user_id: "U_RAW_SHOULD_NOT_STORE",
}, {
  task_id: "codex-failed-finalizer-unit",
  action: "create_smoke_file",
});
const codexFailureTask = JSON.parse(await codexFailureKv.get("codex_task:v1:task:codex-failed-finalizer-unit"));
await codexFailureKv.put("codex_task:v1:task:codex-failed-finalizer-unit", JSON.stringify({
  ...codexFailureTask,
  status: "failed",
  reason: "unit_failure",
}));
globalThis.fetch = async (url, options) => {
  codexFailureCalls.push({ url, options });
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  return new Response("{}", { status: 404 });
};
const codexFailureResponse = await handleCodexFinalize(new Request("https://worker.example.test/test/codex-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    task_id: codexFailureTask.task_id,
    request_id: codexFailureTask.request_id,
    action: "create_smoke_file",
    status: "failed",
    reason: "unit_failure",
    finalize_token: codexFailureTask.finalize_token,
  }),
}), {
  RUNTIME_KV: codexFailureKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(codexFailureResponse.status, 200);
assert.equal((await codexFailureResponse.json()).status, "failure_notice_completed");
assert.equal(JSON.parse(codexFailureCalls[0].options.body).messages[0].text, "這次沒有順利完成，我先停在安全狀態，沒有假裝處理成功 🙏");
globalThis.fetch = originalFetch;

const duplicateCallbackCalls = [];
const duplicateCallbackKv = createMemoryKv();
await enqueueIdeaTask({
  RUNTIME_KV: duplicateCallbackKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-IDEA-DUP-CALLBACK",
  line_event_id: "LINE-EVENT-DUP-CALLBACK",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：duplicate callback T1705-20260718010105",
  gate_marker: "T1705-20260718010105",
});
const duplicateCallbackKeys = await duplicateCallbackKv.list({ prefix: "idea_json:v1:task:" });
const duplicateCallbackTask = JSON.parse(await duplicateCallbackKv.get(duplicateCallbackKeys.keys[0].name));
await duplicateCallbackKv.put(duplicateCallbackKeys.keys[0].name, JSON.stringify({
  ...duplicateCallbackTask,
  status: "duplicate",
  file_written: true,
}));
globalThis.fetch = async (url, options) => {
  duplicateCallbackCalls.push({ url, options });
  return new Response("", { status: 200 });
};
const duplicateCallbackResponse = await handleIdeaFinalize(new Request("https://worker.example.test/test/idea-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    task_id: duplicateCallbackTask.task_id,
    request_id: duplicateCallbackTask.request_id,
    action: "save_idea_json",
    status: "duplicate",
    finalize_token: duplicateCallbackTask.finalize_token,
  }),
}), {
  RUNTIME_KV: duplicateCallbackKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(duplicateCallbackResponse.status, 200);
assert.equal((await duplicateCallbackResponse.json()).status, "suppressed");
assert.equal(duplicateCallbackCalls.length, 0);
const duplicateCallbackEvidence = await readEvidenceForRequest({ RUNTIME_KV: duplicateCallbackKv }, "pline-v3-IDEA-DUP-CALLBACK");
assert.equal(duplicateCallbackEvidence.stages.some((stage) => stage.stage === "idea_json_final_push_suppressed"), true);
globalThis.fetch = originalFetch;

const failedCallbackCalls = [];
const failedCallbackKv = createMemoryKv();
await enqueueIdeaTask({
  RUNTIME_KV: failedCallbackKv,
  N8N_SHARED_SECRET: "unit-test-secret",
}, {
  request_id: "pline-v3-IDEA-FAILED-CALLBACK",
  line_event_id: "LINE-EVENT-FAILED-CALLBACK",
  user_id: "U_RAW_SHOULD_NOT_STORE",
  message_text: "記一下：failed callback T1706-20260718010106",
  gate_marker: "T1706-20260718010106",
});
const failedCallbackKeys = await failedCallbackKv.list({ prefix: "idea_json:v1:task:" });
const failedCallbackTask = JSON.parse(await failedCallbackKv.get(failedCallbackKeys.keys[0].name));
await failedCallbackKv.put(failedCallbackKeys.keys[0].name, JSON.stringify({
  ...failedCallbackTask,
  status: "failed",
  reason: "unit_failure",
}));
globalThis.fetch = async (url, options) => {
  failedCallbackCalls.push({ url, options });
  return new Response("", { status: 200 });
};
const failedCallbackResponse = await handleIdeaFinalize(new Request("https://worker.example.test/test/idea-finalize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    task_id: failedCallbackTask.task_id,
    request_id: failedCallbackTask.request_id,
    action: "save_idea_json",
    status: "failed",
    finalize_token: failedCallbackTask.finalize_token,
  }),
}), {
  RUNTIME_KV: failedCallbackKv,
  N8N_SHARED_SECRET: "unit-test-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
});
assert.equal(failedCallbackResponse.status, 200);
assert.equal((await failedCallbackResponse.json()).status, "failure_notice_completed");
assert.equal(failedCallbackCalls.length, 1);
assert.equal(JSON.parse(failedCallbackCalls[0].options.body).messages[0].text, "這次沒有成功保存，我先不假裝記好了，請稍後再試一次 🙏");
const failedCallbackEvidence = await readEvidenceForRequest({ RUNTIME_KV: failedCallbackKv }, "pline-v3-IDEA-FAILED-CALLBACK");
assert.equal(failedCallbackEvidence.stages.some((stage) => stage.stage === "idea_json_final_push_completed"), false);
assert.equal(JSON.stringify(failedCallbackEvidence).includes("U_RAW_SHOULD_NOT_STORE"), false);
globalThis.fetch = originalFetch;

const webhookFetchCalls = [];
const waitUntilPromises = [];
const liveWebhookEvidenceKv = createMemoryKv();
globalThis.fetch = async (url, options) => {
  webhookFetchCalls.push({ url, options });
  if (url === "https://api.line.me/v2/bot/message/reply") {
    return new Response("", { status: 200 });
  }
  if (url === "https://api.line.me/v2/bot/message/push") {
    return new Response("", { status: 200 });
  }
  return new Response(JSON.stringify({
    request_id: "pline-v3-WEBHOOK1",
    intent: "idea_create",
    reply_text: "已記下",
    tool_called: "idea_create",
    saved_record: 1,
    status: "completed",
  }), { status: 200 });
};
const rawWebhookBody = JSON.stringify({
  events: [{
    type: "message",
    webhookEventId: "WEBHOOK1",
    replyToken: "reply-token",
    source: { userId: "U_TEST" },
    message: {
      id: "M1",
      type: "text",
      markAsReadToken: "READ-MARK-WEBHOOK1",
      text: "記一下：今天開始建立 _03 T1501-20260718010105",
    },
  }],
});
const channelSecret = "line-channel-secret-for-unit-test";
const webhookResponse = await handleLineWebhook(new Request("https://worker.example.test/line/webhook", {
  method: "POST",
  headers: {
    "x-line-signature": await signLineBody(rawWebhookBody, channelSecret),
  },
  body: rawWebhookBody,
}), {
  LINE_CHANNEL_SECRET: channelSecret,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_TEST_ADMIN_USER_IDS: "U_TEST",
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  RUNTIME_KV: liveWebhookEvidenceKv,
  IDEMPOTENCY_KV: {
    get: async () => null,
    put: async () => {},
  },
}, {
  waitUntil: (promise) => waitUntilPromises.push(promise),
});
assert.equal(webhookResponse.status, 200);
assert.deepEqual(await webhookResponse.json(), {
  status: "accepted",
  request_id: "pline-v3-WEBHOOK1",
  reply_mode: "no_visible_ack_background_n8n",
});
await Promise.all(waitUntilPromises);
assert.deepEqual(webhookFetchCalls.map((call) => call.url), [
  "https://n8n.example.test/webhook",
]);
const liveEvidenceResponse = await handleEvidenceRead(new Request("https://worker.example.test/test/evidence?marker=T1501-20260718010105", {
  headers: { "x-pline-v3-shared-secret": "unit-test-secret" },
}), {
  RUNTIME_KV: liveWebhookEvidenceKv,
  N8N_SHARED_SECRET: "unit-test-secret",
});
assert.equal(liveEvidenceResponse.status, 200);
const liveEvidenceBody = await liveEvidenceResponse.json();
assert.equal(liveEvidenceBody.request_id, "pline-v3-WEBHOOK1");
assert.equal(liveEvidenceBody.marker, "T1501-20260718010105");
assert.equal(liveEvidenceBody.summary.line_event, true);
assert.equal(liveEvidenceBody.summary.signature, true);
assert.equal(liveEvidenceBody.summary.admin, true);
assert.equal(liveEvidenceBody.summary.idempotency, true);
assert.equal(liveEvidenceBody.summary.fast_ack, false);
assert.equal(liveEvidenceBody.summary.visible_ack_skipped, true);
assert.equal(liveEvidenceBody.summary.webhook_http_200, true);
assert.equal(liveEvidenceBody.stages.some((stage) => stage.stage === "line_visible_ack_skipped"), true);
assert.equal(liveEvidenceBody.stages.some((stage) => stage.stage === "line_mark_as_read_skipped_disabled"), true);
assert.equal(liveEvidenceBody.stages.some((stage) => stage.stage === "line_mark_as_read_completed"), false);
assert.equal(JSON.stringify(liveEvidenceBody).includes("READ-MARK-WEBHOOK1"), false);
assert.equal(liveEvidenceBody.summary.n8n_started, true);
const n8nStartedStage = liveEvidenceBody.stages.find((stage) => stage.stage === "n8n_background_started");
assert.equal(n8nStartedStage.n8n_host, "n8n.example.test");
assert.equal(n8nStartedStage.n8n_path, "/webhook");
assert.equal(n8nStartedStage.n8n_route_type, "production");
assert.equal(typeof n8nStartedStage.n8n_path_fingerprint, "string");
assert.equal(liveEvidenceBody.summary.n8n_completed, true);
assert.equal(liveEvidenceBody.summary.intent, "idea_create");
assert.equal(liveEvidenceBody.summary.tool_called, "idea_create");
assert.equal(liveEvidenceBody.summary.saved_record, 1);
assert.equal(liveEvidenceBody.stages.some((stage) => stage.stage === "idea_json_final_outbox_pending"), true);
assert.equal(liveEvidenceBody.summary.final_push, false);
assert.ok(liveEvidenceBody.stages.length >= 7);
globalThis.fetch = originalFetch;

const markReadEnabledCalls = [];
const markReadEnabledKv = createMemoryKv();
globalThis.fetch = async (url) => {
  markReadEnabledCalls.push(url);
  if (url === "https://api.line.me/v2/bot/chat/markAsRead") {
    return new Response("", { status: 200 });
  }
  return new Response(JSON.stringify({
    request_id: "pline-v3-WEBHOOK-MARK-ENABLED",
    intent: "idea_create",
    reply_text: "已記下",
    tool_called: "idea_create",
    saved_record: 1,
    status: "completed",
  }), { status: 200 });
};
const markReadEnabledBody = JSON.stringify({
  events: [{
    type: "message",
    webhookEventId: "WEBHOOK-MARK-ENABLED",
    replyToken: "reply-token",
    source: { userId: "U_TEST" },
    message: {
      id: "M-MARK-ENABLED",
      type: "text",
      markAsReadToken: "READ-MARK-ENABLED",
      text: "記一下：mark read enabled T1604-20260718010104",
    },
  }],
});
const markReadEnabledWaitUntil = [];
const markReadEnabledResponse = await handleLineWebhook(new Request("https://worker.example.test/line/webhook", {
  method: "POST",
  headers: {
    "x-line-signature": await signLineBody(markReadEnabledBody, channelSecret),
  },
  body: markReadEnabledBody,
}), {
  LINE_CHANNEL_SECRET: channelSecret,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_MARK_AS_READ_ENABLED: "true",
  LINE_TEST_ADMIN_USER_IDS: "U_TEST",
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  RUNTIME_KV: markReadEnabledKv,
  IDEMPOTENCY_KV: {
    get: async () => null,
    put: async () => {},
  },
}, {
  waitUntil: (promise) => markReadEnabledWaitUntil.push(promise),
});
assert.equal(markReadEnabledResponse.status, 200);
await Promise.all(markReadEnabledWaitUntil);
assert.deepEqual(markReadEnabledCalls, [
  "https://api.line.me/v2/bot/chat/markAsRead",
  "https://n8n.example.test/webhook",
]);
const markReadEnabledEvidence = await readEvidenceForRequest({ RUNTIME_KV: markReadEnabledKv }, "pline-v3-WEBHOOK-MARK-ENABLED");
assert.equal(markReadEnabledEvidence.stages.some((stage) => stage.stage === "line_mark_as_read_completed"), true);
assert.equal(JSON.stringify(markReadEnabledEvidence).includes("READ-MARK-ENABLED"), false);
globalThis.fetch = originalFetch;

const markReadFailureCalls = [];
const markReadFailureKv = createMemoryKv();
globalThis.fetch = async (url) => {
  markReadFailureCalls.push(url);
  if (url === "https://api.line.me/v2/bot/chat/markAsRead") {
    return new Response("", { status: 500 });
  }
  return new Response(JSON.stringify({
    request_id: "pline-v3-WEBHOOK-MARK-FAIL",
    intent: "idea_create",
    reply_text: "已記下",
    tool_called: "idea_create",
    saved_record: 1,
    status: "completed",
  }), { status: 200 });
};
const markReadFailureBody = JSON.stringify({
  events: [{
    type: "message",
    webhookEventId: "WEBHOOK-MARK-FAIL",
    replyToken: "reply-token",
    source: { userId: "U_TEST" },
    message: {
      id: "M-MARK-FAIL",
      type: "text",
      markAsReadToken: "READ-MARK-FAIL",
      text: "記一下：mark read failure T1602-20260718010102",
    },
  }],
});
const markReadFailureWaitUntil = [];
const markReadFailureResponse = await handleLineWebhook(new Request("https://worker.example.test/line/webhook", {
  method: "POST",
  headers: {
    "x-line-signature": await signLineBody(markReadFailureBody, channelSecret),
  },
  body: markReadFailureBody,
}), {
  LINE_CHANNEL_SECRET: channelSecret,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_MARK_AS_READ_ENABLED: "true",
  LINE_TEST_ADMIN_USER_IDS: "U_TEST",
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  RUNTIME_KV: markReadFailureKv,
  IDEMPOTENCY_KV: {
    get: async () => null,
    put: async () => {},
  },
}, {
  waitUntil: (promise) => markReadFailureWaitUntil.push(promise),
});
assert.equal(markReadFailureResponse.status, 200);
await Promise.all(markReadFailureWaitUntil);
assert.deepEqual(markReadFailureCalls, [
  "https://api.line.me/v2/bot/chat/markAsRead",
  "https://n8n.example.test/webhook",
]);
const markReadFailureEvidence = await readEvidenceForRequest({ RUNTIME_KV: markReadFailureKv }, "pline-v3-WEBHOOK-MARK-FAIL");
assert.equal(markReadFailureEvidence.stages.some((stage) => stage.stage === "line_mark_as_read_failed"), true);
assert.equal(markReadFailureEvidence.stages.some((stage) => stage.stage === "n8n_background_completed"), true);
assert.equal(JSON.stringify(markReadFailureEvidence).includes("READ-MARK-FAIL"), false);
globalThis.fetch = originalFetch;

const adminFailedMarkReadCalls = [];
globalThis.fetch = async (url) => {
  adminFailedMarkReadCalls.push(url);
  return new Response("", { status: 200 });
};
const adminFailedMarkReadBody = JSON.stringify({
  events: [{
    type: "message",
    webhookEventId: "WEBHOOK-MARK-ADMIN-FAIL",
    replyToken: "reply-token",
    source: { userId: "U_OTHER" },
    message: {
      id: "M-MARK-ADMIN-FAIL",
      type: "text",
      markAsReadToken: "READ-MARK-ADMIN-FAIL",
      text: "記一下：admin fail T1603-20260718010103",
    },
  }],
});
const adminFailedMarkReadResponse = await handleLineWebhook(new Request("https://worker.example.test/line/webhook", {
  method: "POST",
  headers: {
    "x-line-signature": await signLineBody(adminFailedMarkReadBody, channelSecret),
  },
  body: adminFailedMarkReadBody,
}), {
  LINE_CHANNEL_SECRET: channelSecret,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_TEST_ADMIN_USER_IDS: "U_TEST",
  RUNTIME_KV: createMemoryKv(),
  IDEMPOTENCY_KV: {
    get: async () => null,
    put: async () => {},
  },
});
assert.equal(adminFailedMarkReadResponse.status, 403);
assert.deepEqual(adminFailedMarkReadCalls, []);
globalThis.fetch = originalFetch;

const failedEvidenceResult = await persistEvidenceStage({
  RUNTIME_KV: {
    put: async () => {
      throw new Error("unit_kv_put_failed");
    },
  },
}, {
  request_id: "pline-v3-EVIDENCE-FAIL",
  gate_marker: "T1501F-20260718010106",
}, "line_event_received");
assert.equal(failedEvidenceResult.ok, false);
assert.equal(failedEvidenceResult.reason, "evidence_persist_failed");

const blockedEvidenceFetchCalls = [];
globalThis.fetch = async (url) => {
  blockedEvidenceFetchCalls.push(url);
  if (url === "https://api.line.me/v2/bot/message/reply") {
    return new Response("", { status: 200 });
  }
  return new Response(JSON.stringify({
    request_id: "pline-v3-WEBHOOK2",
    intent: "idea_create",
    reply_text: "已記下",
    tool_called: "idea_create",
    saved_record: 1,
    status: "completed",
  }), { status: 200 });
};
const blockedEvidenceWaitUntil = [];
const rawBlockedEvidenceBody = JSON.stringify({
  events: [{
    type: "message",
    webhookEventId: "WEBHOOK2",
    replyToken: "reply-token",
    source: { userId: "U_TEST" },
    message: {
      id: "M2",
      type: "text",
      text: "記一下：今天開始建立 _03 T1401-20260718010104",
    },
  }],
});
const blockedEvidenceResponse = await handleLineWebhook(new Request("https://worker.example.test/line/webhook", {
  method: "POST",
  headers: {
    "x-line-signature": await signLineBody(rawBlockedEvidenceBody, channelSecret),
  },
  body: rawBlockedEvidenceBody,
}), {
  LINE_CHANNEL_SECRET: channelSecret,
  LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  LINE_TEST_ADMIN_USER_IDS: "U_TEST",
  N8N_WEBHOOK_URL: "https://n8n.example.test/webhook",
  N8N_SHARED_SECRET: "unit-test-secret",
  RUNTIME_KV: {
    put: async () => new Promise(() => {}),
  },
  IDEMPOTENCY_KV: {
    get: async () => null,
    put: async () => {},
  },
}, {
  waitUntil: (promise) => blockedEvidenceWaitUntil.push(promise),
});
assert.equal(blockedEvidenceResponse.status, 200);
assert.deepEqual(await blockedEvidenceResponse.json(), {
  status: "accepted",
  request_id: "pline-v3-WEBHOOK2",
  reply_mode: "no_visible_ack_background_n8n",
});
assert.deepEqual(blockedEvidenceFetchCalls, []);
assert.ok(blockedEvidenceWaitUntil.length >= 6);
globalThis.fetch = originalFetch;

console.log("worker skeleton tests PASS");

async function signLineBody(rawBody, channelSecret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  let binary = "";
  for (const byte of new Uint8Array(signed)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function createMemoryKv() {
  const store = new Map();
  return {
    get: async (key) => store.get(key) || null,
    put: async (key, value) => {
      store.set(key, value);
    },
    list: async ({ prefix = "", limit = 100 } = {}) => ({
      keys: [...store.keys()]
        .filter((name) => name.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name })),
    }),
  };
}
