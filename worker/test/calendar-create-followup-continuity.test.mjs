import assert from "node:assert/strict";
import test from "node:test";

import { handleLineWebhook } from "../src/index.js";
import {
  CALENDAR_CREATE_TTL_SECONDS,
  buildCalendarCreateIdentity,
  calendarPendingKey,
  parseCalendarCreateCommand,
  parseCalendarCreateContinuation,
} from "../src/calendar-create.js";

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.writes = [];
    this.deletes = [];
  }
  async get(key) {
    return this.values.get(key) ?? null;
  }
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

function event(eventId, text, actor = "calendar-followup-actor-a") {
  return {
    type: "message",
    webhookEventId: eventId,
    replyToken: `reply-${eventId}`,
    source: { type: "user", userId: actor },
    message: { id: `message-${eventId}`, type: "text", text },
    deliveryContext: { isRedelivery: false },
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
    LINE_TEST_ADMIN_USER_IDS: "calendar-followup-actor-a,calendar-followup-actor-b",
    N8N_WEBHOOK_URL: "https://n8n.example.test/webhook/calendar",
    N8N_SHARED_SECRET: "offline-n8n-secret",
    IDEMPOTENCY_KV: new MemoryKv(),
    RUNTIME_KV: new MemoryKv(),
  };
}

function installFetchMock(testEnv) {
  const calls = { calendar: [], generic: [], replies: [], pushes: 0 };
  const hooks = { beforeReply: null };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      const body = JSON.parse(options.body);
      if (body.intent !== "calendar_create") {
        calls.generic.push(body);
        return new Response(JSON.stringify({ status: "completed", intent: "unsupported" }), { status: 200 });
      }
      calls.calendar.push(body);
      return new Response(JSON.stringify({
        request_id: body.request_id,
        intent: "calendar_create",
        status: "completed",
        readback_verified: true,
        duplicate: false,
        title: body.title,
        location: body.location,
        all_day: body.all_day,
        start: body.start,
        end: body.end,
      }), { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      const body = JSON.parse(options.body);
      if (typeof hooks.beforeReply === "function") hooks.beforeReply(body.messages[0].text);
      calls.replies.push(body.messages[0].text);
      return new Response("", { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/push") {
      calls.pushes += 1;
      return new Response("", { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return { calls, hooks, restore() { globalThis.fetch = originalFetch; } };
}

async function send(testEnv, lineEvent) {
  const ctx = context();
  const response = await handleLineWebhook(await signedRequest(lineEvent), testEnv, ctx);
  assert.equal(response.status, 200);
  await Promise.all(ctx.tasks);
  return response;
}

async function pendingKeyFor(lineEvent) {
  const identity = await buildCalendarCreateIdentity(lineEvent);
  return calendarPendingKey(identity.actor_hash);
}

test("parser preserves title and start while asking only for date", () => {
  const parsed = parseCalendarCreateCommand("行事曆新增：下午兩點喝水2000 CC", new Date().toISOString());
  assert.equal(parsed.valid, false);
  assert.equal(parsed.pending, true);
  assert.equal(parsed.reason, "missing_date");
  assert.equal(parsed.draft.title, "喝水2000 CC");
  assert.equal(parsed.draft.start_minutes, 14 * 60);
  assert.equal(parseCalendarCreateContinuation("今天").action, "date");
  assert.equal(parseCalendarCreateContinuation("5分鐘結束").action, "duration");
  assert.equal(parseCalendarCreateCommand("行事曆新增：今天下午兩點寫結束報告5分鐘", new Date().toISOString()).fields.title, "寫結束報告");
  assert.equal(CALENDAR_CREATE_TTL_SECONDS, 600);
});

test("pending key is stable for the same LINE actor and excludes per-message identifiers", async () => {
  const first = event("STABLE-KEY-EVENT-1", "行事曆新增：下午兩點穩定鍵");
  const second = event("STABLE-KEY-EVENT-2", "今天");
  const other = event("STABLE-KEY-EVENT-3", "今天", "calendar-followup-actor-b");
  const firstKey = await pendingKeyFor(first);
  const secondKey = await pendingKeyFor(second);
  const otherKey = await pendingKeyFor(other);
  assert.equal(firstKey, secondKey);
  assert.notEqual(firstKey, otherKey);
  assert.match(firstKey, /^calendar_create:v1:pending:[a-f0-9]{64}$/);
  for (const forbidden of [first.webhookEventId, first.replyToken, first.message.id, "request_id", "execution"]) {
    assert.equal(firstKey.includes(forbidden), false);
  }
});

test("A: date then five-minute continuation creates one preserved 14:00–14:05 event", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const first = event("FOLLOW-A-1", "行事曆新增：下午兩點喝水2000 CC");
  const key = await pendingKeyFor(first);
  try {
    let pendingObservedBeforeReply = false;
    mock.hooks.beforeReply = (text) => {
      if (text === "請告訴我行程日期。") pendingObservedBeforeReply = testEnv.IDEMPOTENCY_KV.values.has(key);
    };
    await send(testEnv, first);
    assert.equal(mock.calls.replies.at(-1), "請告訴我行程日期。");
    assert.equal(pendingObservedBeforeReply, true);
    assert.ok(testEnv.IDEMPOTENCY_KV.values.has(key));
    await send(testEnv, event("FOLLOW-A-2", "今天"));
    assert.equal(mock.calls.replies.at(-1), "要到幾點結束，或持續多久？");
    await send(testEnv, event("FOLLOW-A-3", "5分鐘結束"));
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(key), false);
    assert.equal(mock.calls.calendar.length, 1);
    assert.equal(mock.calls.calendar[0].title, "喝水2000 CC");
    assert.match(mock.calls.calendar[0].start, /T14:00:00\+08:00$/);
    assert.match(mock.calls.calendar[0].end, /T14:05:00\+08:00$/);
    assert.match(mock.calls.replies.at(-1), /^行程已新增：喝水2000 CC\n\d{4}-\d{2}-\d{2} 14:00–14:05$/);
    await send(testEnv, event("FOLLOW-A-3", "5分鐘結束"));
    assert.equal(mock.calls.calendar.length, 1);
    assert.equal(mock.calls.replies.length, 3);
    assert.equal(mock.calls.pushes, 0);
  } finally {
    mock.restore();
  }
});

test("B: tomorrow draft plus one-hour continuation creates exactly 14:00–15:00", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("FOLLOW-B-1", "行事曆新增：明天下午兩點開會"));
    assert.equal(mock.calls.replies.at(-1), "要到幾點結束，或持續多久？");
    await send(testEnv, event("FOLLOW-B-2", "一小時"));
    assert.equal(mock.calls.calendar.length, 1);
    assert.match(mock.calls.calendar[0].start, /T14:00:00\+08:00$/);
    assert.match(mock.calls.calendar[0].end, /T15:00:00\+08:00$/);
  } finally {
    mock.restore();
  }
});

test("C: standard public prefix plus 到三點 creates exactly 14:00–15:00", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("FOLLOW-C-1", "行事曆新增：今天下午兩點看醫生"));
    await send(testEnv, event("FOLLOW-C-2", "到三點"));
    assert.equal(mock.calls.calendar.length, 1);
    assert.equal(mock.calls.calendar[0].title, "看醫生");
    assert.match(mock.calls.calendar[0].start, /T14:00:00\+08:00$/);
    assert.match(mock.calls.calendar[0].end, /T15:00:00\+08:00$/);
  } finally {
    mock.restore();
  }
});

test("cancel clears the same-actor pending draft with zero Calendar write", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const first = event("FOLLOW-CANCEL-1", "行事曆新增：下午兩點取消案例");
  const key = await pendingKeyFor(first);
  try {
    await send(testEnv, first);
    assert.ok(testEnv.IDEMPOTENCY_KV.values.has(key));
    await send(testEnv, event("FOLLOW-CANCEL-2", "取消"));
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(key), false);
    assert.equal(mock.calls.calendar.length, 0);
    assert.equal(mock.calls.replies.at(-1), "已取消這次行程新增。");
  } finally {
    mock.restore();
  }
});

test("different actor cannot consume another actor draft", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const actorA = event("FOLLOW-ACTOR-1", "行事曆新增：下午兩點隔離案例", "calendar-followup-actor-a");
  const keyA = await pendingKeyFor(actorA);
  try {
    await send(testEnv, actorA);
    await send(testEnv, event("FOLLOW-ACTOR-2", "今天", "calendar-followup-actor-b"));
    assert.equal(mock.calls.calendar.length, 0);
    assert.equal(mock.calls.generic.length, 1);
    assert.ok(testEnv.IDEMPOTENCY_KV.values.has(keyA));
  } finally {
    mock.restore();
  }
});

test("expiry and rejected continuation clear pending with zero Calendar write", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const expiredStart = event("FOLLOW-EXP-1", "行事曆新增：下午兩點逾時案例");
  const expiredKey = await pendingKeyFor(expiredStart);
  try {
    await send(testEnv, expiredStart);
    const expired = JSON.parse(testEnv.IDEMPOTENCY_KV.values.get(expiredKey));
    expired.expires_at_ms = Date.now() - 1;
    testEnv.IDEMPOTENCY_KV.values.set(expiredKey, JSON.stringify(expired));
    await send(testEnv, event("FOLLOW-EXP-2", "今天"));
    assert.equal(mock.calls.replies.at(-1), "這個行程草稿已逾時，請重新告訴我新的行程。");
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(expiredKey), false);

    const rejectedStart = event("FOLLOW-REJ-1", "行事曆新增：下午兩點拒絕案例");
    const rejectedKey = await pendingKeyFor(rejectedStart);
    await send(testEnv, rejectedStart);
    await send(testEnv, event("FOLLOW-REJ-2", "到三點"));
    assert.equal(mock.calls.replies.at(-1), "這次補充的資訊無法安全套用，行程草稿已取消。");
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(rejectedKey), false);
    assert.equal(mock.calls.calendar.length, 0);
  } finally {
    mock.restore();
  }
});

test("a new explicit complete Create clears an older draft and is not intercepted", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  const oldDraft = event("FOLLOW-NEW-1", "行事曆新增：下午兩點舊草稿");
  const key = await pendingKeyFor(oldDraft);
  try {
    await send(testEnv, oldDraft);
    assert.ok(testEnv.IDEMPOTENCY_KV.values.has(key));
    await send(testEnv, event("FOLLOW-NEW-2", "行事曆新增：明天下午四點新行程一小時"));
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(key), false);
    assert.equal(mock.calls.calendar.length, 1);
    assert.equal(mock.calls.calendar[0].title, "新行程");
  } finally {
    mock.restore();
  }
});

test("all public replies exclude internal identifiers", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("FOLLOW-SAFE-1", "行事曆新增：今天下午兩點安全案例"));
    await send(testEnv, event("FOLLOW-SAFE-2", "5分鐘"));
    const serialized = JSON.stringify(mock.calls.replies);
    for (const forbidden of ["event_id", "calendar_id", "request_id", "credential", "replyToken", "calendar-request-", "calcalendar-"]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  } finally {
    mock.restore();
  }
});
