import {
  CALENDAR_ALIAS,
  CALENDAR_TIMEZONE,
  buildCalendarCreateIdentity,
} from "./calendar-create.js";

export const CALENDAR_SEARCH_TTL_SECONDS = 600;
export const CALENDAR_SEARCH_MAX_RESULTS = 10;
export const CALENDAR_SEARCH_COMMAND_PREFIX = "行事曆搜尋：";

const SEARCH_ACCEPTANCE_SCHEMA = "pline-v3-calendar-search-acceptance/v1";
const SEARCH_ACCEPTANCE_PREFIX = "calendar_search:v1:acceptance";
const SEARCH_SNAPSHOT_SCHEMA = "pline-v3-calendar-search-snapshot/v1";
const SEARCH_SNAPSHOT_PREFIX = "calendar_search:v1:snapshot";
const FINAL_STATES = new Set(["final_completed", "final_failed", "delivery_ambiguous", "reply_rejected", "reply_unavailable"]);

const CHINESE_DIGITS = Object.freeze({
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
});

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateKey(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function chineseNumber(value) {
  const text = String(value || "").replace(/兩/g, "二");
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? CHINESE_DIGITS[tens] : 1) * 10 + (ones ? CHINESE_DIGITS[ones] : 0);
  }
  return Object.hasOwn(CHINESE_DIGITS, text) ? CHINESE_DIGITS[text] : Number.NaN;
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

function taipeiDateParts(receivedAt) {
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

function rfc3339(parts, minutes = 0) {
  return `${dateKey(parts)}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00+08:00`;
}

function parseDateToken(text, receivedAt) {
  const base = taipeiDateParts(receivedAt);
  if (!base) return null;
  if (text.includes("今天")) return { parts: base, token: "今天", scope: "today" };
  if (text.includes("明天")) return { parts: addDays(base, 1), token: "明天", scope: "tomorrow" };
  const full = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (full) {
    const parts = { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]) };
    return validDate(parts) ? { parts, token: full[0], scope: "date" } : null;
  }
  const partial = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (partial) {
    let parts = { year: base.year, month: Number(partial[1]), day: Number(partial[2]) };
    if (!validDate(parts)) return null;
    if (dateKey(parts) < dateKey(base)) parts = { ...parts, year: base.year + 1 };
    return validDate(parts) ? { parts, token: partial[0], scope: "date" } : null;
  }
  return null;
}

function normalizeHour(period, rawHour) {
  let hour = chineseNumber(rawHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) return Number.NaN;
  if (period === "凌晨") return hour === 12 ? 0 : hour;
  if (["下午", "傍晚", "晚上"].includes(period) && hour < 12) hour += 12;
  if (period === "中午" && hour < 11) hour += 12;
  return hour === 24 ? 0 : hour;
}

function parseTimeRange(text) {
  const pattern = /(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*([0-9一二三四五六七八九十兩]{1,3})\s*(?:點|時)(?:\s*([0-5]?\d)\s*分?)?/g;
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length === 0) return null;
  const firstPeriod = matches[0][1] || "";
  const firstRaw = chineseNumber(matches[0][2]);
  if (!firstPeriod && firstRaw <= 12) return { invalid: true };
  const startHour = normalizeHour(firstPeriod, matches[0][2]);
  const startMinute = Number(matches[0][3] || 0);
  if (!Number.isInteger(startHour) || startMinute > 59) return { invalid: true };
  const startMinutes = startHour * 60 + startMinute;
  if (matches.length === 1) return { startMinutes, endMinutes: Math.min(startMinutes + 60, 24 * 60), tokens: [matches[0][0]] };
  const endPeriod = matches[1][1] || firstPeriod;
  let endHour = normalizeHour(endPeriod, matches[1][2]);
  const endMinute = Number(matches[1][3] || 0);
  let endMinutes = endHour * 60 + endMinute;
  if (!matches[1][1] && chineseNumber(matches[1][2]) <= 12 && endMinutes <= startMinutes) endMinutes += 12 * 60;
  if (!Number.isInteger(endHour) || endMinute > 59 || endMinutes <= startMinutes || endMinutes > 24 * 60) return { invalid: true };
  return { startMinutes, endMinutes, tokens: [matches[0][0], matches[1][0]] };
}

function stripSearchPrefix(messageText) {
  const text = String(messageText || "").trim();
  if (text.startsWith(CALENDAR_SEARCH_COMMAND_PREFIX)) return text.slice(CALENDAR_SEARCH_COMMAND_PREFIX.length).trim();
  const compact = text.match(/^(?:搜尋|查詢)(?:行事曆)?\s*[：:]?\s*(.+)$/);
  return compact ? compact[1].trim() : null;
}

export function parseCalendarSearchCommand(messageText = "", receivedAt = new Date().toISOString()) {
  const input = stripSearchPrefix(messageText);
  if (input === null) return { matched: false, valid: false, reason: "not_calendar_search", fields: {} };
  if (!input) return { matched: true, valid: false, reason: "empty_search", fields: {} };
  const base = taipeiDateParts(receivedAt);
  if (!base) return { matched: true, valid: false, reason: "invalid_date", fields: {} };

  if (["本週", "這週", "本星期"].includes(input)) {
    const daysFromMonday = base.weekday === 0 ? 6 : base.weekday - 1;
    const start = addDays(base, -daysFromMonday);
    return {
      matched: true,
      valid: true,
      reason: "",
      fields: {
        scope: "week",
        query: "",
        time_min: rfc3339(start),
        time_max: rfc3339(addDays(start, 7)),
        label: "本週",
        timezone: CALENDAR_TIMEZONE,
      },
    };
  }

  const date = parseDateToken(input, receivedAt);
  if (date) {
    const time = parseTimeRange(input);
    if (time?.invalid) return { matched: true, valid: false, reason: "ambiguous_time", fields: {} };
    const timeMin = rfc3339(date.parts, time?.startMinutes || 0);
    const timeMax = time
      ? rfc3339(time.endMinutes === 24 * 60 ? addDays(date.parts, 1) : date.parts, time.endMinutes === 24 * 60 ? 0 : time.endMinutes)
      : rfc3339(addDays(date.parts, 1));
    return {
      matched: true,
      valid: true,
      reason: "",
      fields: {
        scope: time ? "date_time" : date.scope,
        query: "",
        time_min: timeMin,
        time_max: timeMax,
        label: time ? `${dateKey(date.parts)} ${pad2(Math.floor(time.startMinutes / 60))}:${pad2(time.startMinutes % 60)}–${pad2(Math.floor(time.endMinutes / 60) % 24)}:${pad2(time.endMinutes % 60)}` : dateKey(date.parts),
        timezone: CALENDAR_TIMEZONE,
      },
    };
  }

  if (/(?:\d{1,2}[\/-]\d{1,2}|本週.|今天.|明天.)/.test(input) && !/^[^\d]*$/.test(input)) {
    return { matched: true, valid: false, reason: "invalid_date", fields: {} };
  }
  return {
    matched: true,
    valid: true,
    reason: "",
    fields: {
      scope: "keyword",
      query: input.slice(0, 120),
      time_min: "",
      time_max: "",
      label: `關鍵字「${input.slice(0, 40)}」`,
      timezone: CALENDAR_TIMEZONE,
    },
  };
}

export function parseCalendarSearchSelection(messageText = "") {
  const text = String(messageText || "").trim();
  const match = text.match(/^第\s*([1-9]\d*|一|二|三|四|五|六|七|八|九|十)\s*(?:個|筆|項)$/);
  if (!match) return { matched: false, position: 0 };
  const position = chineseNumber(match[1]);
  return Number.isInteger(position) && position > 0
    ? { matched: true, position }
    : { matched: false, position: 0 };
}

export async function buildCalendarSearchIdentity(event = {}) {
  return buildCalendarCreateIdentity(event);
}

export function calendarSearchAcceptanceKey(safeEventHash = "") {
  return `${SEARCH_ACCEPTANCE_PREFIX}:${safeEventHash}`;
}

export function calendarSearchSnapshotKey(actorHash = "") {
  return `${SEARCH_SNAPSHOT_PREFIX}:${actorHash}`;
}

export function createCalendarSearchAcceptanceRecord({ identity, command, selection, replyToken, receivedAt }) {
  return {
    schema: SEARCH_ACCEPTANCE_SCHEMA,
    status: "accepted",
    safe_event_hash: identity.safe_event_hash,
    actor_hash: identity.actor_hash,
    input_valid: command?.valid === true || selection?.matched === true,
    reject_reason: command?.matched && !command.valid ? String(command.reason || "invalid_search") : "",
    canonical: command?.valid ? structuredClone(command.fields) : {},
    selection_position: selection?.matched ? Number(selection.position) : 0,
    reply_token: String(replyToken || ""),
    received_at: String(receivedAt || new Date().toISOString()),
    accepted_at: new Date().toISOString(),
  };
}

export function parseCalendarSearchAcceptanceRecord(raw = "") {
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== SEARCH_ACCEPTANCE_SCHEMA) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.safe_event_hash || ""))) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.actor_hash || ""))) return null;
    return record;
  } catch {
    return null;
  }
}

export function calendarSearchRecordIsFinal(record = {}) {
  return FINAL_STATES.has(String(record.status || ""));
}

export function buildCalendarSearchN8nPayload(record = {}) {
  return {
    intent: "calendar_search",
    request_id: `calendar-search-request-${record.safe_event_hash}`,
    safe_event_hash: record.safe_event_hash,
    calendar_alias: CALENDAR_ALIAS,
    timezone: CALENDAR_TIMEZONE,
    scope: String(record.canonical?.scope || ""),
    query: String(record.canonical?.query || ""),
    time_min: String(record.canonical?.time_min || ""),
    time_max: String(record.canonical?.time_max || ""),
    max_results: CALENDAR_SEARCH_MAX_RESULTS,
  };
}

function normalizeN8nBody(body) {
  if (Array.isArray(body)) return normalizeN8nBody(body[0]);
  if (body?.json && typeof body.json === "object") return normalizeN8nBody(body.json);
  if (body?.body && typeof body.body === "object") return normalizeN8nBody(body.body);
  return body && typeof body === "object" ? body : {};
}

function normalizeCandidate(candidate = {}) {
  const eventReference = String(candidate.event_reference || "");
  const title = String(candidate.title || "").trim();
  const start = String(candidate.start || "");
  const end = String(candidate.end || "");
  const allDay = candidate.all_day === true;
  if (!eventReference || eventReference.length > 1024 || !title || title.length > 200) return null;
  if (allDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  } else if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
    return null;
  }
  return {
    event_reference: eventReference,
    title,
    location: String(candidate.location || "").trim().slice(0, 200),
    all_day: allDay,
    start,
    end,
  };
}

export function validateCalendarSearchN8nResult(body, record = {}) {
  const normalized = normalizeN8nBody(body);
  if (normalized.request_id !== `calendar-search-request-${record.safe_event_hash}`) return { ok: false, reason: "request_id_mismatch" };
  if (normalized.intent !== "calendar_search") return { ok: false, reason: "intent_mismatch" };
  if (normalized.status !== "completed" || normalized.read_only !== true) return { ok: false, reason: String(normalized.reason || "calendar_search_failed") };
  if (!Array.isArray(normalized.candidates) || normalized.candidates.length > CALENDAR_SEARCH_MAX_RESULTS) return { ok: false, reason: "invalid_candidates" };
  const candidates = normalized.candidates.map(normalizeCandidate);
  if (candidates.some((item) => item === null)) return { ok: false, reason: "invalid_candidate" };
  return { ok: true, candidates, total: candidates.length };
}

export function createCalendarSearchSnapshot({ identity, candidates, nowMs = Date.now() }) {
  return {
    schema: SEARCH_SNAPSHOT_SCHEMA,
    actor_hash: identity.actor_hash,
    source_event_hash: identity.safe_event_hash,
    candidates: structuredClone(candidates),
    created_at_ms: Number(nowMs),
    expires_at_ms: Number(nowMs) + CALENDAR_SEARCH_TTL_SECONDS * 1000,
  };
}

export function parseCalendarSearchSnapshot(raw = "", expectedActorHash = "", nowMs = Date.now()) {
  try {
    const record = JSON.parse(raw);
    if (record?.schema !== SEARCH_SNAPSHOT_SCHEMA) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.actor_hash || ""))) return null;
    if (expectedActorHash && record.actor_hash !== expectedActorHash) return null;
    if (!/^[a-f0-9]{64}$/.test(String(record.source_event_hash || ""))) return null;
    if (!Array.isArray(record.candidates) || record.candidates.length > CALENDAR_SEARCH_MAX_RESULTS) return null;
    const candidates = record.candidates.map(normalizeCandidate);
    if (candidates.some((item) => item === null)) return null;
    const expiresAt = Number(record.expires_at_ms || 0);
    return { ...record, candidates, expired: !Number.isFinite(expiresAt) || expiresAt <= Number(nowMs) };
  } catch {
    return null;
  }
}

function displayDateTime(candidate) {
  if (candidate.all_day) return `${candidate.start} 全天`;
  return `${candidate.start.slice(0, 10)} ${candidate.start.slice(11, 16)}–${candidate.end.slice(11, 16)}`;
}

export function calendarSearchReplyText(candidates = []) {
  if (candidates.length === 0) return "沒有找到符合的行程。";
  const lines = candidates.map((candidate, index) => {
    const location = candidate.location ? `\n地點：${candidate.location}` : "";
    return `${index + 1}. ${candidate.title}\n${displayDateTime(candidate)}${location}`;
  });
  return `找到 ${candidates.length} 筆行程：\n${lines.join("\n\n")}\n\n可以回覆「第一個」或「第二個」查看。`;
}

export function calendarSearchSelectionReplyText(snapshot, position) {
  if (!snapshot || snapshot.expired) return "上次行程搜尋已過期，請重新搜尋。";
  const candidate = snapshot.candidates[position - 1];
  if (!candidate) return "這次搜尋結果沒有該序號，請重新確認。";
  const location = candidate.location ? `\n地點：${candidate.location}` : "";
  return `第 ${position} 筆行程：${candidate.title}\n${displayDateTime(candidate)}${location}`;
}

export function calendarSearchValidationReplyText(reason = "") {
  if (reason === "empty_search") return "請在「行事曆搜尋：」後面輸入今天、明天、本週、日期或名稱關鍵字。";
  if (reason === "ambiguous_time") return "搜尋時間有點不確定，請說明上午、下午或使用 24 小時制。";
  if (reason === "missing_snapshot") return "請先搜尋行程，再回覆「第一個」或「第二個」。";
  return "搜尋日期無法安全辨識，請告訴我完整日期。";
}

export function calendarSearchFailureReplyText() {
  return "這次沒有成功搜尋行程，請稍後再試一次。";
}
