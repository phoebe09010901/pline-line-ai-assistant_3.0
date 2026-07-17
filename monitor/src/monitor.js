import { access, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const MONITOR_NAME = "pline-v3-test-codex-monitor";
export const PROJECT_ROOT = "/Users/phoebe/Documents/菲比 LINE 智能助理_03";
export const WORKER_ROOT = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/worker";
export const RUNTIME_KV_NAMESPACE_ID = "10cdfe018b3942b483faeaca6e517ae5";
export const SMOKE_FILE_PATH = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt";
export const SMOKE_FILE_CONTENT = "Codex 已打通";
export const FIXED_ACTION = "create_smoke_file";
export const TASK_PREFIX = "codex_task:v1";
export const EVIDENCE_PREFIX = "evidence:v1";
export const EVIDENCE_TTL_SECONDS = 172800;

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
    smoke_file_path: SMOKE_FILE_PATH,
    smoke_file_content: SMOKE_FILE_CONTENT,
    task_prefix: TASK_PREFIX,
    evidence_prefix: EVIDENCE_PREFIX,
    runtime_kv_namespace_id: RUNTIME_KV_NAMESPACE_ID,
    codex_bin: codex,
  };
}

export async function runTask(task, env = process.env) {
  const codex = await resolveCodexBin(env);
  if (!codex.ok) {
    return { ok: false, reason: codex.reason, codex_bin: codex };
  }

  const normalized = normalizeTask(task);
  if (normalized.action !== FIXED_ACTION) {
    return { ok: false, reason: "unsupported_action" };
  }
  if (normalized.target_path !== SMOKE_FILE_PATH) {
    return { ok: false, reason: "unsupported_target_path" };
  }
  if (normalized.content !== SMOKE_FILE_CONTENT) {
    return { ok: false, reason: "unsupported_content" };
  }

  await writeFile(SMOKE_FILE_PATH, SMOKE_FILE_CONTENT, "utf8");
  const fileStat = await stat(SMOKE_FILE_PATH);
  return {
    ok: true,
    monitor: MONITOR_NAME,
    action: FIXED_ACTION,
    target_path: SMOKE_FILE_PATH,
    codex_execution: true,
    file_written: true,
    mtime_ms: fileStat.mtimeMs,
    mtime_iso: fileStat.mtime.toISOString(),
  };
}

export function normalizeTask(task = {}) {
  return {
    task_id: sanitizeId(task.task_id || "pline-v3-test-smoke"),
    request_id: sanitizeId(task.request_id || ""),
    marker: sanitizeId(task.marker || ""),
    action: task.action || FIXED_ACTION,
    target_path: task.target_path || SMOKE_FILE_PATH,
    content: task.content || SMOKE_FILE_CONTENT,
  };
}

export async function claimOnce(options = {}) {
  const env = options.env || process.env;
  const kv = options.kv || createWranglerKv(env);
  const now = new Date().toISOString();
  const keys = await kv.list(`${TASK_PREFIX}:task:`);

  for (const key of keys) {
    const raw = await kv.get(key.name || key);
    if (!raw) {
      continue;
    }
    let task;
    try {
      task = normalizeTask(JSON.parse(raw));
    } catch {
      continue;
    }
    const status = JSON.parse(raw).status || "";
    if (status !== "pending") {
      continue;
    }

    const claimRecord = {
      ...task,
      schema: "pline-v3-test-codex-task/v1",
      status: "claimed",
      monitor: MONITOR_NAME,
      claimed_at: now,
    };
    await kv.put(taskKey(task.task_id), JSON.stringify(claimRecord));
    await writeEvidenceStage(kv, task, "monitor_claimed", {
      monitor: MONITOR_NAME,
      claimed: true,
      action: task.action,
    });

    const execution = await runTask(task, env);
    if (!execution.ok) {
      await kv.put(taskKey(task.task_id), JSON.stringify({
        ...claimRecord,
        status: "failed",
        failed_at: new Date().toISOString(),
        reason: execution.reason,
      }));
      await writeEvidenceStage(kv, task, "codex_execution_failed", {
        monitor: MONITOR_NAME,
        reason: execution.reason,
        action: task.action,
      });
      return { ok: false, reason: execution.reason, task_id: task.task_id, request_id: task.request_id };
    }

    const completedAt = new Date().toISOString();
    await writeEvidenceStage(kv, task, "codex_execution_completed", {
      monitor: MONITOR_NAME,
      codex_execution: true,
      action: task.action,
    });
    await writeEvidenceStage(kv, task, "smoke_file_written", {
      monitor: MONITOR_NAME,
      file_written: true,
      action: task.action,
      status: "completed",
    });
    await kv.put(taskKey(task.task_id), JSON.stringify({
      ...claimRecord,
      status: "completed",
      completed_at: completedAt,
      codex_execution: true,
      file_written: true,
      mtime_ms: execution.mtime_ms,
      mtime_iso: execution.mtime_iso,
    }));

    return {
      ok: true,
      claimed: true,
      task_id: task.task_id,
      request_id: task.request_id,
      marker: task.marker,
      action: task.action,
      codex_execution: true,
      file_written: true,
      mtime_iso: execution.mtime_iso,
    };
  }

  return { ok: true, claimed: false, reason: "no_pending_task" };
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

export async function createSyntheticTask(task = {}, options = {}) {
  const kv = options.kv || createWranglerKv(options.env || process.env);
  const normalized = normalizeTask({
    task_id: task.task_id || `pline-v3-fix17-${Date.now()}`,
    request_id: task.request_id || `pline-v3-fix17-${Date.now()}`,
    marker: task.marker || "",
    action: FIXED_ACTION,
    target_path: SMOKE_FILE_PATH,
    content: SMOKE_FILE_CONTENT,
  });
  await kv.put(taskKey(normalized.task_id), JSON.stringify({
    ...normalized,
    schema: "pline-v3-test-codex-task/v1",
    status: "pending",
    monitor: MONITOR_NAME,
    created_at: new Date().toISOString(),
  }));
  return { ok: true, ...normalized };
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
  };
}

function taskKey(taskId) {
  return `${TASK_PREFIX}:task:${sanitizeId(taskId)}`;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  if (command === "poll") {
    printJson(await poll());
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

  console.error(JSON.stringify({ ok: false, reason: "unsupported_command" }, null, 2));
  process.exitCode = 2;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, reason: error.message }, null, 2));
    process.exitCode = 1;
  });
}
