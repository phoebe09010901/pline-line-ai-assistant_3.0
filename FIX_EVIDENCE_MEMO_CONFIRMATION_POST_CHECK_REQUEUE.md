# FIX Evidence - Memo Confirmation Post-Check Requeue

Date: 2026-07-19

Scope: `_03` TEST only.

## Clean Room

- Project: `菲比 LINE 智能助理_03`
- Project path: `/Users/phoebe/Documents/菲比 LINE 智能助理_03`
- Old project access: prohibited
- Old `_02` resources: not used
- Secrets, raw LINE User ID, and full webhook payload were not recorded.

## Problem

Fresh Memo A6 failed for marker `M4201-20260719074032`.

No-secret TEST summary:

- A5 delete request reached `needs_confirmation`.
- Confirmation id existed and remained pending.
- A6 confirmation request reached `crud_confirmation_check_started`.
- Missing after-check stages:
  - `crud_confirmation_requeued`
  - `crud_confirmation_reply_completed`
- Original task remained `needs_confirmation`.
- Remote pending queue stayed empty.

## Root Cause

The confirmation handler had two weak spots after `crud_confirmation_check_started`:

- Branches after confirmation lookup did not all emit durable no-secret stages, so a post-check failure could look like a silent stop.
- Valid confirmation wrote the pending index before writing the final `confirmation_accepted` state. A running monitor could claim and complete the task between those writes, then the handler could overwrite the completed final state back to `confirmation_accepted`.

## Repair

- Added no-secret durable stages for post-check branches:
  - `crud_confirmation_pending_loaded`
  - `crud_confirmation_record_missing`
  - `crud_confirmation_actor_mismatch`
  - `crud_confirmation_not_pending`
  - `crud_confirmation_expired`
  - `crud_confirmation_task_missing`
  - `crud_confirmation_task_marked_confirmed`
  - `crud_confirmation_pending_written`
  - `crud_confirmation_pending_write_failed`
  - `crud_confirmation_consume_failed`
  - `crud_confirmation_handler_failed`
- Added retry wrapper for confirmation KV writes.
- Reordered valid confirmation writes so task/final/confirmation state are prepared before the pending index is written.
- Confirmation text still bypasses n8n and preserves exactly-once behavior.

## M4201 Recovery

Recovery was performed after Worker code deployment and was recorded as recovery, not fresh PASS.

Recovery guard checked:

- Original task existed.
- Domain/operation matched `memo` / `memo_delete`.
- Task was still `needs_confirmation`.
- Confirmation record was pending and unused.
- Actor-scoped confirmation index matched the confirmation id.

Recovery result:

- Task status: `completed`
- Confirmation status: `used`
- Result status: `completed`
- Final status: `completed`
- `crud_confirmation_recovery_requeued`: present on the confirmation request
- `crud_task_final_push_completed`: present on the original delete request
- Remote pending queues: `crud=0`, `idea=0`, `codex=0`

## Validation

- `node --check worker/src/index.js`: PASS
- `node worker/test/worker.test.mjs`: PASS
- `node --check monitor/src/monitor.js`: PASS
- `node monitor/test/monitor.test.mjs`: PASS
- Worker `/health`: PASS; required env present
- Invalid LINE signature POST `/line/webhook`: `401`
- Secret/private scan effective hits: `0`

## Deployment

- Worker: `pline-v3-test-line-gateway`
- Worker URL: `https://pline-v3-test-line-gateway.phy4175.workers.dev`
- Worker version: `3c8acdcc-83af-459b-b701-695e100c574a`
- Monitor code changed: no
- Monitor reload: not required

## TEST Handoff

TEST should rerun fresh Memo A1-A8.

Expected fresh A6 behavior:

- `crud_confirmation_check_started`
- `crud_confirmation_pending_loaded`
- `crud_confirmation_task_marked_confirmed`
- `crud_confirmation_pending_written`
- `crud_confirmation_requeued`
- `crud_confirmation_reply_completed`
- No `n8n_background_started` on the confirmation request
- Original delete task completes exactly once and sends one final reply
