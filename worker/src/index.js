import {
  CALENDAR_ALIAS,
  CALENDAR_CREATE_TTL_SECONDS,
  CALENDAR_TIMEZONE,
  buildCalendarCreateIdentity,
  buildCalendarCreateN8nPayload,
  calendarAcceptanceKey,
  calendarFailureReplyText,
  calendarPendingKey,
  calendarRecordIsFinal,
  calendarSuccessReplyText,
  calendarValidationReplyText,
  createCalendarAcceptanceRecord,
  createCalendarPendingRecord,
  mergeCalendarCreateContinuation,
  parseCalendarAcceptanceRecord,
  parseCalendarCreateCommand,
  parseCalendarCreateContinuation,
  parseCalendarPendingRecord,
  validateCalendarCreateN8nResult,
} from "./calendar-create.js";

const WORKER_NAME = "pline-v3-test-line-gateway";
const RUNTIME_KV_NAME = "pline-v3-test-runtime";
const IDEMPOTENCY_KV_NAME = "pline-v3-test-idempotency";
const D1_NAME = "pline-v3-test-db";
const N8N_WEBHOOK_URL = "https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent";
const N8N_SHARED_SECRET_HEADER = "x-pline-v3-shared-secret";
const MEMO_CALLBACK_SECRET_HEADER = "x-pline-v3-memo-callback-secret";
const EVIDENCE_SELFTEST_SECRET_HEADER = "x-pline-v3-selftest-secret";
const ACCEPTED_N8N_INTENTS = ["idea_create", "codex_task", "clarify", "unsupported"];
const GATE_TEST_INTENTS = ["idea_create", "codex_task"];
const ADMIN_BOOTSTRAP_SENTINEL = "CAPTURE_CURRENT_03_EVENT";
const ADMIN_BOOTSTRAP_PHRASE = "PLine03 admin bootstrap";
const ADMIN_BOOTSTRAP_KV_KEY = "admin:line_test_admin_user_id";
const SAFE_REPLY_TEXT = {
  clarify: "請再補充一句你想記錄或請 Codex 執行的內容。",
  unsupported: "目前我只能先幫妳記想法，或處理指定的小任務。",
};
const LINE_REPLY_MODE = "no_visible_ack_background_n8n";
const CODEX_TASK_FINAL_MODE = "monitor_callback_exactly_once";
const LINE_FINAL_DELIVERY_VERSION = "line-reply-first-push-fallback-v1";
const LINE_FINAL_DELIVERY_RETRY_VERSION = "line-final-delivery-429-retry-v1";
const LINE_FINAL_DELIVERY_MAX_ATTEMPTS = 2;
const LINE_FINAL_DELIVERY_DEFAULT_RETRY_AFTER_SECONDS = 60;
const LINE_REPLY_ELIGIBILITY_WINDOW_MS = 55_000;
const LINE_REPLY_TIMEOUT_MS = 1_800;
const CODEX_TASK_PREFIX = "codex_task:v1";
const IDEA_TASK_PREFIX = "idea_json:v1";
const MONITOR_WAKE_KEY = "monitor:wake:v1";
const MONITOR_WAKE_SCHEMA = "pline-v3-test-monitor-wake/v1";
const CODEX_MONITOR_NAME = "pline-v3-test-codex-monitor";
const CODEX_TASK_ACTION = "create_smoke_file";
const IDEA_TASK_ACTION = "save_idea_json";
const PROJECT_ROOT = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03";
const CODEX_TASK_PROJECT = "PLine03 safe smoke";
const CODEX_TASK_PROJECT_PATH = `${PROJECT_ROOT}/runtime/codex-task-smoke`;
const CODEX_TASK_SMOKE_FILE_PATH = `${CODEX_TASK_PROJECT_PATH}/codex_task_smoke_test.txt`;
const CODEX_TASK_SMOKE_FILE_CONTENT = "Codex 任務測試成功";
const CODEX_TASK_INSTRUCTION = "Create or overwrite the fixed smoke file with the fixed smoke content.";
const DROPBOX_IDEA_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03";
const CODEX_PROCESSING_REPLY_TEXT = "收到～這件事需要一點時間，我處理完成後再告訴妳 🛠️";
const CODEX_COMPLETED_REPLY_TEXT = "已經處理完成了 ✨\n指定的小任務已成功執行。";
const CODEX_FAILED_REPLY_TEXT = "這次沒有順利完成，我先停在安全狀態，沒有假裝處理成功 🙏";
const CODEX_CAPABILITY_NOT_ENABLED_REPLY_TEXT = "這類操作目前還沒開放，我先不假裝已經執行。等下一階段授權後再處理。";
const IDEA_SAVED_FALLBACK_REPLY_TEXT = "已經幫妳記下來了 💡";
const IDEA_SAVE_FAILED_REPLY_TEXT = "這次沒有成功保存，我先不假裝記好了，請稍後再試一次 🙏";
const IDEA_FINALIZE_PATH = "/test/idea-finalize";
const CODEX_FINALIZE_PATH = "/test/codex-finalize";
const MEMO_FINALIZE_PATH = "/test/memo-finalize";
const MEMO_FINALIZE_URL = "https://pline-v3-test-line-gateway.phy4175.workers.dev/test/memo-finalize";
const MEMO_CREATE_COMMAND_PREFIX = "備忘錄：";
const MEMO_CREATE_OPERATION = "memo_create";
const MEMO_SEARCH_COMMAND_PREFIX = "備忘錄搜尋：";
const MEMO_MODIFY_COMMAND_PREFIX = "備忘錄修改：";
const MEMO_DELETE_COMMAND_PREFIX = "備忘錄刪除：";
const MEMO_DELETE_SELECTION_ALL_COMMAND = "刪除全部";
const MEMO_DELETE_CONFIRM_COMMAND = "確認刪除";
const MEMO_DELETE_CANCEL_COMMAND = "取消";
const MEMO_SEARCH_OPERATION = "memo_search";
const MEMO_SEARCH_PAGE_OPERATION = "memo_search_page";
const MEMO_MODIFY_OPERATION = "memo_modify";
const MEMO_DELETE_OPERATION = "memo_delete";
const MEMO_DETERMINISTIC_OPERATIONS = [
  MEMO_CREATE_OPERATION,
  MEMO_SEARCH_OPERATION,
  MEMO_SEARCH_PAGE_OPERATION,
  MEMO_MODIFY_OPERATION,
  MEMO_DELETE_OPERATION,
];
const MEMO_ID_PATTERN = /^memo-[a-f0-9]{64}$/;
const MEMO_CREATE_ACCEPTANCE_SCHEMA = "pline-v3-memo-create-acceptance/v1";
const MEMO_CREATE_ACCEPTANCE_PREFIX = "memo_create:v1:acceptance";
const MEMO_SEARCH_SELECTION_SCHEMA = "pline-v3-memo-search-selection/v3";
const MEMO_SEARCH_SELECTION_PREFIX = "memo_search_selection:v1";
const MEMO_DELETE_CONFIRMATION_SCHEMA = "pline-v3-memo-delete-confirmation/v1";
const MEMO_DELETE_CONFIRMATION_PREFIX = "memo_delete_confirmation:v1";
export const MEMO_SEARCH_SELECTION_TTL_SECONDS = 600;
export const MEMO_DELETE_CONFIRMATION_TTL_SECONDS = 600;
export const MEMO_SEARCH_SELECTION_MAX_CANDIDATES = 100;
export const MEMO_SEARCH_PAGE_SIZE = 10;
export const MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS = 5;
export const MEMO_SELECTION_WORKER_BATCH_REQUEST_LIMIT = 5;
export const MEMO_SELECTION_LIVE_EXECUTION_AUTHORIZED_LIMIT = 5;
const MEMO_CREATE_MAX_CONTENT_LENGTH = 4000;
const MEMO_CREATE_EMPTY_REPLY_TEXT = "請在「備忘錄：」後面輸入要記錄的內容。";
const MEMO_CREATE_TOO_LONG_REPLY_TEXT = "這筆備忘錄內容太長了，請縮短後再試一次。";
const MEMO_CREATE_FAILED_REPLY_TEXT = "備忘錄目前尚未完成，請稍後再試一次。";
const MEMO_SEARCH_EMPTY_REPLY_TEXT = "請在「備忘錄搜尋：」後面輸入關鍵字，或輸入「全部」。";
const MEMO_MODIFY_FORMAT_REPLY_TEXT = "請使用「備忘錄修改：備忘錄編號｜新內容」的格式。";
const MEMO_DELETE_FORMAT_REPLY_TEXT = "妳想刪除哪些備忘錄？請先搜尋，或告訴我關鍵字／日期。";
const MEMO_DELETE_SELECTION_FORMAT_REPLY_TEXT = "請使用「刪除第1筆」、「刪除第1、3、5筆」、「第一筆到第五筆」或「這次搜尋的全部」。";
const MEMO_DELETE_SELECTION_MISSING_REPLY_TEXT = "妳想刪除哪些備忘錄？請先搜尋，或告訴我關鍵字／日期。";
const MEMO_DELETE_SELECTION_EXPIRED_REPLY_TEXT = "上次搜尋結果已過期，請重新搜尋後再選擇。";
const MEMO_DELETE_SELECTION_RANGE_REPLY_TEXT = "選擇的備忘錄序號超出上次搜尋結果，請重新確認。";
const MEMO_DELETE_SELECTION_TOO_LARGE_REPLY_TEXT = "一次最多可刪除 5 筆，請縮小序號範圍後再試一次。";
const MEMO_SEARCH_SELECTION_FAILED_REPLY_TEXT = "搜尋結果目前無法建立可操作清單，請稍後重新搜尋。";
const MEMO_SEARCH_RESULT_INCOMPLETE_REPLY_TEXT = "搜尋結果沒有完整載入，請縮小搜尋範圍後再試一次。";
const MEMO_SEARCH_RESULT_LIMIT_REPLY_TEXT = "符合的備忘錄超過 100 筆，請加入關鍵字縮小搜尋範圍。";
const MEMO_SEARCH_PAGE_MISSING_REPLY_TEXT = "請先搜尋備忘錄，再查看上一頁或下一頁。";
const MEMO_SEARCH_PAGE_EXPIRED_REPLY_TEXT = "上次搜尋結果已過期，請重新搜尋後再翻頁。";
const MEMO_SEARCH_PAGE_RANGE_REPLY_TEXT = "這個搜尋結果沒有該頁，請重新確認頁碼。";
const MEMO_SEARCH_PAGE_FORMAT_REPLY_TEXT = "請輸入「查看下一頁」、「查看上一頁」或「查看第 N 頁」。";
const MEMO_DELETE_CONFIRMATION_MISSING_REPLY_TEXT = "目前沒有待確認的刪除項目，請先搜尋並選擇要刪除的備忘錄。";
const MEMO_DELETE_CONFIRMATION_EXPIRED_REPLY_TEXT = "這次刪除確認已過期，沒有變更任何備忘錄。請重新搜尋後再選擇。";
const MEMO_DELETE_CONFIRMATION_CHANGED_REPLY_TEXT = "搜尋結果已變更，沒有刪除任何備忘錄。請重新搜尋後再選擇。";
const MEMO_DELETE_CONFIRMATION_CONSUMED_REPLY_TEXT = "這次刪除確認已經處理過，沒有重複刪除。";
const MEMO_DELETE_CONFIRMATION_CANCELLED_REPLY_TEXT = "已取消刪除，沒有變更任何備忘錄。";
const MEMO_OPERATION_TOO_LONG_REPLY_TEXT = "這次輸入的內容太長了，請縮短後再試一次。";
const MEMO_OPERATION_FAILED_REPLY_TEXT = "備忘錄操作目前尚未完成，請稍後再試一次。";
const MEMO_SUCCESS_REPLY_MAX_LENGTH = 160;
const MEMO_SUCCESS_REPLY_FALLBACK = Object.freeze({
  [MEMO_CREATE_OPERATION]: "好，我幫妳記好了。",
  [MEMO_MODIFY_OPERATION]: "好，我幫妳改好了。",
  [MEMO_DELETE_OPERATION]: "好，我幫妳刪除了。",
});
const MEMO_SUCCESS_REPLY_FORBIDDEN_PATTERN = /(?:memo-[a-f0-9]{8,}|備忘錄(?:編號|id)|\.json\b|\/Users\/|\/菲比|Dropbox|Cloudflare|n8n|Worker|KV|webhook|payload|task_id|request_id|replyToken|credential|secret|token|system(?:\s+prompt)?|JSON|工程|節點|欄位|執行紀錄)/i;
const MEMO_SUCCESS_REPLY_SIMPLIFIED_PATTERN = /[这帮条记删录个后里务为]/;
const EVIDENCE_PREFIX = "evidence:v1";
const EVIDENCE_TTL_SECONDS = 172800;
export const LINE_WEBHOOK_ACK_BUDGET_MS = 2800;
export const NORMAL_ACK_TARGET_MS = 1800;
export const MEMO_ACK_RESPONSE_MARGIN_MS = 150;
export const MEMO_ACK_PUT_RESERVE_MS = 500;
const LINE_WEBHOOK_KV_GET_TIMEOUT_MS = 900;
const LINE_WEBHOOK_KV_PUT_TIMEOUT_MS = 1500;
const LINE_WEBHOOK_ACCEPTANCE_SCHEMA = "pline-v3-line-webhook-acceptance/v1";
const LINE_WEBHOOK_ACCEPTANCE_TTL_SECONDS = 3600;
const LINE_MARK_AS_READ_TIMEOUT_MS = 1500;
const GATE_MARKER_PATTERN = /\bT\d{4}[A-Z]?-\d{14}\b/;
const INTERNAL_REPLY_PATTERN = /(?:_03|TEST|n8n|worker|monitor|task|json|execution|webhook|cloudflare|測試|任務|工作流|執行)/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(workerHealth(env));
    }

    if (request.method === "GET" && url.pathname === "/test/evidence") {
      return handleEvidenceRead(request, env);
    }

    if (request.method === "POST" && url.pathname === "/test/evidence/selfcheck") {
      return handleEvidenceSelfcheck(request, env);
    }

    if (request.method === "POST" && url.pathname === IDEA_FINALIZE_PATH) {
      return handleIdeaFinalize(request, env);
    }

    if (request.method === "POST" && url.pathname === CODEX_FINALIZE_PATH) {
      return handleCodexFinalize(request, env);
    }

    if (request.method === "POST" && url.pathname === MEMO_FINALIZE_PATH) {
      return handleMemoFinalize(request, env);
    }

    if (request.method === "POST" && url.pathname === "/line/webhook") {
      return handleLineWebhook(request, env, ctx);
    }

    return jsonResponse({ status: "not_found", worker: WORKER_NAME }, 404);
  },
};

export async function handleLineWebhook(request, env, ctx = {}) {
  const ackStartedAt = Date.now();
  const correlationId = crypto.randomUUID();
  const ackBudgetMs = boundedTestNumber(ctx?.__testAckBudgetMs, LINE_WEBHOOK_ACK_BUDGET_MS);
  const kvGetTimeoutMs = boundedTestNumber(ctx?.__testKvGetTimeoutMs, LINE_WEBHOOK_KV_GET_TIMEOUT_MS);
  const kvPutTimeoutMs = boundedTestNumber(ctx?.__testKvPutTimeoutMs, LINE_WEBHOOK_KV_PUT_TIMEOUT_MS);
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") || "";
  const signatureResult = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);

  if (!signatureResult.ok) {
    logWebhookAckTiming(correlationId, "signature_rejected", ackStartedAt, signatureResult.status, signatureResult.reason);
    return jsonResponse({
      status: "rejected",
      reason: signatureResult.reason,
      check: "signature",
    }, signatureResult.status);
  }

  let linePayload;
  try {
    linePayload = JSON.parse(rawBody);
  } catch {
    logWebhookAckTiming(correlationId, "json_rejected", ackStartedAt, 400, "invalid_json");
    return jsonResponse({ status: "rejected", reason: "invalid_json" }, 400);
  }

  const event = firstTextEvent(linePayload);
  if (!event) {
    logWebhookAckTiming(correlationId, "empty_event_ack", ackStartedAt, 200, "none");
    return jsonResponse({ status: "accepted", reason: "no_text_event" }, 200);
  }

  const normalized = normalizeForN8n(event);
  const calendarCommand = parseCalendarCreateCommand(event.message?.text || "", normalized.received_at);
  const calendarContinuation = parseCalendarCreateContinuation(event.message?.text || "");
  const memoCommand = parseMemoDeterministicCommand(event.message?.text || "");
  const memoDeleteConfirmation = parseMemoDeleteConfirmationCommand(event.message?.text || "");
  const adminResult = await runBoundedAckOperation(
    () => verifyAdmin(event, env),
    {
      startedAt: ackStartedAt,
      budgetMs: ackBudgetMs,
      maxOperationMs: kvGetTimeoutMs,
      ctx,
      keepAlive: env.LINE_TEST_ADMIN_USER_IDS === ADMIN_BOOTSTRAP_SENTINEL,
    },
  );
  if (!adminResult.ok) {
    logWebhookAckTiming(correlationId, "admin_check_failed", ackStartedAt, 503, adminResult.error_class);
    return durableAckUnavailableResponse("admin_check_unavailable");
  }
  const verifiedAdmin = adminResult.value;
  if (!verifiedAdmin.ok) {
    logWebhookAckTiming(correlationId, "admin_rejected", ackStartedAt, verifiedAdmin.status, verifiedAdmin.reason);
    return jsonResponse({
      status: "rejected",
      reason: verifiedAdmin.reason,
      check: "admin",
    }, verifiedAdmin.status);
  }

  if (verifiedAdmin.bootstrapped) {
    queueBackgroundTask(ctx, replyToLine(normalized.reply_token, "已收到管理員確認訊息。", env));
    logWebhookAckTiming(correlationId, "admin_bootstrap_ack", ackStartedAt, 200, "none");
    return jsonResponse({
      status: "accepted",
      reason: "admin_bootstrap_captured",
      request_id: normalized.request_id,
    });
  }

  const calendarRoute = await resolveCalendarCreateRoute({
    event,
    normalized,
    calendarCommand,
    calendarContinuation,
    env,
    ctx,
    ackStartedAt,
    ackBudgetMs,
  });
  if (calendarRoute.unavailable) {
    logWebhookAckTiming(correlationId, "calendar_route_state_failed", ackStartedAt, 503, calendarRoute.reason);
    return durableAckUnavailableResponse(calendarRoute.reason);
  }
  if (calendarRoute.matched) {
    return handleCalendarCreateAcceptance({
      event,
      normalized,
      calendarCommand: calendarRoute.command,
      identity: calendarRoute.identity,
      env,
      ctx,
      correlationId,
      ackStartedAt,
      ackBudgetMs,
    });
  }

  if (memoDeleteConfirmation.matched) {
    return handleMemoDeleteConfirmationAcceptance({
      event,
      normalized,
      confirmationAction: memoDeleteConfirmation.action,
      env,
      ctx,
      correlationId,
      ackStartedAt,
      ackBudgetMs,
    });
  }

  if (memoCommand.matched) {
    return handleMemoDeterministicAcceptance({
      event,
      normalized,
      memoCommand,
      env,
      ctx,
      correlationId,
      ackStartedAt,
      ackBudgetMs,
    });
  }

  if (!env.IDEMPOTENCY_KV) {
    logWebhookAckTiming(correlationId, "idempotency_get_failed", ackStartedAt, 503, "missing_binding");
    return durableAckUnavailableResponse("missing_IDEMPOTENCY_KV");
  }

  const acceptanceRead = await runBoundedAckOperation(
    () => env.IDEMPOTENCY_KV.get(normalized.line_event_id),
    {
      startedAt: ackStartedAt,
      budgetMs: ackBudgetMs,
      maxOperationMs: kvGetTimeoutMs,
      ctx,
    },
  );
  if (!acceptanceRead.ok) {
    logWebhookAckTiming(correlationId, "idempotency_get_failed", ackStartedAt, 503, acceptanceRead.error_class);
    return durableAckUnavailableResponse("idempotency_get_unavailable");
  }

  const existingAcceptance = parseWebhookAcceptanceRecord(acceptanceRead.value);
  if (existingAcceptance.kind === "dispatched" || existingAcceptance.kind === "legacy_dispatched") {
    logWebhookAckTiming(correlationId, "duplicate_ack", ackStartedAt, 200, "none");
    return jsonResponse({
      status: "accepted",
      reason: "duplicate_line_event",
      check: "idempotency",
      request_id: normalized.request_id,
    }, 200);
  }

  let acceptanceRecord = existingAcceptance.record;
  let resumed = existingAcceptance.kind === "accepted";
  if (!acceptanceRecord) {
    acceptanceRecord = createWebhookAcceptanceRecord(correlationId);
    const acceptanceWrite = runBoundedAckOperation(
      () => env.IDEMPOTENCY_KV.put(
        normalized.line_event_id,
        JSON.stringify(acceptanceRecord),
        { expirationTtl: LINE_WEBHOOK_ACCEPTANCE_TTL_SECONDS },
      ),
      {
        startedAt: ackStartedAt,
        budgetMs: ackBudgetMs,
        maxOperationMs: kvPutTimeoutMs,
        ctx,
        keepAlive: true,
      },
    );
    const acceptanceWriteResult = await acceptanceWrite;
    if (!acceptanceWriteResult.ok) {
      logWebhookAckTiming(correlationId, "durable_acceptance_put_failed", ackStartedAt, 503, acceptanceWriteResult.error_class);
      return durableAckUnavailableResponse("durable_acceptance_unavailable");
    }
  }

  queueBackgroundTask(ctx, processAcceptedLineEventInBackground({
    event,
    normalized,
    env,
    acceptanceRecord,
  }));
  logWebhookAckTiming(correlationId, resumed ? "redelivery_resume_ack" : "message_ack", ackStartedAt, 200, "none");

  return jsonResponse({
    status: "accepted",
    request_id: normalized.request_id,
    reply_mode: LINE_REPLY_MODE,
    resumed,
  });
}

async function writeCalendarAcceptance(kv, key, record) {
  await kv.put(key, JSON.stringify(record), { expirationTtl: CALENDAR_CREATE_TTL_SECONDS });
  return record;
}

async function updateCalendarAcceptance(kv, key, updater) {
  const current = parseCalendarAcceptanceRecord(await kv.get(key));
  if (!current) return null;
  const next = updater(current);
  await writeCalendarAcceptance(kv, key, next);
  return next;
}

async function deleteCalendarPending(kv, key) {
  await kv.delete(key);
  return true;
}

export async function resolveCalendarCreateRoute({
  event,
  normalized,
  calendarCommand,
  calendarContinuation,
  env,
  ctx,
  ackStartedAt,
  ackBudgetMs,
}) {
  if (calendarCommand.matched) {
    return { matched: true, command: calendarCommand, identity: null, unavailable: false };
  }
  if (!calendarContinuation.matched) return { matched: false, unavailable: false };
  if (!env.IDEMPOTENCY_KV) {
    return { matched: false, unavailable: true, reason: "missing_calendar_kv_binding" };
  }
  const identity = await buildCalendarCreateIdentity(event);
  if (!identity.ok) return { matched: false, unavailable: true, reason: "calendar_identity_unavailable" };
  const readBudgetMs = memoAckRemainingBudgetMs({ startedAt: ackStartedAt, budgetMs: ackBudgetMs, phase: "get" });
  if (readBudgetMs <= 0) return { matched: false, unavailable: true, reason: "calendar_route_state_unavailable" };
  const eventAcceptance = await runBoundedAckOperation(
    () => env.IDEMPOTENCY_KV.get(calendarAcceptanceKey(identity.safe_event_hash)),
    { startedAt: ackStartedAt, budgetMs: ackBudgetMs, maxOperationMs: readBudgetMs, ctx },
  );
  if (!eventAcceptance.ok) return { matched: false, unavailable: true, reason: "calendar_route_state_unavailable" };
  if (eventAcceptance.value) {
    return {
      matched: true,
      identity,
      unavailable: false,
      command: { matched: true, valid: false, reason: "continuation_rejected", fields: {}, draft: {}, pending: false },
    };
  }
  const pendingKey = calendarPendingKey(identity.actor_hash);
  const pendingRead = await runBoundedAckOperation(
    () => env.IDEMPOTENCY_KV.get(pendingKey),
    { startedAt: ackStartedAt, budgetMs: ackBudgetMs, maxOperationMs: readBudgetMs, ctx },
  );
  if (!pendingRead.ok) return { matched: false, unavailable: true, reason: "calendar_pending_read_unavailable" };
  if (!pendingRead.value) return { matched: false, unavailable: false };
  const nowMs = Date.parse(normalized.received_at || "") || Date.now();
  const pending = parseCalendarPendingRecord(pendingRead.value, identity.actor_hash, nowMs);
  if (!pending) {
    return {
      matched: true,
      identity,
      unavailable: false,
      command: {
        matched: true,
        valid: false,
        reason: "continuation_rejected",
        fields: {},
        draft: {},
        pending: false,
        rejected: true,
        continuation: true,
      },
    };
  }
  if (pending.expired) {
    return {
      matched: true,
      identity,
      unavailable: false,
      command: {
        matched: true,
        valid: false,
        reason: "pending_expired",
        fields: {},
        draft: {},
        pending: false,
        rejected: true,
        continuation: true,
        pending_source_event_hash: pending.source_event_hash,
      },
    };
  }
  const command = mergeCalendarCreateContinuation(pending, normalized.message_text, normalized.received_at);
  return {
    matched: true,
    identity,
    unavailable: false,
    command: {
      ...command,
      continuation: true,
      pending_source_event_hash: pending.source_event_hash,
    },
  };
}

async function applyCalendarPendingState(kv, identity, command) {
  const key = calendarPendingKey(identity.actor_hash);
  if (command.continuation && command.pending_source_event_hash) {
    const currentRaw = await kv.get(key);
    const current = parseCalendarPendingRecord(currentRaw, identity.actor_hash, Date.now());
    if (!current && !command.pending) return { ok: true, action: "already_cleared" };
    if (current?.source_event_hash === identity.safe_event_hash && command.pending) {
      return { ok: true, action: "already_stored" };
    }
    if (!current || current.source_event_hash !== command.pending_source_event_hash) {
      return { ok: false, reason: "calendar_pending_snapshot_changed" };
    }
  }
  if (command.pending) {
    const pending = createCalendarPendingRecord({ identity, command });
    await kv.put(key, JSON.stringify(pending), { expirationTtl: CALENDAR_CREATE_TTL_SECONDS });
    return { ok: true, action: "stored" };
  }
  await deleteCalendarPending(kv, key);
  return { ok: true, action: "cleared" };
}

function calendarCommandFromAcceptance(record = {}) {
  return {
    matched: true,
    valid: record.input_valid === true,
    reason: String(record.reject_reason || ""),
    fields: structuredClone(record.canonical || {}),
    draft: structuredClone(record.pending_draft || {}),
    pending: record.pending_context === true,
    continuation: record.continuation === true,
    pending_source_event_hash: String(record.pending_source_event_hash || ""),
  };
}

export async function handleCalendarCreateAcceptance({
  event,
  normalized,
  calendarCommand,
  identity: providedIdentity,
  env,
  ctx,
  correlationId,
  ackStartedAt,
  ackBudgetMs,
}) {
  if (!env.IDEMPOTENCY_KV || !env.RUNTIME_KV) {
    logWebhookAckTiming(correlationId, "calendar_idempotency_failed", ackStartedAt, 503, "missing_binding");
    return durableAckUnavailableResponse("missing_calendar_kv_binding");
  }
  const identity = providedIdentity || await buildCalendarCreateIdentity(event);
  if (!identity.ok) {
    logWebhookAckTiming(correlationId, "calendar_identity_failed", ackStartedAt, 503, identity.reason);
    return durableAckUnavailableResponse("calendar_identity_unavailable");
  }
  const acceptanceKey = calendarAcceptanceKey(identity.safe_event_hash);
  const readBudgetMs = memoAckRemainingBudgetMs({ startedAt: ackStartedAt, budgetMs: ackBudgetMs, phase: "get" });
  if (readBudgetMs <= 0) return durableAckUnavailableResponse("idempotency_get_unavailable");
  const acceptanceRead = await runBoundedAckOperation(
    () => env.IDEMPOTENCY_KV.get(acceptanceKey),
    { startedAt: ackStartedAt, budgetMs: ackBudgetMs, maxOperationMs: readBudgetMs, ctx },
  );
  if (!acceptanceRead.ok) return durableAckUnavailableResponse("idempotency_get_unavailable");

  let record = parseCalendarAcceptanceRecord(acceptanceRead.value);
  let readbackOnly = false;
  let pendingCommand = calendarCommand;
  const resumed = Boolean(record);
  if (acceptanceRead.value && !record) {
    return jsonResponse({ status: "rejected", reason: "calendar_acceptance_conflict" }, 409);
  }
  if (record) {
    if (record.actor_hash !== identity.actor_hash || record.event_reference !== identity.event_reference) {
      return jsonResponse({ status: "rejected", reason: "calendar_identity_conflict" }, 409);
    }
    if (calendarRecordIsFinal(record)) {
      return jsonResponse({ status: "accepted", reason: "duplicate_line_event", route: "calendar_create" }, 200);
    }
    readbackOnly = ["dispatching", "dispatch_ambiguous", "dispatched", "reply_attempt_pending"].includes(record.status);
    pendingCommand = calendarCommandFromAcceptance(record);
  } else {
    record = createCalendarAcceptanceRecord({
      identity,
      command: calendarCommand,
      replyToken: normalized.reply_token,
      receivedAt: normalized.received_at,
    });
    const writeBudgetMs = memoAckRemainingBudgetMs({ startedAt: ackStartedAt, budgetMs: ackBudgetMs, phase: "put" });
    if (writeBudgetMs <= 0) return durableAckUnavailableResponse("durable_acceptance_unavailable");
    const acceptanceWrite = await runBoundedAckOperation(
      () => writeCalendarAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, record),
      { startedAt: ackStartedAt, budgetMs: ackBudgetMs, maxOperationMs: writeBudgetMs, ctx, keepAlive: true },
    );
    if (!acceptanceWrite.ok) return durableAckUnavailableResponse("durable_acceptance_unavailable");
  }

  if (record.status === "accepted") {
    const pendingState = await runBoundedAckOperation(
      () => applyCalendarPendingState(env.IDEMPOTENCY_KV, identity, pendingCommand),
      {
        startedAt: ackStartedAt,
        budgetMs: ackBudgetMs,
        maxOperationMs: memoAckRemainingBudgetMs({ startedAt: ackStartedAt, budgetMs: ackBudgetMs, phase: "put" }),
        ctx,
        keepAlive: true,
      },
    );
    if (!pendingState.ok || !pendingState.value?.ok) {
      return durableAckUnavailableResponse(pendingState.value?.reason || "calendar_pending_state_unavailable");
    }
  }

  queueBackgroundTask(ctx, processAcceptedCalendarCreateInBackground({
    event,
    env,
    acceptanceKey,
    readbackOnly,
  }));
  logWebhookAckTiming(correlationId, resumed ? "calendar_redelivery_resume_ack" : "calendar_message_ack", ackStartedAt, 200, "none");
  return jsonResponse({ status: "accepted", route: "calendar_create", resumed }, 200);
}

async function deliverCalendarReplyOnce(env, acceptanceKey, userId, replyText, terminalStatus) {
  const record = parseCalendarAcceptanceRecord(await env.IDEMPOTENCY_KV.get(acceptanceKey));
  if (!record) return { ok: false, reason: "missing_calendar_acceptance" };
  if (calendarRecordIsFinal(record)) {
    return { ok: true, status: "already_finalized", duplicate_blocked: true, replied: false, pushed: false };
  }
  if (record.status === "reply_attempt_pending") {
    return { ok: false, status: "delivery_ambiguous", duplicate_blocked: true, replied: false, pushed: false };
  }
  await writeCalendarAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, {
    ...record,
    status: "reply_attempt_pending",
    reply_attempt_count: 1,
    updated_at: new Date().toISOString(),
  });
  const delivery = await deliverFinalReplyFirst({
    env,
    deliveryKey: `calendar-final:${record.safe_event_hash}`,
    userId,
    replyToken: record.reply_token,
    replyReceivedAt: record.received_at,
    replyText,
  });
  const finalStatus = delivery.ok
    ? terminalStatus
    : delivery.status === "delivery_ambiguous"
      ? "delivery_ambiguous"
      : delivery.status === "reply_unavailable"
        ? "reply_unavailable"
        : "reply_rejected";
  await writeCalendarAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, {
    ...record,
    status: finalStatus,
    delivery_status: delivery.status,
    reply_token: "",
    final_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return delivery;
}

async function processAcceptedCalendarCreateInBackground({ event, env, acceptanceKey, readbackOnly = false }) {
  const markAsReadTask = markLineMessageAsReadForEvent(event, { request_id: "", gate_marker: "" }, env);
  const record = parseCalendarAcceptanceRecord(await env.IDEMPOTENCY_KV.get(acceptanceKey));
  if (!record) {
    await Promise.allSettled([markAsReadTask]);
    return { ok: false, reason: "missing_calendar_acceptance" };
  }
  if (!record.input_valid) {
    const result = await deliverCalendarReplyOnce(
      env,
      acceptanceKey,
      event.source?.userId || "",
      calendarValidationReplyText(record.reject_reason),
      "final_failed",
    );
    await Promise.allSettled([markAsReadTask]);
    return result;
  }

  await updateCalendarAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, (current) => ({
    ...current,
    status: "dispatching",
    dispatch_started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  let n8nResult = null;
  if (!readbackOnly) {
    try {
      n8nResult = await callN8nWebhook(buildCalendarCreateN8nPayload(record), env);
    } catch {
      n8nResult = null;
    }
  }
  const initialValidation = n8nResult?.ok
    ? validateCalendarCreateN8nResult(n8nResult.body, record)
    : { ok: false, reason: "calendar_dispatch_unavailable" };
  if (!initialValidation.ok) {
    await updateCalendarAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, (current) => ({
      ...current,
      status: "dispatch_ambiguous",
      updated_at: new Date().toISOString(),
    }));
    try {
      n8nResult = await callN8nWebhook(buildCalendarCreateN8nPayload(record, { readbackOnly: true }), env);
    } catch {
      n8nResult = null;
    }
  }

  const validated = n8nResult?.ok
    ? validateCalendarCreateN8nResult(n8nResult.body, record)
    : { ok: false, reason: "calendar_dispatch_unavailable" };
  await updateCalendarAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, (current) => ({
    ...current,
    status: validated.ok ? "dispatched" : "dispatch_ambiguous",
    readback_verified: validated.ok,
    duplicate: validated.ok ? validated.duplicate : false,
    updated_at: new Date().toISOString(),
  }));
  const result = await deliverCalendarReplyOnce(
    env,
    acceptanceKey,
    event.source?.userId || "",
    validated.ok ? calendarSuccessReplyText(record) : calendarFailureReplyText(),
    validated.ok ? "final_completed" : "final_failed",
  );
  await Promise.allSettled([markAsReadTask]);
  return result;
}

function boundedTestNumber(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

export async function runBoundedAckOperation(operation, options = {}) {
  const startedAt = Number(options.startedAt || Date.now());
  const budgetMs = Number(options.budgetMs || LINE_WEBHOOK_ACK_BUDGET_MS);
  const maxOperationMs = Number(options.maxOperationMs || budgetMs);
  const remainingMs = budgetMs - (Date.now() - startedAt);
  if (remainingMs <= 0) {
    return { ok: false, error_class: "budget_exhausted" };
  }

  let operationTask;
  try {
    operationTask = Promise.resolve().then(operation);
  } catch (error) {
    return { ok: false, error_class: safeAckErrorClass(error) };
  }
  const settledTask = operationTask.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error_class: safeAckErrorClass(error) }),
  );
  if (options.keepAlive) {
    queueBackgroundTask(options.ctx, settledTask);
  }

  const timeoutMs = Math.max(1, Math.min(maxOperationMs, remainingMs));
  let timeout = null;
  try {
    return await Promise.race([
      settledTask,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve({ ok: false, error_class: "timeout" }), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function safeAckErrorClass(error) {
  const name = String(error?.name || "Error");
  if (name === "AbortError") return "abort";
  if (name === "TypeError") return "type_error";
  if (name === "RangeError") return "range_error";
  return "operation_error";
}

function logWebhookAckTiming(correlationId, stage, startedAt, httpOutcome, errorClass = "none") {
  console.log(JSON.stringify({
    correlation_uuid: correlationId,
    stage,
    elapsed_ms: Math.max(0, Date.now() - startedAt),
    http_outcome: Number(httpOutcome || 0),
    error_class: safeAckLabel(errorClass),
  }));
}

function safeAckLabel(value) {
  return String(value || "none").replace(/[^A-Za-z0-9_\-.]/g, "_").slice(0, 80);
}

function durableAckUnavailableResponse(reason) {
  return jsonResponse({
    status: "retry",
    reason,
    check: "durable_acceptance",
  }, 503);
}

function createWebhookAcceptanceRecord(correlationId) {
  return {
    schema: LINE_WEBHOOK_ACCEPTANCE_SCHEMA,
    status: "accepted",
    correlation_uuid: correlationId,
    accepted_at: new Date().toISOString(),
  };
}

export function parseWebhookAcceptanceRecord(raw = "") {
  if (!raw) return { kind: "missing", record: null };
  const record = parseJsonSafely(raw);
  if (!record || record.schema !== LINE_WEBHOOK_ACCEPTANCE_SCHEMA) {
    return { kind: "legacy_dispatched", record: null };
  }
  if (record.status === "dispatched") {
    return { kind: "dispatched", record };
  }
  if (record.status === "accepted") {
    return { kind: "accepted", record };
  }
  return { kind: "legacy_dispatched", record: null };
}

function queueBackgroundTask(ctx, task) {
  const guarded = Promise.resolve(task).catch(() => ({ ok: false, reason: "background_task_failed" }));
  if (ctx?.waitUntil) {
    ctx.waitUntil(guarded);
  } else {
    void guarded;
  }
  return guarded;
}

async function processAcceptedLineEventInBackground({ event, normalized, env, acceptanceRecord }) {
  const acceptanceEvidenceTask = persistWebhookAcceptedEvidenceCheckpoint(env, normalized, { bootstrap: false });
  const markAsReadTask = markLineMessageAsReadForEvent(event, normalized, env);
  const n8nTask = processN8nInBackground(normalized, env);
  const n8nResult = await n8nTask;

  if (n8nResult?.ok) {
    await markWebhookAcceptanceDispatched(env, normalized.line_event_id, acceptanceRecord);
  }
  const responseEvidenceTask = persistEvidenceStage(env, normalized, "webhook_http_200_returned", {
    reply_mode: LINE_REPLY_MODE,
  });
  await Promise.allSettled([acceptanceEvidenceTask, markAsReadTask, responseEvidenceTask]);
  return n8nResult;
}

async function markWebhookAcceptanceDispatched(env = {}, eventId = "", acceptanceRecord = {}) {
  if (!env.IDEMPOTENCY_KV || !eventId) {
    return { ok: false, reason: "missing_IDEMPOTENCY_KV" };
  }
  try {
    await env.IDEMPOTENCY_KV.put(eventId, JSON.stringify({
      schema: LINE_WEBHOOK_ACCEPTANCE_SCHEMA,
      status: "dispatched",
      correlation_uuid: String(acceptanceRecord.correlation_uuid || ""),
      accepted_at: String(acceptanceRecord.accepted_at || ""),
      dispatched_at: new Date().toISOString(),
    }), { expirationTtl: LINE_WEBHOOK_ACCEPTANCE_TTL_SECONDS });
    return { ok: true };
  } catch {
    return { ok: false, reason: "idempotency_dispatch_state_write_failed" };
  }
}

export function parseMemoCreateCommand(messageText = "") {
  const text = String(messageText || "");
  if (!text.startsWith(MEMO_CREATE_COMMAND_PREFIX)) {
    return { matched: false, valid: false, content: "", reason: "not_memo_create" };
  }
  const content = text.slice(MEMO_CREATE_COMMAND_PREFIX.length).trim();
  if (!content) {
    return { matched: true, valid: false, content: "", reason: "empty_content" };
  }
  if (content.length > MEMO_CREATE_MAX_CONTENT_LENGTH) {
    return { matched: true, valid: false, content: "", reason: "content_too_long" };
  }
  return { matched: true, valid: true, content, reason: "" };
}

function memoSelectionOrdinal(value = "") {
  const text = String(value || "").trim();
  if (/^[1-9]\d*$/.test(text)) return Number(text);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === "十") return 10;
  if (text.length === 1 && digits[text]) return digits[text];
  const match = text.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/);
  if (!match) return NaN;
  return (match[1] ? digits[match[1]] : 1) * 10 + (match[2] ? digits[match[2]] : 0);
}

export function parseMemoSearchSelectionDeleteCommand(messageText = "") {
  const original = String(messageText || "").trim();
  if (original === "全部清空" || original.includes("批次刪除") || original.includes("刪除多筆")) {
    return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "invalid_selection_format");
  }
  let text;
  if (original.startsWith(MEMO_DELETE_COMMAND_PREFIX)) {
    text = original.slice(MEMO_DELETE_COMMAND_PREFIX.length).trim();
    if (MEMO_ID_PATTERN.test(text)) {
      return { matched: false, valid: false, intent: "", fields: {}, reason: "not_selection_delete" };
    }
  } else if (original.startsWith("刪除")) {
    text = original.slice("刪除".length).trim();
  } else {
    return { matched: false, valid: false, intent: "", fields: {}, reason: "not_selection_delete" };
  }
  text = text.replace(/\s+/g, "");
  if (/^(?:這次搜尋(?:結果)?的)?全部(?:備忘錄)?$/.test(text)) {
    return memoCommandResult(MEMO_DELETE_OPERATION, true, {
      selection_mode: "all",
      selection_indices: [],
    });
  }
  const ordinal = "(?:[1-9]\\d*|[一二三四五六七八九十]+)";
  const rangeMatch = text.match(new RegExp(`^第?(${ordinal})筆?(?:到|至|-|～|~)第?(${ordinal})筆(?:備忘錄)?$`));
  if (rangeMatch) {
    const start = memoSelectionOrdinal(rangeMatch[1]);
    const end = memoSelectionOrdinal(rangeMatch[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
      return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "invalid_selection_range");
    }
    if ((end - start + 1) > MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS) {
      return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "selection_too_large");
    }
    return memoCommandResult(MEMO_DELETE_OPERATION, true, {
      selection_mode: "range",
      selection_indices: Array.from({ length: end - start + 1 }, (_, index) => start + index),
    });
  }

  const listMatch = text.match(new RegExp(`^第?(${ordinal}(?:[、,，]${ordinal})+)筆(?:備忘錄)?$`));
  if (listMatch) {
    const parsedIndices = listMatch[1].split(/[、,，]/).map((value) => memoSelectionOrdinal(value));
    if (parsedIndices.some((value) => !Number.isSafeInteger(value))) {
      return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "invalid_selection_format");
    }
    const indices = [...new Set(parsedIndices)].sort((left, right) => left - right);
    if (indices.length > MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS) {
      return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "selection_too_large");
    }
    return memoCommandResult(MEMO_DELETE_OPERATION, true, {
      selection_mode: indices.length === 1 ? "single" : "multiple",
      selection_indices: indices,
    });
  }

  const singleMatch = text.match(new RegExp(`^第?(${ordinal})筆(?:備忘錄)?$`));
  if (singleMatch) {
    const index = memoSelectionOrdinal(singleMatch[1]);
    if (!Number.isSafeInteger(index)) {
      return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "invalid_selection_format");
    }
    return memoCommandResult(MEMO_DELETE_OPERATION, true, {
      selection_mode: "single",
      selection_indices: [index],
    });
  }

  return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "invalid_selection_format");
}

export function parseMemoDeleteConfirmationCommand(messageText = "") {
  const text = String(messageText || "").trim();
  if (text === MEMO_DELETE_CONFIRM_COMMAND) return { matched: true, action: "confirm" };
  if (text === MEMO_DELETE_CANCEL_COMMAND) return { matched: true, action: "cancel" };
  return { matched: false, action: "" };
}

export function parseMemoSearchPageCommand(messageText = "") {
  const text = String(messageText || "").trim();
  if (text === "查看下一頁") {
    return memoCommandResult(MEMO_SEARCH_PAGE_OPERATION, true, {
      page_mode: "next",
      requested_page: null,
    });
  }
  if (text === "查看上一頁") {
    return memoCommandResult(MEMO_SEARCH_PAGE_OPERATION, true, {
      page_mode: "previous",
      requested_page: null,
    });
  }
  const numberedPage = text.match(/^查看第\s*([1-9]\d*)\s*頁$/);
  if (numberedPage) {
    const requestedPage = Number(numberedPage[1]);
    if (!Number.isSafeInteger(requestedPage) || requestedPage > MEMO_SEARCH_SELECTION_MAX_CANDIDATES) {
      return memoCommandResult(MEMO_SEARCH_PAGE_OPERATION, false, {}, "invalid_page_command");
    }
    return memoCommandResult(MEMO_SEARCH_PAGE_OPERATION, true, {
      page_mode: "numbered",
      requested_page: requestedPage,
    });
  }
  if (text.startsWith("查看下一頁") || text.startsWith("查看上一頁") || text.startsWith("查看第")) {
    return memoCommandResult(MEMO_SEARCH_PAGE_OPERATION, false, {}, "invalid_page_command");
  }
  return { matched: false, valid: false, intent: "", fields: {}, reason: "not_search_page" };
}

export function parseMemoDeterministicCommand(messageText = "") {
  const text = String(messageText || "");

  const searchPage = parseMemoSearchPageCommand(text);
  if (searchPage.matched) {
    return searchPage;
  }

  const selectionDelete = parseMemoSearchSelectionDeleteCommand(text);
  if (selectionDelete.matched) {
    return selectionDelete;
  }

  if (text.startsWith(MEMO_SEARCH_COMMAND_PREFIX)) {
    const keyword = text.slice(MEMO_SEARCH_COMMAND_PREFIX.length).trim();
    if (!keyword) {
      return memoCommandResult(MEMO_SEARCH_OPERATION, false, {}, "empty_keyword");
    }
    if (keyword.length > MEMO_CREATE_MAX_CONTENT_LENGTH) {
      return memoCommandResult(MEMO_SEARCH_OPERATION, false, {}, "content_too_long");
    }
    return memoCommandResult(MEMO_SEARCH_OPERATION, true, {
      keyword: keyword === "全部" ? "" : keyword,
      list_all: keyword === "全部",
    });
  }

  if (text.startsWith(MEMO_MODIFY_COMMAND_PREFIX)) {
    const input = text.slice(MEMO_MODIFY_COMMAND_PREFIX.length).trim();
    const delimiterIndex = input.indexOf("｜");
    if (delimiterIndex < 0) {
      return memoCommandResult(MEMO_MODIFY_OPERATION, false, {}, "missing_delimiter");
    }
    const memoId = input.slice(0, delimiterIndex).trim();
    const newContent = input.slice(delimiterIndex + 1).trim();
    if (!MEMO_ID_PATTERN.test(memoId)) {
      return memoCommandResult(MEMO_MODIFY_OPERATION, false, {}, "invalid_memo_id");
    }
    if (!newContent) {
      return memoCommandResult(MEMO_MODIFY_OPERATION, false, {}, "empty_content");
    }
    if (newContent.length > MEMO_CREATE_MAX_CONTENT_LENGTH) {
      return memoCommandResult(MEMO_MODIFY_OPERATION, false, {}, "content_too_long");
    }
    return memoCommandResult(MEMO_MODIFY_OPERATION, true, {
      memo_id: memoId,
      new_content: newContent,
    });
  }

  if (text.startsWith(MEMO_DELETE_COMMAND_PREFIX)) {
    const memoId = text.slice(MEMO_DELETE_COMMAND_PREFIX.length).trim();
    if (!MEMO_ID_PATTERN.test(memoId)) {
      return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "invalid_memo_id");
    }
    return memoCommandResult(MEMO_DELETE_OPERATION, false, {}, "delete_requires_search_selection");
  }

  const createCommand = parseMemoCreateCommand(text);
  if (createCommand.matched) {
    return memoCommandResult(MEMO_CREATE_OPERATION, createCommand.valid, {
      content: createCommand.content,
    }, createCommand.reason);
  }
  return { matched: false, valid: false, intent: "", fields: {}, reason: "not_memo_command" };
}

function memoCommandResult(intent, valid, fields = {}, reason = "") {
  return {
    matched: true,
    valid: Boolean(valid),
    intent,
    fields: valid ? fields : {},
    reason: valid ? "" : reason,
  };
}

function memoCommandCanonicalInput(memoCommand = {}) {
  const fields = memoCommand.fields || {};
  switch (memoCommand.intent) {
    case MEMO_CREATE_OPERATION:
      return { content: String(fields.content || "") };
    case MEMO_SEARCH_OPERATION:
      return { keyword: String(fields.keyword || ""), list_all: fields.list_all === true };
    case MEMO_SEARCH_PAGE_OPERATION:
      return {
        page_mode: String(fields.page_mode || ""),
        requested_page: fields.requested_page === null ? null : Number(fields.requested_page),
      };
    case MEMO_MODIFY_OPERATION:
      return { memo_id: String(fields.memo_id || ""), new_content: String(fields.new_content || "") };
    case MEMO_DELETE_OPERATION:
      return fields.selection_mode && fields.selection_mode !== "memo_id"
        ? {
            selection_mode: String(fields.selection_mode || ""),
            selection_indices: Array.isArray(fields.selection_indices)
              ? fields.selection_indices.map((value) => Number(value))
              : [],
          }
        : { memo_id: String(fields.memo_id || ""), selection_mode: "memo_id" };
    default:
      return {};
  }
}

export async function buildMemoSelectionScopeHash(event = {}, env = {}) {
  const source = event.source && typeof event.source === "object" ? event.source : {};
  const scopeMaterial = JSON.stringify({
    type: String(source.type || "user"),
    user: String(source.userId || ""),
    group: String(source.groupId || ""),
    room: String(source.roomId || ""),
  });
  return fingerprint(`memo-selection-scope:${scopeMaterial}`, env);
}

async function buildMemoDeterministicIdentity(event = {}, memoCommand = {}, env = {}, receivedAt = "") {
  const rawEventIdentity = String(event.webhookEventId || event.message?.id || "");
  if (!rawEventIdentity) {
    return { ok: false, reason: "missing_line_event_identity" };
  }
  const safeEventHash = await fingerprint(`line-event:${rawEventIdentity}`, env);
  const normalizedFields = memoCommandCanonicalInput(memoCommand);
  const canonicalContentHash = await fingerprint(
    `memo-command:${memoCommand.intent}:${JSON.stringify(normalizedFields)}`,
    env,
  );
  const selectionScopeHash = await buildMemoSelectionScopeHash(event, env);
  const memoId = memoCommand.intent === MEMO_CREATE_OPERATION
    ? `memo-${safeEventHash}`
    : String(normalizedFields.memo_id || "");
  return {
    ok: true,
    safe_event_hash: safeEventHash,
    memo_id: memoId,
    filename: memoCommand.intent === MEMO_CREATE_OPERATION ? `${memoId}.json` : "",
    canonical_content_hash: canonicalContentHash,
    selection_scope_hash: selectionScopeHash,
    received_at: receivedAt || new Date().toISOString(),
    callback_reference: {
      callback_url: MEMO_FINALIZE_URL,
      task_id: `memo-task-${safeEventHash}`,
      request_id: `memo-request-${safeEventHash}`,
    },
  };
}

export async function buildMemoCreateIdentity(event = {}, content = "", env = {}, receivedAt = "") {
  const identity = await buildMemoDeterministicIdentity(event, {
    intent: MEMO_CREATE_OPERATION,
    fields: { content: String(content || "") },
  }, env, receivedAt);
  if (identity.ok) {
    identity.canonical_content_hash = await fingerprint(`memo-content:${String(content || "")}`, env);
  }
  return identity;
}

export function createMemoCreateAcceptanceRecord({ identity, memoCommand, replyToken, correlationId }) {
  const normalizedCommand = memoCommand.fields
    ? memoCommandCanonicalInput(memoCommand)
    : { content: String(memoCommand.content || "") };
  return {
    schema: MEMO_CREATE_ACCEPTANCE_SCHEMA,
    operation: String(memoCommand.intent || MEMO_CREATE_OPERATION),
    status: "accepted",
    dispatch_status: "accepted",
    input_valid: Boolean(memoCommand.valid),
    reject_reason: memoCommand.valid ? "" : memoCommand.reason,
    correlation_uuid: correlationId,
    safe_event_hash: identity.safe_event_hash,
    memo_id: identity.memo_id,
    filename: identity.filename,
    canonical_content_hash: identity.canonical_content_hash,
    selection_scope_hash: identity.selection_scope_hash,
    normalized_command: normalizedCommand,
    received_at: identity.received_at,
    callback_reference: identity.callback_reference,
    reply_token: String(replyToken || ""),
    accepted_at: new Date().toISOString(),
  };
}

function parseMemoCreateAcceptanceRecord(raw = "") {
  const record = parseJsonSafely(raw);
  if (
    !record
    || record.schema !== MEMO_CREATE_ACCEPTANCE_SCHEMA
    || !MEMO_DETERMINISTIC_OPERATIONS.includes(record.operation)
  ) {
    return null;
  }
  return record;
}

function memoValidationAcceptanceHandoff(record = null, acceptanceKey = "") {
  const parsed = parseMemoCreateAcceptanceRecord(JSON.stringify(record || null));
  if (
    !parsed
    || parsed.input_valid !== false
    || !/^[a-f0-9]{64}$/.test(String(parsed.safe_event_hash || ""))
    || memoCreateAcceptanceKey(parsed.safe_event_hash) !== acceptanceKey
  ) {
    return null;
  }
  return parsed;
}

async function handleMemoDeterministicAcceptance({
  event,
  normalized,
  memoCommand,
  env,
  ctx,
  correlationId,
  ackStartedAt,
  ackBudgetMs,
}) {
  if (!env.IDEMPOTENCY_KV) {
    logWebhookAckTiming(correlationId, "memo_idempotency_failed", ackStartedAt, 503, "missing_binding");
    return durableAckUnavailableResponse("missing_IDEMPOTENCY_KV");
  }

  const identity = memoCommand.intent === MEMO_CREATE_OPERATION
    ? await buildMemoCreateIdentity(event, memoCommand.fields?.content || "", env, normalized.received_at)
    : await buildMemoDeterministicIdentity(event, memoCommand, env, normalized.received_at);
  if (!identity.ok) {
    logWebhookAckTiming(correlationId, "memo_identity_failed", ackStartedAt, 503, identity.reason);
    return durableAckUnavailableResponse("memo_identity_unavailable");
  }
  const acceptanceKey = memoCreateAcceptanceKey(identity.safe_event_hash);
  const selectionDelete = memoDeleteUsesSearchSelection(memoCommand);
  const snapshotDependent = memoUsesSearchSnapshot(memoCommand);
  const selectionKey = snapshotDependent ? memoSearchSelectionKey(identity.selection_scope_hash) : "";
  const memoGetBudgetMs = memoAckRemainingBudgetMs({
    startedAt: ackStartedAt,
    budgetMs: ackBudgetMs,
    phase: "get",
  });
  if (memoGetBudgetMs <= 0) {
    logWebhookAckTiming(correlationId, "memo_idempotency_get_failed", ackStartedAt, 503, "budget_exhausted");
    return durableAckUnavailableResponse("idempotency_get_unavailable");
  }
  const acceptanceRead = await runBoundedAckOperation(
    () => snapshotDependent
      ? Promise.all([
          env.IDEMPOTENCY_KV.get(acceptanceKey),
          env.IDEMPOTENCY_KV.get(selectionKey),
        ])
      : env.IDEMPOTENCY_KV.get(acceptanceKey),
    {
      startedAt: ackStartedAt,
      budgetMs: ackBudgetMs,
      maxOperationMs: memoGetBudgetMs,
      ctx,
    },
  );
  if (!acceptanceRead.ok) {
    logWebhookAckTiming(correlationId, "memo_idempotency_get_failed", ackStartedAt, 503, acceptanceRead.error_class);
    return durableAckUnavailableResponse("idempotency_get_unavailable");
  }

  const acceptanceRaw = snapshotDependent ? acceptanceRead.value?.[0] : acceptanceRead.value;
  const selectionSnapshotRaw = snapshotDependent ? acceptanceRead.value?.[1] : "";
  let acceptanceRecord = parseMemoCreateAcceptanceRecord(acceptanceRaw);
  const resumed = Boolean(acceptanceRecord);
  if (acceptanceRaw && !acceptanceRecord) {
    logWebhookAckTiming(correlationId, "memo_acceptance_conflict", ackStartedAt, 409, "invalid_record");
    return jsonResponse({ status: "rejected", reason: "memo_acceptance_conflict" }, 409);
  }
  if (acceptanceRecord) {
    if (
      acceptanceRecord.memo_id !== identity.memo_id
      || acceptanceRecord.canonical_content_hash !== identity.canonical_content_hash
      || acceptanceRecord.operation !== memoCommand.intent
    ) {
      logWebhookAckTiming(correlationId, "memo_identity_conflict", ackStartedAt, 409, "content_mismatch");
      return jsonResponse({ status: "rejected", reason: "memo_identity_conflict" }, 409);
    }
    if (memoCreateRecordBlocksDispatch(acceptanceRecord)) {
      logWebhookAckTiming(correlationId, "memo_duplicate_ack", ackStartedAt, 200, "none");
      return jsonResponse({ status: "accepted", reason: "duplicate_line_event", route: memoCommand.intent }, 200);
    }
  } else {
    let acceptedMemoCommand = memoCommand;
    if (selectionDelete) {
      const resolution = resolveMemoSearchSelectionDelete({
        snapshotRaw: selectionSnapshotRaw,
        scopeHash: identity.selection_scope_hash,
        selectionMode: memoCommand.fields?.selection_mode,
        selectionIndices: memoCommand.fields?.selection_indices,
      });
      acceptedMemoCommand = {
        ...memoCommand,
        valid: resolution.ok,
        reason: resolution.ok ? "" : resolution.reason,
        fields: {
          ...(memoCommand.fields || {}),
          resolved_memo_ids: resolution.ok ? resolution.memo_ids : [],
          resolved_candidates: resolution.ok ? resolution.candidates : [],
          selection_snapshot_version: resolution.ok ? resolution.snapshot_version : "",
          selection_snapshot_expires_at: resolution.ok ? resolution.snapshot_expires_at : "",
        },
      };
    } else if (memoCommand.intent === MEMO_SEARCH_PAGE_OPERATION && memoCommand.valid) {
      const resolution = resolveMemoSearchPage({
        snapshotRaw: selectionSnapshotRaw,
        scopeHash: identity.selection_scope_hash,
        pageMode: memoCommand.fields?.page_mode,
        requestedPage: memoCommand.fields?.requested_page,
      });
      acceptedMemoCommand = {
        ...memoCommand,
        valid: resolution.ok,
        reason: resolution.ok ? "" : resolution.reason,
        fields: {
          ...(memoCommand.fields || {}),
          page_number: resolution.ok ? resolution.page_number : null,
          page_count: resolution.ok ? resolution.page_count : 0,
          page_total: resolution.ok ? resolution.total : 0,
          page_global_start: resolution.ok ? resolution.global_start : 0,
          page_memo_ids: resolution.ok ? resolution.memo_ids : [],
          selection_snapshot_version: resolution.ok ? resolution.snapshot_version : "",
        },
      };
    }
    acceptanceRecord = createMemoCreateAcceptanceRecord({
      identity,
      memoCommand: acceptedMemoCommand,
      replyToken: normalized.reply_token,
      correlationId,
    });
    if (selectionDelete) {
      acceptanceRecord.normalized_command = {
        ...acceptanceRecord.normalized_command,
        memo_ids: acceptedMemoCommand.fields?.resolved_memo_ids || [],
        selection_candidates: acceptedMemoCommand.fields?.resolved_candidates || [],
        selection_snapshot_version: acceptedMemoCommand.fields?.selection_snapshot_version || "",
        selection_snapshot_expires_at: acceptedMemoCommand.fields?.selection_snapshot_expires_at || "",
      };
    } else if (memoCommand.intent === MEMO_SEARCH_PAGE_OPERATION) {
      acceptanceRecord.normalized_command = {
        ...acceptanceRecord.normalized_command,
        page_number: acceptedMemoCommand.fields?.page_number ?? null,
        page_count: acceptedMemoCommand.fields?.page_count || 0,
        page_total: acceptedMemoCommand.fields?.page_total || 0,
        page_global_start: acceptedMemoCommand.fields?.page_global_start || 0,
        page_memo_ids: acceptedMemoCommand.fields?.page_memo_ids || [],
        selection_snapshot_version: acceptedMemoCommand.fields?.selection_snapshot_version || "",
      };
    }
    const memoPutBudgetMs = memoAckRemainingBudgetMs({
      startedAt: ackStartedAt,
      budgetMs: ackBudgetMs,
      phase: "put",
    });
    if (memoPutBudgetMs <= 0) {
      logWebhookAckTiming(correlationId, "memo_durable_acceptance_failed", ackStartedAt, 503, "budget_exhausted");
      return durableAckUnavailableResponse("durable_acceptance_unavailable");
    }
    const acceptanceWrite = await runBoundedAckOperation(
      () => writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, acceptanceRecord),
      {
        startedAt: ackStartedAt,
        budgetMs: ackBudgetMs,
        maxOperationMs: memoPutBudgetMs,
        ctx,
        keepAlive: true,
      },
    );
    if (!acceptanceWrite.ok) {
      logWebhookAckTiming(correlationId, "memo_durable_acceptance_failed", ackStartedAt, 503, acceptanceWrite.error_class);
      return durableAckUnavailableResponse("durable_acceptance_unavailable");
    }
  }

  queueBackgroundTask(ctx, processAcceptedMemoDeterministicInBackground({
    event,
    memoCommand,
    env,
    acceptanceKey,
    validationAcceptanceRecord: acceptanceRecord.input_valid === false ? acceptanceRecord : null,
  }));
  logWebhookAckTiming(correlationId, resumed ? "memo_redelivery_resume_ack" : "memo_message_ack", ackStartedAt, 200, "none");
  return jsonResponse({
    status: "accepted",
    route: memoCommand.intent,
    resumed,
  }, 200);
}

export function memoAckRemainingBudgetMs({
  startedAt = Date.now(),
  budgetMs = LINE_WEBHOOK_ACK_BUDGET_MS,
  phase = "get",
  nowMs = Date.now(),
} = {}) {
  const elapsedMs = Math.max(0, Number(nowMs) - Number(startedAt));
  const responseSafeRemainingMs = Number(budgetMs) - elapsedMs - MEMO_ACK_RESPONSE_MARGIN_MS;
  const phaseReserveMs = phase === "get" ? MEMO_ACK_PUT_RESERVE_MS : 0;
  return Math.max(0, Math.floor(responseSafeRemainingMs - phaseReserveMs));
}

function memoCreateRecordBlocksDispatch(record = {}) {
  return [
    "dispatching",
    "dispatch_ambiguous",
    "dispatched",
    "waiting_confirmation",
    "reply_attempt_pending",
    "final_completed",
    "final_failed",
    "delivery_ambiguous",
    "reply_rejected",
    "reply_unavailable",
  ].includes(String(record.status || ""));
}

async function processAcceptedMemoDeterministicInBackground({
  event,
  memoCommand,
  env,
  acceptanceKey,
  validationAcceptanceRecord = null,
}) {
  const markAsReadTask = markLineMessageAsReadForEvent(event, { request_id: "", gate_marker: "" }, env);
  const validationHandoff = memoValidationAcceptanceHandoff(validationAcceptanceRecord, acceptanceKey);
  const current = validationHandoff
    || parseMemoCreateAcceptanceRecord(await env.IDEMPOTENCY_KV?.get(acceptanceKey));
  if (!current) {
    await Promise.allSettled([markAsReadTask]);
    return { ok: false, reason: "missing_memo_acceptance" };
  }

  if (!current.input_valid) {
    const replyText = memoValidationReplyText(current.operation, current.reject_reason);
    const result = await deliverMemoReplyOnce(env, acceptanceKey, replyText, "final_failed", {
      validationAcceptanceRecord: current,
    });
    await Promise.allSettled([markAsReadTask]);
    return result;
  }

  const selectionDeleteAwaitingConfirmation = current.operation === MEMO_DELETE_OPERATION
    && current.normalized_command?.selection_mode
    && current.normalized_command.selection_mode !== "memo_id"
    && current.normalized_command.confirmation_status !== "consumed";
  if (selectionDeleteAwaitingConfirmation) {
    const pending = createMemoDeleteConfirmationRecord(current);
    if (!pending) {
      const failed = await deliverMemoReplyOnce(
        env,
        acceptanceKey,
        MEMO_DELETE_SELECTION_MISSING_REPLY_TEXT,
        "final_failed",
      );
      await Promise.allSettled([markAsReadTask]);
      return failed;
    }
    const confirmationKey = memoDeleteConfirmationKey(current.selection_scope_hash);
    await writeMemoDeleteConfirmation(env.IDEMPOTENCY_KV, confirmationKey, pending);
    const readback = parseMemoDeleteConfirmationRecord(await env.IDEMPOTENCY_KV.get(confirmationKey));
    if (!readback || readback.status !== "waiting_confirmation" || readback.selection_event_hash !== current.safe_event_hash) {
      const failed = await deliverMemoReplyOnce(
        env,
        acceptanceKey,
        MEMO_DELETE_CONFIRMATION_MISSING_REPLY_TEXT,
        "final_failed",
      );
      await Promise.allSettled([markAsReadTask]);
      return failed;
    }
    await updateMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, (record) => ({
      ...record,
      status: "waiting_confirmation",
      dispatch_status: "waiting_confirmation",
      updated_at: new Date().toISOString(),
    }));
    const prompt = await deliverMemoReplyOnce(
      env,
      acceptanceKey,
      memoDeleteConfirmationPrompt(readback),
      "final_completed",
    );
    await Promise.allSettled([markAsReadTask]);
    return prompt;
  }

  const dispatching = {
    ...current,
    status: "dispatching",
    dispatch_status: "dispatching",
    dispatch_started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, dispatching);

  let n8nResult;
  try {
    n8nResult = await callN8nWebhook(buildMemoDeterministicN8nPayload(dispatching), env);
  } catch {
    await updateMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, (record) => ({
      ...record,
      status: "dispatch_ambiguous",
      dispatch_status: "ambiguous",
      updated_at: new Date().toISOString(),
    }));
    await Promise.allSettled([markAsReadTask]);
    return { ok: false, reason: "memo_dispatch_ambiguous" };
  }

  await updateMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, (record) => ({
    ...record,
    status: memoCreateFinalStatus(record.status) ? record.status : "dispatched",
    dispatch_status: n8nResult.ok ? "dispatched" : "failed",
    dispatched_at: n8nResult.ok ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }));

  if (!n8nResult.ok || !memoDeterministicN8nResponseAccepted(n8nResult.body, dispatching)) {
    const failureText = dispatching.operation === MEMO_CREATE_OPERATION
      ? MEMO_CREATE_FAILED_REPLY_TEXT
      : MEMO_OPERATION_FAILED_REPLY_TEXT;
    await deliverMemoReplyOnce(env, acceptanceKey, failureText, "final_failed");
  }
  await Promise.allSettled([markAsReadTask]);
  return n8nResult;
}

export function buildMemoCreateN8nPayload(record = {}, canonicalContent = "") {
  return {
    intent: MEMO_CREATE_OPERATION,
    safe_event_hash: String(record.safe_event_hash || ""),
    memo_id: String(record.memo_id || ""),
    canonical_content: String(canonicalContent || "").trim(),
    received_at: String(record.received_at || ""),
    reply_delivery_reference: {
      callback_url: String(record.callback_reference?.callback_url || ""),
      task_id: String(record.callback_reference?.task_id || ""),
      request_id: String(record.callback_reference?.request_id || ""),
    },
  };
}

export function buildMemoDeterministicN8nPayload(record = {}) {
  if (record.operation === MEMO_CREATE_OPERATION) {
    return buildMemoCreateN8nPayload(record, record.normalized_command?.content || "");
  }
  const base = {
    intent: String(record.operation || ""),
    safe_event_hash: String(record.safe_event_hash || ""),
    received_at: String(record.received_at || ""),
    reply_delivery_reference: {
      callback_url: String(record.callback_reference?.callback_url || ""),
      task_id: String(record.callback_reference?.task_id || ""),
      request_id: String(record.callback_reference?.request_id || ""),
    },
  };
  if (record.operation === MEMO_SEARCH_OPERATION) {
    return {
      ...base,
      keyword: String(record.normalized_command?.keyword || ""),
      list_all: record.normalized_command?.list_all === true,
    };
  }
  if (record.operation === MEMO_SEARCH_PAGE_OPERATION) {
    return {
      ...base,
      page_scope: "memo_search_selection_snapshot",
      selection_snapshot_version: String(record.normalized_command?.selection_snapshot_version || ""),
      page_number: Number(record.normalized_command?.page_number || 0),
      page_count: Number(record.normalized_command?.page_count || 0),
      total: Number(record.normalized_command?.page_total || 0),
      global_start: Number(record.normalized_command?.page_global_start || 0),
      memo_ids: Array.isArray(record.normalized_command?.page_memo_ids)
        ? record.normalized_command.page_memo_ids.map((memoId) => String(memoId || ""))
        : [],
    };
  }
  if (record.operation === MEMO_MODIFY_OPERATION) {
    return {
      ...base,
      memo_id: String(record.normalized_command?.memo_id || ""),
      new_content: String(record.normalized_command?.new_content || ""),
    };
  }
  if (record.operation === MEMO_DELETE_OPERATION) {
    if (record.normalized_command?.selection_mode && record.normalized_command.selection_mode !== "memo_id") {
      return {
        ...base,
        delete_scope: "memo_search_selection_snapshot",
        selection_mode: String(record.normalized_command.selection_mode || ""),
        selection_snapshot_version: String(record.normalized_command.selection_snapshot_version || ""),
        confirmation_status: String(record.normalized_command.confirmation_status || ""),
        memo_ids: Array.isArray(record.normalized_command.memo_ids)
          ? record.normalized_command.memo_ids.map((memoId) => String(memoId || ""))
          : [],
      };
    }
    return {
      ...base,
      memo_id: String(record.normalized_command?.memo_id || ""),
    };
  }
  return base;
}

function memoCreateN8nResponseAccepted(body = {}, memoId = "") {
  body = normalizeN8nResponseBody(body);
  return Boolean(
    body
    && body.intent === MEMO_CREATE_OPERATION
    && body.memo_id === memoId
    && body.callback_sent === true
    && ["completed", "duplicate"].includes(String(body.status || ""))
  );
}

function memoDeterministicN8nResponseAccepted(body = {}, record = {}) {
  if (record.operation === MEMO_CREATE_OPERATION) {
    return memoCreateN8nResponseAccepted(body, record.memo_id);
  }
  body = normalizeN8nResponseBody(body);
  if (
    !body
    || body.intent !== record.operation
    || body.callback_sent !== true
    || !["completed", "duplicate"].includes(String(body.status || ""))
  ) {
    return false;
  }
  if (
    record.operation === MEMO_DELETE_OPERATION
    && record.normalized_command?.selection_mode
    && record.normalized_command.selection_mode !== "memo_id"
  ) {
    const expectedMemoIds = Array.isArray(record.normalized_command?.memo_ids)
      ? record.normalized_command.memo_ids
      : [];
    const responseMemoIds = Array.isArray(body.memo_ids) ? body.memo_ids : [];
    return expectedMemoIds.length > 0
      && expectedMemoIds.length === responseMemoIds.length
      && expectedMemoIds.every((memoId, index) => memoId === responseMemoIds[index]);
  }
  if (record.operation === MEMO_SEARCH_PAGE_OPERATION) {
    const expectedMemoIds = Array.isArray(record.normalized_command?.page_memo_ids)
      ? record.normalized_command.page_memo_ids
      : [];
    const responseMemoIds = Array.isArray(body.memo_ids) ? body.memo_ids : [];
    return expectedMemoIds.length > 0
      && expectedMemoIds.length === responseMemoIds.length
      && expectedMemoIds.every((memoId, index) => memoId === responseMemoIds[index]);
  }
  if ([MEMO_MODIFY_OPERATION, MEMO_DELETE_OPERATION].includes(record.operation)) {
    return body.memo_id === record.memo_id;
  }
  return true;
}

function memoValidationReplyText(operation = "", reason = "") {
  if (reason === "content_too_long") {
    return operation === MEMO_CREATE_OPERATION
      ? MEMO_CREATE_TOO_LONG_REPLY_TEXT
      : MEMO_OPERATION_TOO_LONG_REPLY_TEXT;
  }
  if (reason === "selection_snapshot_missing" || reason === "selection_snapshot_invalid" || reason === "selection_snapshot_empty") {
    return MEMO_DELETE_SELECTION_MISSING_REPLY_TEXT;
  }
  if (reason === "selection_snapshot_expired") return MEMO_DELETE_SELECTION_EXPIRED_REPLY_TEXT;
  if (reason === "selection_index_out_of_range") return MEMO_DELETE_SELECTION_RANGE_REPLY_TEXT;
  if (reason === "selection_too_large" || reason === "selection_batch_limit_unverified") {
    return MEMO_DELETE_SELECTION_TOO_LARGE_REPLY_TEXT;
  }
  if (reason === "selection_summary_unavailable") return MEMO_DELETE_SELECTION_MISSING_REPLY_TEXT;
  if (reason === "delete_requires_search_selection") return MEMO_DELETE_SELECTION_MISSING_REPLY_TEXT;
  if (String(reason || "").startsWith("confirmation_")) return memoDeleteConfirmationFailureReply(reason);
  if (["invalid_selection_format", "invalid_selection_range", "invalid_selection_mode", "empty_selection"].includes(reason)) {
    return MEMO_DELETE_SELECTION_FORMAT_REPLY_TEXT;
  }
  if (reason === "page_snapshot_missing" || reason === "page_snapshot_invalid" || reason === "page_snapshot_empty") {
    return MEMO_SEARCH_PAGE_MISSING_REPLY_TEXT;
  }
  if (reason === "page_snapshot_expired") return MEMO_SEARCH_PAGE_EXPIRED_REPLY_TEXT;
  if (reason === "page_out_of_range") return MEMO_SEARCH_PAGE_RANGE_REPLY_TEXT;
  if (reason === "invalid_page_command") return MEMO_SEARCH_PAGE_FORMAT_REPLY_TEXT;
  if (operation === MEMO_SEARCH_OPERATION) return MEMO_SEARCH_EMPTY_REPLY_TEXT;
  if (operation === MEMO_SEARCH_PAGE_OPERATION) return MEMO_SEARCH_PAGE_FORMAT_REPLY_TEXT;
  if (operation === MEMO_MODIFY_OPERATION) return MEMO_MODIFY_FORMAT_REPLY_TEXT;
  if (operation === MEMO_DELETE_OPERATION) return MEMO_DELETE_FORMAT_REPLY_TEXT;
  return MEMO_CREATE_EMPTY_REPLY_TEXT;
}

function memoCreateFinalStatus(status = "") {
  return ["final_completed", "final_failed", "delivery_ambiguous", "reply_rejected", "reply_unavailable"].includes(status);
}

async function updateMemoCreateAcceptance(kv, key, updater) {
  const current = parseMemoCreateAcceptanceRecord(await kv?.get(key));
  if (!current) return { ok: false, reason: "missing_memo_acceptance" };
  const next = updater(current);
  await writeMemoCreateAcceptance(kv, key, next);
  return { ok: true, record: next };
}

async function writeMemoCreateAcceptance(kv, key, record) {
  if (!kv?.put || !key) throw new Error("missing_memo_acceptance_store");
  await kv.put(key, JSON.stringify(record), { expirationTtl: EVIDENCE_TTL_SECONDS });
  return { ok: true };
}

function memoCreateAcceptanceKey(safeEventHash = "") {
  return `${MEMO_CREATE_ACCEPTANCE_PREFIX}:${safeEventHash}`;
}

function memoSearchSelectionKey(scopeHash = "") {
  return `${MEMO_SEARCH_SELECTION_PREFIX}:${scopeHash}`;
}

function memoDeleteConfirmationKey(scopeHash = "") {
  return `${MEMO_DELETE_CONFIRMATION_PREFIX}:${scopeHash}`;
}

function parseMemoDeleteConfirmationRecord(raw = "") {
  const record = parseJsonSafely(raw);
  if (
    !record
    || record.schema !== MEMO_DELETE_CONFIRMATION_SCHEMA
    || !["waiting_confirmation", "consumed", "cancelled"].includes(String(record.status || ""))
    || !/^[a-f0-9]{64}$/.test(String(record.scope_hash || ""))
    || !/^[a-f0-9]{64}$/.test(String(record.snapshot_version || ""))
    || !/^[a-f0-9]{64}$/.test(String(record.selection_event_hash || ""))
    || !["single", "multiple", "range", "all"].includes(String(record.selection_mode || ""))
    || !Array.isArray(record.selected)
    || record.selected.length < 1
    || record.selected.length > MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS
    || !Number.isFinite(Date.parse(String(record.created_at || "")))
    || !Number.isFinite(Date.parse(String(record.expires_at || "")))
  ) return null;
  const selected = record.selected.map((candidate) => ({
    position: Number(candidate?.position),
    memo_id: String(candidate?.memo_id || ""),
    summary: String(candidate?.summary || ""),
  }));
  if (
    selected.some((candidate) => (
      !Number.isSafeInteger(candidate.position)
      || candidate.position < 1
      || !MEMO_ID_PATTERN.test(candidate.memo_id)
      || !candidate.summary
      || candidate.summary !== safeMemoSearchSummary(candidate.summary)
    ))
    || new Set(selected.map((candidate) => candidate.memo_id)).size !== selected.length
  ) return null;
  return { ...record, selected };
}

function memoDeleteConfirmationPrompt(record = {}) {
  const lines = (record.selected || []).map((candidate) => `${candidate.position}. ${safeMemoSearchSummary(candidate.summary)}`).join("\n");
  return `即將刪除 ${record.selected.length} 筆備忘錄：\n${lines}\n請回覆「確認刪除」或「取消」。`;
}

function createMemoDeleteConfirmationRecord(acceptanceRecord = {}, nowMs = Date.now()) {
  const selected = Array.isArray(acceptanceRecord.normalized_command?.selection_candidates)
    ? acceptanceRecord.normalized_command.selection_candidates.map((candidate) => ({
        position: Number(candidate?.position),
        memo_id: String(candidate?.memo_id || ""),
        summary: safeMemoSearchSummary(candidate?.summary || ""),
      }))
    : [];
  const snapshotExpiryMs = Date.parse(String(acceptanceRecord.normalized_command?.selection_snapshot_expires_at || ""));
  const expiresAtMs = Math.min(
    Number(nowMs) + (MEMO_DELETE_CONFIRMATION_TTL_SECONDS * 1000),
    Number.isFinite(snapshotExpiryMs) ? snapshotExpiryMs : Number(nowMs),
  );
  const record = {
    schema: MEMO_DELETE_CONFIRMATION_SCHEMA,
    status: "waiting_confirmation",
    scope_hash: String(acceptanceRecord.selection_scope_hash || ""),
    snapshot_version: String(acceptanceRecord.normalized_command?.selection_snapshot_version || ""),
    selection_event_hash: String(acceptanceRecord.safe_event_hash || ""),
    selection_mode: String(acceptanceRecord.normalized_command?.selection_mode || ""),
    selected,
    created_at: new Date(nowMs).toISOString(),
    expires_at: new Date(expiresAtMs).toISOString(),
    consumed_by_event_hash: "",
    consumed_at: "",
  };
  return parseMemoDeleteConfirmationRecord(JSON.stringify(record));
}

async function writeMemoDeleteConfirmation(kv, key, record) {
  if (!kv?.put || !key || !record) throw new Error("missing_memo_delete_confirmation_store");
  const remainingSeconds = Math.max(1, Math.ceil((Date.parse(record.expires_at) - Date.now()) / 1000));
  await kv.put(key, JSON.stringify(record), { expirationTtl: Math.min(MEMO_DELETE_CONFIRMATION_TTL_SECONDS, remainingSeconds) });
  return { ok: true };
}

function memoDeleteConfirmationFailureReply(reason = "") {
  if (reason === "confirmation_cancelled") return MEMO_DELETE_CONFIRMATION_CANCELLED_REPLY_TEXT;
  if (reason === "confirmation_expired") return MEMO_DELETE_CONFIRMATION_EXPIRED_REPLY_TEXT;
  if (["confirmation_snapshot_changed", "confirmation_candidate_changed"].includes(reason)) {
    return MEMO_DELETE_CONFIRMATION_CHANGED_REPLY_TEXT;
  }
  if (reason === "confirmation_already_consumed") return MEMO_DELETE_CONFIRMATION_CONSUMED_REPLY_TEXT;
  return MEMO_DELETE_CONFIRMATION_MISSING_REPLY_TEXT;
}

export async function handleMemoDeleteConfirmationAcceptance({
  event,
  normalized,
  confirmationAction,
  env,
  ctx,
  correlationId,
  ackStartedAt,
  ackBudgetMs,
}) {
  if (!env.IDEMPOTENCY_KV) {
    logWebhookAckTiming(correlationId, "memo_confirmation_idempotency_failed", ackStartedAt, 503, "missing_binding");
    return durableAckUnavailableResponse("missing_IDEMPOTENCY_KV");
  }
  const syntheticCommand = memoCommandResult(MEMO_DELETE_OPERATION, true, {
    selection_mode: "confirmation",
    selection_indices: [],
  });
  const identity = await buildMemoDeterministicIdentity(event, syntheticCommand, env, normalized.received_at);
  if (!identity.ok) return durableAckUnavailableResponse("memo_confirmation_identity_unavailable");
  const acceptanceKey = memoCreateAcceptanceKey(identity.safe_event_hash);
  const confirmationKey = memoDeleteConfirmationKey(identity.selection_scope_hash);
  const selectionKey = memoSearchSelectionKey(identity.selection_scope_hash);
  const getBudgetMs = memoAckRemainingBudgetMs({ startedAt: ackStartedAt, budgetMs: ackBudgetMs, phase: "get" });
  const read = await runBoundedAckOperation(
    () => Promise.all([
      env.IDEMPOTENCY_KV.get(acceptanceKey),
      env.IDEMPOTENCY_KV.get(confirmationKey),
      env.IDEMPOTENCY_KV.get(selectionKey),
    ]),
    { startedAt: ackStartedAt, budgetMs: ackBudgetMs, maxOperationMs: getBudgetMs, ctx },
  );
  if (!read.ok) return durableAckUnavailableResponse("memo_confirmation_state_unavailable");
  const existing = parseMemoCreateAcceptanceRecord(read.value?.[0]);
  if (existing && memoCreateRecordBlocksDispatch(existing)) {
    logWebhookAckTiming(correlationId, "memo_confirmation_duplicate_ack", ackStartedAt, 200, "none");
    return jsonResponse({ status: "accepted", reason: "duplicate_line_event", route: "memo_delete_confirmation" }, 200);
  }

  const pending = parseMemoDeleteConfirmationRecord(read.value?.[1]);
  const snapshot = parseMemoSearchSelectionSnapshot(read.value?.[2]);
  const nowMs = Date.now();
  let rejectReason = "";
  if (!pending || pending.scope_hash !== identity.selection_scope_hash) rejectReason = "confirmation_missing";
  else if (pending.status === "consumed") rejectReason = "confirmation_already_consumed";
  else if (pending.status === "cancelled") rejectReason = "confirmation_cancelled";
  else if (Date.parse(pending.expires_at) <= nowMs) rejectReason = "confirmation_expired";
  else if (!snapshot || snapshot.scope_hash !== pending.scope_hash || snapshot.search_event_hash !== pending.snapshot_version) {
    rejectReason = "confirmation_snapshot_changed";
  } else if (pending.selected.some((candidate) => {
    const current = snapshot.candidates[candidate.position - 1];
    return !current || current.memo_id !== candidate.memo_id || current.summary !== candidate.summary;
  })) rejectReason = "confirmation_candidate_changed";

  if (confirmationAction === "cancel" && !rejectReason) rejectReason = "confirmation_cancelled";
  if (confirmationAction !== "confirm" && confirmationAction !== "cancel") rejectReason = "confirmation_missing";

  const selected = pending?.selected || [];
  const memoCommand = memoCommandResult(MEMO_DELETE_OPERATION, !rejectReason && confirmationAction === "confirm", {
    selection_mode: pending?.selection_mode || "single",
    selection_indices: selected.map((candidate) => candidate.position),
  }, rejectReason);
  const acceptanceRecord = createMemoCreateAcceptanceRecord({
    identity,
    memoCommand,
    replyToken: normalized.reply_token,
    correlationId,
  });
  acceptanceRecord.normalized_command = {
    selection_mode: pending?.selection_mode || "single",
    selection_indices: selected.map((candidate) => candidate.position),
    memo_ids: selected.map((candidate) => candidate.memo_id),
    selection_candidates: selected,
    selection_snapshot_version: pending?.snapshot_version || "",
    confirmation_status: !rejectReason && confirmationAction === "confirm" ? "consumed" : "rejected",
  };

  if (confirmationAction === "cancel" && pending?.status === "waiting_confirmation") {
    await writeMemoDeleteConfirmation(env.IDEMPOTENCY_KV, confirmationKey, {
      ...pending,
      status: "cancelled",
      consumed_by_event_hash: identity.safe_event_hash,
      consumed_at: new Date(nowMs).toISOString(),
    });
  }

  if (!rejectReason && confirmationAction === "confirm") {
    const consumed = {
      ...pending,
      status: "consumed",
      consumed_by_event_hash: identity.safe_event_hash,
      consumed_at: new Date(nowMs).toISOString(),
    };
    await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, acceptanceRecord);
    await writeMemoDeleteConfirmation(env.IDEMPOTENCY_KV, confirmationKey, consumed);
    const readback = parseMemoDeleteConfirmationRecord(await env.IDEMPOTENCY_KV.get(confirmationKey));
    if (!readback || readback.status !== "consumed" || readback.consumed_by_event_hash !== identity.safe_event_hash) {
      acceptanceRecord.input_valid = false;
      acceptanceRecord.reject_reason = "confirmation_consume_readback_failed";
      acceptanceRecord.normalized_command.confirmation_status = "rejected";
      await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, acceptanceRecord);
    }
  } else {
    await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, acceptanceRecord);
  }

  queueBackgroundTask(ctx, processAcceptedMemoDeterministicInBackground({
    event,
    memoCommand,
    env,
    acceptanceKey,
    validationAcceptanceRecord: acceptanceRecord.input_valid === false ? acceptanceRecord : null,
  }));
  logWebhookAckTiming(correlationId, "memo_confirmation_ack", ackStartedAt, 200, "none");
  return jsonResponse({ status: "accepted", route: "memo_delete_confirmation", resumed: false }, 200);
}

function memoDeleteUsesSearchSelection(memoCommand = {}) {
  return memoCommand.intent === MEMO_DELETE_OPERATION
    && memoCommand.valid
    && memoCommand.fields?.selection_mode
    && memoCommand.fields.selection_mode !== "memo_id";
}

function memoUsesSearchSnapshot(memoCommand = {}) {
  return memoDeleteUsesSearchSelection(memoCommand)
    || (memoCommand.intent === MEMO_SEARCH_PAGE_OPERATION && memoCommand.valid);
}

function safeMemoSearchSummary(value = "") {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  const redacted = compact
    .replace(/memo-[a-f0-9]{64}/gi, "（已隱藏編號）")
    .replace(/(?:\/Users\/|\/菲比工作總倉庫\/)[^\s｜]*/g, "（已隱藏路徑）")
    .replace(/[^\u0009\u0020-\u007e\u00a0-\uffff]/g, "")
    .trim();
  if (!redacted) return "（內容已隱藏）";
  return redacted.length > 120 ? `${redacted.slice(0, 119)}…` : redacted;
}

function invalidMemoSearchResult(reason = "invalid_search_candidate_set", safeReplyText = "") {
  return { ok: false, reason, candidates: [], page_candidates: [], total: 0, reply_text: safeReplyText };
}

function normalizeMemoSearchPageCandidates(pageCandidates, expectedMemoIds, globalStart) {
  if (!Array.isArray(pageCandidates) || pageCandidates.length !== expectedMemoIds.length) return null;
  const normalized = pageCandidates.map((candidate, index) => {
    const rawSummary = typeof candidate?.summary === "string" ? candidate.summary.trim() : "";
    return {
      position: Number(candidate?.position),
      memo_id: String(candidate?.memo_id || ""),
      summary: rawSummary ? safeMemoSearchSummary(rawSummary) : "",
      expected_position: globalStart + index,
      expected_memo_id: expectedMemoIds[index],
    };
  });
  if (normalized.some((candidate) => (
    candidate.position !== candidate.expected_position
    || candidate.memo_id !== candidate.expected_memo_id
    || !MEMO_ID_PATTERN.test(candidate.memo_id)
    || !candidate.summary
  ))) return null;
  return normalized.map(({ expected_position, expected_memo_id, ...candidate }) => candidate);
}

function memoSearchPageReplyText(total, pageNumber, pageCount, pageCandidates) {
  if (total === 0) return "沒有找到符合的使用中備忘錄。";
  return `找到 ${total} 筆使用中備忘錄，第 ${pageNumber}/${pageCount} 頁。${pageCandidates.map((candidate) => `\n${candidate.position}. ${candidate.summary}`).join("")}`;
}

export function parseMemoSearchSelectionResult(
  replyText = "",
  structuredCandidates = null,
  structuredTotal = null,
  structuredPageCandidates = null,
  structuredPageNumber = 1,
) {
  const declaredTotal = Number(structuredTotal);
  if (Number.isSafeInteger(declaredTotal) && declaredTotal > MEMO_SEARCH_SELECTION_MAX_CANDIDATES) {
    return invalidMemoSearchResult("search_candidate_limit_exceeded", MEMO_SEARCH_RESULT_LIMIT_REPLY_TEXT);
  }
  if (Array.isArray(structuredCandidates)) {
    const total = Number(structuredTotal);
    if (!Number.isSafeInteger(total) || total < 0) return invalidMemoSearchResult();
    if (total > MEMO_SEARCH_SELECTION_MAX_CANDIDATES) {
      return invalidMemoSearchResult("search_candidate_limit_exceeded", MEMO_SEARCH_RESULT_LIMIT_REPLY_TEXT);
    }
    if (structuredCandidates.length !== total) {
      return invalidMemoSearchResult("incomplete_search_candidate_set", MEMO_SEARCH_RESULT_INCOMPLETE_REPLY_TEXT);
    }
    const candidates = structuredCandidates.map((candidate, index) => ({
      position: Number(candidate?.position),
      memo_id: String(candidate?.memo_id || ""),
      expected_position: index + 1,
    }));
    if (
      candidates.some((candidate) => candidate.position !== candidate.expected_position || !MEMO_ID_PATTERN.test(candidate.memo_id))
      || new Set(candidates.map((candidate) => candidate.memo_id)).size !== candidates.length
    ) return invalidMemoSearchResult();

    const normalizedCandidates = candidates.map(({ expected_position, ...candidate }) => candidate);
    if (total === 0) {
      return {
        ok: true,
        candidates: [],
        page_candidates: [],
        total: 0,
        page: 0,
        page_count: 0,
        reply_text: memoSearchPageReplyText(0, 0, 0, []),
      };
    }
    const pageCount = Math.ceil(total / MEMO_SEARCH_PAGE_SIZE);
    const pageNumber = Number(structuredPageNumber);
    if (pageNumber !== 1) return invalidMemoSearchResult("invalid_search_page_number");
    const expectedFirstPageIds = normalizedCandidates.slice(0, MEMO_SEARCH_PAGE_SIZE).map((candidate) => candidate.memo_id);
    const pageSource = Array.isArray(structuredPageCandidates)
      ? structuredPageCandidates
      : total <= MEMO_SEARCH_PAGE_SIZE ? structuredCandidates : null;
    const pageCandidates = normalizeMemoSearchPageCandidates(pageSource, expectedFirstPageIds, 1);
    if (!pageCandidates) return invalidMemoSearchResult("invalid_search_page_candidate_set");
    return {
      ok: true,
      candidates: normalizedCandidates,
      page_candidates: pageCandidates,
      total,
      page: 1,
      page_count: pageCount,
      reply_text: memoSearchPageReplyText(total, 1, pageCount, pageCandidates),
    };
  }

  const text = String(replyText || "").replace(/\r\n?/g, "\n").trim();
  if (text === "沒有找到符合的使用中備忘錄。") {
    return parseMemoSearchSelectionResult("", [], 0, [], 1);
  }
  const lines = text.split("\n");
  const header = lines.shift()?.match(/^找到 ([1-9]\d*) 筆使用中備忘錄。$/);
  if (!header) {
    return invalidMemoSearchResult("invalid_search_result_shape");
  }
  const total = Number(header[1]);
  if (total > MEMO_SEARCH_SELECTION_MAX_CANDIDATES) {
    return invalidMemoSearchResult("search_candidate_limit_exceeded", MEMO_SEARCH_RESULT_LIMIT_REPLY_TEXT);
  }
  if (lines.length === 0 || lines.length > MEMO_SEARCH_PAGE_SIZE) {
    return invalidMemoSearchResult("invalid_search_result_shape");
  }
  const candidates = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^([1-9]\d*)\.\s+(memo-[a-f0-9]{64})｜(.+)$/);
    if (!match || Number(match[1]) !== index + 1 || !match[3].trim()) {
      return invalidMemoSearchResult("invalid_search_candidate");
    }
    candidates.push({ position: index + 1, memo_id: match[2], summary: match[3] });
  }
  if (total !== candidates.length) {
    return invalidMemoSearchResult("incomplete_search_candidate_set", MEMO_SEARCH_RESULT_INCOMPLETE_REPLY_TEXT);
  }
  return parseMemoSearchSelectionResult("", candidates, total, candidates, 1);
}

export function parseMemoSearchPageResult({
  pageCandidates = null,
  expectedMemoIds = [],
  pageNumber = 0,
  pageCount = 0,
  total = 0,
  globalStart = 0,
} = {}) {
  const normalizedExpectedIds = Array.isArray(expectedMemoIds) ? expectedMemoIds.map(String) : [];
  if (
    !Number.isSafeInteger(pageNumber) || pageNumber < 1
    || !Number.isSafeInteger(pageCount) || pageCount < 1 || pageNumber > pageCount
    || !Number.isSafeInteger(total) || total < 1 || total > MEMO_SEARCH_SELECTION_MAX_CANDIDATES
    || !Number.isSafeInteger(globalStart) || globalStart !== ((pageNumber - 1) * MEMO_SEARCH_PAGE_SIZE) + 1
    || normalizedExpectedIds.length < 1 || normalizedExpectedIds.length > MEMO_SEARCH_PAGE_SIZE
    || normalizedExpectedIds.some((memoId) => !MEMO_ID_PATTERN.test(memoId))
  ) return { ok: false, reason: "invalid_page_contract", page_candidates: [], reply_text: "" };
  const normalizedPageCandidates = normalizeMemoSearchPageCandidates(pageCandidates, normalizedExpectedIds, globalStart);
  if (!normalizedPageCandidates) {
    return { ok: false, reason: "invalid_page_candidate_set", page_candidates: [], reply_text: "" };
  }
  return {
    ok: true,
    page: pageNumber,
    page_count: pageCount,
    total,
    page_candidates: normalizedPageCandidates,
    reply_text: memoSearchPageReplyText(total, pageNumber, pageCount, normalizedPageCandidates),
  };
}

export function parseMemoSearchSelectionSnapshot(raw = "") {
  const snapshot = parseJsonSafely(raw);
  const expectedKeys = [
    "candidates", "created_at", "current_page", "delete_all_eligible", "delete_all_limit",
    "expires_at", "page_count", "page_size", "schema", "scope_hash", "search_event_hash", "total",
  ].sort().join("|");
  if (
    !snapshot
    || snapshot.schema !== MEMO_SEARCH_SELECTION_SCHEMA
    || Object.keys(snapshot).sort().join("|") !== expectedKeys
    || !/^[a-f0-9]{64}$/.test(String(snapshot.scope_hash || ""))
    || !/^[a-f0-9]{64}$/.test(String(snapshot.search_event_hash || ""))
    || !Number.isFinite(Date.parse(String(snapshot.created_at || "")))
    || !Number.isFinite(Date.parse(String(snapshot.expires_at || "")))
    || !Array.isArray(snapshot.candidates)
    || snapshot.candidates.length > MEMO_SEARCH_SELECTION_MAX_CANDIDATES
    || snapshot.page_size !== MEMO_SEARCH_PAGE_SIZE
    || snapshot.delete_all_limit !== MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS
  ) return null;
  const candidates = snapshot.candidates.map((candidate) => ({
    position: Number(candidate?.position),
    memo_id: String(candidate?.memo_id || ""),
    summary: String(candidate?.summary || ""),
  }));
  const total = Number(snapshot.total);
  const pageCount = Number(snapshot.page_count);
  const currentPage = Number(snapshot.current_page);
  const expectedPageCount = total === 0 ? 0 : Math.ceil(total / MEMO_SEARCH_PAGE_SIZE);
  const expectedDeleteAllEligible = candidates.length > 0
    && candidates.length <= MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS;
  if (
    snapshot.candidates.some((candidate) => !candidate || Object.keys(candidate).sort().join("|") !== "memo_id|position|summary")
    || candidates.some((candidate, index) => (
      candidate.position !== index + 1
      || !MEMO_ID_PATTERN.test(candidate.memo_id)
      || (candidate.summary && candidate.summary !== safeMemoSearchSummary(candidate.summary))
    ))
    || new Set(candidates.map((candidate) => candidate.memo_id)).size !== candidates.length
    || total !== candidates.length
    || pageCount !== expectedPageCount
    || !Number.isSafeInteger(currentPage)
    || currentPage !== (total === 0 ? 0 : Math.min(Math.max(currentPage, 1), pageCount))
    || snapshot.delete_all_eligible !== expectedDeleteAllEligible
  ) return null;
  return { ...snapshot, candidates, total, page_count: pageCount, current_page: currentPage };
}

export function resolveMemoSearchSelectionDelete({
  snapshotRaw = "",
  scopeHash = "",
  selectionMode = "",
  selectionIndices = [],
  nowMs = Date.now(),
} = {}) {
  if (!snapshotRaw) return { ok: false, reason: "selection_snapshot_missing", memo_ids: [] };
  const snapshot = parseMemoSearchSelectionSnapshot(snapshotRaw);
  if (!snapshot || snapshot.scope_hash !== scopeHash) {
    return { ok: false, reason: "selection_snapshot_invalid", memo_ids: [] };
  }
  if (Date.parse(snapshot.expires_at) <= Number(nowMs)) {
    return { ok: false, reason: "selection_snapshot_expired", memo_ids: [] };
  }
  if (snapshot.candidates.length === 0) {
    return { ok: false, reason: "selection_snapshot_empty", memo_ids: [] };
  }

  if (!["single", "multiple", "range", "all"].includes(selectionMode)) {
    return { ok: false, reason: "invalid_selection_mode", memo_ids: [] };
  }
  if (selectionMode === "all" && !snapshot.delete_all_eligible) {
    return { ok: false, reason: "selection_too_large", memo_ids: [] };
  }
  const rawIndices = selectionMode === "all"
    ? snapshot.candidates.map((candidate) => candidate.position)
    : Array.isArray(selectionIndices) ? selectionIndices.map((value) => Number(value)) : [];
  const indices = [...new Set(rawIndices)].sort((left, right) => left - right);
  if (indices.length === 0) {
    return { ok: false, reason: "empty_selection", memo_ids: [] };
  }
  if (indices.some((index) => !Number.isSafeInteger(index) || index < 1 || index > snapshot.candidates.length)) {
    return { ok: false, reason: "selection_index_out_of_range", memo_ids: [] };
  }
  if (indices.length > MEMO_SELECTION_WORKER_BATCH_REQUEST_LIMIT) {
    return { ok: false, reason: "selection_batch_limit_unverified", memo_ids: [] };
  }
  if (indices.some((index) => !snapshot.candidates[index - 1].summary)) {
    return { ok: false, reason: "selection_summary_unavailable", memo_ids: [] };
  }
  return {
    ok: true,
    reason: "",
    memo_ids: indices.map((index) => snapshot.candidates[index - 1].memo_id),
    candidates: indices.map((index) => snapshot.candidates[index - 1]),
    snapshot_version: snapshot.search_event_hash,
    snapshot_expires_at: snapshot.expires_at,
  };
}

export function resolveMemoSearchPage({
  snapshotRaw = "",
  scopeHash = "",
  pageMode = "",
  requestedPage = null,
  nowMs = Date.now(),
} = {}) {
  if (!snapshotRaw) return { ok: false, reason: "page_snapshot_missing", memo_ids: [] };
  const snapshot = parseMemoSearchSelectionSnapshot(snapshotRaw);
  if (!snapshot || snapshot.scope_hash !== scopeHash) return { ok: false, reason: "page_snapshot_invalid", memo_ids: [] };
  if (Date.parse(snapshot.expires_at) <= Number(nowMs)) return { ok: false, reason: "page_snapshot_expired", memo_ids: [] };
  if (snapshot.total === 0) return { ok: false, reason: "page_snapshot_empty", memo_ids: [] };
  let pageNumber;
  if (pageMode === "next") pageNumber = snapshot.current_page + 1;
  else if (pageMode === "previous") pageNumber = snapshot.current_page - 1;
  else if (pageMode === "numbered") pageNumber = Number(requestedPage);
  else return { ok: false, reason: "invalid_page_command", memo_ids: [] };
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > snapshot.page_count) {
    return { ok: false, reason: "page_out_of_range", memo_ids: [] };
  }
  const startIndex = (pageNumber - 1) * MEMO_SEARCH_PAGE_SIZE;
  const memoIds = snapshot.candidates.slice(startIndex, startIndex + MEMO_SEARCH_PAGE_SIZE).map((candidate) => candidate.memo_id);
  return {
    ok: true,
    reason: "",
    page_number: pageNumber,
    page_count: snapshot.page_count,
    total: snapshot.total,
    global_start: startIndex + 1,
    memo_ids: memoIds,
    snapshot_version: snapshot.search_event_hash,
  };
}

async function persistMemoSearchSelectionSnapshot(kv, record = {}, parsedResult = {}, nowMs = Date.now()) {
  const scopeHash = String(record.selection_scope_hash || "");
  if (!kv?.put || !/^[a-f0-9]{64}$/.test(scopeHash) || !/^[a-f0-9]{64}$/.test(String(record.safe_event_hash || ""))) {
    return { ok: false, reason: "invalid_selection_snapshot_identity" };
  }
  const createdAt = new Date(nowMs).toISOString();
  const summaryByPosition = new Map((parsedResult.page_candidates || []).map((candidate) => [
    Number(candidate.position),
    safeMemoSearchSummary(candidate.summary),
  ]));
  const snapshot = {
    schema: MEMO_SEARCH_SELECTION_SCHEMA,
    scope_hash: scopeHash,
    search_event_hash: String(record.safe_event_hash || ""),
    candidates: (parsedResult.candidates || []).map((candidate) => ({
      position: Number(candidate.position),
      memo_id: String(candidate.memo_id || ""),
      summary: summaryByPosition.get(Number(candidate.position)) || "",
    })),
    total: Number(parsedResult.total || 0),
    page_size: MEMO_SEARCH_PAGE_SIZE,
    page_count: Number(parsedResult.page_count || 0),
    current_page: Number(parsedResult.page || 0),
    delete_all_eligible: Number(parsedResult.total || 0) > 0
      && Number(parsedResult.total || 0) <= MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS,
    delete_all_limit: MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS,
    created_at: createdAt,
    expires_at: new Date(nowMs + (MEMO_SEARCH_SELECTION_TTL_SECONDS * 1000)).toISOString(),
  };
  await kv.put(memoSearchSelectionKey(scopeHash), JSON.stringify(snapshot), {
    expirationTtl: MEMO_SEARCH_SELECTION_TTL_SECONDS,
  });
  return { ok: true, snapshot };
}

async function persistMemoSearchPageSnapshotCurrentPage(kv, record = {}, parsedPage = {}) {
  const scopeHash = String(record.selection_scope_hash || "");
  const raw = await kv?.get(memoSearchSelectionKey(scopeHash));
  const snapshot = parseMemoSearchSelectionSnapshot(raw);
  if (
    !snapshot
    || snapshot.scope_hash !== scopeHash
    || snapshot.search_event_hash !== record.normalized_command?.selection_snapshot_version
    || snapshot.total !== parsedPage.total
    || snapshot.page_count !== parsedPage.page_count
    || Date.parse(snapshot.expires_at) <= Date.now()
  ) throw new Error("page_snapshot_state_mismatch");
  const startIndex = (parsedPage.page - 1) * MEMO_SEARCH_PAGE_SIZE;
  const expectedIds = snapshot.candidates.slice(startIndex, startIndex + MEMO_SEARCH_PAGE_SIZE).map((candidate) => candidate.memo_id);
  const actualIds = parsedPage.page_candidates.map((candidate) => candidate.memo_id);
  if (expectedIds.length !== actualIds.length || expectedIds.some((memoId, index) => memoId !== actualIds[index])) {
    throw new Error("page_snapshot_candidate_mismatch");
  }
  const pageSummaryByPosition = new Map(parsedPage.page_candidates.map((candidate) => [
    Number(candidate.position),
    safeMemoSearchSummary(candidate.summary),
  ]));
  const next = {
    ...snapshot,
    current_page: parsedPage.page,
    candidates: snapshot.candidates.map((candidate) => ({
      ...candidate,
      summary: pageSummaryByPosition.get(candidate.position) || candidate.summary,
    })),
  };
  await kv.put(memoSearchSelectionKey(scopeHash), JSON.stringify(next), {
    expiration: Math.floor(Date.parse(snapshot.expires_at) / 1000),
  });
  return { ok: true, snapshot: next };
}

export function workerHealth(env = {}) {
  return {
    status: "skeleton",
    worker: WORKER_NAME,
    resources: {
      runtime_kv: env.CF_KV_RUNTIME_NAMESPACE || RUNTIME_KV_NAME,
      idempotency_kv: env.CF_KV_IDEMPOTENCY_NAMESPACE || IDEMPOTENCY_KV_NAME,
      d1: env.CF_D1_DATABASE || D1_NAME,
    },
    required_env: {
      LINE_CHANNEL_SECRET: Boolean(env.LINE_CHANNEL_SECRET),
      LINE_CHANNEL_ACCESS_TOKEN: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),
      LINE_TEST_ADMIN_USER_IDS: Boolean(env.LINE_TEST_ADMIN_USER_IDS),
      N8N_WEBHOOK_URL: Boolean(env.N8N_WEBHOOK_URL),
      N8N_SHARED_SECRET: Boolean(env.N8N_SHARED_SECRET),
    },
    n8n: {
      webhook_url: env.N8N_WEBHOOK_URL || N8N_WEBHOOK_URL,
      webhook_target: n8nWebhookAttribution(env.N8N_WEBHOOK_URL || N8N_WEBHOOK_URL),
      shared_secret_header: N8N_SHARED_SECRET_HEADER,
    },
    line_webhook_ack: {
      version: "bounded-durable-ack-v1",
      budget_ms: LINE_WEBHOOK_ACK_BUDGET_MS,
      normal_target_ms: NORMAL_ACK_TARGET_MS,
      kv_get_timeout_ms: LINE_WEBHOOK_KV_GET_TIMEOUT_MS,
      kv_put_timeout_ms: LINE_WEBHOOK_KV_PUT_TIMEOUT_MS,
      timeout_http_status: 503,
      durable_acceptance_store: "IDEMPOTENCY_KV",
      ambiguous_put_redelivery_resume: true,
      empty_event_side_effects: false,
      background_after_acceptance: ["evidence", "mark_as_read", "n8n", "pending", "core", "final"],
    },
    line_reply_mode: LINE_REPLY_MODE,
    memo_ack_kv_budget: {
      version: "remaining-budget-v1",
      hard_cap_ms: LINE_WEBHOOK_ACK_BUDGET_MS,
      response_margin_ms: MEMO_ACK_RESPONSE_MARGIN_MS,
      get_policy: "remaining_minus_response_margin_and_put_reserve",
      put_reserve_ms: MEMO_ACK_PUT_RESERVE_MS,
      put_policy: "remaining_minus_response_margin",
      timeout_http_status: 503,
      durable_acceptance_before_200: true,
    },
    line_final_delivery: {
      version: LINE_FINAL_DELIVERY_VERSION,
      reply_first: {
        endpoint: "/v2/bot/message/reply",
        eligibility_window_seconds: LINE_REPLY_ELIGIBILITY_WINDOW_MS / 1000,
        max_attempts: 1,
        retry_key_header: false,
        ambiguous_policy: "no_reply_retry_no_immediate_push",
        monthly_push_usage_gate_applies: false,
      },
      push_fallback: {
        version: LINE_FINAL_DELIVERY_RETRY_VERSION,
        endpoint: "/v2/bot/message/push",
        retry_http_status: 429,
        max_attempts: LINE_FINAL_DELIVERY_MAX_ATTEMPTS,
        default_retry_after_seconds: LINE_FINAL_DELIVERY_DEFAULT_RETRY_AFTER_SECONDS,
        retry_key_header: "X-Line-Retry-Key",
        durable_readback_required_before_push: true,
      },
      reply_token_persistence: "pending_only_redacted_after_finalizer",
    },
    line_mark_as_read: {
      enabled: env.LINE_MARK_AS_READ_ENABLED === "true",
      mode: env.LINE_MARK_AS_READ_ENABLED === "true" ? "api_enabled_chat_on_optional" : "disabled_chat_off_auto_read",
      endpoint: "https://api.line.me/v2/bot/chat/markAsRead",
      token_source: "message.markAsReadToken",
      evidence_completed_stage: "line_mark_as_read_completed",
      evidence_disabled_stage: "line_mark_as_read_skipped_disabled",
      evidence_skipped_stage: "line_mark_as_read_skipped_no_token",
      evidence_failed_stage: "line_mark_as_read_failed",
      transient_token_only: true,
    },
    codex_task_final_mode: CODEX_TASK_FINAL_MODE,
    supported_intents: ACCEPTED_N8N_INTENTS,
    gate_test_intents: GATE_TEST_INTENTS,
    evidence: {
      persistence: "RUNTIME_KV",
      prefix: EVIDENCE_PREFIX,
      read_path: "/test/evidence",
      selfcheck_path: "/test/evidence/selfcheck",
      guard_header: N8N_SHARED_SECRET_HEADER,
      selfcheck_guard_header: EVIDENCE_SELFTEST_SECRET_HEADER,
      query: ["request_id", "marker"],
      runtime_kv_bound: Boolean(env.RUNTIME_KV),
      idempotency_kv_bound: Boolean(env.IDEMPOTENCY_KV),
      selfcheck_secret_configured: Boolean(env.EVIDENCE_SELFTEST_SECRET),
    },
    idea_finalizer: {
      path: IDEA_FINALIZE_PATH,
      mode: "task_token_exactly_once",
    },
    codex_finalizer: {
      path: CODEX_FINALIZE_PATH,
      mode: "task_token_exactly_once",
    },
    memo_create: {
      command_prefix: MEMO_CREATE_COMMAND_PREFIX,
      colon_contract: "full_width_only",
      route_mode: "deterministic_before_ai_classification",
      memo_id: "memo-<safe_event_hash_sha256>",
      filename: "<memo_id>.json",
      cloud_writer: "n8n_deterministic_create_if_absent_readback",
      finalizer_path: MEMO_FINALIZE_PATH,
      finalizer_reference: "opaque_task_scoped",
      callback_auth: "header_auth_only",
      callback_header_auth_configured: Boolean(env.N8N_MEMO_CALLBACK_SECRET),
      callback_payload_credential_absent: true,
      reply_token_location: "worker_durable_acceptance_only",
      raw_user_id_stored: false,
      monitor_or_wake_dependency: false,
      processing_push: false,
      reply_max_attempts: 1,
      reply_retry_key: false,
      ambiguous_reply_push: false,
      eligibility_window_seconds: LINE_REPLY_ELIGIBILITY_WINDOW_MS / 1000,
    },
    memo_deterministic_routes: {
      route_mode: "fixed_prefix_before_ai_classification",
      colon_contract: "full_width_only",
      separator_contract: "full_width_vertical_bar_for_modify",
      intents: [MEMO_SEARCH_OPERATION, MEMO_SEARCH_PAGE_OPERATION, MEMO_MODIFY_OPERATION, MEMO_DELETE_OPERATION],
      command_prefixes: {
        search: MEMO_SEARCH_COMMAND_PREFIX,
        modify: MEMO_MODIFY_COMMAND_PREFIX,
        delete: MEMO_DELETE_COMMAND_PREFIX,
      },
      selection_delete_commands: [
        "備忘錄刪除：第1筆",
        "刪除第1筆",
        "備忘錄刪除：第一筆到第五筆",
        "刪除第1、3、5筆",
        "備忘錄刪除：這次搜尋的全部",
      ],
      selection_scope: "latest_search_snapshot_same_hashed_actor_conversation",
      selection_storage: "IDEMPOTENCY_KV",
      selection_ttl_seconds: MEMO_SEARCH_SELECTION_TTL_SECONDS,
      selection_full_candidate_limit: MEMO_SEARCH_SELECTION_MAX_CANDIDATES,
      selection_snapshot_schema: MEMO_SEARCH_SELECTION_SCHEMA,
      selection_snapshot_sensitive_payload: false,
      page_size: MEMO_SEARCH_PAGE_SIZE,
      page_commands: ["查看下一頁", "查看上一頁", "查看第 N 頁"],
      page_readback: "protected_n8n_exact_snapshot_ids_in_order",
      delete_all_supported: true,
      delete_all_scope: "current_unexpired_same_actor_search_snapshot_only",
      confirmation_required: true,
      confirmation_phrase: MEMO_DELETE_CONFIRM_COMMAND,
      confirmation_cancel_phrase: MEMO_DELETE_CANCEL_COMMAND,
      confirmation_ttl_seconds: MEMO_DELETE_CONFIRMATION_TTL_SECONDS,
      confirmation_single_consumption: true,
      confirmation_actor_snapshot_candidate_bound: true,
      parser_supported_selection_items: MEMO_SEARCH_SELECTION_MAX_DELETE_ITEMS,
      worker_batch_request_items: MEMO_SELECTION_WORKER_BATCH_REQUEST_LIMIT,
      live_execution_authorized_selection_items: MEMO_SELECTION_LIVE_EXECUTION_AUTHORIZED_LIMIT,
      n8n_batch_archive_update_required: true,
      selection_batch_fail_closed_above_authorized_limit: true,
      search_reply_numbered_without_memo_id: true,
      list_all_literal: "全部",
      memo_id_format: "memo-<64_lowercase_sha256_hex>",
      path_from_user_input: false,
      ai_agent_bypass: true,
      durable_acceptance_before_200: true,
      background_n8n_dispatch: "after_consumed_confirmation_only",
      callback_auth: "header_auth_only",
      callback_payload_credential_absent: true,
      monitor_or_wake_dependency: false,
      processing_push: false,
      reply_max_attempts: 1,
      final_exactly_once: true,
    },
    memo_success_reply: {
      operations: [MEMO_CREATE_OPERATION, MEMO_MODIFY_OPERATION, MEMO_DELETE_OPERATION],
      normal_source: "validated_n8n_natural_language",
      fallback: "operation_specific_natural_text_without_id",
      memo_id_hidden: true,
      search_reply_numbered_without_memo_id: true,
      max_length: MEMO_SUCCESS_REPLY_MAX_LENGTH,
      finalizer_gates: ["header_auth", "task_state", "completed_status", "exactly_once"],
    },
    calendar_create: {
      command_prefix: "行事曆新增：",
      route_mode: "deterministic_before_ai_classification",
      calendar_alias: CALENDAR_ALIAS,
      timezone: CALENDAR_TIMEZONE,
      confirmation_required_for_complete_input: false,
      clarification_zero_calendar_write: true,
      duration_limit_minutes: 10080,
      state_ttl_seconds: CALENDAR_CREATE_TTL_SECONDS,
      pending_context: "same_actor_safe_hash_partial_draft",
      continuation_inputs: ["今天", "明天", "下週一", "5分鐘", "一小時", "到三點", "5分鐘結束", "取消"],
      continuation_preserves: ["title", "date", "start", "location"],
      pending_clear_states: ["success", "cancelled", "expired", "rejected", "new_explicit_complete_create"],
      actor_isolation: true,
      next_missing_field_only: true,
      deterministic_event_reference: true,
      external_writer: "n8n_google_calendar_create_with_terminal_readback",
      retry_policy: "readback_before_any_recreate",
      final_exactly_once: true,
      internal_identifiers_in_line_final: false,
      memo_dependency: false,
      monitor_or_wake_dependency: false,
    },
    codex_monitor: {
      name: CODEX_MONITOR_NAME,
      task_prefixes: [CODEX_TASK_PREFIX, IDEA_TASK_PREFIX],
      actions: [CODEX_TASK_ACTION, IDEA_TASK_ACTION],
      wake_contract: {
        key: MONITOR_WAKE_KEY,
        schema: MONITOR_WAKE_SCHEMA,
        write_on_new_pending: true,
        additional_kv_writes_per_new_task: 1,
        sensitive_payload: false,
      },
      target_path: CODEX_TASK_SMOKE_FILE_PATH,
      target_content: CODEX_TASK_SMOKE_FILE_CONTENT,
      dropbox_idea_dir: DROPBOX_IDEA_DIR,
    },
    admin_bootstrap: {
      phrase: ADMIN_BOOTSTRAP_PHRASE,
      kv_key: ADMIN_BOOTSTRAP_KV_KEY,
    },
  };
}

export async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!channelSecret) {
    return { ok: false, reason: "missing_LINE_CHANNEL_SECRET", status: 503 };
  }
  if (!signature) {
    return { ok: false, reason: "missing_x_line_signature", status: 401 };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = bytesToBase64(new Uint8Array(signed));

  if (!constantTimeEqual(expected, signature)) {
    return { ok: false, reason: "invalid_signature", status: 401 };
  }
  return { ok: true };
}

export async function verifyAdmin(event, env = {}) {
  const adminUserIds = env.LINE_TEST_ADMIN_USER_IDS || "";
  const userId = event.source?.userId || "";

  if (adminUserIds === ADMIN_BOOTSTRAP_SENTINEL) {
    if (event.message?.text !== ADMIN_BOOTSTRAP_PHRASE) {
      return { ok: false, reason: "admin_bootstrap_phrase_required", status: 403 };
    }
    if (!env.RUNTIME_KV) {
      return { ok: false, reason: "missing_RUNTIME_KV", status: 503 };
    }
    await env.RUNTIME_KV.put(ADMIN_BOOTSTRAP_KV_KEY, userId, { expirationTtl: 1800 });
    return { ok: true, bootstrapped: true };
  }

  if (!adminUserIds) {
    return { ok: false, reason: "missing_LINE_TEST_ADMIN_USER_IDS", status: 503 };
  }

  const allowed = adminUserIds.split(",").map((id) => id.trim()).filter(Boolean);
  if (!allowed.includes(userId)) {
    return { ok: false, reason: "not_test_admin", status: 403 };
  }

  return { ok: true };
}

export async function checkIdempotency(idempotencyKv, eventId) {
  if (!idempotencyKv) {
    return { ok: false, reason: "missing_IDEMPOTENCY_KV", status: 503 };
  }

  const existing = await idempotencyKv.get(eventId);
  if (existing) {
    return { ok: false, reason: "duplicate_line_event", status: 200 };
  }

  return { ok: true };
}

export function normalizeForN8n(event) {
  const lineEventId = event.webhookEventId || event.message?.id || crypto.randomUUID();
  return {
    request_id: `pline-v3-${lineEventId}`,
    line_event_id: lineEventId,
    reply_token: event.replyToken,
    user_id: event.source?.userId || "",
    message_text: event.message?.text || "",
    gate_marker: extractGateMarker(event.message?.text || ""),
    received_at: new Date().toISOString(),
  };
}

export async function processN8nInBackground(normalized, env) {
  const n8nTarget = n8nWebhookAttribution(env.N8N_WEBHOOK_URL || N8N_WEBHOOK_URL);
  await persistEvidenceStage(env, normalized, "n8n_background_started", {
    n8n_host: n8nTarget.host,
    n8n_path: n8nTarget.path,
    n8n_route_type: n8nTarget.route_type,
    n8n_path_fingerprint: n8nTarget.path_fingerprint,
    workflow_hint: n8nTarget.workflow_hint,
  });
  logStage("n8n_background_started", {
    request_id: normalized.request_id,
    n8n_host: n8nTarget.host,
    n8n_path: n8nTarget.path,
    n8n_route_type: n8nTarget.route_type,
  });

  let n8nResult;
  try {
    n8nResult = await callN8nWebhook(normalized, env);
  } catch (error) {
    await persistEvidenceStage(env, normalized, "n8n_background_failed", {
      reason: "n8n_fetch_exception",
    });
    logStage("n8n_background_failed", {
      request_id: normalized.request_id,
      reason: "n8n_fetch_exception",
      error_name: error?.name || "Error",
    });
    return {
      ok: false,
      reason: "n8n_fetch_exception",
      status: 502,
    };
  }

  if (!n8nResult.ok) {
    await persistEvidenceStage(env, normalized, "n8n_background_failed", {
      reason: n8nResult.reason,
      status: n8nResult.status,
    });
    logStage("n8n_background_failed", {
      request_id: normalized.request_id,
      reason: n8nResult.reason,
      status: n8nResult.status,
    });
    return {
      ok: false,
      reason: n8nResult.reason,
      status: n8nResult.status,
    };
  }

  const contractResult = validateN8nContract(n8nResult.body, normalized.request_id);
  if (!contractResult.ok) {
    const responseShape = n8nResponseShape(n8nResult.body);
    await persistEvidenceStage(env, normalized, "n8n_background_contract_failed", {
      reason: contractResult.reason,
      n8n_host: n8nTarget.host,
      n8n_path: n8nTarget.path,
      n8n_route_type: n8nTarget.route_type,
      n8n_path_fingerprint: n8nTarget.path_fingerprint,
      request_id_source: contractResult.request_id_source || "",
      response_request_id_present: Boolean(contractResult.response_request_id_present),
      worker_request_id_present: Boolean(contractResult.worker_request_id_present),
      canonical_request_id_present: Boolean(contractResult.canonical_request_id_present),
      n8n_response_shape: responseShape.shape,
      n8n_response_top_keys: responseShape.top_keys,
      n8n_response_nested_keys: responseShape.nested_keys,
    });
    logStage("n8n_background_contract_failed", {
      request_id: normalized.request_id,
      reason: contractResult.reason,
      n8n_host: n8nTarget.host,
      n8n_path: n8nTarget.path,
      n8n_route_type: n8nTarget.route_type,
      request_id_source: contractResult.request_id_source || undefined,
    });
    return {
      ok: false,
      reason: contractResult.reason,
      status: 502,
    };
  }

  if (contractResult.body.intent === "idea_create") {
    const enqueueResult = await enqueueIdeaTask(env, normalized, contractResult.body);
    await persistEvidenceStage(env, normalized, enqueueResult.ok ? "idea_json_save_enqueued" : "idea_json_save_enqueue_failed", {
      intent: contractResult.body.intent,
      action: IDEA_TASK_ACTION,
      status: enqueueResult.ok ? enqueueResult.status : "failed",
      reason: enqueueResult.ok ? "" : enqueueResult.reason,
    });
    logStage(enqueueResult.ok ? "idea_json_save_enqueued" : "idea_json_save_enqueue_failed", {
      request_id: normalized.request_id,
      action: IDEA_TASK_ACTION,
      status: enqueueResult.ok ? enqueueResult.status : "failed",
      reason: enqueueResult.ok ? undefined : enqueueResult.reason,
    });

    if (!enqueueResult.ok) {
      await persistEvidenceStage(env, normalized, "idea_json_save_failed", {
        intent: contractResult.body.intent,
        action: IDEA_TASK_ACTION,
        status: "failed",
        reason: enqueueResult.reason,
      });
      const pushResult = await pushToLine(normalized.user_id, IDEA_SAVE_FAILED_REPLY_TEXT, env);
      await persistEvidenceStage(env, normalized, pushResult.ok ? "idea_json_final_push_failed_notice_completed" : "idea_json_final_push_failed", {
        intent: contractResult.body.intent,
        action: IDEA_TASK_ACTION,
        status: "failed",
        reason: pushResult.ok ? "save_enqueue_failed" : pushResult.reason,
      });
      logStage(pushResult.ok ? "idea_json_final_push_failed_notice_completed" : "idea_json_final_push_failed", {
        request_id: normalized.request_id,
        action: IDEA_TASK_ACTION,
        status: "failed",
        reason: pushResult.ok ? "save_enqueue_failed" : pushResult.reason,
      });
    } else if (enqueueResult.duplicate) {
      await persistEvidenceStage(env, normalized, "idea_json_final_push_suppressed", {
        intent: contractResult.body.intent,
        action: IDEA_TASK_ACTION,
        status: "duplicate",
        reason: "duplicate_idea_task",
      });
      logStage("idea_json_final_push_suppressed", {
        request_id: normalized.request_id,
        action: IDEA_TASK_ACTION,
        status: "duplicate",
        reason: "duplicate_idea_task",
      });
    } else {
      await persistEvidenceStage(env, normalized, "idea_json_final_outbox_pending", {
        intent: contractResult.body.intent,
        action: IDEA_TASK_ACTION,
        status: "pending",
      });
      logStage("idea_json_final_outbox_pending", {
        request_id: normalized.request_id,
        action: IDEA_TASK_ACTION,
        status: "pending",
      });
    }
  } else if (contractResult.body.intent === "codex_task") {
    const capabilityResult = codexTaskCapabilityCheck(normalized.message_text);
    if (!capabilityResult.ok) {
      await persistEvidenceStage(env, normalized, "codex_task_capability_not_enabled", {
        intent: contractResult.body.intent,
        action: CODEX_TASK_ACTION,
        status: "failed",
        reason: capabilityResult.reason,
      });
      logStage("codex_task_capability_not_enabled", {
        request_id: normalized.request_id,
        action: CODEX_TASK_ACTION,
        status: "failed",
        reason: capabilityResult.reason,
      });
      const noticeResult = await pushToLine(normalized.user_id, CODEX_CAPABILITY_NOT_ENABLED_REPLY_TEXT, env);
      await persistEvidenceStage(env, normalized, noticeResult.ok ? "codex_task_capability_notice_completed" : "codex_task_capability_notice_failed", {
        intent: contractResult.body.intent,
        action: CODEX_TASK_ACTION,
        status: "failed",
        reason: noticeResult.ok ? capabilityResult.reason : noticeResult.reason,
      });
      logStage(noticeResult.ok ? "codex_task_capability_notice_completed" : "codex_task_capability_notice_failed", {
        request_id: normalized.request_id,
        action: CODEX_TASK_ACTION,
        status: "failed",
        reason: noticeResult.ok ? capabilityResult.reason : noticeResult.reason,
      });
      return {
        ok: false,
        request_id: normalized.request_id,
        intent: contractResult.body.intent,
        status: "failed",
        reason: capabilityResult.reason,
      };
    }

    const enqueueResult = await enqueueCodexTask(env, normalized, contractResult.body);
    await persistEvidenceStage(env, normalized, enqueueResult.ok ? "codex_task_enqueued" : "codex_task_enqueue_failed", {
      intent: contractResult.body.intent,
      action: contractResult.body.action,
      task_id_present: Boolean(contractResult.body.task_id),
      status: enqueueResult.duplicate ? "duplicate" : enqueueResult.ok ? "queued" : "failed",
      reason: enqueueResult.ok ? "" : enqueueResult.reason,
    });
    logStage(enqueueResult.ok ? "codex_task_enqueued" : "codex_task_enqueue_failed", {
      request_id: normalized.request_id,
      action: contractResult.body.action,
      task_id_present: Boolean(contractResult.body.task_id),
      reason: enqueueResult.ok ? undefined : enqueueResult.reason,
    });

    if (!enqueueResult.ok) {
      const failureNotice = await pushToLine(normalized.user_id, CODEX_FAILED_REPLY_TEXT, env);
      await persistEvidenceStage(env, normalized, failureNotice.ok ? "codex_task_delivery_failed_notice_completed" : "codex_task_delivery_failed_notice_failed", {
        intent: contractResult.body.intent,
        action: CODEX_TASK_ACTION,
        status: "failed",
        reason: failureNotice.ok ? enqueueResult.reason : failureNotice.reason,
      });
      return {
        ok: false,
        request_id: normalized.request_id,
        intent: contractResult.body.intent,
        status: "failed",
        reason: enqueueResult.reason,
      };
    }

    if (enqueueResult.duplicate) {
      await persistEvidenceStage(env, normalized, "codex_task_delivery_suppressed", {
        intent: contractResult.body.intent,
        action: CODEX_TASK_ACTION,
        status: "duplicate",
        reason: "duplicate_codex_task",
      });
      logStage("codex_task_delivery_suppressed", {
        request_id: normalized.request_id,
        action: CODEX_TASK_ACTION,
        status: "duplicate",
      });
      return {
        ok: true,
        request_id: normalized.request_id,
        intent: contractResult.body.intent,
        status: "duplicate",
      };
    }

    const pushResult = await pushToLine(normalized.user_id, CODEX_PROCESSING_REPLY_TEXT, env);
    if (!pushResult.ok) {
      await persistEvidenceStage(env, normalized, "codex_task_processing_notice_failed", {
        reason: pushResult.reason,
        status: pushResult.status,
      });
      logStage("codex_task_processing_notice_failed", {
        request_id: normalized.request_id,
        reason: pushResult.reason,
        status: pushResult.status,
      });
      return {
        ok: false,
        reason: pushResult.reason,
        status: pushResult.status,
      };
    }
    await persistEvidenceStage(env, normalized, "codex_task_processing_notice_completed", {
      intent: contractResult.body.intent,
      action: CODEX_TASK_ACTION,
      status: "delivered",
    });
    logStage("codex_task_processing_notice_completed", {
      request_id: normalized.request_id,
      intent: contractResult.body.intent,
      action: CODEX_TASK_ACTION,
      status: "delivered",
    });
  }

  await persistEvidenceStage(env, normalized, "n8n_background_completed", {
    intent: contractResult.body.intent,
    status: contractResult.body.status,
    ...contractEvidenceForLog(contractResult.body),
  });
  logStage("n8n_background_completed", {
    request_id: normalized.request_id,
    intent: contractResult.body.intent,
    status: contractResult.body.status,
    ...contractEvidenceForLog(contractResult.body),
  });
  return {
    ok: true,
    request_id: normalized.request_id,
    intent: contractResult.body.intent,
    status: contractResult.body.status,
  };
}

export async function enqueueCodexTask(env = {}, normalized = {}, body = {}) {
  if (!env.RUNTIME_KV) {
    return { ok: false, reason: "missing_RUNTIME_KV" };
  }
  if (!normalized?.request_id || !body.task_id) {
    return { ok: false, reason: "missing_codex_task_identity" };
  }
  const lineUserRef = await sealLineUserRef(normalized.user_id, env);
  if (!lineUserRef.ok) {
    return lineUserRef;
  }

  const key = codexTaskKey(body.task_id);
  const existingRaw = await env.RUNTIME_KV.get(key);
  if (existingRaw) {
    const existing = parseJsonSafely(existingRaw);
    return {
      ok: true,
      duplicate: true,
      key,
      task_id: existing?.task_id || body.task_id,
      status: existing?.status || "queued",
    };
  }

  const task = sanitizeCodexTaskRecord({
    schema: "pline-v3-test-codex-task/v1",
    status: "queued",
    monitor: CODEX_MONITOR_NAME,
    task_id: body.task_id,
    task_type: "codex_task",
    project: CODEX_TASK_PROJECT,
    project_path: CODEX_TASK_PROJECT_PATH,
    instruction: CODEX_TASK_INSTRUCTION,
    request_id: normalized.request_id,
    marker: normalized.gate_marker,
    action: CODEX_TASK_ACTION,
    target_path: CODEX_TASK_SMOKE_FILE_PATH,
    content: CODEX_TASK_SMOKE_FILE_CONTENT,
    line_user_ref: lineUserRef.value,
    finalize_token: createFinalizeToken(),
    reply_token: normalized.reply_token || "",
    reply_received_at: normalized.received_at || "",
    created_at: new Date().toISOString(),
  });
  await env.RUNTIME_KV.put(key, JSON.stringify(task), { expirationTtl: EVIDENCE_TTL_SECONDS });
  await env.RUNTIME_KV.put(codexPendingKey(body.task_id), key, { expirationTtl: EVIDENCE_TTL_SECONDS });
  await updateMonitorWakeKey(env.RUNTIME_KV);
  return { ok: true, key, task_id: body.task_id, status: "queued" };
}

export async function enqueueIdeaTask(env = {}, normalized = {}, body = {}) {
  if (!env.RUNTIME_KV) {
    return { ok: false, reason: "missing_RUNTIME_KV" };
  }
  if (!normalized?.request_id || !normalized.line_event_id) {
    return { ok: false, reason: "missing_idea_task_identity" };
  }

  const canonicalContent = resolveCanonicalIdeaContent(body, normalized.message_text);
  if (!canonicalContent.ok) {
    return { ok: false, reason: "missing_idea_content" };
  }
  const content = canonicalContent.content;

  const lineEventKey = await fingerprint(`line-event:${normalized.line_event_id}`, env);
  const actorFingerprint = await fingerprint(`line-actor:${normalized.user_id || "unknown"}`, env);
  const lineUserRef = await sealLineUserRef(normalized.user_id, env);
  if (!lineUserRef.ok) {
    return lineUserRef;
  }
  const ideaId = `idea-${lineEventKey.slice(0, 16)}`;
  const taskId = `idea-${lineEventKey.slice(0, 24)}`;
  const key = ideaTaskKey(taskId);
  const existingRaw = await env.RUNTIME_KV.get(key);
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      return {
        ok: true,
        duplicate: true,
        key,
        task_id: existing.task_id || taskId,
        status: existing.status === "completed" ? "duplicate" : existing.status || "pending",
      };
    } catch {
      return { ok: false, reason: "unreadable_existing_idea_task" };
    }
  }

  const task = sanitizeIdeaTaskRecord({
    status: "pending",
    task_id: taskId,
    request_id: normalized.request_id,
    marker: normalized.gate_marker,
    line_user_ref: lineUserRef.value,
    finalize_token: createFinalizeToken(),
    reply_token: normalized.reply_token || "",
    reply_received_at: normalized.received_at || "",
    final_reply_text: naturalIdeaReplyText(body.reply_text),
    idea: {
      idea_id: ideaId,
      content,
      created_at: taipeiIsoString(new Date()),
      actor_fingerprint: actorFingerprint,
      line_event_key: lineEventKey,
    },
    created_at: new Date().toISOString(),
  });
  await env.RUNTIME_KV.put(key, JSON.stringify(task), { expirationTtl: EVIDENCE_TTL_SECONDS });
  await env.RUNTIME_KV.put(ideaPendingKey(taskId), key, { expirationTtl: EVIDENCE_TTL_SECONDS });
  await updateMonitorWakeKey(env.RUNTIME_KV);
  return { ok: true, key, task_id: taskId, status: "pending" };
}

export async function updateMonitorWakeKey(kv) {
  if (!kv?.put) {
    return { ok: false, reason: "missing_RUNTIME_KV" };
  }
  const wakeRecord = {
    schema: MONITOR_WAKE_SCHEMA,
    version: crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  };
  try {
    await kv.put(MONITOR_WAKE_KEY, JSON.stringify(wakeRecord), { expirationTtl: EVIDENCE_TTL_SECONDS });
    return { ok: true };
  } catch {
    return { ok: false, reason: "monitor_wake_write_failed" };
  }
}

export async function callN8nWebhook(payload, env) {
  if (!env.N8N_WEBHOOK_URL) {
    return { ok: false, reason: "missing_N8N_WEBHOOK_URL", status: 503 };
  }
  if (!env.N8N_SHARED_SECRET) {
    return { ok: false, reason: "missing_N8N_SHARED_SECRET", status: 503 };
  }

  const response = await fetch(env.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [N8N_SHARED_SECRET_HEADER]: env.N8N_SHARED_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let body = {};
  if (responseText.trim().length > 0) {
    try {
      body = JSON.parse(responseText);
    } catch {
      return {
        ok: false,
        reason: response.ok ? "invalid_n8n_json" : `n8n_http_${response.status}_non_json`,
        status: 502,
      };
    }
  }

  if (!response.ok) {
    return { ok: false, reason: `n8n_http_${response.status}`, status: 502, body };
  }

  return { ok: true, body: normalizeN8nResponseBody(body) };
}

export function normalizeN8nResponseBody(body) {
  if (Array.isArray(body)) {
    return body[0]?.json || body[0] || {};
  }
  if (body && typeof body === "object" && body.json && typeof body.json === "object") {
    return body.json;
  }
  if (body && typeof body === "object" && body.body && typeof body.body === "object") {
    return normalizeN8nResponseBody(body.body);
  }
  if (body && typeof body === "object" && body.data && typeof body.data === "object") {
    return normalizeN8nResponseBody(body.data);
  }
  if (body && typeof body === "object" && body.response && typeof body.response === "object") {
    return normalizeN8nResponseBody(body.response);
  }
  if (body && typeof body === "object" && body.result && typeof body.result === "object") {
    return normalizeN8nResponseBody(body.result);
  }
  if (body && typeof body === "object" && body.output && typeof body.output === "object") {
    return normalizeN8nResponseBody(body.output);
  }
  if (body && typeof body === "object" && typeof body.output === "string") {
    const parsedOutput = parseJsonSafely(body.output);
    if (parsedOutput && typeof parsedOutput === "object") {
      return normalizeN8nResponseBody(parsedOutput);
    }
  }
  return body;
}

export function validateN8nContract(body, requestId) {
  body = normalizeN8nResponseBody(body);
  const requestIdentity = n8nResponseRequestIdentity(body);
  if (!body || requestIdentity.value !== requestId) {
    return {
      ok: false,
      reason: "request_id_mismatch",
      request_id_source: requestIdentity.source,
      response_request_id_present: Boolean(body?.request_id),
      worker_request_id_present: Boolean(body?.worker_request_id),
      canonical_request_id_present: Boolean(body?.canonicalRequestId),
    };
  }
  body = { ...body, request_id: requestIdentity.value };
  if (!ACCEPTED_N8N_INTENTS.includes(body.intent)) {
    return { ok: false, reason: "unsupported_intent" };
  }
  const replyText = normalizeReplyText(body.intent, body.reply_text);
  if (!replyText && body.intent !== "idea_create") {
    return { ok: false, reason: "missing_reply_text" };
  }
  if (body.intent === "codex_task" && !body.task_id) {
    return { ok: false, reason: "missing_task_id" };
  }
  if (body.intent === "idea_create") {
    if (body.tool_called !== "idea_create") {
      return { ok: false, reason: "missing_idea_create_tool_called" };
    }
    if (body.saved_record !== 1 && body.record !== 1) {
      return { ok: false, reason: "missing_idea_create_record" };
    }
  }
  if (body.intent === "codex_task") {
    if (body.tool_called !== "codex_task") {
      return { ok: false, reason: "missing_codex_task_tool_called" };
    }
    if (body.action !== "create_smoke_file") {
      return { ok: false, reason: "missing_codex_task_action" };
    }
  }
  if (body.status !== "completed" && body.status !== "accepted") {
    return { ok: false, reason: "unsupported_status" };
  }

  return { ok: true, body: { ...body, reply_text: replyText || "" } };
}

export function n8nResponseRequestIdentity(body = {}) {
  if (!body || typeof body !== "object") {
    return { value: "", source: "" };
  }
  if (body.worker_request_id) {
    return { value: String(body.worker_request_id), source: "worker_request_id" };
  }
  if (body.canonicalRequestId) {
    return { value: String(body.canonicalRequestId), source: "canonicalRequestId" };
  }
  if (body.request_id) {
    return { value: String(body.request_id), source: "request_id" };
  }
  return { value: "", source: "" };
}

export function n8nWebhookAttribution(webhookUrl = "") {
  try {
    const url = new URL(webhookUrl || N8N_WEBHOOK_URL);
    const routeType = url.pathname === "/webhook" || url.pathname.startsWith("/webhook/") ? "production" : url.pathname === "/webhook-test" || url.pathname.startsWith("/webhook-test/") ? "test" : "unknown";
    return {
      host: url.host,
      path: url.pathname,
      route_type: routeType,
      workflow_hint: url.pathname.split("/").filter(Boolean).at(-1) || "",
      path_fingerprint: stableShortFingerprint(`${url.host}${url.pathname}`),
    };
  } catch {
    return {
      host: "",
      path: "",
      route_type: "invalid",
      workflow_hint: "",
      path_fingerprint: stableShortFingerprint("invalid"),
    };
  }
}

export function n8nResponseShape(body = {}) {
  const topKeys = safeObjectKeys(body);
  const nestedKeys = [];
  for (const key of ["json", "body", "data", "response", "result", "output"]) {
    const value = body && typeof body === "object" ? body[key] : null;
    if (value && typeof value === "object") {
      nestedKeys.push(`${key}:${safeObjectKeys(value).join(",")}`);
    } else if (typeof value === "string") {
      const parsed = parseJsonSafely(value);
      if (parsed && typeof parsed === "object") {
        nestedKeys.push(`${key}:${safeObjectKeys(parsed).join(",")}`);
      } else {
        nestedKeys.push(`${key}:string`);
      }
    }
  }
  return {
    shape: Array.isArray(body) ? "array" : body && typeof body === "object" ? "object" : typeof body,
    top_keys: topKeys.join(",").slice(0, 200),
    nested_keys: nestedKeys.join("|").slice(0, 200),
  };
}

function safeObjectKeys(value = {}) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value)
    .map((key) => String(key).replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 40))
    .filter(Boolean)
    .sort()
    .slice(0, 20);
}

function stableShortFingerprint(value = "") {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function codexTaskCapabilityCheck(messageText = "") {
  const text = String(messageText || "").trim().toLowerCase();
  const unsupportedPattern = /(?:computer use|browser|chrome|safari|http:\/\/|https:\/\/|網頁|瀏覽器|網站|網址|開啟|打開|瀏覽|搜尋)/i;
  if (unsupportedPattern.test(text)) {
    return { ok: false, reason: "capability_not_yet_enabled" };
  }

  const smokeScopePattern = /(?:最小任務測試|測試檔案|smoke|建立.*檔案|codex.*測試)/i;
  if (!smokeScopePattern.test(text)) {
    return { ok: false, reason: "capability_not_yet_enabled" };
  }

  return { ok: true };
}

function contractEvidenceForLog(body) {
  if (body.intent === "idea_create") {
    return {
      tool_called: body.tool_called,
      saved_record: body.saved_record || body.record || 0,
    };
  }
  if (body.intent === "codex_task") {
    return {
      tool_called: body.tool_called,
      codex_task: body.codex_task || 0,
      action: body.action,
      task_id_present: Boolean(body.task_id),
    };
  }
  return {};
}

export function normalizeReplyText(intent, replyText) {
  if (typeof replyText === "string" && replyText.trim().length > 0) {
    return replyText;
  }
  return SAFE_REPLY_TEXT[intent] || "";
}

export async function replyToLine(replyToken, replyText, env) {
  const authorization = lineAuthorizationHeader(env);
  if (!authorization.ok) {
    return authorization;
  }
  if (!replyToken) {
    return { ok: false, reason: "missing_reply_token", status: 400 };
  }

  let response;
  try {
    response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        authorization: authorization.value,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: replyText }],
      }),
    });
  } catch (error) {
    return { ok: false, reason: `line_reply_exception_${error?.name || "Error"}`, status: 502 };
  }

  if (!response.ok) {
    return { ok: false, reason: `line_reply_http_${response.status}`, status: 502 };
  }

  return { ok: true };
}

async function attemptFinalReply(replyToken, replyText, env = {}) {
  const authorization = lineAuthorizationHeader(env);
  if (!authorization.ok) {
    return { ...authorization, explicit_rejection: true };
  }

  let timeout = null;
  try {
    const timeoutMs = Number(env.LINE_REPLY_TIMEOUT_MS || LINE_REPLY_TIMEOUT_MS);
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        authorization: authorization.value,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: replyText }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        explicit_rejection: true,
        reason: `line_reply_http_${response.status}`,
        http_status: response.status,
      };
    }
    return { ok: true, http_status: response.status };
  } catch {
    return {
      ok: false,
      ambiguous: true,
      reason: "line_reply_delivery_ambiguous",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function deliverFinalReplyFirst({
  env = {},
  deliveryKey = "",
  userId = "",
  replyToken = "",
  replyReceivedAt = "",
  replyText = "",
} = {}) {
  if (!env.RUNTIME_KV) {
    return { ok: false, status: "failed", reason: "missing_RUNTIME_KV", replied: false, pushed: false };
  }
  if (!deliveryKey) {
    return { ok: false, status: "failed", reason: "missing_delivery_key", replied: false, pushed: false };
  }

  const replyRecordKey = `${deliveryKey}:reply-first`;
  const existing = await readFinalDeliveryRecord(env.RUNTIME_KV, replyRecordKey);
  if (!existing.ok) {
    return { ok: false, status: "failed", reason: existing.reason, replied: false, pushed: false };
  }
  if (existing.record?.status === "reply_delivered") {
    return {
      ok: true,
      status: "already_delivered",
      delivery_mode: "reply",
      replied: false,
      pushed: false,
      duplicate_blocked: true,
      reply_attempt_count: 1,
      push_attempt_count: 0,
    };
  }
  if (["delivery_ambiguous", "reply_attempt_pending"].includes(existing.record?.status)) {
    return {
      ok: false,
      status: "delivery_ambiguous",
      reason: "line_reply_delivery_ambiguous",
      delivery_mode: "ambiguous",
      replied: false,
      pushed: false,
      reply_attempt_count: 1,
      push_attempt_count: 0,
    };
  }

  let fallbackReason = "";
  let replyAttemptCount = existing.record?.status === "reply_rejected" ? 1 : 0;
  if (["reply_unavailable", "reply_rejected"].includes(existing.record?.status)) {
    fallbackReason = existing.record.reason || existing.record.status;
  } else {
    const receivedAtMs = Date.parse(String(replyReceivedAt || ""));
    const nowMs = typeof env.LINE_REPLY_NOW_MS === "function"
      ? Number(env.LINE_REPLY_NOW_MS())
      : Number(env.LINE_REPLY_NOW_MS || Date.now());
    const ageMs = Number.isFinite(receivedAtMs) && Number.isFinite(nowMs) ? nowMs - receivedAtMs : Number.POSITIVE_INFINITY;
    const eligible = Boolean(replyToken)
      && ageMs >= 0
      && ageMs <= LINE_REPLY_ELIGIBILITY_WINDOW_MS;

    if (!eligible) {
      fallbackReason = !replyToken ? "missing_reply_token" : "reply_token_expired";
      const unavailable = await persistFinalDeliveryRecord(env.RUNTIME_KV, replyRecordKey, {
        status: "reply_unavailable",
        reason: fallbackReason,
        reply_attempt_count: 0,
        eligibility_window_seconds: LINE_REPLY_ELIGIBILITY_WINDOW_MS / 1000,
        updated_at: new Date(nowMs).toISOString(),
      }, { requireMissing: true });
      if (!unavailable.ok && unavailable.reason !== "delivery_record_already_exists") {
        return { ok: false, status: "failed", reason: unavailable.reason, replied: false, pushed: false };
      }
    } else {
      const pending = await persistFinalDeliveryRecord(env.RUNTIME_KV, replyRecordKey, {
        status: "reply_attempt_pending",
        reply_attempt_count: 1,
        eligibility_window_seconds: LINE_REPLY_ELIGIBILITY_WINDOW_MS / 1000,
        started_at: new Date(nowMs).toISOString(),
        updated_at: new Date(nowMs).toISOString(),
      }, { requireMissing: true });
      if (!pending.ok) {
        return {
          ok: false,
          status: "delivery_ambiguous",
          reason: "line_reply_delivery_ambiguous",
          delivery_mode: "ambiguous",
          replied: false,
          pushed: false,
          reply_attempt_count: 1,
          push_attempt_count: 0,
        };
      }

      const replyResult = await attemptFinalReply(replyToken, replyText, env);
      replyAttemptCount = 1;
      if (replyResult.ok) {
        const delivered = await persistFinalDeliveryRecord(env.RUNTIME_KV, replyRecordKey, {
          ...pending.record,
          status: "reply_delivered",
          http_status: replyResult.http_status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (!delivered.ok) {
          return { ok: false, status: "failed", reason: delivered.reason, replied: false, pushed: false };
        }
        return {
          ok: true,
          status: "delivered",
          delivery_mode: "reply",
          replied: true,
          pushed: false,
          reply_attempt_count: 1,
          push_attempt_count: 0,
        };
      }

      if (replyResult.ambiguous) {
        await persistFinalDeliveryRecord(env.RUNTIME_KV, replyRecordKey, {
          ...pending.record,
          status: "delivery_ambiguous",
          reason: "line_reply_delivery_ambiguous",
          updated_at: new Date().toISOString(),
        });
        return {
          ok: false,
          status: "delivery_ambiguous",
          reason: "line_reply_delivery_ambiguous",
          delivery_mode: "ambiguous",
          replied: false,
          pushed: false,
          reply_attempt_count: 1,
          push_attempt_count: 0,
        };
      }

      fallbackReason = replyResult.reason || "line_reply_rejected";
      const rejected = await persistFinalDeliveryRecord(env.RUNTIME_KV, replyRecordKey, {
        ...pending.record,
        status: "reply_rejected",
        reason: fallbackReason,
        http_status: replyResult.http_status || null,
        updated_at: new Date().toISOString(),
      });
      if (!rejected.ok) {
        return { ok: false, status: "failed", reason: rejected.reason, replied: false, pushed: false };
      }
    }
  }

  const pushResult = await deliverFinalPushWith429Retry({
    env,
    deliveryKey,
    userId,
    replyText,
  });
  return {
    ...pushResult,
    delivery_mode: "push_fallback",
    fallback_reason: fallbackReason,
    replied: false,
    reply_attempt_count: replyAttemptCount,
    push_attempt_count: pushResult.attempt_count || 0,
  };
}

export async function pushToLine(userId, replyText, env, options = {}) {
  const authorization = lineAuthorizationHeader(env);
  if (!authorization.ok) {
    return authorization;
  }
  if (!userId) {
    return { ok: false, reason: "missing_user_id", status: 400 };
  }

  let response;
  let timeout = null;
  try {
    const timeoutMs = Number(env.LINE_PUSH_TIMEOUT_MS || 1800);
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      authorization: authorization.value,
      "content-type": "application/json",
    };
    if (options.retryKey) {
      headers["X-Line-Retry-Key"] = options.retryKey;
    }
    response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: replyText }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    return { ok: false, reason: `line_push_exception_${error?.name || "Error"}`, status: 502 };
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: `line_push_http_${response.status}`,
      status: 502,
      http_status: response.status,
      retry_after_seconds: parseRetryAfterSeconds(response.headers.get("retry-after")),
      accepted_request_id_present: Boolean(response.headers.get("x-line-accepted-request-id")),
    };
  }

  return { ok: true, http_status: response.status };
}

export async function deliverFinalPushWith429Retry({
  env = {},
  deliveryKey = "",
  userId = "",
  replyText = "",
} = {}) {
  if (!env.RUNTIME_KV) {
    return { ok: false, status: "failed", reason: "missing_RUNTIME_KV", pushed: false, attempt_count: 0 };
  }
  if (!deliveryKey) {
    return { ok: false, status: "failed", reason: "missing_delivery_key", pushed: false, attempt_count: 0 };
  }

  const payloadFingerprint = await finalDeliveryPayloadFingerprint(userId, replyText);
  const existing = await readFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey);
  if (!existing.ok) {
    return { ok: false, status: "failed", reason: existing.reason, pushed: false, attempt_count: 0 };
  }
  if (existing.record?.status === "delivered") {
    return {
      ok: true,
      status: "already_delivered",
      pushed: false,
      duplicate_blocked: true,
      attempt_count: existing.record.attempt_count,
    };
  }
  if (["retry_exhausted", "failed"].includes(existing.record?.status)) {
    return {
      ok: false,
      status: existing.record.status,
      reason: `delivery_${existing.record.status}`,
      pushed: false,
      attempt_count: existing.record.attempt_count,
    };
  }
  if (existing.record && existing.record.payload_fingerprint !== payloadFingerprint) {
    return { ok: false, status: "failed", reason: "delivery_payload_mismatch", pushed: false, attempt_count: existing.record.attempt_count || 0 };
  }

  let record = existing.record;
  if (!record) {
    const pendingRecord = {
      status: "pending",
      retry_key: crypto.randomUUID(),
      attempt_count: 0,
      payload_fingerprint: payloadFingerprint,
      first_attempt_at: null,
      last_attempt_at: null,
      last_http_status: null,
      retry_after_seconds: null,
      next_attempt_at: null,
    };
    const created = await persistFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey, pendingRecord, { requireMissing: true });
    if (!created.ok) {
      return { ok: false, status: "failed", reason: created.reason, pushed: false, attempt_count: 0 };
    }
    record = created.record;
  }

  while (record.attempt_count < LINE_FINAL_DELIVERY_MAX_ATTEMPTS) {
    if (record.attempt_count > 0) {
      const retryAfterSeconds = Number.isFinite(record.retry_after_seconds)
        ? record.retry_after_seconds
        : LINE_FINAL_DELIVERY_DEFAULT_RETRY_AFTER_SECONDS;
      await waitForFinalDeliveryRetry(retryAfterSeconds, env);
    }

    const attemptedAt = new Date().toISOString();
    const attemptRecord = {
      ...record,
      status: "pending",
      attempt_count: record.attempt_count + 1,
      first_attempt_at: record.first_attempt_at || attemptedAt,
      last_attempt_at: attemptedAt,
      last_http_status: null,
      retry_after_seconds: null,
      next_attempt_at: null,
    };
    const attemptPersisted = await persistFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey, attemptRecord, {
      expectedRetryKey: record.retry_key,
    });
    if (!attemptPersisted.ok) {
      return {
        ok: false,
        status: "failed",
        reason: attemptPersisted.reason,
        pushed: false,
        attempt_count: record.attempt_count,
      };
    }
    record = attemptPersisted.record;

    const pushResult = await pushToLine(userId, replyText, env, { retryKey: record.retry_key });
    const legalDuplicate = pushResult.http_status === 409 && pushResult.accepted_request_id_present === true;
    if (pushResult.ok || legalDuplicate) {
      const deliveredRecord = {
        ...record,
        status: "delivered",
        last_http_status: pushResult.http_status,
        retry_after_seconds: null,
        next_attempt_at: null,
      };
      const delivered = await persistFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey, deliveredRecord, {
        expectedRetryKey: record.retry_key,
      });
      if (!delivered.ok) {
        return {
          ok: false,
          status: "failed",
          reason: delivered.reason,
          pushed: false,
          attempt_count: record.attempt_count,
        };
      }
      return {
        ok: true,
        status: "delivered",
        pushed: true,
        attempt_count: delivered.record.attempt_count,
        delivered_via: legalDuplicate ? "accepted_409" : "success_2xx",
      };
    }

    if (pushResult.http_status !== 429) {
      const failedRecord = {
        ...record,
        status: "failed",
        last_http_status: pushResult.http_status || null,
      };
      const failed = await persistFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey, failedRecord, {
        expectedRetryKey: record.retry_key,
      });
      return {
        ok: false,
        status: "failed",
        reason: failed.ok ? pushResult.reason : failed.reason,
        pushed: false,
        attempt_count: record.attempt_count,
      };
    }

    if (record.attempt_count >= LINE_FINAL_DELIVERY_MAX_ATTEMPTS) {
      const exhaustedRecord = {
        ...record,
        status: "retry_exhausted",
        last_http_status: 429,
        retry_after_seconds: null,
        next_attempt_at: null,
      };
      const exhausted = await persistFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey, exhaustedRecord, {
        expectedRetryKey: record.retry_key,
      });
      return {
        ok: false,
        status: "retry_exhausted",
        reason: exhausted.ok ? "line_push_http_429_retry_exhausted" : exhausted.reason,
        pushed: false,
        attempt_count: record.attempt_count,
      };
    }

    const retryAfterSeconds = Number.isFinite(pushResult.retry_after_seconds)
      ? pushResult.retry_after_seconds
      : LINE_FINAL_DELIVERY_DEFAULT_RETRY_AFTER_SECONDS;
    const retryRecord = {
      ...record,
      status: "pending",
      last_http_status: 429,
      retry_after_seconds: retryAfterSeconds,
      next_attempt_at: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
    };
    const retryPending = await persistFinalDeliveryRecord(env.RUNTIME_KV, deliveryKey, retryRecord, {
      expectedRetryKey: record.retry_key,
    });
    if (!retryPending.ok) {
      return {
        ok: false,
        status: "failed",
        reason: retryPending.reason,
        pushed: false,
        attempt_count: record.attempt_count,
      };
    }
    record = retryPending.record;
  }

  return { ok: false, status: "retry_exhausted", reason: "line_push_http_429_retry_exhausted", pushed: false, attempt_count: record.attempt_count };
}

function parseRetryAfterSeconds(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;
  const seconds = Number(text);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
}

async function finalDeliveryPayloadFingerprint(userId, replyText) {
  const payload = JSON.stringify({
    to: String(userId || ""),
    messages: [{ type: "text", text: String(replyText || "") }],
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readFinalDeliveryRecord(kv, deliveryKey) {
  try {
    const raw = await kv.get(deliveryKey);
    if (!raw) return { ok: true, record: null };
    const record = parseJsonSafely(raw);
    return record ? { ok: true, record } : { ok: false, reason: "delivery_record_unreadable" };
  } catch {
    return { ok: false, reason: "delivery_record_read_failed" };
  }
}

async function persistFinalDeliveryRecord(kv, deliveryKey, record, options = {}) {
  try {
    const beforeRaw = await kv.get(deliveryKey);
    const before = beforeRaw ? parseJsonSafely(beforeRaw) : null;
    if (options.requireMissing && beforeRaw) {
      return { ok: false, reason: "delivery_record_already_exists" };
    }
    if (options.expectedRetryKey && before?.retry_key !== options.expectedRetryKey) {
      return { ok: false, reason: "delivery_retry_key_mismatch" };
    }
    await kv.put(deliveryKey, JSON.stringify(record), { expirationTtl: EVIDENCE_TTL_SECONDS });
    const readbackRaw = await kv.get(deliveryKey);
    const readback = readbackRaw ? parseJsonSafely(readbackRaw) : null;
    if (!readback || JSON.stringify(readback) !== JSON.stringify(record)) {
      return { ok: false, reason: "delivery_record_readback_failed" };
    }
    return { ok: true, record: readback };
  } catch {
    return { ok: false, reason: "delivery_record_write_failed" };
  }
}

async function waitForFinalDeliveryRetry(seconds, env = {}) {
  if (typeof env.LINE_FINAL_RETRY_WAIT === "function") {
    await env.LINE_FINAL_RETRY_WAIT(seconds);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export async function markLineMessageAsRead(markAsReadToken, env = {}) {
  const authorization = lineAuthorizationHeader(env);
  if (!authorization.ok) {
    return authorization;
  }
  if (!markAsReadToken) {
    return { ok: false, reason: "missing_mark_as_read_token", status: 400 };
  }

  let response;
  try {
    const timeoutMs = Number(env.LINE_MARK_AS_READ_TIMEOUT_MS || LINE_MARK_AS_READ_TIMEOUT_MS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    response = await fetch("https://api.line.me/v2/bot/chat/markAsRead", {
      method: "POST",
      headers: {
        authorization: authorization.value,
        "content-type": "application/json",
      },
      body: JSON.stringify({ markAsReadToken }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (error) {
    return { ok: false, reason: `line_mark_as_read_exception_${error?.name || "Error"}`, status: 502 };
  }

  if (!response.ok) {
    return { ok: false, reason: `line_mark_as_read_http_${response.status}`, status: response.status };
  }

  return { ok: true, status: 200 };
}

export async function markLineMessageAsReadForEvent(event = {}, normalized = {}, env = {}) {
  if (env.LINE_MARK_AS_READ_ENABLED !== "true") {
    await persistEvidenceStage(env, normalized, "line_mark_as_read_skipped_disabled", {
      status: "skipped",
      reason: "LINE_MARK_AS_READ_DISABLED",
    });
    logStage("line_mark_as_read_skipped_disabled", {
      request_id: normalized.request_id,
      status: "skipped",
    });
    return { ok: true, skipped: true, reason: "LINE_MARK_AS_READ_DISABLED" };
  }

  const token = event.message?.markAsReadToken || event.markAsReadToken || "";
  if (!token) {
    await persistEvidenceStage(env, normalized, "line_mark_as_read_skipped_no_token", {
      status: "skipped",
      reason: "missing_mark_as_read_token",
    });
    logStage("line_mark_as_read_skipped_no_token", {
      request_id: normalized.request_id,
      status: "skipped",
    });
    return { ok: true, skipped: true, reason: "missing_mark_as_read_token" };
  }

  const result = await markLineMessageAsRead(token, env);
  if (result.ok) {
    await persistEvidenceStage(env, normalized, "line_mark_as_read_completed", {
      status: "completed",
    });
    logStage("line_mark_as_read_completed", {
      request_id: normalized.request_id,
      status: "completed",
    });
    return result;
  }

  const reason = markAsReadFailureCategory(result.reason, result.status);
  await persistEvidenceStage(env, normalized, "line_mark_as_read_failed", {
    status: "failed",
    reason,
  });
  logStage("line_mark_as_read_failed", {
    request_id: normalized.request_id,
    status: "failed",
    reason,
  });
  return { ...result, reason };
}

export function lineAuthorizationHeader(env = {}) {
  const token = (env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
  if (!token) {
    return { ok: false, reason: "missing_LINE_CHANNEL_ACCESS_TOKEN", status: 503 };
  }
  return {
    ok: true,
    value: token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`,
  };
}

function markAsReadFailureCategory(reason = "", status = 0) {
  if (status === 401 || status === 403) {
    return `line_mark_as_read_auth_${status}`;
  }
  if (String(reason || "").includes("missing_LINE_CHANNEL_ACCESS_TOKEN")) {
    return "missing_LINE_CHANNEL_ACCESS_TOKEN";
  }
  if (String(reason || "").includes("AbortError")) {
    return "line_mark_as_read_timeout";
  }
  if (String(reason || "").startsWith("line_mark_as_read_http_")) {
    return String(reason).slice(0, 80);
  }
  if (String(reason || "").startsWith("line_mark_as_read_exception_")) {
    return "line_mark_as_read_exception";
  }
  return "line_mark_as_read_failed";
}

export function firstTextEvent(payload) {
  return payload.events?.find((event) => event.type === "message" && event.message?.type === "text") || null;
}

export function extractGateMarker(messageText = "") {
  return messageText.match(GATE_MARKER_PATTERN)?.[0] || "";
}

export async function handleEvidenceRead(request, env = {}) {
  const guard = authorizeEvidenceRead(request, env);
  if (!guard.ok) {
    return jsonResponse({ status: "rejected", reason: guard.reason }, guard.status);
  }

  const url = new URL(request.url);
  const marker = sanitizeEvidenceId(url.searchParams.get("marker") || "");
  let requestId = sanitizeEvidenceId(url.searchParams.get("request_id") || "");
  if (!requestId && marker) {
    requestId = await env.RUNTIME_KV?.get(evidenceMarkerKey(marker)) || "";
  }
  if (!requestId) {
    return jsonResponse({ status: "rejected", reason: "missing_request_id_or_marker" }, 400);
  }

  const evidence = await readEvidenceForRequest(env, requestId);
  return jsonResponse({
    status: "ok",
    worker: WORKER_NAME,
    marker: marker || evidence.marker || "",
    request_id: requestId,
    stages: evidence.stages,
    summary: summarizeEvidenceStages(evidence.stages),
  });
}

export async function handleEvidenceSelfcheck(request, env = {}) {
  const guard = authorizeEvidenceSelfcheck(request, env);
  if (!guard.ok) {
    return jsonResponse({ status: "rejected", reason: guard.reason }, guard.status);
  }

  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const url = new URL(request.url);
  const marker = sanitizeEvidenceId(url.searchParams.get("marker") || `T1601-${timestamp}`);
  const requestId = sanitizeEvidenceId(url.searchParams.get("request_id") || `pline-v3-selfcheck-${timestamp}`);
  const normalized = {
    request_id: requestId,
    gate_marker: marker,
  };

  const started = await persistEvidenceStage(env, normalized, "selfcheck_started", {
    marker,
    status: "started",
  });
  const completed = await persistEvidenceStage(env, normalized, "selfcheck_completed", {
    marker,
    status: "completed",
  });
  const markerValue = await env.RUNTIME_KV.get(evidenceMarkerKey(marker));
  const evidence = await readEvidenceForRequest(env, requestId);
  const stageNames = evidence.stages.map((stage) => stage.stage);
  const ok = Boolean(
    started.ok
    && completed.ok
    && markerValue === requestId
    && stageNames.includes("selfcheck_started")
    && stageNames.includes("selfcheck_completed")
  );

  return jsonResponse({
    status: ok ? "ok" : "failed",
    worker: WORKER_NAME,
    check: "runtime_kv_evidence_selfcheck",
    marker,
    request_id: requestId,
    runtime_kv_bound: Boolean(env.RUNTIME_KV),
    marker_roundtrip: markerValue === requestId,
    stage_count: evidence.stages.length,
    stage_names: stageNames,
    started_ok: Boolean(started.ok),
    completed_ok: Boolean(completed.ok),
  }, ok ? 200 : 500);
}

export async function handleIdeaFinalize(request, env = {}) {
  if (!env.RUNTIME_KV) {
    return jsonResponse({ status: "rejected", reason: "missing_RUNTIME_KV" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid_json" }, 400);
  }

  const taskId = sanitizeEvidenceId(body.task_id || "");
  const requestId = sanitizeEvidenceId(body.request_id || "");
  const providedToken = sanitizeEvidenceId(body.finalize_token || "");
  const callbackStatus = sanitizeEvidenceId(body.status || "");
  if (!taskId || !requestId || !providedToken) {
    return jsonResponse({ status: "rejected", reason: "missing_finalize_identity" }, 400);
  }

  const taskRaw = await env.RUNTIME_KV.get(ideaTaskKey(taskId));
  if (!taskRaw) {
    return jsonResponse({ status: "rejected", reason: "missing_idea_task" }, 404);
  }

  let task;
  try {
    task = JSON.parse(taskRaw);
  } catch {
    return jsonResponse({ status: "rejected", reason: "unreadable_idea_task" }, 409);
  }

  if (task.action !== IDEA_TASK_ACTION || task.request_id !== requestId) {
    return jsonResponse({ status: "rejected", reason: "finalize_task_mismatch" }, 409);
  }
  if (!task.finalize_token || !constantTimeEqual(task.finalize_token, providedToken)) {
    return jsonResponse({ status: "rejected", reason: "invalid_finalize_token" }, 401);
  }

  const normalized = {
    request_id: task.request_id,
    gate_marker: task.marker || "",
  };
  if (callbackStatus === "failed" || task.status === "failed") {
    await persistEvidenceStage(env, normalized, "idea_json_save_failed", {
      action: IDEA_TASK_ACTION,
      status: "failed",
      reason: "monitor_task_failed",
    });
    const failedResult = await pushIdeaFailureOnce(env, task, "monitor_task_failed");
    return jsonResponse(failedResult, failedResult.ok ? 200 : 500);
  }

  if (callbackStatus !== "completed" && callbackStatus !== "duplicate") {
    return jsonResponse({ status: "rejected", reason: "unsupported_finalize_status" }, 400);
  }
  if (task.status !== "completed" && task.status !== "duplicate") {
    return jsonResponse({ status: "rejected", reason: "idea_task_not_saved" }, 409);
  }

  if (task.status === "duplicate" || callbackStatus === "duplicate") {
    const suppressed = await suppressIdeaFinalOnce(env, task, "duplicate_idea_task");
    return jsonResponse(suppressed, suppressed.ok ? 200 : 500);
  }

  const result = await pushIdeaFinalOnce(env, task);
  return jsonResponse(result, result.ok ? 200 : 500);
}

export async function handleCodexFinalize(request, env = {}) {
  if (!env.RUNTIME_KV) {
    return jsonResponse({ status: "rejected", reason: "missing_RUNTIME_KV" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid_json" }, 400);
  }

  const taskId = sanitizeEvidenceId(body.task_id || "");
  const requestId = sanitizeEvidenceId(body.request_id || "");
  const providedToken = sanitizeEvidenceId(body.finalize_token || "");
  const callbackStatus = sanitizeEvidenceId(body.status || "");
  if (!taskId || !requestId || !providedToken) {
    return jsonResponse({ status: "rejected", reason: "missing_finalize_identity" }, 400);
  }

  const taskRaw = await env.RUNTIME_KV.get(codexTaskKey(taskId));
  if (!taskRaw) {
    return jsonResponse({ status: "rejected", reason: "missing_codex_task" }, 404);
  }

  const task = parseJsonSafely(taskRaw);
  if (!task) {
    return jsonResponse({ status: "rejected", reason: "unreadable_codex_task" }, 409);
  }

  if (task.action !== CODEX_TASK_ACTION || task.request_id !== requestId) {
    return jsonResponse({ status: "rejected", reason: "finalize_task_mismatch" }, 409);
  }
  if (!task.finalize_token || !constantTimeEqual(task.finalize_token, providedToken)) {
    return jsonResponse({ status: "rejected", reason: "invalid_finalize_token" }, 401);
  }

  if (callbackStatus === "failed" || task.status === "failed") {
    const failedResult = await pushCodexFailureOnce(env, task, body.reason || "monitor_task_failed");
    return jsonResponse(failedResult, failedResult.ok ? 200 : 500);
  }

  if (callbackStatus !== "completed") {
    return jsonResponse({ status: "rejected", reason: "unsupported_finalize_status" }, 400);
  }
  if (task.status !== "completed") {
    return jsonResponse({ status: "rejected", reason: "codex_task_not_completed" }, 409);
  }

  const result = await pushCodexFinalOnce(env, task);
  return jsonResponse(result, result.ok ? 200 : 500);
}

export async function handleMemoFinalize(request, env = {}) {
  if (!env.IDEMPOTENCY_KV) {
    return jsonResponse({ status: "rejected", reason: "missing_IDEMPOTENCY_KV" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid_json" }, 400);
  }

  const taskId = sanitizeEvidenceId(body.task_id || "");
  const requestId = sanitizeEvidenceId(body.request_id || "");
  const providedHeaderSecret = request.headers.get(MEMO_CALLBACK_SECRET_HEADER) || "";
  const headerAuthValid = Boolean(
    env.N8N_MEMO_CALLBACK_SECRET
    && providedHeaderSecret
    && constantTimeEqual(env.N8N_MEMO_CALLBACK_SECRET, providedHeaderSecret)
  );
  const callbackStatus = sanitizeEvidenceId(body.status || "");
  const operation = sanitizeEvidenceId(body.operation || "");
  const memoId = sanitizeEvidenceId(body.memo_id || "");
  const callbackMemoIds = Array.isArray(body.memo_ids)
    ? body.memo_ids.map((value) => String(value || ""))
    : [];
  const safeEventHash = memoSafeEventHashFromTaskId(taskId);
  if (!safeEventHash || !requestId || !MEMO_DETERMINISTIC_OPERATIONS.includes(operation)) {
    return jsonResponse({ status: "rejected", reason: "missing_finalize_identity" }, 400);
  }
  if (!headerAuthValid) {
    return jsonResponse({ status: "rejected", reason: "invalid_callback_auth" }, 401);
  }

  const acceptanceKey = memoCreateAcceptanceKey(safeEventHash);
  const record = parseMemoCreateAcceptanceRecord(await env.IDEMPOTENCY_KV.get(acceptanceKey));
  if (!record) {
    return jsonResponse({ status: "rejected", reason: "missing_memo_acceptance" }, 404);
  }
  const selectionDelete = operation === MEMO_DELETE_OPERATION
    && record.normalized_command?.selection_mode
    && record.normalized_command.selection_mode !== "memo_id";
  const expectedMemoIds = selectionDelete && Array.isArray(record.normalized_command?.memo_ids)
    ? record.normalized_command.memo_ids
    : [];
  const pageReadback = operation === MEMO_SEARCH_PAGE_OPERATION;
  const expectedPageMemoIds = pageReadback && Array.isArray(record.normalized_command?.page_memo_ids)
    ? record.normalized_command.page_memo_ids
    : [];
  const singleMemoIdentityRequired = [MEMO_CREATE_OPERATION, MEMO_MODIFY_OPERATION].includes(operation)
    || (operation === MEMO_DELETE_OPERATION && !selectionDelete);
  if (
    record.safe_event_hash !== safeEventHash
    || record.operation !== operation
    || (singleMemoIdentityRequired
      && (!MEMO_ID_PATTERN.test(memoId) || record.memo_id !== memoId))
    || (selectionDelete && (
      expectedMemoIds.length === 0
      || callbackMemoIds.length !== expectedMemoIds.length
      || callbackMemoIds.some((candidate, index) => !MEMO_ID_PATTERN.test(candidate) || candidate !== expectedMemoIds[index])
    ))
    || (pageReadback && (
      expectedPageMemoIds.length === 0
      || callbackMemoIds.length !== expectedPageMemoIds.length
      || callbackMemoIds.some((candidate, index) => !MEMO_ID_PATTERN.test(candidate) || candidate !== expectedPageMemoIds[index])
    ))
    || record.callback_reference?.task_id !== taskId
    || record.callback_reference?.request_id !== requestId
  ) {
    return jsonResponse({ status: "rejected", reason: "finalize_task_mismatch" }, 409);
  }

  if (memoCreateFinalStatus(record.status)) {
    return jsonResponse({
      ok: true,
      status: "already_finalized",
      replied: false,
      pushed: false,
    }, 200);
  }

  let replyText;
  let terminalStatus;
  if (callbackStatus === "completed" || callbackStatus === "duplicate") {
    if (operation === MEMO_SEARCH_OPERATION) {
      const parsedSearch = parseMemoSearchSelectionResult(
        body.reply_text,
        body.selection_candidates,
        body.total,
        body.page_candidates,
        body.page,
      );
      if (!parsedSearch.ok) {
        try {
          await persistMemoSearchSelectionSnapshot(env.IDEMPOTENCY_KV, record, {
            candidates: [], total: 0, page_count: 0, page: 0,
          });
        } catch {
          // The reply remains fail-closed even if the prior snapshot could not be invalidated.
        }
        const failed = await deliverMemoReplyOnce(
          env,
          acceptanceKey,
          parsedSearch.reply_text || MEMO_SEARCH_SELECTION_FAILED_REPLY_TEXT,
          "final_failed",
        );
        return jsonResponse({ ok: Boolean(failed.ok), status: failed.status, replied: Boolean(failed.replied), pushed: false }, 200);
      }
      try {
        await persistMemoSearchSelectionSnapshot(env.IDEMPOTENCY_KV, record, parsedSearch);
      } catch {
        const failed = await deliverMemoReplyOnce(
          env,
          acceptanceKey,
          MEMO_SEARCH_SELECTION_FAILED_REPLY_TEXT,
          "final_failed",
        );
        return jsonResponse({ ok: Boolean(failed.ok), status: failed.status, replied: Boolean(failed.replied), pushed: false }, 200);
      }
      replyText = parsedSearch.reply_text;
      terminalStatus = "final_completed";
    } else if (operation === MEMO_SEARCH_PAGE_OPERATION) {
      const parsedPage = parseMemoSearchPageResult({
        pageCandidates: body.page_candidates,
        expectedMemoIds: expectedPageMemoIds,
        pageNumber: Number(record.normalized_command?.page_number || 0),
        pageCount: Number(record.normalized_command?.page_count || 0),
        total: Number(record.normalized_command?.page_total || 0),
        globalStart: Number(record.normalized_command?.page_global_start || 0),
      });
      if (!parsedPage.ok) {
        const failed = await deliverMemoReplyOnce(
          env,
          acceptanceKey,
          MEMO_SEARCH_SELECTION_FAILED_REPLY_TEXT,
          "final_failed",
        );
        return jsonResponse({ ok: Boolean(failed.ok), status: failed.status, replied: Boolean(failed.replied), pushed: false }, 200);
      }
      try {
        await persistMemoSearchPageSnapshotCurrentPage(env.IDEMPOTENCY_KV, record, parsedPage);
      } catch {
        const failed = await deliverMemoReplyOnce(
          env,
          acceptanceKey,
          MEMO_SEARCH_SELECTION_FAILED_REPLY_TEXT,
          "final_failed",
        );
        return jsonResponse({ ok: Boolean(failed.ok), status: failed.status, replied: Boolean(failed.replied), pushed: false }, 200);
      }
      replyText = parsedPage.reply_text;
      terminalStatus = "final_completed";
    } else {
    replyText = memoSuccessReplyText({ operation, callbackStatus, replyText: body.reply_text });
    if (!replyText) {
      return jsonResponse({ status: "rejected", reason: "invalid_reply_text" }, 400);
    }
    terminalStatus = "final_completed";
    }
  } else if (["failed", "readback_failed", "conflict"].includes(callbackStatus)) {
    if (operation === MEMO_SEARCH_OPERATION) {
      try {
        await persistMemoSearchSelectionSnapshot(env.IDEMPOTENCY_KV, record, { candidates: [] });
      } catch {
        // Failure replies stay fail-safe even if the stale snapshot could not be replaced.
      }
    }
    replyText = operation === MEMO_CREATE_OPERATION
      ? MEMO_CREATE_FAILED_REPLY_TEXT
      : MEMO_OPERATION_FAILED_REPLY_TEXT;
    terminalStatus = "final_failed";
  } else {
    return jsonResponse({ status: "rejected", reason: "unsupported_finalize_status" }, 400);
  }

  const result = await deliverMemoReplyOnce(env, acceptanceKey, replyText, terminalStatus);
  return jsonResponse({
    ok: Boolean(result.ok),
    status: result.status,
    replied: Boolean(result.replied),
    pushed: false,
  }, 200);
}

export function memoSuccessReplyText({ operation = "", replyText = "" } = {}) {
  if (operation === MEMO_SEARCH_OPERATION) {
    const parsed = parseMemoSearchSelectionResult(replyText);
    return parsed.ok ? parsed.reply_text : "";
  }
  const fallback = MEMO_SUCCESS_REPLY_FALLBACK[operation] || "";
  if (!fallback) return "";
  const candidate = typeof replyText === "string"
    ? replyText.replace(/\s+/g, " ").trim()
    : "";
  const safe = candidate.length >= 2
    && candidate.length <= MEMO_SUCCESS_REPLY_MAX_LENGTH
    && /[\u3400-\u9fff]/.test(candidate)
    && !MEMO_SUCCESS_REPLY_FORBIDDEN_PATTERN.test(candidate)
    && !MEMO_SUCCESS_REPLY_SIMPLIFIED_PATTERN.test(candidate);
  return safe ? candidate : fallback;
}

async function deliverMemoReplyOnce(
  env = {},
  acceptanceKey = "",
  replyText = "",
  terminalStatus = "final_completed",
  options = {},
) {
  const validationHandoff = memoValidationAcceptanceHandoff(
    options.validationAcceptanceRecord,
    acceptanceKey,
  );
  const record = validationHandoff
    || parseMemoCreateAcceptanceRecord(await env.IDEMPOTENCY_KV?.get(acceptanceKey));
  if (!record) {
    return { ok: false, status: "failed", reason: "missing_memo_acceptance", replied: false, pushed: false };
  }
  if (memoCreateFinalStatus(record.status)) {
    return { ok: true, status: "already_finalized", replied: false, pushed: false, duplicate_blocked: true };
  }
  if (record.status === "reply_attempt_pending") {
    return { ok: false, status: "delivery_ambiguous", replied: false, pushed: false, duplicate_blocked: true };
  }

  const receivedAtMs = Date.parse(String(record.received_at || ""));
  const nowMs = typeof env.LINE_REPLY_NOW_MS === "function"
    ? Number(env.LINE_REPLY_NOW_MS())
    : Number(env.LINE_REPLY_NOW_MS || Date.now());
  const ageMs = Number.isFinite(receivedAtMs) && Number.isFinite(nowMs)
    ? nowMs - receivedAtMs
    : Number.POSITIVE_INFINITY;
  const eligible = Boolean(record.reply_token)
    && ageMs >= 0
    && ageMs <= LINE_REPLY_ELIGIBILITY_WINDOW_MS;
  if (!eligible) {
    const unavailable = clearMemoDeliveryMaterial({
      ...record,
      status: "reply_unavailable",
      final_status: terminalStatus,
      reason: record.reply_token ? "reply_token_expired" : "missing_reply_token",
      updated_at: new Date(nowMs).toISOString(),
    });
    await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, unavailable);
    return { ok: false, status: "reply_unavailable", reason: unavailable.reason, replied: false, pushed: false };
  }

  const pending = {
    ...record,
    status: "reply_attempt_pending",
    final_status: terminalStatus,
    reply_attempt_count: 1,
    reply_started_at: new Date(nowMs).toISOString(),
    updated_at: new Date(nowMs).toISOString(),
  };
  await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, pending);
  const replyResult = await attemptFinalReply(record.reply_token, replyText, env);
  if (replyResult.ok) {
    await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, clearMemoDeliveryMaterial({
      ...pending,
      status: terminalStatus,
      delivery_status: "reply_delivered",
      reply_http_status: replyResult.http_status,
      final_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    return { ok: true, status: terminalStatus, replied: true, pushed: false, reply_attempt_count: 1 };
  }

  const status = replyResult.ambiguous ? "delivery_ambiguous" : "reply_rejected";
  await writeMemoCreateAcceptance(env.IDEMPOTENCY_KV, acceptanceKey, clearMemoDeliveryMaterial({
    ...pending,
    status,
    delivery_status: status,
    reason: replyResult.reason,
    reply_http_status: replyResult.http_status || null,
    updated_at: new Date().toISOString(),
  }));
  return {
    ok: false,
    status,
    reason: replyResult.reason,
    replied: false,
    pushed: false,
    reply_attempt_count: 1,
  };
}

function clearMemoDeliveryMaterial(record = {}) {
  return {
    ...record,
    reply_token: "",
    callback_reference: {
      callback_url: String(record.callback_reference?.callback_url || ""),
      task_id: String(record.callback_reference?.task_id || ""),
      request_id: String(record.callback_reference?.request_id || ""),
    },
    delivery_material_cleared_at: new Date().toISOString(),
  };
}

function memoSafeEventHashFromTaskId(taskId = "") {
  return String(taskId || "").match(/^memo-task-([a-f0-9]{64})$/)?.[1] || "";
}

export async function persistWebhookAcceptedEvidenceCheckpoint(env = {}, normalized = {}, details = {}) {
  return persistEvidenceStages(env, normalized, [
    ["line_event_received", { marker: normalized.gate_marker }],
    ["signature_pass", {}],
    ["admin_pass", { bootstrap: Boolean(details.bootstrap) }],
    ["idempotency_pass", {}],
    ["line_visible_ack_skipped", { reply_mode: LINE_REPLY_MODE }],
  ]);
}

async function pushIdeaFinalOnce(env = {}, task = {}) {
  const finalKey = ideaFinalKey(task.task_id);
  const existingRaw = await env.RUNTIME_KV.get(finalKey);
  if (existingRaw) {
    const existing = parseJsonSafely(existingRaw);
    if (existing?.status === "completed" || existing?.status === "sending") {
      return {
        ok: true,
        status: existing.status === "completed" ? "already_completed" : "already_sending",
        pushed: false,
        request_id: task.request_id,
      };
    }
    if (existing?.status === "suppressed") {
      return {
        ok: true,
        status: "suppressed",
        pushed: false,
        request_id: task.request_id,
      };
    }
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-idea-final/v1",
    status: "sending",
    task_id: task.task_id,
    request_id: task.request_id,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });

  const userId = await openLineUserRef(task.line_user_ref, env);
  if (!userId.ok) {
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-idea-final/v1",
      status: "failed",
      task_id: task.task_id,
      request_id: task.request_id,
      reason: userId.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await persistEvidenceStage(env, ideaTaskEvidenceTarget(task), "idea_json_final_push_failed", {
      action: IDEA_TASK_ACTION,
      status: "failed",
      reason: userId.reason,
    });
    return { ok: false, status: "failed", reason: userId.reason, request_id: task.request_id };
  }

  const deliveryResult = await deliverFinalReplyFirst({
    env,
    deliveryKey: `${finalKey}:delivery`,
    userId: userId.value,
    replyToken: task.reply_token,
    replyReceivedAt: task.reply_received_at,
    replyText: naturalIdeaReplyText(task.final_reply_text),
  });
  if (!deliveryResult.ok) {
    const finalStatus = deliveryResult.status === "delivery_ambiguous" ? "delivery_ambiguous" : "failed";
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-idea-final/v1",
      status: finalStatus,
      task_id: task.task_id,
      request_id: task.request_id,
      reason: deliveryResult.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await persistEvidenceStage(env, ideaTaskEvidenceTarget(task), finalStatus === "delivery_ambiguous" ? "idea_json_final_delivery_ambiguous" : "idea_json_final_push_failed", {
      action: IDEA_TASK_ACTION,
      status: finalStatus,
      reason: deliveryResult.reason,
    });
    return { ok: false, status: finalStatus, reason: deliveryResult.reason, pushed: false, replied: false, request_id: task.request_id };
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-idea-final/v1",
    status: "completed",
    task_id: task.task_id,
    request_id: task.request_id,
    delivery_mode: deliveryResult.delivery_mode,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });
  const completedStage = deliveryResult.delivery_mode === "reply" ? "idea_json_final_reply_completed" : "idea_json_final_push_completed";
  await persistEvidenceStage(env, ideaTaskEvidenceTarget(task), completedStage, {
    action: IDEA_TASK_ACTION,
    status: "completed",
    final_mode: `monitor_callback_exactly_once_${deliveryResult.delivery_mode}`,
  });
  logStage(completedStage, {
    request_id: task.request_id,
    action: IDEA_TASK_ACTION,
    status: "completed",
    final_mode: `monitor_callback_exactly_once_${deliveryResult.delivery_mode}`,
  });
  return {
    ok: true,
    status: "completed",
    pushed: Boolean(deliveryResult.pushed),
    replied: Boolean(deliveryResult.replied),
    delivery_mode: deliveryResult.delivery_mode,
    request_id: task.request_id,
  };
}

async function suppressIdeaFinalOnce(env = {}, task = {}, reason = "duplicate_idea_task") {
  const finalKey = ideaFinalKey(task.task_id);
  const existingRaw = await env.RUNTIME_KV.get(finalKey);
  if (existingRaw) {
    const existing = parseJsonSafely(existingRaw);
    if (existing?.status === "completed" || existing?.status === "suppressed" || existing?.status === "sending") {
      return {
        ok: true,
        status: existing.status === "completed" ? "already_completed" : "suppressed",
        pushed: false,
        request_id: task.request_id,
      };
    }
  }
  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-idea-final/v1",
    status: "suppressed",
    task_id: task.task_id,
    request_id: task.request_id,
    reason,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });
  await persistEvidenceStage(env, ideaTaskEvidenceTarget(task), "idea_json_final_push_suppressed", {
    action: IDEA_TASK_ACTION,
    status: "duplicate",
    reason,
  });
  logStage("idea_json_final_push_suppressed", {
    request_id: task.request_id,
    action: IDEA_TASK_ACTION,
    status: "duplicate",
    reason,
  });
  return { ok: true, status: "suppressed", pushed: false, request_id: task.request_id };
}

async function pushIdeaFailureOnce(env = {}, task = {}, reason = "monitor_task_failed") {
  const finalKey = ideaFinalKey(task.task_id);
  const existingRaw = await env.RUNTIME_KV.get(finalKey);
  if (existingRaw) {
    const existing = parseJsonSafely(existingRaw);
    if (existing?.status === "completed" || existing?.status === "sending" || existing?.status === "failure_notice_completed") {
      return {
        ok: true,
        status: existing.status,
        pushed: false,
        request_id: task.request_id,
      };
    }
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-idea-final/v1",
    status: "sending",
    task_id: task.task_id,
    request_id: task.request_id,
    reason,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });

  const userId = await openLineUserRef(task.line_user_ref, env);
  if (!userId.ok) {
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-idea-final/v1",
      status: "failed",
      task_id: task.task_id,
      request_id: task.request_id,
      reason: userId.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    return { ok: false, status: "failed", reason: userId.reason, request_id: task.request_id };
  }

  const deliveryResult = await deliverFinalReplyFirst({
    env,
    deliveryKey: `${finalKey}:delivery`,
    userId: userId.value,
    replyToken: task.reply_token,
    replyReceivedAt: task.reply_received_at,
    replyText: IDEA_SAVE_FAILED_REPLY_TEXT,
  });
  if (!deliveryResult.ok) {
    const finalStatus = deliveryResult.status === "delivery_ambiguous" ? "delivery_ambiguous" : "failed";
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-idea-final/v1",
      status: finalStatus,
      task_id: task.task_id,
      request_id: task.request_id,
      reason: deliveryResult.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await persistEvidenceStage(env, ideaTaskEvidenceTarget(task), finalStatus === "delivery_ambiguous" ? "idea_json_final_delivery_ambiguous" : "idea_json_final_push_failed", {
      action: IDEA_TASK_ACTION,
      status: finalStatus,
      reason: deliveryResult.reason,
    });
    return { ok: false, status: finalStatus, reason: deliveryResult.reason, pushed: false, replied: false, request_id: task.request_id };
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-idea-final/v1",
    status: "failure_notice_completed",
    task_id: task.task_id,
    request_id: task.request_id,
    reason,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });
  await persistEvidenceStage(env, ideaTaskEvidenceTarget(task), "idea_json_final_failure_notice_completed", {
    action: IDEA_TASK_ACTION,
    status: "failed",
    reason,
  });
  return {
    ok: true,
    status: "failure_notice_completed",
    pushed: Boolean(deliveryResult.pushed),
    replied: Boolean(deliveryResult.replied),
    delivery_mode: deliveryResult.delivery_mode,
    request_id: task.request_id,
  };
}

async function pushCodexFinalOnce(env = {}, task = {}) {
  const finalKey = codexFinalKey(task.task_id);
  const existingRaw = await env.RUNTIME_KV.get(finalKey);
  if (existingRaw) {
    const existing = parseJsonSafely(existingRaw);
    if (existing?.status === "completed" || existing?.status === "sending") {
      return {
        ok: true,
        status: existing.status === "completed" ? "already_completed" : "already_sending",
        pushed: false,
        request_id: task.request_id,
      };
    }
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-codex-final/v1",
    status: "sending",
    task_id: task.task_id,
    request_id: task.request_id,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });

  const userId = await openLineUserRef(task.line_user_ref, env);
  if (!userId.ok) {
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-codex-final/v1",
      status: "failed",
      task_id: task.task_id,
      request_id: task.request_id,
      reason: userId.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await persistEvidenceStage(env, codexTaskEvidenceTarget(task), "codex_task_final_push_failed", {
      action: CODEX_TASK_ACTION,
      status: "failed",
      reason: userId.reason,
    });
    return { ok: false, status: "failed", reason: userId.reason, request_id: task.request_id };
  }

  const deliveryResult = await deliverFinalReplyFirst({
    env,
    deliveryKey: `${finalKey}:delivery`,
    userId: userId.value,
    replyToken: task.reply_token,
    replyReceivedAt: task.reply_received_at,
    replyText: CODEX_COMPLETED_REPLY_TEXT,
  });
  if (!deliveryResult.ok) {
    const finalStatus = deliveryResult.status === "delivery_ambiguous" ? "delivery_ambiguous" : "failed";
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-codex-final/v1",
      status: finalStatus,
      task_id: task.task_id,
      request_id: task.request_id,
      reason: deliveryResult.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await persistEvidenceStage(env, codexTaskEvidenceTarget(task), finalStatus === "delivery_ambiguous" ? "codex_task_final_delivery_ambiguous" : "codex_task_final_push_failed", {
      action: CODEX_TASK_ACTION,
      status: finalStatus,
      reason: deliveryResult.reason,
    });
    return { ok: false, status: finalStatus, reason: deliveryResult.reason, pushed: false, replied: false, request_id: task.request_id };
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-codex-final/v1",
    status: "completed",
    task_id: task.task_id,
    request_id: task.request_id,
    delivery_mode: deliveryResult.delivery_mode,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });
  const completedStage = deliveryResult.delivery_mode === "reply" ? "codex_task_final_reply_completed" : "codex_task_final_push_completed";
  await persistEvidenceStage(env, codexTaskEvidenceTarget(task), completedStage, {
    action: CODEX_TASK_ACTION,
    status: "completed",
    final_mode: `monitor_callback_exactly_once_${deliveryResult.delivery_mode}`,
  });
  logStage(completedStage, {
    request_id: task.request_id,
    action: CODEX_TASK_ACTION,
    status: "completed",
    final_mode: `monitor_callback_exactly_once_${deliveryResult.delivery_mode}`,
  });
  return {
    ok: true,
    status: "completed",
    pushed: Boolean(deliveryResult.pushed),
    replied: Boolean(deliveryResult.replied),
    delivery_mode: deliveryResult.delivery_mode,
    request_id: task.request_id,
  };
}

async function pushCodexFailureOnce(env = {}, task = {}, reason = "monitor_task_failed") {
  const finalKey = codexFinalKey(task.task_id);
  const existingRaw = await env.RUNTIME_KV.get(finalKey);
  if (existingRaw) {
    const existing = parseJsonSafely(existingRaw);
    if (existing?.status === "completed" || existing?.status === "sending" || existing?.status === "failure_notice_completed") {
      return {
        ok: true,
        status: existing.status,
        pushed: false,
        request_id: task.request_id,
      };
    }
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-codex-final/v1",
    status: "sending",
    task_id: task.task_id,
    request_id: task.request_id,
    reason,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });

  const userId = await openLineUserRef(task.line_user_ref, env);
  if (!userId.ok) {
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-codex-final/v1",
      status: "failed",
      task_id: task.task_id,
      request_id: task.request_id,
      reason: userId.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    return { ok: false, status: "failed", reason: userId.reason, request_id: task.request_id };
  }

  const failureReplyText = reason === "capability_not_yet_enabled" ? CODEX_CAPABILITY_NOT_ENABLED_REPLY_TEXT : CODEX_FAILED_REPLY_TEXT;
  const deliveryResult = await deliverFinalReplyFirst({
    env,
    deliveryKey: `${finalKey}:delivery`,
    userId: userId.value,
    replyToken: task.reply_token,
    replyReceivedAt: task.reply_received_at,
    replyText: failureReplyText,
  });
  if (!deliveryResult.ok) {
    const finalStatus = deliveryResult.status === "delivery_ambiguous" ? "delivery_ambiguous" : "failed";
    await env.RUNTIME_KV.put(finalKey, JSON.stringify({
      schema: "pline-v3-test-codex-final/v1",
      status: finalStatus,
      task_id: task.task_id,
      request_id: task.request_id,
      reason: deliveryResult.reason,
      updated_at: new Date().toISOString(),
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await persistEvidenceStage(env, codexTaskEvidenceTarget(task), finalStatus === "delivery_ambiguous" ? "codex_task_final_delivery_ambiguous" : "codex_task_final_push_failed", {
      action: CODEX_TASK_ACTION,
      status: finalStatus,
      reason: deliveryResult.reason,
    });
    return { ok: false, status: finalStatus, reason: deliveryResult.reason, pushed: false, replied: false, request_id: task.request_id };
  }

  await env.RUNTIME_KV.put(finalKey, JSON.stringify({
    schema: "pline-v3-test-codex-final/v1",
    status: "failure_notice_completed",
    task_id: task.task_id,
    request_id: task.request_id,
    reason,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: EVIDENCE_TTL_SECONDS });
  await persistEvidenceStage(env, codexTaskEvidenceTarget(task), "codex_task_final_failure_notice_completed", {
    action: CODEX_TASK_ACTION,
    status: "failed",
    reason,
  });
  return {
    ok: true,
    status: "failure_notice_completed",
    pushed: Boolean(deliveryResult.pushed),
    replied: Boolean(deliveryResult.replied),
    delivery_mode: deliveryResult.delivery_mode,
    request_id: task.request_id,
  };
}

function ideaTaskEvidenceTarget(task = {}) {
  return {
    request_id: task.request_id,
    gate_marker: task.marker || task.gate_marker || "",
  };
}

function codexTaskEvidenceTarget(task = {}) {
  return {
    request_id: task.request_id,
    gate_marker: task.marker || task.gate_marker || "",
  };
}

export async function persistEvidenceStages(env = {}, normalized = {}, entries = []) {
  if (!env.RUNTIME_KV || !normalized?.request_id || entries.length === 0) {
    return { ok: false, reason: "evidence_unavailable" };
  }

  const timestamp = new Date().toISOString();
  const marker = sanitizeEvidenceId(normalized.gate_marker || entries.find(([, details]) => details?.marker)?.[1]?.marker || "");
  const records = entries
    .filter(([stage]) => stage)
    .map(([stage, details = {}]) => sanitizeEvidenceRecord({
      worker: WORKER_NAME,
      schema: "pline-v3-test-evidence/v1",
      request_id: normalized.request_id,
      marker,
      stage,
      timestamp,
      ...details,
    }));
  const latestStage = records.at(-1)?.stage || "";

  try {
    if (marker) {
      await env.RUNTIME_KV.put(evidenceMarkerKey(marker), normalized.request_id, { expirationTtl: EVIDENCE_TTL_SECONDS });
    }
    await Promise.all(records.map((record) => env.RUNTIME_KV.put(
      evidenceStageKey(normalized.request_id, record.stage),
      JSON.stringify(record),
      { expirationTtl: EVIDENCE_TTL_SECONDS },
    )));
    await env.RUNTIME_KV.put(evidenceSummaryKey(normalized.request_id), JSON.stringify({
      worker: WORKER_NAME,
      request_id: normalized.request_id,
      marker,
      updated_at: timestamp,
      latest_stage: latestStage,
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    return { ok: true, stage_count: records.length };
  } catch (error) {
    logStage("evidence_persist_failed", {
      request_id: normalized.request_id,
      failed_stage: "fast_ack_checkpoint",
      reason: error?.name || "Error",
    });
    return { ok: false, reason: "evidence_persist_failed" };
  }
}

export async function waitForEvidenceCheckpoint(task, timeoutMs = FAST_ACK_EVIDENCE_CHECKPOINT_TIMEOUT_MS) {
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve({ ok: false, reason: "evidence_checkpoint_timeout" }), timeoutMs);
  });
  const result = await Promise.race([task, timeout]);
  if (result?.ok) {
    return { status: "completed" };
  }
  return { status: result?.reason || "failed" };
}

export function authorizeEvidenceRead(request, env = {}) {
  const provided = request.headers.get(N8N_SHARED_SECRET_HEADER) || "";
  if (env.N8N_SHARED_SECRET && provided === env.N8N_SHARED_SECRET) {
    if (!env.RUNTIME_KV) {
      return { ok: false, reason: "missing_RUNTIME_KV", status: 503 };
    }
    return { ok: true };
  }

  const selftestSecret = request.headers.get(EVIDENCE_SELFTEST_SECRET_HEADER) || "";
  if (env.EVIDENCE_SELFTEST_SECRET && selftestSecret === env.EVIDENCE_SELFTEST_SECRET) {
    if (!env.RUNTIME_KV) {
      return { ok: false, reason: "missing_RUNTIME_KV", status: 503 };
    }
    return { ok: true };
  }

  if (!env.N8N_SHARED_SECRET && !env.EVIDENCE_SELFTEST_SECRET) {
    return { ok: false, reason: "missing_evidence_read_secret", status: 503 };
  }
  if (!provided && !selftestSecret) {
    return { ok: false, reason: "invalid_evidence_read_secret", status: 401 };
  }
  return { ok: false, reason: "invalid_evidence_read_secret", status: 401 };
}

export function authorizeEvidenceSelfcheck(request, env = {}) {
  const sharedSecret = request.headers.get(N8N_SHARED_SECRET_HEADER) || "";
  if (env.N8N_SHARED_SECRET && sharedSecret === env.N8N_SHARED_SECRET) {
    if (!env.RUNTIME_KV) {
      return { ok: false, reason: "missing_RUNTIME_KV", status: 503 };
    }
    return { ok: true };
  }

  const selftestSecret = request.headers.get(EVIDENCE_SELFTEST_SECRET_HEADER) || "";
  if (!env.EVIDENCE_SELFTEST_SECRET) {
    return { ok: false, reason: "missing_EVIDENCE_SELFTEST_SECRET", status: 503 };
  }
  if (!selftestSecret || selftestSecret !== env.EVIDENCE_SELFTEST_SECRET) {
    return { ok: false, reason: "invalid_evidence_selftest_secret", status: 401 };
  }
  if (!env.RUNTIME_KV) {
    return { ok: false, reason: "missing_RUNTIME_KV", status: 503 };
  }
  return { ok: true };
}

export async function persistEvidenceStage(env = {}, normalized = {}, stage, details = {}) {
  if (!env.RUNTIME_KV || !normalized?.request_id || !stage) {
    return { ok: false, reason: "evidence_unavailable" };
  }

  const marker = sanitizeEvidenceId(details.marker || normalized.gate_marker || "");
  const record = sanitizeEvidenceRecord({
    worker: WORKER_NAME,
    schema: "pline-v3-test-evidence/v1",
    request_id: normalized.request_id,
    marker,
    stage,
    timestamp: new Date().toISOString(),
    ...details,
  });
  const stageKey = evidenceStageKey(normalized.request_id, stage);

  try {
    if (marker) {
      await env.RUNTIME_KV.put(evidenceMarkerKey(marker), normalized.request_id, { expirationTtl: EVIDENCE_TTL_SECONDS });
    }
    await env.RUNTIME_KV.put(evidenceSummaryKey(normalized.request_id), JSON.stringify({
      worker: WORKER_NAME,
      request_id: normalized.request_id,
      marker,
      updated_at: record.timestamp,
      latest_stage: stage,
    }), { expirationTtl: EVIDENCE_TTL_SECONDS });
    await env.RUNTIME_KV.put(stageKey, JSON.stringify(record), { expirationTtl: EVIDENCE_TTL_SECONDS });
    return { ok: true, key: stageKey };
  } catch (error) {
    logStage("evidence_persist_failed", {
      request_id: normalized.request_id,
      failed_stage: stage,
      reason: error?.name || "Error",
    });
    return { ok: false, reason: "evidence_persist_failed" };
  }
}

export function queueEvidenceStage(ctx, env = {}, normalized = {}, stage, details = {}) {
  const task = persistEvidenceStage(env, normalized, stage, details);
  if (ctx?.waitUntil) {
    ctx.waitUntil(task);
    return { queued: true };
  }
  return task;
}

export async function readEvidenceForRequest(env = {}, requestId) {
  if (!env.RUNTIME_KV || !requestId) {
    return { marker: "", stages: [] };
  }
  const stagePrefix = `${EVIDENCE_PREFIX}:request:${requestId}:stage:`;
  const listed = await env.RUNTIME_KV.list({ prefix: stagePrefix, limit: 100 });
  const stages = [];
  for (const key of listed.keys || []) {
    const raw = await env.RUNTIME_KV.get(key.name);
    if (!raw) {
      continue;
    }
    try {
      stages.push(JSON.parse(raw));
    } catch {
      stages.push({ stage: "unreadable_evidence_record", key: key.name });
    }
  }
  stages.sort((left, right) => `${left.timestamp || ""}`.localeCompare(`${right.timestamp || ""}`));
  return {
    marker: stages.find((stage) => stage.marker)?.marker || "",
    stages,
  };
}

export function summarizeEvidenceStages(stages = []) {
  const summary = {
    line_event: false,
    signature: false,
    admin: false,
    idempotency: false,
    fast_ack: false,
    visible_ack_skipped: false,
    webhook_http_200: false,
    n8n_started: false,
    n8n_completed: false,
    n8n_failed: false,
    intent: "",
    tool_called: "",
    saved_record: 0,
    codex_task: 0,
    action: "",
    final_push: false,
  };
  for (const stage of stages) {
    if (stage.stage === "line_event_received") summary.line_event = true;
    if (stage.stage === "signature_pass") summary.signature = true;
    if (stage.stage === "admin_pass") summary.admin = true;
    if (stage.stage === "idempotency_pass") summary.idempotency = true;
    if (stage.stage === "line_fast_reply_completed") summary.fast_ack = true;
    if (stage.stage === "line_visible_ack_skipped") summary.visible_ack_skipped = true;
    if (stage.stage === "webhook_http_200_returned") summary.webhook_http_200 = true;
    if (stage.stage === "n8n_background_started") summary.n8n_started = true;
    if (stage.stage === "n8n_background_completed") summary.n8n_completed = true;
    if (stage.stage === "n8n_background_failed" || stage.stage === "n8n_background_contract_failed") summary.n8n_failed = true;
    if (
      stage.stage === "line_push_final_completed"
      || stage.stage === "idea_json_final_push_completed"
      || stage.stage === "codex_task_final_push_completed"
    ) summary.final_push = true;
    if (stage.intent) summary.intent = stage.intent;
    if (stage.tool_called) summary.tool_called = stage.tool_called;
    if (stage.saved_record) summary.saved_record = stage.saved_record;
    if (stage.codex_task) summary.codex_task = stage.codex_task;
    if (stage.action) summary.action = stage.action;
  }
  return summary;
}

function evidenceStageKey(requestId, stage) {
  return `${EVIDENCE_PREFIX}:request:${sanitizeEvidenceId(requestId)}:stage:${sanitizeEvidenceId(stage)}`;
}

function evidenceSummaryKey(requestId) {
  return `${EVIDENCE_PREFIX}:summary:${requestId}`;
}

function evidenceMarkerKey(marker) {
  return `${EVIDENCE_PREFIX}:marker:${marker}`;
}

function codexTaskKey(taskId) {
  return `${CODEX_TASK_PREFIX}:task:${sanitizeEvidenceId(taskId)}`;
}

function codexPendingKey(taskId) {
  return `${CODEX_TASK_PREFIX}:pending:${sanitizeEvidenceId(taskId)}`;
}

function codexFinalKey(taskId) {
  return `${CODEX_TASK_PREFIX}:final:${sanitizeEvidenceId(taskId)}`;
}

function ideaTaskKey(taskId) {
  return `${IDEA_TASK_PREFIX}:task:${sanitizeEvidenceId(taskId)}`;
}

function ideaPendingKey(taskId) {
  return `${IDEA_TASK_PREFIX}:pending:${sanitizeEvidenceId(taskId)}`;
}

function ideaFinalKey(taskId) {
  return `${IDEA_TASK_PREFIX}:final:${sanitizeEvidenceId(taskId)}`;
}

function sanitizeEvidenceId(value) {
  return String(value || "").replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 160);
}

function sanitizeCodexTaskRecord(record) {
  return {
    schema: "pline-v3-test-codex-task/v1",
    status: record.status,
    monitor: CODEX_MONITOR_NAME,
    task_id: sanitizeEvidenceId(record.task_id),
    task_type: "codex_task",
    project: CODEX_TASK_PROJECT,
    project_path: CODEX_TASK_PROJECT_PATH,
    instruction: CODEX_TASK_INSTRUCTION,
    request_id: sanitizeEvidenceId(record.request_id),
    marker: sanitizeEvidenceId(record.marker || ""),
    action: CODEX_TASK_ACTION,
    target_path: CODEX_TASK_SMOKE_FILE_PATH,
    content: CODEX_TASK_SMOKE_FILE_CONTENT,
    line_user_ref: String(record.line_user_ref || ""),
    finalize_token: sanitizeEvidenceId(record.finalize_token || ""),
    reply_token: String(record.reply_token || ""),
    reply_received_at: String(record.reply_received_at || ""),
    created_at: record.created_at,
  };
}

function sanitizeIdeaTaskRecord(record) {
  return {
    schema: "pline-v3-test-idea-task/v1",
    status: record.status,
    monitor: CODEX_MONITOR_NAME,
    task_id: sanitizeEvidenceId(record.task_id),
    request_id: sanitizeEvidenceId(record.request_id),
    marker: sanitizeEvidenceId(record.marker || ""),
    action: IDEA_TASK_ACTION,
    target_dir: DROPBOX_IDEA_DIR,
    line_user_ref: String(record.line_user_ref || ""),
    finalize_token: sanitizeEvidenceId(record.finalize_token || ""),
    reply_token: String(record.reply_token || ""),
    reply_received_at: String(record.reply_received_at || ""),
    final_reply_text: naturalIdeaReplyText(record.final_reply_text || ""),
    idea: sanitizeIdeaJson(record.idea || {}),
    created_at: record.created_at,
  };
}

function sanitizeIdeaJson(idea) {
  return {
    schema_version: "1.0",
    idea_id: sanitizeEvidenceId(idea.idea_id),
    content: String(idea.content || "").trim().slice(0, 4000),
    created_at: String(idea.created_at || ""),
    source: "line",
    actor_fingerprint: sanitizeEvidenceId(idea.actor_fingerprint),
    line_event_key: sanitizeEvidenceId(idea.line_event_key),
    intent: "idea_create",
    status: "saved",
  };
}

export function resolveCanonicalIdeaContent(body = {}, messageText = "") {
  const responseBody = normalizeN8nResponseBody(body);
  if (typeof responseBody?.idea_content === "string") {
    const n8nContent = responseBody.idea_content.trim();
    if (n8nContent) {
      return { ok: true, content: n8nContent, source: "n8n.idea_content" };
    }
  }

  const fallbackContent = extractIdeaContent(messageText);
  if (fallbackContent) {
    return { ok: true, content: fallbackContent, source: "normalized.message_text" };
  }
  return { ok: false, content: "", source: "none" };
}

export function extractIdeaContent(messageText = "") {
  const commandStripped = String(messageText || "")
    .replace(/^\s*記一下[:：]\s*/, "")
    .trim();
  const marker = commandStripped.match(GATE_MARKER_PATTERN)?.[0] || "";
  if (marker && commandStripped === marker) {
    return marker;
  }
  return commandStripped.replace(GATE_MARKER_PATTERN, "").trim();
}

function naturalIdeaReplyText(replyText = "") {
  const text = String(replyText || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 120 || INTERNAL_REPLY_PATTERN.test(text)) {
    return IDEA_SAVED_FALLBACK_REPLY_TEXT;
  }
  return text;
}

async function fingerprint(value, env = {}) {
  const salt = env.N8N_SHARED_SECRET || WORKER_NAME;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${value}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createFinalizeToken() {
  return `fin-${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

async function sealLineUserRef(userId, env = {}) {
  if (!userId) {
    return { ok: false, reason: "missing_user_id" };
  }
  if (!env.N8N_SHARED_SECRET) {
    return { ok: false, reason: "missing_N8N_SHARED_SECRET" };
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await lineUserRefKey(env);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(userId),
  );
  return {
    ok: true,
    value: `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`,
  };
}

async function openLineUserRef(lineUserRef, env = {}) {
  const parts = String(lineUserRef || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return { ok: false, reason: "invalid_line_user_ref" };
  }
  if (!env.N8N_SHARED_SECRET) {
    return { ok: false, reason: "missing_N8N_SHARED_SECRET" };
  }
  try {
    const key = await lineUserRefKey(env);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(parts[1]) },
      key,
      base64UrlDecode(parts[2]),
    );
    return { ok: true, value: new TextDecoder().decode(decrypted) };
  } catch {
    return { ok: false, reason: "line_user_ref_decrypt_failed" };
  }
}

async function lineUserRefKey(env = {}) {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${WORKER_NAME}:line-user-ref:${env.N8N_SHARED_SECRET}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function base64UrlEncode(bytes) {
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseJsonSafely(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function taipeiIsoString(date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${formatter.format(date).replace(" ", "T")}+08:00`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeEvidenceRecord(record) {
  const safe = {};
  const allowed = new Set([
    "worker",
    "schema",
    "request_id",
    "marker",
    "stage",
    "timestamp",
    "reason",
    "status",
    "bootstrap",
    "reply_mode",
    "final_mode",
    "intent",
    "tool_called",
    "saved_record",
    "codex_task",
    "action",
    "task_id_present",
    "monitor",
    "claimed",
    "codex_execution",
    "file_written",
    "saved",
    "source",
    "n8n_host",
    "n8n_path",
    "n8n_route_type",
    "n8n_path_fingerprint",
    "workflow_hint",
    "request_id_source",
    "response_request_id_present",
    "worker_request_id_present",
    "canonical_request_id_present",
    "n8n_response_shape",
    "n8n_response_top_keys",
    "n8n_response_nested_keys",
  ]);
  for (const [key, value] of Object.entries(record)) {
    if (!allowed.has(key) || value === undefined || value === "") {
      continue;
    }
    safe[key] = typeof value === "string" ? value.slice(0, 200) : value;
  }
  return safe;
}

function logStage(stage, details = {}) {
  console.log(JSON.stringify({
    worker: WORKER_NAME,
    stage,
    ...details,
  }));
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}
