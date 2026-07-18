import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const CODEX_GATEWAY_SCHEMA = "pline-v3-codex-gateway/v1";
export const CODEX_DELEGATE_ACTION = "codex_delegate";
export const APPROVAL_STATUS = "awaiting_approval";
export const DEFAULT_GATEWAY_TIMEOUT_MS = 120000;
export const DEFAULT_CODEX_SANDBOX = "workspace-write";
export const DEFAULT_CODEX_APPROVAL_POLICY = "never";
export const DEFAULT_RESULT_DIR = "runtime/codex-gateway";

export class CodexGateway {
  constructor({ adapter, capabilityProvider, clock = () => new Date() } = {}) {
    this.adapter = adapter || new CodexExecHostAdapter();
    this.capabilityProvider = capabilityProvider || this.adapter;
    this.clock = clock;
  }

  async submit_task(task = {}, options = {}) {
    const normalized = normalizeGatewayTask(task);
    if (!normalized.task_id || !normalized.original_user_text || !normalized.project_path) {
      return { ok: false, status: "failed", reason: "missing_gateway_task_fields" };
    }

    const capabilities = await this.list_capabilities(options);
    const approval = evaluateApprovalRequirement(normalized);
    if (approval.required && normalized.approval?.status !== "approved") {
      return {
        ok: true,
        status: APPROVAL_STATUS,
        task_id: normalized.task_id,
        request_id: normalized.request_id,
        approval_required: true,
        approval_code: approval.code,
        approval_reason: approval.reason,
        capabilities,
        events: [{
          type: "approval.required",
          task_id: normalized.task_id,
          approval_code: approval.code,
          reason: approval.reason,
        }],
      };
    }

    const submitted = await this.adapter.submit_task(normalized, {
      timeoutMs: Number(options.timeoutMs || DEFAULT_GATEWAY_TIMEOUT_MS),
      env: options.env || process.env,
      onCodexStarted: options.onCodexStarted,
    });
    if (!submitted.ok) {
      return {
        ok: false,
        status: "failed",
        task_id: normalized.task_id,
        request_id: normalized.request_id,
        reason: submitted.reason || "codex_gateway_submit_failed",
        events: submitted.events || [],
        capabilities,
      };
    }

    return {
      ok: true,
      status: submitted.status || "completed",
      task_id: normalized.task_id,
      request_id: normalized.request_id,
      thread_id: submitted.thread_id || "",
      turn_id: submitted.turn_id || "",
      run_id: submitted.run_id || "",
      codex_received: Boolean(submitted.codex_received),
      codex_execution: Boolean(submitted.codex_execution),
      tool_events: submitted.tool_events || [],
      events: submitted.events || [],
      result_text: submitted.result_text || "",
      summary: submitted.summary || summarizeResultText(submitted.result_text),
      changed_files: submitted.changed_files || [],
      tests: submitted.tests || "",
      capabilities,
    };
  }

  async get_status(task = {}, options = {}) {
    if (this.adapter.get_status) {
      return this.adapter.get_status(normalizeGatewayTask(task), options);
    }
    return { ok: true, status: "stateless_adapter" };
  }

  async stream_events(task = {}, options = {}) {
    if (this.adapter.stream_events) {
      return this.adapter.stream_events(normalizeGatewayTask(task), options);
    }
    return [];
  }

  async approve(task = {}, approvalCode = "") {
    const normalized = normalizeGatewayTask(task);
    const expected = approvalCodeForTask(normalized.task_id);
    if (!approvalCode || approvalCode !== expected) {
      return { ok: false, status: "rejected", reason: "invalid_approval_code" };
    }
    return {
      ok: true,
      status: "approved",
      task_id: normalized.task_id,
      approval: {
        status: "approved",
        code: expected,
        approved_at: this.clock().toISOString(),
      },
    };
  }

  async cancel(task = {}, reason = "cancelled") {
    if (this.adapter.cancel) {
      return this.adapter.cancel(normalizeGatewayTask(task), reason);
    }
    return { ok: true, status: "cancelled", reason };
  }

  async get_result(task = {}, options = {}) {
    if (this.adapter.get_result) {
      return this.adapter.get_result(normalizeGatewayTask(task), options);
    }
    return { ok: false, reason: "stateless_adapter_no_result_cache" };
  }

  async list_capabilities(options = {}) {
    if (this.capabilityProvider?.list_capabilities) {
      return this.capabilityProvider.list_capabilities(options);
    }
    return discoverHostCapabilities(options.env || process.env);
  }
}

export class CodexExecHostAdapter {
  constructor({ codexBin = "", execFileImpl = execFile } = {}) {
    this.codexBin = codexBin;
    this.execFile = execFileImpl;
  }

  async submit_task(task = {}, options = {}) {
    const env = options.env || process.env;
    const codexBin = this.codexBin || env.CODEX_BIN || "codex";
    const prompt = createCodexPrompt(task);
    const timeoutMs = Number(options.timeoutMs || env.CODEX_GATEWAY_TIMEOUT_MS || DEFAULT_GATEWAY_TIMEOUT_MS);
    const sandbox = env.CODEX_GATEWAY_SANDBOX || DEFAULT_CODEX_SANDBOX;
    const approvalPolicy = env.CODEX_GATEWAY_APPROVAL_POLICY || DEFAULT_CODEX_APPROVAL_POLICY;
    const reasoningEffort = env.CODEX_GATEWAY_REASONING_EFFORT || "low";
    const args = [
      "--ask-for-approval",
      approvalPolicy,
      "-c",
      `model_reasoning_effort="${reasoningEffort}"`,
      "exec",
      "--json",
      "--sandbox",
      sandbox,
      "-C",
      task.project_path,
      prompt,
    ];

    let stdout = "";
    let stderr = "";
    let startedNotified = false;
    let observedThreadId = "";
    const onJsonEvent = options.onCodexStarted
      ? async (event) => {
        const type = String(event.type || event.event || "");
        if (type === "thread.started" || event.thread_id || event.threadId) {
          observedThreadId ||= safeId(event.thread_id || event.threadId || event.thread?.id || "");
        }
        if (startedNotified) {
          return;
        }
        if (type === "turn.started" || event.turn_id || event.turnId) {
          startedNotified = true;
          await options.onCodexStarted({
            task_id: task.task_id,
            request_id: task.request_id,
            thread_id: safeId(event.thread_id || event.threadId || event.thread?.id || observedThreadId),
            turn_id: safeId(event.turn_id || event.turnId || event.turn?.id || ""),
          });
        }
      }
      : null;
    try {
      const result = await runProcess(codexBin, args, {
        cwd: task.project_path,
        env,
        timeoutMs,
        onJsonEvent,
      });
      stdout = result.stdout || "";
      stderr = result.stderr || "";
      if (result.exitCode !== 0) {
        const parsedFailure = parseCodexJsonl(stdout);
        return {
          ok: false,
          reason: result.timedOut ? "codex_exec_timeout" : "codex_exec_failed",
          events: parsedFailure.events,
          stderr_summary: summarizeStderr(stderr),
          ...parsedFailure.identity,
        };
      }
    } catch (error) {
      stdout = error?.stdout || "";
      const parsedFailure = parseCodexJsonl(stdout);
      return {
        ok: false,
        reason: error?.killed ? "codex_exec_timeout" : "codex_exec_failed",
        events: parsedFailure.events,
        ...parsedFailure.identity,
      };
    }

    const parsed = parseCodexJsonl(stdout);
    return {
      ok: parsed.completed,
      status: parsed.completed ? "completed" : "failed",
      reason: parsed.completed ? "" : parsed.failure_reason || "codex_exec_incomplete",
      codex_received: parsed.codex_received,
      codex_execution: parsed.codex_execution,
      tool_events: parsed.tool_events,
      events: parsed.events,
      result_text: parsed.result_text,
      summary: summarizeResultText(parsed.result_text),
      changed_files: parsed.changed_files,
      tests: parsed.tests,
      ...parsed.identity,
    };
  }

  async list_capabilities(options = {}) {
    return discoverHostCapabilities(options.env || process.env, {
      codexBin: this.codexBin,
      execFileImpl: this.execFile,
    });
  }
}

function runProcess(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let pendingStdoutLine = "";
    const eventTasks = [];
    const observeStdout = (chunkText = "") => {
      pendingStdoutLine += chunkText;
      const lines = pendingStdoutLine.split(/\r?\n/);
      pendingStdoutLine = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim() || !options.onJsonEvent) continue;
        try {
          const event = JSON.parse(line);
          eventTasks.push(Promise.resolve(options.onJsonEvent(event)).catch(() => {}));
        } catch {
          // Non-JSON output is still preserved in stdout for final parsing.
        }
      }
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, Number(options.timeoutMs || DEFAULT_GATEWAY_TIMEOUT_MS));
    child.stdout.on("data", (chunk) => {
      const chunkText = chunk.toString("utf8");
      stdout += chunkText;
      observeStdout(chunkText);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${error?.message || "spawn_error"}`, timedOut });
    });
    child.on("close", async (code) => {
      clearTimeout(timeout);
      observeStdout("\n");
      if (eventTasks.length > 0) {
        await Promise.allSettled(eventTasks);
      }
      resolve({ exitCode: code ?? 0, stdout, stderr, timedOut });
    });
    child.stdin.end();
  });
}

function summarizeStderr(stderr = "") {
  return String(stderr || "").split(/\r?\n/).filter(Boolean).slice(-3).join(" | ").slice(0, 500);
}

export async function discoverHostCapabilities(env = process.env, options = {}) {
  const execFileImpl = options.execFileImpl || execFile;
  const codexBin = options.codexBin || env.CODEX_BIN || "codex";
  const capabilities = {
    schema: "pline-v3-codex-capability-manifest/v1",
    selected_interface: "codex_exec_json",
    selected_reason: "official_non_interactive_cli_jsonl_for_launchd_monitor",
    codex_cli: await probeCommand(execFileImpl, codexBin, ["--version"]),
    codex_exec_json: await probeCommand(execFileImpl, codexBin, ["exec", "--help"], "--json"),
    app_server: {
      ...await probeCommand(execFileImpl, codexBin, ["app-server", "--help"]),
      reason: "available_experimental_rich_client_protocol_not_selected_for_launchd_first_pass",
    },
    codex_sdk: {
      available: false,
      reason: "not_selected_python_sdk_requires_local_app_server_client_runtime",
    },
    mcp_server: await probeCommand(execFileImpl, codexBin, ["mcp-server", "--help"]),
    shell: { available: true, reason: "monitor_runs_node_child_process" },
    file_read_write: { available: true, reason: "monitor_has_project_runtime_write_access" },
    git: await probeCommand(execFileImpl, "git", ["--version"]),
    network: { available: true, reason: "monitor_can_call_worker_finalizer_and_codex_cli" },
    skills: { available: false, reason: "controller_skills_not_directly_listable_by_launchd_monitor" },
    mcp: await probeCommand(execFileImpl, codexBin, ["mcp", "list"]),
    plugins_apps: { available: false, reason: "controller_apps_plugins_not_directly_callable_by_launchd_monitor" },
    browser: { available: false, reason: "requires Codex host/app tool surface; not exposed to launchd codex_exec adapter" },
    computer_use: { available: false, reason: "requires macOS app permission and host tool surface; not exposed to launchd codex_exec adapter" },
    approval_bridge: { available: true, reason: "gateway_pauses_high_risk_tasks_and_resumes_after_line_confirmation_code" },
  };
  return capabilities;
}

export function normalizeGatewayTask(task = {}) {
  const recentCreatedFile = task.recent_created_file && typeof task.recent_created_file === "object"
    ? {
      task_id: safeId(task.recent_created_file.task_id || ""),
      created_at: String(task.recent_created_file.created_at || ""),
      path: safePath(task.recent_created_file.path || ""),
      relative_path: safePath(task.recent_created_file.relative_path || ""),
      content_sha256: safeId(task.recent_created_file.content_sha256 || ""),
    }
    : null;
  return {
    schema: CODEX_GATEWAY_SCHEMA,
    task_id: safeId(task.task_id || ""),
    request_id: safeId(task.request_id || ""),
    marker: safeId(task.marker || ""),
    action: task.action || CODEX_DELEGATE_ACTION,
    project_name: safeLabel(task.project_name || task.project || "菲比 LINE 智能助理_03"),
    project_path: String(task.project_path || ""),
    original_user_text: String(task.original_user_text || task.instruction || ""),
    instruction: String(task.instruction || task.original_user_text || ""),
    approval: task.approval || null,
    created_at: String(task.created_at || ""),
    recent_created_file: recentCreatedFile?.path ? recentCreatedFile : null,
  };
}

export function createCodexPrompt(task = {}) {
  const normalized = normalizeGatewayTask(task);
  const lines = [
    "你正在處理菲比 LINE 智能助理_03 的 Codex delegated task。",
    "嚴格限制：只允許使用 project_path 內的檔案與 runtime；不得讀取舊專案、_02、舊 Dropbox、舊 secret store、舊 logs、舊 User ID；不得輸出 secret/raw User ID/full webhook payload。",
    `project_name: ${normalized.project_name}`,
    `project_path: ${normalized.project_path}`,
    `task_id: ${normalized.task_id}`,
    `request_id: ${normalized.request_id}`,
    "執行契約：優先執行 task_instruction；original_user_text 只作為使用者語意來源。若兩者不同，不得忽略 task_instruction 的具體檔名、內容、測試或安全邊界。",
    "不得把 delegated task 改寫成舊的 create_smoke_file 或 monitor smoke；除非 task_instruction 明確要求，不得自行新增 TEST_EVIDENCE 類文件。",
    "完成後用繁中簡短回報實際做了什麼、測試或讀取結果，以及是否有修改檔案。",
    "<task_instruction>",
    normalized.instruction,
    "</task_instruction>",
    "<original_user_text>",
    normalized.original_user_text,
    "</original_user_text>",
  ];
  if (normalized.recent_created_file?.path) {
    lines.push(
      "<recent_successful_created_file>",
      "使用者若要求讀取「剛才建立的檔案」或「剛才那個檔案」，只能讀取下列目標；不得改讀其他 runtime 舊檔。",
      `target_file_path: ${normalized.recent_created_file.path}`,
      `target_relative_path: ${normalized.recent_created_file.relative_path}`,
      `target_created_at: ${normalized.recent_created_file.created_at}`,
      `target_task_id: ${normalized.recent_created_file.task_id}`,
      `target_content_sha256: ${normalized.recent_created_file.content_sha256}`,
      "若此檔案不存在或不可讀，請回報失敗，不要猜測其他檔案。",
      "</recent_successful_created_file>",
    );
  }
  return lines.join("\n");
}

export function evaluateApprovalRequirement(task = {}) {
  const text = String(task.original_user_text || task.instruction || "");
  const highRisk = /(?:force push|reset --hard|rm -rf|刪除|覆蓋|部署|deploy|production|正式|付款|寄送|send email|OAuth|登入|密碼|secret|token)/i;
  const required = Boolean(task.approval_required || highRisk.test(text));
  return {
    required,
    reason: required ? "high_risk_action_requires_line_confirmation" : "",
    code: required ? approvalCodeForTask(task.task_id) : "",
  };
}

export function approvalCodeForTask(taskId = "") {
  const digest = createHash("sha256").update(String(taskId || "missing-task")).digest("hex");
  return `OK-${digest.slice(0, 6).toUpperCase()}`;
}

export function parseCodexJsonl(stdout = "") {
  const events = [];
  const toolEvents = [];
  const changedFiles = new Set();
  let resultText = "";
  let failureReason = "";
  let completed = false;
  let codexReceived = false;
  let codexExecution = false;
  const identity = {
    thread_id: "",
    turn_id: "",
    run_id: "",
  };

  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    events.push(redactCodexEvent(event));
    const type = String(event.type || event.event || "");
    if (type === "thread.started" || event.thread_id || event.threadId) {
      identity.thread_id ||= safeId(event.thread_id || event.threadId || event.thread?.id || "");
      codexReceived = true;
    }
    if (type === "turn.started" || event.turn_id || event.turnId) {
      identity.turn_id ||= safeId(event.turn_id || event.turnId || event.turn?.id || "");
      codexExecution = true;
    }
    if (event.run_id || event.runId) {
      identity.run_id ||= safeId(event.run_id || event.runId || "");
    }
    if (type === "turn.completed") completed = true;
    if (type === "turn.failed" || type === "error") {
      failureReason ||= safeId(event.reason || event.message || type);
    }
    if (type.startsWith("item.") || event.item) {
      const item = event.item || event;
      const itemType = String(item.type || event.item_type || "");
      if (/command|tool|mcp|web_search|file_change|patch/i.test(itemType)) {
        toolEvents.push({
          type: safeId(itemType || type),
          status: safeId(item.status || event.status || ""),
        });
      }
      collectChangedFiles(item, changedFiles);
      if (itemType === "message" || itemType === "agent_message") {
        resultText = String(item.text || item.content || item.message || resultText || "").slice(0, 2000);
      }
    }
    if (typeof event.last_message === "string") {
      resultText = event.last_message.slice(0, 2000);
    }
    collectChangedFiles(event, changedFiles);
  }

  return {
    events,
    completed,
    codex_received: codexReceived || events.length > 0,
    codex_execution: codexExecution || toolEvents.length > 0 || completed,
    tool_events: toolEvents.slice(0, 40),
    changed_files: [...changedFiles].slice(0, 40),
    result_text: resultText,
    failure_reason: failureReason,
    tests: inferTestResult(resultText, events),
    identity,
  };
}

export async function writeGatewayResultFile(task = {}, result = {}, projectRoot = "") {
  const root = projectRoot || task.project_path;
  const dir = join(root, DEFAULT_RESULT_DIR);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${safeId(task.task_id)}.json`);
  const record = {
    schema: CODEX_GATEWAY_SCHEMA,
    task_id: safeId(task.task_id),
    request_id: safeId(task.request_id),
    status: result.status || "",
    thread_id: safeId(result.thread_id || ""),
    turn_id: safeId(result.turn_id || ""),
    run_id: safeId(result.run_id || ""),
    codex_received: Boolean(result.codex_received),
    codex_execution: Boolean(result.codex_execution),
    tool_event_count: Number(result.tool_events?.length || 0),
    changed_files: (result.changed_files || []).map((file) => safePath(file)),
    summary: String(result.summary || "").slice(0, 500),
    updated_at: new Date().toISOString(),
  };
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { ok: true, path, relative_path: `${DEFAULT_RESULT_DIR}/${safeId(task.task_id)}.json` };
}

async function probeCommand(execFileImpl, command, args = [], contains = "") {
  try {
    const { stdout = "", stderr = "" } = await execFileImpl(command, args, {
      timeout: 8000,
      maxBuffer: 1024 * 1024,
    });
    const output = `${stdout}\n${stderr}`;
    return {
      available: contains ? output.includes(contains) : true,
      version: firstLine(output),
      reason: contains && !output.includes(contains) ? "expected_feature_not_listed" : "available",
    };
  } catch (error) {
    return {
      available: false,
      reason: error?.code === "ENOENT" ? "command_not_found" : "probe_failed",
    };
  }
}

function redactCodexEvent(event = {}) {
  const type = safeId(event.type || event.event || "event");
  return {
    type,
    thread_id: safeId(event.thread_id || event.threadId || event.thread?.id || ""),
    turn_id: safeId(event.turn_id || event.turnId || event.turn?.id || ""),
    run_id: safeId(event.run_id || event.runId || ""),
    item_type: safeId(event.item?.type || event.item_type || ""),
    status: safeId(event.status || event.item?.status || ""),
  };
}

function collectChangedFiles(value = {}, changedFiles) {
  const candidates = [
    value.path,
    value.file,
    value.file_path,
    value.filename,
    ...(Array.isArray(value.changed_files) ? value.changed_files : []),
  ];
  for (const candidate of candidates) {
    const safe = safePath(candidate);
    if (safe) changedFiles.add(safe);
  }
}

function inferTestResult(text = "", events = []) {
  const blob = `${text}\n${JSON.stringify(events)}`;
  if (/\bFAIL\b|failed|error/i.test(blob)) return "CHECK";
  if (/\bPASS\b|passed|completed/i.test(blob)) return "PASS";
  return "";
}

function summarizeResultText(text = "") {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 500) : "Codex task completed.";
}

function firstLine(output = "") {
  return String(output || "").split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 200) || "";
}

function safeId(value = "") {
  return String(value || "").replace(/[^A-Za-z0-9:_\-.]/g, "").slice(0, 160);
}

function safeLabel(value = "") {
  return String(value || "").replace(/[^\p{L}\p{N} _:\-.]/gu, "").slice(0, 120);
}

function safePath(value = "") {
  const text = String(value || "");
  if (!text || text.includes("..") || text.includes("\0")) return "";
  return text.replace(/[^A-Za-z0-9_./:\-\p{L}\p{N} ]/gu, "").slice(0, 220);
}
