import assert from "node:assert/strict";
import test from "node:test";

import { handleLineWebhook } from "../src/index.js";
import {
  CALENDAR_SEARCH_TTL_SECONDS,
  buildCalendarSearchIdentity,
  calendarSearchSnapshotKey,
  createCalendarSearchSnapshot,
  parseCalendarSearchCommand,
  parseCalendarSearchSelection,
} from "../src/calendar-search.js";

const RECEIVED_AT = "2026-07-22T02:00:00.000Z";

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.writes = [];
    this.deletes = [];
  }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value, options = {}) {
    this.values.set(key, value);
    this.writes.push({ key, value, options });
  }
  async delete(key) {
    this.values.delete(key);
    this.deletes.push(key);
  }
  async list({ prefix = "" } = {}) {
    return { keys: Array.from(this.values.keys()).filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
  }
}

function event(eventId, text, actor = "calendar-search-actor-a") {
  return {
    type: "message",
    webhookEventId: eventId,
    replyToken: `reply-${eventId}`,
    source: { type: "user", userId: actor },
    message: { id: `message-${eventId}`, type: "text", text },
    deliveryContext: { isRedelivery: false },
    timestamp: Date.parse(RECEIVED_AT),
  };
}

function context() {
  const tasks = [];
  return { tasks, waitUntil(task) { tasks.push(task); } };
}

async function signedRequest(lineEvent, secret = "offline-channel-secret") {
  const rawBody = JSON.stringify({ events: [lineEvent] });
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
    headers: { "x-line-signature": Buffer.from(signature).toString("base64") },
    body: rawBody,
  });
}

function makeEnv() {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-line-token",
    LINE_TEST_ADMIN_USER_IDS: "calendar-search-actor-a,calendar-search-actor-b",
    N8N_WEBHOOK_URL: "https://n8n.example.test/webhook/calendar",
    N8N_SHARED_SECRET: "offline-n8n-secret",
    IDEMPOTENCY_KV: new MemoryKv(),
    RUNTIME_KV: new MemoryKv(),
  };
}

function candidate(id, title, start = "2026-07-22T14:00:00+08:00", end = "2026-07-22T15:00:00+08:00", location = "") {
  return { event_reference: id, title, start, end, location, all_day: false };
}

function installFetchMock(testEnv, candidates = [candidate("evt-a", "甲行程"), candidate("evt-b", "乙行程")]) {
  const calls = { search: [], replies: [], pushes: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      const body = JSON.parse(options.body);
      assert.equal(body.intent, "calendar_search");
      calls.search.push(body);
      return new Response(JSON.stringify({
        request_id: body.request_id,
        intent: "calendar_search",
        status: "completed",
        read_only: true,
        candidates,
      }), { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      const body = JSON.parse(options.body);
      calls.replies.push(body.messages[0].text);
      return new Response("", { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/push") {
      calls.pushes += 1;
      return new Response("", { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { calls, restore() { globalThis.fetch = originalFetch; } };
}

async function send(testEnv, lineEvent) {
  const ctx = context();
  const response = await handleLineWebhook(await signedRequest(lineEvent), testEnv, ctx);
  assert.equal(response.status, 200);
  await Promise.all(ctx.tasks);
  return response;
}

test("today tomorrow and week produce exact Asia/Taipei read windows", () => {
  const today = parseCalendarSearchCommand("搜尋今天", RECEIVED_AT);
  const tomorrow = parseCalendarSearchCommand("行事曆搜尋：明天", RECEIVED_AT);
  const week = parseCalendarSearchCommand("搜尋本週", RECEIVED_AT);
  assert.deepEqual([today.fields.time_min, today.fields.time_max], [
    "2026-07-22T00:00:00+08:00",
    "2026-07-23T00:00:00+08:00",
  ]);
  assert.deepEqual([tomorrow.fields.time_min, tomorrow.fields.time_max], [
    "2026-07-23T00:00:00+08:00",
    "2026-07-24T00:00:00+08:00",
  ]);
  assert.deepEqual([week.fields.time_min, week.fields.time_max], [
    "2026-07-20T00:00:00+08:00",
    "2026-07-27T00:00:00+08:00",
  ]);
});

test("keyword, exact date and date-time range are deterministic", () => {
  const keyword = parseCalendarSearchCommand("行事曆搜尋：王小姐", RECEIVED_AT);
  const date = parseCalendarSearchCommand("搜尋7月25日", RECEIVED_AT);
  const range = parseCalendarSearchCommand("搜尋7月25日下午兩點到四點", RECEIVED_AT);
  assert.equal(keyword.fields.scope, "keyword");
  assert.equal(keyword.fields.query, "王小姐");
  assert.deepEqual([date.fields.time_min, date.fields.time_max], [
    "2026-07-25T00:00:00+08:00",
    "2026-07-26T00:00:00+08:00",
  ]);
  assert.deepEqual([range.fields.time_min, range.fields.time_max], [
    "2026-07-25T14:00:00+08:00",
    "2026-07-25T16:00:00+08:00",
  ]);
});

test("ordinal parser supports first and second without exposing internal references", () => {
  assert.deepEqual(parseCalendarSearchSelection("第一個"), { matched: true, position: 1 });
  assert.deepEqual(parseCalendarSearchSelection("第二個"), { matched: true, position: 2 });
  assert.deepEqual(parseCalendarSearchSelection("第3筆"), { matched: true, position: 3 });
  assert.equal(parseCalendarSearchSelection("第一個行事曆").matched, false);
  assert.equal(parseCalendarSearchCommand("查看下一頁", RECEIVED_AT).matched, false);
});

test("search stores same-actor 600-second snapshot and returns numbered results", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const lineEvent = event("SEARCH-MULTI-1", "搜尋今天");
  try {
    await send(testEnv, lineEvent);
    assert.equal(mock.calls.search.length, 1);
    assert.equal(mock.calls.search[0].calendar_alias, "authorized_test");
    assert.equal(mock.calls.search[0].timezone, "Asia/Taipei");
    assert.equal(mock.calls.replies.length, 1);
    assert.match(mock.calls.replies[0], /^找到 2 筆行程：/);
    assert.match(mock.calls.replies[0], /1\. 甲行程/);
    assert.match(mock.calls.replies[0], /2\. 乙行程/);
    assert.equal(/evt-a|evt-b|event_id|calendar_id|request_id|credential/.test(mock.calls.replies[0]), false);
    const identity = await buildCalendarSearchIdentity(lineEvent);
    const key = calendarSearchSnapshotKey(identity.actor_hash);
    const stored = JSON.parse(testEnv.IDEMPOTENCY_KV.values.get(key));
    assert.equal(stored.candidates.length, 2);
    const write = testEnv.IDEMPOTENCY_KV.writes.find((item) => item.key === key);
    assert.equal(write.options.expirationTtl, CALENDAR_SEARCH_TTL_SECONDS);
  } finally {
    mock.restore();
  }
});

test("first and second select only the current same-actor snapshot with zero n8n call", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("SEARCH-SELECT-1", "搜尋今天"));
    await send(testEnv, event("SEARCH-SELECT-2", "第二個"));
    assert.equal(mock.calls.search.length, 1);
    assert.match(mock.calls.replies.at(-1), /^第 2 筆行程：乙行程/);
    await send(testEnv, event("SEARCH-SELECT-OTHER", "第一個", "calendar-search-actor-b"));
    assert.equal(mock.calls.search.length, 1);
    assert.equal(mock.calls.replies.at(-1), "請先搜尋行程，再回覆「第一個」或「第二個」。");
  } finally {
    mock.restore();
  }
});

test("expired snapshot fails closed and never dispatches a search", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const selectionEvent = event("SEARCH-EXPIRED-SELECT", "第一個");
  const identity = await buildCalendarSearchIdentity(selectionEvent);
  const snapshot = createCalendarSearchSnapshot({ identity, candidates: [candidate("evt-expired", "過期行程")], nowMs: 1 });
  testEnv.IDEMPOTENCY_KV.values.set(calendarSearchSnapshotKey(identity.actor_hash), JSON.stringify(snapshot));
  try {
    await send(testEnv, selectionEvent);
    assert.equal(mock.calls.search.length, 0);
    assert.equal(mock.calls.replies[0], "上次行程搜尋已過期，請重新搜尋。");
  } finally {
    mock.restore();
  }
});

test("no-result search replaces the current snapshot and returns one safe final", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv, []);
  try {
    await send(testEnv, event("SEARCH-NONE-1", "行事曆搜尋：不存在的名稱"));
    assert.equal(mock.calls.search.length, 1);
    assert.deepEqual(mock.calls.replies, ["沒有找到符合的行程。"]);
    assert.equal(mock.calls.pushes, 0);
  } finally {
    mock.restore();
  }
});

test("identical webhook retry produces one read and one LINE final", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const lineEvent = event("SEARCH-DUPLICATE-1", "搜尋明天");
  try {
    await send(testEnv, lineEvent);
    await send(testEnv, lineEvent);
    assert.equal(mock.calls.search.length, 1);
    assert.equal(mock.calls.replies.length, 1);
    assert.equal(mock.calls.pushes, 0);
  } finally {
    mock.restore();
  }
});

test("explicit Search does not consume or clear Calendar Create pending state", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("SEARCH-CREATE-PENDING-1", "行事曆新增：下午兩點喝水"));
    const before = Array.from(testEnv.IDEMPOTENCY_KV.values.keys()).find((key) => key.startsWith("calendar_create:v1:pending:"));
    assert.ok(before);
    await send(testEnv, event("SEARCH-CREATE-PENDING-2", "搜尋今天"));
    assert.ok(testEnv.IDEMPOTENCY_KV.values.has(before));
    assert.equal(mock.calls.search.length, 1);
  } finally {
    mock.restore();
  }
});
