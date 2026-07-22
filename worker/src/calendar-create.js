export const CALENDAR_CREATE_COMMAND_PREFIX = "行事曆新增：";
export const CALENDAR_ALIAS = "authorized_test";
export const CALENDAR_TIMEZONE = "Asia/Taipei";
export const CALENDAR_CREATE_TTL_SECONDS = 600;
export const CALENDAR_MAX_DURATION_MINUTES = 10_080;

const CALENDAR_ACCEPTANCE_SCHEMA = "pline-v3-calendar-create-acceptance/v1";
const CALENDAR_ACCEPTANCE_PREFIX = "calendar_create:v1:acceptance";
const CALENDAR_PENDING_SCHEMA = "pline-v3-calendar-create-pending/v1";
const CALENDAR_PENDING_PREFIX = "calendar_create:v1:pending";
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
  cancelled: "已取消這次行程新增。",
  pending_expired: "這個行程草稿已逾時，請重新告訴我新的行程。",
  continuation_rejected: "這次補充的資訊無法安全套用，行程草稿已取消。",
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

function parseDurationMinutes(text) {
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
  return Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : null;
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

  const durationMinutes = parseDurationMinutes(text);
  if (!durationMinutes) {
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
    .replace(/(?:持續)?([0-9一二三四五六七八九十兩]+)?個?半小時(?:結束)?/g, " ")
    .replace(/(?:持續)?[0-9一二三四五六七八九十兩]+個?小時(?:結束)?/g, " ")
    .replace(/(?:持續)?[0-9一二三四五六七八九十兩]+分鐘(?:結束)?/g, " ")
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

function datePartsFromKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return validDate(parts) ? parts : null;
}

function commandFromDraft(draft = {}, fatalReason = "") {
  const normalized = {
    title: String(draft.title || "").trim(),
    location: String(draft.location || "").trim(),
    all_day: draft.all_day === true,
    date: String(draft.date || ""),
    start_minutes: Number.isInteger(draft.start_minutes) ? draft.start_minutes : null,
    end_minutes: Number.isInteger(draft.end_minutes) ? draft.end_minutes : null,
    duration_minutes: Number.isInteger(draft.duration_minutes) ? draft.duration_minutes : null,
    timezone: CALENDAR_TIMEZONE,
  };
  if (fatalReason) {
    return { matched: true, valid: false, reason: fatalReason, fields: {}, draft: normalized, pending: false, rejected: true };
  }
  let reason = "";
  if (!datePartsFromKey(normalized.date)) reason = "missing_date";
  else if (!normalized.all_day && normalized.start_minutes === null) reason = "missing_start";
  else if (!normalized.all_day && normalized.end_minutes === null) reason = "missing_end_or_duration";
  else if (!normalized.title) reason = "missing_title";
  if (reason) {
    return { matched: true, valid: false, reason, fields: {}, draft: normalized, pending: true, rejected: false };
  }
  const dateParts = datePartsFromKey(normalized.date);
  if (normalized.all_day) {
    return {
      matched: true,
      valid: true,
      reason: "",
      pending: false,
      rejected: false,
      draft: normalized,
      fields: {
        title: normalized.title,
        location: normalized.location,
        all_day: true,
        date: normalized.date,
        start: `${normalized.date}T00:00:00+08:00`,
        end: `${dateKey(addDays(dateParts, 1))}T00:00:00+08:00`,
        timezone: CALENDAR_TIMEZONE,
      },
    };
  }
  const durationMinutes = normalized.end_minutes - normalized.start_minutes;
  if (durationMinutes <= 0 || durationMinutes > CALENDAR_MAX_DURATION_MINUTES || normalized.end_minutes >= 24 * 60) {
    const reason = durationMinutes > CALENDAR_MAX_DURATION_MINUTES ? "duration_over_limit" : "ambiguous_end";
    return { matched: true, valid: false, reason, fields: {}, draft: normalized, pending: false, rejected: true };
  }
  return {
    matched: true,
    valid: true,
    reason: "",
    pending: false,
    rejected: false,
    draft: { ...normalized, duration_minutes: durationMinutes },
    fields: {
      title: normalized.title,
      location: normalized.location,
      all_day: false,
      date: normalized.date,
      start: rfc3339(dateParts, normalized.start_minutes),
      end: rfc3339(dateParts, normalized.end_minutes),
      duration_minutes: durationMinutes,
      timezone: CALENDAR_TIMEZONE,
    },
  };
}

export function parseCalendarCreateCommand(messageText = "", receivedAt = new Date().toISOString()) {
  const text = String(messageText || "").trim();
  if (!text.startsWith(CALENDAR_CREATE_COMMAND_PREFIX)) {
    return { matched: false, valid: false, reason: "not_calendar_create", fields: {}, draft: {}, pending: false };
  }
  const input = text.slice(CALENDAR_CREATE_COMMAND_PREFIX.length).trim();
  if (!input) return { matched: true, valid: false, reason: "invalid_format", fields: {}, draft: {}, pending: false, rejected: true };

  const date = parseDate(input, receivedAt);
  const location = parseLocation(input);
  const allDay = input.includes("全天");
  const times = allDay ? { ok: true, matches: [] } : parseTimes(input);
  const title = titleFrom(input, date.ok ? date.token : "", times.matches?.map((match) => match[0]) || [], location.token, allDay);
  const draft = {
    title,
    location: location.location,
    all_day: allDay,
    date: date.ok ? dateKey(date.parts) : "",
    start_minutes: allDay ? null : (Number.isInteger(times.startMinutes) ? times.startMinutes : null),
    end_minutes: allDay ? null : (Number.isInteger(times.endMinutes) ? times.endMinutes : null),
    duration_minutes: allDay ? null : (Number.isInteger(times.durationMinutes) ? times.durationMinutes : null),
    timezone: CALENDAR_TIMEZONE,
  };
  const dateFatal = !date.ok && date.reason !== "missing_date" ? date.reason : "";
  const timeFatal = !allDay && !times.ok && !["missing_start", "missing_end_or_duration"].includes(times.reason)
    ? times.reason
    : "";
  return commandFromDraft(draft, dateFatal || timeFatal);
}

export function parseCalendarCreateContinuation(messageText = "") {
  const text = String(messageText || "").trim();
  if (!text || text.startsWith(CALENDAR_CREATE_COMMAND_PREFIX)) return { matched: false, action: "none", text };
  if (text === "取消") return { matched: true, action: "cancel", text };
  if (/^(?:今天|明天|下週一|下星期一|\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日)$/.test(text)) {
    return { matched: true, action: "date", text };
  }
  if (text === "全天") return { matched: true, action: "all_day", text };
  if (/^(?:[0-9一二三四五六七八九十兩]+個?小時|[0-9一二三四五六七八九十兩]+分鐘)(?:結束)?$/.test(text)) {
    return { matched: true, action: "duration", text };
  }
  if (/^到?(?:凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*[0-9一二三四五六七八九十兩]{1,3}\s*(?:點|時)(?:\s*[0-5]?\d\s*分?)?(?:結束)?$/.test(text)) {
    return { matched: true, action: text.startsWith("到") ? "end" : "time", text };
  }
  return { matched: false, action: "none", text };
}

function continuationEndMinutes(text, startMinutes) {
  const match = String(text || "").match(/^到?\s*(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*([0-9一二三四五六七八九十兩]{1,3})\s*(?:點|時)(?:\s*([0-5]?\d)\s*分?)?(?:結束)?$/);
  if (!match) return null;
  const period = match[1] || "";
  const rawHour = chineseNumber(match[2]);
  const minute = Number(match[3] || 0);
  let endMinutes;
  if (period) {
    const hour = normalizeHour(period, match[2]);
    endMinutes = Number.isInteger(hour) ? hour * 60 + minute : Number.NaN;
  } else {
    endMinutes = rawHour * 60 + minute;
    if (rawHour <= 12 && endMinutes <= startMinutes) endMinutes += 12 * 60;
  }
  return Number.isInteger(endMinutes) && endMinutes > startMinutes && endMinutes < 24 * 60 ? endMinutes : null;
}

export function mergeCalendarCreateContinuation(pendingRecord = {}, messageText = "", receivedAt = new Date().toISOString()) {
  const continuation = parseCalendarCreateContinuation(messageText);
  if (!continuation.matched) {
    return { matched: true, valid: false, reason: "continuation_rejected", fields: {}, draft: {}, pending: false, rejected: true };
  }
  if (continuation.action === "cancel") {
    return { matched: true, valid: false, reason: "cancelled", fields: {}, draft: {}, pending: false, cancelled: true, rejected: false };
  }
  const draft = structuredClone(pendingRecord.draft || {});
  const missingField = String(pendingRecord.missing_field || commandFromDraft(draft).reason || "");
  if (missingField === "missing_date" && continuation.action === "date") {
    const date = parseDate(continuation.text, receivedAt);
    if (!date.ok) return commandFromDraft(draft, date.reason || "continuation_rejected");
    draft.date = dateKey(date.parts);
  } else if (missingField === "missing_start" && continuation.action === "all_day") {
    draft.all_day = true;
    draft.start_minutes = null;
    draft.end_minutes = null;
    draft.duration_minutes = null;
  } else if (missingField === "missing_start" && ["time", "end"].includes(continuation.action)) {
    const parsed = parseTimes(continuation.text);
    if (!Number.isInteger(parsed.startMinutes)) return commandFromDraft(draft, parsed.reason || "continuation_rejected");
    draft.start_minutes = parsed.startMinutes;
    if (Number.isInteger(parsed.endMinutes)) draft.end_minutes = parsed.endMinutes;
    if (Number.isInteger(parsed.durationMinutes)) draft.duration_minutes = parsed.durationMinutes;
  } else if (missingField === "missing_end_or_duration" && continuation.action === "duration") {
    const durationMinutes = parseDurationMinutes(continuation.text);
    if (!durationMinutes || durationMinutes > CALENDAR_MAX_DURATION_MINUTES) {
      return commandFromDraft(draft, durationMinutes > CALENDAR_MAX_DURATION_MINUTES ? "duration_over_limit" : "continuation_rejected");
    }
    draft.duration_minutes = durationMinutes;
    draft.end_minutes = draft.start_minutes + durationMinutes;
  } else if (missingField === "missing_end_or_duration" && ["end", "time"].includes(continuation.action)) {
    const endMinutes = continuationEndMinutes(continuation.text, draft.start_minutes);
    if (!endMinutes) return commandFromDraft(draft, "ambiguous_end");
    draft.end_minutes = endMinutes;
    draft.duration_minutes = endMinutes - draft.start_minutes;
  } else {
    return commandFromDraft(draft, "continuation_rejected");
  }
  return commandFromDraft(draft);
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

export function calendarPendingKey(actorHash = "") {
  return `${CALENDAR_PENDING_PREFIX}:${actorHash}`;
}

export function createCalendarPendingRecord({ identity, command, nowMs = Date.now() }) {
  return {
    schema: CALENDAR_PENDING_SCHEMA,
    status: "pending",
    actor_hash: identity.actor_hash,
    source_event_hash: identity.safe_event_hash,
    missing_field: String(command.reason || ""),
    draft: structuredClone(command.draft || {}),
    created_at_ms: Number(nowMs),
    updated_at_ms: Number(nowMs),
    expires_at_ms: Number(nowMs) + CALENDAR_CREATE_TTL_SECONDS * 1000,
  };
}

export function parseCalendarPendingRecord(raw = "", expectedActorHash = "", nowMs = Date.now()) {
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== CALENDAR_PENDING_SCHEMA || record.status !== "pending") return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.actor_hash || ""))) return null;
    if (expectedActorHash && record.actor_hash !== expectedActorHash) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.source_event_hash || ""))) return null;
    if (!record.draft || typeof record.draft !== "object" || Array.isArray(record.draft)) return null;
    const expiresAt = Number(record.expires_at_ms || 0);
    return {
      ...record,
      expired: !Number.isFinite(expiresAt) || expiresAt <= Number(nowMs),
    };
  } catch {
    return null;
  }
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
    pending_context: command.pending === true,
    pending_draft: command.pending ? structuredClone(command.draft || {}) : {},
    continuation: command.continuation === true,
    pending_source_event_hash: String(command.pending_source_event_hash || ""),
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
