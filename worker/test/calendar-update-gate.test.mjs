import assert from "node:assert/strict";
import test from "node:test";

import worker, { handleLineWebhook } from "../src/index.js";
import {
  CALENDAR_UPDATE_TTL_SECONDS,
  applyCalendarUpdatePatch,
  buildCalendarUpdateIdentity,
  calendarUpdatePendingKey,
  parseCalendarUpdateCommand,
  parseCalendarUpdateContinuation,
} from "../src/calendar-update.js";
import {
  buildCalendarSearchIdentity,
  calendarSearchSnapshotKey,
  createCalendarSearchSnapshot,
} from "../src/calendar-search.js";

const RECEIVED_AT = "2026-07-22T02:00:00.000Z";

class MemoryKv {
  constructor() { this.values = new Map(); this.writes = []; this.deletes = []; }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value, options = {}) { this.values.set(key, value); this.writes.push({ key, value, options }); }
  async delete(key) { this.values.delete(key); this.deletes.push(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
  }
}

function event(eventId, text, actor = "calendar-update-actor-a") {
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

function candidate(id = "evt-update-a", title = "舊會議") {
  return {
    event_reference: id,
    title,
    location: "台中",
    all_day: false,
    start: "2026-07-22T14:00:00+08:00",
    end: "2026-07-22T15:00:00+08:00",
  };
}

function makeEnv() {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-line-token",
    LINE_TEST_ADMIN_USER_IDS: "calendar-update-actor-a,calendar-update-actor-b",
    N8N_WEBHOOK_URL: "https://n8n.example.test/webhook/calendar",
    N8N_SHARED_SECRET: "offline-n8n-secret",
    IDEMPOTENCY_KV: new MemoryKv(),
    RUNTIME_KV: new MemoryKv(),
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

async function send(testEnv, lineEvent) {
  const ctx = context();
  const response = await handleLineWebhook(await signedRequest(lineEvent), testEnv, ctx);
  assert.equal(response.status, 200);
  await Promise.all(ctx.tasks);
  return response;
}

async function seedSnapshot(testEnv, actor = "calendar-update-actor-a", candidates = [candidate()]) {
  const lineEvent = event("SEED-SNAPSHOT", "搜尋今天", actor);
  const identity = await buildCalendarSearchIdentity(lineEvent);
  const snapshot = createCalendarSearchSnapshot({ identity, candidates, nowMs: Date.now() });
  testEnv.IDEMPOTENCY_KV.values.set(calendarSearchSnapshotKey(identity.actor_hash), JSON.stringify(snapshot));
  return { identity, snapshot };
}

function installFetchMock(testEnv, options = {}) {
  const calls = { searches: [], updates: [], replies: [], pushes: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, request = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      const body = JSON.parse(request.body);
      if (body.intent === "calendar_search") {
        calls.searches.push(body);
        const results = options.searchCandidates ?? [candidate()];
        return new Response(JSON.stringify({
          request_id: body.request_id,
          intent: "calendar_search",
          status: "completed",
          read_only: true,
          candidates: results,
        }), { status: 200 });
      }
      assert.equal(body.intent, "calendar_update");
      calls.updates.push(body);
      if (options.firstUpdateAmbiguous && calls.updates.length === 1) {
        return new Response(JSON.stringify({
          request_id: body.request_id,
          intent: "calendar_update",
          status: "failed",
          readback_verified: false,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        request_id: body.request_id,
        intent: "calendar_update",
        status: "completed",
        readback_verified: true,
        title: body.title,
        location: body.location,
        all_day: body.all_day,
        start: body.start,
        end: body.end,
      }), { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      calls.replies.push(JSON.parse(request.body).messages[0].text);
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

test("Update parser supports snapshot/keyword targets and every allowed field", () => {
  const command = parseCalendarUpdateCommand(
    "行事曆修改：第一個｜名稱改成新會議，日期改成明天，開始改成下午三點，持續一小時，地點改成彰化",
    RECEIVED_AT,
  );
  assert.equal(command.valid, true);
  assert.deepEqual(command.target, { mode: "snapshot", position: 1, query: "" });
  assert.deepEqual(command.patch, {
    title: "新會議",
    date: "2026-07-23",
    start_minutes: 900,
    end_minutes: null,
    duration_minutes: 60,
    location: "彰化",
  });
  assert.deepEqual(parseCalendarUpdateCommand("行事曆修改：王小姐會議｜地點改成台北", RECEIVED_AT).target, {
    mode: "keyword", position: 0, query: "王小姐會議",
  });
  assert.equal(parseCalendarUpdateContinuation("確認修改", RECEIVED_AT).action, "confirm");
  assert.equal(parseCalendarUpdateContinuation("取消", RECEIVED_AT).action, "cancel");
  assert.equal(parseCalendarUpdateContinuation("明天", RECEIVED_AT).patch.date, "2026-07-23");
  assert.equal(parseCalendarUpdateContinuation("一小時", RECEIVED_AT).patch.duration_minutes, 60);
  assert.equal(parseCalendarUpdateContinuation("到下午三點", RECEIVED_AT).patch.end_minutes, 900);
});

test("date/start/end/duration changes preserve unspecified fields", () => {
  const changed = applyCalendarUpdatePatch(candidate(), {
    title: null,
    date: "2026-07-23",
    start_minutes: 900,
    end_minutes: null,
    duration_minutes: 30,
    location: null,
  });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.desired, {
    title: "舊會議",
    location: "台中",
    all_day: false,
    date: "2026-07-23",
    start: "2026-07-23T15:00:00+08:00",
    end: "2026-07-23T15:30:00+08:00",
    duration_minutes: 30,
    timezone: "Asia/Taipei",
  });
});

test("snapshot selection asks confirmation before exactly one Update and terminal readback", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("UPDATE-1", "行事曆修改：第一個｜名稱改成新會議，地點改成彰化"));
    assert.equal(mock.calls.updates.length, 0);
    assert.match(mock.calls.replies[0], /^請確認修改：/);
    assert.equal(/evt-update-a|event_id|calendar_id|request_id|credential/.test(mock.calls.replies[0]), false);
    await send(testEnv, event("UPDATE-2", "確認修改"));
    assert.equal(mock.calls.updates.length, 1);
    assert.equal(mock.calls.updates[0].readback_only, false);
    assert.equal(mock.calls.updates[0].title, "新會議");
    assert.match(mock.calls.replies[1], /^行程已修改：新會議/);
    const identity = await buildCalendarUpdateIdentity(event("PROBE", "確認修改"));
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(calendarUpdatePendingKey(identity.actor_hash)), false);
  } finally { mock.restore(); }
});

test("missing changes supports multi-turn completion then confirmation", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("UPDATE-MULTI-1", "修改第一個"));
    assert.equal(mock.calls.replies[0], "請告訴我要修改名稱、日期、開始或結束時間、持續多久，或地點。");
    await send(testEnv, event("UPDATE-MULTI-2", "日期改成明天，開始改成下午三點，持續30分鐘"));
    assert.match(mock.calls.replies[1], /^請確認修改：/);
    await send(testEnv, event("UPDATE-MULTI-3", "確認修改"));
    assert.equal(mock.calls.updates.filter((call) => !call.readback_only).length, 1);
    assert.equal(mock.calls.updates[0].start, "2026-07-23T15:00:00+08:00");
    assert.equal(mock.calls.updates[0].end, "2026-07-23T15:30:00+08:00");
  } finally { mock.restore(); }
});

test("cancel clears actor-bound pending and causes zero Calendar update", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("UPDATE-CANCEL-1", "行事曆修改：第一個｜地點改成台北"));
    await send(testEnv, event("UPDATE-CANCEL-2", "取消"));
    assert.equal(mock.calls.updates.length, 0);
    assert.equal(mock.calls.replies.at(-1), "已取消這次行程修改。");
  } finally { mock.restore(); }
});

test("keyword target requires exactly one result and ambiguity/no result write zero", async () => {
  for (const [results, expected] of [
    [[], "沒有找到可安全修改的行程，Calendar 未寫入。"],
    [[candidate("evt-a", "會議"), candidate("evt-b", "會議")], "找到多筆可能的行程，請先搜尋並用序號選擇，Calendar 未寫入。"],
  ]) {
    const testEnv = makeEnv();
    const mock = installFetchMock(testEnv, { searchCandidates: results });
    try {
      await send(testEnv, event(`UPDATE-LOOKUP-${results.length}`, "行事曆修改：會議｜地點改成台北"));
      assert.equal(mock.calls.searches.length, 1);
      assert.equal(mock.calls.updates.length, 0);
      assert.equal(mock.calls.replies[0], expected);
    } finally { mock.restore(); }
  }
});

test("different actor cannot confirm another actor pending", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv, "calendar-update-actor-a");
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("UPDATE-ACTOR-1", "行事曆修改：第一個｜地點改成台北", "calendar-update-actor-a"));
    await send(testEnv, event("UPDATE-ACTOR-2", "確認修改", "calendar-update-actor-b"));
    assert.equal(mock.calls.updates.length, 0);
    assert.equal(mock.calls.replies.at(-1), "目前沒有等待確認的行程修改。");
  } finally { mock.restore(); }
});

test("expired or changed snapshot fails closed with zero update", async () => {
  const testEnv = makeEnv();
  const seeded = await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("UPDATE-STALE-1", "行事曆修改：第一個｜地點改成台北"));
    const replacement = createCalendarSearchSnapshot({
      identity: { actor_hash: seeded.identity.actor_hash, safe_event_hash: "f".repeat(64) },
      candidates: [candidate("evt-other", "其他行程")],
      nowMs: Date.now(),
    });
    testEnv.IDEMPOTENCY_KV.values.set(calendarSearchSnapshotKey(seeded.identity.actor_hash), JSON.stringify(replacement));
    await send(testEnv, event("UPDATE-STALE-2", "確認修改"));
    assert.equal(mock.calls.updates.length, 0);
    assert.equal(mock.calls.replies.at(-1), "行程搜尋結果已變動，請重新搜尋後再修改。");
  } finally { mock.restore(); }
});

test("identical confirmation webhook retries only one update and one LINE final", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  const confirmation = event("UPDATE-DUP-2", "確認修改");
  try {
    await send(testEnv, event("UPDATE-DUP-1", "行事曆修改：第一個｜名稱改成唯一更新"));
    await send(testEnv, confirmation);
    await send(testEnv, confirmation);
    assert.equal(mock.calls.updates.filter((call) => !call.readback_only).length, 1);
    assert.equal(mock.calls.replies.filter((reply) => reply.startsWith("行程已修改：")).length, 1);
    assert.equal(mock.calls.pushes, 0);
  } finally { mock.restore(); }
});

test("ambiguous initial response performs readback only and never repeats mutation", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv, { firstUpdateAmbiguous: true });
  try {
    await send(testEnv, event("UPDATE-READBACK-1", "行事曆修改：第一個｜名稱改成已寫入"));
    await send(testEnv, event("UPDATE-READBACK-2", "確認修改"));
    assert.equal(mock.calls.updates.length, 2);
    assert.equal(mock.calls.updates[0].readback_only, false);
    assert.equal(mock.calls.updates[1].readback_only, true);
    assert.equal(mock.calls.replies.filter((reply) => reply.startsWith("行程已修改：")).length, 1);
  } finally { mock.restore(); }
});

test("pending records use actor-only key and TTL 600 without LINE identifiers", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    const lineEvent = event("UPDATE-PENDING-KEY", "行事曆修改：第一個｜地點改成台北");
    await send(testEnv, lineEvent);
    const identity = await buildCalendarUpdateIdentity(lineEvent);
    const key = calendarUpdatePendingKey(identity.actor_hash);
    assert.match(key, /^calendar_update:v1:pending:[a-f0-9]{64}$/);
    assert.equal(key.includes(lineEvent.replyToken), false);
    const write = testEnv.IDEMPOTENCY_KV.writes.find((item) => item.key === key);
    assert.equal(write.options.expirationTtl, CALENDAR_UPDATE_TTL_SECONDS);
  } finally { mock.restore(); }
});

test("expired Update pending is cleared and confirmation causes zero write", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("UPDATE-EXPIRE-1", "行事曆修改：第一個｜地點改成台北"));
    const identity = await buildCalendarUpdateIdentity(event("UPDATE-EXPIRE-PROBE", "確認修改"));
    const key = calendarUpdatePendingKey(identity.actor_hash);
    const pending = JSON.parse(testEnv.IDEMPOTENCY_KV.values.get(key));
    pending.expires_at_ms = 1;
    testEnv.IDEMPOTENCY_KV.values.set(key, JSON.stringify(pending));
    await send(testEnv, event("UPDATE-EXPIRE-2", "確認修改"));
    assert.equal(mock.calls.updates.length, 0);
    assert.equal(mock.calls.replies.at(-1), "這次行程修改已逾時，請重新搜尋後再修改。");
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(key), false);
  } finally { mock.restore(); }
});

test("health publishes the bounded Calendar Update contract", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), makeEnv(), {});
  const health = await response.json();
  assert.equal(health.calendar_update.calendar_alias, "authorized_test");
  assert.equal(health.calendar_update.calendar_backend, "primary");
  assert.equal(health.calendar_update.pending_ttl_seconds, 600);
  assert.equal(health.calendar_update.confirmation_required, true);
  assert.equal(health.calendar_update.original_candidate_match_required, true);
  assert.equal(health.calendar_update.retry_policy, "readback_only_after_ambiguous_update");
  assert.equal(health.calendar_update.calendar_delete_effect, 0);
});
