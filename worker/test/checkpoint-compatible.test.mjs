import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker, {
  deliverFinalPushWith429Retry,
  enqueueCodexTask,
  enqueueIdeaTask,
  updateMonitorWakeKey,
  validateN8nContract,
  workerHealth,
} from "../src/index.js";

function memoryKv() {
  const values = new Map();
  const writes = [];
  return {
    values,
    writes,
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      writes.push({ key, value });
      values.set(key, value);
    },
  };
}

test("health exposes checkpoint Path A/B only", () => {
  const health = workerHealth({});
  assert.deepEqual(health.supported_intents, ["idea_create", "codex_task", "clarify", "unsupported"]);
  assert.deepEqual(health.gate_test_intents, ["idea_create", "codex_task"]);
  assert.deepEqual(health.codex_monitor.task_prefixes, ["codex_task:v1", "idea_json:v1"]);
  assert.deepEqual(health.codex_monitor.actions, ["create_smoke_file", "save_idea_json"]);
  assert.deepEqual(health.codex_monitor.wake_contract, {
    key: "monitor:wake:v1",
    schema: "pline-v3-test-monitor-wake/v1",
    write_on_new_pending: true,
    additional_kv_writes_per_new_task: 1,
    sensitive_payload: false,
  });
  assert.equal(health.codex_monitor.target_path, "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt");
  assert.deepEqual(health.line_final_delivery, {
    version: "line-reply-first-push-fallback-v1",
    reply_first: {
      endpoint: "/v2/bot/message/reply",
      eligibility_window_seconds: 55,
      max_attempts: 1,
      retry_key_header: false,
      ambiguous_policy: "no_reply_retry_no_immediate_push",
      monthly_push_usage_gate_applies: false,
    },
    push_fallback: {
      version: "line-final-delivery-429-retry-v1",
      endpoint: "/v2/bot/message/push",
      retry_http_status: 429,
      max_attempts: 2,
      default_retry_after_seconds: 60,
      retry_key_header: "X-Line-Retry-Key",
      durable_readback_required_before_push: true,
    },
    reply_token_persistence: "pending_only_redacted_after_finalizer",
  });
  assert.equal("crud_finalizer" in health, false);
  assert.equal("crud_confirmation_handler" in health, false);
  assert.equal("supported_domains" in health, false);
});

test("new pending tasks update one safe wake key and duplicates do not write it again", async () => {
  const codexKv = memoryKv();
  const env = { RUNTIME_KV: codexKv, N8N_SHARED_SECRET: "offline-test-secret" };
  const normalized = {
    request_id: "pline-v3-wake-codex-request",
    user_id: "offline-user-not-real",
    gate_marker: "",
  };
  const body = { task_id: "pline-v3-wake-codex-task" };

  const first = await enqueueCodexTask(env, normalized, body);
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, undefined);
  assert.deepEqual(codexKv.writes.map((entry) => entry.key), [
    "codex_task:v1:task:pline-v3-wake-codex-task",
    "codex_task:v1:pending:pline-v3-wake-codex-task",
    "monitor:wake:v1",
  ]);
  const wakeRecord = JSON.parse(codexKv.values.get("monitor:wake:v1"));
  assert.deepEqual(Object.keys(wakeRecord).sort(), ["schema", "updated_at", "version"]);
  assert.equal(wakeRecord.schema, "pline-v3-test-monitor-wake/v1");
  assert.ok(wakeRecord.version);
  assert.ok(wakeRecord.updated_at);

  const duplicate = await enqueueCodexTask(env, normalized, body);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(codexKv.writes.length, 3);

  const ideaKv = memoryKv();
  const ideaEnv = { RUNTIME_KV: ideaKv, N8N_SHARED_SECRET: "offline-test-secret" };
  const ideaNormalized = {
    request_id: "pline-v3-wake-idea-request",
    line_event_id: "offline-idea-event",
    user_id: "offline-user-not-real",
    message_text: "記一下：離線 wake 測試",
    gate_marker: "",
  };
  const ideaFirst = await enqueueIdeaTask(ideaEnv, ideaNormalized, { reply_text: "已記下" });
  assert.equal(ideaFirst.ok, true);
  assert.equal(ideaKv.writes.at(-1).key, "monitor:wake:v1");
  assert.equal(ideaKv.writes.length, 3);
  const ideaDuplicate = await enqueueIdeaTask(ideaEnv, ideaNormalized, { reply_text: "已記下" });
  assert.equal(ideaDuplicate.duplicate, true);
  assert.equal(ideaKv.writes.length, 3);
});

test("wake write failure is fail-open for the durable pending queue", async () => {
  const kv = memoryKv();
  const originalPut = kv.put.bind(kv);
  kv.put = async (key, value) => {
    if (key === "monitor:wake:v1") throw new Error("offline wake failure");
    return originalPut(key, value);
  };
  const wake = await updateMonitorWakeKey(kv);
  assert.deepEqual(wake, { ok: false, reason: "monitor_wake_write_failed" });

  const result = await enqueueCodexTask({
    RUNTIME_KV: kv,
    N8N_SHARED_SECRET: "offline-test-secret",
  }, {
    request_id: "pline-v3-wake-failure-request",
    user_id: "offline-user-not-real",
    gate_marker: "",
  }, {
    task_id: "pline-v3-wake-failure-task",
  });
  assert.equal(result.ok, true);
  assert.ok(kv.values.get("codex_task:v1:pending:pline-v3-wake-failure-task"));
});

test("forbidden active contracts are absent and CRUD finalize is not routed", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  for (const forbidden of [
    "codex_delegate",
    "enqueueCrudTask",
    "/test/crud-finalize",
    "google_calendar_direct",
    "crud_task:v1",
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must be absent`);
  }

  const response = await worker.fetch(new Request("https://worker.example/test/crud-finalize", { method: "POST" }), {}, {});
  assert.equal(response.status, 404);
});

test("n8n contract accepts fixed codex smoke and rejects removed intents", () => {
  const accepted = validateN8nContract({
    request_id: "pline-v3-test",
    intent: "codex_task",
    tool_called: "codex_task",
    action: "create_smoke_file",
    task_id: "fixed-smoke-task",
    reply_text: "處理中",
    status: "accepted",
  }, "pline-v3-test");
  assert.equal(accepted.ok, true);

  for (const intent of ["codex_delegate", "google_calendar_direct", "memo_crud", "calendar_crud"]) {
    const rejected = validateN8nContract({
      request_id: "pline-v3-test",
      intent,
      reply_text: "不可進入",
      status: "accepted",
    }, "pline-v3-test");
    assert.deepEqual(rejected, { ok: false, reason: "unsupported_intent" });
  }
});

test("final Push persists one retry key before each attempt and never sends a third time", async () => {
  const kv = memoryKv();
  const observed = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const durableRecord = JSON.parse(kv.values.get("delivery:test"));
    observed.push({
      retryKey: options.headers["X-Line-Retry-Key"],
      attemptCountBeforePush: durableRecord.attempt_count,
      persistedRetryKey: durableRecord.retry_key,
    });
    return new Response("", {
      status: 429,
      headers: { "retry-after": "0" },
    });
  };

  try {
    const result = await deliverFinalPushWith429Retry({
      env: {
        RUNTIME_KV: kv,
        LINE_CHANNEL_ACCESS_TOKEN: "test-token-not-a-secret",
        LINE_FINAL_RETRY_WAIT: async () => {},
      },
      deliveryKey: "delivery:test",
      userId: "test-user-not-real",
      replyText: "測試完成訊息",
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, "retry_exhausted");
    assert.equal(result.attempt_count, 2);
    assert.equal(observed.length, 2);
    assert.ok(observed[0].retryKey);
    assert.equal(observed[0].retryKey, observed[1].retryKey);
    assert.equal(observed[0].retryKey, observed[0].persistedRetryKey);
    assert.equal(observed[1].retryKey, observed[1].persistedRetryKey);
    assert.deepEqual(observed.map((item) => item.attemptCountBeforePush), [1, 2]);

    const finalRecord = JSON.parse(kv.values.get("delivery:test"));
    assert.equal(finalRecord.status, "retry_exhausted");
    assert.equal(finalRecord.attempt_count, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a delivered final is read back and never sent twice", async () => {
  const kv = memoryKv();
  let pushCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    pushCount += 1;
    return new Response("", { status: 200 });
  };

  try {
    const input = {
      env: {
        RUNTIME_KV: kv,
        LINE_CHANNEL_ACCESS_TOKEN: "test-token-not-a-secret",
        LINE_FINAL_RETRY_WAIT: async () => {},
      },
      deliveryKey: "delivery:exactly-once-test",
      userId: "test-user-not-real",
      replyText: "測試完成訊息",
    };
    const first = await deliverFinalPushWith429Retry(input);
    const duplicate = await deliverFinalPushWith429Retry(input);

    assert.equal(first.ok, true);
    assert.equal(first.status, "delivered");
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.status, "already_delivered");
    assert.equal(pushCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
