import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmDeleteSelection,
  createSearchSnapshot,
  draftContract,
  finalizeDeleteOnce,
  parseDeleteSelectionCommand,
  prepareDeleteSelection,
} from "./worker_selection_confirmation_draft.mjs";

const SCOPE_A = "a".repeat(64);
const SCOPE_B = "b".repeat(64);
const VERSION_A = "c".repeat(64);
const VERSION_B = "d".repeat(64);
const NOW = 1_800_000_000_000;
const ids = Array.from({ length: 5 }, (_, index) => `memo-${String(index + 1).repeat(64)}`);
const candidates = ids.map((memo_id, index) => ({ memo_id, summary: `測試備忘錄 ${index + 1}` }));
const snapshot = () => createSearchSnapshot({ scopeHash: SCOPE_A, version: VERSION_A, candidates, nowMs: NOW });

function prepare(commandText, currentSnapshot = snapshot(), scopeHash = SCOPE_A, nowMs = NOW) {
  return prepareDeleteSelection({ commandText, snapshot: currentSnapshot, scopeHash, nowMs });
}

test("1 search one then delete first waits for confirmation and dispatches exactly one only after confirm", () => {
  const one = createSearchSnapshot({ scopeHash: SCOPE_A, version: VERSION_A, candidates: candidates.slice(0, 1), nowMs: NOW });
  const pending = prepare("備忘錄刪除：第1筆", one);
  assert.equal(pending.status, "waiting_confirmation");
  assert.equal(pending.external_effect_count, 0);
  const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: one, scopeHash: SCOPE_A, nowMs: NOW + 1 });
  assert.equal(confirmed.status, "dispatch_authorized");
  assert.deepEqual(confirmed.dispatch.memo_ids, ids.slice(0, 1));
});

test("2 search five natural-language range confirms five", () => {
  const pending = prepare("備忘錄刪除：第一筆到第五筆");
  const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_A, nowMs: NOW + 1 });
  assert.deepEqual(confirmed.dispatch.memo_ids, ids);
});

test("3 search five selection 1 3 5 confirms only three", () => {
  const pending = prepare("刪除第1、3、5筆");
  const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_A, nowMs: NOW + 1 });
  assert.deepEqual(confirmed.dispatch.memo_ids, [ids[0], ids[2], ids[4]]);
});

test("4 all means only the current five-candidate snapshot", () => {
  for (const command of ["備忘錄刪除：這次搜尋的全部", "備忘錄刪除：全部"]) {
    const pending = prepare(command);
    const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_A, nowMs: NOW + 1 });
    assert.deepEqual(confirmed.dispatch.memo_ids, ids);
  }
});

test("5 all without snapshot has exact clarification and zero write", () => {
  const prepared = prepare("備忘錄刪除：全部", null);
  assert.equal(prepared.reply_text, draftContract.no_snapshot_reply);
  assert.equal(prepared.external_effect_count, 0);
});

test("6 expired confirmation authorizes zero write", () => {
  const pending = prepare("刪除第1筆");
  const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_A, nowMs: NOW + 600_001 });
  assert.equal(confirmed.reason, "confirmation_expired");
  assert.equal(confirmed.external_effect_count, 0);
});

test("7 confirmation redelivery is consumed and cannot dispatch twice", () => {
  const pending = prepare("刪除第1筆");
  const first = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_A, nowMs: NOW + 1 });
  const repeated = confirmDeleteSelection({ text: "確認刪除", pending: first.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_A, nowMs: NOW + 2 });
  assert.equal(first.status, "dispatch_authorized");
  assert.equal(repeated.reason, "confirmation_already_consumed");
  assert.equal(repeated.external_effect_count, 0);
});

test("8 different actor confirmation authorizes zero write", () => {
  const pending = prepare("刪除第1筆");
  const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: snapshot(), scopeHash: SCOPE_B, nowMs: NOW + 1 });
  assert.equal(confirmed.reason, "actor_scope_mismatch");
  assert.equal(confirmed.external_effect_count, 0);
});

test("9 changed snapshot or candidate authorizes zero write", () => {
  const pending = prepare("刪除第1筆");
  const changed = createSearchSnapshot({ scopeHash: SCOPE_A, version: VERSION_B, candidates: candidates.slice(1), nowMs: NOW });
  const confirmed = confirmDeleteSelection({ text: "確認刪除", pending: pending.pending, currentSnapshot: changed, scopeHash: SCOPE_A, nowMs: NOW + 1 });
  assert.equal(confirmed.reason, "selection_snapshot_changed");
  assert.equal(confirmed.external_effect_count, 0);
});

test("10 parser supports required commands without changing create search or modify code", () => {
  for (const command of [
    "備忘錄刪除：第1筆", "刪除第1筆", "備忘錄刪除：第一筆到第五筆",
    "刪除第1、3、5筆", "備忘錄刪除：這次搜尋的全部",
  ]) assert.equal(parseDeleteSelectionCommand(command).valid, true, command);
  assert.equal(draftContract.external_execution, false);
});

test("11 final is exactly once and partial result never says all completed", () => {
  const partial = finalizeDeleteOnce({ expectedCount: 5, successCount: 3, failureReason: "安全檢查未通過" });
  assert.equal(partial.reply_required, true);
  assert.match(partial.reply_text, /預計 5 筆，成功 3 筆，未刪除 2 筆/);
  const repeated = finalizeDeleteOnce({ prior: partial.record, expectedCount: 5, successCount: 5 });
  assert.equal(repeated.reply_required, false);
  assert.equal(repeated.status, "already_finalized");
});

test("12 LINE prompts expose summaries and counts but no internal identifier", () => {
  const pending = prepare("刪除第1、3、5筆");
  assert.equal(pending.reply_text.includes("memo-"), false);
  assert.equal(pending.reply_text.includes(VERSION_A), false);
  assert.equal(pending.reply_text.includes(SCOPE_A), false);
  assert.match(pending.reply_text, /確認刪除/);
});
