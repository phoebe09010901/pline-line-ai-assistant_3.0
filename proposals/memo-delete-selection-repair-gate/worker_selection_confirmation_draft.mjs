const MEMO_ID_PATTERN = /^memo-[a-f0-9]{64}$/;
const MAX_SELECTION_ITEMS = 5;
const CONFIRMATION_TTL_SECONDS = 600;
const NO_SNAPSHOT_REPLY = "妳想刪除哪些備忘錄？請先搜尋，或告訴我關鍵字／日期。";

function result(valid, fields = {}, reason = "") {
  return { matched: true, valid, fields: valid ? fields : {}, reason: valid ? "" : reason };
}

function chineseNumber(value = "") {
  const raw = String(value || "").trim();
  if (/^[1-9]\d*$/.test(raw)) return Number(raw);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (raw === "十") return 10;
  if (raw.length === 1 && digits[raw]) return digits[raw];
  const match = raw.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/);
  if (!match) return NaN;
  return (match[1] ? digits[match[1]] : 1) * 10 + (match[2] ? digits[match[2]] : 0);
}

function commandBody(messageText = "") {
  let text = String(messageText || "").trim();
  if (text.startsWith("備忘錄刪除：")) text = text.slice("備忘錄刪除：".length).trim();
  else if (text.startsWith("刪除")) text = text.slice("刪除".length).trim();
  else return null;
  return text.replace(/\s+/g, "");
}

export function parseDeleteSelectionCommand(messageText = "") {
  const body = commandBody(messageText);
  if (body === null) return { matched: false, valid: false, fields: {}, reason: "not_delete_selection" };
  if (/^(?:這次搜尋(?:結果)?的)?全部(?:備忘錄)?$/.test(body)) {
    return result(true, { selection_mode: "all", selection_indices: [] });
  }

  const token = "(?:[1-9]\\d*|[一二三四五六七八九十]+)";
  const range = body.match(new RegExp(`^第?(${token})筆?(?:到|至|-|～|~)第?(${token})筆(?:備忘錄)?$`));
  if (range) {
    const start = chineseNumber(range[1]);
    const end = chineseNumber(range[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
      return result(false, {}, "invalid_selection_range");
    }
    const indices = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    if (indices.length > MAX_SELECTION_ITEMS) return result(false, {}, "selection_too_large");
    return result(true, { selection_mode: "range", selection_indices: indices });
  }

  const list = body.match(new RegExp(`^第?(${token}(?:[、,，]${token})+)筆(?:備忘錄)?$`));
  if (list) {
    const indices = [...new Set(list[1].split(/[、,，]/).map(chineseNumber))].sort((a, b) => a - b);
    if (indices.some((value) => !Number.isSafeInteger(value))) return result(false, {}, "invalid_selection_format");
    if (indices.length > MAX_SELECTION_ITEMS) return result(false, {}, "selection_too_large");
    return result(true, { selection_mode: indices.length === 1 ? "single" : "multiple", selection_indices: indices });
  }

  const single = body.match(new RegExp(`^第?(${token})筆(?:備忘錄)?$`));
  if (single) {
    const index = chineseNumber(single[1]);
    if (!Number.isSafeInteger(index)) return result(false, {}, "invalid_selection_format");
    return result(true, { selection_mode: "single", selection_indices: [index] });
  }
  return result(false, {}, "invalid_selection_format");
}

export function createSearchSnapshot({ scopeHash, version, candidates, nowMs = Date.now(), ttlSeconds = CONFIRMATION_TTL_SECONDS }) {
  return {
    schema: "pline-v3-memo-search-selection-repair-draft/v1",
    scope_hash: String(scopeHash || ""),
    version: String(version || ""),
    candidates: (candidates || []).map((candidate, index) => ({
      position: index + 1,
      memo_id: String(candidate.memo_id || ""),
      summary: String(candidate.summary || "").replace(/memo-[a-f0-9]{64}/gi, "").trim(),
    })),
    created_at_ms: Number(nowMs),
    expires_at_ms: Number(nowMs) + (Number(ttlSeconds) * 1000),
  };
}

function validSnapshot(snapshot, scopeHash, nowMs) {
  return Boolean(
    snapshot
    && snapshot.schema === "pline-v3-memo-search-selection-repair-draft/v1"
    && snapshot.scope_hash === scopeHash
    && Number(snapshot.expires_at_ms) > Number(nowMs)
    && Array.isArray(snapshot.candidates)
    && snapshot.candidates.length > 0
    && snapshot.candidates.every((candidate, index) => (
      candidate.position === index + 1
      && MEMO_ID_PATTERN.test(candidate.memo_id)
      && typeof candidate.summary === "string"
      && candidate.summary.length > 0
      && !candidate.summary.includes(candidate.memo_id)
    ))
  );
}

export function prepareDeleteSelection({ commandText, snapshot, scopeHash, nowMs = Date.now() }) {
  const parsed = parseDeleteSelectionCommand(commandText);
  if (!parsed.matched || !parsed.valid) {
    return { ok: false, reason: parsed.reason || "invalid_selection_format", external_effect_count: 0 };
  }
  if (!snapshot) {
    return { ok: false, reason: "selection_snapshot_missing", reply_text: NO_SNAPSHOT_REPLY, external_effect_count: 0 };
  }
  if (!validSnapshot(snapshot, scopeHash, nowMs)) {
    const expired = snapshot?.scope_hash === scopeHash && Number(snapshot?.expires_at_ms) <= Number(nowMs);
    return { ok: false, reason: expired ? "selection_snapshot_expired" : "selection_snapshot_invalid", external_effect_count: 0 };
  }

  const indices = parsed.fields.selection_mode === "all"
    ? snapshot.candidates.map((candidate) => candidate.position)
    : parsed.fields.selection_indices;
  if (indices.length > MAX_SELECTION_ITEMS) {
    return { ok: false, reason: "selection_too_large", external_effect_count: 0 };
  }
  if (indices.some((index) => !Number.isSafeInteger(index) || index < 1 || index > snapshot.candidates.length)) {
    return { ok: false, reason: "selection_index_out_of_range", external_effect_count: 0 };
  }
  const selected = indices.map((index) => snapshot.candidates[index - 1]);
  const expiresAtMs = Math.min(Number(snapshot.expires_at_ms), Number(nowMs) + (CONFIRMATION_TTL_SECONDS * 1000));
  const pending = {
    schema: "pline-v3-memo-delete-confirmation-draft/v1",
    status: "waiting_confirmation",
    scope_hash: scopeHash,
    snapshot_version: snapshot.version,
    selection_mode: parsed.fields.selection_mode,
    selected: selected.map(({ position, memo_id, summary }) => ({ position, memo_id, summary })),
    created_at_ms: Number(nowMs),
    expires_at_ms: expiresAtMs,
    consumed_at_ms: null,
  };
  const safeLines = selected.map((candidate) => `${candidate.position}. ${candidate.summary}`).join("\n");
  return {
    ok: true,
    status: "waiting_confirmation",
    pending,
    reply_text: `即將刪除 ${selected.length} 筆備忘錄：\n${safeLines}\n請回覆「確認刪除」或「取消」。`,
    external_effect_count: 0,
  };
}

export function confirmDeleteSelection({ text, pending, currentSnapshot, scopeHash, nowMs = Date.now() }) {
  if (String(text || "").trim() === "取消") {
    return { ok: true, status: "cancelled", pending: { ...pending, status: "cancelled" }, external_effect_count: 0 };
  }
  if (String(text || "").trim() !== "確認刪除") {
    return { ok: false, reason: "confirmation_phrase_invalid", external_effect_count: 0 };
  }
  if (!pending || pending.status !== "waiting_confirmation") {
    return { ok: false, reason: pending?.status === "consumed" ? "confirmation_already_consumed" : "confirmation_missing", external_effect_count: 0 };
  }
  if (pending.scope_hash !== scopeHash) return { ok: false, reason: "actor_scope_mismatch", external_effect_count: 0 };
  if (Number(pending.expires_at_ms) <= Number(nowMs)) return { ok: false, reason: "confirmation_expired", external_effect_count: 0 };
  if (!validSnapshot(currentSnapshot, scopeHash, nowMs) || currentSnapshot.version !== pending.snapshot_version) {
    return { ok: false, reason: "selection_snapshot_changed", external_effect_count: 0 };
  }
  const unchanged = pending.selected.every((selected) => {
    const current = currentSnapshot.candidates[selected.position - 1];
    return current && current.memo_id === selected.memo_id;
  });
  if (!unchanged) return { ok: false, reason: "selection_candidate_changed", external_effect_count: 0 };

  const consumed = { ...pending, status: "consumed", consumed_at_ms: Number(nowMs) };
  return {
    ok: true,
    status: "dispatch_authorized",
    pending: consumed,
    dispatch: {
      intent: "memo_delete",
      delete_scope: "memo_search_selection_snapshot",
      selection_mode: pending.selection_mode,
      selection_snapshot_version: pending.snapshot_version,
      memo_ids: pending.selected.map((candidate) => candidate.memo_id),
    },
    external_effect_count: 0,
  };
}

export function finalizeDeleteOnce({ prior = null, expectedCount = 0, successCount = 0, failureReason = "safe_preflight_failed" }) {
  if (prior?.status === "final_sent") {
    return { ok: true, status: "already_finalized", reply_required: false, duplicate_final_count: 0 };
  }
  const expected = Number(expectedCount);
  const success = Number(successCount);
  const failed = Math.max(0, expected - success);
  const replyText = failed === 0
    ? `預計 ${expected} 筆，成功 ${success} 筆，未刪除 0 筆。`
    : `預計 ${expected} 筆，成功 ${success} 筆，未刪除 ${failed} 筆（${failureReason}）。`;
  return {
    ok: true,
    status: "final_sent",
    reply_required: true,
    reply_text: replyText,
    record: { status: "final_sent", expected_count: expected, success_count: success, failed_count: failed },
    duplicate_final_count: 0,
  };
}

export const draftContract = Object.freeze({
  confirmation_ttl_seconds: CONFIRMATION_TTL_SECONDS,
  max_selection_items: MAX_SELECTION_ITEMS,
  confirmation_phrase: "確認刪除",
  cancel_phrase: "取消",
  no_snapshot_reply: NO_SNAPSHOT_REPLY,
  external_execution: false,
});
