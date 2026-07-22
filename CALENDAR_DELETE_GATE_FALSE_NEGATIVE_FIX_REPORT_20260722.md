# CALENDAR_DELETE_GATE False-negative Final Fix Report

DATE: 2026-07-22 Asia/Taipei  
PROJECT: 菲比 LINE 智能助理_03  
FIXED_CATEGORY: PLine｜N8N｜n8n workflow 調整  
GATE: CALENDAR_DELETE_GATE  
TASK_TYPE: implementation_fix  
FAILURE_ROUND: 1  

## Formal failure evidence boundary

- Formal TEST A and B each displayed a safe summary and waited for `確認刪除`.
- Google Calendar deleted both isolated fixtures and later readback confirmed both were absent.
- LINE transport remained exactly once, but both semantic finals were false negatives: `這次沒有成功刪除行程，我先停在安全狀態。`
- Duplicate delete: 0. Existing Calendar effect: 0. Fixture cleanup: PASS. Marker active count: 0.
- Cancel, do-not-delete, ambiguity, no result, missing candidate, snapshot change, expiry, actor mismatch and unbounded-delete safety cases remained PASS.
- `BLOCKER=DEPLOYED_DELETE_FINAL_FALSE_NEGATIVE_AFTER_SUCCESSFUL_GOOGLE_DELETE` was reproduced independently in A and B.
- No fresh formal LINE test was run by this implementation thread.
- `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`

## Root cause

The deployed `Calendar Delete Terminal Readback` returned a Google Calendar tombstone with `status=cancelled` after successful deletion. The existing `Calendar Delete Verify Absence` recognized only HTTP 404 or a `not found` message as absence. Because the tombstone still carried an event reference, the verifier incorrectly mapped it to `calendar_delete_readback_still_exists`, and the strict Worker contract correctly emitted the safe failure final.

The failure was therefore in the n8n post-delete absence normalization and final result mapping, not in Google deletion, LINE transport, Worker confirmation, or Worker exactly-once delivery.

## Repair

- `Calendar Delete Inspect Existing` now treats a `status=cancelled` tombstone as non-active and records whether the pre-delete candidate was matched, changed or missing.
- `Calendar Delete Verify Absence` now accepts `cancelled`, 404 and `not found` as terminal absence.
- Absence maps to success only when the same execution had a verified `safe_to_delete` precondition or the Worker explicitly requested `readback_only` recovery.
- A normal request whose candidate was already missing or changed remains failed closed with zero delete and cannot be reported as success.
- A still-active event remains failed; an unknown response remains failed closed.
- No retry path performs a second Delete. Readback-only recovery remains read-only.
- Confirmation, actor/snapshot binding, TTL 600, cancellation, unbounded-delete rejection, idempotency and LINE exactly-once contracts are unchanged.

## Protected workflow diff

- Published baseline version: `29a73423-26f1-41dd-9398-bc2a62ed77b9`
- Baseline file SHA-256: `fd0d7399a19530adb0363ede11f2e29f61ef5fc7167d43cd099e019e112f0e66`
- Fix candidate: `N8N_WORKFLOW_PLINE_V3_CALENDAR_DELETE_TOMBSTONE_FIX_LUNA_IMPORT.json`
- Fix candidate SHA-256: `bbe464281d0dbdf9c8dcc3de62f2805f1175a9e12f77bdcc7d0d02c571ea0eac`
- Node count / connection sources: 161 / 160 before and after.
- Changed nodes: `Calendar Delete Inspect Existing`, `Calendar Delete Verify Absence` only.
- Changed connections: 0.
- User-controlled OpenAI core remained byte-equivalent: `gpt-5.6-luna`, temperature `0.1`, existing credential reference.
- Calendar backend remained `primary` with the existing credential reference.
- Memo/Create/Search/Update nodes and behavior were not changed.
- Backup: `backups/calendar-delete-final-false-negative-fix-20260722-171415/`
- Published-export evidence SHA-256: `75eb037087bd2e5a588488c7991b89f94ca1810032959fc7d91123187fc55b2f`

The first file-selection attempt made no draft change and was not published. A later valid n8n import appended the candidate, temporarily producing 322 unpublished nodes. The entire unpublished canvas was cleared, the exact 161-node candidate was reimported, re-exported and verified for the tombstone logic, frozen OpenAI settings, credentials and primary backend before Publish.

## Local verification

- Terminal readback executable contract: 6/6 PASS.
  - eligible Delete + cancelled tombstone: completed / absent;
  - readback-only + cancelled tombstone: completed / absent;
  - candidate missing before Delete: failed closed;
  - eligible Delete + 404: completed / absent;
  - still-active event: failed;
  - unknown readback: failed closed.
- Calendar Delete workflow structure/integrity: PASS.
- Worker integrated Create/Search/Update/Delete/Memo/reply/idempotency suite: 130/130 PASS.
- Calendar Update regression: PASS.
- Calendar Search regression: 38/38 PASS.
- Calendar Create regression: 18/18 PASS.
- Memo CRUD / natural / batch / archive-only: 39/39 + 9/9 + 19/19 + 18/18 PASS.
- Implementation-thread Calendar write/update/delete effect: 0 / 0 / 0.
- Implementation-thread LINE external send count: 0.

## Publish and Worker status

- Workflow: `PLine｜菲比智能客服｜V3 最小 AI Agent`
- Workflow ID: `kcMcBQos5cxsnWU1`
- Published name: `Calendar Delete Cancelled Tombstone Readback Fix`
- Published version: `bc6483ba-7c06-43db-91b9-88d53c07dfe3`
- Worker source changed: no.
- Worker deploy: not required; the existing Worker strict success validator and exactly-once delivery remain correct.
- Commit / push: not performed by instruction.
- Calendar Core checkpoint: not started.

## Fresh formal TEST handoff

Return to the existing `PLine｜TEST` thread, ID `019f8709-3547-71f1-93e6-2807a4b3f51d`.

Use new uniquely marked isolated fixtures and rerun fresh formal Delete A and B:

1. Sequence-selected candidate: summary → `確認刪除` → one Google Delete → terminal readback `cancelled` or 404 normalized as absent → one successful LINE final.
2. Single unique natural target: the same success chain.
3. Verify duplicate Delete 0, duplicate LINE final 0, existing Calendar effect 0, active marker count 0 and no internal identifiers.
4. Recheck cancellation and one candidate-missing fail-closed case to prove the eligibility guard did not regress.
5. Preserve `RETRY_EVIDENCE_LIMITATION: formal_same_webhook_live_replay_not_executed`; do not claim a same-webhook live replay PASS.

The Gate remains pending fresh formal A/B. Do not start Calendar Core checkpoint, commit or push before TEST PASS and Orchestrator closeout.
