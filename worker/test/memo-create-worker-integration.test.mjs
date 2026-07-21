import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  MEMO_ACK_PUT_RESERVE_MS,
  MEMO_ACK_RESPONSE_MARGIN_MS,
  buildMemoCreateIdentity,
  buildMemoCreateN8nPayload,
  createMemoCreateAcceptanceRecord,
  handleLineWebhook,
  handleMemoFinalize,
  memoAckRemainingBudgetMs,
  memoSuccessReplyText,
  parseMemoCreateCommand,
  workerHealth,
} from "../src/index.js";

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.getCalls = [];
    this.putCalls = [];
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
    return {
      keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
    };
  }
}

function createContext() {
  const tasks = [];
  return {
    tasks,
    waitUntil(task) {
      tasks.push(task);
    },
  };
}

function memoEvent({
  eventId = "memo-event-offline-1",
  text = "備忘錄：  明天帶雨傘  ",
  replyToken = "reply-token-sensitive",
  userId = "raw-user-id-sensitive",
} = {}) {
  return {
    type: "message",
    webhookEventId: eventId,
    replyToken,
    source: { type: "user", userId },
    message: { id: `message-${eventId}`, type: "text", text },
    deliveryContext: { isRedelivery: false },
  };
}

async function signedRequest(event, secret = "offline-channel-secret") {
  const rawBody = JSON.stringify({ events: [event] });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return new Request("https://pline-v3-test-line-gateway.phy4175.workers.dev/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": Buffer.from(signature).toString("base64"),
    },
    body: rawBody,
  });
}

function baseEnv(idempotencyKv = new MemoryKv(), runtimeKv = new MemoryKv(), extra = {}) {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-access-token",
    LINE_TEST_ADMIN_USER_IDS: "raw-user-id-sensitive",
    N8N_WEBHOOK_URL: "https://n8n.example/webhook/pline-v3-test-ai-agent",
    N8N_SHARED_SECRET: "offline-shared-secret",
    N8N_MEMO_CALLBACK_SECRET: "offline-only-nonsecret-fixture",
    IDEMPOTENCY_KV: idempotencyKv,
    RUNTIME_KV: runtimeKv,
    LINE_REPLY_NOW_MS: () => Date.now(),
    ...extra,
  };
}

function createIntegratedFetch(env, options = {}) {
  const calls = [];
  let callbackBody = null;
  const fetchImpl = async (url, requestOptions = {}) => {
    const target = String(url);
    calls.push({ url: target, options: requestOptions });
    if (target.startsWith("https://n8n.example/")) {
      const payload = JSON.parse(requestOptions.body);
      if (options.n8nDelay) await options.n8nDelay;
      callbackBody = {
        task_id: payload.reply_delivery_reference.task_id,
        request_id: payload.reply_delivery_reference.request_id,
        status: options.callbackStatus || "completed",
        operation: "memo_create",
        memo_id: payload.memo_id,
        reply_text: "已經幫妳把備忘錄存好了。",
      };
      if (options.skipCallback !== true) {
        await handleMemoFinalize(new Request(payload.reply_delivery_reference.callback_url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-pline-v3-memo-callback-secret": env.N8N_MEMO_CALLBACK_SECRET,
          },
          body: JSON.stringify(callbackBody),
        }), env);
      }
      return new Response(JSON.stringify({
        ok: options.n8nOk !== false,
        intent: "memo_create",
        status: options.n8nStatus || (options.skipCallback ? "readback_failed" : options.callbackStatus || "completed"),
        memo_id: payload.memo_id,
        callback_sent: options.skipCallback !== true,
        reply_text: options.skipCallback ? "備忘錄目前尚未完成。" : "已經幫妳把備忘錄存好了。",
      }), { status: options.n8nHttpStatus || 200, headers: { "content-type": "application/json" } });
    }
    if (target.endsWith("/v2/bot/message/reply")) {
      if (options.replyThrows) throw new Error("simulated ambiguous reply transport");
      return new Response("", { status: options.replyStatus || 200 });
    }
    if (target.endsWith("/v2/bot/message/push")) {
      throw new Error("memo_create must never use Push");
    }
    return new Response("", { status: 204 });
  };
  fetchImpl.calls = calls;
  fetchImpl.callbackBody = () => callbackBody;
  return fetchImpl;
}

function acceptanceEntry(kv) {
  const entry = [...kv.values.entries()].find(([key]) => key.startsWith("memo_create:v1:acceptance:"));
  return entry ? { key: entry[0], record: JSON.parse(entry[1]) } : null;
}

test("exact full-width memo prefix trims content; half-width and legacy idea command do not enter memo_create", () => {
  assert.deepEqual(parseMemoCreateCommand("備忘錄：  明天帶雨傘  "), {
    matched: true,
    valid: true,
    content: "明天帶雨傘",
    reason: "",
  });
  assert.deepEqual(parseMemoCreateCommand("備忘錄：   "), {
    matched: true,
    valid: false,
    content: "",
    reason: "empty_content",
  });
  assert.equal(parseMemoCreateCommand("備忘錄:半形冒號").matched, false);
  assert.equal(parseMemoCreateCommand("記一下：維持 idea_create").matched, false);
});

test("safe event identity deterministically produces the Published memo_id and filename contract", async () => {
  const event = memoEvent();
  const env = baseEnv();
  const first = await buildMemoCreateIdentity(event, "明天帶雨傘", env, "2026-07-20T12:00:00.000Z");
  const second = await buildMemoCreateIdentity(event, "明天帶雨傘", env, "2026-07-20T12:00:00.000Z");
  assert.match(first.safe_event_hash, /^[a-f0-9]{64}$/);
  assert.equal(first.safe_event_hash, second.safe_event_hash);
  assert.equal(first.memo_id, `memo-${first.safe_event_hash}`);
  assert.equal(first.filename, `${first.memo_id}.json`);
  assert.equal(first.callback_reference.task_id, second.callback_reference.task_id);
  assert.equal(first.callback_reference.request_id, second.callback_reference.request_id);
  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes(event.source.userId), false);
  assert.equal(serialized.includes(event.replyToken), false);
  const payload = buildMemoCreateN8nPayload({
    ...first,
    callback_reference: first.callback_reference,
  }, "明天帶雨傘");
  assert.deepEqual(Object.keys(payload).sort(), [
    "canonical_content",
    "intent",
    "memo_id",
    "received_at",
    "reply_delivery_reference",
    "safe_event_hash",
  ]);
  assert.deepEqual(Object.keys(payload.reply_delivery_reference).sort(), ["callback_url", "request_id", "task_id"]);
  assert.equal(JSON.stringify(payload).includes("finalize_token"), false);
});

test("final memo callback is Header-Auth-only and rejects missing, wrong, or legacy body credentials", async () => {
  const idempotencyKv = new MemoryKv();
  const env = baseEnv(idempotencyKv);
  const event = memoEvent({ eventId: "memo-header-auth-transition" });
  const command = parseMemoCreateCommand(event.message.text);
  const identity = await buildMemoCreateIdentity(event, command.content, env, "2026-07-20T12:00:00.000Z");
  const record = createMemoCreateAcceptanceRecord({
    identity,
    memoCommand: command,
    replyToken: event.replyToken,
    correlationId: "safe-correlation-only",
  });
  await idempotencyKv.put(`memo_create:v1:acceptance:${identity.safe_event_hash}`, JSON.stringify(record));
  const callbackBody = {
    task_id: identity.callback_reference.task_id,
    request_id: identity.callback_reference.request_id,
    status: "completed",
    operation: "memo_create",
    memo_id: identity.memo_id,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).endsWith("/v2/bot/message/reply")
    ? new Response("", { status: 200 })
    : new Response("", { status: 204 });
  try {
    const missingResponse = await handleMemoFinalize(new Request("https://worker.example/test/memo-finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(callbackBody),
    }), env);
    assert.equal(missingResponse.status, 401);

    const wrongResponse = await handleMemoFinalize(new Request("https://worker.example/test/memo-finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pline-v3-memo-callback-secret": "wrong-offline-fixture",
      },
      body: JSON.stringify(callbackBody),
    }), env);
    assert.equal(wrongResponse.status, 401);

    const legacyBodyResponse = await handleMemoFinalize(new Request("https://worker.example/test/memo-finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...callbackBody, finalize_token: "retired-body-credential" }),
    }), env);
    assert.equal(legacyBodyResponse.status, 401);

    const headerResponse = await handleMemoFinalize(new Request("https://worker.example/test/memo-finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pline-v3-memo-callback-secret": env.N8N_MEMO_CALLBACK_SECRET,
      },
      body: JSON.stringify(callbackBody),
    }), env);
    assert.equal(headerResponse.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memo_create ACK is bounded, n8n runs in waitUntil, callback Replies once, and duplicate is fully suppressed", async () => {
  const idempotencyKv = new MemoryKv();
  const runtimeKv = new MemoryKv();
  const env = baseEnv(idempotencyKv, runtimeKv);
  const ctx = createContext();
  const event = memoEvent();
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs = [];
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  console.log = (value) => logs.push(String(value));
  try {
    const response = await handleLineWebhook(await signedRequest(event), env, ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).route, "memo_create");
    assert.ok(ctx.tasks.length >= 1);
    await Promise.all(ctx.tasks);

    const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
    const replyCalls = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply"));
    const pushCalls = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push"));
    assert.equal(n8nCalls.length, 1);
    assert.equal(replyCalls.length, 1);
    assert.equal(pushCalls.length, 0);
    assert.equal(Object.keys(replyCalls[0].options.headers).some((key) => key.toLowerCase() === "x-line-retry-key"), false);
    const n8nPayload = JSON.parse(n8nCalls[0].options.body);
    assert.equal(n8nPayload.intent, "memo_create");
    assert.equal(n8nPayload.canonical_content, "明天帶雨傘");
    assert.equal(JSON.stringify(n8nPayload).includes(event.source.userId), false);
    assert.equal(JSON.stringify(n8nPayload).includes(event.replyToken), false);

    const replyPayload = JSON.parse(replyCalls[0].options.body);
    assert.equal(replyPayload.messages[0].text, "已經幫妳把備忘錄存好了。");
    assert.equal(replyPayload.messages[0].text.includes(n8nPayload.memo_id), false);
    assert.equal(replyPayload.messages[0].text.includes("備忘錄編號"), false);
    for (const forbidden of ["Codex", "n8n", "KV", "Dropbox", "Worker"]) {
      assert.equal(replyPayload.messages[0].text.includes(forbidden), false);
    }

    const acceptance = acceptanceEntry(idempotencyKv);
    assert.equal(acceptance.record.status, "final_completed");
    assert.equal(acceptance.record.dispatch_status, "dispatched");
    assert.equal(acceptance.record.reply_token, "");
    assert.equal("finalize_token" in acceptance.record.callback_reference, false);
    assert.equal("finalize_token_hash" in acceptance.record, false);
    const serializedRecord = JSON.stringify(acceptance.record);
    assert.equal(serializedRecord.includes(event.source.userId), false);
    assert.equal(serializedRecord.includes(event.replyToken), false);
    assert.equal([...runtimeKv.values.keys()].some((key) => key.includes("pending") || key.includes("wake")), false);

    const duplicateCtx = createContext();
    const duplicateResponse = await handleLineWebhook(await signedRequest(event), env, duplicateCtx);
    assert.equal(duplicateResponse.status, 200);
    assert.equal((await duplicateResponse.json()).reason, "duplicate_line_event");
    assert.equal(duplicateCtx.tasks.length, 0);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);

    const repeatedCallback = await handleMemoFinalize(new Request("https://worker.example/test/memo-finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pline-v3-memo-callback-secret": env.N8N_MEMO_CALLBACK_SECRET,
      },
      body: JSON.stringify(fetchImpl.callbackBody()),
    }), env);
    assert.equal(repeatedCallback.status, 200);
    assert.equal((await repeatedCallback.json()).status, "already_finalized");
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);

    const safeOutput = `${logs.join("\n")}\n${JSON.stringify(workerHealth(env))}`;
    for (const forbidden of [event.source.userId, event.replyToken, n8nPayload.safe_event_hash]) {
      assert.equal(safeOutput.includes(forbidden), false);
    }
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
  }
});

test("Memo Create/Modify/Delete success text is validated and falls back without any memo identity", () => {
  assert.equal(memoSuccessReplyText({
    operation: "memo_create",
    replyText: "已經幫妳存好了，晚點想找時再告訴我。",
  }), "已經幫妳存好了，晚點想找時再告訴我。");
  assert.equal(memoSuccessReplyText({
    operation: "memo_modify",
    replyText: "好，我幫妳改好了。",
  }), "好，我幫妳改好了。");
  assert.equal(memoSuccessReplyText({
    operation: "memo_delete",
    replyText: "已經刪除了，這筆不會再出現在目前備忘錄裡。",
  }), "已經刪除了，這筆不會再出現在目前備忘錄裡。");

  const leaked = `已完成，備忘錄編號：memo-${"a".repeat(64)}`;
  assert.equal(memoSuccessReplyText({ operation: "memo_create", replyText: leaked }), "好，我幫妳記好了。");
  assert.equal(memoSuccessReplyText({ operation: "memo_modify", replyText: "JSON path /菲比/memo.json" }), "好，我幫妳改好了。");
  assert.equal(memoSuccessReplyText({ operation: "memo_delete", replyText: "" }), "好，我幫妳刪除了。");
  const searchReply = memoSuccessReplyText({
    operation: "memo_search",
    replyText: `找到 1 筆使用中備忘錄。\n1. memo-${"b".repeat(64)}｜買牛奶`,
  });
  assert.equal(searchReply, "找到 1 筆使用中備忘錄，第 1/1 頁。\n1. 買牛奶");
  assert.equal(searchReply.includes("memo-"), false);
});

test("accepted but not dispatched memo redelivery resumes the same deterministic dispatch", async () => {
  const idempotencyKv = new MemoryKv();
  const env = baseEnv(idempotencyKv, new MemoryKv(), {
    LINE_REPLY_NOW_MS: Date.parse("2026-07-20T12:00:01.000Z"),
  });
  const event = memoEvent({ eventId: "memo-resume-event" });
  const command = parseMemoCreateCommand(event.message.text);
  const identity = await buildMemoCreateIdentity(event, command.content, env, "2026-07-20T12:00:00.000Z");
  const record = createMemoCreateAcceptanceRecord({
    identity,
    memoCommand: command,
    replyToken: event.replyToken,
    correlationId: "safe-correlation-only",
  });
  await idempotencyKv.put(`memo_create:v1:acceptance:${identity.safe_event_hash}`, JSON.stringify(record));
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  try {
    const response = await handleLineWebhook(await signedRequest(event), env, ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).resumed, true);
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("empty memo rejects naturally with zero n8n, zero Push, and no pending or wake", async () => {
  const idempotencyKv = new MemoryKv();
  const runtimeKv = new MemoryKv();
  const env = baseEnv(idempotencyKv, runtimeKv);
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  try {
    const response = await handleLineWebhook(await signedRequest(memoEvent({ text: "備忘錄：   " })), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0);
    const replyCall = fetchImpl.calls.find((call) => call.url.endsWith("/v2/bot/message/reply"));
    assert.equal(JSON.parse(replyCall.options.body).messages[0].text, "請在「備忘錄：」後面輸入要記錄的內容。");
    assert.equal([...runtimeKv.values.keys()].some((key) => key.includes("pending") || key.includes("wake")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("n8n delay never blocks the 200 ACK", async () => {
  const idempotencyKv = new MemoryKv();
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  let releaseN8n;
  const n8nDelay = new Promise((resolve) => { releaseN8n = resolve; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createIntegratedFetch(env, { n8nDelay });
  try {
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-delayed-event" })), env, ctx);
    assert.equal(response.status, 200);
    releaseN8n();
    await Promise.all(ctx.tasks);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Memo production GET may exceed 900ms when it still fits the remaining 2800ms budget", { timeout: 5000 }, async () => {
  const idempotencyKv = new MemoryKv();
  let delayed = false;
  idempotencyKv.getImpl = async (key) => {
    if (!delayed && key.startsWith("memo_create:v1:acceptance:")) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 950));
    }
    return idempotencyKv.values.get(key) ?? null;
  };
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  try {
    const startedAt = Date.now();
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-get-over-900" })), env, ctx);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(response.status, 200);
    assert.ok(elapsedMs >= 900);
    assert.ok(elapsedMs < 2800);
    assert.ok(acceptanceEntry(idempotencyKv));
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Memo GET beyond its remaining safe budget returns 503 before 2800ms with zero PUT and zero dispatch", { timeout: 5000 }, async () => {
  const idempotencyKv = new MemoryKv();
  idempotencyKv.getImpl = async () => new Promise(() => {});
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  try {
    const startedAt = Date.now();
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-get-budget-exhausted" })), env, ctx);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(response.status, 503);
    assert.ok(elapsedMs < 2800);
    assert.equal(idempotencyKv.putCalls.length, 0);
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Memo GET exception returns 503 with zero acceptance PUT and zero dispatch", async () => {
  const idempotencyKv = new MemoryKv();
  idempotencyKv.getImpl = async () => { throw new Error("offline get failure"); };
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  try {
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-get-exception" })), env, ctx);
    assert.equal(response.status, 503);
    assert.equal(idempotencyKv.putCalls.length, 0);
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Memo acceptance PUT may use the remaining budget and must complete durably before 200", { timeout: 5000 }, async () => {
  const idempotencyKv = new MemoryKv();
  let delayed = false;
  idempotencyKv.putImpl = async (key, value) => {
    if (!delayed && key.startsWith("memo_create:v1:acceptance:")) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 1050));
    }
    idempotencyKv.values.set(key, value);
  };
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  try {
    const startedAt = Date.now();
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-put-within-remaining" })), env, ctx);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(response.status, 200);
    assert.ok(elapsedMs >= 1000);
    assert.ok(elapsedMs < 2800);
    assert.ok(acceptanceEntry(idempotencyKv));
    await Promise.all(ctx.tasks);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Memo ambiguous PUT times out before 2800ms and durable late completion lets redelivery resume once", { timeout: 7000 }, async () => {
  const idempotencyKv = new MemoryKv();
  let releasePut;
  idempotencyKv.putImpl = async (key, value) => new Promise((resolve) => {
    releasePut = () => {
      idempotencyKv.values.set(key, value);
      resolve();
    };
  });
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const firstCtx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env);
  globalThis.fetch = fetchImpl;
  const event = memoEvent({ eventId: "memo-put-ambiguous-redelivery" });
  try {
    const startedAt = Date.now();
    const firstResponse = await handleLineWebhook(await signedRequest(event), env, firstCtx);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(firstResponse.status, 503);
    assert.ok(elapsedMs < 2800);
    assert.equal(fetchImpl.calls.length, 0);
    releasePut();
    await Promise.all(firstCtx.tasks);

    idempotencyKv.putImpl = null;
    const redeliveryCtx = createContext();
    const redeliveryResponse = await handleLineWebhook(await signedRequest(event), env, redeliveryCtx);
    assert.equal(redeliveryResponse.status, 200);
    assert.equal((await redeliveryResponse.json()).resumed, true);
    await Promise.all(redeliveryCtx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Dropbox/readback failure produces one natural Reply and never reports success", async () => {
  const idempotencyKv = new MemoryKv();
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env, { skipCallback: true, n8nStatus: "readback_failed" });
  globalThis.fetch = fetchImpl;
  try {
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-readback-failed" })), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    const replyCalls = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply"));
    assert.equal(replyCalls.length, 1);
    const text = JSON.parse(replyCalls[0].options.body).messages[0].text;
    assert.equal(text, "備忘錄目前尚未完成，請稍後再試一次。");
    assert.equal(text.includes("存好了"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ambiguous Memo Reply never retries and never falls back to Push", async () => {
  const idempotencyKv = new MemoryKv();
  const env = baseEnv(idempotencyKv, new MemoryKv());
  const ctx = createContext();
  const originalFetch = globalThis.fetch;
  const fetchImpl = createIntegratedFetch(env, { replyThrows: true });
  globalThis.fetch = fetchImpl;
  try {
    const response = await handleLineWebhook(await signedRequest(memoEvent({ eventId: "memo-ambiguous-reply" })), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0);
    const repeated = await handleMemoFinalize(new Request("https://worker.example/test/memo-finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pline-v3-memo-callback-secret": env.N8N_MEMO_CALLBACK_SECRET,
      },
      body: JSON.stringify(fetchImpl.callbackBody()),
    }), env);
    assert.equal(repeated.status, 200);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0);
    assert.equal(acceptanceEntry(idempotencyKv).record.status, "delivery_ambiguous");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("health exposes only the safe deterministic Memo Create contract", () => {
  const health = workerHealth({});
  assert.equal(MEMO_ACK_RESPONSE_MARGIN_MS, 150);
  assert.equal(MEMO_ACK_PUT_RESERVE_MS, 500);
  assert.equal(memoAckRemainingBudgetMs({ startedAt: 1000, nowMs: 1000, phase: "get" }), 2150);
  assert.equal(memoAckRemainingBudgetMs({ startedAt: 1000, nowMs: 1000, phase: "put" }), 2650);
  assert.deepEqual(health.memo_ack_kv_budget, {
    version: "remaining-budget-v1",
    hard_cap_ms: 2800,
    response_margin_ms: 150,
    get_policy: "remaining_minus_response_margin_and_put_reserve",
    put_reserve_ms: 500,
    put_policy: "remaining_minus_response_margin",
    timeout_http_status: 503,
    durable_acceptance_before_200: true,
  });
  assert.deepEqual(health.memo_create, {
    command_prefix: "備忘錄：",
    colon_contract: "full_width_only",
    route_mode: "deterministic_before_ai_classification",
    memo_id: "memo-<safe_event_hash_sha256>",
    filename: "<memo_id>.json",
    cloud_writer: "n8n_deterministic_create_if_absent_readback",
    finalizer_path: "/test/memo-finalize",
    finalizer_reference: "opaque_task_scoped",
    callback_auth: "header_auth_only",
    callback_header_auth_configured: false,
    callback_payload_credential_absent: true,
    reply_token_location: "worker_durable_acceptance_only",
    raw_user_id_stored: false,
    monitor_or_wake_dependency: false,
    processing_push: false,
    reply_max_attempts: 1,
    reply_retry_key: false,
    ambiguous_reply_push: false,
    eligibility_window_seconds: 55,
  });
  assert.deepEqual(health.memo_success_reply, {
    operations: ["memo_create", "memo_modify", "memo_delete"],
    normal_source: "validated_n8n_natural_language",
    fallback: "operation_specific_natural_text_without_id",
    memo_id_hidden: true,
    search_reply_numbered_without_memo_id: true,
    max_length: 160,
    finalizer_gates: ["header_auth", "task_state", "completed_status", "exactly_once"],
  });
  const serialized = JSON.stringify(health);
  for (const forbidden of ["reply-token-sensitive", "raw-user-id-sensitive", "offline-shared-secret"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("only the protected memo finalizer path is added; no CRUD, Calendar, delegate, or public memo CRUD route exists", async () => {
  const env = baseEnv();
  for (const path of ["/memo/search", "/memo/update", "/memo/delete", "/test/crud-finalize", "/calendar", "/codex_delegate"]) {
    const response = await worker.fetch(new Request(`https://worker.example${path}`, { method: "POST" }), env, createContext());
    assert.equal(response.status, 404);
  }
});
