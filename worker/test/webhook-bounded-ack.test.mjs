import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  LINE_WEBHOOK_ACK_BUDGET_MS,
  NORMAL_ACK_TARGET_MS,
  handleLineWebhook,
  workerHealth,
} from "../src/index.js";

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.getCalls = [];
    this.putCalls = [];
    this.listCalls = [];
    this.getImpl = null;
    this.putImpl = null;
  }

  async get(key) {
    this.getCalls.push(key);
    if (this.getImpl) return this.getImpl(key);
    return this.values.get(key) ?? null;
  }

  async put(key, value, options = {}) {
    this.putCalls.push({ key, value, options });
    if (this.putImpl) return this.putImpl(key, value, options);
    this.values.set(key, value);
  }

  async list({ prefix = "" } = {}) {
    this.listCalls.push(prefix);
    return {
      keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
    };
  }
}

function createContext(overrides = {}) {
  const tasks = [];
  return {
    tasks,
    waitUntil(task) {
      tasks.push(task);
    },
    ...overrides,
  };
}

function messagePayload({ eventId = "offline-event-1", text = "記一下：ACK 離線測試", replyToken = "reply-token-sensitive", userId = "user-id-sensitive" } = {}) {
  return {
    events: [{
      type: "message",
      webhookEventId: eventId,
      replyToken,
      source: { type: "user", userId },
      message: { id: `message-${eventId}`, type: "text", text },
      deliveryContext: { isRedelivery: false },
    }],
  };
}

async function signedRequest(payload, secret = "offline-channel-secret") {
  const body = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return new Request("https://worker.example/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": Buffer.from(signature).toString("base64"),
    },
    body,
  });
}

function baseEnv(idempotencyKv = new MemoryKv(), runtimeKv = new MemoryKv()) {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_TEST_ADMIN_USER_IDS: "user-id-sensitive",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-access-token",
    N8N_WEBHOOK_URL: "https://n8n.example/webhook/pline-v3-test-ai-agent",
    N8N_SHARED_SECRET: "offline-n8n-secret",
    IDEMPOTENCY_KV: idempotencyKv,
    RUNTIME_KV: runtimeKv,
  };
}

function n8nFetch(intent = "clarify") {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!String(url).startsWith("https://n8n.example/")) {
      return new Response("", { status: 204 });
    }
    const input = JSON.parse(options.body);
    if (intent === "idea_create") {
      return new Response(JSON.stringify({
        request_id: input.request_id,
        intent: "idea_create",
        tool_called: "idea_create",
        saved_record: 1,
        reply_text: "已記下",
        status: "completed",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      request_id: input.request_id,
      intent: "clarify",
      reply_text: "請再補充",
      status: "accepted",
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("health publishes the production bounded durable ACK contract", () => {
  const health = workerHealth({});
  assert.equal(LINE_WEBHOOK_ACK_BUDGET_MS, 2800);
  assert.equal(NORMAL_ACK_TARGET_MS, 1800);
  assert.deepEqual(health.line_webhook_ack, {
    version: "bounded-durable-ack-v1",
    budget_ms: 2800,
    normal_target_ms: 1800,
    kv_get_timeout_ms: 900,
    kv_put_timeout_ms: 1500,
    timeout_http_status: 503,
    durable_acceptance_store: "IDEMPOTENCY_KV",
    ambiguous_put_redelivery_resume: true,
    empty_event_side_effects: false,
    background_after_acceptance: ["evidence", "mark_as_read", "n8n", "pending", "core", "final"],
  });
});

test("empty events ACK immediately with zero KV, background, n8n, pending, or delivery side effects", async () => {
  const idempotencyKv = new MemoryKv();
  const runtimeKv = new MemoryKv();
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = n8nFetch();
  globalThis.fetch = fetchImpl;
  try {
    const response = await handleLineWebhook(await signedRequest({ events: [] }), baseEnv(idempotencyKv, runtimeKv), ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reason, "no_text_event");
    assert.equal(idempotencyKv.getCalls.length, 0);
    assert.equal(idempotencyKv.putCalls.length, 0);
    assert.equal(runtimeKv.getCalls.length + runtimeKv.putCalls.length + runtimeKv.listCalls.length, 0);
    assert.equal(ctx.tasks.length, 0);
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid signature is rejected before KV or background work", async () => {
  const idempotencyKv = new MemoryKv();
  const runtimeKv = new MemoryKv();
  const ctx = createContext();
  const payload = messagePayload();
  const request = new Request("https://worker.example/line/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-line-signature": "invalid" },
    body: JSON.stringify(payload),
  });
  const response = await handleLineWebhook(request, baseEnv(idempotencyKv, runtimeKv), ctx);
  assert.equal(response.status, 401);
  assert.equal(idempotencyKv.getCalls.length + idempotencyKv.putCalls.length, 0);
  assert.equal(runtimeKv.getCalls.length + runtimeKv.putCalls.length, 0);
  assert.equal(ctx.tasks.length, 0);
});

test("normal durable acceptance returns 200 within target while n8n and evidence stay in waitUntil", async () => {
  const idempotencyKv = new MemoryKv();
  const runtimeKv = new MemoryKv();
  let releaseEvidence;
  const evidenceDelay = new Promise((resolve) => { releaseEvidence = resolve; });
  runtimeKv.putImpl = async (key, value) => {
    await evidenceDelay;
    runtimeKv.values.set(key, value);
  };
  const ctx = createContext({ __testAckBudgetMs: 150, __testKvGetTimeoutMs: 40, __testKvPutTimeoutMs: 60 });
  const originalFetch = globalThis.fetch;
  const fetchImpl = n8nFetch();
  globalThis.fetch = fetchImpl;
  const logs = [];
  const originalLog = console.log;
  console.log = (value) => logs.push(String(value));
  try {
    const startedAt = Date.now();
    const response = await handleLineWebhook(await signedRequest(messagePayload({
      eventId: "offline-normal-ack",
      text: "SMOKE-IDEA-20260720-120000 sensitive-message",
    })), baseEnv(idempotencyKv, runtimeKv), ctx);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(response.status, 200);
    assert.ok(elapsedMs < 150);
    assert.ok(ctx.tasks.length >= 2);
    assert.equal(fetchImpl.calls.length, 0);
    const immediateLogs = logs.join("\n");
    for (const forbidden of ["sensitive-message", "SMOKE-IDEA-20260720-120000", "reply-token-sensitive", "user-id-sensitive", "offline-channel-secret"] ) {
      assert.equal(immediateLogs.includes(forbidden), false);
    }
    const acceptance = JSON.parse(idempotencyKv.values.get("offline-normal-ack"));
    assert.equal(acceptance.status, "accepted");
    assert.deepEqual(Object.keys(acceptance).sort(), ["accepted_at", "correlation_uuid", "schema", "status"]);
    releaseEvidence();
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
  }
});

test("KV GET timeout returns 503 inside the ACK budget and never starts n8n", async () => {
  const idempotencyKv = new MemoryKv();
  idempotencyKv.getImpl = async () => new Promise(() => {});
  const runtimeKv = new MemoryKv();
  const ctx = createContext({ __testAckBudgetMs: 100, __testKvGetTimeoutMs: 25, __testKvPutTimeoutMs: 40 });
  const originalFetch = globalThis.fetch;
  const fetchImpl = n8nFetch();
  globalThis.fetch = fetchImpl;
  try {
    const startedAt = Date.now();
    const response = await handleLineWebhook(await signedRequest(messagePayload({ eventId: "offline-get-timeout" })), baseEnv(idempotencyKv, runtimeKv), ctx);
    assert.equal(response.status, 503);
    assert.ok(Date.now() - startedAt < 100);
    assert.equal(idempotencyKv.putCalls.length, 0);
    assert.equal(runtimeKv.putCalls.length, 0);
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production KV GET timeout returns 503 before the 3000ms LINE limit", { timeout: 4000 }, async () => {
  const idempotencyKv = new MemoryKv();
  idempotencyKv.getImpl = async () => new Promise(() => {});
  const runtimeKv = new MemoryKv();
  const ctx = createContext();
  const startedAt = Date.now();
  const response = await handleLineWebhook(
    await signedRequest(messagePayload({ eventId: "offline-production-get-timeout" })),
    baseEnv(idempotencyKv, runtimeKv),
    ctx,
  );
  const elapsedMs = Date.now() - startedAt;
  assert.equal(response.status, 503);
  assert.ok(elapsedMs >= 850);
  assert.ok(elapsedMs < 3000);
  assert.equal(idempotencyKv.putCalls.length, 0);
  assert.equal(runtimeKv.putCalls.length, 0);
  assert.equal(ctx.tasks.length, 0);
});

test("production ambiguous KV PUT timeout returns 503 before the 3000ms LINE limit", { timeout: 4000 }, async () => {
  const idempotencyKv = new MemoryKv();
  idempotencyKv.putImpl = async (key, value) => {
    await new Promise((resolve) => setTimeout(resolve, 1650));
    idempotencyKv.values.set(key, value);
  };
  const runtimeKv = new MemoryKv();
  const ctx = createContext();
  const startedAt = Date.now();
  const response = await handleLineWebhook(
    await signedRequest(messagePayload({ eventId: "offline-production-put-timeout" })),
    baseEnv(idempotencyKv, runtimeKv),
    ctx,
  );
  const elapsedMs = Date.now() - startedAt;
  assert.equal(response.status, 503);
  assert.ok(elapsedMs >= 1400);
  assert.ok(elapsedMs < 3000);
  assert.equal(runtimeKv.putCalls.length, 0);
  assert.equal(ctx.tasks.length, 1);
  await Promise.all(ctx.tasks);
  assert.equal(JSON.parse(idempotencyKv.values.get("offline-production-put-timeout")).status, "accepted");
});

test("ambiguous KV PUT times out with 503, then redelivery resumes without loss", async () => {
  const idempotencyKv = new MemoryKv();
  let firstPut = true;
  idempotencyKv.putImpl = async (key, value) => {
    if (firstPut) {
      firstPut = false;
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    idempotencyKv.values.set(key, value);
  };
  const runtimeKv = new MemoryKv();
  const firstCtx = createContext({ __testAckBudgetMs: 100, __testKvGetTimeoutMs: 25, __testKvPutTimeoutMs: 12 });
  const originalFetch = globalThis.fetch;
  const fetchImpl = n8nFetch();
  globalThis.fetch = fetchImpl;
  try {
    const payload = messagePayload({ eventId: "offline-ambiguous-put" });
    const firstResponse = await handleLineWebhook(await signedRequest(payload), baseEnv(idempotencyKv, runtimeKv), firstCtx);
    assert.equal(firstResponse.status, 503);
    assert.equal(fetchImpl.calls.length, 0);
    assert.equal(runtimeKv.putCalls.length, 0);
    await Promise.all(firstCtx.tasks);
    assert.equal(JSON.parse(idempotencyKv.values.get("offline-ambiguous-put")).status, "accepted");

    const redeliveryCtx = createContext({ __testAckBudgetMs: 100, __testKvGetTimeoutMs: 25, __testKvPutTimeoutMs: 30 });
    const redeliveryResponse = await handleLineWebhook(await signedRequest(payload), baseEnv(idempotencyKv, runtimeKv), redeliveryCtx);
    assert.equal(redeliveryResponse.status, 200);
    assert.equal((await redeliveryResponse.json()).resumed, true);
    await Promise.all(redeliveryCtx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    assert.equal(JSON.parse(idempotencyKv.values.get("offline-ambiguous-put")).status, "dispatched");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dispatched duplicate does not call n8n or create another pending task; reply token stays only in pending task", async () => {
  const idempotencyKv = new MemoryKv();
  const runtimeKv = new MemoryKv();
  const originalFetch = globalThis.fetch;
  const fetchImpl = n8nFetch("idea_create");
  globalThis.fetch = fetchImpl;
  try {
    const payload = messagePayload({ eventId: "offline-duplicate-idea", text: "記一下：不可重複 pending" });
    const firstCtx = createContext();
    const firstResponse = await handleLineWebhook(await signedRequest(payload), baseEnv(idempotencyKv, runtimeKv), firstCtx);
    assert.equal(firstResponse.status, 200);
    await Promise.all(firstCtx.tasks);

    const pendingKeys = [...runtimeKv.values.keys()].filter((key) => key.startsWith("idea_json:v1:pending:"));
    const taskKeys = [...runtimeKv.values.keys()].filter((key) => key.startsWith("idea_json:v1:task:"));
    assert.equal(pendingKeys.length, 1);
    assert.equal(taskKeys.length, 1);
    assert.equal(JSON.parse(runtimeKv.values.get(taskKeys[0])).reply_token, "reply-token-sensitive");
    for (const [key, value] of runtimeKv.values.entries()) {
      if (key.startsWith("evidence:v1:")) {
        assert.equal(String(value).includes("reply-token-sensitive"), false);
        assert.equal(String(value).includes("user-id-sensitive"), false);
      }
    }

    const secondCtx = createContext();
    const secondResponse = await handleLineWebhook(await signedRequest(payload), baseEnv(idempotencyKv, runtimeKv), secondCtx);
    assert.equal(secondResponse.status, 200);
    assert.equal((await secondResponse.json()).reason, "duplicate_line_event");
    assert.equal(secondCtx.tasks.length, 0);
    assert.equal([...runtimeKv.values.keys()].filter((key) => key.startsWith("idea_json:v1:pending:")).length, 1);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public Path A/B routes remain fixed and removed contracts stay absent", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/index.js", import.meta.url), "utf8"));
  for (const route of ["/health", "/test/evidence", "/test/evidence/selfcheck", "/test/idea-finalize", "/test/codex-finalize", "/line/webhook"]) {
    assert.equal(source.includes(route), true);
  }
  for (const forbidden of ["/test/crud-finalize", "crud_task:v1", "codex_delegate", "google_calendar_direct"]) {
    assert.equal(source.includes(forbidden), false);
  }
  const missing = await worker.fetch(new Request("https://worker.example/new-public-route", { method: "POST" }), {}, {});
  assert.equal(missing.status, 404);
});
