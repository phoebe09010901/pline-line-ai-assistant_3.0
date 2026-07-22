import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMemoDeterministicN8nPayload,
  handleLineWebhook,
  handleMemoFinalize,
  parseMemoCreateCommand,
  parseMemoDeterministicCommand,
  workerHealth,
} from "../src/index.js";

const MEMO_ID = `memo-${"a".repeat(64)}`;

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.getCalls = [];
    this.putCalls = [];
  }

  async get(key) {
    this.getCalls.push(key);
    return this.values.get(key) ?? null;
  }

  async put(key, value, options = {}) {
    this.putCalls.push({ key, value, options });
    this.values.set(key, value);
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

function lineEvent({ eventId, text }) {
  return {
    type: "message",
    webhookEventId: eventId,
    replyToken: "reply-token-sensitive",
    source: { type: "user", userId: "raw-user-id-sensitive" },
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
  return new Request("https://worker.example/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": Buffer.from(signature).toString("base64"),
    },
    body: rawBody,
  });
}

function baseEnv(idempotencyKv = new MemoryKv()) {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-access-token",
    LINE_TEST_ADMIN_USER_IDS: "raw-user-id-sensitive",
    N8N_WEBHOOK_URL: "https://n8n.example/webhook/pline-v3-test-ai-agent",
    N8N_SHARED_SECRET: "offline-shared-secret",
    N8N_MEMO_CALLBACK_SECRET: "offline-callback-secret",
    IDEMPOTENCY_KV: idempotencyKv,
    RUNTIME_KV: new MemoryKv(),
    LINE_REPLY_NOW_MS: () => Date.now(),
  };
}

function acceptanceRecord(kv) {
  const entry = [...kv.values.entries()].find(([key]) => key.startsWith("memo_create:v1:acceptance:"));
  return entry ? JSON.parse(entry[1]) : null;
}

function installIntegratedFetch(env, callbackReplyText = "找到 1 筆備忘錄。") {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options });
    if (target.startsWith("https://n8n.example/")) {
      const payload = JSON.parse(options.body);
      const callbackBody = {
        task_id: payload.reply_delivery_reference.task_id,
        request_id: payload.reply_delivery_reference.request_id,
        operation: payload.intent,
        status: "completed",
        memo_id: payload.memo_id || "",
        memo_ids: payload.memo_ids || [],
        selection_candidates: payload.intent === "memo_search"
          ? [{ position: 1, memo_id: MEMO_ID, summary: "測試摘要" }]
          : undefined,
        total: payload.intent === "memo_search" ? 1 : undefined,
        reply_text: payload.intent === "memo_search"
          ? "找到 1 筆使用中備忘錄。\n1. 測試摘要"
          : callbackReplyText,
      };
      await handleMemoFinalize(new Request(payload.reply_delivery_reference.callback_url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pline-v3-memo-callback-secret": env.N8N_MEMO_CALLBACK_SECRET,
        },
        body: JSON.stringify(callbackBody),
      }), env);
      return new Response(JSON.stringify({
        intent: payload.intent,
        status: "completed",
        callback_sent: true,
        memo_id: payload.memo_id || "",
        memo_ids: payload.memo_ids || [],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.endsWith("/v2/bot/message/reply")) {
      return new Response("", { status: 200 });
    }
    if (target.endsWith("/v2/bot/message/push")) {
      throw new Error("deterministic memo routes must never Push");
    }
    return new Response("", { status: 204 });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("search routes preserve exact keyword and explicitly distinguish list_all", () => {
  assert.deepEqual(parseMemoDeterministicCommand("備忘錄搜尋：  T1234A-20260721123456 雨傘  "), {
    matched: true,
    valid: true,
    intent: "memo_search",
    fields: { keyword: "T1234A-20260721123456 雨傘", list_all: false },
    reason: "",
  });
  assert.deepEqual(parseMemoDeterministicCommand("備忘錄搜尋：全部"), {
    matched: true,
    valid: true,
    intent: "memo_search",
    fields: { keyword: "", list_all: true },
    reason: "",
  });
  assert.equal(parseMemoDeterministicCommand("備忘錄搜尋：   ").valid, false);
  assert.equal(parseMemoDeterministicCommand("備忘錄搜尋:全部").matched, false);
});

test("modify route requires the exact safe memo id and preserves valid new content", () => {
  assert.deepEqual(parseMemoDeterministicCommand(`備忘錄修改： ${MEMO_ID} ｜  新內容｜保留合法分隔文字  `), {
    matched: true,
    valid: true,
    intent: "memo_modify",
    fields: { memo_id: MEMO_ID, new_content: "新內容｜保留合法分隔文字" },
    reason: "",
  });
  for (const input of [
    `備忘錄修改：${MEMO_ID} 新內容`,
    `備忘錄修改：${MEMO_ID}｜   `,
    "備忘錄修改：memo-abcd｜新內容",
    "備忘錄修改：../../memo-abc｜新內容",
    `備忘錄修改：${MEMO_ID}/extra｜新內容`,
  ]) {
    assert.equal(parseMemoDeterministicCommand(input).valid, false, input);
  }
});

test("delete route never requires a public internal memo id", () => {
  assert.deepEqual(parseMemoDeterministicCommand(`備忘錄刪除： ${MEMO_ID} `), {
    matched: true,
    valid: false,
    intent: "memo_delete",
    fields: {},
    reason: "delete_requires_search_selection",
  });
  for (const input of [
    "備忘錄刪除：memo-abcd",
    "備忘錄刪除：../memo-abcd",
    `備忘錄刪除：${MEMO_ID}.json`,
    `備忘錄刪除：${MEMO_ID}/child`,
  ]) {
    assert.equal(parseMemoDeterministicCommand(input).valid, false, input);
  }
});

test("legal search and modify bypass AI and dispatch only normalized safe payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const cases = [
      {
        eventId: "memo-search-route",
        text: "備忘錄搜尋：T9999A-20260721123456 雨傘",
        intent: "memo_search",
        fields: { keyword: "T9999A-20260721123456 雨傘", list_all: false },
      },
      {
        eventId: "memo-search-all-route",
        text: "備忘錄搜尋：全部",
        intent: "memo_search",
        fields: { keyword: "", list_all: true },
      },
      {
        eventId: "memo-modify-route",
        text: `備忘錄修改：${MEMO_ID}｜更新後內容`,
        intent: "memo_modify",
        fields: { memo_id: MEMO_ID, new_content: "更新後內容" },
      },
    ];

    for (const routeCase of cases) {
      const kv = new MemoryKv();
      const env = baseEnv(kv);
      const integratedFetch = installIntegratedFetch(env);
      globalThis.fetch = integratedFetch;
      const ctx = createContext();
      const event = lineEvent(routeCase);
      const response = await handleLineWebhook(await signedRequest(event), env, ctx);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).route, routeCase.intent);
      await Promise.all(ctx.tasks);

      const n8nCalls = integratedFetch.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
      const replyCalls = integratedFetch.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply"));
      const pushCalls = integratedFetch.calls.filter((call) => call.url.endsWith("/v2/bot/message/push"));
      assert.equal(n8nCalls.length, 1);
      assert.equal(replyCalls.length, 1);
      assert.equal(pushCalls.length, 0);
      const payload = JSON.parse(n8nCalls[0].options.body);
      assert.equal(payload.intent, routeCase.intent);
      for (const [key, value] of Object.entries(routeCase.fields)) assert.deepEqual(payload[key], value);
      assert.deepEqual(Object.keys(payload.reply_delivery_reference).sort(), ["callback_url", "request_id", "task_id"]);
      const serialized = JSON.stringify(payload);
      for (const forbidden of [event.source.userId, event.replyToken, "finalize_token", env.N8N_SHARED_SECRET, env.N8N_MEMO_CALLBACK_SECRET]) {
        assert.equal(serialized.includes(forbidden), false);
      }
      assert.equal(acceptanceRecord(kv).status, "final_completed");

      const duplicateCtx = createContext();
      const duplicateResponse = await handleLineWebhook(await signedRequest(event), env, duplicateCtx);
      assert.equal(duplicateResponse.status, 200);
      await Promise.all(duplicateCtx.tasks);
      assert.equal(integratedFetch.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
      assert.equal(integratedFetch.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid deterministic inputs Reply once and cause zero n8n, Push, pending, or wake side effects", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [eventId, text] of [
      ["invalid-search", "備忘錄搜尋：   "],
      ["invalid-modify", `備忘錄修改：${MEMO_ID}｜   `],
      ["invalid-delete", "備忘錄刪除：../../memo-abcd"],
    ]) {
      const kv = new MemoryKv();
      const env = baseEnv(kv);
      const integratedFetch = installIntegratedFetch(env);
      globalThis.fetch = integratedFetch;
      const ctx = createContext();
      const response = await handleLineWebhook(await signedRequest(lineEvent({ eventId, text })), env, ctx);
      assert.equal(response.status, 200);
      await Promise.all(ctx.tasks);
      assert.equal(integratedFetch.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
      assert.equal(integratedFetch.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
      assert.equal(integratedFetch.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0);
      assert.equal([...kv.values.keys()].some((key) => key.startsWith("codex_task:v1") || key.startsWith("idea_json:v1") || key === "monitor:wake:v1"), false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy Memo Create and idea_create commands remain outside the new intents", () => {
  assert.equal(parseMemoCreateCommand("備忘錄：原本 Memo Create").valid, true);
  assert.equal(parseMemoDeterministicCommand("備忘錄：原本 Memo Create").intent, "memo_create");
  assert.equal(parseMemoDeterministicCommand("記一下：維持 idea_create").matched, false);
});

test("health describes only the safe deterministic command contract and no public CRUD route", () => {
  const health = workerHealth({});
  assert.deepEqual(health.memo_deterministic_routes, {
    route_mode: "fixed_prefix_before_ai_classification",
    colon_contract: "full_width_only",
    separator_contract: "full_width_vertical_bar_for_modify",
    intents: ["memo_search", "memo_search_page", "memo_modify", "memo_delete"],
    command_prefixes: {
      search: "備忘錄搜尋：",
      modify: "備忘錄修改：",
      delete: "備忘錄刪除：",
    },
    selection_delete_commands: [
      "備忘錄刪除：第1筆",
      "刪除第1筆",
      "備忘錄刪除：第一筆到第五筆",
      "刪除第1、3、5筆",
      "備忘錄刪除：這次搜尋的全部",
    ],
    selection_scope: "latest_search_snapshot_same_hashed_actor_conversation",
    selection_storage: "IDEMPOTENCY_KV",
    selection_ttl_seconds: 600,
    selection_full_candidate_limit: 100,
    selection_snapshot_schema: "pline-v3-memo-search-selection/v3",
    selection_snapshot_sensitive_payload: false,
    page_size: 10,
    page_commands: ["查看下一頁", "查看上一頁", "查看第 N 頁"],
    page_readback: "protected_n8n_exact_snapshot_ids_in_order",
    delete_all_supported: true,
    delete_all_scope: "current_unexpired_same_actor_search_snapshot_only",
    confirmation_required: true,
    confirmation_phrase: "確認刪除",
    confirmation_cancel_phrase: "取消",
    confirmation_ttl_seconds: 600,
    confirmation_single_consumption: true,
    confirmation_actor_snapshot_candidate_bound: true,
    parser_supported_selection_items: 5,
    worker_batch_request_items: 5,
    live_execution_authorized_selection_items: 5,
    n8n_batch_archive_update_required: true,
    selection_batch_fail_closed_above_authorized_limit: true,
    search_reply_numbered_without_memo_id: true,
    list_all_literal: "全部",
    memo_id_format: "memo-<64_lowercase_sha256_hex>",
    path_from_user_input: false,
    ai_agent_bypass: true,
    durable_acceptance_before_200: true,
    background_n8n_dispatch: "after_consumed_confirmation_only",
    callback_auth: "header_auth_only",
    callback_payload_credential_absent: true,
    monitor_or_wake_dependency: false,
    processing_push: false,
    reply_max_attempts: 1,
    final_exactly_once: true,
  });
  const serialized = JSON.stringify(health);
  for (const forbidden of ["reply-token-sensitive", "raw-user-id-sensitive", "offline-callback-secret", "/memo/search", "/memo/modify", "/memo/delete"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("payload builder cannot add paths, raw identity, or credentials", () => {
  const payload = buildMemoDeterministicN8nPayload({
    operation: "memo_modify",
    safe_event_hash: "b".repeat(64),
    received_at: "2026-07-21T00:00:00.000Z",
    normalized_command: { memo_id: MEMO_ID, new_content: "保留文字" },
    callback_reference: {
      callback_url: "https://worker.example/test/memo-finalize",
      task_id: `memo-task-${"b".repeat(64)}`,
      request_id: `memo-request-${"b".repeat(64)}`,
    },
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "intent",
    "memo_id",
    "new_content",
    "received_at",
    "reply_delivery_reference",
    "safe_event_hash",
  ]);
  const serialized = JSON.stringify(payload);
  for (const forbidden of ["target_path", "filename", "replyToken", "raw_user_id", "credential", "finalize_token", "secret"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
