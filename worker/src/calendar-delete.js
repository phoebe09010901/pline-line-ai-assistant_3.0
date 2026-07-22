import {
  CALENDAR_ALIAS,
  CALENDAR_TIMEZONE,
  buildCalendarCreateIdentity,
} from "./calendar-create.js";

export const CALENDAR_DELETE_TTL_SECONDS = 600;
export const CALENDAR_DELETE_COMMAND_PREFIX = "行事曆刪除：";
export const CALENDAR_DELETE_CONFIRM_COMMAND = "確認刪除";
export const CALENDAR_DELETE_CANCEL_COMMAND = "取消";

const ACCEPTANCE_SCHEMA = "pline-v3-calendar-delete-acceptance/v1";
const ACCEPTANCE_PREFIX = "calendar_delete:v1:acceptance";
const PENDING_SCHEMA = "pline-v3-calendar-delete-pending/v1";
const PENDING_PREFIX = "calendar_delete:v1:pending";
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

function chineseNumber(value) {
  const text = String(value || "").replace(/兩/g, "二").replace(/個|筆|項/g, "");
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? CHINESE_DIGITS[tens] : 1) * 10 + (ones ? CHINESE_DIGITS[ones] : 0);
  }
  return Object.hasOwn(CHINESE_DIGITS, text) ? CHINESE_DIGITS[text] : Number.NaN;
}

function stripPrefix(text) {
  const value = String(text || "").trim();
  if (/備忘錄|memo/i.test(value)) return null;
  for (const prefix of [CALENDAR_DELETE_COMMAND_PREFIX, "刪除行事曆：", "行事曆刪除:", "刪除行事曆:"]) {
    if (value.startsWith(prefix)) return value.slice(prefix.length).trim();
  }
  if (/^刪除第/.test(value)) return value.slice("刪除".length).trim();
  return null;
}

export function parseCalendarDeleteCommand(messageText = "") {
  const raw = String(messageText || "").trim();
  const explicitCalendar = /^(?:行事曆刪除|刪除行事曆)[：:]/.test(raw);
  const input = stripPrefix(raw);
  if (input === null) return { matched: false, valid: false, explicit_calendar: false, target: {}, reason: "not_calendar_delete" };
  if (!input) return { matched: true, valid: false, explicit_calendar: explicitCalendar, target: {}, reason: "missing_target" };
  if (/^(?:全部|所有|全部行程|所有行程|全日曆|整個日曆|清空(?:行事曆|日曆)?)$/.test(input)) {
    return { matched: true, valid: false, explicit_calendar: explicitCalendar, target: {}, reason: "unbounded_delete_disallowed" };
  }
  const ordinalMatch = input.match(/^第?\s*([1-9]\d*|[一二三四五六七八九十兩]+)\s*(?:個|筆|項)?$/);
  if (!explicitCalendar && !ordinalMatch) {
    return { matched: false, valid: false, explicit_calendar: false, target: {}, reason: "not_calendar_delete" };
  }
  const position = ordinalMatch ? chineseNumber(ordinalMatch[1]) : 0;
  const target = Number.isInteger(position) && position > 0
    ? { mode: "snapshot", position, query: "" }
    : { mode: "keyword", position: 0, query: input.slice(0, 120) };
  return { matched: true, valid: Boolean(target.position || target.query), explicit_calendar: explicitCalendar, target, reason: "" };
}

export function parseCalendarDeleteContinuation(messageText = "") {
  const text = String(messageText || "").trim();
  if (text === CALENDAR_DELETE_CONFIRM_COMMAND) return { matched: true, action: "confirm" };
  if ([CALENDAR_DELETE_CANCEL_COMMAND, "取消刪除", "不要刪", "不要刪除"].includes(text)) {
    return { matched: true, action: "cancel" };
  }
  return { matched: false, action: "none" };
}

export async function buildCalendarDeleteIdentity(event = {}) {
  return buildCalendarCreateIdentity(event);
}

export function calendarDeleteAcceptanceKey(safeEventHash = "") {
  return `${ACCEPTANCE_PREFIX}:${safeEventHash}`;
}

export function calendarDeletePendingKey(actorHash = "") {
  return `${PENDING_PREFIX}:${actorHash}`;
}

export function createCalendarDeleteAcceptanceRecord({ identity, command, continuation, replyToken, receivedAt }) {
  return {
    schema: ACCEPTANCE_SCHEMA,
    status: "accepted",
    safe_event_hash: identity.safe_event_hash,
    actor_hash: identity.actor_hash,
    input_valid: command?.matched ? command.valid === true : continuation?.matched === true,
    reject_reason: command?.matched && !command.valid ? String(command.reason || "invalid_delete") : "",
    target: command?.matched ? structuredClone(command.target || {}) : {},
    continuation_action: continuation?.matched ? String(continuation.action || "") : "",
    reply_token: String(replyToken || ""),
    received_at: String(receivedAt || new Date().toISOString()),
    accepted_at: new Date().toISOString(),
  };
}

export function parseCalendarDeleteAcceptanceRecord(raw = "") {
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

export function calendarDeleteRecordIsFinal(record = {}) {
  return FINAL_STATES.has(String(record.status || ""));
}

export function createCalendarDeletePendingRecord({ identity, candidate, sourceSnapshotHash = "", nowMs = Date.now() }) {
  return {
    schema: PENDING_SCHEMA,
    status: "awaiting_confirmation",
    actor_hash: identity.actor_hash,
    source_event_hash: identity.safe_event_hash,
    source_snapshot_hash: String(sourceSnapshotHash || ""),
    event_reference: String(candidate.event_reference || ""),
    candidate: structuredClone(candidate),
    created_at_ms: Number(nowMs),
    expires_at_ms: Number(nowMs) + CALENDAR_DELETE_TTL_SECONDS * 1000,
  };
}

export function parseCalendarDeletePendingRecord(raw = "", expectedActorHash = "", nowMs = Date.now()) {
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

export function buildCalendarDeleteN8nPayload(record = {}, options = {}) {
  return {
    intent: "calendar_delete",
    request_id: `calendar-delete-request-${record.source_event_hash}`,
    safe_event_hash: record.source_event_hash,
    calendar_alias: CALENDAR_ALIAS,
    timezone: CALENDAR_TIMEZONE,
    event_reference: String(record.event_reference || ""),
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

export function validateCalendarDeleteN8nResult(body, pending = {}) {
  const normalized = normalizeBody(body);
  if (normalized.request_id !== `calendar-delete-request-${pending.source_event_hash}`) return { ok: false, reason: "request_id_mismatch" };
  if (normalized.intent !== "calendar_delete") return { ok: false, reason: "intent_mismatch" };
  if (normalized.status !== "completed" || normalized.readback_verified !== true || normalized.exists !== false) {
    return { ok: false, reason: String(normalized.reason || "calendar_delete_failed") };
  }
  return { ok: true, body: normalized };
}

function display(candidate = {}) {
  if (candidate.all_day) return `${String(candidate.start).slice(0, 10)} 全天`;
  return `${String(candidate.start).slice(0, 10)} ${String(candidate.start).slice(11, 16)}–${String(candidate.end).slice(11, 16)}`;
}

export function calendarDeleteConfirmationReplyText(pending = {}) {
  const candidate = pending.candidate || {};
  const location = candidate.location ? `\n地點：${candidate.location}` : "";
  return `請確認刪除：\n${candidate.title}\n${display(candidate)}${location}\n\n回覆「確認刪除」或「取消」。`;
}

export function calendarDeleteSuccessReplyText(pending = {}) {
  const candidate = pending.candidate || {};
  return `行程已刪除：${candidate.title}\n${display(candidate)}`;
}

export function calendarDeleteReplyForReason(reason = "") {
  const replies = {
    missing_target: "請先搜尋行程，再用序號告訴我要刪除哪一筆；也可以提供唯一的行程名稱。",
    unbounded_delete_disallowed: "我不能清空整本行事曆。請先搜尋，再用序號選擇要刪除的行程。",
    missing_snapshot: "請先搜尋行程，再用「刪除第一個」告訴我要刪除哪一筆。",
    snapshot_expired: "上次行程搜尋已過期，請重新搜尋後再刪除。",
    snapshot_changed: "行程搜尋結果已變動，請重新搜尋後再刪除。",
    candidate_missing: "這次搜尋結果沒有該序號，請重新確認。",
    no_result: "沒有找到可安全刪除的行程，Calendar 未刪除。",
    ambiguous_target: "找到多筆可能的行程，請先搜尋並用序號選擇，Calendar 未刪除。",
    expired: "這次行程刪除已逾時，請重新搜尋後再刪除。",
    cancelled: "已取消這次行程刪除。",
    missing_pending: "目前沒有等待確認的行程刪除。",
    failed: "這次沒有成功刪除行程，我先停在安全狀態。",
  };
  return replies[reason] || replies.failed;
}
