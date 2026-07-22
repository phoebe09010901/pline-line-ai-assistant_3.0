import {
  CALENDAR_ALIAS,
  CALENDAR_TIMEZONE,
  buildCalendarCreateIdentity,
} from "./calendar-create.js";

export const CALENDAR_UPDATE_TTL_SECONDS = 600;
export const CALENDAR_UPDATE_COMMAND_PREFIX = "行事曆修改：";
export const CALENDAR_UPDATE_CONFIRM_COMMAND = "確認修改";
export const CALENDAR_UPDATE_CANCEL_COMMAND = "取消";

const ACCEPTANCE_SCHEMA = "pline-v3-calendar-update-acceptance/v1";
const ACCEPTANCE_PREFIX = "calendar_update:v1:acceptance";
const PENDING_SCHEMA = "pline-v3-calendar-update-pending/v1";
const PENDING_PREFIX = "calendar_update:v1:pending";
const FINAL_STATES = new Set([
  "final_completed",
  "final_failed",
  "delivery_ambiguous",
  "reply_rejected",
  "reply_unavailable",
]);

const CHINESE_DIGITS = Object.freeze({
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
});

function pad2(value) {
  return String(value).padStart(2, "0");
}

function chineseNumber(value) {
  const text = String(value || "").replace(/兩/g, "二").replace(/個/g, "");
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? CHINESE_DIGITS[tens] : 1) * 10 + (ones ? CHINESE_DIGITS[ones] : 0);
  }
  return Object.hasOwn(CHINESE_DIGITS, text) ? CHINESE_DIGITS[text] : Number.NaN;
}

function taipeiDate(receivedAt) {
  const parsed = new Date(receivedAt || Date.now());
  if (!Number.isFinite(parsed.getTime())) return null;
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(parsed).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday),
  };
}

function dateKey(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
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

function validDate(parts) {
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return probe.getUTCFullYear() === parts.year
    && probe.getUTCMonth() + 1 === parts.month
    && probe.getUTCDate() === parts.day;
}

function parseDateValue(text, receivedAt) {
  const base = taipeiDate(receivedAt);
  if (!base) return null;
  if (/今天/.test(text)) return dateKey(base);
  if (/明天/.test(text)) return dateKey(addDays(base, 1));
  if (/下週一|下星期一/.test(text)) {
    const days = base.weekday === 0 ? 1 : 8 - base.weekday;
    return dateKey(addDays(base, days));
  }
  const full = String(text).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (full) {
    const parts = { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]) };
    return validDate(parts) ? dateKey(parts) : null;
  }
  const partial = String(text).match(/(\d{1,2})月(\d{1,2})日/);
  if (!partial) return null;
  let parts = { year: base.year, month: Number(partial[1]), day: Number(partial[2]) };
  if (!validDate(parts)) return null;
  if (dateKey(parts) < dateKey(base)) parts = { ...parts, year: parts.year + 1 };
  return validDate(parts) ? dateKey(parts) : null;
}

function normalizeHour(period, rawHour) {
  let hour = chineseNumber(rawHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) return Number.NaN;
  if (period === "凌晨") return hour === 12 ? 0 : hour;
  if (["下午", "傍晚", "晚上"].includes(period) && hour < 12) hour += 12;
  if (period === "中午" && hour < 11) hour += 12;
  return hour === 24 ? 0 : hour;
}

function parseTimeValue(text) {
  const match = String(text).match(/(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*([0-9一二三四五六七八九十兩]{1,3})\s*(?:點|時)(?:\s*([0-5]?\d)\s*分?)?/);
  if (!match) return null;
  if (!match[1] && chineseNumber(match[2]) <= 12) return null;
  const hour = normalizeHour(match[1] || "", match[2]);
  const minute = Number(match[3] || 0);
  if (!Number.isInteger(hour) || minute > 59) return null;
  return hour * 60 + minute;
}

function parseDurationValue(text) {
  let total = 0;
  const half = String(text).match(/([0-9一二三四五六七八九十兩]+)?個?半小時/);
  if (half) total += (half[1] ? chineseNumber(half[1]) : 0) * 60 + 30;
  const hours = String(text).match(/([0-9一二三四五六七八九十兩]+)個?小時/);
  if (hours && !half) total += chineseNumber(hours[1]) * 60;
  const minutes = String(text).match(/([0-9一二三四五六七八九十兩]+)分鐘/);
  if (minutes) total += chineseNumber(minutes[1]);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function ordinal(value) {
  const result = chineseNumber(value);
  return Number.isInteger(result) && result > 0 ? result : 0;
}

function emptyPatch() {
  return {
    title: null,
    date: null,
    start_minutes: null,
    end_minutes: null,
    duration_minutes: null,
    location: null,
  };
}

export function parseCalendarUpdateChanges(text = "", receivedAt = new Date().toISOString()) {
  const input = String(text || "").trim();
  const patch = emptyPatch();
  const title = input.match(/(?:名稱|標題)\s*(?:改成|改為|：|:)\s*([^，,；;]+)/);
  if (title) patch.title = title[1].trim();
  const location = input.match(/地點\s*(?:改成|改為|：|:)\s*([^，,；;]+)/);
  if (location) patch.location = location[1].trim();
  const dateClause = input.match(/(?:日期\s*(?:改成|改為|：|:)|改到)\s*(今天|明天|下週一|下星期一|\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日)/);
  if (dateClause) patch.date = parseDateValue(dateClause[1], receivedAt);
  if (!dateClause && /^(?:今天|明天|下週一|下星期一|\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日)$/.test(input)) {
    patch.date = parseDateValue(input, receivedAt);
  }
  const start = input.match(/(?:開始(?:時間)?\s*(?:改成|改為|：|:)|改到(?:今天|明天|下週一|下星期一|\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日)?\s*)\s*((?:凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*[0-9一二三四五六七八九十兩]{1,3}\s*(?:點|時)(?:\s*[0-5]?\d\s*分?)?)/);
  if (start) patch.start_minutes = parseTimeValue(start[1]);
  const end = input.match(/(?:結束(?:時間)?\s*(?:改成|改為|：|:)|到)\s*((?:凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*[0-9一二三四五六七八九十兩]{1,3}\s*(?:點|時)(?:\s*[0-5]?\d\s*分?)?)/);
  if (end) patch.end_minutes = parseTimeValue(end[1]);
  const durationClause = input.match(/(?:持續|duration\s*[：:]?)\s*([0-9一二三四五六七八九十兩]+個?半小時|[0-9一二三四五六七八九十兩]+個?小時|[0-9一二三四五六七八九十兩]+分鐘)/i);
  if (durationClause) patch.duration_minutes = parseDurationValue(durationClause[1]);
  if (!durationClause && /^(?:[0-9一二三四五六七八九十兩]+個?半小時|[0-9一二三四五六七八九十兩]+個?小時|[0-9一二三四五六七八九十兩]+分鐘)(?:結束)?$/.test(input)) {
    patch.duration_minutes = parseDurationValue(input);
  }
  const count = Object.values(patch).filter((value) => value !== null).length;
  return { valid: count > 0, patch, reason: count > 0 ? "" : "missing_changes" };
}

function stripPrefix(text) {
  const value = String(text || "").trim();
  if (value.startsWith(CALENDAR_UPDATE_COMMAND_PREFIX)) return value.slice(CALENDAR_UPDATE_COMMAND_PREFIX.length).trim();
  if (value.startsWith("修改行事曆：")) return value.slice("修改行事曆：".length).trim();
  if (/^修改第/.test(value)) return value.slice("修改".length).trim();
  return null;
}

export function parseCalendarUpdateCommand(messageText = "", receivedAt = new Date().toISOString()) {
  const input = stripPrefix(messageText);
  if (input === null) return { matched: false, valid: false, target: {}, patch: emptyPatch(), reason: "not_calendar_update" };
  if (!input) return { matched: true, valid: false, target: {}, patch: emptyPatch(), reason: "missing_target" };
  const separator = input.search(/[｜|：:，,]/);
  const targetText = (separator >= 0 ? input.slice(0, separator) : input).trim();
  const changesText = separator >= 0 ? input.slice(separator + 1).trim() : "";
  const ordinalMatch = targetText.match(/^第?\s*([1-9]\d*|[一二三四五六七八九十兩]+)\s*(?:個|筆|項)?$/);
  const position = ordinalMatch ? ordinal(ordinalMatch[1]) : 0;
  const target = position > 0
    ? { mode: "snapshot", position, query: "" }
    : { mode: "keyword", position: 0, query: targetText.slice(0, 120) };
  const changes = parseCalendarUpdateChanges(changesText, receivedAt);
  return {
    matched: true,
    valid: Boolean(target.query || target.position),
    target,
    patch: changes.patch,
    reason: target.query || target.position ? changes.reason : "missing_target",
  };
}

export function parseCalendarUpdateContinuation(messageText = "", receivedAt = new Date().toISOString()) {
  const text = String(messageText || "").trim();
  if (text === CALENDAR_UPDATE_CONFIRM_COMMAND) return { matched: true, action: "confirm", patch: emptyPatch(), reason: "" };
  if (text === CALENDAR_UPDATE_CANCEL_COMMAND || text === "取消修改") return { matched: true, action: "cancel", patch: emptyPatch(), reason: "" };
  if (!text || stripPrefix(text) !== null) return { matched: false, action: "none", patch: emptyPatch(), reason: "" };
  const changes = parseCalendarUpdateChanges(text, receivedAt);
  return changes.valid
    ? { matched: true, action: "change", patch: changes.patch, reason: "" }
    : { matched: false, action: "none", patch: emptyPatch(), reason: changes.reason };
}

function minutesFromRfc3339(value) {
  const match = String(value || "").match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function rfc3339(date, minutes) {
  return `${date}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00+08:00`;
}

function addDateDay(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return dateKey(addDays({ year, month, day }, 1));
}

export function applyCalendarUpdatePatch(candidate = {}, patch = {}) {
  const currentDate = String(candidate.start || "").slice(0, 10);
  const date = patch.date || currentDate;
  const title = patch.title === null ? String(candidate.title || "") : String(patch.title || "").trim();
  const location = patch.location === null ? String(candidate.location || "") : String(patch.location || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return { ok: false, reason: "invalid_changes" };
  const hasTimeChange = patch.start_minutes !== null || patch.end_minutes !== null || patch.duration_minutes !== null;
  if (candidate.all_day && !hasTimeChange) {
    return {
      ok: true,
      desired: { title, location, all_day: true, date, start: date, end: addDateDay(date), timezone: CALENDAR_TIMEZONE },
    };
  }
  let startMinutes = patch.start_minutes;
  if (startMinutes === null) startMinutes = candidate.all_day ? null : minutesFromRfc3339(candidate.start);
  if (!Number.isInteger(startMinutes)) return { ok: false, reason: "missing_start" };
  const currentStart = minutesFromRfc3339(candidate.start);
  const currentEnd = minutesFromRfc3339(candidate.end);
  const currentDuration = Number.isInteger(currentStart) && Number.isInteger(currentEnd) && currentEnd > currentStart
    ? currentEnd - currentStart
    : null;
  let endMinutes = patch.end_minutes;
  if (endMinutes === null && patch.duration_minutes !== null) endMinutes = startMinutes + patch.duration_minutes;
  if (endMinutes === null && currentDuration) endMinutes = startMinutes + currentDuration;
  if (!Number.isInteger(endMinutes)) return { ok: false, reason: "missing_end_or_duration" };
  if (endMinutes <= startMinutes || endMinutes >= 24 * 60 || endMinutes - startMinutes > 10_080) {
    return { ok: false, reason: "invalid_end" };
  }
  return {
    ok: true,
    desired: {
      title,
      location,
      all_day: false,
      date,
      start: rfc3339(date, startMinutes),
      end: rfc3339(date, endMinutes),
      duration_minutes: endMinutes - startMinutes,
      timezone: CALENDAR_TIMEZONE,
    },
  };
}

export async function buildCalendarUpdateIdentity(event = {}) {
  return buildCalendarCreateIdentity(event);
}

export function calendarUpdateAcceptanceKey(safeEventHash = "") {
  return `${ACCEPTANCE_PREFIX}:${safeEventHash}`;
}

export function calendarUpdatePendingKey(actorHash = "") {
  return `${PENDING_PREFIX}:${actorHash}`;
}

export function createCalendarUpdateAcceptanceRecord({ identity, command, continuation, replyToken, receivedAt }) {
  return {
    schema: ACCEPTANCE_SCHEMA,
    status: "accepted",
    safe_event_hash: identity.safe_event_hash,
    actor_hash: identity.actor_hash,
    input_valid: command?.matched ? command.valid === true : continuation?.matched === true,
    reject_reason: command?.matched && !command.valid ? String(command.reason || "invalid_update") : "",
    command_reason: command?.matched ? String(command.reason || "") : "",
    target: command?.matched ? structuredClone(command.target || {}) : {},
    patch: command?.matched ? structuredClone(command.patch || emptyPatch()) : structuredClone(continuation?.patch || emptyPatch()),
    continuation_action: continuation?.matched ? String(continuation.action || "") : "",
    reply_token: String(replyToken || ""),
    received_at: String(receivedAt || new Date().toISOString()),
    accepted_at: new Date().toISOString(),
  };
}

export function parseCalendarUpdateAcceptanceRecord(raw = "") {
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== ACCEPTANCE_SCHEMA) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.safe_event_hash || ""))) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.actor_hash || ""))) return null;
    return record;
  } catch {
    return null;
  }
}

export function calendarUpdateRecordIsFinal(record = {}) {
  return FINAL_STATES.has(String(record.status || ""));
}

export function createCalendarUpdatePendingRecord({ identity, candidate, desired, patch, sourceSnapshotHash = "", nowMs = Date.now() }) {
  return {
    schema: PENDING_SCHEMA,
    status: desired ? "awaiting_confirmation" : "awaiting_changes",
    actor_hash: identity.actor_hash,
    source_event_hash: identity.safe_event_hash,
    source_snapshot_hash: String(sourceSnapshotHash || ""),
    event_reference: String(candidate.event_reference || ""),
    candidate: structuredClone(candidate),
    desired: desired ? structuredClone(desired) : null,
    patch: structuredClone(patch || emptyPatch()),
    created_at_ms: Number(nowMs),
    updated_at_ms: Number(nowMs),
    expires_at_ms: Number(nowMs) + CALENDAR_UPDATE_TTL_SECONDS * 1000,
  };
}

export function parseCalendarUpdatePendingRecord(raw = "", expectedActorHash = "", nowMs = Date.now()) {
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== PENDING_SCHEMA) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.actor_hash || ""))) return null;
    if (expectedActorHash && record.actor_hash !== expectedActorHash) return null;
    if (!String(record.event_reference || "") || !record.candidate) return null;
    const expiresAt = Number(record.expires_at_ms || 0);
    return { ...record, expired: !Number.isFinite(expiresAt) || expiresAt <= Number(nowMs) };
  } catch {
    return null;
  }
}

export function mergeCalendarUpdatePatch(left = {}, right = {}) {
  const merged = emptyPatch();
  for (const key of Object.keys(merged)) {
    merged[key] = right[key] !== null && right[key] !== undefined ? right[key] : (left[key] ?? null);
  }
  return merged;
}

export function buildCalendarUpdateN8nPayload(record = {}, options = {}) {
  const desired = record.desired || {};
  return {
    intent: "calendar_update",
    request_id: `calendar-update-request-${record.source_event_hash}`,
    safe_event_hash: record.source_event_hash,
    calendar_alias: CALENDAR_ALIAS,
    timezone: CALENDAR_TIMEZONE,
    event_reference: String(record.event_reference || ""),
    title: String(desired.title || ""),
    location: String(desired.location || ""),
    all_day: desired.all_day === true,
    date: String(desired.date || ""),
    start: String(desired.start || ""),
    end: String(desired.end || ""),
    readback_only: options.readbackOnly === true,
    original_title: String(record.candidate?.title || ""),
    original_location: String(record.candidate?.location || ""),
    original_all_day: record.candidate?.all_day === true,
    original_start: String(record.candidate?.start || ""),
    original_end: String(record.candidate?.end || ""),
  };
}

function normalizeBody(body) {
  if (Array.isArray(body)) return normalizeBody(body[0]);
  if (body?.json && typeof body.json === "object") return normalizeBody(body.json);
  if (body?.body && typeof body.body === "object") return normalizeBody(body.body);
  return body && typeof body === "object" ? body : {};
}

export function validateCalendarUpdateN8nResult(body, pending = {}) {
  const normalized = normalizeBody(body);
  if (normalized.request_id !== `calendar-update-request-${pending.source_event_hash}`) return { ok: false, reason: "request_id_mismatch" };
  if (normalized.intent !== "calendar_update") return { ok: false, reason: "intent_mismatch" };
  if (normalized.status !== "completed" || normalized.readback_verified !== true) {
    return { ok: false, reason: String(normalized.reason || "calendar_update_failed") };
  }
  const desired = pending.desired || {};
  if (
    normalized.title !== desired.title
    || String(normalized.location || "") !== String(desired.location || "")
    || normalized.all_day !== Boolean(desired.all_day)
    || normalized.start !== desired.start
    || normalized.end !== desired.end
  ) return { ok: false, reason: "calendar_update_readback_mismatch" };
  return { ok: true, body: normalized };
}

function display(candidate = {}) {
  if (candidate.all_day) return `${String(candidate.start).slice(0, 10)} 全天`;
  return `${String(candidate.start).slice(0, 10)} ${String(candidate.start).slice(11, 16)}–${String(candidate.end).slice(11, 16)}`;
}

export function calendarUpdateConfirmationReplyText(pending = {}) {
  const before = pending.candidate || {};
  const after = pending.desired || {};
  const beforeLocation = before.location ? `，地點 ${before.location}` : "";
  const afterLocation = after.location ? `，地點 ${after.location}` : "";
  return `請確認修改：\n原本：${before.title}，${display(before)}${beforeLocation}\n改為：${after.title}，${display(after)}${afterLocation}\n\n回覆「確認修改」或「取消」。`;
}

export function calendarUpdateSuccessReplyText(pending = {}) {
  const after = pending.desired || {};
  const location = after.location ? `\n地點：${after.location}` : "";
  return `行程已修改：${after.title}\n${display(after)}${location}`;
}

export function calendarUpdateReplyForReason(reason = "") {
  const replies = {
    missing_target: "請先搜尋行程，再用序號告訴我要修改哪一筆；也可以提供唯一的行程名稱。",
    missing_snapshot: "請先搜尋行程，再用「修改第一個」告訴我要修改哪一筆。",
    snapshot_expired: "上次行程搜尋已過期，請重新搜尋後再修改。",
    snapshot_changed: "行程搜尋結果已變動，請重新搜尋後再修改。",
    candidate_missing: "這次搜尋結果沒有該序號，請重新確認。",
    no_result: "沒有找到可安全修改的行程，Calendar 未寫入。",
    ambiguous_target: "找到多筆可能的行程，請先搜尋並用序號選擇，Calendar 未寫入。",
    missing_changes: "請告訴我要修改名稱、日期、開始或結束時間、持續多久，或地點。",
    missing_start: "請告訴我修改後幾點開始。",
    missing_end_or_duration: "請告訴我修改後幾點結束，或持續多久。",
    invalid_changes: "修改內容無法安全辨識，請重新告訴我要改哪一欄。",
    invalid_end: "修改後的結束時間不正確，請重新告訴我時間或持續多久。",
    expired: "這次行程修改已逾時，請重新搜尋後再修改。",
    cancelled: "已取消這次行程修改。",
    missing_pending: "目前沒有等待確認的行程修改。",
    failed: "這次沒有成功修改行程，我先停在安全狀態。",
  };
  return replies[reason] || replies.invalid_changes;
}
