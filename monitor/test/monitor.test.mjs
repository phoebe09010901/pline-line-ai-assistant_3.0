import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  DROPBOX_IDEA_DIR,
  CODEX_DELEGATE_ACTION,
  CODEX_LAST_CREATED_FILE_KEY,
  CRUD_ACTION,
  CRUD_TASK_PREFIX,
  FIXED_ACTION,
  IDEA_TASK_PREFIX,
  SAVE_IDEA_ACTION,
  SMOKE_FILE_CONTENT,
  SMOKE_FILE_PATH,
  TASK_PREFIX,
  codexResultRecord,
  claimOnce,
  createSyntheticIdeaTask,
  createSyntheticTask,
  drain,
  markCodexTaskCapabilityNotEnabled,
  health,
  normalizeTask,
  notifyCodexFinalizer,
  notifyIdeaFinalizer,
  runner,
  runTask,
  runCrudTask,
  saveIdeaJson,
  validateMemoJson,
  validateIdeaJson,
  writeRunnerHeartbeat,
} from "../src/monitor.js";
import { CodexExecHostAdapter, createCodexPrompt } from "../src/codex_gateway.js";

assert.equal(FIXED_ACTION, "create_smoke_file");
assert.equal(SAVE_IDEA_ACTION, "save_idea_json");
assert.equal(SMOKE_FILE_PATH, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt");
assert.equal(SMOKE_FILE_CONTENT, "Codex 任務測試成功");
assert.equal(DROPBOX_IDEA_DIR, "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03");

const blocked = await health({ CODEX_BIN: "/definitely/missing/codex", PATH: "" });
assert.equal(blocked.status, "blocked");
assert.equal(blocked.codex_bin.reason, "codex_executable_not_found_or_not_executable");

const fakeCodexDir = join(tmpdir(), `pline-v3-monitor-${Date.now()}`);
const fakeCodex = join(fakeCodexDir, "codex");
await mkdir(fakeCodexDir, { recursive: true });
await import("node:fs/promises").then(({ writeFile, chmod }) => writeFile(fakeCodex, "#!/bin/sh\nexit 0\n").then(() => chmod(fakeCodex, 0o755)));
const originalFetch = globalThis.fetch;

const ready = await health({ CODEX_BIN: fakeCodex, PATH: "" });
assert.equal(ready.status, "ready");
assert.equal(ready.codex_bin.path, fakeCodex);
assert.equal(ready.task_prefix, "codex_task:v1");
assert.deepEqual(ready.supported_actions, ["codex_delegate", "create_smoke_file", "save_idea_json", "crud_task"]);
assert.deepEqual(ready.pending_prefixes, ["codex_task:v1:pending:", "idea_json:v1:pending:", "crud_task:v1:pending:"]);

assert.deepEqual(normalizeTask({}), {
  task_id: "pline-v3-test-smoke",
  task_type: "codex_task",
  project: "PLine03 safe smoke",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke",
  instruction: "Create or overwrite the fixed smoke file with the fixed smoke content.",
  original_user_text: "",
  request_id: "",
  marker: "",
  action: "create_smoke_file",
  created_at: "",
  target_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke/codex_task_smoke_test.txt",
  target_dir: "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03",
  content: "Codex 任務測試成功",
  idea: null,
  finalize_token: "",
  final_reply_text: "",
  line_user_ref: "",
  approval: null,
  domain: "",
  operation: "",
  body_text: "",
  body: null,
  actor_fingerprint: "",
  line_event_key: "",
  confirmed: false,
  confirmation_id: "",
});

assert.equal((await runTask({ action: "other" }, { CODEX_BIN: fakeCodex, PATH: "" })).reason, "unsupported_action");
assert.equal((await runTask({
  action: "create_smoke_file",
  target_path: "/tmp/not-allowed",
}, { CODEX_BIN: fakeCodex, PATH: "" })).reason, "unsupported_target_path");
assert.deepEqual(codexResultRecord({ task_id: "failed-unit" }, { ok: false, reason: "unsupported_target_path" }), {
  task_id: "failed-unit",
  status: "failed",
  created_at: "",
  summary: "The safe smoke task did not complete.",
  tests: "FAIL",
  changed_files: [],
  commit: null,
  error: "unsupported_target_path",
});

await mkdir(dirname(SMOKE_FILE_PATH), { recursive: true });
const result = await runTask({ action: "create_smoke_file" }, { CODEX_BIN: fakeCodex, PATH: "" });
assert.equal(result.ok, true);
assert.equal(await readFile(SMOKE_FILE_PATH, "utf8"), "Codex 任務測試成功");
await access(SMOKE_FILE_PATH, constants.F_OK);

const delegateGatewayCalls = [];
const delegateResult = await runTask({
  action: CODEX_DELEGATE_ACTION,
  task_id: "delegate-unit",
  request_id: "pline-v3-delegate-unit",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  original_user_text: "請讀取 PROJECT_STATE.md 並回報第一行",
}, { CODEX_BIN: fakeCodex, PATH: "" }, {
  gateway: {
    async submit_task(task, options = {}) {
      delegateGatewayCalls.push(task);
      await options.onCodexStarted?.({
        task_id: task.task_id,
        request_id: task.request_id,
        thread_id: "thread-delegate-unit",
        turn_id: "turn-delegate-unit",
      });
      return {
        ok: true,
        status: "completed",
        thread_id: "thread-delegate-unit",
        turn_id: "turn-delegate-unit",
        codex_received: true,
        codex_execution: true,
        tool_events: [{ type: "command_execution", status: "completed" }],
        changed_files: [],
        tests: "PASS",
        summary: "PROJECT_STATE.md was read.",
      };
    },
  },
});
assert.equal(delegateResult.ok, true);
assert.equal(delegateResult.codex_execution, true);
assert.equal(delegateResult.thread_id, "thread-delegate-unit");
assert.equal(delegateResult.result_file, "runtime/codex-gateway/delegate-unit.json");
assert.equal(delegateGatewayCalls[0].original_user_text, "請讀取 PROJECT_STATE.md 並回報第一行");

const delegatePrompt = createCodexPrompt({
  task_id: "prompt-unit",
  request_id: "prompt-unit",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "建立 runtime/codex-gateway/prompt-unit.txt，內容為 PROMPT_UNIT_OK",
  original_user_text: "請 Codex 做測試",
});
assert.equal(delegatePrompt.includes("<task_instruction>\n建立 runtime/codex-gateway/prompt-unit.txt，內容為 PROMPT_UNIT_OK\n</task_instruction>"), true);
assert.equal(delegatePrompt.includes("不得把 delegated task 改寫成舊的 create_smoke_file"), true);
assert.equal(delegatePrompt.includes("<original_user_text>\n請 Codex 做測試\n</original_user_text>"), true);
const recentPrompt = createCodexPrompt({
  task_id: "prompt-recent-unit",
  request_id: "prompt-recent-unit",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請讀取剛才建立的檔案",
  original_user_text: "請讀取剛才建立的檔案",
  recent_created_file: {
    task_id: "codex-delegate-new",
    created_at: "2026-07-18T13:21:55.000Z",
    path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-gateway/codex-delegate-new.txt",
    relative_path: "runtime/codex-gateway/codex-delegate-new.txt",
    content_sha256: "a".repeat(64),
  },
});
assert.equal(recentPrompt.includes("<recent_successful_created_file>"), true);
assert.equal(recentPrompt.includes("target_file_path: /Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-gateway/codex-delegate-new.txt"), true);
assert.equal(recentPrompt.includes("不得改讀其他 runtime 舊檔"), true);

const fakeCodexJsonl = join(fakeCodexDir, "codex-jsonl");
await import("node:fs/promises").then(({ writeFile, chmod }) => writeFile(fakeCodexJsonl, [
  "#!/bin/sh",
  "printf '%s\\n' '{\"type\":\"thread.started\",\"thread_id\":\"thread-jsonl-unit\"}'",
  "printf '%s\\n' '{\"type\":\"turn.started\"}'",
  "printf '%s\\n' '{\"type\":\"item.completed\",\"item\":{\"type\":\"agent_message\",\"text\":\"CODEX JSONL PASS\"}}'",
  "printf '%s\\n' '{\"type\":\"turn.completed\"}'",
].join("\n")).then(() => chmod(fakeCodexJsonl, 0o755)));
const jsonlStartedEvents = [];
const jsonlAdapter = new CodexExecHostAdapter({ codexBin: fakeCodexJsonl });
const jsonlAdapterResult = await jsonlAdapter.submit_task({
  task_id: "jsonl-adapter-unit",
  request_id: "jsonl-adapter-unit",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  original_user_text: "請驗證 JSONL adapter",
}, {
  env: { PATH: "" },
  onCodexStarted: async (event) => jsonlStartedEvents.push(event),
});
assert.equal(jsonlAdapterResult.ok, true);
assert.equal(jsonlAdapterResult.thread_id, "thread-jsonl-unit");
assert.equal(jsonlAdapterResult.codex_execution, true);
assert.equal(jsonlStartedEvents.length, 1);
assert.equal(jsonlStartedEvents[0].thread_id, "thread-jsonl-unit");

const delegateClaimKv = createMemoryKv();
await delegateClaimKv.put(`${TASK_PREFIX}:task:delegate-claim-unit`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "delegate-claim-unit",
  task_type: "codex_task",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請讀取 PROJECT_STATE.md 並回報第一行",
  original_user_text: "請讀取 PROJECT_STATE.md 並回報第一行",
  request_id: "pline-v3-delegate-claim-unit",
  marker: "T3201-20260718010101",
  action: CODEX_DELEGATE_ACTION,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: "2026-07-18T16:30:00.000Z",
}));
await delegateClaimKv.put(`${TASK_PREFIX}:pending:delegate-claim-unit`, `${TASK_PREFIX}:task:delegate-claim-unit`);
const delegateClaim = await claimOnce({
  kv: delegateClaimKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" },
  gateway: {
    async submit_task() {
      return {
        ok: true,
        status: "completed",
        thread_id: "thread-claim-unit",
        turn_id: "turn-claim-unit",
        codex_received: true,
        codex_execution: true,
        tool_events: [{ type: "command_execution", status: "completed" }],
        changed_files: [],
        tests: "PASS",
        summary: "PROJECT_STATE.md first line was read.",
      };
    },
  },
});
assert.equal(delegateClaim.ok, true);
assert.equal(delegateClaim.claimed, true);
assert.equal(delegateClaim.status, "completed");
const delegateClaimRecord = JSON.parse(await delegateClaimKv.get(`${TASK_PREFIX}:task:delegate-claim-unit`));
assert.equal(delegateClaimRecord.status, "completed");
assert.equal(delegateClaimRecord.thread_id, "thread-claim-unit");
assert.equal(await delegateClaimKv.get(`${TASK_PREFIX}:pending:delegate-claim-unit`), "");
const duplicateDelegateClaim = await claimOnce({
  kv: delegateClaimKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" },
  gateway: { async submit_task() { throw new Error("should_not_run_twice"); } },
  legacyScan: false,
});
assert.equal(duplicateDelegateClaim.claimed, false);

const recentContextDir = "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-gateway";
await mkdir(recentContextDir, { recursive: true });
const oldRecentFile = join(recentContextDir, "codex-delegate-old-context.txt");
const newRecentFile = join(recentContextDir, "codex-delegate-new-context.txt");
await writeFile(oldRecentFile, "真正 Codex 執行成功 T3201-20260718210047", "utf8");
await writeFile(newRecentFile, "真正 Codex 執行成功 T3301-20260718211955", "utf8");
const recentContextKv = createMemoryKv();
await recentContextKv.put(`${TASK_PREFIX}:result:codex-delegate-old-context`, JSON.stringify({
  task_id: "codex-delegate-old-context",
  status: "completed",
  created_at: "2026-07-18T13:00:00.000Z",
  summary: "已完成。 在 `runtime/codex-gateway/codex-delegate-old-context.txt` 建立檔案，內容符合：`真正 Codex 執行成功 T3201-20260718210047`。",
  tests: "PASS",
  changed_files: [],
  commit: null,
  error: null,
}));
await recentContextKv.put(`${TASK_PREFIX}:result:codex-delegate-new-context`, JSON.stringify({
  task_id: "codex-delegate-new-context",
  status: "completed",
  created_at: "2026-07-18T13:21:55.000Z",
  summary: "已完成。 在 `runtime/codex-gateway/codex-delegate-new-context.txt` 建立檔案，內容符合：`真正 Codex 執行成功 T3301-20260718211955`。",
  tests: "PASS",
  changed_files: [],
  commit: null,
  error: null,
}));
await recentContextKv.put(`${TASK_PREFIX}:task:codex-read-recent-unit`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "codex-read-recent-unit",
  task_type: "codex_task",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請 Codex 讀取剛才建立的檔案，並告訴我內容。",
  original_user_text: "請 Codex 讀取剛才建立的檔案，並告訴我內容。",
  request_id: "pline-v3-read-recent-unit",
  marker: "T3302-20260718212430",
  action: CODEX_DELEGATE_ACTION,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: "2026-07-18T13:24:30.000Z",
}));
await recentContextKv.put(`${TASK_PREFIX}:pending:codex-read-recent-unit`, `${TASK_PREFIX}:task:codex-read-recent-unit`);
const recentGatewayCalls = [];
const recentClaim = await claimOnce({
  kv: recentContextKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" },
  gateway: {
    async submit_task(task, options = {}) {
      recentGatewayCalls.push(task);
      await options.onCodexStarted?.({
        task_id: task.task_id,
        request_id: task.request_id,
        thread_id: "thread-read-recent",
        turn_id: "turn-read-recent",
      });
      return {
        ok: true,
        status: "completed",
        thread_id: "thread-read-recent",
        turn_id: "turn-read-recent",
        codex_received: true,
        codex_execution: true,
        tool_events: [{ type: "command_execution", status: "completed" }],
        changed_files: [],
        tests: "PASS",
        summary: "已讀取檔案。內容是：```text\n真正 Codex 執行成功 T3301-20260718211955\n```",
      };
    },
  },
});
assert.equal(recentClaim.ok, true);
assert.equal(recentClaim.claimed, true);
assert.equal(recentGatewayCalls.length, 1);
assert.equal(recentGatewayCalls[0].recent_created_file.relative_path, "runtime/codex-gateway/codex-delegate-new-context.txt");
assert.equal(recentGatewayCalls[0].recent_created_file.task_id, "codex-delegate-new-context");
assert.notEqual(recentGatewayCalls[0].recent_created_file.relative_path, "runtime/codex-gateway/codex-delegate-old-context.txt");
const latestContextRecord = JSON.parse(await recentContextKv.get(CODEX_LAST_CREATED_FILE_KEY));
assert.equal(latestContextRecord.relative_path, "runtime/codex-gateway/codex-delegate-new-context.txt");
const readRecentResult = JSON.parse(await recentContextKv.get(`${TASK_PREFIX}:result:codex-read-recent-unit`));
assert.equal(readRecentResult.status, "completed");

const missingContextKv = createMemoryKv();
await missingContextKv.put(`${TASK_PREFIX}:task:codex-read-missing-context`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "codex-read-missing-context",
  task_type: "codex_task",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請 Codex 讀取剛才建立的檔案",
  original_user_text: "請 Codex 讀取剛才建立的檔案",
  request_id: "pline-v3-read-missing-context",
  marker: "T3302M-20260718212430",
  action: CODEX_DELEGATE_ACTION,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: "2026-07-18T13:25:30.000Z",
}));
await missingContextKv.put(`${TASK_PREFIX}:pending:codex-read-missing-context`, `${TASK_PREFIX}:task:codex-read-missing-context`);
let missingContextGatewayCalled = false;
const missingContextClaim = await claimOnce({
  kv: missingContextKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" },
  gateway: {
    async submit_task() {
      missingContextGatewayCalled = true;
      return { ok: true, status: "completed" };
    },
  },
});
assert.equal(missingContextClaim.ok, false);
assert.equal(missingContextClaim.reason, "last_created_file_context_not_found");
assert.equal(missingContextGatewayCalled, false);
const missingContextTask = JSON.parse(await missingContextKv.get(`${TASK_PREFIX}:task:codex-read-missing-context`));
assert.equal(missingContextTask.status, "failed");

const invalidContextKv = createMemoryKv();
await invalidContextKv.put(CODEX_LAST_CREATED_FILE_KEY, JSON.stringify({
  task_id: "codex-invalid-context",
  created_at: "2026-07-18T13:26:30.000Z",
  path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-gateway/not-a-text-file.md",
  relative_path: "runtime/codex-gateway/not-a-text-file.md",
  content_sha256: "not-a-valid-hash",
}));
await invalidContextKv.put(`${TASK_PREFIX}:task:codex-read-invalid-context`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "codex-read-invalid-context",
  task_type: "codex_task",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請 Codex 讀取剛才建立的檔案",
  original_user_text: "請 Codex 讀取剛才建立的檔案",
  request_id: "pline-v3-read-invalid-context",
  marker: "T3302I-20260718212430",
  action: CODEX_DELEGATE_ACTION,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: "2026-07-18T13:26:30.000Z",
}));
await invalidContextKv.put(`${TASK_PREFIX}:pending:codex-read-invalid-context`, `${TASK_PREFIX}:task:codex-read-invalid-context`);
let invalidContextGatewayCalled = false;
const invalidContextClaim = await claimOnce({
  kv: invalidContextKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" },
  gateway: {
    async submit_task() {
      invalidContextGatewayCalled = true;
      return { ok: true, status: "completed" };
    },
  },
});
assert.equal(invalidContextClaim.ok, false);
assert.equal(invalidContextClaim.reason, "last_created_file_context_invalid");
assert.equal(invalidContextGatewayCalled, false);

const delegateProcessingKv = createMemoryKv();
await delegateProcessingKv.put(`${TASK_PREFIX}:task:delegate-processing-unit`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "delegate-processing-unit",
  task_type: "codex_task",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請讀取 PROJECT_STATE.md 並回報第一行",
  original_user_text: "請讀取 PROJECT_STATE.md 並回報第一行",
  request_id: "pline-v3-delegate-processing-unit",
  marker: "T3203-20260718010103",
  action: CODEX_DELEGATE_ACTION,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: "2026-07-18T16:32:00.000Z",
}));
await delegateProcessingKv.put(`${TASK_PREFIX}:pending:delegate-processing-unit`, `${TASK_PREFIX}:task:delegate-processing-unit`);
const delegateProcessingFinalizeCalls = [];
globalThis.fetch = async (url, options) => {
  delegateProcessingFinalizeCalls.push({ url, options });
  return new Response(JSON.stringify({ status: "completed", pushed: true }), { status: 200 });
};
const delegateProcessingClaim = await claimOnce({
  kv: delegateProcessingKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", WORKER_BASE_URL: "https://worker.example.test" },
  gateway: {
    async submit_task(task, options = {}) {
      await options.onCodexStarted?.({ task_id: task.task_id, request_id: task.request_id });
      return {
        ok: true,
        status: "completed",
        thread_id: "thread-processing-unit",
        codex_received: true,
        codex_execution: true,
        changed_files: [],
        tests: "PASS",
        summary: "PROJECT_STATE.md first line was read.",
      };
    },
  },
});
assert.equal(delegateProcessingClaim.ok, true);
assert.deepEqual(delegateProcessingFinalizeCalls.map((call) => JSON.parse(call.options.body).status), ["processing", "completed"]);
const delegateProcessingEvidenceKeys = await delegateProcessingKv.list("evidence:v1:request:pline-v3-delegate-processing-unit:stage:");
assert.equal(delegateProcessingEvidenceKeys.some((key) => key.name.endsWith(":codex_task_processing_callback_completed")), true);
globalThis.fetch = originalFetch;

const approvalResult = await runTask({
  action: CODEX_DELEGATE_ACTION,
  task_id: "delegate-approval-unit",
  request_id: "pline-v3-delegate-approval-unit",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  original_user_text: "請部署到 production",
}, { CODEX_BIN: fakeCodex, PATH: "" }, {
  gateway: {
    async submit_task() {
      return {
        ok: true,
        status: "awaiting_approval",
        approval_code: "OK-ABC123",
        approval_reason: "high_risk_action_requires_line_confirmation",
      };
    },
  },
});
assert.equal(approvalResult.ok, true);
assert.equal(approvalResult.status, "awaiting_approval");
assert.equal(approvalResult.approval_code, "OK-ABC123");

const approvalKv = createMemoryKv();
await approvalKv.put(`${TASK_PREFIX}:task:delegate-approval-claim`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "delegate-approval-claim",
  task_type: "codex_task",
  project: "菲比 LINE 智能助理_03",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03",
  instruction: "請部署到 production",
  original_user_text: "請部署到 production",
  request_id: "pline-v3-delegate-approval-claim",
  marker: "T3202-20260718010102",
  action: CODEX_DELEGATE_ACTION,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: "2026-07-18T16:31:00.000Z",
}));
await approvalKv.put(`${TASK_PREFIX}:pending:delegate-approval-claim`, `${TASK_PREFIX}:task:delegate-approval-claim`);
const approvalClaim = await claimOnce({
  kv: approvalKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" },
  gateway: {
    async submit_task() {
      return {
        ok: true,
        status: "awaiting_approval",
        approval_code: "OK-ABC123",
        approval_reason: "high_risk_action_requires_line_confirmation",
      };
    },
  },
});
assert.equal(approvalClaim.ok, true);
assert.equal(approvalClaim.status, "awaiting_approval");
assert.equal(await approvalKv.get(`${TASK_PREFIX}:approval:OK-ABC123`), `${TASK_PREFIX}:task:delegate-approval-claim`);
const approvalTaskRecord = JSON.parse(await approvalKv.get(`${TASK_PREFIX}:task:delegate-approval-claim`));
assert.equal(approvalTaskRecord.status, "awaiting_approval");

const taskKv = createMemoryKv();
const codexCreatedAt = "2026-07-18T11:31:00.000Z";
const synthetic = await createSyntheticTask({
  task_id: "pline-v3-monitor-unit-task",
  request_id: "pline-v3-monitor-unit-request",
  marker: "T1701-20260718010101",
  created_at: codexCreatedAt,
}, { kv: taskKv });
assert.equal(synthetic.ok, true);
assert.equal((await taskKv.list(`${TASK_PREFIX}:task:`)).length, 1);
const queuedTask = JSON.parse(await taskKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-unit-task`));
assert.equal(queuedTask.status, "queued");
assert.equal(queuedTask.created_at, codexCreatedAt);

const claimed = await claimOnce({ kv: taskKv, env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" } });
assert.equal(claimed.ok, true);
assert.equal(claimed.claimed, true);
assert.equal(claimed.task_id, "pline-v3-monitor-unit-task");
assert.equal(claimed.request_id, "pline-v3-monitor-unit-request");
assert.equal(claimed.codex_execution, true);
assert.equal(claimed.file_written, true);
assert.equal(await readFile(SMOKE_FILE_PATH, "utf8"), "Codex 任務測試成功");
const completedTask = JSON.parse(await taskKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-unit-task`));
assert.equal(completedTask.status, "completed");
assert.equal(completedTask.created_at, codexCreatedAt);
assert.equal(completedTask.codex_execution, true);
assert.equal(completedTask.file_written, true);
assert.equal(await taskKv.get(`${TASK_PREFIX}:pending:pline-v3-monitor-unit-task`), "");
const completedResult = JSON.parse(await taskKv.get(`${TASK_PREFIX}:result:pline-v3-monitor-unit-task`));
assert.deepEqual(completedResult, {
  task_id: "pline-v3-monitor-unit-task",
  status: "completed",
  created_at: codexCreatedAt,
  summary: "Fixed smoke file was created and verified.",
  tests: "PASS",
  changed_files: ["runtime/codex-task-smoke/codex_task_smoke_test.txt"],
  commit: null,
  error: null,
});
assert.equal(await taskKv.get("evidence:v1:marker:T1701-20260718010101"), "pline-v3-monitor-unit-request");
const evidenceKeys = await taskKv.list("evidence:v1:request:pline-v3-monitor-unit-request:stage:");
assert.deepEqual(evidenceKeys.map((key) => key.name).sort(), [
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:codex_execution_completed",
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:codex_task_final_callback_completed",
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:codex_task_result_recorded",
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:monitor_claimed",
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:smoke_file_written",
]);

const failedTaskKv = createMemoryKv();
const failedCreatedAt = "2026-07-18T11:32:00.000Z";
await failedTaskKv.put(`${TASK_PREFIX}:task:pline-v3-monitor-failed-task`, JSON.stringify({
  schema: "pline-v3-test-codex-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: "pline-v3-monitor-failed-task",
  task_type: "codex_task",
  project: "PLine03 safe smoke",
  project_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/runtime/codex-task-smoke",
  instruction: "Create or overwrite the fixed smoke file with the fixed smoke content.",
  request_id: "pline-v3-monitor-failed-request",
  marker: "T1701F-20260718010101",
  action: FIXED_ACTION,
  target_path: "/tmp/not-allowed",
  content: "Codex 任務測試成功",
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  created_at: failedCreatedAt,
}));
const failedClaim = await claimOnce({ kv: failedTaskKv, env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" } });
assert.equal(failedClaim.ok, false);
assert.equal(failedClaim.reason, "unsupported_target_path");
const failedTask = JSON.parse(await failedTaskKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-failed-task`));
assert.equal(failedTask.status, "failed");
assert.equal(failedTask.created_at, failedCreatedAt);
const failedResult = JSON.parse(await failedTaskKv.get(`${TASK_PREFIX}:result:pline-v3-monitor-failed-task`));
assert.deepEqual(failedResult, {
  task_id: "pline-v3-monitor-failed-task",
  status: "failed",
  created_at: failedCreatedAt,
  summary: "The safe smoke task did not complete.",
  tests: "FAIL",
  changed_files: [],
  commit: null,
  error: "unsupported_target_path",
});

const drainKv = createMemoryKv();
await createSyntheticTask({
  task_id: "pline-v3-monitor-drain-task-1",
  request_id: "pline-v3-monitor-drain-request-1",
  marker: "T1701D-20260718010101",
  created_at: "2026-07-18T11:33:00.000Z",
}, { kv: drainKv });
await createSyntheticTask({
  task_id: "pline-v3-monitor-drain-task-2",
  request_id: "pline-v3-monitor-drain-request-2",
  marker: "T1701E-20260718010101",
  created_at: "2026-07-18T11:34:00.000Z",
}, { kv: drainKv });
const drainResult = await drain({ kv: drainKv, env: { CODEX_BIN: fakeCodex, PATH: "", CODEX_FINALIZE_DISABLED: "1" }, iterations: 5, intervalMs: 0 });
assert.equal(drainResult.ok, true);
assert.equal(drainResult.drained, 2);
assert.equal(drainResult.reason, "drain_complete");
assert.equal(JSON.parse(await drainKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-drain-task-1`)).status, "completed");
assert.equal(JSON.parse(await drainKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-drain-task-2`)).status, "completed");

const capabilityKv = createMemoryKv();
await createSyntheticTask({
  task_id: "pline-v3-monitor-capability-task",
  request_id: "pline-v3-monitor-capability-request",
  marker: "T1701C-20260718010101",
  created_at: "2026-07-18T11:35:00.000Z",
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
}, { kv: capabilityKv });
const capabilityFinalizeCalls = [];
globalThis.fetch = async (url, options) => {
  capabilityFinalizeCalls.push({ url, options });
  return new Response(JSON.stringify({ status: "failure_notice_completed", pushed: true }), { status: 200 });
};
const capabilityResult = await markCodexTaskCapabilityNotEnabled("pline-v3-monitor-capability-task", {
  kv: capabilityKv,
  env: { WORKER_BASE_URL: "https://worker.example.test" },
});
assert.equal(capabilityResult.ok, true);
assert.equal(capabilityResult.status, "failed");
assert.equal(capabilityResult.reason, "capability_not_yet_enabled");
assert.equal(capabilityFinalizeCalls.length, 1);
assert.deepEqual(JSON.parse(capabilityFinalizeCalls[0].options.body), {
  task_id: "pline-v3-monitor-capability-task",
  request_id: "pline-v3-monitor-capability-request",
  action: FIXED_ACTION,
  status: "failed",
  reason: "capability_not_yet_enabled",
  finalize_token: "test-finalize-token",
});
globalThis.fetch = originalFetch;
const capabilityTask = JSON.parse(await capabilityKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-capability-task`));
assert.equal(capabilityTask.status, "failed");
assert.equal(capabilityTask.created_at, "2026-07-18T11:35:00.000Z");
const capabilityResultRecord = JSON.parse(await capabilityKv.get(`${TASK_PREFIX}:result:pline-v3-monitor-capability-task`));
assert.equal(capabilityResultRecord.status, "failed");
assert.equal(capabilityResultRecord.error, "capability_not_yet_enabled");
const capabilityEvidenceKeys = await capabilityKv.list("evidence:v1:request:pline-v3-monitor-capability-request:stage:");
assert.equal(capabilityEvidenceKeys.some((key) => key.name.endsWith(":codex_task_capability_not_enabled")), true);

const uniqueSuffix = String(Date.now()).slice(-10);
const idea = {
  schema_version: "1.0",
  idea_id: `idea-${uniqueSuffix}`,
  content: "這是一筆 _03 測試想法",
  created_at: "2026-07-18T08:00:01+08:00",
  source: "line",
  actor_fingerprint: "a".repeat(64),
  line_event_key: "b".repeat(64),
  intent: "idea_create",
  status: "saved",
};
assert.equal(validateIdeaJson(idea).ok, true);
assert.equal(validateIdeaJson({ ...idea, raw_user_id: "U_SHOULD_NOT_STORE" }).reason, "invalid_idea_json_schema_keys");
assert.equal((await saveIdeaJson({
  action: SAVE_IDEA_ACTION,
  target_dir: `${DROPBOX_IDEA_DIR}/not-allowed`,
  idea,
}, { CODEX_BIN: fakeCodex, PATH: "" })).reason, "unsupported_target_dir");

const savedIdea = await saveIdeaJson({
  action: SAVE_IDEA_ACTION,
  target_dir: DROPBOX_IDEA_DIR,
  idea,
}, { CODEX_BIN: fakeCodex, PATH: "" });
assert.equal(savedIdea.ok, true);
assert.equal(savedIdea.action, SAVE_IDEA_ACTION);
assert.equal(savedIdea.file_name.includes("這是一筆"), false);
assert.equal(savedIdea.file_name.endsWith(".json"), true);
const ideaJsonPath = join(DROPBOX_IDEA_DIR, savedIdea.file_name);
const savedIdeaJson = await readFile(ideaJsonPath, "utf8");
assert.equal(savedIdeaJson.includes("U_SHOULD_NOT_STORE"), false);
assert.deepEqual(JSON.parse(savedIdeaJson), idea);

const duplicateIdea = await saveIdeaJson({
  action: SAVE_IDEA_ACTION,
  target_dir: DROPBOX_IDEA_DIR,
  idea,
}, { CODEX_BIN: fakeCodex, PATH: "" });
assert.equal(duplicateIdea.ok, true);
assert.equal(duplicateIdea.status, "duplicate");
assert.equal(duplicateIdea.file_name, savedIdea.file_name);

const memoContent = `備忘錄 CRUD unit ${uniqueSuffix}`;
const memoResult = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_create",
  body: { content: memoContent },
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"d".repeat(54)}${uniqueSuffix}`,
  task_id: `memo-unit-${uniqueSuffix}`,
  request_id: `pline-v3-memo-unit-${uniqueSuffix}`,
});
assert.equal(memoResult.ok, true);
assert.equal(memoResult.status, "completed");
assert.equal(memoResult.file_name.startsWith("memo-"), true);
const memoJson = JSON.parse(await readFile(join(DROPBOX_IDEA_DIR, memoResult.file_name), "utf8"));
assert.equal(validateMemoJson(memoJson).ok, true);
assert.equal(JSON.stringify(memoJson).includes("U_SHOULD_NOT_STORE"), false);
const memoSearchResult = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_search",
  body: { query: memoContent },
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"e".repeat(54)}${uniqueSuffix}`,
  task_id: `memo-search-${uniqueSuffix}`,
  request_id: `pline-v3-memo-search-${uniqueSuffix}`,
});
assert.equal(memoSearchResult.ok, true);
assert.equal(memoSearchResult.status, "completed");
assert.equal(memoSearchResult.reply_text.includes(memoContent), true);

const prefixedMemoContent = `M3501 normalized memo ${uniqueSuffix}`;
const prefixedMemoResult = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_create",
  body: { content: `新增：${prefixedMemoContent}` },
  body_text: `新增：${prefixedMemoContent}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}1${uniqueSuffix}`,
  task_id: `memo-prefixed-${uniqueSuffix}`,
  request_id: `pline-v3-memo-prefixed-${uniqueSuffix}`,
});
assert.equal(prefixedMemoResult.ok, true);
assert.equal(prefixedMemoResult.status, "completed");
const prefixedMemoJson = JSON.parse(await readFile(join(DROPBOX_IDEA_DIR, prefixedMemoResult.file_name), "utf8"));
assert.equal(prefixedMemoJson.content, prefixedMemoContent);
assert.equal(prefixedMemoJson.content.includes("新增"), false);
const prefixedMemoSearch = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_search",
  body: {},
  body_text: `搜尋 ${prefixedMemoContent}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}2${uniqueSuffix}`,
  task_id: `memo-prefixed-search-${uniqueSuffix}`,
  request_id: `pline-v3-memo-prefixed-search-${uniqueSuffix}`,
});
assert.equal(prefixedMemoSearch.ok, true);
assert.equal(prefixedMemoSearch.status, "completed");
assert.equal(prefixedMemoSearch.reply_text.includes(prefixedMemoContent), true);

const updatedMemoContent = `M3501 updated memo ${uniqueSuffix}`;
const updateMemoResult = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_update",
  body: {},
  body_text: `把「${prefixedMemoContent}」改成「${updatedMemoContent}」`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}3${uniqueSuffix}`,
  task_id: `memo-update-${uniqueSuffix}`,
  request_id: `pline-v3-memo-update-${uniqueSuffix}`,
});
assert.equal(updateMemoResult.ok, true);
assert.equal(updateMemoResult.status, "completed");
assert.equal(updateMemoResult.reply_text, "備忘錄已更新好了。");
const updatedMemoJson = JSON.parse(await readFile(join(DROPBOX_IDEA_DIR, prefixedMemoResult.file_name), "utf8"));
assert.equal(updatedMemoJson.content, updatedMemoContent);
assert.equal(JSON.stringify(updatedMemoJson).includes("U_SHOULD_NOT_STORE"), false);

const naturalUpdateOriginal = `M4001-${uniqueSuffix} 我今天要喝 1500cc 的水`;
const naturalUpdateContent = `我今天要喝 1800cc 的水 ${uniqueSuffix}`;
const naturalUpdateCreate = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_create",
  body: { content: naturalUpdateOriginal },
  body_text: `新增：${naturalUpdateOriginal}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}6${uniqueSuffix}`,
  task_id: `memo-natural-update-create-${uniqueSuffix}`,
  request_id: `pline-v3-memo-natural-update-create-${uniqueSuffix}`,
});
assert.equal(naturalUpdateCreate.ok, true);
assert.equal(naturalUpdateCreate.status, "completed");
const naturalUpdateResult = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_update",
  body: {},
  body_text: `把 M4001-${uniqueSuffix} 的內容改成 ${naturalUpdateContent}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}7${uniqueSuffix}`,
  task_id: `memo-natural-update-${uniqueSuffix}`,
  request_id: `pline-v3-memo-natural-update-${uniqueSuffix}`,
});
assert.equal(naturalUpdateResult.ok, true);
assert.equal(naturalUpdateResult.status, "completed");
assert.equal(naturalUpdateResult.reply_text, "備忘錄已更新好了。");
const naturalUpdateJson = JSON.parse(await readFile(join(DROPBOX_IDEA_DIR, naturalUpdateCreate.file_name), "utf8"));
assert.equal(naturalUpdateJson.content, naturalUpdateContent);
assert.equal(naturalUpdateJson.content.includes("把"), false);
assert.equal(naturalUpdateJson.content.includes("的內容改成"), false);
assert.equal(naturalUpdateJson.search_keys.includes(`M4001-${uniqueSuffix}`), true);
const naturalUpdateSearch = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_search",
  body: {},
  body_text: `搜尋 M4001-${uniqueSuffix}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}8${uniqueSuffix}`,
  task_id: `memo-natural-update-search-${uniqueSuffix}`,
  request_id: `pline-v3-memo-natural-update-search-${uniqueSuffix}`,
});
assert.equal(naturalUpdateSearch.ok, true);
assert.equal(naturalUpdateSearch.status, "completed");
assert.equal(naturalUpdateSearch.reply_text.includes("1800cc"), true);
assert.equal(naturalUpdateSearch.reply_text.includes("1500cc"), false);
assert.equal(naturalUpdateSearch.reply_text.includes("新增："), false);

const deleteConfirmKv = createMemoryKv();
const deleteConfirm = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_delete",
  body: {},
  body_text: `刪除 ${updatedMemoContent}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}5${uniqueSuffix}`,
  task_id: `memo-delete-confirm-${uniqueSuffix}`,
  request_id: `pline-v3-memo-delete-confirm-${uniqueSuffix}`,
}, {}, { kv: deleteConfirmKv });
assert.equal(deleteConfirm.ok, true);
assert.equal(deleteConfirm.status, "needs_confirmation");
assert.equal(deleteConfirm.reply_text.includes("要刪除"), true);
assert.equal(deleteConfirm.reply_text.includes("確認"), true);
assert.match(deleteConfirm.confirmation_id, /^confirm-[a-f0-9]{16}$/);
const confirmationRecord = JSON.parse(await deleteConfirmKv.get(`${CRUD_TASK_PREFIX}:confirmation:${deleteConfirm.confirmation_id}`));
assert.equal(confirmationRecord.actor_fingerprint, "a".repeat(64));
assert.equal(confirmationRecord.status, "pending");
assert.equal(confirmationRecord.operation, "memo_delete");
assert.equal(JSON.stringify(confirmationRecord).includes("U_SHOULD_NOT_STORE"), false);
assert.equal(JSON.stringify(confirmationRecord).includes("/Users/"), false);
assert.equal(JSON.stringify(confirmationRecord).includes("Dropbox"), false);
assert.equal(await deleteConfirmKv.get(`${CRUD_TASK_PREFIX}:confirmation_actor:${"a".repeat(64)}`), deleteConfirm.confirmation_id);

const noMatchUpdate = await runCrudTask({
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_update",
  body: {},
  body_text: `把「M3501 not found ${uniqueSuffix}」改成「不應該寫入」`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(53)}4${uniqueSuffix}`,
  task_id: `memo-update-no-match-${uniqueSuffix}`,
  request_id: `pline-v3-memo-update-no-match-${uniqueSuffix}`,
});
assert.equal(noMatchUpdate.ok, true);
assert.equal(noMatchUpdate.status, "needs_clarification");
assert.equal(noMatchUpdate.reason, "memo_target_not_found");

const calendarResult = await runCrudTask({
  action: CRUD_ACTION,
  domain: "calendar",
  operation: "calendar_create",
  body: { title: `Calendar CRUD unit ${uniqueSuffix}`, start: "2026-07-18T18:00:00+08:00", end: "2026-07-18T18:30:00+08:00" },
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"f".repeat(54)}${uniqueSuffix}`,
  task_id: `calendar-unit-${uniqueSuffix}`,
  request_id: `pline-v3-calendar-unit-${uniqueSuffix}`,
});
assert.equal(calendarResult.ok, true);
assert.equal(calendarResult.status, "completed");
const calendarSearch = await runCrudTask({
  action: CRUD_ACTION,
  domain: "calendar",
  operation: "calendar_search",
  body: { query: `Calendar CRUD unit ${uniqueSuffix}` },
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"f".repeat(54)}${uniqueSuffix}`,
  task_id: `calendar-search-${uniqueSuffix}`,
  request_id: `pline-v3-calendar-search-${uniqueSuffix}`,
});
assert.equal(calendarSearch.ok, true);
assert.equal(calendarSearch.reply_text.includes(`Calendar CRUD unit ${uniqueSuffix}`), true);

const crudKv = createMemoryKv();
await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-queue-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-crud-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `memo-queue-${uniqueSuffix}`,
  task_type: "crud_task",
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_create",
  body: { content: `queued memo ${uniqueSuffix}` },
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"a".repeat(54)}${uniqueSuffix}`,
  request_id: `pline-v3-memo-queue-${uniqueSuffix}`,
  marker: "T4002-20260718010102",
  finalize_token: "test-finalize-token",
  created_at: "2026-07-18T08:00:01.000Z",
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-queue-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-queue-${uniqueSuffix}`);
const claimedCrud = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(claimedCrud.ok, true);
assert.equal(claimedCrud.claimed, true);
assert.equal(claimedCrud.action, CRUD_ACTION);
const completedCrudTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-queue-${uniqueSuffix}`));
assert.equal(completedCrudTask.status, "completed");
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-queue-${uniqueSuffix}`), "");

await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-search-queue-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-crud-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `memo-search-queue-${uniqueSuffix}`,
  task_type: "crud_task",
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_search",
  body: { search_query: `搜尋 ${memoContent}` },
  body_text: `搜尋 ${memoContent}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"b".repeat(54)}${uniqueSuffix}`,
  request_id: `pline-v3-memo-search-queue-${uniqueSuffix}`,
  marker: "T4004-20260719010101",
  finalize_token: "test-finalize-token",
  created_at: "2026-07-19T08:00:01.000Z",
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-search-queue-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-search-queue-${uniqueSuffix}`);
const claimedCrudSearch = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(claimedCrudSearch.ok, true);
assert.equal(claimedCrudSearch.claimed, true);
assert.equal(claimedCrudSearch.action, CRUD_ACTION);
const completedCrudSearchTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-search-queue-${uniqueSuffix}`));
assert.equal(completedCrudSearchTask.status, "completed");
assert.equal(completedCrudSearchTask.final_reply_text.includes(memoContent), true);
assert.equal(JSON.stringify(completedCrudSearchTask).includes("Codex 任務測試成功"), false);
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-search-queue-${uniqueSuffix}`), "");

await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-update-queue-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-crud-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `memo-update-queue-${uniqueSuffix}`,
  task_type: "crud_task",
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_update",
  body: {},
  body_text: `把「${updatedMemoContent}」改成「M3501 queue updated memo ${uniqueSuffix}」`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"b".repeat(53)}3${uniqueSuffix}`,
  request_id: `pline-v3-memo-update-queue-${uniqueSuffix}`,
  marker: "T4008-20260719010101",
  finalize_token: "test-finalize-token",
  created_at: "2026-07-19T08:00:03.000Z",
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-update-queue-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-update-queue-${uniqueSuffix}`);
const claimedCrudUpdate = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(claimedCrudUpdate.ok, true);
assert.equal(claimedCrudUpdate.claimed, true);
const completedCrudUpdateTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-update-queue-${uniqueSuffix}`));
assert.equal(completedCrudUpdateTask.status, "completed");
assert.equal(completedCrudUpdateTask.final_reply_text, "備忘錄已更新好了。");
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-update-queue-${uniqueSuffix}`), "");

await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-delete-queue-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-crud-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `memo-delete-queue-${uniqueSuffix}`,
  task_type: "crud_task",
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_delete",
  body: {},
  body_text: `刪除 M3501 queue updated memo ${uniqueSuffix}`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"b".repeat(53)}5${uniqueSuffix}`,
  request_id: `pline-v3-memo-delete-queue-${uniqueSuffix}`,
  marker: "T4011-20260719010101",
  finalize_token: "test-finalize-token",
  created_at: "2026-07-19T08:00:05.000Z",
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-delete-queue-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-delete-queue-${uniqueSuffix}`);
const claimedCrudDelete = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(claimedCrudDelete.ok, true);
assert.equal(claimedCrudDelete.claimed, true);
const deleteTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-delete-queue-${uniqueSuffix}`));
assert.equal(deleteTask.status, "needs_confirmation");
assert.equal(deleteTask.final_reply_text.includes("要刪除"), true);
assert.equal(deleteTask.final_reply_text.includes("確認"), true);
assert.match(deleteTask.confirmation_id, /^confirm-[a-f0-9]{16}$/);
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-delete-queue-${uniqueSuffix}`), "");
const queuedConfirmation = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:confirmation:${deleteTask.confirmation_id}`));
assert.equal(queuedConfirmation.actor_fingerprint, "a".repeat(64));
assert.equal(queuedConfirmation.operation, "memo_delete");
assert.equal(JSON.stringify(queuedConfirmation).includes("/Users/"), false);

await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-delete-queue-${uniqueSuffix}`, JSON.stringify({
  ...deleteTask,
  status: "queued",
  confirmed: true,
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-delete-queue-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-delete-queue-${uniqueSuffix}`);
const confirmedCrudDelete = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(confirmedCrudDelete.ok, true);
assert.equal(confirmedCrudDelete.claimed, true);
const completedDeleteTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-delete-queue-${uniqueSuffix}`));
assert.equal(completedDeleteTask.status, "completed");
assert.equal(completedDeleteTask.final_reply_text, "備忘錄已刪除了。");
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-delete-queue-${uniqueSuffix}`), "");
await assert.rejects(() => access(join(DROPBOX_IDEA_DIR, completedDeleteTask.file_name), constants.F_OK));

await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-update-no-match-queue-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-crud-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `memo-update-no-match-queue-${uniqueSuffix}`,
  task_type: "crud_task",
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_update",
  body: {},
  body_text: `把「M3501 missing queued ${uniqueSuffix}」改成「不應該寫入」`,
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"b".repeat(53)}4${uniqueSuffix}`,
  request_id: `pline-v3-memo-update-no-match-queue-${uniqueSuffix}`,
  marker: "T4009-20260719010101",
  finalize_token: "test-finalize-token",
  created_at: "2026-07-19T08:00:04.000Z",
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-update-no-match-queue-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-update-no-match-queue-${uniqueSuffix}`);
const claimedCrudUpdateNoMatch = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(claimedCrudUpdateNoMatch.ok, true);
assert.equal(claimedCrudUpdateNoMatch.claimed, true);
const noMatchUpdateTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-update-no-match-queue-${uniqueSuffix}`));
assert.equal(noMatchUpdateTask.status, "needs_clarification");
assert.equal(noMatchUpdateTask.final_reply_text, "沒有找到明確符合的備忘錄，請再描述一下。");
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-update-no-match-queue-${uniqueSuffix}`), "");

await crudKv.put(`${CRUD_TASK_PREFIX}:task:memo-search-empty-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-crud-task/v1",
  status: "queued",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `memo-search-empty-${uniqueSuffix}`,
  task_type: "crud_task",
  action: CRUD_ACTION,
  domain: "memo",
  operation: "memo_search",
  body: {},
  body_text: "",
  actor_fingerprint: "a".repeat(64),
  line_event_key: `${"c".repeat(54)}${uniqueSuffix}`,
  request_id: `pline-v3-memo-search-empty-${uniqueSuffix}`,
  marker: "T4005-20260719010101",
  finalize_token: "test-finalize-token",
  created_at: "2026-07-19T08:00:02.000Z",
}));
await crudKv.put(`${CRUD_TASK_PREFIX}:pending:memo-search-empty-${uniqueSuffix}`, `${CRUD_TASK_PREFIX}:task:memo-search-empty-${uniqueSuffix}`);
const claimedCrudEmptySearch = await claimOnce({ kv: crudKv, env: { CODEX_BIN: fakeCodex, PATH: "", CRUD_FINALIZE_DISABLED: "1" } });
assert.equal(claimedCrudEmptySearch.ok, true);
assert.equal(claimedCrudEmptySearch.claimed, true);
const emptySearchTask = JSON.parse(await crudKv.get(`${CRUD_TASK_PREFIX}:task:memo-search-empty-${uniqueSuffix}`));
assert.equal(emptySearchTask.status, "needs_clarification");
assert.equal(emptySearchTask.final_reply_text, "請再補充一下要處理哪一筆備忘錄。");
assert.equal(await crudKv.get(`${CRUD_TASK_PREFIX}:pending:memo-search-empty-${uniqueSuffix}`), "");

const ideaKv = createMemoryKv();
const syntheticIdea = await createSyntheticIdeaTask({
  task_id: `idea-unit-${uniqueSuffix}`,
  request_id: `pline-v3-idea-unit-${uniqueSuffix}`,
  marker: "T1702-20260718010102",
  idea,
}, { kv: ideaKv });
assert.equal(syntheticIdea.ok, true);
assert.equal((await ideaKv.list(`${IDEA_TASK_PREFIX}:task:`)).length, 1);
const claimedIdea = await claimOnce({ kv: ideaKv, env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" } });
assert.equal(claimedIdea.ok, true);
assert.equal(claimedIdea.claimed, true);
assert.equal(claimedIdea.action, SAVE_IDEA_ACTION);
assert.equal(claimedIdea.file_written, true);
const completedIdeaTask = JSON.parse(await ideaKv.get(`${IDEA_TASK_PREFIX}:task:idea-unit-${uniqueSuffix}`));
assert.equal(["completed", "duplicate"].includes(completedIdeaTask.status), true);
assert.equal(await ideaKv.get("evidence:v1:marker:T1702-20260718010102"), `pline-v3-idea-unit-${uniqueSuffix}`);
const ideaEvidenceKeys = await ideaKv.list(`evidence:v1:request:pline-v3-idea-unit-${uniqueSuffix}:stage:`);
assert.deepEqual(ideaEvidenceKeys.map((key) => key.name).sort(), [
  `evidence:v1:request:pline-v3-idea-unit-${uniqueSuffix}:stage:idea_json_file_written`,
  `evidence:v1:request:pline-v3-idea-unit-${uniqueSuffix}:stage:idea_json_final_callback_completed`,
  `evidence:v1:request:pline-v3-idea-unit-${uniqueSuffix}:stage:idea_json_saved`,
  `evidence:v1:request:pline-v3-idea-unit-${uniqueSuffix}:stage:monitor_claimed`,
]);

const targetedIdeaKv = createMemoryKv();
await createSyntheticIdeaTask({
  task_id: `idea-targeted-${uniqueSuffix}`,
  request_id: `pline-v3-targeted-idea-${uniqueSuffix}`,
  marker: "T1702T-20260718010102",
  idea: {
    ...idea,
    idea_id: `idea-targeted-${uniqueSuffix}`,
    line_event_key: `${"c".repeat(54)}${uniqueSuffix}`,
  },
}, { kv: targetedIdeaKv });
const targetedIdeaClaim = await claimOnce({
  kv: targetedIdeaKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" },
  taskId: `idea-targeted-${uniqueSuffix}`,
  action: SAVE_IDEA_ACTION,
});
assert.equal(targetedIdeaClaim.ok, true);
assert.equal(targetedIdeaClaim.claimed, true);
assert.equal(targetedIdeaClaim.task_id, `idea-targeted-${uniqueSuffix}`);

const preserveRefKv = createMemoryKv();
await preserveRefKv.put(`${IDEA_TASK_PREFIX}:task:idea-preserve-ref-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-idea-task/v1",
  status: "pending",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `idea-preserve-ref-${uniqueSuffix}`,
  request_id: `pline-v3-preserve-ref-${uniqueSuffix}`,
  marker: "T1703-20260718010103",
  action: SAVE_IDEA_ACTION,
  target_dir: DROPBOX_IDEA_DIR,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  idea,
  created_at: new Date().toISOString(),
}));
const preserveRefClaim = await claimOnce({ kv: preserveRefKv, env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" } });
assert.equal(preserveRefClaim.ok, true);
const preserveRefTask = JSON.parse(await preserveRefKv.get(`${IDEA_TASK_PREFIX}:task:idea-preserve-ref-${uniqueSuffix}`));
assert.equal(preserveRefTask.finalize_token, "test-finalize-token");
assert.equal(preserveRefTask.line_user_ref, "v1.encrypted.ref");
assert.equal(preserveRefTask.final_reply_text, "");

const runnerKv = createMemoryKv();
await createSyntheticIdeaTask({
  task_id: `idea-runner-${uniqueSuffix}`,
  request_id: `pline-v3-runner-idea-${uniqueSuffix}`,
  marker: "T1702R-20260718010102",
  idea: {
    ...idea,
    idea_id: `idea-runner-${uniqueSuffix}`,
    line_event_key: `${"d".repeat(54)}${uniqueSuffix}`,
  },
}, { kv: runnerKv });
const runnerHeartbeat = join(tmpdir(), `pline-v3-runner-heartbeat-${uniqueSuffix}.json`);
const runnerResult = await runner({
  kv: runnerKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" },
  iterations: 2,
  drainIterations: 5,
  intervalMs: 0,
  idleIntervalMs: 0,
  heartbeatPath: runnerHeartbeat,
});
assert.equal(runnerResult.ok, true);
assert.equal(runnerResult.drained, 1);
assert.equal(runnerResult.mode, "durable_poll_loop");
const runnerIdeaTask = JSON.parse(await runnerKv.get(`${IDEA_TASK_PREFIX}:task:idea-runner-${uniqueSuffix}`));
assert.equal(["completed", "duplicate"].includes(runnerIdeaTask.status), true);
assert.equal(await runnerKv.get(`${IDEA_TASK_PREFIX}:pending:idea-runner-${uniqueSuffix}`), "");
const heartbeat = JSON.parse(await readFile(runnerHeartbeat, "utf8"));
assert.equal(heartbeat.schema, "pline-v3-test-monitor-runner/v1");
assert.equal(heartbeat.monitor, "pline-v3-test-codex-monitor");
assert.equal(heartbeat.total_drained, 1);

const cleanupKvBase = createMemoryKv();
await cleanupKvBase.put(`${IDEA_TASK_PREFIX}:task:idea-a-terminal-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-idea-task/v1",
  status: "completed",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `idea-a-terminal-${uniqueSuffix}`,
  request_id: `pline-v3-terminal-cleanup-${uniqueSuffix}`,
  marker: "T1702X-20260718010102",
  action: SAVE_IDEA_ACTION,
  target_dir: DROPBOX_IDEA_DIR,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  final_reply_text: "幫妳記好了，這個想法已經收起來了 💡",
  idea: {
    ...idea,
    idea_id: `idea-a-terminal-${uniqueSuffix}`,
    line_event_key: `${"f".repeat(54)}${uniqueSuffix}`,
  },
  completed_at: "2026-07-18T00:00:00.000Z",
  created_at: "2026-07-18T00:00:00.000Z",
}));
await cleanupKvBase.put(`${IDEA_TASK_PREFIX}:pending:idea-a-terminal-${uniqueSuffix}`, `${IDEA_TASK_PREFIX}:task:idea-a-terminal-${uniqueSuffix}`);
await cleanupKvBase.put(`${IDEA_TASK_PREFIX}:pending:idea-b-missing-${uniqueSuffix}`, `${IDEA_TASK_PREFIX}:task:idea-b-missing-${uniqueSuffix}`);
await cleanupKvBase.put(`${IDEA_TASK_PREFIX}:task:idea-c-bad-${uniqueSuffix}`, "{not-json");
await cleanupKvBase.put(`${IDEA_TASK_PREFIX}:pending:idea-c-bad-${uniqueSuffix}`, `${IDEA_TASK_PREFIX}:task:idea-c-bad-${uniqueSuffix}`);
await createSyntheticIdeaTask({
  task_id: `idea-z-active-${uniqueSuffix}`,
  request_id: `pline-v3-active-after-cleanup-${uniqueSuffix}`,
  marker: "T1702Y-20260718010102",
  idea: {
    ...idea,
    idea_id: `idea-z-active-${uniqueSuffix}`,
    line_event_key: `${"0".repeat(54)}${uniqueSuffix}`,
  },
}, { kv: cleanupKvBase });
const cleanupKv = withDeleteFailures(cleanupKvBase, new Set([
  `${IDEA_TASK_PREFIX}:pending:idea-a-terminal-${uniqueSuffix}`,
]));
const cleanupResult = await drain({
  kv: cleanupKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" },
  iterations: 5,
  intervalMs: 0,
  legacyScan: false,
});
assert.equal(cleanupResult.ok, true);
assert.equal(cleanupResult.drained, 1);
assert.equal(["completed", "duplicate"].includes(JSON.parse(await cleanupKvBase.get(`${IDEA_TASK_PREFIX}:task:idea-z-active-${uniqueSuffix}`)).status), true);
assert.equal(await cleanupKvBase.get(`${IDEA_TASK_PREFIX}:pending:idea-z-active-${uniqueSuffix}`), "");
assert.equal(await cleanupKvBase.get(`${IDEA_TASK_PREFIX}:pending:idea-b-missing-${uniqueSuffix}`), "");
assert.equal(await cleanupKvBase.get(`${IDEA_TASK_PREFIX}:pending:idea-c-bad-${uniqueSuffix}`), "");
assert.notEqual(await cleanupKvBase.get(`${IDEA_TASK_PREFIX}:pending:idea-a-terminal-${uniqueSuffix}`), "");
const terminalWarningKeys = await cleanupKvBase.list(`evidence:v1:request:pline-v3-terminal-cleanup-${uniqueSuffix}:stage:`);
assert.equal(terminalWarningKeys.some((key) => key.name.endsWith(":monitor_pending_index_cleanup_warning")), true);

const staleKv = createMemoryKv();
await staleKv.put(`${IDEA_TASK_PREFIX}:task:idea-stale-${uniqueSuffix}`, JSON.stringify({
  schema: "pline-v3-test-idea-task/v1",
  status: "claimed",
  monitor: "pline-v3-test-codex-monitor",
  task_id: `idea-stale-${uniqueSuffix}`,
  request_id: `pline-v3-stale-idea-${uniqueSuffix}`,
  marker: "T1702S-20260718010102",
  action: SAVE_IDEA_ACTION,
  target_dir: DROPBOX_IDEA_DIR,
  finalize_token: "test-finalize-token",
  line_user_ref: "v1.encrypted.ref",
  final_reply_text: "幫妳記好了，這個想法已經收起來了 💡",
  idea: {
    ...idea,
    idea_id: `idea-stale-${uniqueSuffix}`,
    line_event_key: `${"e".repeat(54)}${uniqueSuffix}`,
  },
  claimed_at: "2026-07-18T00:00:00.000Z",
  created_at: "2026-07-18T00:00:00.000Z",
}));
const staleClaim = await claimOnce({
  kv: staleKv,
  env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" },
  staleClaimMs: 1,
});
assert.equal(staleClaim.ok, true);
assert.equal(staleClaim.claimed, true);
const staleTask = JSON.parse(await staleKv.get(`${IDEA_TASK_PREFIX}:task:idea-stale-${uniqueSuffix}`));
assert.equal(["completed", "duplicate"].includes(staleTask.status), true);
assert.equal(staleTask.final_reply_text, "幫妳記好了，這個想法已經收起來了 💡");
const staleEvidenceKeys = await staleKv.list(`evidence:v1:request:pline-v3-stale-idea-${uniqueSuffix}:stage:`);
assert.equal(staleEvidenceKeys.some((key) => key.name.endsWith(":monitor_stale_claim_recovered")), true);

const heartbeatPath = join(tmpdir(), `pline-v3-runner-heartbeat-write-${uniqueSuffix}.json`);
await writeRunnerHeartbeat({
  status: "ready",
  loops: 1,
  total_drained: 0,
  last_result: { ok: true, reason: "drain_complete" },
  updated_at: "2026-07-18T00:00:00.000Z",
}, heartbeatPath);
const heartbeatRecord = JSON.parse(await readFile(heartbeatPath, "utf8"));
assert.equal(heartbeatRecord.status, "ready");
assert.equal(JSON.stringify(heartbeatRecord).includes("U_SHOULD_NOT_STORE"), false);

const finalizeCalls = [];
globalThis.fetch = async (url, options) => {
  finalizeCalls.push({ url, options });
  return new Response(JSON.stringify({ status: "completed", pushed: true }), { status: 200 });
};
const notifyResult = await notifyIdeaFinalizer({
  task_id: "idea-finalizer-unit",
  request_id: "pline-v3-finalizer-unit",
  action: SAVE_IDEA_ACTION,
  finalize_token: "test-finalize-token",
}, "completed", {
  WORKER_BASE_URL: "https://worker.example.test",
});
assert.equal(notifyResult.ok, true);
assert.equal(notifyResult.pushed, true);
assert.equal(finalizeCalls.length, 1);
assert.equal(finalizeCalls[0].url, "https://worker.example.test/test/idea-finalize");
assert.deepEqual(JSON.parse(finalizeCalls[0].options.body), {
  task_id: "idea-finalizer-unit",
  request_id: "pline-v3-finalizer-unit",
  action: SAVE_IDEA_ACTION,
  status: "completed",
  finalize_token: "test-finalize-token",
});
globalThis.fetch = originalFetch;

const codexFinalizeCalls = [];
globalThis.fetch = async (url, options) => {
  codexFinalizeCalls.push({ url, options });
  return new Response(JSON.stringify({ status: "completed", pushed: true }), { status: 200 });
};
const codexNotifyResult = await notifyCodexFinalizer({
  task_id: "codex-finalizer-unit",
  request_id: "pline-v3-codex-finalizer-unit",
  action: FIXED_ACTION,
  finalize_token: "test-finalize-token",
}, "completed", {
  WORKER_BASE_URL: "https://worker.example.test",
});
assert.equal(codexNotifyResult.ok, true);
assert.equal(codexNotifyResult.pushed, true);
assert.equal(codexFinalizeCalls.length, 1);
assert.equal(codexFinalizeCalls[0].url, "https://worker.example.test/test/codex-finalize");
assert.deepEqual(JSON.parse(codexFinalizeCalls[0].options.body), {
  task_id: "codex-finalizer-unit",
  request_id: "pline-v3-codex-finalizer-unit",
  action: FIXED_ACTION,
  status: "completed",
  finalize_token: "test-finalize-token",
});
globalThis.fetch = originalFetch;

await rm(fakeCodexDir, { recursive: true, force: true });
console.log("monitor skeleton tests PASS");

function createMemoryKv() {
  const store = new Map();
  return {
    async list(prefix) {
      return [...store.keys()].filter((name) => name.startsWith(prefix)).sort().map((name) => ({ name }));
    },
    async get(key) {
      return store.get(key) || "";
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function withDeleteFailures(kv, failKeys) {
  return {
    list: (...args) => kv.list(...args),
    get: (...args) => kv.get(...args),
    put: (...args) => kv.put(...args),
    async delete(key) {
      if (failKeys.has(key)) {
        throw new Error("simulated_delete_failure");
      }
      return kv.delete(key);
    },
  };
}
