import assert from "node:assert/strict";
import {
  extractGateMarker,
  enqueueCodexTask,
  handleEvidenceRead,
  handleEvidenceSelfcheck,
  handleLineWebhook,
  lineAuthorizationHeader,
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

const health = workerHealth({});
assert.equal(health.worker, "pline-v3-test-line-gateway");
assert.equal(health.resources.runtime_kv, "pline-v3-test-runtime");
assert.equal(health.resources.idempotency_kv, "pline-v3-test-idempotency");
assert.equal(health.n8n.webhook_url, "https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent");
assert.equal(health.n8n.shared_secret_header, "x-pline-v3-shared-secret");
assert.equal(health.line_reply_mode, "fast_ack_then_background_n8n");
assert.equal(health.codex_task_final_mode, "background_push_final");
assert.equal(health.evidence.persistence, "RUNTIME_KV");
assert.equal(health.evidence.read_path, "/test/evidence");
assert.equal(health.evidence.selfcheck_path, "/test/evidence/selfcheck");
assert.equal(health.evidence.guard_header, "x-pline-v3-shared-secret");
assert.equal(health.evidence.selfcheck_guard_header, "x-pline-v3-selftest-secret");
assert.equal(health.evidence.runtime_kv_bound, false);
assert.equal(health.evidence.selfcheck_secret_configured, false);
assert.equal(health.codex_monitor.name, "pline-v3-test-codex-monitor");
assert.equal(health.codex_monitor.task_prefix, "codex_task:v1");
assert.equal(health.codex_monitor.action, "create_smoke_file");
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
  reply_text: "Codex 已打通",
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

assert.equal(validateN8nContract([{ json: {
  request_id: "pline-v3-E5",
  intent: "idea_create",
  reply_text: "已記下",
  tool_called: "idea_create",
  saved_record: 1,
  status: "completed",
} }], "pline-v3-E5").ok, true);

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
assert.equal(unsupportedResult.body.reply_text, "目前 _03 TEST 只支援記錄一句想法或建立 Codex 測試檔案。");

assert.equal(normalizeReplyText("idea_create", ""), "");

assert.equal(validateN8nContract({
  request_id: "pline-v3-E2",
  intent: "codex_task",
  reply_text: "Codex 已打通",
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

const originalFetch = globalThis.fetch;
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
const codexTaskRecord = JSON.parse(await codexTaskKv.get(codexTaskKeys.keys[0].name));
assert.equal(codexTaskRecord.status, "pending");
assert.equal(codexTaskRecord.task_id, "T1");
assert.equal(codexTaskRecord.request_id, "pline-v3-BG2");
assert.equal(codexTaskRecord.action, "create_smoke_file");
assert.equal(codexTaskRecord.target_path, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt");
globalThis.fetch = originalFetch;

const enqueueKv = createMemoryKv();
const enqueueResult = await enqueueCodexTask({
  RUNTIME_KV: enqueueKv,
}, {
  request_id: "pline-v3-ENQUEUE",
  gate_marker: "T1701-20260718010102",
}, {
  task_id: "task-enqueue-unit",
  action: "create_smoke_file",
});
assert.equal(enqueueResult.ok, true);
const enqueueRecord = JSON.parse(await enqueueKv.get("codex_task:v1:task:task-enqueue-unit"));
assert.equal(enqueueRecord.status, "pending");
assert.equal(enqueueRecord.content, "Codex 已打通");

const webhookFetchCalls = [];
const waitUntilPromises = [];
const liveWebhookEvidenceKv = createMemoryKv();
globalThis.fetch = async (url) => {
  webhookFetchCalls.push(url);
  if (url === "https://api.line.me/v2/bot/message/reply") {
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
  reply_mode: "fast_ack_then_background_n8n",
});
assert.equal(webhookFetchCalls[0], "https://api.line.me/v2/bot/message/reply");
assert.equal(webhookFetchCalls[1], "https://n8n.example.test/webhook");
await Promise.all(waitUntilPromises);
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
assert.equal(liveEvidenceBody.summary.fast_ack, true);
assert.equal(liveEvidenceBody.summary.n8n_started, true);
assert.equal(liveEvidenceBody.summary.n8n_completed, true);
assert.equal(liveEvidenceBody.summary.intent, "idea_create");
assert.equal(liveEvidenceBody.summary.tool_called, "idea_create");
assert.equal(liveEvidenceBody.summary.saved_record, 1);
assert.ok(liveEvidenceBody.stages.length >= 7);
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
  reply_mode: "fast_ack_then_background_n8n",
});
assert.deepEqual(blockedEvidenceFetchCalls, ["https://api.line.me/v2/bot/message/reply"]);
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
