export const CALENDAR_CREATE_COMMAND_PREFIX = "行事曆新增：";
export const CALENDAR_ALIAS = "authorized_test";
export const CALENDAR_TIMEZONE = "Asia/Taipei";
export const CALENDAR_CREATE_TTL_SECONDS = 600;
export const CALENDAR_MAX_DURATION_MINUTES = 10_080;

const CALENDAR_ACCEPTANCE_SCHEMA = "pline-v3-calendar-create-acceptance/v1";
const CALENDAR_ACCEPTANCE_PREFIX = "calendar_create:v1:acceptance";
const CALENDAR_EVENT_ID_PREFIX = "cal";
const FINAL_STATES = new Set([
  "final_completed",
  "final_failed",
  "delivery_ambiguous",
  "reply_rejected",
  "reply_unavailable",
]);

const REPLIES = Object.freeze({
  missing_date: "請告訴我行程日期。",
  missing_start: "要設為全天，還是幾點開始？",
  missing_end_or_duration: "要到幾點結束，或持續多久？",
  missing_title: "請告訴我這個行程的內容。",
  ambiguous_date: "日期有點不確定，請告訴我完整日期。",
  ambiguous_time: "時間有點不確定，請說明上午、下午或使用 24 小時制。",
  ambiguous_end: "結束時間有點不確定，請告訴我完整的開始與結束時間。",
  duration_over_limit: "這個行程超過 7 天，請重新確認日期與時間後再新增。",
  invalid_format: "請用「行事曆新增：內容」告訴我行程、日期與時間。",
  failed: "這次沒有成功新增行程，我先停在安全狀態，請稍後再試一次。",
});

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateKey(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function compareDateParts(left, right) {
  return dateKey(left).localeCompare(dateKey(right));
}

function addDays(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

function taipeiDateParts(receivedAt) {
  const parsed = new Date(receivedAt || Date.now());
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday,
  };
}

function chineseNumber(value) {
  const text = String(value || "").replace(/兩/g, "二").replace(/個/g, "");
  if (/^\d+$/.test(text)) return Number(text);
  const digit = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? digit[tens] : 1) * 10 + (ones ? digit[ones] : 0);
  }
  return Object.hasOwn(digit, text) ? digit[text] : Number.NaN;
}

function validDate(parts) {
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return probe.getUTCFullYear() === parts.year
    && probe.getUTCMonth() + 1 === parts.month
    && probe.getUTCDate() === parts.day;
}

function parseDate(text, receivedAt) {
  const base = taipeiDateParts(receivedAt);
  if (!base) return { ok: false, reason: "ambiguous_date" };
  if (text.includes("今天")) return { ok: true, parts: base, token: "今天", relative: true };
  if (text.includes("明天")) return { ok: true, parts: addDays(base, 1), token: "明天", relative: true };
  if (text.includes("下週一") || text.includes("下星期一")) {
    const days = base.weekday === 0 ? 1 : 8 - base.weekday;
    const token = text.includes("下週一") ? "下週一" : "下星期一";
    return { ok: true, parts: addDays(base, days), token, relative: true };
  }
  const full = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (full) {
    const parts = { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]) };
    return validDate(parts)
      ? { ok: true, parts, token: full[0], relative: false }
      : { ok: false, reason: "ambiguous_date" };
  }
  const partial = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (partial) {
    let parts = { year: base.year, month: Number(partial[1]), day: Number(partial[2]) };
    if (!validDate(parts)) return { ok: false, reason: "ambiguous_date" };
    if (compareDateParts(parts, base) < 0) {
      parts = { ...parts, year: base.year + 1 };
      if (!validDate(parts)) return { ok: false, reason: "ambiguous_date" };
    }
    return { ok: true, parts, token: partial[0], relative: false };
  }
  if (/\d{1,2}[\/-]\d{1,2}/.test(text) || /(?:本週|這週|下週|下星期)(?!一)/.test(text)) {
    return { ok: false, reason: "ambiguous_date" };
  }
  return { ok: false, reason: "missing_date" };
}

function normalizeHour(period, rawHour) {
  let hour = chineseNumber(rawHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) return Number.NaN;
  if (period === "凌晨") return hour === 12 ? 0 : hour;
  if (["下午", "傍晚", "晚上"].includes(period) && hour < 12) return hour + 12;
  if (period === "中午" && hour < 11) return hour + 12;
  return hour === 24 ? 0 : hour;
}

function timeMatches(text) {
  const pattern = /(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*([0-9一二三四五六七八九十兩]{1,3})\s*(?:點|時)(?:\s*([0-5]?\d)\s*分?)?/g;
  return Array.from(text.matchAll(pattern));
}

function parseTimes(text) {
  const matches = timeMatches(text);
  if (matches.length === 0) return { ok: false, reason: "missing_start", matches };
  const firstPeriod = matches[0][1] || "";
  const firstHourRaw = chineseNumber(matches[0][2]);
  if (!firstPeriod && firstHourRaw <= 12) return { ok: false, reason: "ambiguous_time", matches };
  const startHour = normalizeHour(firstPeriod, matches[0][2]);
  const startMinute = Number(matches[0][3] || 0);
  if (!Number.isInteger(startHour) || startMinute > 59) return { ok: false, reason: "ambiguous_time", matches };
  const startMinutes = startHour * 60 + startMinute;

  if (matches.length >= 2) {
    const secondPeriod = matches[1][1] || firstPeriod;
    const endHour = normalizeHour(secondPeriod, matches[1][2]);
    const endMinute = Number(matches[1][3] || 0);
    const endMinutes = endHour * 60 + endMinute;
    if (!Number.isInteger(endHour) || endMinute > 59 || endMinutes <= startMinutes) {
      return { ok: false, reason: "ambiguous_end", matches };
    }
    return { ok: true, startMinutes, endMinutes, durationMinutes: endMinutes - startMinutes, matches };
  }

  let durationMinutes = null;
  const halfHours = text.match(/([0-9一二三四五六七八九十兩]+)?個?半小時/);
  if (halfHours) {
    const whole = halfHours[1] ? chineseNumber(halfHours[1]) : 0;
    durationMinutes = whole * 60 + 30;
  } else {
    const hours = text.match(/([0-9一二三四五六七八九十兩]+)個?小時/);
    const minutes = text.match(/([0-9一二三四五六七八九十兩]+)分鐘/);
    if (hours) durationMinutes = chineseNumber(hours[1]) * 60;
    if (minutes) durationMinutes = (durationMinutes || 0) + chineseNumber(minutes[1]);
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, reason: "missing_end_or_duration", startMinutes, matches };
  }
  if (durationMinutes > CALENDAR_MAX_DURATION_MINUTES) {
    return { ok: false, reason: "duration_over_limit", startMinutes, durationMinutes, matches };
  }
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes >= 24 * 60) return { ok: false, reason: "ambiguous_end", startMinutes, matches };
  return { ok: true, startMinutes, endMinutes, durationMinutes, matches };
}

function parseLocation(text) {
  const match = text.match(/地點\s*[：:]?\s*([^，,。]+)\s*$/);
  return match ? { location: match[1].trim(), token: match[0] } : { location: "", token: "" };
}

function titleFrom(text, dateToken, timeTokens, locationToken, allDay) {
  let title = text;
  for (const token of [dateToken, locationToken, ...timeTokens]) {
    if (token) title = title.replace(token, " ");
  }
  title = title
    .replace(/([0-9一二三四五六七八九十兩]+)?個?半小時/g, " ")
    .replace(/[0-9一二三四五六七八九十兩]+個?小時/g, " ")
    .replace(/[0-9一二三四五六七八九十兩]+分鐘/g, " ")
    .replace(allDay ? /全天/g : /$^/, " ")
    .replace(/\s*到\s*/g, " ")
    .replace(/^[：:\s，,。]+|[：:\s，,。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return title;
}

function rfc3339(date, minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${dateKey(date)}T${pad2(hour)}:${pad2(minute)}:00+08:00`;
}

export function parseCalendarCreateCommand(messageText = "", receivedAt = new Date().toISOString()) {
  const text = String(messageText || "").trim();
  if (!text.startsWith(CALENDAR_CREATE_COMMAND_PREFIX)) {
    return { matched: false, valid: false, reason: "not_calendar_create", fields: {} };
  }
  const input = text.slice(CALENDAR_CREATE_COMMAND_PREFIX.length).trim();
  if (!input) return { matched: true, valid: false, reason: "invalid_format", fields: {} };

  const date = parseDate(input, receivedAt);
  if (!date.ok) return { matched: true, valid: false, reason: date.reason, fields: {} };
  const location = parseLocation(input);
  const allDay = input.includes("全天");
  if (allDay) {
    const title = titleFrom(input, date.token, [], location.token, true);
    if (!title) return { matched: true, valid: false, reason: "missing_title", fields: {} };
    return {
      matched: true,
      valid: true,
      reason: "",
      fields: {
        title,
        location: location.location,
        all_day: true,
        date: dateKey(date.parts),
        start: `${dateKey(date.parts)}T00:00:00+08:00`,
        end: `${dateKey(addDays(date.parts, 1))}T00:00:00+08:00`,
        timezone: CALENDAR_TIMEZONE,
      },
    };
  }

  const times = parseTimes(input);
  if (!times.ok) return { matched: true, valid: false, reason: times.reason, fields: {} };
  const title = titleFrom(input, date.token, times.matches.map((match) => match[0]), location.token, false);
  if (!title) return { matched: true, valid: false, reason: "missing_title", fields: {} };
  return {
    matched: true,
    valid: true,
    reason: "",
    fields: {
      title,
      location: location.location,
      all_day: false,
      date: dateKey(date.parts),
      start: rfc3339(date.parts, times.startMinutes),
      end: rfc3339(date.parts, times.endMinutes),
      duration_minutes: times.durationMinutes,
      timezone: CALENDAR_TIMEZONE,
    },
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildCalendarCreateIdentity(event = {}) {
  const eventIdentity = String(event.webhookEventId || event.message?.id || "");
  if (!eventIdentity) return { ok: false, reason: "missing_line_event_identity" };
  const safeEventHash = await sha256(`calendar-line-event:${eventIdentity}`);
  const source = event.source && typeof event.source === "object" ? event.source : {};
  const actorHash = await sha256(JSON.stringify({
    type: source.type || "user",
    user: source.userId || "",
    group: source.groupId || "",
    room: source.roomId || "",
  }));
  return {
    ok: true,
    safe_event_hash: safeEventHash,
    actor_hash: actorHash,
    event_reference: `${CALENDAR_EVENT_ID_PREFIX}${safeEventHash}`,
  };
}

export function calendarAcceptanceKey(safeEventHash = "") {
  return `${CALENDAR_ACCEPTANCE_PREFIX}:${safeEventHash}`;
}

export function createCalendarAcceptanceRecord({ identity, command, replyToken, receivedAt }) {
  return {
    schema: CALENDAR_ACCEPTANCE_SCHEMA,
    status: "accepted",
    safe_event_hash: identity.safe_event_hash,
    actor_hash: identity.actor_hash,
    event_reference: identity.event_reference,
    input_valid: Boolean(command.valid),
    reject_reason: command.valid ? "" : command.reason,
    calendar_alias: CALENDAR_ALIAS,
    timezone: CALENDAR_TIMEZONE,
    canonical: command.valid ? structuredClone(command.fields) : {},
    reply_token: String(replyToken || ""),
    received_at: String(receivedAt || new Date().toISOString()),
    accepted_at: new Date().toISOString(),
  };
}

export function parseCalendarAcceptanceRecord(raw = "") {
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== CALENDAR_ACCEPTANCE_SCHEMA) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.safe_event_hash || ""))) return null;
    if (!/^cal[a-f0-9]{64}$/.test(String(record.event_reference || ""))) return null;
    return record;
  } catch {
    return null;
  }
}

export function calendarRecordBlocksDispatch(record = {}) {
  return FINAL_STATES.has(String(record.status || ""))
    || ["dispatching", "dispatch_ambiguous", "dispatched", "reply_attempt_pending"].includes(String(record.status || ""));
}

export function calendarRecordIsFinal(record = {}) {
  return FINAL_STATES.has(String(record.status || ""));
}

export function calendarValidationReplyText(reason = "") {
  return REPLIES[reason] || REPLIES.invalid_format;
}

export function calendarFailureReplyText() {
  return REPLIES.failed;
}

export function buildCalendarCreateN8nPayload(record = {}, options = {}) {
  return {
    intent: "calendar_create",
    request_id: `calendar-request-${record.safe_event_hash}`,
    safe_event_hash: record.safe_event_hash,
    calendar_alias: CALENDAR_ALIAS,
    timezone: CALENDAR_TIMEZONE,
    event_reference: record.event_reference,
    title: String(record.canonical?.title || ""),
    location: String(record.canonical?.location || ""),
    all_day: record.canonical?.all_day === true,
    date: String(record.canonical?.date || ""),
    start: String(record.canonical?.start || ""),
    end: String(record.canonical?.end || ""),
    readback_only: options.readbackOnly === true,
  };
}

function normalizeN8nBody(body) {
  if (Array.isArray(body)) return normalizeN8nBody(body[0]);
  if (body?.json && typeof body.json === "object") return normalizeN8nBody(body.json);
  if (body?.body && typeof body.body === "object") return normalizeN8nBody(body.body);
  return body && typeof body === "object" ? body : {};
}

export function validateCalendarCreateN8nResult(body, record = {}) {
  const normalized = normalizeN8nBody(body);
  const expectedRequestId = `calendar-request-${record.safe_event_hash}`;
  if (normalized.request_id !== expectedRequestId) return { ok: false, reason: "request_id_mismatch" };
  if (normalized.intent !== "calendar_create") return { ok: false, reason: "intent_mismatch" };
  if (normalized.status !== "completed" || normalized.readback_verified !== true) {
    return { ok: false, reason: String(normalized.reason || "calendar_readback_failed") };
  }
  const canonical = record.canonical || {};
  if (
    normalized.title !== canonical.title
    || String(normalized.location || "") !== String(canonical.location || "")
    || normalized.all_day !== Boolean(canonical.all_day)
    || normalized.start !== canonical.start
    || normalized.end !== canonical.end
  ) {
    return { ok: false, reason: "calendar_readback_mismatch" };
  }
  return { ok: true, duplicate: normalized.duplicate === true, body: normalized };
}

export function calendarSuccessReplyText(record = {}) {
  const event = record.canonical || {};
  const date = String(event.date || "");
  let line = event.all_day
    ? `${date} 全天`
    : `${date} ${String(event.start || "").slice(11, 16)}–${String(event.end || "").slice(11, 16)}`;
  if (event.location) line += `\n地點：${event.location}`;
  return `行程已新增：${event.title}\n${line}`;
}
