# FIX Evidence: Memo Confirmation Post-Check Live Path

## Scope

- Project: `菲比 LINE 智能助理_03`
- Root: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- CLEAN ROOM: no old project, `_02`, old workflow, old logs, old secret store, or raw LINE User ID used.
- Target: `_03` TEST Worker `pline-v3-test-line-gateway` and `_03` RUNTIME_KV only.

## Live Failure Intake

- Fresh marker: `M4301-20260719080416`
- Delete task: `memo-d95411aaa9c1b8e90264e71e`
- Confirmation id: `confirm-89f616f0a8f09e25`
- Confirmation request: `pline-v3-01KXVVG54AG4M2R0EN9DAG9GAV`
- Observed stages before fix: `line_event_received`, `signature_pass`, `admin_pass`, `idempotency_pass`, `crud_confirmation_check_started`.
- Missing before fix: all post-check stages, `crud_confirmation_requeued`, `crud_confirmation_reply_completed`.

## Root Cause

The live evidence did not prove the deployed Worker bundle contained the previous post-check instrumentation. `/health` had no confirmation-handler version marker, so a live failure with only `crud_confirmation_check_started` could not distinguish bundle mismatch from an exception or early return after the check stage.

## Repair

- Added Worker health marker `crud_confirmation_handler.version = post-check-requeue-v2`.
- Added explicit post-check stage inventory to `/health`.
- Added protected TEST selfcheck path `/test/crud-confirmation/selfcheck` that exercises the same confirmation handler without pushing LINE or calling n8n.
- Added `crud_confirmation_ack_push_skipped_selfcheck` only for the selfcheck wrapper.
- Kept confirmation pending-index write last.

## Deployment

- Worker deployed version: `294d56fa-f925-4db1-9f79-a10d4e9c4382`
- `/health`: PASS, includes `crud_confirmation_handler.version = post-check-requeue-v2`.
- Invalid signature `/line/webhook`: HTTP `401`.
- Unauthorized `/test/crud-confirmation/selfcheck`: HTTP `401`.

## M4301 Recovery

- Recovery type: bug recovery after code fix, not a fresh PASS.
- Original task was requeued with `confirmed=true` and pending index written last.
- Monitor claimed and completed the delete task.
- Remote pending queue after recovery: `[]`.
- Final state: `completed`.
- Durable stages for original delete request include `monitor_claimed`, `crud_task_executed`, `crud_task_result_recorded`, `crud_task_final_push_completed`, and `crud_task_final_callback_completed`.
- Confirmation record status: `used`.

## Validation

- Worker syntax: PASS.
- Worker unit tests: PASS.
- Monitor syntax: PASS.
- Monitor unit tests: PASS.
- `/health`: PASS.
- Invalid signature route: PASS, HTTP `401`.
- Remote pending queue: empty after recovery.
- Secrets/raw LINE User IDs/full payloads: not recorded in this evidence.

## TEST Handoff

Run a fresh Memo A1-A8. For A6 plain `確認`, TEST should now verify:

- `/health` shows `crud_confirmation_handler.version = post-check-requeue-v2`.
- Confirmation request evidence contains at least one post-check stage after `crud_confirmation_check_started`.
- Valid A5 pending confirmation produces `crud_confirmation_pending_loaded`, `crud_confirmation_task_marked_confirmed`, `crud_confirmation_pending_written`, `crud_confirmation_requeued`, and `crud_confirmation_reply_completed`.
- Confirmation path does not call n8n.
