import { access, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const MONITOR_NAME = "pline-v3-test-codex-monitor";
export const PROJECT_ROOT = "/Users/phoebe/Documents/菲比 LINE 智能助理_03";
export const WORKER_ROOT = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/worker";
export const RUNTIME_KV_NAMESPACE_ID = "10cdfe018b3942b483faeaca6e517ae5";
export const CODEX_TASK_PROJECT = "PLine03 safe smoke";
export const CODEX_TASK_PROJECT_PATH = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke";
export const SMOKE_FILE_PATH = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt";
export const SMOKE_FILE_CONTENT = "Codex 任務測試成功";
export const FIXED_ACTION = "create_smoke_file";
export const SAVE_IDEA_ACTION = "save_idea_json";
export const DROPBOX_IDEA_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03";
export const WORKER_BASE_URL = "https://pline-v3-test-line-gateway.phy4175.workers.dev";
export const IDEA_FINALIZE_PATH = "/test/idea-finalize";
export const CODEX_FINALIZE_PATH = "/test/codex-finalize";
export const TASK_PREFIX = "codex_task:v1";
export const IDEA_TASK_PREFIX = "idea_json:v1";
export const TASK_PENDING_PREFIX = `${TASK_PREFIX}:pending:`;
export const IDEA_TASK_PENDING_PREFIX = `${IDEA_TASK_PREFIX}:pending:`;
export const EVIDENCE_PREFIX = "evidence:v1";
export const EVIDENCE_TTL_SECONDS = 172800;
export const RUNNER_HEARTBEAT_PATH = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/monitor-runner/heartbeat.json";
export const RUNNER_DEFAULT_INTERVAL_MS = 3000;
export const RUNNER_DEFAULT_IDLE_INTERVAL_MS = 5000;
export const RUNNER_DEFAULT_ERROR_INTERVAL_MS = 10000;
export const RUNNER_STALE_CLAIM_MS = 5 * 60 * 1000;

export async function resolveCodexBin(env = process.env) {
  const candidates = [];
  if (env.CODEX_BIN) {
    candidates.push(env.CODEX_BIN);
  }
  if (env.npm_execpath) {
    candidates.push(env.npm_execpath);
  }
  if (env.PATH) {
    candidates.push(...env.PATH.split(":").map((dir) => resolve(dir, "codex")));
  }

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return { ok: true, path: candidate, source: candidate === env.CODEX_BIN ? "CODEX_BIN" : "environment" };
    } catch {
      // Try the next explicit environment candidate.
    }
  }

  return {
    ok: false,
    path: env.CODEX_BIN || "",
    source: env.CODEX_BIN ? "CODEX_BIN" : "environment",
    reason: "codex_executable_not_found_or_not_executable",
  };
}

export async function health(env = process.env) {
  const codex = await resolveCodexBin(env);
  return {
    status: codex.ok ? "ready" : "blocked",
    monitor: MONITOR_NAME,
    project_root: PROJECT_ROOT,
    fixed_action: FIXED_ACTION,
    codex_task_project: CODEX_TASK_PROJECT,
    codex_task_project_path: CODEX_TASK_PROJECT_PATH,
    smoke_file_path: SMOKE_FILE_PATH,
    smoke_file_content: SMOKE_FILE_CONTENT,
    supported_actions: [FIXED_ACTION, SAVE_IDEA_ACTION],
    task_prefixes: [TASK_PREFIX, IDEA_TASK_PREFIX],
    task_prefix: TASK_PREFIX,
    idea_task_prefix: IDEA_TASK_PREFIX,
    pending_prefixes: [TASK_PENDING_PREFIX, IDEA_TASK_PENDING_PREFIX],
    dropbox_idea_dir: DROPBOX_IDEA_DIR,
    evidence_prefix: EVIDENCE_PREFIX,
    runtime_kv_namespace_id: RUNTIME_KV_NAMESPACE_ID,
    runner: {
      mode: "durable_poll_loop",
      heartbeat_path: RUNNER_HEARTBEAT_PATH,
      default_interval_ms: RUNNER_DEFAULT_INTERVAL_MS,
      default_idle_interval_ms: RUNNER_DEFAULT_IDLE_INTERVAL_MS,
      stale_claim_ms: RUNNER_STALE_CLAIM_MS,
    },
    codex_bin: codex,
  };
}

export async function runTask(task, env = process.env) {
  const codex = await resolveCodexBin(env);
  if (!codex.ok) {
    return { ok: false, reason: codex.reason, codex_bin: codex };
  }

  const normalized = normalizeTask(task);
  if (normalized.action === SAVE_IDEA_ACTION) {
    return saveIdeaJson(normalized);
  }

  if (normalized.action !== FIXED_ACTION) {
    return { ok: false, reason: "unsupported_action" };
  }
  if (normalized.target_path !== SMOKE_FILE_PATH) {
    return { ok: false, reason: "unsupported_target_path" };
  }
  if (normalized.content !== SMOKE_FILE_CONTENT) {
    return { ok: false, reason: "unsupported_content" };
  }
  if (normalized.task_type !== "codex_task") {
    return { ok: false, reason: "unsupported_task_type" };
  }
  if (normalized.project_path !== CODEX_TASK_PROJECT_PATH) {
    return { ok: false, reason: "unsupported_project_path" };
  }

  await mkdir(CODEX_TASK_PROJECT_PATH, { recursive: true });
  await writeFile(SMOKE_FILE_PATH, SMOKE_FILE_CONTENT, "utf8");
  const readback = await readFile(SMOKE_FILE_PATH, "utf8");
  if (readback !== SMOKE_FILE_CONTENT) {
    return { ok: false, reason: "smoke_file_readback_mismatch" };
  }
  const fileStat = await stat(SMOKE_FILE_PATH);
  return {
    ok: true,
    monitor: MONITOR_NAME,
    action: FIXED_ACTION,
    target_path: SMOKE_FILE_PATH,
    codex_execution: true,
    file_written: true,
    tests: "PASS",
    changed_files: ["runtime/codex-task-smoke/codex_task_smoke_test.txt"],
    summary: "Fixed smoke file was created and verified.",
    mtime_ms: fileStat.mtimeMs,
    mtime_iso: fileStat.mtime.toISOString(),
  };
}

export function normalizeTask(task = {}) {
  const action = task.action || FIXED_ACTION;
  return {
    task_id: sanitizeId(task.task_id || "pline-v3-test-smoke"),
    task_type: action === FIXED_ACTION ? "codex_task" : "",
    project: action === FIXED_ACTION ? sanitizeLabel(task.project || CODEX_TASK_PROJECT) : sanitizeLabel(task.project || ""),
    project_path: action === FIXED_ACTION ? String(task.project_path || CODEX_TASK_PROJECT_PATH) : String(task.project_path || ""),
    instruction: action === FIXED_ACTION ? String(task.instruction || "Create or overwrite the fixed smoke file with the fixed smoke content.") : String(task.instruction || ""),
    request_id: sanitizeId(task.request_id || ""),
    marker: sanitizeId(task.marker || ""),
    action,
    created_at: String(task.created_at || ""),
    target_path: task.target_path || SMOKE_FILE_PATH,
    target_dir: task.target_dir || DROPBOX_IDEA_DIR,
    content: task.content || SMOKE_FILE_CONTENT,
    idea: task.idea || null,
    finalize_token: sanitizeId(task.finalize_token || ""),
    final_reply_text: String(task.final_reply_text || ""),
    line_user_ref: String(task.line_user_ref || ""),
  };
}

export async function claimOnce(options = {}) {
  const env = options.env || process.env;
  const kv = options.kv || createWranglerKv(env);
  const now = new Date().toISOString();
  const keys = [];
  const warnings = [];
  if (options.taskId || options.task_id) {
    keys.push({ name: taskKey(options.taskId || options.task_id, options.action || FIXED_ACTION) });
  } else {
    for (const prefix of [TASK_PENDING_PREFIX, IDEA_TASK_PENDING_PREFIX]) {
      const pendingKeys = await kv.list(prefix);
      for (const pendingKey of pendingKeys) {
        keys.push({
          name: taskKeyFromPendingKey(pendingKey.name || pendingKey),
          pending_key: pendingKey.name || pendingKey,
        });
      }
    }
    if (keys.length === 0 && options.legacyScan !== false) {
      for (const prefix of [`${TASK_PREFIX}:task:`, `${IDEA_TASK_PREFIX}:task:`]) {
        keys.push(...await kv.list(prefix));
      }
    }
  }

  for (const key of keys) {
    let raw;
    try {
      raw = await kv.get(key.name || key);
    } catch (error) {
      warnings.push(await bestEffortDeletePendingIndex(kv, null, key.pending_key, "pending_task_get_failed", error));
      continue;
    }
    if (!raw) {
      warnings.push(await bestEffortDeletePendingIndex(kv, null, key.pending_key, "pending_task_missing"));
      continue;
    }
    let original;
    let task;
    try {
      original = JSON.parse(raw);
      task = normalizeTask(original);
    } catch (error) {
      warnings.push(await bestEffortDeletePendingIndex(kv, null, key.pending_key, "pending_task_unreadable", error));
      continue;
    }
    const status = original.status || "";
    const staleClaim = isStaleClaim(original, options);
    if (status !== "pending" && status !== "queued" && !staleClaim) {
      if (isTerminalStatus(status)) {
        warnings.push(await bestEffortDeletePendingIndex(kv, task, key.pending_key, "terminal_pending_index_cleanup"));
      }
      continue;
    }
    if (staleClaim) {
      await writeEvidenceStage(kv, task, "monitor_stale_claim_recovered", {
        monitor: MONITOR_NAME,
        action: task.action,
        status,
      });
    }

    const claimRecord = {
      ...task,
      schema: "pline-v3-test-codex-task/v1",
      status: "claimed",
      monitor: MONITOR_NAME,
      claimed_at: now,
    };
    await kv.put(taskKey(task.task_id, task.action), JSON.stringify(claimRecord));
    await writeEvidenceStage(kv, task, "monitor_claimed", {
      monitor: MONITOR_NAME,
      claimed: true,
      action: task.action,
    });

    const execution = await runTask(task, env);
    if (!execution.ok) {
      const failedResultRecord = codexResultRecord(task, {
        ok: false,
        reason: execution.reason,
      });
      await kv.put(taskKey(task.task_id, task.action), JSON.stringify({
        ...claimRecord,
        status: "failed",
        failed_at: new Date().toISOString(),
        reason: execution.reason,
      }));
      warnings.push(await bestEffortDeletePendingIndex(kv, task, pendingKey(task.task_id, task.action), "failed_task_pending_index_cleanup"));
      if (task.action === FIXED_ACTION) {
        await kv.put(codexResultKey(task.task_id), JSON.stringify(failedResultRecord));
        const callbackResult = await notifyCodexFinalizer(task, "failed", env, execution.reason);
        await writeEvidenceStage(kv, task, callbackResult.ok ? "codex_task_final_callback_completed" : "codex_task_final_callback_failed", {
          monitor: MONITOR_NAME,
          action: task.action,
          status: "failed",
          reason: callbackResult.ok ? "" : callbackResult.reason,
        });
      }
      if (task.action === SAVE_IDEA_ACTION) {
        const callbackResult = await notifyIdeaFinalizer(task, "failed", env);
        await writeEvidenceStage(kv, task, callbackResult.ok ? "idea_json_final_callback_completed" : "idea_json_final_callback_failed", {
          monitor: MONITOR_NAME,
          action: task.action,
          status: "failed",
          reason: callbackResult.ok ? "" : callbackResult.reason,
        });
      }
      await writeEvidenceStage(kv, task, "codex_execution_failed", {
        monitor: MONITOR_NAME,
        reason: execution.reason,
        action: task.action,
      });
      return { ok: false, reason: execution.reason, task_id: task.task_id, request_id: task.request_id };
    }

    const completedStatus = execution.status === "duplicate" ? "duplicate" : "completed";
    const completedAt = new Date().toISOString();
    await writeEvidenceStage(kv, task, task.action === SAVE_IDEA_ACTION ? "idea_json_saved" : "codex_execution_completed", {
      monitor: MONITOR_NAME,
      codex_execution: task.action === FIXED_ACTION || undefined,
      saved: task.action === SAVE_IDEA_ACTION ? execution.status || "saved" : undefined,
      action: task.action,
    });
    await writeEvidenceStage(kv, task, task.action === SAVE_IDEA_ACTION ? "idea_json_file_written" : "smoke_file_written", {
      monitor: MONITOR_NAME,
      file_written: true,
      action: task.action,
      status: completedStatus,
      file_name: execution.file_name,
    });
    const completedTaskRecord = {
      ...claimRecord,
      status: completedStatus,
      completed_at: completedAt,
      codex_execution: true,
      file_written: true,
      mtime_ms: execution.mtime_ms,
      mtime_iso: execution.mtime_iso,
      file_name: execution.file_name,
    };
    await kv.put(taskKey(task.task_id, task.action), JSON.stringify(completedTaskRecord));
    warnings.push(await bestEffortDeletePendingIndex(kv, task, pendingKey(task.task_id, task.action), "completed_task_pending_index_cleanup"));
    if (task.action === FIXED_ACTION) {
      const resultRecord = codexResultRecord(task, execution);
      await kv.put(codexResultKey(task.task_id), JSON.stringify(resultRecord));
      await writeEvidenceStage(kv, task, "codex_task_result_recorded", {
        monitor: MONITOR_NAME,
        action: task.action,
        status: resultRecord.status,
      });
      const callbackResult = await notifyCodexFinalizer(task, completedStatus, env);
      await writeEvidenceStage(kv, task, callbackResult.ok ? "codex_task_final_callback_completed" : "codex_task_final_callback_failed", {
        monitor: MONITOR_NAME,
        action: task.action,
        status: completedStatus,
        reason: callbackResult.ok ? "" : callbackResult.reason,
      });
    }
    if (task.action === SAVE_IDEA_ACTION) {
      const callbackResult = await notifyIdeaFinalizer(task, completedStatus, env);
      await writeEvidenceStage(kv, task, callbackResult.ok ? "idea_json_final_callback_completed" : "idea_json_final_callback_failed", {
        monitor: MONITOR_NAME,
        action: task.action,
        status: completedStatus,
        reason: callbackResult.ok ? "" : callbackResult.reason,
      });
    }

    return {
      ok: true,
      claimed: true,
      task_id: task.task_id,
      request_id: task.request_id,
      marker: task.marker,
      action: task.action,
      codex_execution: true,
      file_written: true,
      status: completedStatus,
      file_name: execution.file_name,
      mtime_iso: execution.mtime_iso,
      warning_count: warnings.filter((warning) => warning && !warning.ok).length,
    };
  }

  return {
    ok: true,
    claimed: false,
    reason: "no_pending_task",
    warning_count: warnings.filter((warning) => warning && !warning.ok).length,
  };
}

export async function poll(options = {}) {
  const iterations = Number(options.iterations || process.env.MONITOR_POLL_ITERATIONS || 30);
  const intervalMs = Number(options.intervalMs || process.env.MONITOR_POLL_INTERVAL_MS || 2000);
  const results = [];
  for (let index = 0; index < iterations; index += 1) {
    const result = await claimOnce(options);
    results.push(result);
    if (result.claimed || result.ok === false) {
      return result;
    }
    await sleep(intervalMs);
  }
  return { ok: true, claimed: false, reason: "poll_exhausted", checks: results.length };
}

export async function drain(options = {}) {
  const iterations = Number(options.iterations || process.env.MONITOR_DRAIN_ITERATIONS || 20);
  const intervalMs = Number(options.intervalMs || process.env.MONITOR_POLL_INTERVAL_MS || 500);
  const results = [];
  let drained = 0;

  for (let index = 0; index < iterations; index += 1) {
    const result = await claimOnce(options);
    results.push(result);
    if (result.ok === false) {
      return {
        ok: false,
        drained,
        reason: result.reason,
        failed_task_id: result.task_id,
        failed_request_id: result.request_id,
        results,
      };
    }
    if (!result.claimed) {
      return {
        ok: true,
        drained,
        reason: "drain_complete",
        checks: results.length,
        results,
      };
    }
    drained += 1;
    await sleep(intervalMs);
  }

  return {
    ok: true,
    drained,
    reason: "drain_limit_reached",
    checks: results.length,
    results,
  };
}

export async function runner(options = {}) {
  const env = options.env || process.env;
  const iterations = Number(options.iterations ?? env.MONITOR_RUNNER_ITERATIONS ?? 0);
  const drainIterations = Number(options.drainIterations ?? env.MONITOR_RUNNER_DRAIN_ITERATIONS ?? 20);
  const intervalMs = Number(options.intervalMs ?? env.MONITOR_RUNNER_INTERVAL_MS ?? RUNNER_DEFAULT_INTERVAL_MS);
  const idleIntervalMs = Number(options.idleIntervalMs ?? env.MONITOR_RUNNER_IDLE_INTERVAL_MS ?? RUNNER_DEFAULT_IDLE_INTERVAL_MS);
  const errorIntervalMs = Number(options.errorIntervalMs ?? env.MONITOR_RUNNER_ERROR_INTERVAL_MS ?? RUNNER_DEFAULT_ERROR_INTERVAL_MS);
  const heartbeatPath = options.heartbeatPath || env.MONITOR_RUNNER_HEARTBEAT_PATH || RUNNER_HEARTBEAT_PATH;
  const results = [];
  let loops = 0;
  let totalDrained = 0;

  while (iterations === 0 || loops < iterations) {
    loops += 1;
    let result;
    try {
      result = await drain({
        ...options,
        env,
        legacyScan: false,
        iterations: drainIterations,
        intervalMs: 0,
      });
    } catch (error) {
      result = {
        ok: false,
        drained: 0,
        reason: error?.message || "runner_drain_failed",
      };
    }
    totalDrained += Number(result.drained || 0);
    results.push(result);
    await writeRunnerHeartbeat({
      status: result.ok ? "ready" : "error",
      monitor: MONITOR_NAME,
      loops,
      total_drained: totalDrained,
      last_result: summarizeRunnerResult(result),
      updated_at: new Date().toISOString(),
    }, heartbeatPath);

    if (iterations !== 0 && loops >= iterations) {
      break;
    }
    await sleep(result.ok ? (result.drained > 0 ? intervalMs : idleIntervalMs) : errorIntervalMs);
  }

  return {
    ok: results.every((result) => result.ok),
    mode: "durable_poll_loop",
    loops,
    drained: totalDrained,
    heartbeat_path: heartbeatPath,
    last_result: summarizeRunnerResult(results.at(-1) || {}),
  };
}

export async function markCodexTaskCapabilityNotEnabled(taskId = "", options = {}) {
  const kv = options.kv || createWranglerKv(options.env || process.env);
  const safeTaskId = sanitizeId(taskId);
  if (!safeTaskId) {
    return { ok: false, reason: "missing_task_id" };
  }

  const key = taskKey(safeTaskId, FIXED_ACTION);
  const raw = await kv.get(key);
  if (!raw) {
    return { ok: false, reason: "missing_codex_task", task_id: safeTaskId };
  }

  let original;
  try {
    original = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unreadable_codex_task", task_id: safeTaskId };
  }

  const task = normalizeTask(original);
  if (task.action !== FIXED_ACTION || task.task_type !== "codex_task") {
    return { ok: false, reason: "unsupported_task_type", task_id: safeTaskId };
  }

  if (original.status && !["pending", "queued", "claimed", "running"].includes(original.status)) {
    return {
      ok: true,
      task_id: safeTaskId,
      request_id: task.request_id,
      status: original.status,
      reason: "already_terminal",
      finalized: false,
    };
  }

  const failedAt = new Date().toISOString();
  const reason = "capability_not_yet_enabled";
  const failedRecord = {
    ...original,
    ...task,
    schema: original.schema || "pline-v3-test-codex-task/v1",
    monitor: MONITOR_NAME,
    status: "failed",
    failed_at: failedAt,
    reason,
  };
  await kv.put(key, JSON.stringify(failedRecord));
  await kv.put(codexResultKey(task.task_id), JSON.stringify(codexResultRecord(task, {
    ok: false,
    reason,
  })));
  await writeEvidenceStage(kv, task, "codex_task_capability_not_enabled", {
    monitor: MONITOR_NAME,
    action: FIXED_ACTION,
    status: "failed",
    reason,
  });
  await writeEvidenceStage(kv, task, "codex_task_result_recorded", {
    monitor: MONITOR_NAME,
    action: FIXED_ACTION,
    status: "failed",
  });
  const callbackResult = await notifyCodexFinalizer(task, "failed", options.env || process.env, reason);
  await writeEvidenceStage(kv, task, callbackResult.ok ? "codex_task_final_callback_completed" : "codex_task_final_callback_failed", {
    monitor: MONITOR_NAME,
    action: FIXED_ACTION,
    status: "failed",
    reason: callbackResult.ok ? reason : callbackResult.reason,
  });

  return {
    ok: callbackResult.ok,
    task_id: task.task_id,
    request_id: task.request_id,
    status: "failed",
    reason: callbackResult.ok ? reason : callbackResult.reason,
    finalized: callbackResult.ok,
    pushed: Boolean(callbackResult.pushed),
  };
}

export async function createSyntheticTask(task = {}, options = {}) {
  const kv = options.kv || createWranglerKv(options.env || process.env);
  const normalized = normalizeTask({
    task_id: task.task_id || `pline-v3-fix17-${Date.now()}`,
    request_id: task.request_id || `pline-v3-fix17-${Date.now()}`,
    marker: task.marker || "",
    action: FIXED_ACTION,
    created_at: task.created_at || new Date().toISOString(),
    task_type: "codex_task",
    project: CODEX_TASK_PROJECT,
    project_path: CODEX_TASK_PROJECT_PATH,
    instruction: "Create or overwrite the fixed smoke file with the fixed smoke content.",
    target_path: SMOKE_FILE_PATH,
    content: SMOKE_FILE_CONTENT,
    finalize_token: task.finalize_token || "",
    line_user_ref: task.line_user_ref || "",
  });
  await kv.put(taskKey(normalized.task_id, normalized.action), JSON.stringify({
    ...normalized,
    schema: "pline-v3-test-codex-task/v1",
    status: "queued",
    monitor: MONITOR_NAME,
    created_at: normalized.created_at || new Date().toISOString(),
  }));
  await kv.put(pendingKey(normalized.task_id, normalized.action), taskKey(normalized.task_id, normalized.action));
  return { ok: true, ...normalized };
}

export async function writeRunnerHeartbeat(record = {}, heartbeatPath = RUNNER_HEARTBEAT_PATH) {
  await mkdir(dirnameForFile(heartbeatPath), { recursive: true });
  const safeRecord = {
    schema: "pline-v3-test-monitor-runner/v1",
    status: record.status === "error" ? "error" : "ready",
    monitor: MONITOR_NAME,
    loops: Number(record.loops || 0),
    total_drained: Number(record.total_drained || 0),
    updated_at: String(record.updated_at || new Date().toISOString()),
    last_result: summarizeRunnerResult(record.last_result || {}),
  };
  await writeFile(heartbeatPath, `${JSON.stringify(safeRecord, null, 2)}\n`, "utf8");
  return { ok: true, heartbeat_path: heartbeatPath };
}

export async function createSyntheticIdeaTask(task = {}, options = {}) {
  const kv = options.kv || createWranglerKv(options.env || process.env);
  const idea = normalizeIdeaJson(task.idea || {
    schema_version: "1.0",
    idea_id: task.idea_id || `idea-${sanitizeId(task.task_id || Date.now()).slice(0, 16)}`,
    content: task.content || "FIX selftest idea",
    created_at: task.created_at || "2026-07-18T07:00:00+08:00",
    source: "line",
    actor_fingerprint: task.actor_fingerprint || "a".repeat(64),
    line_event_key: task.line_event_key || "b".repeat(64),
    intent: "idea_create",
    status: "saved",
  });
  const normalized = normalizeTask({
    task_id: task.task_id || `idea-${Date.now()}`,
    request_id: task.request_id || `pline-v3-idea-${Date.now()}`,
    marker: task.marker || "",
    action: SAVE_IDEA_ACTION,
    target_dir: DROPBOX_IDEA_DIR,
    idea,
    finalize_token: task.finalize_token || "",
  });
  await kv.put(taskKey(normalized.task_id, normalized.action), JSON.stringify({
    ...normalized,
    schema: "pline-v3-test-idea-task/v1",
    status: "pending",
    monitor: MONITOR_NAME,
    created_at: new Date().toISOString(),
  }));
  await kv.put(pendingKey(normalized.task_id, normalized.action), taskKey(normalized.task_id, normalized.action));
  return { ok: true, ...normalized };
}

export async function saveIdeaJson(task = {}) {
  const normalized = normalizeTask(task);
  if (normalized.action !== SAVE_IDEA_ACTION) {
    return { ok: false, reason: "unsupported_action" };
  }
  if (normalized.target_dir !== DROPBOX_IDEA_DIR) {
    return { ok: false, reason: "unsupported_target_dir" };
  }

  const idea = normalizeIdeaJson(normalized.idea);
  const validation = validateIdeaJson(idea);
  if (!validation.ok) {
    return validation;
  }

  await mkdir(DROPBOX_IDEA_DIR, { recursive: true });
  const fileName = ideaFileName(idea);
  const finalPath = join(DROPBOX_IDEA_DIR, fileName);
  if (!finalPath.startsWith(`${DROPBOX_IDEA_DIR}${sep}`)) {
    return { ok: false, reason: "unsafe_target_path" };
  }

  if (await fileExists(finalPath)) {
    const fileStat = await stat(finalPath);
    return {
      ok: true,
      status: "duplicate",
      duplicate: true,
      action: SAVE_IDEA_ACTION,
      target_dir: DROPBOX_IDEA_DIR,
      file_name: fileName,
      mtime_ms: fileStat.mtimeMs,
      mtime_iso: fileStat.mtime.toISOString(),
    };
  }

  const tempPath = join(DROPBOX_IDEA_DIR, `.${fileName}.${process.pid}.${Date.now()}.tmp`);
  const body = `${JSON.stringify(idea, null, 2)}\n`;
  try {
    await writeFile(tempPath, body, { encoding: "utf8", flag: "wx" });
    const parsed = JSON.parse(await readFile(tempPath, "utf8"));
    const parsedValidation = validateIdeaJson(parsed);
    if (!parsedValidation.ok) {
      await safeUnlink(tempPath);
      return parsedValidation;
    }
    if (await fileExists(finalPath)) {
      await safeUnlink(tempPath);
      const fileStat = await stat(finalPath);
      return {
        ok: true,
        status: "duplicate",
        duplicate: true,
        action: SAVE_IDEA_ACTION,
        target_dir: DROPBOX_IDEA_DIR,
        file_name: fileName,
        mtime_ms: fileStat.mtimeMs,
        mtime_iso: fileStat.mtime.toISOString(),
      };
    }
    await rename(tempPath, finalPath);
  } catch (error) {
    await safeUnlink(tempPath);
    return { ok: false, reason: "idea_json_write_failed", error_name: error?.name || "Error" };
  }

  const fileStat = await stat(finalPath);
  return {
    ok: true,
    status: "saved",
    saved: true,
    action: SAVE_IDEA_ACTION,
    target_dir: DROPBOX_IDEA_DIR,
    file_name: fileName,
    mtime_ms: fileStat.mtimeMs,
    mtime_iso: fileStat.mtime.toISOString(),
  };
}

export async function notifyIdeaFinalizer(task = {}, status = "completed", env = process.env) {
  if (task.action !== SAVE_IDEA_ACTION) {
    return { ok: true, status: "skipped_non_idea_task" };
  }
  if (env.IDEA_FINALIZE_DISABLED === "1") {
    return { ok: true, status: "disabled" };
  }
  if (!task.finalize_token) {
    return { ok: false, reason: "missing_finalize_token" };
  }
  const baseUrl = String(env.WORKER_BASE_URL || WORKER_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${IDEA_FINALIZE_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      task_id: task.task_id,
      request_id: task.request_id,
      action: SAVE_IDEA_ACTION,
      status,
      finalize_token: task.finalize_token,
    }),
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok || body.status === "rejected") {
    return {
      ok: false,
      reason: body.reason || `finalize_http_${response.status}`,
      status: body.status || "failed",
    };
  }
  return {
    ok: true,
    status: body.status || "ok",
    pushed: Boolean(body.pushed),
  };
}

export async function notifyCodexFinalizer(task = {}, status = "completed", env = process.env, reason = "") {
  if (task.action !== FIXED_ACTION) {
    return { ok: true, status: "skipped_non_codex_task" };
  }
  if (env.CODEX_FINALIZE_DISABLED === "1") {
    return { ok: true, status: "disabled" };
  }
  if (!task.finalize_token) {
    return { ok: false, reason: "missing_finalize_token" };
  }
  const baseUrl = String(env.WORKER_BASE_URL || WORKER_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${CODEX_FINALIZE_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      task_id: task.task_id,
      request_id: task.request_id,
      action: FIXED_ACTION,
      status,
      reason,
      finalize_token: task.finalize_token,
    }),
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok || body.status === "rejected") {
    return {
      ok: false,
      reason: body.reason || `finalize_http_${response.status}`,
      status: body.status || "failed",
    };
  }
  return {
    ok: true,
    status: body.status || "ok",
    pushed: Boolean(body.pushed),
  };
}

export function codexResultRecord(task = {}, execution = {}) {
  if (!execution.ok) {
    return {
      task_id: task.task_id,
      status: "failed",
      created_at: task.created_at || "",
      summary: "The safe smoke task did not complete.",
      tests: "FAIL",
      changed_files: [],
      commit: null,
      error: execution.reason || "unknown_error",
    };
  }
  return {
    task_id: task.task_id,
    status: "completed",
    created_at: task.created_at || "",
    summary: execution.summary || "Safe smoke file was created and verified.",
    tests: execution.tests || "PASS",
    changed_files: execution.changed_files || ["runtime/codex-task-smoke/codex_task_smoke_test.txt"],
    commit: null,
    error: null,
  };
}

export function normalizeIdeaJson(idea = {}) {
  return {
    schema_version: idea.schema_version,
    idea_id: sanitizeId(idea.idea_id),
    content: String(idea.content || ""),
    created_at: String(idea.created_at || ""),
    source: idea.source,
    actor_fingerprint: sanitizeId(idea.actor_fingerprint),
    line_event_key: sanitizeId(idea.line_event_key),
    intent: idea.intent,
    status: idea.status,
  };
}

export function validateIdeaJson(idea = {}) {
  const allowedKeys = [
    "schema_version",
    "idea_id",
    "content",
    "created_at",
    "source",
    "actor_fingerprint",
    "line_event_key",
    "intent",
    "status",
  ];
  const keys = Object.keys(idea).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...allowedKeys].sort())) {
    return { ok: false, reason: "invalid_idea_json_schema_keys" };
  }
  if (idea.schema_version !== "1.0") return { ok: false, reason: "invalid_schema_version" };
  if (!/^idea-[A-Za-z0-9:_\-.]{8,80}$/.test(idea.idea_id)) return { ok: false, reason: "invalid_idea_id" };
  if (typeof idea.content !== "string" || idea.content.trim().length === 0) return { ok: false, reason: "invalid_content" };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(idea.created_at)) return { ok: false, reason: "invalid_created_at" };
  if (idea.source !== "line") return { ok: false, reason: "invalid_source" };
  if (!/^[a-f0-9]{64}$/.test(idea.actor_fingerprint)) return { ok: false, reason: "invalid_actor_fingerprint" };
  if (!/^[a-f0-9]{64}$/.test(idea.line_event_key)) return { ok: false, reason: "invalid_line_event_key" };
  if (idea.intent !== "idea_create") return { ok: false, reason: "invalid_intent" };
  if (idea.status !== "saved") return { ok: false, reason: "invalid_status" };
  return { ok: true };
}

export async function writeEvidenceStage(kv, task, stage, details = {}) {
  if (!task.request_id) {
    return { ok: false, reason: "missing_request_id" };
  }
  const timestamp = new Date().toISOString();
  const record = sanitizeEvidenceRecord({
    worker: "pline-v3-test-line-gateway",
    schema: "pline-v3-test-evidence/v1",
    request_id: task.request_id,
    marker: task.marker,
    stage,
    timestamp,
    ...details,
  });
  if (task.marker) {
    await kv.put(`${EVIDENCE_PREFIX}:marker:${task.marker}`, task.request_id);
  }
  await kv.put(`${EVIDENCE_PREFIX}:request:${task.request_id}:stage:${stage}`, JSON.stringify(record));
  await kv.put(`${EVIDENCE_PREFIX}:summary:${task.request_id}`, JSON.stringify({
    worker: "pline-v3-test-line-gateway",
    request_id: task.request_id,
    marker: task.marker,
    updated_at: timestamp,
    latest_stage: stage,
  }));
  return { ok: true };
}

export function createWranglerKv(env = process.env) {
  const namespaceId = env.RUNTIME_KV_NAMESPACE_ID || RUNTIME_KV_NAMESPACE_ID;
  return {
    async list(prefix) {
      const { stdout } = await execFile("npx", [
        "wrangler", "kv", "key", "list",
        "--namespace-id", namespaceId,
        "--prefix", prefix,
        "--remote",
      ], { cwd: WORKER_ROOT, maxBuffer: 1024 * 1024 * 4 });
      return JSON.parse(stdout || "[]");
    },
    async get(key) {
      const { stdout } = await execFile("npx", [
        "wrangler", "kv", "key", "get", key,
        "--namespace-id", namespaceId,
        "--remote",
      ], { cwd: WORKER_ROOT, maxBuffer: 1024 * 1024 * 4 });
      const value = stdout.trim();
      return value === "Value not found" ? "" : value;
    },
    async put(key, value) {
      await execFile("npx", [
        "wrangler", "kv", "key", "put", key, value,
        "--namespace-id", namespaceId,
        "--remote",
        "--ttl", String(EVIDENCE_TTL_SECONDS),
      ], { cwd: WORKER_ROOT, maxBuffer: 1024 * 1024 * 4 });
    },
    async delete(key) {
      await execFile("npx", [
        "wrangler", "kv", "key", "delete", key,
        "--namespace-id", namespaceId,
        "--remote",
      ], { cwd: WORKER_ROOT, maxBuffer: 1024 * 1024 * 4 });
    },
  };
}

function taskKey(taskId, action = FIXED_ACTION) {
  const prefix = action === SAVE_IDEA_ACTION ? IDEA_TASK_PREFIX : TASK_PREFIX;
  return `${prefix}:task:${sanitizeId(taskId)}`;
}

function pendingKey(taskId, action = FIXED_ACTION) {
  const prefix = action === SAVE_IDEA_ACTION ? IDEA_TASK_PREFIX : TASK_PREFIX;
  return `${prefix}:pending:${sanitizeId(taskId)}`;
}

function taskKeyFromPendingKey(key) {
  const value = String(key || "");
  if (value.startsWith(TASK_PENDING_PREFIX)) {
    return taskKey(value.slice(TASK_PENDING_PREFIX.length), FIXED_ACTION);
  }
  if (value.startsWith(IDEA_TASK_PENDING_PREFIX)) {
    return taskKey(value.slice(IDEA_TASK_PENDING_PREFIX.length), SAVE_IDEA_ACTION);
  }
  return value;
}

function isTerminalStatus(status = "") {
  return ["completed", "duplicate", "failed", "unsupported", "cancelled"].includes(String(status || ""));
}

async function bestEffortDeletePendingIndex(kv, task = null, pendingIndexKey = "", reason = "pending_index_cleanup", error = null) {
  const key = sanitizePendingKey(pendingIndexKey || (task ? pendingKey(task.task_id, task.action) : ""));
  if (!key || !kv.delete) {
    return { ok: true, deleted: false, reason };
  }
  try {
    await kv.delete(key);
    return { ok: true, deleted: true, reason, key };
  } catch (deleteError) {
    const safeReason = sanitizeId(reason || "pending_index_cleanup_failed");
    if (task?.request_id) {
      try {
        await writeEvidenceStage(kv, task, "monitor_pending_index_cleanup_warning", {
          monitor: MONITOR_NAME,
          action: task.action,
          status: "warning",
          reason: safeReason,
        });
      } catch {
        // Warning evidence is best-effort only.
      }
    }
    return {
      ok: false,
      deleted: false,
      reason: safeReason,
      error_name: sanitizeId(deleteError?.name || error?.name || "Error"),
      key,
    };
  }
}

function sanitizePendingKey(value = "") {
  const key = String(value || "");
  if (key.startsWith(TASK_PENDING_PREFIX) || key.startsWith(IDEA_TASK_PENDING_PREFIX)) {
    return key.replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 220);
  }
  return "";
}

function codexResultKey(taskId) {
  return `${TASK_PREFIX}:result:${sanitizeId(taskId)}`;
}

function sanitizeEvidenceRecord(record) {
  const allowed = new Set([
    "worker",
    "schema",
    "request_id",
    "marker",
    "stage",
    "timestamp",
    "reason",
    "status",
    "monitor",
    "claimed",
    "codex_execution",
    "file_written",
    "saved",
    "file_name",
    "action",
  ]);
  const safe = {};
  for (const [key, value] of Object.entries(record)) {
    if (!allowed.has(key) || value === undefined || value === "") {
      continue;
    }
    safe[key] = typeof value === "string" ? value.slice(0, 200) : value;
  }
  return safe;
}

function sanitizeId(value) {
  return String(value || "").replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 160);
}

function sanitizeLabel(value) {
  return String(value || "").replace(/[^\p{L}\p{N} _:\-.]/gu, "").slice(0, 120);
}

function ideaFileName(idea) {
  const stamp = idea.created_at.replace(/[-:]/g, "").replace("T", "-").replace("+0800", "").slice(0, 15);
  const shortId = sanitizeId(idea.idea_id).replace(/^idea-/, "").slice(0, 12);
  return `idea-${stamp}-${shortId}.json`;
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(path) {
  try {
    await unlink(path);
  } catch {
    // Best-effort cleanup for temp files only.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStaleClaim(record = {}, options = {}) {
  const status = record.status || "";
  if (status !== "claimed" && status !== "running") {
    return false;
  }
  const staleMs = Number(options.staleClaimMs ?? process.env.MONITOR_STALE_CLAIM_MS ?? RUNNER_STALE_CLAIM_MS);
  if (staleMs <= 0) {
    return false;
  }
  const claimedAt = Date.parse(record.claimed_at || record.running_at || "");
  return Number.isFinite(claimedAt) && Date.now() - claimedAt > staleMs;
}

function summarizeRunnerResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    drained: Number(result.drained || 0),
    claimed: Boolean(result.claimed),
    reason: sanitizeId(result.reason || ""),
    task_id: sanitizeId(result.task_id || result.failed_task_id || ""),
    request_id: sanitizeId(result.request_id || result.failed_request_id || ""),
    action: sanitizeId(result.action || ""),
    status: sanitizeId(result.status || ""),
  };
}

function dirnameForFile(path) {
  const normalized = String(path || "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : ".";
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

async function main() {
  const command = process.argv[2] || "health";

  if (command === "health") {
    printJson(await health());
    return;
  }

  if (command === FIXED_ACTION) {
    printJson(await runTask({ action: FIXED_ACTION }));
    return;
  }

  if (command === "claim-once") {
    printJson(await claimOnce());
    return;
  }

  if (command === "claim-task") {
    printJson(await claimOnce({
      env: process.env,
      taskId: argValue("task_id"),
      action: argValue("action") || FIXED_ACTION,
    }));
    return;
  }

  if (command === "poll") {
    printJson(await poll());
    return;
  }

  if (command === "drain") {
    printJson(await drain());
    return;
  }

  if (command === "runner") {
    printJson(await runner());
    return;
  }

  if (command === "mark-capability-not-enabled") {
    printJson(await markCodexTaskCapabilityNotEnabled(argValue("task_id"), { env: process.env }));
    return;
  }

  if (command === "selftest") {
    const task = await createSyntheticTask({
      task_id: argValue("task_id") || `pline-v3-fix17-selftest-${Date.now()}`,
      request_id: argValue("request_id") || `pline-v3-fix17-selftest-${Date.now()}`,
      marker: argValue("marker"),
    });
    printJson(await claimOnce({ env: process.env }));
    if (!task.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "idea-selftest") {
    const task = await createSyntheticIdeaTask({
      task_id: argValue("task_id") || `idea-fix-dropbox-selftest-${Date.now()}`,
      request_id: argValue("request_id") || `pline-v3-idea-selftest-${Date.now()}`,
      marker: argValue("marker"),
      content: argValue("content") || "FIX selftest idea",
    });
    const result = await claimOnce({ env: process.env });
    printJson({
      ...result,
      task_created: task.ok,
      content_recorded: undefined,
    });
    if (!task.ok || !result.ok || !result.claimed) {
      process.exitCode = 1;
    }
    return;
  }

  console.error(JSON.stringify({ ok: false, reason: "unsupported_command" }, null, 2));
  process.exitCode = 2;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, reason: error.message }, null, 2));
    process.exitCode = 1;
  });
}
