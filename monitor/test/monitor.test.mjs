import assert from "node:assert/strict";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  FIXED_ACTION,
  SMOKE_FILE_CONTENT,
  SMOKE_FILE_PATH,
  TASK_PREFIX,
  claimOnce,
  createSyntheticTask,
  health,
  normalizeTask,
  runTask,
} from "../src/monitor.js";

assert.equal(FIXED_ACTION, "create_smoke_file");
assert.equal(SMOKE_FILE_PATH, "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt");
assert.equal(SMOKE_FILE_CONTENT, "Codex 已打通");

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

assert.deepEqual(normalizeTask({}), {
  task_id: "pline-v3-test-smoke",
  request_id: "",
  marker: "",
  action: "create_smoke_file",
  target_path: "/Users/phoebe/Documents/菲比 LINE 智能助理_03/codex-smoke.txt",
  content: "Codex 已打通",
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
