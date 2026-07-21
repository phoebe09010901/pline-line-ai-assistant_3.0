import assert from "node:assert/strict";
import {
  deliverFinalReplyFirst,
  enqueueIdeaTask,
  persistEvidenceStage,
} from "../src/index.js";

const originalFetch = globalThis.fetch;
const nowMs = Date.parse("2026-07-20T04:00:30.000Z");
const freshReceivedAt = "2026-07-20T04:00:00.000Z";
const expiredReceivedAt = "2026-07-20T03:59:34.999Z";
const rawReplyToken = "reply-token-MUST-NOT-LEAK";

function createMemoryKv() {
  const store = new Map();
  return {
    get: async (key) => store.get(key) || null,
    put: async (key, value) => store.set(key, value),
    delete: async (key) => store.delete(key),
    list: async ({ prefix = "" } = {}) => ({
      keys: [...store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
    }),
    _store: store,
  };
}

function envFor(kv, extra = {}) {
  return {
    RUNTIME_KV: kv,
    LINE_CHANNEL_ACCESS_TOKEN: "test-channel-access-token",
    LINE_REPLY_NOW_MS: nowMs,
    LINE_FINAL_RETRY_WAIT: async () => {},
    ...extra,
  };
}

function deliveryInput(kv, slug, extra = {}) {
  return {
    env: envFor(kv),
    deliveryKey: `delivery:${slug}`,
    userId: "test-user",
    replyToken: rawReplyToken,
    replyReceivedAt: freshReceivedAt,
    replyText: "處理完成。",
    ...extra,
  };
}

// 1. Fresh reply token -> one Reply 200 -> zero Push.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  const result = await deliverFinalReplyFirst(deliveryInput(kv, "fresh"));
  assert.equal(result.ok, true);
  assert.equal(result.delivery_mode, "reply");
  assert.equal(result.reply_attempt_count, 1);
  assert.equal(result.push_attempt_count, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/v2/bot/message/reply"), true);
  assert.equal(Object.keys(calls[0].options.headers).some((key) => key.toLowerCase() === "x-line-retry-key"), false);
  assert.equal([...kv._store.values()].some((value) => String(value).includes(rawReplyToken)), false);
}

// 2. Missing reply token -> zero Reply -> Push fallback.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  const result = await deliverFinalReplyFirst(deliveryInput(kv, "missing", { replyToken: "" }));
  assert.equal(result.delivery_mode, "push_fallback");
  assert.equal(result.reply_attempt_count, 0);
  assert.equal(result.push_attempt_count, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/v2/bot/message/push"), true);
}

// 3. Reply token older than 55 seconds -> zero Reply -> Push fallback.
{
  const kv = createMemoryKv();
  const calls = [];
  assert.equal(nowMs - Date.parse(expiredReceivedAt), 55_001);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  const result = await deliverFinalReplyFirst(deliveryInput(kv, "expired", { replyReceivedAt: expiredReceivedAt }));
  assert.equal(result.delivery_mode, "push_fallback");
  assert.equal(result.reply_attempt_count, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/v2/bot/message/push"), true);
}

// 3a. Boundary values below 55 seconds remain eligible and Reply starts immediately.
for (const [slug, replyReceivedAt, expectedElapsedMs] of [
  ["eligible-44s", "2026-07-20T03:59:46.000Z", 44_000],
  ["eligible-47-037s", "2026-07-20T03:59:42.963Z", 47_037],
  ["eligible-54-999s", "2026-07-20T03:59:35.001Z", 54_999],
]) {
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  assert.equal(nowMs - Date.parse(replyReceivedAt), expectedElapsedMs);
  const result = await deliverFinalReplyFirst(deliveryInput(kv, slug, { replyReceivedAt }));
  assert.equal(result.delivery_mode, "reply");
  assert.equal(result.reply_attempt_count, 1);
  assert.equal(result.push_attempt_count, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/v2/bot/message/reply"), true);
  assert.equal(Object.keys(calls[0].options.headers).some((key) => key.toLowerCase() === "x-line-retry-key"), false);
}

// 3b. An early final attempts Reply immediately; the eligibility window is not a wait target.
{
  const kv = createMemoryKv();
  let waitCalled = false;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  const result = await deliverFinalReplyFirst(deliveryInput(kv, "early-final", {
    replyReceivedAt: "2026-07-20T04:00:29.000Z",
    env: envFor(kv, {
      LINE_FINAL_RETRY_WAIT: async () => { waitCalled = true; },
    }),
  }));
  assert.equal(result.delivery_mode, "reply");
  assert.equal(calls.length, 1);
  assert.equal(waitCalled, false);
}

// 4. Explicit Reply rejection -> one Reply -> Push fallback.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: calls.length === 1 ? 400 : 200 });
  };
  const result = await deliverFinalReplyFirst(deliveryInput(kv, "rejected"));
  assert.equal(result.delivery_mode, "push_fallback");
  assert.equal(result.reply_attempt_count, 1);
  assert.equal(result.push_attempt_count, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.endsWith("/v2/bot/message/reply"), true);
  assert.equal(calls[1].url.endsWith("/v2/bot/message/push"), true);
}

// 5. Ambiguous Reply transport -> no Reply retry and no immediate Push.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    throw new Error("simulated connection interruption");
  };
  const input = deliveryInput(kv, "ambiguous");
  const first = await deliverFinalReplyFirst(input);
  const second = await deliverFinalReplyFirst(input);
  assert.equal(first.status, "delivery_ambiguous");
  assert.equal(first.reply_attempt_count, 1);
  assert.equal(first.push_attempt_count, 0);
  assert.equal(second.status, "delivery_ambiguous");
  assert.equal(calls.length, 1);
}

// 6. Push fallback 429 -> exactly one same-key retry, never a third attempt.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? new Response("", { status: 429, headers: { "retry-after": "0" } })
      : new Response("", { status: 200 });
  };
  const result = await deliverFinalReplyFirst(deliveryInput(kv, "push-retry", { replyToken: "" }));
  assert.equal(result.ok, true);
  assert.equal(result.push_attempt_count, 2);
  assert.equal(calls.length, 2);
  const retryKeys = calls.map((call) => call.options.headers["X-Line-Retry-Key"]);
  assert.equal(Boolean(retryKeys[0]), true);
  assert.equal(retryKeys[0], retryKeys[1]);
}

// 7. Reply success creates no Push retry and duplicate finalization makes no new request.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  const input = deliveryInput(kv, "reply-no-retry");
  const first = await deliverFinalReplyFirst(input);
  const duplicate = await deliverFinalReplyFirst(input);
  assert.equal(first.delivery_mode, "reply");
  assert.equal(duplicate.duplicate_blocked, true);
  assert.equal(calls.length, 1);
}

// 8. Webhook redelivery contract -> one pending task; duplicate enqueue and final are suppressed.
{
  const kv = createMemoryKv();
  const env = {
    RUNTIME_KV: kv,
    N8N_SHARED_SECRET: "offline-test-secret",
  };
  const normalized = {
    request_id: "pline-v3-redelivery-one",
    line_event_id: "redelivery-one",
    reply_token: rawReplyToken,
    received_at: freshReceivedAt,
    user_id: "offline-user",
    message_text: "記一下：Reply-first 測試",
    gate_marker: "",
  };
  const first = await enqueueIdeaTask(env, normalized, { reply_text: "已記下。" });
  const duplicate = await enqueueIdeaTask(env, normalized, { reply_text: "已記下。" });
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, undefined);
  assert.equal(duplicate.duplicate, true);
  assert.equal([...kv._store.keys()].filter((key) => key.startsWith("idea_json:v1:pending:")).length, 1);
  assert.equal([...kv._store.keys()].filter((key) => key.startsWith("idea_json:v1:task:")).length, 1);
}

// 9. Evidence and delivery records never contain the raw reply token.
{
  const kv = createMemoryKv();
  await persistEvidenceStage({ RUNTIME_KV: kv }, {
    request_id: "pline-v3-redaction",
    gate_marker: "",
    reply_token: rawReplyToken,
  }, "reply_first_contract_checked", {
    status: "completed",
    reply_token: rawReplyToken,
  });
  const serialized = JSON.stringify([...kv._store.entries()]);
  assert.equal(serialized.includes(rawReplyToken), false);
}

// 10. Exhausted monthly Push quota flag does not block an eligible Reply API call.
{
  const kv = createMemoryKv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  const input = deliveryInput(kv, "monthly-gate", {
    env: envFor(kv, { LINE_PUSH_MONTHLY_QUOTA_EXHAUSTED: "true" }),
  });
  const result = await deliverFinalReplyFirst(input);
  assert.equal(result.delivery_mode, "reply");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith("/v2/bot/message/reply"), true);
}

globalThis.fetch = originalFetch;
console.log("reply-first delivery offline tests PASS (14/14)");
