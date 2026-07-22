import assert from "node:assert/strict";
import test from "node:test";

import { handleLineWebhook } from "../src/index.js";
import {
  CALENDAR_ALIAS,
  CALENDAR_CREATE_TTL_SECONDS,
  CALENDAR_TIMEZONE,
  buildCalendarCreateIdentity,
  buildCalendarCreateN8nPayload,
  calendarSuccessReplyText,
  createCalendarAcceptanceRecord,
  parseCalendarCreateCommand,
  validateCalendarCreateN8nResult,
} from "../src/calendar-create.js";

const RECEIVED_AT = "2026-07-22T02:00:00.000Z";

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.writes = [];
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
  }
  async list({ prefix = "" } = {}) {
    return { keys: Array.from(this.values.keys()).filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
  }
}

function event(eventId, text) {
  return {
    type: "message",
    webhookEventId: eventId,
    replyToken: `reply-${eventId}`,
    source: { type: "user", userId: "calendar-gate-offline-actor" },
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

function env() {
  return {
    LINE_CHANNEL_SECRET: "offline-channel-secret",
    LINE_CHANNEL_ACCESS_TOKEN: "offline-line-token",
    LINE_TEST_ADMIN_USER_IDS: "calendar-gate-offline-actor",
    N8N_WEBHOOK_URL: "https://n8n.example.test/webhook/calendar",
    N8N_SHARED_SECRET: "offline-n8n-secret",
    IDEMPOTENCY_KV: new MemoryKv(),
    RUNTIME_KV: new MemoryKv(),
  };
}

test("complete start/end creates canonical direct-create contract", () => {
  const parsed = parseCalendarCreateCommand("行事曆新增：7月25日上午10點到11點去銀行", RECEIVED_AT);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.fields, {
    title: "去銀行",
    location: "",
    all_day: false,
    date: "2026-07-25",
    start: "2026-07-25T10:00:00+08:00",
    end: "2026-07-25T11:00:00+08:00",
    duration_minutes: 60,
    timezone: CALENDAR_TIMEZONE,
  });
});

test("duration computes the exact end", () => {
  const parsed = parseCalendarCreateCommand("行事曆新增：明天下午三點跟王小姐開會一小時", RECEIVED_AT);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.fields.start, "2026-07-23T15:00:00+08:00");
  assert.equal(parsed.fields.end, "2026-07-23T16:00:00+08:00");
  assert.equal(parsed.fields.duration_minutes, 60);
});

test("all-day uses exclusive next-day end", () => {
  const parsed = parseCalendarCreateCommand("行事曆新增：8月3日全天休假", RECEIVED_AT);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.fields.all_day, true);
  assert.equal(parsed.fields.start, "2026-08-03T00:00:00+08:00");
  assert.equal(parsed.fields.end, "2026-08-04T00:00:00+08:00");
});

test("location is isolated from the title", () => {
  const parsed = parseCalendarCreateCommand("行事曆新增：下週一下午兩點牙醫一小時地點彰化", RECEIVED_AT);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.fields.date, "2026-07-27");
  assert.equal(parsed.fields.title, "牙醫");
  assert.equal(parsed.fields.location, "彰化");
});

test("today tomorrow and next Monday resolve in Asia/Taipei", () => {
  assert.equal(parseCalendarCreateCommand("行事曆新增：今天下午三點甲一小時", RECEIVED_AT).fields.date, "2026-07-22");
  assert.equal(parseCalendarCreateCommand("行事曆新增：明天下午三點乙一小時", RECEIVED_AT).fields.date, "2026-07-23");
  assert.equal(parseCalendarCreateCommand("行事曆新增：下週一下午三點丙一小時", RECEIVED_AT).fields.date, "2026-07-27");
});

test("month and year roll forward without changing timezone", () => {
  const crossMonth = parseCalendarCreateCommand("行事曆新增：8月1日上午十點甲一小時", RECEIVED_AT);
  const crossYear = parseCalendarCreateCommand("行事曆新增：1月2日上午十點乙一小時", RECEIVED_AT);
  assert.equal(crossMonth.fields.date, "2026-08-01");
  assert.equal(crossYear.fields.date, "2027-01-02");
  assert.equal(crossYear.fields.timezone, CALENDAR_TIMEZONE);
});

test("missing time and missing end clarify only what is missing", () => {
  assert.equal(parseCalendarCreateCommand("行事曆新增：8月3日休假", RECEIVED_AT).reason, "missing_start");
  assert.equal(parseCalendarCreateCommand("行事曆新增：今天晚上七點提醒繳電話費", RECEIVED_AT).reason, "missing_end_or_duration");
});

test("ambiguous time and over-limit duration fail closed", () => {
  assert.equal(parseCalendarCreateCommand("行事曆新增：7月25日10點去銀行一小時", RECEIVED_AT).reason, "ambiguous_time");
  assert.equal(parseCalendarCreateCommand("行事曆新增：7月25日上午10點去銀行10081分鐘", RECEIVED_AT).reason, "duration_over_limit");
});

test("identity, alias, TTL and n8n payload contain no actor identifier", async () => {
  const lineEvent = event("CAL-ID-1", "行事曆新增：明天下午三點開會一小時");
  const identity = await buildCalendarCreateIdentity(lineEvent);
  const command = parseCalendarCreateCommand(lineEvent.message.text, RECEIVED_AT);
  const record = createCalendarAcceptanceRecord({ identity, command, replyToken: "reply", receivedAt: RECEIVED_AT });
  const payload = buildCalendarCreateN8nPayload(record);
  assert.equal(CALENDAR_CREATE_TTL_SECONDS, 600);
  assert.equal(payload.calendar_alias, CALENDAR_ALIAS);
  assert.equal(payload.timezone, CALENDAR_TIMEZONE);
  assert.equal(JSON.stringify(payload).includes(lineEvent.source.userId), false);
  assert.match(payload.event_reference, /^cal[a-f0-9]{64}$/);
});

test("readback contract rejects API failure and field mismatch", async () => {
  const lineEvent = event("CAL-READBACK-1", "行事曆新增：明天下午三點開會一小時");
  const identity = await buildCalendarCreateIdentity(lineEvent);
  const command = parseCalendarCreateCommand(lineEvent.message.text, RECEIVED_AT);
  const record = createCalendarAcceptanceRecord({ identity, command, replyToken: "reply", receivedAt: RECEIVED_AT });
  const payload = buildCalendarCreateN8nPayload(record);
  assert.equal(validateCalendarCreateN8nResult({ request_id: payload.request_id, intent: "calendar_create", status: "failed" }, record).ok, false);
  assert.equal(validateCalendarCreateN8nResult({
    request_id: payload.request_id,
    intent: "calendar_create",
    status: "completed",
    readback_verified: true,
    title: "錯誤標題",
    location: record.canonical.location,
    all_day: record.canonical.all_day,
    start: record.canonical.start,
    end: record.canonical.end,
  }, record).ok, false);
});

test("complete LINE event creates once, readback succeeds, and duplicate retry emits no second final", async () => {
  const testEnv = env();
  const lineEvent = event("CAL-LIVE-MOCK-1", "行事曆新增：明天下午三點開會一小時");
  const calls = { n8n: 0, reply: 0, push: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      calls.n8n += 1;
      const body = JSON.parse(options.body);
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
      calls.reply += 1;
      const body = JSON.parse(options.body);
      assert.equal(JSON.stringify(body).includes("event_reference"), false);
      assert.match(body.messages[0].text, /^行程已新增：/);
      return new Response("", { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/push") {
      calls.push += 1;
      return new Response("", { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const firstContext = context();
    const first = await handleLineWebhook(await signedRequest(lineEvent), testEnv, firstContext);
    assert.equal(first.status, 200);
    await Promise.all(firstContext.tasks);
    const secondContext = context();
    const second = await handleLineWebhook(await signedRequest(lineEvent), testEnv, secondContext);
    assert.equal(second.status, 200);
    await Promise.all(secondContext.tasks);
    assert.deepEqual(calls, { n8n: 1, reply: 1, push: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing end performs zero n8n writes and returns one clarification", async () => {
  const testEnv = env();
  const lineEvent = event("CAL-MISSING-1", "行事曆新增：今天晚上七點提醒繳電話費");
  const calls = { n8n: 0, reply: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      calls.n8n += 1;
      return new Response("{}", { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      calls.reply += 1;
      assert.equal(JSON.parse(options.body).messages[0].text, "要到幾點結束，或持續多久？");
      return new Response("", { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const ctx = context();
    const response = await handleLineWebhook(await signedRequest(lineEvent), testEnv, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    assert.deepEqual(calls, { n8n: 0, reply: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("n8n/API failure retries readback only and never emits a success final", async () => {
  const testEnv = env();
  const lineEvent = event("CAL-API-FAIL-1", "行事曆新增：明天下午三點開會一小時");
  const n8nPayloads = [];
  let replyText = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      n8nPayloads.push(JSON.parse(options.body));
      return new Response("{}", { status: 503 });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replyText = JSON.parse(options.body).messages[0].text;
      return new Response("", { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const ctx = context();
    const response = await handleLineWebhook(await signedRequest(lineEvent), testEnv, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    assert.equal(n8nPayloads.length, 2);
    assert.equal(n8nPayloads[0].readback_only, false);
    assert.equal(n8nPayloads[1].readback_only, true);
    assert.equal(replyText.startsWith("行程已新增："), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an HTTP 200 with mismatched fields performs readback only before reporting success", async () => {
  const testEnv = env();
  const lineEvent = event("CAL-MISMATCH-1", "行事曆新增：明天下午三點開會一小時");
  const n8nPayloads = [];
  let replyText = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (url === testEnv.N8N_WEBHOOK_URL) {
      const body = JSON.parse(options.body);
      n8nPayloads.push(body);
      return new Response(JSON.stringify({
        request_id: body.request_id,
        intent: "calendar_create",
        status: "completed",
        readback_verified: true,
        duplicate: body.readback_only,
        title: body.readback_only ? body.title : "不相符的標題",
        location: body.location,
        all_day: body.all_day,
        start: body.start,
        end: body.end,
      }), { status: 200 });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replyText = JSON.parse(options.body).messages[0].text;
      return new Response("", { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };
  try {
    const ctx = context();
    const response = await handleLineWebhook(await signedRequest(lineEvent), testEnv, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.tasks);
    assert.equal(n8nPayloads.length, 2);
    assert.equal(n8nPayloads[0].readback_only, false);
    assert.equal(n8nPayloads[1].readback_only, true);
    assert.match(replyText, /^行程已新增：/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LINE success summary is safe and contains only public event fields", async () => {
  const lineEvent = event("CAL-SAFE-1", "行事曆新增：下週一下午兩點牙醫一小時地點彰化");
  const identity = await buildCalendarCreateIdentity(lineEvent);
  const command = parseCalendarCreateCommand(lineEvent.message.text, RECEIVED_AT);
  const record = createCalendarAcceptanceRecord({ identity, command, replyToken: "reply", receivedAt: RECEIVED_AT });
  const reply = calendarSuccessReplyText(record);
  assert.equal(reply, "行程已新增：牙醫\n2026-07-27 14:00–15:00\n地點：彰化");
  for (const forbidden of ["event_id", "calendar_id", "credential", "request_id", "JSON", record.event_reference]) {
    assert.equal(reply.includes(forbidden), false);
  }
});
