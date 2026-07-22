import assert from "node:assert/strict";
import test from "node:test";

import worker, { handleLineWebhook } from "../src/index.js";
import {
  CALENDAR_DELETE_TTL_SECONDS,
  buildCalendarDeleteIdentity,
  calendarDeletePendingKey,
  parseCalendarDeleteCommand,
  parseCalendarDeleteContinuation,
} from "../src/calendar-delete.js";
import {
  buildCalendarSearchIdentity,
  calendarSearchSnapshotKey,
  createCalendarSearchSnapshot,
} from "../src/calendar-search.js";

const RECEIVED_AT = "2026-07-22T08:00:00.000Z";

class MemoryKv {
  constructor() { this.values = new Map(); this.writes = []; this.deletes = []; }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value, options = {}) { this.values.set(key, value); this.writes.push({ key, value, options }); }
  async delete(key) { this.values.delete(key); this.deletes.push(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
  }
}

function event(eventId, text, actor = "calendar-delete-actor-a") {
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

function candidate(id = "evt-delete-a", title = "隔離測試行程") {
  return {
    event_reference: id,
    title,
    location: "彰化",
    all_day: false,
    start: "2026-07-22T16:00:00+08:00",
    end: "2026-07-22T16:30:00+08:00",
  };
}

function makeEnv() {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-line-token",
    LINE_TEST_ADMIN_USER_IDS: "calendar-delete-actor-a,calendar-delete-actor-b",
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

async function seedSnapshot(testEnv, actor = "calendar-delete-actor-a", candidates = [candidate()]) {
  const lineEvent = event("SEED-DELETE-SNAPSHOT", "搜尋今天", actor);
  const identity = await buildCalendarSearchIdentity(lineEvent);
  const snapshot = createCalendarSearchSnapshot({ identity, candidates, nowMs: Date.now() });
  testEnv.IDEMPOTENCY_KV.values.set(calendarSearchSnapshotKey(identity.actor_hash), JSON.stringify(snapshot));
  return { identity, snapshot };
}

function installFetchMock(testEnv, options = {}) {
  const calls = { searches: [], deletes: [], replies: [], pushes: 0 };
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
      assert.equal(body.intent, "calendar_delete");
      calls.deletes.push(body);
      if (options.firstDeleteAmbiguous && calls.deletes.length === 1) {
        return new Response(JSON.stringify({
          request_id: body.request_id,
          intent: "calendar_delete",
          status: "failed",
          readback_verified: false,
          exists: true,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        request_id: body.request_id,
        intent: "calendar_delete",
        status: "completed",
        readback_verified: true,
        exists: false,
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

test("Delete parser supports sequence and unique keyword but rejects unbounded delete", () => {
  assert.deepEqual(parseCalendarDeleteCommand("行事曆刪除：第一個").target, {
    mode: "snapshot", position: 1, query: "",
  });
  assert.deepEqual(parseCalendarDeleteCommand("行事曆刪除：唯一隔離行程").target, {
    mode: "keyword", position: 0, query: "唯一隔離行程",
  });
  assert.equal(parseCalendarDeleteCommand("行事曆刪除：全部").reason, "unbounded_delete_disallowed");
  assert.equal(parseCalendarDeleteContinuation("確認刪除").action, "confirm");
  assert.equal(parseCalendarDeleteContinuation("不要刪").action, "cancel");
});

test("snapshot selection shows safe summary before exactly one Delete and absence readback", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("DELETE-1", "行事曆刪除：第一個"));
    assert.equal(mock.calls.deletes.length, 0);
    assert.match(mock.calls.replies[0], /^請確認刪除：/);
    assert.equal(/evt-delete-a|event_id|calendar_id|request_id|credential/.test(mock.calls.replies[0]), false);
    await send(testEnv, event("DELETE-2", "確認刪除"));
    assert.equal(mock.calls.deletes.length, 1);
    assert.equal(mock.calls.deletes[0].readback_only, false);
    assert.match(mock.calls.replies[1], /^行程已刪除：/);
    const identity = await buildCalendarDeleteIdentity(event("DELETE-PROBE", "確認刪除"));
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(calendarDeletePendingKey(identity.actor_hash)), false);
  } finally { mock.restore(); }
});

test("cancel and 不要刪 clear pending with zero Calendar delete", async () => {
  for (const [suffix, phrase] of [["CANCEL", "取消"], ["NO", "不要刪"]]) {
    const testEnv = makeEnv();
    await seedSnapshot(testEnv);
    const mock = installFetchMock(testEnv);
    try {
      await send(testEnv, event(`DELETE-${suffix}-1`, "刪除第一個"));
      await send(testEnv, event(`DELETE-${suffix}-2`, phrase));
      assert.equal(mock.calls.deletes.length, 0);
      assert.equal(mock.calls.replies.at(-1), "已取消這次行程刪除。");
    } finally { mock.restore(); }
  }
});

test("keyword target requires exactly one result; ambiguity/no result delete zero", async () => {
  for (const results of [[], [candidate("evt-a", "會議"), candidate("evt-b", "會議")]]) {
    const testEnv = makeEnv();
    const mock = installFetchMock(testEnv, { searchCandidates: results });
    try {
      await send(testEnv, event(`DELETE-LOOKUP-${results.length}`, "行事曆刪除：會議"));
      assert.equal(mock.calls.searches.length, 1);
      assert.equal(mock.calls.deletes.length, 0);
      assert.match(mock.calls.replies[0], results.length ? /找到多筆/ : /沒有找到/);
    } finally { mock.restore(); }
  }
});

test("different actor cannot confirm another actor pending", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv, "calendar-delete-actor-a");
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("DELETE-ACTOR-1", "刪除第一個", "calendar-delete-actor-a"));
    await send(testEnv, event("DELETE-ACTOR-2", "確認刪除", "calendar-delete-actor-b"));
    assert.equal(mock.calls.deletes.length, 0);
    assert.match(mock.calls.replies.at(-1), /目前沒有.*刪除/);
    assert.equal(/event_id|calendar_id|request_id|credential/.test(mock.calls.replies.at(-1)), false);
  } finally { mock.restore(); }
});

test("changed snapshot or missing candidate fails closed", async () => {
  const testEnv = makeEnv();
  const seeded = await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("DELETE-STALE-1", "刪除第一個"));
    const replacement = createCalendarSearchSnapshot({
      identity: { actor_hash: seeded.identity.actor_hash, safe_event_hash: "e".repeat(64) },
      candidates: [candidate("evt-other", "其他行程")],
      nowMs: Date.now(),
    });
    testEnv.IDEMPOTENCY_KV.values.set(calendarSearchSnapshotKey(seeded.identity.actor_hash), JSON.stringify(replacement));
    await send(testEnv, event("DELETE-STALE-2", "確認刪除"));
    assert.equal(mock.calls.deletes.length, 0);
    assert.match(mock.calls.replies.at(-1), /搜尋結果已變動/);
  } finally { mock.restore(); }
});

test("identical confirmation webhook retries one Delete and one LINE final", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  const confirmation = event("DELETE-DUP-2", "確認刪除");
  try {
    await send(testEnv, event("DELETE-DUP-1", "刪除第一個"));
    await send(testEnv, confirmation);
    await send(testEnv, confirmation);
    assert.equal(mock.calls.deletes.filter((call) => !call.readback_only).length, 1);
    assert.equal(mock.calls.replies.filter((reply) => reply.startsWith("行程已刪除：")).length, 1);
    assert.equal(mock.calls.pushes, 0);
  } finally { mock.restore(); }
});

test("ambiguous initial Delete performs readback only and never deletes twice", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv, { firstDeleteAmbiguous: true });
  try {
    await send(testEnv, event("DELETE-READBACK-1", "刪除第一個"));
    await send(testEnv, event("DELETE-READBACK-2", "確認刪除"));
    assert.equal(mock.calls.deletes.length, 2);
    assert.equal(mock.calls.deletes[0].readback_only, false);
    assert.equal(mock.calls.deletes[1].readback_only, true);
    assert.equal(mock.calls.replies.filter((reply) => reply.startsWith("行程已刪除：")).length, 1);
  } finally { mock.restore(); }
});

test("pending key is actor-only with TTL 600 and excludes LINE identifiers", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    const lineEvent = event("DELETE-PENDING", "刪除第一個");
    await send(testEnv, lineEvent);
    const identity = await buildCalendarDeleteIdentity(lineEvent);
    const key = calendarDeletePendingKey(identity.actor_hash);
    assert.match(key, /^calendar_delete:v1:pending:[a-f0-9]{64}$/);
    assert.equal(key.includes(lineEvent.replyToken), false);
    const write = testEnv.IDEMPOTENCY_KV.writes.find((item) => item.key === key);
    assert.equal(write.options.expirationTtl, CALENDAR_DELETE_TTL_SECONDS);
  } finally { mock.restore(); }
});

test("expired pending is cleared and confirmation causes zero delete", async () => {
  const testEnv = makeEnv();
  await seedSnapshot(testEnv);
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("DELETE-EXPIRE-1", "刪除第一個"));
    const identity = await buildCalendarDeleteIdentity(event("DELETE-EXPIRE-PROBE", "確認刪除"));
    const key = calendarDeletePendingKey(identity.actor_hash);
    const pending = JSON.parse(testEnv.IDEMPOTENCY_KV.values.get(key));
    pending.expires_at_ms = 1;
    testEnv.IDEMPOTENCY_KV.values.set(key, JSON.stringify(pending));
    await send(testEnv, event("DELETE-EXPIRE-2", "確認刪除"));
    assert.equal(mock.calls.deletes.length, 0);
    assert.match(mock.calls.replies.at(-1), /已逾時/);
    assert.equal(testEnv.IDEMPOTENCY_KV.values.has(key), false);
  } finally { mock.restore(); }
});

test("unbounded delete reaches deterministic refusal and Calendar delete zero", async () => {
  const testEnv = makeEnv();
  const mock = installFetchMock(testEnv);
  try {
    await send(testEnv, event("DELETE-ALL", "行事曆刪除：全部"));
    assert.equal(mock.calls.deletes.length, 0);
    assert.match(mock.calls.replies[0], /不能清空整本行事曆/);
  } finally { mock.restore(); }
});

test("health publishes bounded Calendar Delete contract", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), makeEnv(), {});
  const health = await response.json();
  assert.equal(health.calendar_delete.calendar_backend, "primary");
  assert.equal(health.calendar_delete.pending_ttl_seconds, 600);
  assert.equal(health.calendar_delete.confirmation_required, true);
  assert.equal(health.calendar_delete.unbounded_delete_allowed, false);
  assert.equal(health.calendar_delete.original_candidate_match_required, true);
  assert.equal(health.calendar_delete.final_exactly_once, true);
});
