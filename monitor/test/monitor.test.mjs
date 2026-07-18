import assert from "node:assert/strict";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  DROPBOX_IDEA_DIR,
  FIXED_ACTION,
  IDEA_TASK_PREFIX,
  SAVE_IDEA_ACTION,
  SMOKE_FILE_CONTENT,
  SMOKE_FILE_PATH,
  TASK_PREFIX,
  claimOnce,
  createSyntheticIdeaTask,
  createSyntheticTask,
  health,
  normalizeTask,
  notifyIdeaFinalizer,
  runTask,
  saveIdeaJson,
  validateIdeaJson,
} from "../src/monitor.js";

assert.equal(FIXED_ACTION, "create_smoke_file");
assert.equal(SAVE_IDEA_ACTION, "save_idea_json");
assert.equal(SMOKE_FILE_PATH, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt");
assert.equal(SMOKE_FILE_CONTENT, "Codex 已打通");
assert.equal(DROPBOX_IDEA_DIR, "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03");

const blocked = await health({ CODEX_BIN: "/definitely/missing/codex", PATH: "" });
assert.equal(blocked.status, "blocked");
assert.equal(blocked.codex_bin.reason, "codex_executable_not_found_or_not_executable");

const fakeCodexDir = join(tmpdir(), `pline-v3-monitor-${Date.now()}`);
const fakeCodex = join(fakeCodexDir, "codex");
await mkdir(fakeCodexDir, { recursive: true });
await import("node:fs/promises").then(({ writeFile, chmod }) => writeFile(fakeCodex, "#!/bin/sh\nexit 0\n").then(() => chmod(fakeCodex, 0o755)));

const ready = await health({ CODEX_BIN: fakeCodex, PATH: "" });
assert.equal(ready.status, "ready");
assert.equal(ready.codex_bin.path, fakeCodex);
assert.equal(ready.task_prefix, "codex_task:v1");
assert.deepEqual(ready.supported_actions, ["create_smoke_file", "save_idea_json"]);

assert.deepEqual(normalizeTask({}), {
  task_id: "pline-v3-test-smoke",
  request_id: "",
  marker: "",
  action: "create_smoke_file",
  target_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt",
  target_dir: "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_03",
  content: "Codex 已打通",
  idea: null,
  finalize_token: "",
  line_user_ref: "",
});

assert.equal((await runTask({ action: "other" }, { CODEX_BIN: fakeCodex, PATH: "" })).reason, "unsupported_action");
assert.equal((await runTask({
  action: "create_smoke_file",
  target_path: "/tmp/not-allowed",
}, { CODEX_BIN: fakeCodex, PATH: "" })).reason, "unsupported_target_path");

await mkdir(dirname(SMOKE_FILE_PATH), { recursive: true });
const result = await runTask({ action: "create_smoke_file" }, { CODEX_BIN: fakeCodex, PATH: "" });
assert.equal(result.ok, true);
assert.equal(await readFile(SMOKE_FILE_PATH, "utf8"), "Codex 已打通");
await access(SMOKE_FILE_PATH, constants.F_OK);

const taskKv = createMemoryKv();
const synthetic = await createSyntheticTask({
  task_id: "pline-v3-monitor-unit-task",
  request_id: "pline-v3-monitor-unit-request",
  marker: "T1701-20260718010101",
}, { kv: taskKv });
assert.equal(synthetic.ok, true);
assert.equal((await taskKv.list(`${TASK_PREFIX}:task:`)).length, 1);

const claimed = await claimOnce({ kv: taskKv, env: { CODEX_BIN: fakeCodex, PATH: "" } });
assert.equal(claimed.ok, true);
assert.equal(claimed.claimed, true);
assert.equal(claimed.task_id, "pline-v3-monitor-unit-task");
assert.equal(claimed.request_id, "pline-v3-monitor-unit-request");
assert.equal(claimed.codex_execution, true);
assert.equal(claimed.file_written, true);
assert.equal(await readFile(SMOKE_FILE_PATH, "utf8"), "Codex 已打通");
const completedTask = JSON.parse(await taskKv.get(`${TASK_PREFIX}:task:pline-v3-monitor-unit-task`));
assert.equal(completedTask.status, "completed");
assert.equal(completedTask.codex_execution, true);
assert.equal(completedTask.file_written, true);
assert.equal(await taskKv.get("evidence:v1:marker:T1701-20260718010101"), "pline-v3-monitor-unit-request");
const evidenceKeys = await taskKv.list("evidence:v1:request:pline-v3-monitor-unit-request:stage:");
assert.deepEqual(evidenceKeys.map((key) => key.name).sort(), [
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:codex_execution_completed",
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:monitor_claimed",
  "evidence:v1:request:pline-v3-monitor-unit-request:stage:smoke_file_written",
]);

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
  finalize_token: "fin-preserve-ref-token",
  line_user_ref: "v1.encrypted.ref",
  idea,
  created_at: new Date().toISOString(),
}));
const preserveRefClaim = await claimOnce({ kv: preserveRefKv, env: { CODEX_BIN: fakeCodex, PATH: "", IDEA_FINALIZE_DISABLED: "1" } });
assert.equal(preserveRefClaim.ok, true);
const preserveRefTask = JSON.parse(await preserveRefKv.get(`${IDEA_TASK_PREFIX}:task:idea-preserve-ref-${uniqueSuffix}`));
assert.equal(preserveRefTask.finalize_token, "fin-preserve-ref-token");
assert.equal(preserveRefTask.line_user_ref, "v1.encrypted.ref");

const finalizeCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  finalizeCalls.push({ url, options });
  return new Response(JSON.stringify({ status: "completed", pushed: true }), { status: 200 });
};
const notifyResult = await notifyIdeaFinalizer({
  task_id: "idea-finalizer-unit",
  request_id: "pline-v3-finalizer-unit",
  action: SAVE_IDEA_ACTION,
  finalize_token: "fin-unit-token",
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
  finalize_token: "fin-unit-token",
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
  };
}
