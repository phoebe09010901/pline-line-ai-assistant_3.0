import assert from "node:assert/strict";
import test from "node:test";

import {
  MEMO_SEARCH_PAGE_SIZE,
  MEMO_SEARCH_SELECTION_MAX_CANDIDATES,
  MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS,
  MEMO_SELECTION_WORKER_BATCH_REQUEST_LIMIT,
  MEMO_SELECTION_LIVE_EXECUTION_AUTHORIZED_LIMIT,
  MEMO_SEARCH_SELECTION_TTL_SECONDS,
  buildMemoSelectionScopeHash,
  handleLineWebhook,
  handleMemoFinalize,
  parseMemoDeterministicCommand,
  parseMemoSearchSelectionDeleteCommand,
  parseMemoSearchPageCommand,
  parseMemoSearchPageResult,
  parseMemoSearchSelectionResult,
  parseMemoSearchSelectionSnapshot,
  resolveMemoSearchPage,
  resolveMemoSearchSelectionDelete,
} from "../src/index.js";

const MEMO_IDS = Array.from({ length: 5 }, (_, index) => `memo-${String(index + 1).repeat(64)}`);
const FIFTEEN_MEMO_IDS = Array.from({ length: 15 }, (_, index) => `memo-${(index + 1).toString(16).padStart(2, "0").repeat(32)}`);

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

class StaleNegativeAcceptanceKv extends MemoryKv {
  constructor() {
    super();
    this.acceptanceWriteObserved = false;
    this.staleAcceptanceReadsRemaining = 0;
    this.staleAcceptanceReadsServed = 0;
  }

  async get(key) {
    this.getCalls.push(key);
    if (
      String(key).startsWith("memo_create:v1:acceptance:")
      && this.staleAcceptanceReadsRemaining > 0
      && JSON.parse(this.values.get(key) || "null")?.status === "accepted"
    ) {
      this.staleAcceptanceReadsRemaining -= 1;
      this.staleAcceptanceReadsServed += 1;
      return null;
    }
    return this.values.get(key) ?? null;
  }

  async put(key, value, options = {}) {
    this.putCalls.push({ key, value, options });
    this.values.set(key, value);
    const record = String(key).startsWith("memo_create:v1:acceptance:")
      ? JSON.parse(value)
      : null;
    if (!this.acceptanceWriteObserved && record?.status === "accepted") {
      this.acceptanceWriteObserved = true;
      this.staleAcceptanceReadsRemaining = 1;
    }
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
    replyToken: `reply-token-${eventId}`,
    source: { type: "user", userId: "raw-user-id-selection-test" },
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

function baseEnv(kv = new MemoryKv()) {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-access-token",
    LINE_TEST_ADMIN_USER_IDS: "raw-user-id-selection-test",
    N8N_WEBHOOK_URL: "https://n8n.example/webhook/pline-v3-test-ai-agent",
    N8N_SHARED_SECRET: "offline-shared-secret",
    N8N_MEMO_CALLBACK_SECRET: "offline-callback-secret",
    IDEMPOTENCY_KV: kv,
    RUNTIME_KV: new MemoryKv(),
    LINE_REPLY_NOW_MS: () => Date.now(),
  };
}

function searchReplyText() {
  return `找到 5 筆使用中備忘錄。${MEMO_IDS.map((memoId, index) => `\n${index + 1}. ${memoId}｜摘要 ${index + 1}`).join("")}`;
}

function installFetch(env) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options });
    if (target.startsWith("https://n8n.example/")) {
      const payload = JSON.parse(options.body);
      const isSearch = payload.intent === "memo_search";
      const isSearchPage = payload.intent === "memo_search_page";
      const searchMemoIds = fetchImpl.searchMemoIds;
      const callbackBody = {
        task_id: payload.reply_delivery_reference.task_id,
        request_id: payload.reply_delivery_reference.request_id,
        operation: payload.intent,
        status: "completed",
        memo_id: payload.memo_id || "",
        memo_ids: payload.memo_ids || [],
        selection_candidates: isSearch
          ? searchMemoIds.map((memoId, index) => ({ position: index + 1, memo_id: memoId }))
          : undefined,
        page_candidates: isSearch
          ? searchMemoIds.slice(0, MEMO_SEARCH_PAGE_SIZE).map((memoId, index) => ({ position: index + 1, memo_id: memoId, summary: `摘要 ${index + 1}` }))
          : isSearchPage
            ? (payload.memo_ids || []).map((memoId, index) => ({
                position: payload.global_start + index,
                memo_id: memoId,
                summary: `摘要 ${payload.global_start + index}`,
              }))
            : undefined,
        page: isSearch ? 1 : isSearchPage ? payload.page_number : undefined,
        total: isSearch ? searchMemoIds.length : undefined,
        reply_text: isSearch ? `找到 ${searchMemoIds.length} 筆使用中備忘錄。` : "好，我幫妳刪除了。",
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
      throw new Error("selection delete must not Push");
    }
    return new Response("", { status: 204 });
  };
  fetchImpl.calls = calls;
  fetchImpl.searchMemoIds = [...MEMO_IDS];
  return fetchImpl;
}

function snapshotRaw({ scopeHash, memoIds = MEMO_IDS, createdAt, expiresAt, currentPage = 1 }) {
  const total = memoIds.length;
  return JSON.stringify({
    schema: "pline-v3-memo-search-selection/v3",
    scope_hash: scopeHash,
    search_event_hash: "f".repeat(64),
    candidates: memoIds.map((memoId, index) => ({ position: index + 1, memo_id: memoId, summary: `摘要 ${index + 1}` })),
    total,
    page_size: 10,
    page_count: total === 0 ? 0 : Math.ceil(total / 10),
    current_page: total === 0 ? 0 : currentPage,
    delete_all_eligible: total > 0 && total <= 5,
    delete_all_limit: 5,
    created_at: createdAt,
    expires_at: expiresAt,
  });
}

test("single list and ascending range selection commands normalize to at most five indices", () => {
  assert.equal(MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS, 5);
  assert.equal(MEMO_SELECTION_WORKER_BATCH_REQUEST_LIMIT, 5);
  assert.equal(MEMO_SELECTION_LIVE_EXECUTION_AUTHORIZED_LIMIT, 5);
  assert.deepEqual(parseMemoSearchSelectionDeleteCommand("刪除第 2 筆備忘錄").fields, {
    selection_mode: "single",
    selection_indices: [2],
  });
  assert.deepEqual(parseMemoSearchSelectionDeleteCommand("刪除第 2、4、5 筆備忘錄").fields, {
    selection_mode: "multiple",
    selection_indices: [2, 4, 5],
  });
  assert.deepEqual(parseMemoSearchSelectionDeleteCommand("刪除第 2 到第 5 筆備忘錄").fields, {
    selection_mode: "range",
    selection_indices: [2, 3, 4, 5],
  });
  assert.deepEqual(parseMemoDeterministicCommand("備忘錄刪除：第1筆").fields, {
    selection_mode: "single",
    selection_indices: [1],
  });
  assert.deepEqual(parseMemoDeterministicCommand("刪除第1筆").fields, {
    selection_mode: "single",
    selection_indices: [1],
  });
  assert.deepEqual(parseMemoDeterministicCommand("備忘錄刪除：第一筆到第五筆").fields, {
    selection_mode: "range",
    selection_indices: [1, 2, 3, 4, 5],
  });
  assert.deepEqual(parseMemoDeterministicCommand("刪除第1、3、5筆").fields, {
    selection_mode: "multiple",
    selection_indices: [1, 3, 5],
  });
  assert.deepEqual(parseMemoDeterministicCommand("備忘錄刪除：這次搜尋的全部").fields, {
    selection_mode: "all",
    selection_indices: [],
  });
  const deduplicated = parseMemoSearchSelectionDeleteCommand("刪除第 5、2、4、2 筆備忘錄");
  assert.equal(deduplicated.valid, true);
  assert.deepEqual(deduplicated.fields.selection_indices, [2, 4, 5]);
  for (const input of ["全部清空", "批次刪除備忘錄", "刪除多筆備忘錄"]) {
    const parsed = parseMemoDeterministicCommand(input);
    assert.equal(parsed.matched, true, input);
    assert.equal(parsed.valid, false, input);
  }
  assert.equal(parseMemoDeterministicCommand("刪除全部").valid, true);
  assert.equal(parseMemoDeterministicCommand("備忘錄刪除：這次搜尋的全部").fields.selection_mode, "all");
});

test("invalid empty reverse oversized and malformed selections reject safely", () => {
  for (const [input, reason] of [
    ["刪除第 0 筆備忘錄", "invalid_selection_format"],
    ["刪除第 5 到第 2 筆備忘錄", "invalid_selection_range"],
    ["刪除第 1、2、3、4、5、6 筆備忘錄", "selection_too_large"],
    ["刪除第 筆備忘錄", "invalid_selection_format"],
  ]) {
    const parsed = parseMemoDeterministicCommand(input);
    assert.equal(parsed.matched, true, input);
    assert.equal(parsed.valid, false, input);
    assert.equal(parsed.reason, reason, input);
  }
});

test("strict search result parsing hides ids in LINE text and stores no summaries", () => {
  const parsed = parseMemoSearchSelectionResult(searchReplyText());
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.candidates.map((candidate) => candidate.memo_id), MEMO_IDS);
  assert.equal(parsed.reply_text.includes("memo-"), false);
  assert.match(parsed.reply_text, /1\. 摘要 1/);
  const structured = parseMemoSearchSelectionResult(
    "找到 5 筆使用中備忘錄。",
    MEMO_IDS.map((memoId, index) => ({ position: index + 1, memo_id: memoId, summary: `摘要 ${index + 1}` })),
    5,
  );
  assert.equal(structured.ok, true);
  assert.equal(structured.reply_text.includes("memo-"), false);
  assert.deepEqual(structured.candidates.map((candidate) => candidate.memo_id), MEMO_IDS);

  const now = Date.parse("2026-07-21T10:00:00.000Z");
  const raw = snapshotRaw({
    scopeHash: "e".repeat(64),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (MEMO_SEARCH_SELECTION_TTL_SECONDS * 1000)).toISOString(),
  });
  const snapshot = parseMemoSearchSelectionSnapshot(raw);
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "candidates", "created_at", "current_page", "delete_all_eligible", "delete_all_limit", "expires_at",
    "page_count", "page_size", "schema", "scope_hash", "search_event_hash", "total",
  ]);
  assert.deepEqual(Object.keys(snapshot.candidates[0]).sort(), ["memo_id", "position", "summary"]);
});

test("selection resolution rejects missing expired out-of-range and normalizes duplicate indices", () => {
  const scopeHash = "e".repeat(64);
  const now = Date.parse("2026-07-21T10:00:00.000Z");
  const live = snapshotRaw({
    scopeHash,
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 1000).toISOString(),
  });
  const expired = snapshotRaw({
    scopeHash,
    createdAt: new Date(now - 2000).toISOString(),
    expiresAt: new Date(now - 1000).toISOString(),
  });
  assert.equal(resolveMemoSearchSelectionDelete({ snapshotRaw: "", scopeHash, selectionMode: "single", selectionIndices: [1], nowMs: now }).reason, "selection_snapshot_missing");
  assert.equal(resolveMemoSearchSelectionDelete({ snapshotRaw: expired, scopeHash, selectionMode: "single", selectionIndices: [1], nowMs: now }).reason, "selection_snapshot_expired");
  assert.equal(resolveMemoSearchSelectionDelete({ snapshotRaw: live, scopeHash, selectionMode: "single", selectionIndices: [6], nowMs: now }).reason, "selection_index_out_of_range");
  assert.deepEqual(resolveMemoSearchSelectionDelete({ snapshotRaw: live, scopeHash, selectionMode: "multiple", selectionIndices: [5, 2, 4, 2], nowMs: now }).memo_ids, [MEMO_IDS[1], MEMO_IDS[3], MEMO_IDS[4]]);
  assert.deepEqual(resolveMemoSearchSelectionDelete({ snapshotRaw: live, scopeHash, selectionMode: "single", selectionIndices: [4], nowMs: now }).memo_ids, [MEMO_IDS[3]]);
  assert.deepEqual(resolveMemoSearchSelectionDelete({ snapshotRaw: live, scopeHash, selectionMode: "multiple", selectionIndices: [2, 4, 5], nowMs: now }).memo_ids, [MEMO_IDS[1], MEMO_IDS[3], MEMO_IDS[4]]);
  assert.deepEqual(resolveMemoSearchSelectionDelete({ snapshotRaw: live, scopeHash, selectionMode: "all", nowMs: now }).memo_ids, MEMO_IDS);
  const one = snapshotRaw({
    scopeHash,
    memoIds: [MEMO_IDS[0]],
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 1000).toISOString(),
  });
  assert.deepEqual(resolveMemoSearchSelectionDelete({ snapshotRaw: one, scopeHash, selectionMode: "all", nowMs: now }).memo_ids, [MEMO_IDS[0]]);
});

test("15-item delete all rejection Replies once with zero n8n and no batch execution", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const event = lineEvent({ eventId: "delete-all-limit-fresh", text: "刪除全部" });
  const scopeHash = await buildMemoSelectionScopeHash(event, env);
  const now = Date.now();
  kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
    scopeHash,
    memoIds: FIFTEEN_MEMO_IDS,
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const ctx = createContext();
    const response = await handleLineWebhook(await signedRequest(event), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);

    const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
    const replyCalls = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply"));
    assert.equal(n8nCalls.length, 0);
    assert.equal(replyCalls.length, 1);
    assert.match(JSON.parse(replyCalls[0].options.body).messages[0].text, /一次最多可刪除 5 筆/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("primed stale negative acceptance reread is bypassed by ACK handoff and duplicate Replies zero times", async () => {
  const kv = new StaleNegativeAcceptanceKv();
  const env = baseEnv(kv);
  const event = lineEvent({ eventId: "delete-all-limit-stale-negative", text: "刪除全部" });
  const scopeHash = await buildMemoSelectionScopeHash(event, env);
  const now = Date.now();
  kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
    scopeHash,
    memoIds: FIFTEEN_MEMO_IDS,
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const firstCtx = createContext();
    const firstResponse = await handleLineWebhook(await signedRequest(event), env, firstCtx);
    assert.equal(firstResponse.status, 200);
    await Promise.all(firstCtx.tasks);
    assert.equal(kv.acceptanceWriteObserved, true);
    assert.equal(kv.staleAcceptanceReadsRemaining, 1);
    assert.equal(kv.staleAcceptanceReadsServed, 0);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);

    const redeliveryEvent = {
      ...event,
      deliveryContext: { isRedelivery: true },
    };
    const duplicateCtx = createContext();
    const duplicateResponse = await handleLineWebhook(await signedRequest(redeliveryEvent), env, duplicateCtx);
    assert.equal(duplicateResponse.status, 200);
    assert.equal((await duplicateResponse.json()).reason, "duplicate_line_event");
    assert.equal(duplicateCtx.tasks.length, 0);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("no recent search produces one natural rejection and zero n8n batch", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const ctx = createContext();
    const event = lineEvent({ eventId: "selection-without-search", text: "刪除第 2 筆備忘錄" });
    const response = await handleLineWebhook(await signedRequest(event), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
    const replyCalls = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply"));
    assert.equal(replyCalls.length, 1);
    assert.equal(
      JSON.parse(replyCalls[0].options.body).messages[0].text,
      "妳想刪除哪些備忘錄？請先搜尋，或告訴我關鍵字／日期。",
    );
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a newer search overwrites the prior snapshot for the same hashed scope", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const firstEvent = lineEvent({ eventId: "selection-search-old", text: "備忘錄搜尋：全部" });
    const firstCtx = createContext();
    await handleLineWebhook(await signedRequest(firstEvent), env, firstCtx);
    await Promise.all(firstCtx.tasks);

    fetchImpl.searchMemoIds = [MEMO_IDS[4]];
    const nextEvent = lineEvent({ eventId: "selection-search-new", text: "備忘錄搜尋：摘要 5" });
    const nextCtx = createContext();
    await handleLineWebhook(await signedRequest(nextEvent), env, nextCtx);
    await Promise.all(nextCtx.tasks);

    const scopeHash = await buildMemoSelectionScopeHash(nextEvent, env);
    const key = `memo_search_selection:v1:${scopeHash}`;
    const snapshot = parseMemoSearchSelectionSnapshot(await kv.get(key));
    assert.deepEqual(snapshot.candidates.map((candidate) => candidate.memo_id), [MEMO_IDS[4]]);
    assert.equal(kv.putCalls.filter((call) => call.key === key).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("search snapshot then single selection waits for confirmation and dispatches one id-only batch once", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const searchEvent = lineEvent({ eventId: "selection-search", text: "備忘錄搜尋：全部" });
    const searchCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(searchEvent), env, searchCtx)).status, 200);
    await Promise.all(searchCtx.tasks);

    const scopeHash = await buildMemoSelectionScopeHash(searchEvent, env);
    const snapshotEntry = [...kv.values.entries()].find(([key]) => key === `memo_search_selection:v1:${scopeHash}`);
    assert.ok(snapshotEntry);
    const snapshotText = snapshotEntry[1];
    const snapshot = parseMemoSearchSelectionSnapshot(snapshotText);
    assert.deepEqual(snapshot.candidates.map((candidate) => candidate.memo_id), MEMO_IDS);
    for (const forbidden of [searchEvent.source.userId, searchEvent.replyToken, env.N8N_SHARED_SECRET, env.N8N_MEMO_CALLBACK_SECRET]) {
      assert.equal(snapshotText.includes(forbidden), false);
    }
    assert.equal(kv.putCalls.find((call) => call.key === `memo_search_selection:v1:${scopeHash}`).options.expirationTtl, 600);

    const searchReplyCall = fetchImpl.calls.find((call) => call.url.endsWith("/v2/bot/message/reply"));
    assert.equal(String(searchReplyCall.options.body).includes("memo-"), false);

    const deleteEvent = lineEvent({ eventId: "selection-delete", text: "刪除第 4 筆備忘錄" });
    const deleteCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(deleteEvent), env, deleteCtx)).status, 200);
    await Promise.all(deleteCtx.tasks);

    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    const confirmationPrompt = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).at(-1);
    assert.match(JSON.parse(confirmationPrompt.options.body).messages[0].text, /確認刪除/);
    assert.equal(String(confirmationPrompt.options.body).includes("memo-"), false);

    const confirmEvent = lineEvent({ eventId: "selection-delete-confirm", text: "確認刪除" });
    const confirmCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, confirmCtx)).status, 200);
    await Promise.all(confirmCtx.tasks);

    const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
    assert.equal(n8nCalls.length, 2);
    const batchPayload = JSON.parse(n8nCalls[1].options.body);
    assert.equal(batchPayload.intent, "memo_delete");
    assert.equal(batchPayload.delete_scope, "memo_search_selection_snapshot");
    assert.equal(batchPayload.confirmation_status, "consumed");
    assert.deepEqual(batchPayload.memo_ids, [MEMO_IDS[3]]);
    assert.equal("memo_id" in batchPayload, false);
    for (const forbidden of [deleteEvent.source.userId, deleteEvent.replyToken, env.N8N_SHARED_SECRET, env.N8N_MEMO_CALLBACK_SECRET]) {
      assert.equal(JSON.stringify(batchPayload).includes(forbidden), false);
    }

    const duplicateCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, duplicateCtx)).status, 200);
    await Promise.all(duplicateCtx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 2);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("list and range commands wait for confirmation then dispatch one ordered batch of at most five ids", async () => {
  for (const scenario of [
    { eventId: "selection-list-batch", text: "刪除第 5、2、4、2 筆備忘錄", expected: [MEMO_IDS[1], MEMO_IDS[3], MEMO_IDS[4]] },
    { eventId: "selection-range-batch", text: "刪除第 2 到第 5 筆備忘錄", expected: MEMO_IDS.slice(1, 5) },
  ]) {
    const kv = new MemoryKv();
    const env = baseEnv(kv);
    const event = lineEvent(scenario);
    const scopeHash = await buildMemoSelectionScopeHash(event, env);
    const now = Date.now();
    kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
      scopeHash,
      createdAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
    }));
    const fetchImpl = installFetch(env);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const ctx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(event), env, ctx)).status, 200);
      await Promise.all(ctx.tasks);
      assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0, scenario.text);
      const confirmEvent = lineEvent({ eventId: `${scenario.eventId}-confirm`, text: "確認刪除" });
      const confirmCtx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, confirmCtx)).status, 200);
      await Promise.all(confirmCtx.tasks);
      const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
      assert.equal(n8nCalls.length, 1, scenario.text);
      const payload = JSON.parse(n8nCalls[0].options.body);
      assert.deepEqual(payload.memo_ids, scenario.expected, scenario.text);
      assert.equal(payload.selection_snapshot_version, "f".repeat(64));
      assert.equal(payload.delete_scope, "memo_search_selection_snapshot");

      const duplicateCtx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, duplicateCtx)).status, 200);
      await Promise.all(duplicateCtx.tasks);
      assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test("invalid snapshot selections fail closed while current-snapshot all waits for confirmation", async () => {
  const now = Date.now();
  for (const scenario of [
    { eventId: "selection-out-of-range", text: "刪除第 6 筆備忘錄", snapshot: "live" },
    { eventId: "selection-too-large", text: "刪除第 1、2、3、4、5、6 筆備忘錄", snapshot: "live" },
    { eventId: "selection-clear-all-unsupported", text: "全部清空", snapshot: "live" },
    { eventId: "selection-expired", text: "刪除第 1 筆備忘錄", snapshot: "expired" },
    { eventId: "selection-wrong-scope", text: "刪除第 1 筆備忘錄", snapshot: "wrong_scope" },
  ]) {
    const kv = new MemoryKv();
    const env = baseEnv(kv);
    const event = lineEvent(scenario);
    const scopeHash = await buildMemoSelectionScopeHash(event, env);
    kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
      scopeHash: scenario.snapshot === "wrong_scope" ? "a".repeat(64) : scopeHash,
      createdAt: new Date(now - 2000).toISOString(),
      expiresAt: new Date(scenario.snapshot === "expired" ? now - 1000 : now + 60_000).toISOString(),
    }));
    const fetchImpl = installFetch(env);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const ctx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(event), env, ctx)).status, 200);
      await Promise.all(ctx.tasks);
      assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0, scenario.text);
      assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1, scenario.text);
      assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0, scenario.text);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const allEvent = lineEvent({ eventId: "selection-all-current-snapshot", text: "備忘錄刪除：這次搜尋的全部" });
  const scopeHash = await buildMemoSelectionScopeHash(allEvent, env);
  kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
    scopeHash,
    createdAt: new Date(now - 2000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const ctx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(allEvent), env, ctx)).status, 200);
    await Promise.all(ctx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
    assert.match(JSON.parse(fetchImpl.calls.find((call) => call.url.endsWith("/v2/bot/message/reply")).options.body).messages[0].text, /5 筆/);

    const confirmEvent = lineEvent({ eventId: "selection-all-current-snapshot-confirm", text: "確認刪除" });
    const confirmCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, confirmCtx)).status, 200);
    await Promise.all(confirmCtx.tasks);
    const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
    assert.equal(n8nCalls.length, 1);
    const payload = JSON.parse(n8nCalls[0].options.body);
    assert.equal(payload.selection_mode, "all");
    assert.equal(payload.confirmation_status, "consumed");
    assert.deepEqual(payload.memo_ids, MEMO_IDS);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expired actor-mismatched changed-snapshot and changed-candidate confirmations fail closed", async () => {
  for (const scenario of ["expired", "actor_mismatch", "snapshot_changed", "candidate_changed"]) {
    const kv = new MemoryKv();
    const env = baseEnv(kv);
    env.LINE_TEST_ADMIN_USER_IDS = "raw-user-id-selection-test,other-selection-actor";
    const selectionEvent = lineEvent({ eventId: `confirm-guard-${scenario}-select`, text: "刪除第1筆" });
    const scopeHash = await buildMemoSelectionScopeHash(selectionEvent, env);
    const now = Date.now();
    const selectionKey = `memo_search_selection:v1:${scopeHash}`;
    const confirmationKey = `memo_delete_confirmation:v1:${scopeHash}`;
    kv.values.set(selectionKey, snapshotRaw({
      scopeHash,
      createdAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
    }));
    const fetchImpl = installFetch(env);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const selectionCtx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(selectionEvent), env, selectionCtx)).status, 200);
      await Promise.all(selectionCtx.tasks);
      assert.ok(kv.values.has(confirmationKey), scenario);

      if (scenario === "expired") {
        const pending = JSON.parse(kv.values.get(confirmationKey));
        pending.expires_at = new Date(now - 1).toISOString();
        kv.values.set(confirmationKey, JSON.stringify(pending));
      } else if (scenario === "snapshot_changed") {
        const snapshot = JSON.parse(kv.values.get(selectionKey));
        snapshot.search_event_hash = "e".repeat(64);
        kv.values.set(selectionKey, JSON.stringify(snapshot));
      } else if (scenario === "candidate_changed") {
        const snapshot = JSON.parse(kv.values.get(selectionKey));
        snapshot.candidates[0] = { position: 1, memo_id: `memo-${"a".repeat(64)}`, summary: "不同摘要" };
        kv.values.set(selectionKey, JSON.stringify(snapshot));
      }

      const confirmEvent = lineEvent({ eventId: `confirm-guard-${scenario}-confirm`, text: "確認刪除" });
      if (scenario === "actor_mismatch") confirmEvent.source.userId = "other-selection-actor";
      const confirmCtx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, confirmCtx)).status, 200);
      await Promise.all(confirmCtx.tasks);
      assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0, scenario);
      const replyCalls = fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply"));
      assert.equal(replyCalls.length, 2, scenario);
      assert.equal(String(replyCalls[1].options.body).includes("memo-"), false, scenario);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test("cancel consumes the pending selection without dispatching archive", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const event = lineEvent({ eventId: "selection-cancel", text: "刪除第1、3、5筆" });
  const scopeHash = await buildMemoSelectionScopeHash(event, env);
  const now = Date.now();
  kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
    scopeHash,
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const ctx = createContext();
    await handleLineWebhook(await signedRequest(event), env, ctx);
    await Promise.all(ctx.tasks);
    const cancelEvent = lineEvent({ eventId: "selection-cancel-confirmation", text: "取消" });
    const cancelCtx = createContext();
    await handleLineWebhook(await signedRequest(cancelEvent), env, cancelCtx);
    await Promise.all(cancelCtx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
    const pending = JSON.parse(kv.values.get(`memo_delete_confirmation:v1:${scopeHash}`));
    assert.equal(pending.status, "cancelled");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("full 15-candidate result builds page 1 while partial legacy callback fails closed", () => {
  assert.equal(MEMO_SEARCH_SELECTION_MAX_CANDIDATES, 100);
  assert.equal(MEMO_SEARCH_PAGE_SIZE, 10);
  const full = parseMemoSearchSelectionResult(
    "找到 15 筆使用中備忘錄。",
    FIFTEEN_MEMO_IDS.map((memoId, index) => ({ position: index + 1, memo_id: memoId })),
    15,
    FIFTEEN_MEMO_IDS.slice(0, 10).map((memoId, index) => ({ position: index + 1, memo_id: memoId, summary: `摘要 ${index + 1}` })),
    1,
  );
  assert.equal(full.ok, true);
  assert.equal(full.candidates.length, 15);
  assert.equal(full.page_candidates.length, 10);
  assert.equal(full.page_count, 2);
  assert.match(full.reply_text, /第 1\/2 頁/);
  assert.match(full.reply_text, /10\. 摘要 10/);
  assert.equal(full.reply_text.includes("11. "), false);
  assert.equal(full.reply_text.includes("memo-"), false);

  const partial = parseMemoSearchSelectionResult(
    "找到 15 筆使用中備忘錄。",
    FIFTEEN_MEMO_IDS.slice(0, 10).map((memoId, index) => ({ position: index + 1, memo_id: memoId, summary: `摘要 ${index + 1}` })),
    15,
  );
  assert.equal(partial.ok, false);
  assert.equal(partial.reason, "incomplete_search_candidate_set");
  assert.match(partial.reply_text, /縮小搜尋範圍/);
});

test("over 100 candidates fails closed and cannot create a delete-all eligible result", () => {
  const ids = Array.from({ length: 101 }, (_, index) => `memo-${index.toString(16).padStart(2, "0").repeat(32)}`);
  const parsed = parseMemoSearchSelectionResult("", ids.map((memoId, index) => ({ position: index + 1, memo_id: memoId })), 101, [], 1);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, "search_candidate_limit_exceeded");
  assert.equal(parsed.candidates.length, 0);
  assert.match(parsed.reply_text, /100/);
  const totalOnly = parseMemoSearchSelectionResult("找到 101 筆使用中備忘錄。", null, 101);
  assert.equal(totalOnly.reason, "search_candidate_limit_exceeded");
  assert.match(totalOnly.reply_text, /縮小搜尋範圍/);
});

test("page commands parse exactly and page resolution uses global snapshot positions", () => {
  assert.deepEqual(parseMemoSearchPageCommand("查看下一頁").fields, { page_mode: "next", requested_page: null });
  assert.deepEqual(parseMemoSearchPageCommand("查看上一頁").fields, { page_mode: "previous", requested_page: null });
  assert.deepEqual(parseMemoSearchPageCommand("查看第 2 頁").fields, { page_mode: "numbered", requested_page: 2 });
  assert.equal(parseMemoSearchPageCommand("查看第 0 頁").valid, false);

  const scopeHash = "e".repeat(64);
  const now = Date.parse("2026-07-21T10:00:00.000Z");
  const live = snapshotRaw({
    scopeHash,
    memoIds: FIFTEEN_MEMO_IDS,
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 1000).toISOString(),
  });
  const next = resolveMemoSearchPage({ snapshotRaw: live, scopeHash, pageMode: "next", nowMs: now });
  assert.equal(next.ok, true);
  assert.equal(next.page_number, 2);
  assert.equal(next.global_start, 11);
  assert.deepEqual(next.memo_ids, FIFTEEN_MEMO_IDS.slice(10));
  assert.deepEqual(resolveMemoSearchSelectionDelete({
    snapshotRaw: live,
    scopeHash,
    selectionMode: "single",
    selectionIndices: [12],
    nowMs: now,
  }).memo_ids, [FIFTEEN_MEMO_IDS[11]]);
  assert.equal(resolveMemoSearchPage({ snapshotRaw: live, scopeHash, pageMode: "previous", nowMs: now }).reason, "page_out_of_range");
  assert.equal(resolveMemoSearchPage({ snapshotRaw: "", scopeHash, pageMode: "next", nowMs: now }).reason, "page_snapshot_missing");
  const expired = snapshotRaw({
    scopeHash,
    memoIds: FIFTEEN_MEMO_IDS,
    createdAt: new Date(now - 2000).toISOString(),
    expiresAt: new Date(now - 1000).toISOString(),
  });
  assert.equal(resolveMemoSearchPage({ snapshotRaw: expired, scopeHash, pageMode: "next", nowMs: now }).reason, "page_snapshot_expired");
});

test("page readback requires exact ids positions and summaries", () => {
  const expectedMemoIds = FIFTEEN_MEMO_IDS.slice(10);
  const valid = parseMemoSearchPageResult({
    pageCandidates: expectedMemoIds.map((memoId, index) => ({ position: 11 + index, memo_id: memoId, summary: `摘要 ${11 + index}` })),
    expectedMemoIds,
    pageNumber: 2,
    pageCount: 2,
    total: 15,
    globalStart: 11,
  });
  assert.equal(valid.ok, true);
  assert.match(valid.reply_text, /11\. 摘要 11/);
  assert.equal(valid.reply_text.includes("memo-"), false);
  assert.equal(parseMemoSearchPageResult({
    pageCandidates: expectedMemoIds.map((memoId, index) => ({ position: 11 + index, memo_id: expectedMemoIds.at(-(index + 1)), summary: "摘要" })),
    expectedMemoIds,
    pageNumber: 2,
    pageCount: 2,
    total: 15,
    globalStart: 11,
  }).ok, false);
});

test("15-candidate snapshot stores ids only and next page dispatches exact readback once", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const fetchImpl = installFetch(env);
  fetchImpl.searchMemoIds = [...FIFTEEN_MEMO_IDS];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const searchEvent = lineEvent({ eventId: "pagination-search-15", text: "備忘錄搜尋：全部" });
    const searchCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(searchEvent), env, searchCtx)).status, 200);
    await Promise.all(searchCtx.tasks);
    const scopeHash = await buildMemoSelectionScopeHash(searchEvent, env);
    const key = `memo_search_selection:v1:${scopeHash}`;
    const snapshotText = await kv.get(key);
    const snapshot = parseMemoSearchSelectionSnapshot(snapshotText);
    assert.equal(snapshot.total, 15);
    assert.equal(snapshot.current_page, 1);
    assert.equal(snapshot.page_count, 2);
    assert.equal(snapshot.delete_all_eligible, false);
    assert.deepEqual(snapshot.candidates.map((candidate) => candidate.memo_id), FIFTEEN_MEMO_IDS);
    for (const forbidden of ["content", searchEvent.source.userId, searchEvent.replyToken, env.N8N_SHARED_SECRET, env.N8N_MEMO_CALLBACK_SECRET]) {
      assert.equal(snapshotText.includes(forbidden), false);
    }
    assert.equal(snapshot.candidates.slice(0, 10).every((candidate) => candidate.summary), true);

    const pageEvent = lineEvent({ eventId: "pagination-next", text: "查看下一頁" });
    const pageCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(pageEvent), env, pageCtx)).status, 200);
    await Promise.all(pageCtx.tasks);
    const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
    assert.equal(n8nCalls.length, 2);
    const pagePayload = JSON.parse(n8nCalls[1].options.body);
    assert.equal(pagePayload.intent, "memo_search_page");
    assert.equal(pagePayload.page_scope, "memo_search_selection_snapshot");
    assert.equal(pagePayload.page_number, 2);
    assert.equal(pagePayload.global_start, 11);
    assert.deepEqual(pagePayload.memo_ids, FIFTEEN_MEMO_IDS.slice(10));
    const updatedSnapshot = parseMemoSearchSelectionSnapshot(await kv.get(key));
    assert.equal(updatedSnapshot.current_page, 2);
    const pageStateWrite = [...kv.putCalls].reverse().find((call) => call.key === key);
    assert.equal(Number.isSafeInteger(pageStateWrite.options.expiration), true);
    assert.equal("expirationTtl" in pageStateWrite.options, false);

    const duplicateCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(pageEvent), env, duplicateCtx)).status, 200);
    await Promise.all(duplicateCtx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing expired and out-of-range page requests Reply naturally with zero n8n", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const scenario of ["missing", "expired", "out_of_range"]) {
      const kv = new MemoryKv();
      const env = baseEnv(kv);
      const fetchImpl = installFetch(env);
      globalThis.fetch = fetchImpl;
      const event = lineEvent({ eventId: `page-reject-${scenario}`, text: "查看下一頁" });
      const scopeHash = await buildMemoSelectionScopeHash(event, env);
      const now = Date.now();
      if (scenario !== "missing") {
        kv.values.set(`memo_search_selection:v1:${scopeHash}`, snapshotRaw({
          scopeHash,
          memoIds: FIFTEEN_MEMO_IDS,
          currentPage: scenario === "out_of_range" ? 2 : 1,
          createdAt: new Date(now - 2000).toISOString(),
          expiresAt: new Date(scenario === "expired" ? now - 1000 : now + 60_000).toISOString(),
        }));
      }
      const ctx = createContext();
      assert.equal((await handleLineWebhook(await signedRequest(event), env, ctx)).status, 200);
      await Promise.all(ctx.tasks);
      assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 0);
      assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 1);
      assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/push")).length, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("verified multi selection dispatches one exact batch only after confirmation", async () => {
  const kv = new MemoryKv();
  const env = baseEnv(kv);
  const fetchImpl = installFetch(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const searchEvent = lineEvent({ eventId: "batch-limit-search", text: "備忘錄搜尋：全部" });
    const searchCtx = createContext();
    await handleLineWebhook(await signedRequest(searchEvent), env, searchCtx);
    await Promise.all(searchCtx.tasks);
    const parsed = parseMemoDeterministicCommand("刪除第 2、4、5 筆備忘錄");
    assert.equal(parsed.valid, true);
    assert.deepEqual(parsed.fields.selection_indices, [2, 4, 5]);

    const deleteEvent = lineEvent({ eventId: "batch-limit-delete", text: "刪除第 2、4、5 筆備忘錄" });
    const deleteCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(deleteEvent), env, deleteCtx)).status, 200);
    await Promise.all(deleteCtx.tasks);
    assert.equal(fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/")).length, 1);
    const confirmEvent = lineEvent({ eventId: "batch-limit-delete-confirm", text: "確認刪除" });
    const confirmCtx = createContext();
    assert.equal((await handleLineWebhook(await signedRequest(confirmEvent), env, confirmCtx)).status, 200);
    await Promise.all(confirmCtx.tasks);
    const n8nCalls = fetchImpl.calls.filter((call) => call.url.startsWith("https://n8n.example/"));
    assert.equal(n8nCalls.length, 2);
    assert.deepEqual(JSON.parse(n8nCalls[1].options.body).memo_ids, [MEMO_IDS[1], MEMO_IDS[3], MEMO_IDS[4]]);
    assert.equal(fetchImpl.calls.filter((call) => call.url.endsWith("/v2/bot/message/reply")).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public delete rejects internal memo ids and requires a search selection", () => {
  const parsed = parseMemoDeterministicCommand(`備忘錄刪除：${MEMO_IDS[0]}`);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.reason, "delete_requires_search_selection");
  assert.deepEqual(parsed.fields, {});
});
