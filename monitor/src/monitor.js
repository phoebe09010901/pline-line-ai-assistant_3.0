import { access, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import {
  APPROVAL_STATUS,
  CODEX_DELEGATE_ACTION,
  CodexExecHostAdapter,
  CodexGateway,
  approvalCodeForTask,
  discoverHostCapabilities,
  writeGatewayResultFile,
} from "./codex_gateway.js";

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
export const CRUD_ACTION = "crud_task";
export { CODEX_DELEGATE_ACTION };
export const DROPBOX_IDEA_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03";
export const TEST_CALENDAR_STORE_PATH = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/google-calendar-test/events.json";
export const WORKER_BASE_URL = "https://pline-v3-test-line-gateway.phy4175.workers.dev";
export const IDEA_FINALIZE_PATH = "/test/idea-finalize";
export const CODEX_FINALIZE_PATH = "/test/codex-finalize";
export const CRUD_FINALIZE_PATH = "/test/crud-finalize";
export const TASK_PREFIX = "codex_task:v1";
export const IDEA_TASK_PREFIX = "idea_json:v1";
export const CRUD_TASK_PREFIX = "crud_task:v1";
export const TASK_PENDING_PREFIX = `${TASK_PREFIX}:pending:`;
export const IDEA_TASK_PENDING_PREFIX = `${IDEA_TASK_PREFIX}:pending:`;
export const CRUD_TASK_PENDING_PREFIX = `${CRUD_TASK_PREFIX}:pending:`;
export const CRUD_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
export const CODEX_LAST_CREATED_FILE_KEY = `${TASK_PREFIX}:context:last_created_file`;
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
    supported_actions: [CODEX_DELEGATE_ACTION, FIXED_ACTION, SAVE_IDEA_ACTION, CRUD_ACTION],
    task_prefixes: [TASK_PREFIX, IDEA_TASK_PREFIX, CRUD_TASK_PREFIX],
    task_prefix: TASK_PREFIX,
    idea_task_prefix: IDEA_TASK_PREFIX,
    pending_prefixes: [TASK_PENDING_PREFIX, IDEA_TASK_PENDING_PREFIX, CRUD_TASK_PENDING_PREFIX],
    dropbox_idea_dir: DROPBOX_IDEA_DIR,
    dropbox_memo_dir: DROPBOX_IDEA_DIR,
    test_calendar_store_path: TEST_CALENDAR_STORE_PATH,
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
    codex_gateway: {
      selected_interface: "codex_exec_json",
      action: CODEX_DELEGATE_ACTION,
      legacy_smoke_action: FIXED_ACTION,
      result_dir: "runtime/codex-gateway",
      approval_bridge: "line_confirmation_code",
    },
  };
}

export async function runTask(task, env = process.env, options = {}) {
  const codex = await resolveCodexBin(env);
  if (!codex.ok) {
    return { ok: false, reason: codex.reason, codex_bin: codex };
  }

  const normalized = normalizeTask(task);
  if (normalized.action === SAVE_IDEA_ACTION) {
    return saveIdeaJson(normalized);
  }
  if (normalized.action === CRUD_ACTION) {
    return runCrudTask(normalized, env, options);
  }

  if (normalized.action === CODEX_DELEGATE_ACTION) {
    const recentContext = await resolveRecentCreatedFileContextForTask(normalized, options.kv);
    if (!recentContext.ok) {
      return {
        ok: false,
        reason: recentContext.reason,
        action: CODEX_DELEGATE_ACTION,
        context_required: true,
      };
    }
    const gateway = options.gateway || new CodexGateway({
      adapter: options.adapter || new CodexExecHostAdapter({ codexBin: codex.path }),
    });
    const gatewayResult = await gateway.submit_task({
      ...normalized,
      project_name: normalized.project,
      original_user_text: normalized.original_user_text,
      recent_created_file: recentContext.context || null,
    }, {
      env,
      timeoutMs: env.CODEX_GATEWAY_TIMEOUT_MS,
      onCodexStarted: options.onCodexStarted,
    });
    if (gatewayResult.status === APPROVAL_STATUS) {
      return {
        ok: true,
        status: APPROVAL_STATUS,
        action: CODEX_DELEGATE_ACTION,
        codex_execution: false,
        approval_required: true,
        approval_code: gatewayResult.approval_code,
        approval_reason: gatewayResult.approval_reason,
        summary: "Codex task is waiting for LINE approval.",
        gateway: gatewayResult,
      };
    }
    if (!gatewayResult.ok) {
      return {
        ok: false,
        reason: gatewayResult.reason || "codex_gateway_failed",
        action: CODEX_DELEGATE_ACTION,
        gateway: gatewayResult,
      };
    }
    const resultFile = await writeGatewayResultFile(normalized, gatewayResult, PROJECT_ROOT);
    const createdFileContext = await createdFileContextFromExecution(normalized, gatewayResult);
    return {
      ok: true,
      status: "completed",
      action: CODEX_DELEGATE_ACTION,
      target_path: resultFile.relative_path,
      codex_execution: true,
      file_written: false,
      tests: gatewayResult.tests || "PASS",
      changed_files: gatewayResult.changed_files || [],
      summary: gatewayResult.summary,
      thread_id: gatewayResult.thread_id,
      turn_id: gatewayResult.turn_id,
      run_id: gatewayResult.run_id,
      codex_received: gatewayResult.codex_received,
      tool_event_count: gatewayResult.tool_events?.length || 0,
      result_file: resultFile.relative_path,
      created_file_context: createdFileContext.ok ? createdFileContext.context : null,
      gateway: gatewayResult,
    };
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
  const isCodexLikeAction = action === FIXED_ACTION || action === CODEX_DELEGATE_ACTION;
  const isCrudAction = action === CRUD_ACTION;
  return {
    task_id: sanitizeId(task.task_id || "pline-v3-test-smoke"),
    task_type: isCodexLikeAction ? "codex_task" : isCrudAction ? "crud_task" : "",
    project: action === FIXED_ACTION ? sanitizeLabel(task.project || CODEX_TASK_PROJECT) : isCodexLikeAction ? sanitizeLabel(task.project || "菲比 LINE 智能助理_03") : sanitizeLabel(task.project || ""),
    project_path: action === FIXED_ACTION ? String(task.project_path || CODEX_TASK_PROJECT_PATH) : isCodexLikeAction ? String(task.project_path || PROJECT_ROOT) : String(task.project_path || ""),
    instruction: action === FIXED_ACTION ? String(task.instruction || "Create or overwrite the fixed smoke file with the fixed smoke content.") : String(task.instruction || task.original_user_text || ""),
    original_user_text: String(task.original_user_text || task.instruction || ""),
    request_id: sanitizeId(task.request_id || ""),
    marker: sanitizeId(task.marker || ""),
    action,
    created_at: String(task.created_at || ""),
    target_path: isCodexLikeAction ? task.target_path || SMOKE_FILE_PATH : "",
    target_dir: task.target_dir || DROPBOX_IDEA_DIR,
    content: action === FIXED_ACTION ? task.content || SMOKE_FILE_CONTENT : String(task.content || ""),
    idea: task.idea || null,
    finalize_token: sanitizeId(task.finalize_token || ""),
    final_reply_text: String(task.final_reply_text || ""),
    line_user_ref: String(task.line_user_ref || ""),
    approval: task.approval || null,
    domain: isCrudAction ? sanitizeId(task.domain || "") : "",
    operation: isCrudAction ? sanitizeId(task.operation || "") : "",
    body_text: isCrudAction ? String(task.body_text || "").replace(/\s+/g, " ").trim().slice(0, 1000) : "",
    body: isCrudAction ? sanitizeCrudBody(task.body || {}, task.body_text || "", task.operation || "") : null,
    actor_fingerprint: sanitizeId(task.actor_fingerprint || ""),
    line_event_key: sanitizeId(task.line_event_key || ""),
    confirmed: task.confirmed === true,
    confirmation_id: sanitizeId(task.confirmation_id || ""),
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
    for (const prefix of [TASK_PENDING_PREFIX, IDEA_TASK_PENDING_PREFIX, CRUD_TASK_PENDING_PREFIX]) {
      const pendingKeys = await kv.list(prefix);
      for (const pendingKey of pendingKeys) {
        keys.push({
          name: taskKeyFromPendingKey(pendingKey.name || pendingKey),
          pending_key: pendingKey.name || pendingKey,
        });
      }
    }
    if (keys.length === 0 && options.legacyScan !== false) {
      for (const prefix of [`${TASK_PREFIX}:task:`, `${IDEA_TASK_PREFIX}:task:`, `${CRUD_TASK_PREFIX}:task:`]) {
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
    if (status !== "pending" && status !== "queued" && status !== "approved" && !staleClaim) {
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

    let processingNoticeSent = false;
    const notifyProcessingStarted = async () => {
      if (processingNoticeSent || task.action !== CODEX_DELEGATE_ACTION) {
        return;
      }
      processingNoticeSent = true;
      const callbackResult = await notifyCodexFinalizer(task, "processing", env);
      await writeEvidenceStage(kv, task, callbackResult.ok ? "codex_task_processing_callback_completed" : "codex_task_processing_callback_failed", {
        monitor: MONITOR_NAME,
        action: task.action,
        status: callbackResult.status || "processing",
        reason: callbackResult.ok ? "" : callbackResult.reason,
      });
    };

    let execution;
    try {
      execution = await runTask(task, env, {
        ...options,
        kv,
        onCodexStarted: notifyProcessingStarted,
      });
    } catch (error) {
      execution = {
        ok: false,
        status: "failed",
        reason: sanitizeId(error?.name || "task_execution_exception"),
        reply_text: "這次沒有順利處理，我先不假裝已完成 🙏",
      };
    }
    if (execution.ok && execution.status === APPROVAL_STATUS) {
      const approvalRecord = {
        ...claimRecord,
        status: APPROVAL_STATUS,
        approval: {
          status: APPROVAL_STATUS,
          code: execution.approval_code,
          reason: execution.approval_reason,
          requested_at: new Date().toISOString(),
        },
      };
      await kv.put(taskKey(task.task_id, task.action), JSON.stringify(approvalRecord));
      await kv.put(approvalKey(execution.approval_code), taskKey(task.task_id, task.action));
      await writeEvidenceStage(kv, task, "codex_task_approval_required", {
        monitor: MONITOR_NAME,
        action: task.action,
        status: APPROVAL_STATUS,
        reason: execution.approval_reason,
      });
      const callbackResult = await notifyCodexFinalizer({
        ...task,
        approval_code: execution.approval_code,
      }, APPROVAL_STATUS, env, execution.approval_reason);
      await writeEvidenceStage(kv, task, callbackResult.ok ? "codex_task_approval_notice_completed" : "codex_task_approval_notice_failed", {
        monitor: MONITOR_NAME,
        action: task.action,
        status: APPROVAL_STATUS,
        reason: callbackResult.ok ? "" : callbackResult.reason,
      });
      return {
        ok: true,
        claimed: true,
        task_id: task.task_id,
        request_id: task.request_id,
        marker: task.marker,
        action: task.action,
        status: APPROVAL_STATUS,
        approval_required: true,
      };
    }
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
      if (task.action === FIXED_ACTION || task.action === CODEX_DELEGATE_ACTION) {
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
      if (task.action === CRUD_ACTION) {
        await kv.put(crudResultKey(task.task_id), JSON.stringify(crudResultRecord(task, {
          ok: false,
          status: "failed",
          reason: execution.reason,
          reply_text: execution.reply_text,
        })));
        const callbackResult = await notifyCrudFinalizer(task, "failed", env, execution.reason);
        await writeEvidenceStage(kv, task, callbackResult.ok ? "crud_task_final_callback_completed" : "crud_task_final_callback_failed", {
          monitor: MONITOR_NAME,
          action: task.action,
          domain: task.domain,
          operation: task.operation,
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

    const completedStatus = ["duplicate", "needs_confirmation", "needs_clarification", "failed"].includes(execution.status) ? execution.status : "completed";
    const completedAt = new Date().toISOString();
    if (task.action === CODEX_DELEGATE_ACTION && execution.codex_received && execution.codex_execution) {
      await notifyProcessingStarted();
    }
    await writeEvidenceStage(kv, task, task.action === SAVE_IDEA_ACTION ? "idea_json_saved" : task.action === CRUD_ACTION ? "crud_task_executed" : "codex_execution_completed", {
      monitor: MONITOR_NAME,
      codex_execution: (task.action === FIXED_ACTION || task.action === CODEX_DELEGATE_ACTION) || undefined,
      saved: task.action === SAVE_IDEA_ACTION ? execution.status || "saved" : undefined,
      action: task.action,
      domain: task.domain,
      operation: task.operation,
    });
    await writeEvidenceStage(kv, task, task.action === SAVE_IDEA_ACTION ? "idea_json_file_written" : task.action === CRUD_ACTION ? "crud_task_result_received" : task.action === CODEX_DELEGATE_ACTION ? "codex_task_result_received" : "smoke_file_written", {
      monitor: MONITOR_NAME,
      file_written: task.action === SAVE_IDEA_ACTION || task.action === FIXED_ACTION,
      action: task.action,
      status: completedStatus,
      file_name: execution.file_name,
      domain: task.domain,
      operation: task.operation,
      needs_confirmation: completedStatus === "needs_confirmation",
      needs_clarification: completedStatus === "needs_clarification",
    });
    const completedTaskRecord = {
      ...claimRecord,
      status: completedStatus,
      completed_at: completedAt,
      codex_execution: true,
      file_written: task.action === SAVE_IDEA_ACTION || task.action === FIXED_ACTION,
      mtime_ms: execution.mtime_ms,
      mtime_iso: execution.mtime_iso,
      file_name: execution.file_name,
      thread_id: execution.thread_id,
      turn_id: execution.turn_id,
      run_id: execution.run_id,
      codex_received: execution.codex_received,
      tool_event_count: execution.tool_event_count,
      result_file: execution.result_file,
      final_reply_text: execution.reply_text || task.final_reply_text,
      confirmation_id: execution.confirmation_id || task.confirmation_id,
    };
    await kv.put(taskKey(task.task_id, task.action), JSON.stringify(completedTaskRecord));
    warnings.push(await bestEffortDeletePendingIndex(kv, task, pendingKey(task.task_id, task.action), "completed_task_pending_index_cleanup"));
    if (task.action === FIXED_ACTION || task.action === CODEX_DELEGATE_ACTION) {
      const resultRecord = codexResultRecord(task, execution);
      await kv.put(codexResultKey(task.task_id), JSON.stringify(resultRecord));
      if (task.action === CODEX_DELEGATE_ACTION && execution.created_file_context?.path) {
        await kv.put(CODEX_LAST_CREATED_FILE_KEY, JSON.stringify(execution.created_file_context));
        await writeEvidenceStage(kv, task, "codex_task_last_created_file_context_updated", {
          monitor: MONITOR_NAME,
          action: task.action,
          status: "completed",
        });
      }
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
    if (task.action === CRUD_ACTION) {
      const resultRecord = crudResultRecord(task, execution);
      await kv.put(crudResultKey(task.task_id), JSON.stringify(resultRecord));
      await writeEvidenceStage(kv, task, "crud_task_result_recorded", {
        monitor: MONITOR_NAME,
        action: task.action,
        domain: task.domain,
        operation: task.operation,
        status: resultRecord.status,
      });
      const callbackResult = await notifyCrudFinalizer({
        ...task,
        final_reply_text: execution.reply_text || task.final_reply_text,
      }, completedStatus, env, execution.reason || "");
      await writeEvidenceStage(kv, task, callbackResult.ok ? "crud_task_final_callback_completed" : "crud_task_final_callback_failed", {
        monitor: MONITOR_NAME,
        action: task.action,
        domain: task.domain,
        operation: task.operation,
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

export async function runCrudTask(task = {}, env = process.env, options = {}) {
  const normalized = normalizeTask(task);
  if (normalized.action !== CRUD_ACTION) {
    return { ok: false, reason: "unsupported_action" };
  }
  if (normalized.domain === "memo") {
    return runMemoCrud(normalized, options);
  }
  if (normalized.domain === "calendar") {
    return runCalendarCrud(normalized, options);
  }
  return { ok: false, reason: "unsupported_crud_domain" };
}

export async function runMemoCrud(task = {}, options = {}) {
  await mkdir(DROPBOX_IDEA_DIR, { recursive: true });
  const operation = task.operation;
  if (operation === "memo_create") {
    const content = normalizeMemoCreateContent(task.body?.content || task.body_text || "");
    if (!content) return { ok: false, status: "failed", reason: "missing_memo_content", reply_text: "這次沒有順利處理備忘錄，我先不假裝已完成 🙏" };
    const memo = normalizeMemoJson({
      memo_id: `memo-${stableHash(`${task.line_event_key}:${content}`).slice(0, 16)}`,
      content,
      search_keys: memoSearchKeysFrom(content),
      created_at: taipeiIsoString(new Date()),
      updated_at: taipeiIsoString(new Date()),
      actor_fingerprint: task.actor_fingerprint,
      line_event_key: task.line_event_key,
      status: "active",
    });
    const validation = validateMemoJson(memo);
    if (!validation.ok) return { ok: false, status: "failed", reason: validation.reason };
    const saved = await atomicWriteMemoJson(memo);
    return {
      ok: true,
      status: saved.duplicate ? "duplicate" : "completed",
      action: CRUD_ACTION,
      file_name: saved.file_name,
      mtime_ms: saved.mtime_ms,
      mtime_iso: saved.mtime_iso,
      reply_text: saved.duplicate ? "" : "備忘錄已新增好了。",
    };
  }

  const query = normalizeMemoTargetQuery(task.body?.query || task.body_text || "", operation);
  if (!query) return { ok: true, status: "needs_clarification", reason: "missing_memo_query", reply_text: "請再補充一下要處理哪一筆備忘錄。" };
  const matches = await searchMemoFiles(query, task.actor_fingerprint);
  if (operation === "memo_search") {
    if (matches.length === 0) return { ok: true, status: "completed", reply_text: "目前沒有找到符合的備忘錄。" };
    const summary = matches.slice(0, 3).map((item, index) => `${index + 1}. ${safeVisibleText(item.memo.content, 40)}`).join("\n");
    return { ok: true, status: "completed", reply_text: `找到這些備忘錄：\n${summary}` };
  }
  if (matches.length === 0) return { ok: true, status: "needs_clarification", reason: "memo_target_not_found", reply_text: "沒有找到明確符合的備忘錄，請再描述一下。" };
  if (matches.length > 1) return { ok: true, status: "needs_clarification", reason: "memo_multiple_candidates", reply_text: `找到 ${matches.length} 筆可能符合，請再補充一點關鍵字。` };

  const match = matches[0];
  if (operation === "memo_update") {
    const parsedUpdate = parseMemoUpdateText(task.body_text || task.body?.query || "");
    const newContent = normalizeMemoCreateContent(task.body?.new_content || parsedUpdate.new_content || "");
    if (!newContent) return { ok: true, status: "needs_clarification", reason: "missing_memo_new_content", reply_text: "請告訴我要把這筆備忘錄改成什麼內容。" };
    const updated = normalizeMemoJson({
      ...match.memo,
      content: newContent,
      search_keys: mergeMemoSearchKeys(match.memo.search_keys, query, match.memo.content),
      updated_at: taipeiIsoString(new Date()),
      status: "active",
    });
    const saved = await overwriteJsonFile(match.path, updated);
    return { ok: true, status: "completed", file_name: match.file_name, mtime_ms: saved.mtime_ms, mtime_iso: saved.mtime_iso, reply_text: "備忘錄已更新好了。" };
  }
  if (operation === "memo_delete") {
    if (!task.confirmed) {
      const confirmation = await createCrudConfirmation(task, options.kv, {
        target_file_name: match.file_name,
        target_summary: safeVisibleText(match.memo.content, 80),
      });
      return { ok: true, status: "needs_confirmation", confirmation_id: confirmation.confirmation_id, reply_text: `要刪除「${safeVisibleText(match.memo.content, 40)}」嗎？請回覆「確認」。` };
    }
    await unlink(match.path);
    return { ok: true, status: "completed", file_name: match.file_name, reply_text: "備忘錄已刪除了。" };
  }
  return { ok: false, status: "failed", reason: "unsupported_memo_operation" };
}

export async function runCalendarCrud(task = {}, options = {}) {
  const store = await readCalendarStore();
  const operation = task.operation;
  const now = taipeiIsoString(new Date());
  if (operation === "calendar_create") {
    const title = String(task.body?.title || task.body_text || "").trim();
    const start = String(task.body?.start || "").trim();
    if (!title || !start) {
      return { ok: true, status: "needs_clarification", reason: "missing_calendar_required_fields", reply_text: "請補充行事曆標題和時間，我才不會猜錯。" };
    }
    const event = {
      id: `cal-${stableHash(`${task.line_event_key}:${title}:${start}`).slice(0, 16)}`,
      title,
      start,
      end: String(task.body?.end || ""),
      all_day: task.body?.all_day === true,
      location: String(task.body?.location || ""),
      description: String(task.body?.description || ""),
      recurrence: String(task.body?.recurrence || ""),
      reminders: Array.isArray(task.body?.reminders) ? task.body.reminders : [],
      actor_fingerprint: task.actor_fingerprint,
      created_at: now,
      updated_at: now,
      status: "active",
    };
    if (!store.events.some((existing) => existing.id === event.id)) {
      store.events.push(event);
      await writeCalendarStore(store);
    }
    return { ok: true, status: "completed", reply_text: "行事曆已新增好了。" };
  }

  const query = String(task.body?.query || task.body?.title || task.body_text || "").trim();
  if (!query) return { ok: true, status: "needs_clarification", reason: "missing_calendar_query", reply_text: "請再補充一下要找哪一筆行事曆。" };
  const matches = store.events.filter((event) => event.status === "active" && event.actor_fingerprint === task.actor_fingerprint && event.title.includes(query));
  if (operation === "calendar_search") {
    if (matches.length === 0) return { ok: true, status: "completed", reply_text: "目前沒有找到符合的行事曆。" };
    const summary = matches.slice(0, 3).map((event, index) => `${index + 1}. ${safeVisibleText(event.title, 40)}`).join("\n");
    return { ok: true, status: "completed", reply_text: `找到這些行事曆：\n${summary}` };
  }
  if (matches.length === 0) return { ok: true, status: "needs_clarification", reason: "calendar_target_not_found", reply_text: "沒有找到明確符合的行事曆，請再描述一下。" };
  if (matches.length > 1) return { ok: true, status: "needs_clarification", reason: "calendar_multiple_candidates", reply_text: `找到 ${matches.length} 筆可能符合，請再補充一點關鍵字。` };
  const target = matches[0];
  if (operation === "calendar_update") {
    Object.assign(target, removeEmptyFields({
      title: task.body?.title && task.body.title !== query ? task.body.title : "",
      start: task.body?.start || "",
      end: task.body?.end || "",
      location: task.body?.location || "",
      description: task.body?.description || "",
      updated_at: now,
    }));
    await writeCalendarStore(store);
    return { ok: true, status: "completed", reply_text: "行事曆已更新好了。" };
  }
  if (operation === "calendar_delete") {
    if (!task.confirmed) {
      const confirmation = await createCrudConfirmation(task, options.kv, {
        target_summary: safeVisibleText(target.title, 80),
      });
      return { ok: true, status: "needs_confirmation", confirmation_id: confirmation.confirmation_id, reply_text: `要刪除「${safeVisibleText(target.title, 40)}」嗎？請回覆「確認」。` };
    }
    target.status = "deleted";
    target.updated_at = now;
    await writeCalendarStore(store);
    return { ok: true, status: "completed", reply_text: "行事曆已刪除了。" };
  }
  return { ok: false, status: "failed", reason: "unsupported_calendar_operation" };
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
  if (task.action !== FIXED_ACTION && task.action !== CODEX_DELEGATE_ACTION) {
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
    body: JSON.stringify(removeEmptyFields({
      task_id: task.task_id,
      request_id: task.request_id,
      action: task.action || CODEX_DELEGATE_ACTION,
      status,
      reason,
      approval_code: task.approval_code || "",
      finalize_token: task.finalize_token,
    })),
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

export async function notifyCrudFinalizer(task = {}, status = "completed", env = process.env, reason = "") {
  if (task.action !== CRUD_ACTION) {
    return { ok: true, status: "skipped_non_crud_task" };
  }
  if (env.CRUD_FINALIZE_DISABLED === "1") {
    return { ok: true, status: "disabled" };
  }
  if (!task.finalize_token) {
    return { ok: false, reason: "missing_finalize_token" };
  }
  const baseUrl = String(env.WORKER_BASE_URL || WORKER_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${CRUD_FINALIZE_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(removeEmptyFields({
      task_id: task.task_id,
      request_id: task.request_id,
      action: CRUD_ACTION,
      status,
      reason,
      finalize_token: task.finalize_token,
      reply_text: task.final_reply_text || "",
    })),
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
  return { ok: true, status: body.status || "ok", pushed: Boolean(body.pushed) };
}

export function codexResultRecord(task = {}, execution = {}) {
  if (!execution.ok) {
    return {
      task_id: task.task_id,
      status: "failed",
      created_at: task.created_at || "",
      summary: task.action === CODEX_DELEGATE_ACTION ? "The Codex delegated task did not complete." : "The safe smoke task did not complete.",
      tests: "FAIL",
      changed_files: [],
      commit: null,
      error: execution.reason || "unknown_error",
    };
  }
  const record = {
    task_id: task.task_id,
    status: "completed",
    created_at: task.created_at || "",
    summary: execution.summary || (task.action === CODEX_DELEGATE_ACTION ? "Codex delegated task completed." : "Safe smoke file was created and verified."),
    tests: execution.tests || "PASS",
    changed_files: execution.changed_files || (task.action === CODEX_DELEGATE_ACTION ? [] : ["runtime/codex-task-smoke/codex_task_smoke_test.txt"]),
    commit: null,
    error: null,
  };
  if (task.action === CODEX_DELEGATE_ACTION) {
    record.thread_id = execution.thread_id || "";
    record.turn_id = execution.turn_id || "";
    record.run_id = execution.run_id || "";
    record.result_file = execution.result_file || "";
    if (execution.created_file_context?.path) {
      record.created_file_path = execution.created_file_context.path;
      record.created_file_relative_path = execution.created_file_context.relative_path;
      record.created_file_content_sha256 = execution.created_file_context.content_sha256;
      record.created_file_created_at = execution.created_file_context.created_at;
    }
  }
  return record;
}

export function crudResultRecord(task = {}, execution = {}) {
  return {
    task_id: task.task_id,
    status: execution.status || (execution.ok ? "completed" : "failed"),
    created_at: task.created_at || "",
    domain: task.domain || "",
    operation: task.operation || "",
    summary: execution.ok ? "CRUD task completed." : "CRUD task did not complete.",
    tests: execution.ok ? "PASS" : "FAIL",
    changed_files: [],
    commit: null,
    error: execution.ok ? null : execution.reason || "unknown_error",
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

export function normalizeMemoJson(memo = {}) {
  return {
    schema_version: "1.0",
    memo_id: sanitizeId(memo.memo_id),
    content: String(memo.content || "").trim(),
    search_keys: normalizeMemoSearchKeys(memo.search_keys || memo.search_key || []),
    created_at: String(memo.created_at || ""),
    updated_at: String(memo.updated_at || ""),
    source: "line",
    actor_fingerprint: sanitizeId(memo.actor_fingerprint),
    line_event_key: sanitizeId(memo.line_event_key),
    status: memo.status === "deleted" ? "deleted" : "active",
  };
}

export function validateMemoJson(memo = {}) {
  const allowedKeys = ["schema_version", "memo_id", "content", "search_keys", "created_at", "updated_at", "source", "actor_fingerprint", "line_event_key", "status"];
  if (JSON.stringify(Object.keys(memo).sort()) !== JSON.stringify([...allowedKeys].sort())) return { ok: false, reason: "invalid_memo_json_schema_keys" };
  if (memo.schema_version !== "1.0") return { ok: false, reason: "invalid_schema_version" };
  if (!/^memo-[A-Za-z0-9:_\-.]{8,80}$/.test(memo.memo_id)) return { ok: false, reason: "invalid_memo_id" };
  if (memo.status === "active" && !memo.content) return { ok: false, reason: "invalid_content" };
  if (!Array.isArray(memo.search_keys) || memo.search_keys.length > 12) return { ok: false, reason: "invalid_search_keys" };
  if (memo.search_keys.some((key) => typeof key !== "string" || key.length > 120 || key.includes("/") || key.includes("\\"))) return { ok: false, reason: "invalid_search_key_value" };
  if (!/^[a-f0-9]{16,64}$/.test(memo.actor_fingerprint)) return { ok: false, reason: "invalid_actor_fingerprint" };
  if (!/^[a-f0-9]{16,64}$/.test(memo.line_event_key)) return { ok: false, reason: "invalid_line_event_key" };
  if (memo.source !== "line") return { ok: false, reason: "invalid_source" };
  return { ok: true };
}

async function atomicWriteMemoJson(memo = {}) {
  const fileName = memoFileName(memo);
  const finalPath = join(DROPBOX_IDEA_DIR, fileName);
  if (!finalPath.startsWith(`${DROPBOX_IDEA_DIR}${sep}`)) return { ok: false, reason: "unsafe_target_path" };
  if (await fileExists(finalPath)) {
    const fileStat = await stat(finalPath);
    return { ok: true, duplicate: true, file_name: fileName, mtime_ms: fileStat.mtimeMs, mtime_iso: fileStat.mtime.toISOString() };
  }
  const tempPath = join(DROPBOX_IDEA_DIR, `.${fileName}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tempPath, `${JSON.stringify(memo, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    const parsed = JSON.parse(await readFile(tempPath, "utf8"));
    const validation = validateMemoJson(parsed);
    if (!validation.ok) {
      await safeUnlink(tempPath);
      return validation;
    }
    await rename(tempPath, finalPath);
  } catch (error) {
    await safeUnlink(tempPath);
    return { ok: false, reason: "memo_json_write_failed", error_name: error?.name || "Error" };
  }
  const fileStat = await stat(finalPath);
  return { ok: true, file_name: fileName, mtime_ms: fileStat.mtimeMs, mtime_iso: fileStat.mtime.toISOString() };
}

async function overwriteJsonFile(finalPath = "", body = {}) {
  if (!finalPath.startsWith(`${DROPBOX_IDEA_DIR}${sep}`)) throw new Error("unsafe_target_path");
  const tempPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  JSON.parse(await readFile(tempPath, "utf8"));
  await rename(tempPath, finalPath);
  const fileStat = await stat(finalPath);
  return { ok: true, mtime_ms: fileStat.mtimeMs, mtime_iso: fileStat.mtime.toISOString() };
}

async function searchMemoFiles(query = "", actorFingerprint = "") {
  const files = await safeReadDropboxFileNames();
  const matches = [];
  for (const fileName of files.filter((name) => /^memo-[A-Za-z0-9:_\-.]+\.json$/.test(name))) {
    const path = join(DROPBOX_IDEA_DIR, fileName);
    const memo = normalizeMemoJson(parseJsonSafely(await readFile(path, "utf8")) || {});
    if (memo.status !== "active" || memo.actor_fingerprint !== actorFingerprint) continue;
    if (memo.content.includes(query) || memo.search_keys.includes(query)) matches.push({ file_name: fileName, path, memo });
  }
  return matches;
}

function normalizeMemoSearchKeys(value = []) {
  const values = Array.isArray(value) ? value : [value];
  const safe = [];
  for (const item of values) {
    const key = String(item || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!key || key.includes("/") || key.includes("\\") || safe.includes(key)) continue;
    safe.push(key);
    if (safe.length >= 12) break;
  }
  return safe;
}

function mergeMemoSearchKeys(...sources) {
  return normalizeMemoSearchKeys(sources.flatMap((source) => [
    ...(Array.isArray(source) ? source : [source]),
    ...memoSearchKeysFrom(source),
  ]));
}

function memoSearchKeysFrom(value = "") {
  const text = String(value || "");
  const markers = text.match(/\bM\d{4}-\d{14}\b/g) || [];
  return [...new Set(markers)];
}

async function safeReadDropboxFileNames() {
  try {
    await mkdir(DROPBOX_IDEA_DIR, { recursive: true });
    return await readdir(DROPBOX_IDEA_DIR);
  } catch {
    return [];
  }
}

async function readCalendarStore() {
  try {
    const parsed = parseJsonSafely(await readFile(TEST_CALENDAR_STORE_PATH, "utf8"));
    if (parsed && Array.isArray(parsed.events)) return parsed;
  } catch {
    // Missing store starts as an empty TEST calendar.
  }
  return { schema: "pline-v3-test-calendar-store/v1", events: [] };
}

async function writeCalendarStore(store = {}) {
  await mkdir(dirnameForFile(TEST_CALENDAR_STORE_PATH), { recursive: true });
  const safeStore = {
    schema: "pline-v3-test-calendar-store/v1",
    events: Array.isArray(store.events) ? store.events.map((event) => ({
      id: sanitizeId(event.id),
      title: String(event.title || "").slice(0, 200),
      start: String(event.start || "").slice(0, 80),
      end: String(event.end || "").slice(0, 80),
      all_day: event.all_day === true,
      location: String(event.location || "").slice(0, 200),
      description: String(event.description || "").slice(0, 500),
      recurrence: String(event.recurrence || "").slice(0, 120),
      reminders: Array.isArray(event.reminders) ? event.reminders.slice(0, 3) : [],
      actor_fingerprint: sanitizeId(event.actor_fingerprint),
      created_at: String(event.created_at || ""),
      updated_at: String(event.updated_at || ""),
      status: event.status === "deleted" ? "deleted" : "active",
    })) : [],
  };
  await writeFile(TEST_CALENDAR_STORE_PATH, `${JSON.stringify(safeStore, null, 2)}\n`, "utf8");
}

async function createCrudConfirmation(task = {}, kv = null, details = {}) {
  const confirmationId = `confirm-${stableHash(`${task.task_id}:${Date.now()}`).slice(0, 16)}`;
  const record = {
    schema: "pline-v3-test-crud-confirmation/v1",
    confirmation_id: confirmationId,
    task_id: task.task_id,
    actor_fingerprint: task.actor_fingerprint,
    domain: task.domain,
    operation: task.operation,
    status: "pending",
    details: {
      target_file_name: sanitizeId(details.target_file_name || ""),
      target_summary: safeVisibleText(details.target_summary || "", 80),
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CRUD_CONFIRMATION_TTL_MS).toISOString(),
  };
  if (kv) {
    await kv.put(crudConfirmationKey(confirmationId), JSON.stringify(record));
    await kv.put(crudConfirmationActorKey(task.actor_fingerprint), confirmationId);
  }
  return { ok: true, confirmation_id: confirmationId };
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
  const prefix = action === SAVE_IDEA_ACTION ? IDEA_TASK_PREFIX : action === CRUD_ACTION ? CRUD_TASK_PREFIX : TASK_PREFIX;
  return `${prefix}:task:${sanitizeId(taskId)}`;
}

function pendingKey(taskId, action = FIXED_ACTION) {
  const prefix = action === SAVE_IDEA_ACTION ? IDEA_TASK_PREFIX : action === CRUD_ACTION ? CRUD_TASK_PREFIX : TASK_PREFIX;
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
  if (value.startsWith(CRUD_TASK_PENDING_PREFIX)) {
    return taskKey(value.slice(CRUD_TASK_PENDING_PREFIX.length), CRUD_ACTION);
  }
  return value;
}

function isTerminalStatus(status = "") {
  return ["completed", "duplicate", "failed", "unsupported", "cancelled", "needs_confirmation", "needs_clarification"].includes(String(status || ""));
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
  if (key.startsWith(TASK_PENDING_PREFIX) || key.startsWith(IDEA_TASK_PENDING_PREFIX) || key.startsWith(CRUD_TASK_PENDING_PREFIX)) {
    return key.replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 220);
  }
  return "";
}

function codexResultKey(taskId) {
  return `${TASK_PREFIX}:result:${sanitizeId(taskId)}`;
}

function crudResultKey(taskId) {
  return `${CRUD_TASK_PREFIX}:result:${sanitizeId(taskId)}`;
}

function crudConfirmationKey(confirmationId) {
  return `${CRUD_TASK_PREFIX}:confirmation:${sanitizeId(confirmationId)}`;
}

function crudConfirmationActorKey(actorFingerprint) {
  return `${CRUD_TASK_PREFIX}:confirmation_actor:${sanitizeId(actorFingerprint)}`;
}

async function resolveRecentCreatedFileContextForTask(task = {}, kv = null) {
  if (!requiresRecentCreatedFileContext(task)) {
    return { ok: true, context: null };
  }
  if (!kv) {
    return { ok: false, reason: "last_created_file_context_not_found" };
  }
  const latest = await getLatestCreatedFileContext(kv);
  if (!latest.ok) {
    return { ok: false, reason: latest.reason || "last_created_file_context_not_found" };
  }
  return latest;
}

function requiresRecentCreatedFileContext(task = {}) {
  const text = `${task.original_user_text || ""}\n${task.instruction || ""}`;
  return /(?:讀取|讀|查看|回報).*(?:剛才|剛剛|剛建立|剛才建立|剛才那個|剛剛那個|上一個).*(?:檔案|文字檔)|(?:剛才|剛剛|剛才那個|剛剛那個).*(?:檔案|文字檔)/.test(text);
}

function isCreateFileTask(task = {}) {
  const text = `${task.original_user_text || ""}\n${task.instruction || ""}`;
  return /(?:建立|新增|產生|寫入|create).*(?:檔案|文字檔|file)|內容(?:寫|為|是)/i.test(text);
}

async function getLatestCreatedFileContext(kv) {
  const directRaw = await kv.get(CODEX_LAST_CREATED_FILE_KEY);
  const direct = normalizeCreatedFileContext(parseJsonSafely(directRaw));
  if (direct.ok) return direct;
  if (directRaw) {
    return { ok: false, reason: "last_created_file_context_invalid" };
  }

  const resultKeys = await kv.list(`${TASK_PREFIX}:result:`);
  const contexts = [];
  for (const key of resultKeys) {
    const raw = await kv.get(key.name || key);
    const record = parseJsonSafely(raw);
    if (!record || record.status !== "completed") continue;
    const fromRecord = await createdFileContextFromResultRecord(record);
    if (fromRecord.ok) contexts.push(fromRecord.context);
  }
  contexts.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  if (contexts[0]) {
    await kv.put(CODEX_LAST_CREATED_FILE_KEY, JSON.stringify(contexts[0]));
    return { ok: true, context: contexts[0] };
  }
  return { ok: false, reason: "last_created_file_context_not_found" };
}

async function createdFileContextFromExecution(task = {}, execution = {}) {
  if (task.action !== CODEX_DELEGATE_ACTION || !isCreateFileTask(task)) {
    return { ok: false, reason: "not_create_file_task" };
  }
  return createdFileContextFromCandidates({
    task_id: task.task_id,
    created_at: task.created_at || new Date().toISOString(),
    paths: [
      ...(Array.isArray(execution.changed_files) ? execution.changed_files : []),
      ...extractRuntimeTextFilePaths(`${execution.summary || ""}\n${execution.result_text || ""}`),
    ],
  });
}

async function createdFileContextFromResultRecord(record = {}) {
  const direct = normalizeCreatedFileContext({
    task_id: record.task_id,
    created_at: record.created_file_created_at || record.created_at,
    path: record.created_file_path,
    relative_path: record.created_file_relative_path,
    content_sha256: record.created_file_content_sha256,
  });
  if (direct.ok) return direct;
  if (record.status !== "completed") {
    return { ok: false, reason: "not_completed" };
  }
  return createdFileContextFromCandidates({
    task_id: record.task_id,
    created_at: record.created_at || "",
    paths: extractRuntimeTextFilePaths(`${record.summary || ""}\n${(record.changed_files || []).join("\n")}`),
  });
}

async function createdFileContextFromCandidates({ task_id = "", created_at = "", paths = [] } = {}) {
  const seen = new Set();
  for (const candidate of paths) {
    const safe = resolveRuntimeTextFile(candidate);
    if (!safe.ok || seen.has(safe.path)) continue;
    seen.add(safe.path);
    try {
      const fileStat = await stat(safe.path);
      if (!fileStat.isFile() || fileStat.size > 1024 * 64) continue;
      const content = await readFile(safe.path);
      return {
        ok: true,
        context: {
          task_id: sanitizeId(task_id),
          created_at: String(created_at || new Date().toISOString()),
          path: safe.path,
          relative_path: safe.relative_path,
          content_sha256: createHash("sha256").update(content).digest("hex"),
        },
      };
    } catch {
      // Try the next safe runtime candidate.
    }
  }
  return { ok: false, reason: "created_file_context_not_found" };
}

function normalizeCreatedFileContext(value = {}) {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "missing_context" };
  }
  const resolved = resolveRuntimeTextFile(value.path || value.relative_path || "");
  if (!resolved.ok || !/^[a-f0-9]{64}$/.test(String(value.content_sha256 || ""))) {
    return { ok: false, reason: "invalid_context" };
  }
  return {
    ok: true,
    context: {
      task_id: sanitizeId(value.task_id || ""),
      created_at: String(value.created_at || ""),
      path: resolved.path,
      relative_path: resolved.relative_path,
      content_sha256: String(value.content_sha256),
    },
  };
}

function resolveRuntimeTextFile(value = "") {
  const text = String(value || "").trim().replace(/^["'`「『]+|["'`」』]+$/g, "");
  if (!text || text.includes("\0") || text.includes("..")) {
    return { ok: false, reason: "unsafe_path" };
  }
  const root = resolve(PROJECT_ROOT);
  const runtimeRoot = resolve(PROJECT_ROOT, "runtime", "codex-gateway");
  const absolute = text.startsWith(root) ? resolve(text) : resolve(PROJECT_ROOT, text);
  if (!absolute.startsWith(`${runtimeRoot}${sep}`) || !absolute.endsWith(".txt")) {
    return { ok: false, reason: "outside_runtime_text_scope" };
  }
  return {
    ok: true,
    path: absolute,
    relative_path: absolute.slice(root.length + 1),
  };
}

function extractRuntimeTextFilePaths(text = "") {
  const paths = new Set();
  const pattern = /(?:\/Users\/phoebe\/Documents\/菲比 LINE 智能助理_03\/)?runtime\/codex-gateway\/[A-Za-z0-9_.:-]+\.txt/g;
  for (const match of String(text || "").matchAll(pattern)) {
    paths.add(match[0]);
  }
  return [...paths];
}

function parseJsonSafely(value = "") {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeCrudBody(body = {}, fallbackText = "", operation = "") {
  const safe = {};
  for (const key of ["content", "query", "search_query", "new_content", "title", "start", "end", "location", "description", "recurrence", "reply_text"]) {
    if (body[key]) safe[key] = String(body[key]).replace(/\s+/g, " ").trim().slice(0, 1000);
  }
  const queryOperation = ["memo_search", "memo_update", "memo_delete", "calendar_search", "calendar_update", "calendar_delete"].includes(operation);
  const memoUpdate = operation === "memo_update" ? parseMemoUpdateText(fallbackText || safe.query || safe.search_query || "") : { query: "", new_content: "" };
  if (queryOperation && !safe.query && safe.search_query) safe.query = safe.search_query;
  if (operation === "memo_update" && memoUpdate.query) safe.query = memoUpdate.query;
  if (queryOperation && !safe.query && fallbackText) safe.query = String(fallbackText).replace(/\s+/g, " ").trim().slice(0, 1000);
  if (operation === "memo_update" && !safe.new_content && memoUpdate.new_content) safe.new_content = memoUpdate.new_content;
  if (operation === "memo_create" && safe.content) safe.content = normalizeMemoCreateContent(safe.content);
  if (["memo_search", "memo_update", "memo_delete"].includes(operation) && safe.query) safe.query = normalizeMemoTargetQuery(safe.query, operation);
  if (operation === "memo_update" && safe.new_content) safe.new_content = normalizeMemoCreateContent(safe.new_content);
  delete safe.search_query;
  if (body.all_day === true) safe.all_day = true;
  if (Array.isArray(body.reminders)) safe.reminders = body.reminders.slice(0, 3).map((item) => Number(item)).filter(Number.isFinite);
  return safe;
}

function memoFileName(memo = {}) {
  const datePart = String(memo.created_at || "").replace(/[-:T+]/g, "").slice(0, 14) || "00000000000000";
  return `memo-${datePart}-${sanitizeId(memo.memo_id).replace(/^memo-/, "").slice(0, 12)}.json`;
}

function stableHash(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function taipeiIsoString(date = new Date()) {
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

function safeVisibleText(value = "", max = 60) {
  return String(value || "")
    .replace(/(?:_03|_02|\bTEST\b|n8n|Worker|monitor|JSON|execution|queued|task_id|runtime\/|\/Users\/|secret|token|raw User ID)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeMemoSearchQuery(value = "") {
  let query = String(value || "").replace(/\s+/g, " ").trim();
  for (const prefix of ["搜尋", "查詢", "查找", "尋找", "找一下", "找"]) {
    if (query === prefix) return "";
    if (query.startsWith(`${prefix}：`) || query.startsWith(`${prefix}:`)) {
      return query.slice(prefix.length + 1).trim();
    }
    if (query.startsWith(`${prefix} `)) {
      return query.slice(prefix.length + 1).trim();
    }
  }
  return query;
}

function normalizeMemoTargetQuery(value = "", operation = "") {
  let query = normalizeMemoSearchQuery(value);
  if (operation === "memo_delete") {
    for (const prefix of ["刪除", "删除", "刪掉", "移除"]) {
      if (query === prefix) return "";
      if (query.startsWith(`${prefix}：`) || query.startsWith(`${prefix}:`)) return query.slice(prefix.length + 1).trim();
      if (query.startsWith(`${prefix} `)) return query.slice(prefix.length + 1).trim();
    }
  }
  return query;
}

function normalizeMemoCreateContent(value = "") {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  for (const prefix of ["新增備忘錄", "建立備忘錄", "新增", "建立"]) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix}：`) || text.startsWith(`${prefix}:`)) return text.slice(prefix.length + 1).trim();
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim();
  }
  return text;
}

function parseMemoUpdateText(value = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const normalized = text
    .replace(/^(?:修改備忘錄|更新備忘錄)[\s:：]+/u, "")
    .trim();
  const match = normalized.match(/^(?:把|將)\s*[「"]([^」"]{1,400})[」"]\s*(?:的內容|的備忘錄|備忘錄)?\s*改(?:成|為)\s*[「"]([^」"]{1,400})[」"]$/u)
    || normalized.match(/^(?:把|將)\s+(.{1,400}?)\s*(?:的內容|的備忘錄|備忘錄)?\s*改(?:成|為)\s+(.{1,400})$/u);
  if (!match) return { query: "", new_content: "" };
  return {
    query: normalizeMemoSearchQuery(stripMemoUpdatePart(match[1])),
    new_content: normalizeMemoCreateContent(stripMemoUpdatePart(match[2])),
  };
}

function stripMemoUpdatePart(value = "") {
  return String(value || "")
    .replace(/^[「"\s]+/u, "")
    .replace(/[」"\s]+$/u, "")
    .trim();
}

function approvalKey(code = "") {
  return `${TASK_PREFIX}:approval:${sanitizeId(code)}`;
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
    "domain",
    "operation",
    "needs_confirmation",
    "needs_clarification",
    "thread_id",
    "turn_id",
    "run_id",
    "codex_received",
    "tool_event_count",
    "approval_required",
    "approval_code",
    "context_updated",
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

function removeEmptyFields(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== ""));
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
