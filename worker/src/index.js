const WORKER_NAME = "pline-v3-test-line-gateway";
const RUNTIME_KV_NAME = "pline-v3-test-runtime";
const IDEMPOTENCY_KV_NAME = "pline-v3-test-idempotency";
const D1_NAME = "pline-v3-test-db";
const N8N_WEBHOOK_URL = "https://n8nphy.app.n8n.cloud/webhook/pline-v3-test-ai-agent";
const N8N_SHARED_SECRET_HEADER = "x-pline-v3-shared-secret";
const EVIDENCE_SELFTEST_SECRET_HEADER = "x-pline-v3-selftest-secret";
const ACCEPTED_N8N_INTENTS = ["idea_create", "codex_task", "clarify", "unsupported"];
const GATE_TEST_INTENTS = ["idea_create", "codex_task"];
const ADMIN_BOOTSTRAP_SENTINEL = "CAPTURE_CURRENT_03_EVENT";
const ADMIN_BOOTSTRAP_PHRASE = "PLine03 admin bootstrap";
const ADMIN_BOOTSTRAP_KV_KEY = "admin:line_test_admin_user_id";
const SAFE_REPLY_TEXT = {
  clarify: "請再補充一句你想記錄或請 Codex 執行的內容。",
  unsupported: "目前 _03 TEST 只支援記錄一句想法或建立 Codex 測試檔案。",
};
const FAST_ACK_REPLY_TEXT = "已收到 _03 TEST 訊息，我會繼續處理。";
const LINE_REPLY_MODE = "fast_ack_then_background_n8n";
const CODEX_TASK_FINAL_MODE = "background_push_final";
const CODEX_TASK_PREFIX = "codex_task:v1";
const CODEX_MONITOR_NAME = "pline-v3-test-codex-monitor";
const CODEX_TASK_ACTION = "create_smoke_file";
const CODEX_SMOKE_FILE_PATH = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt";
const CODEX_SMOKE_FILE_CONTENT = "Codex 已打通";
const EVIDENCE_PREFIX = "evidence:v1";
const EVIDENCE_TTL_SECONDS = 172800;
const FAST_ACK_EVIDENCE_CHECKPOINT_TIMEOUT_MS = 1500;
const GATE_MARKER_PATTERN = /\bT\d{4}[A-Z]?-\d{14}\b/;

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

    if (request.method === "POST" && url.pathname === "/line/webhook") {
      return handleLineWebhook(request, env, ctx);
    }

    return jsonResponse({ status: "not_found", worker: WORKER_NAME }, 404);
  },
};

export async function handleLineWebhook(request, env, ctx = {}) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") || "";
  const signatureResult = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);

  if (!signatureResult.ok) {
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
    return jsonResponse({ status: "rejected", reason: "invalid_json" }, 400);
  }

  const event = firstTextEvent(linePayload);
  if (!event) {
    return jsonResponse({ status: "accepted", reason: "no_text_event" }, 200);
  }

  const normalized = normalizeForN8n(event);
  queueEvidenceStage(ctx, env, normalized, "line_event_received", {
    marker: normalized.gate_marker,
  });
  logStage("line_event_received", {
    request_id: normalized.request_id,
    marker: normalized.gate_marker || undefined,
  });
  queueEvidenceStage(ctx, env, normalized, "signature_pass");
  logStage("signature_pass", {
    request_id: normalized.request_id,
  });

  const adminResult = await verifyAdmin(event, env);
  if (!adminResult.ok) {
    queueEvidenceStage(ctx, env, normalized, "admin_failed", {
      reason: adminResult.reason,
      status: adminResult.status,
    });
    return jsonResponse({
      status: "rejected",
      reason: adminResult.reason,
      check: "admin",
    }, adminResult.status);
  }
  queueEvidenceStage(ctx, env, normalized, "admin_pass", {
    bootstrap: Boolean(adminResult.bootstrapped),
  });
  logStage("admin_pass", {
    request_id: normalized.request_id,
    bootstrap: Boolean(adminResult.bootstrapped),
  });

  if (adminResult.bootstrapped) {
    await replyToLine(normalized.reply_token, "已收到 _03 TEST 管理員事件。", env);
    queueEvidenceStage(ctx, env, normalized, "admin_bootstrap_captured");
    return jsonResponse({
      status: "accepted",
      reason: "admin_bootstrap_captured",
      request_id: normalized.request_id,
    });
  }

  const idempotencyResult = await checkIdempotency(env.IDEMPOTENCY_KV, normalized.line_event_id);
  if (!idempotencyResult.ok) {
    queueEvidenceStage(ctx, env, normalized, "idempotency_failed", {
      reason: idempotencyResult.reason,
      status: idempotencyResult.status,
    });
    return jsonResponse({
      status: "accepted",
      reason: idempotencyResult.reason,
      check: "idempotency",
      request_id: normalized.request_id,
    }, 200);
  }
  queueEvidenceStage(ctx, env, normalized, "idempotency_pass");
  logStage("idempotency_pass", {
    request_id: normalized.request_id,
  });

  const replyResult = await replyToLine(normalized.reply_token, FAST_ACK_REPLY_TEXT, env);
  if (!replyResult.ok) {
    queueEvidenceStage(ctx, env, normalized, "line_fast_reply_failed", {
      reason: replyResult.reason,
      status: replyResult.status,
    });
    logStage("line_fast_reply_failed", {
      request_id: normalized.request_id,
      reason: replyResult.reason,
      status: replyResult.status,
    });
    return jsonResponse({
      status: "failed",
      reason: replyResult.reason,
      request_id: normalized.request_id,
    }, replyResult.status);
  }
  queueEvidenceStage(ctx, env, normalized, "line_fast_reply_completed", {
    reply_mode: LINE_REPLY_MODE,
  });
  logStage("line_fast_reply_completed", {
    request_id: normalized.request_id,
    reply_mode: LINE_REPLY_MODE,
  });

  const fastAckCheckpointTask = persistFastAckEvidenceCheckpoint(env, normalized, {
    bootstrap: Boolean(adminResult.bootstrapped),
  });
  if (ctx.waitUntil) {
    ctx.waitUntil(fastAckCheckpointTask);
  }
  const fastAckCheckpointResult = await waitForEvidenceCheckpoint(fastAckCheckpointTask, FAST_ACK_EVIDENCE_CHECKPOINT_TIMEOUT_MS);
  logStage("evidence_fast_ack_checkpoint", {
    request_id: normalized.request_id,
    status: fastAckCheckpointResult.status,
  });

  if (ctx.waitUntil && env.IDEMPOTENCY_KV) {
    ctx.waitUntil(env.IDEMPOTENCY_KV.put(normalized.line_event_id, normalized.request_id, { expirationTtl: 3600 }));
  } else if (env.IDEMPOTENCY_KV) {
    await env.IDEMPOTENCY_KV.put(normalized.line_event_id, normalized.request_id, { expirationTtl: 3600 });
  }

  const backgroundTask = processN8nInBackground(normalized, env);
  if (ctx.waitUntil) {
    ctx.waitUntil(backgroundTask);
  } else {
    await backgroundTask;
  }

  return jsonResponse({
    status: "accepted",
    request_id: normalized.request_id,
    reply_mode: LINE_REPLY_MODE,
  });
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
      shared_secret_header: N8N_SHARED_SECRET_HEADER,
    },
    line_reply_mode: LINE_REPLY_MODE,
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
    codex_monitor: {
      name: CODEX_MONITOR_NAME,
      task_prefix: CODEX_TASK_PREFIX,
      action: CODEX_TASK_ACTION,
      target_path: CODEX_SMOKE_FILE_PATH,
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
  await persistEvidenceStage(env, normalized, "n8n_background_started");
  logStage("n8n_background_started", {
    request_id: normalized.request_id,
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
    await persistEvidenceStage(env, normalized, "n8n_background_contract_failed", {
      reason: contractResult.reason,
    });
    logStage("n8n_background_contract_failed", {
      request_id: normalized.request_id,
      reason: contractResult.reason,
    });
    return {
      ok: false,
      reason: contractResult.reason,
      status: 502,
    };
  }

  if (contractResult.body.intent === "codex_task") {
    const enqueueResult = await enqueueCodexTask(env, normalized, contractResult.body);
    await persistEvidenceStage(env, normalized, enqueueResult.ok ? "codex_task_enqueued" : "codex_task_enqueue_failed", {
      intent: contractResult.body.intent,
      action: contractResult.body.action,
      task_id_present: Boolean(contractResult.body.task_id),
      status: enqueueResult.ok ? "pending" : "failed",
      reason: enqueueResult.ok ? "" : enqueueResult.reason,
    });
    logStage(enqueueResult.ok ? "codex_task_enqueued" : "codex_task_enqueue_failed", {
      request_id: normalized.request_id,
      action: contractResult.body.action,
      task_id_present: Boolean(contractResult.body.task_id),
      reason: enqueueResult.ok ? undefined : enqueueResult.reason,
    });

    const pushResult = await pushToLine(normalized.user_id, contractResult.body.reply_text, env);
    if (!pushResult.ok) {
      await persistEvidenceStage(env, normalized, "line_push_final_failed", {
        reason: pushResult.reason,
        status: pushResult.status,
      });
      logStage("line_push_final_failed", {
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
    await persistEvidenceStage(env, normalized, "line_push_final_completed", {
      intent: contractResult.body.intent,
      final_mode: CODEX_TASK_FINAL_MODE,
    });
    logStage("line_push_final_completed", {
      request_id: normalized.request_id,
      intent: contractResult.body.intent,
      final_mode: CODEX_TASK_FINAL_MODE,
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

  const task = sanitizeCodexTaskRecord({
    schema: "pline-v3-test-codex-task/v1",
    status: "pending",
    monitor: CODEX_MONITOR_NAME,
    task_id: body.task_id,
    request_id: normalized.request_id,
    marker: normalized.gate_marker,
    action: CODEX_TASK_ACTION,
    target_path: CODEX_SMOKE_FILE_PATH,
    content: CODEX_SMOKE_FILE_CONTENT,
    created_at: new Date().toISOString(),
  });
  const key = codexTaskKey(body.task_id);
  await env.RUNTIME_KV.put(key, JSON.stringify(task), { expirationTtl: EVIDENCE_TTL_SECONDS });
  return { ok: true, key };
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
  return body;
}

export function validateN8nContract(body, requestId) {
  body = normalizeN8nResponseBody(body);
  if (!body || body.request_id !== requestId) {
    return { ok: false, reason: "request_id_mismatch" };
  }
  if (!ACCEPTED_N8N_INTENTS.includes(body.intent)) {
    return { ok: false, reason: "unsupported_intent" };
  }
  const replyText = normalizeReplyText(body.intent, body.reply_text);
  if (!replyText) {
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

  return { ok: true, body: { ...body, reply_text: replyText } };
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

export async function pushToLine(userId, replyText, env) {
  const authorization = lineAuthorizationHeader(env);
  if (!authorization.ok) {
    return authorization;
  }
  if (!userId) {
    return { ok: false, reason: "missing_user_id", status: 400 };
  }

  let response;
  try {
    response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        authorization: authorization.value,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: replyText }],
      }),
    });
  } catch (error) {
    return { ok: false, reason: `line_push_exception_${error?.name || "Error"}`, status: 502 };
  }

  if (!response.ok) {
    return { ok: false, reason: `line_push_http_${response.status}`, status: 502 };
  }

  return { ok: true };
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

export async function persistFastAckEvidenceCheckpoint(env = {}, normalized = {}, details = {}) {
  return persistEvidenceStages(env, normalized, [
    ["line_event_received", { marker: normalized.gate_marker }],
    ["signature_pass", {}],
    ["admin_pass", { bootstrap: Boolean(details.bootstrap) }],
    ["idempotency_pass", {}],
    ["line_fast_reply_completed", { reply_mode: LINE_REPLY_MODE }],
  ]);
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
    if (stage.stage === "n8n_background_started") summary.n8n_started = true;
    if (stage.stage === "n8n_background_completed") summary.n8n_completed = true;
    if (stage.stage === "n8n_background_failed" || stage.stage === "n8n_background_contract_failed") summary.n8n_failed = true;
    if (stage.stage === "line_push_final_completed") summary.final_push = true;
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

function sanitizeEvidenceId(value) {
  return String(value || "").replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 160);
}

function sanitizeCodexTaskRecord(record) {
  return {
    schema: "pline-v3-test-codex-task/v1",
    status: record.status,
    monitor: CODEX_MONITOR_NAME,
    task_id: sanitizeEvidenceId(record.task_id),
    request_id: sanitizeEvidenceId(record.request_id),
    marker: sanitizeEvidenceId(record.marker || ""),
    action: CODEX_TASK_ACTION,
    target_path: CODEX_SMOKE_FILE_PATH,
    content: CODEX_SMOKE_FILE_CONTENT,
    created_at: record.created_at,
  };
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
